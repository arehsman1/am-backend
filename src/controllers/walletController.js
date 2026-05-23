const axios    = require('axios')
const crypto   = require('crypto')
const supabase = require('../config/supabase')
const { sendSuccess, sendError, generateReference, validatePaystackSignature } = require('../utils/helpers')

/** GET /wallet */
const getWallet = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('id, balance, currency, updated_at')
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) return sendError(res, 'Wallet not found', 404)
    return sendSuccess(res, data)
  } catch (err) {
    return sendError(res, 'Failed to fetch wallet')
  }
}

/** POST /wallet/initialize */
const initializePayment = async (req, res) => {
  const amount = parseFloat(req.body.amount)
  if (!amount || amount < 100) return sendError(res, 'Minimum deposit is ₦100', 400)

  const reference  = generateReference('DEP')
  const amountKobo = Math.round(amount * 100)

  try {
    const { data: wallet } = await supabase
      .from('wallets').select('id, balance').eq('user_id', req.user.id).single()
    if (!wallet) return sendError(res, 'Wallet not found', 404)

    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { email: req.user.email, amount: amountKobo, reference, metadata: { user_id: req.user.id } },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    )

    if (!paystackRes.data.status) return sendError(res, 'Paystack initialization failed', 502)

    await supabase.from('wallet_transactions').insert({
      user_id: req.user.id, type: 'deposit', amount,
      balance_before: wallet.balance, balance_after: wallet.balance,
      reference, status: 'pending', description: 'Paystack deposit',
    })

    return sendSuccess(res, {
      reference,
      authorization_url: paystackRes.data.data.authorization_url,
      amount_naira: amount,
    })
  } catch (err) {
    console.error('initializePayment:', err.message)
    return sendError(res, 'Failed to initialize payment')
  }
}

/** GET /wallet/verify/:reference */
const verifyPayment = async (req, res) => {
  const { reference } = req.params
  try {
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    )

    const txData = paystackRes.data?.data
    if (!paystackRes.data.status || txData?.status !== 'success') {
      return sendError(res, 'Payment not successful', 402)
    }
    if (txData.metadata?.user_id !== req.user.id) {
      return sendError(res, 'Payment does not belong to this account', 403)
    }

    const { data: existing } = await supabase
      .from('wallet_transactions').select('status').eq('reference', reference).single()
    if (existing?.status === 'success') {
      return sendSuccess(res, { already_credited: true }, 'Already credited')
    }

    await creditWallet(req.user.id, txData.amount / 100, reference)
    return sendSuccess(res, { credited: true, amount: txData.amount / 100 }, 'Wallet credited')
  } catch (err) {
    console.error('verifyPayment:', err.message)
    return sendError(res, 'Verification failed')
  }
}

/** POST /wallet/webhook */
const paystackWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature']
  if (!validatePaystackSignature(req.body, signature)) {
    return res.status(400).json({ message: 'Invalid signature' })
  }

  const payload = Buffer.isBuffer(req.body)
    ? JSON.parse(req.body.toString('utf8'))
    : req.body

  const { event, data } = payload
  if (event !== 'charge.success') return res.sendStatus(200)

  const { reference, amount, metadata } = data
  const userId = metadata?.user_id
  if (!userId) return res.sendStatus(200)

  try {
    const { data: txn } = await supabase
      .from('wallet_transactions').select('id, status').eq('reference', reference).eq('status', 'pending').single()
    if (!txn) return res.sendStatus(200) // already processed

    await creditWallet(userId, amount / 100, reference)
    return res.sendStatus(200)
  } catch (err) {
    console.error('webhook:', err.message)
    return res.sendStatus(500)
  }
}

const creditWallet = async (userId, amountNaira, reference) => {
  const { data, error } = await supabase.rpc('credit_wallet_deposit', {
    p_user_id: userId,
    p_amount: amountNaira,
    p_reference: reference,
  })

  if (error) throw error
  if (data === null) throw new Error('Wallet transaction not found or already processed')
  return data
}

module.exports = { getWallet, initializePayment, verifyPayment, paystackWebhook }
