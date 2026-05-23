const axios = require('axios')

/**
 * sendSMS({ to, message })
 * Routes through the provider set in SMS_PROVIDER env var.
 * `to` must be E.164 format e.g. +2348012345678
 */
const sendSMS = async ({ to, message }) => {
  const provider = (process.env.SMS_PROVIDER || 'termii').toLowerCase()
  switch (provider) {
    case 'twilio': return _sendViaTwilio({ to, message })
    case 'msg91':  return _sendViaMSG91({ to, message })
    default:       return _sendViaTermii({ to, message })
  }
}

// ── Termii (Nigeria) ──────────────────────────────────────
const _sendViaTermii = async ({ to, message }) => {
  await axios.post('https://api.ng.termii.com/api/sms/send', {
    to,
    from:    process.env.TERMII_FROM || 'MatchApp',
    sms:     message,
    type:    'plain',
    channel: 'generic',
    api_key: process.env.TERMII_API_KEY,
  })
}

// ── Twilio ────────────────────────────────────────────────
const _sendViaTwilio = async ({ to, message }) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env
  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: message }).toString(),
    {
      auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  )
}

// ── MSG91 ─────────────────────────────────────────────────
const _sendViaMSG91 = async ({ to, message }) => {
  const phone = to.replace('+', '')
  await axios.post('https://api.msg91.com/api/v5/flow/', {
    template_id: process.env.MSG91_TEMPLATE_ID,
    sender:      process.env.MSG91_SENDER_ID || 'MATCH',
    mobiles:     phone,
    message,
  }, { headers: { authkey: process.env.MSG91_AUTH_KEY } })
}

module.exports = { sendSMS }
