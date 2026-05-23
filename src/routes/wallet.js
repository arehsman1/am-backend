const express  = require('express')
const { body } = require('express-validator')
const router   = express.Router()
const auth     = require('../middleware/auth')
const validate = require('../middleware/validate')
const { getWallet, initializePayment, verifyPayment, paystackWebhook } = require('../controllers/walletController')

// POST /wallet/webhook  — raw body, no auth, Paystack HMAC validated internally
router.post('/webhook', paystackWebhook)

router.use(auth)

// GET  /wallet
router.get('/', getWallet)

// POST /wallet/initialize
router.post('/initialize',
  [body('amount').isFloat({ min: 100 }).withMessage('Minimum deposit is ₦100')],
  validate, initializePayment
)

// GET  /wallet/verify/:reference
router.get('/verify/:reference', verifyPayment)

module.exports = router
