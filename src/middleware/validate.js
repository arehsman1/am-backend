const { validationResult } = require('express-validator')
const { sendError }        = require('../utils/helpers')

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 422,
      errors.array().map(e => ({ field: e.path, message: e.msg }))
    )
  }
  next()
}

module.exports = validate
