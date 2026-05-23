const express  = require('express')
const { body } = require('express-validator')
const router   = express.Router()
const auth     = require('../middleware/auth')
const validate = require('../middleware/validate')
const { requireAdmin, requireVerified } = require('../middleware/roles')
const {
  getExploreFeed, getUserProfile, updateMyProfile,
  verifyUser, banUser, listUsers,
} = require('../controllers/usersController')

router.use(auth) // all user routes require auth

// GET  /users/explore
router.get('/explore', requireVerified, getExploreFeed)

// GET  /users  (admin only)
router.get('/', requireAdmin, listUsers)

// GET  /users/me  (own full profile)
router.get('/me', (req, res) => {
  const { getMe } = require('../controllers/authController')
  return getMe(req, res)
})

// PATCH /users/me  (update own profile — gender locked on backend)
router.patch('/me',
  [
    body('age').optional().isInt({ min: 18, max: 100 }),
    body('bio').optional().isLength({ max: 500 }),
    body('intent').optional().isString(),
  ],
  validate, updateMyProfile
)

// GET  /users/:id  (public profile)
router.get('/:id', getUserProfile)

// PATCH /users/:id/verify  (admin/owner only)
router.patch('/:id/verify',
  requireAdmin,
  [body('is_verified').isBoolean()],
  validate, verifyUser
)

// PATCH /users/:id/ban  (admin/owner only)
router.patch('/:id/ban',
  requireAdmin,
  [body('banned').isBoolean()],
  validate, banUser
)

module.exports = router
