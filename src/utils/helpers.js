const crypto = require('crypto')

const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ status: 'success', message, data })

const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
  const body = { status: 'error', message }
  if (errors) body.errors = errors
  return res.status(statusCode).json(body)
}

const validatePaystackSignature = (body, signature) => {
  const payload = Buffer.isBuffer(body) || typeof body === 'string'
    ? body
    : JSON.stringify(body)

  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest('hex')
  return hash === signature
}

const generateReference = (prefix = 'TXN') =>
  `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex').toUpperCase()}`

const getPagination = (query) => {
  const page   = Math.max(1, parseInt(query.page)   || 1)
  const limit  = Math.min(100, parseInt(query.limit) || 20)
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

module.exports = { sendSuccess, sendError, validatePaystackSignature, generateReference, getPagination }
