const express  = require('express')
const { body } = require('express-validator')
const router   = express.Router()
const auth     = require('../middleware/auth')
const validate = require('../middleware/validate')
const {
  register, login, logout, getMe, refreshToken,
} = require('../controllers/authController')

// POST /auth/register
router.post('/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate, register
)

// POST /auth/login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate, login
)

// POST /auth/logout
router.post('/logout', auth, logout)

// GET /auth/me
router.get('/me', auth, getMe)

// POST /auth/refresh
router.post('/refresh',
  [body('refresh_token').notEmpty().withMessage('Refresh token required')],
  validate, refreshToken
)

module.exports = router
