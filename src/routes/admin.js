const express  = require('express')
const { body } = require('express-validator')
const router   = express.Router()
const auth     = require('../middleware/auth')
const validate = require('../middleware/validate')
const { requireAdmin, requireOwner } = require('../middleware/roles')
const {
  submitPromotionRequest, getPromotionRequests,
  approvePromotionRequest, rejectPromotionRequest,
  setUserRole, getStats,
} = require('../controllers/adminController')

router.use(auth)  // all admin routes require auth

// GET  /admin/stats  (admin/owner)
router.get('/stats', requireAdmin, getStats)

// ── Promotion flow ────────────────────────────────────────
// POST /admin/promotion-requests  (admin submits for a user)
router.post('/promotion-requests',
  requireAdmin,
  [
    body('target_user_id').isUUID().withMessage('Valid target_user_id required'),
    body('reason').optional().isLength({ max: 500 }),
  ],
  validate, submitPromotionRequest
)

// GET  /admin/promotion-requests  (owner sees pending)
router.get('/promotion-requests', requireOwner, getPromotionRequests)

// PATCH /admin/promotion-requests/:id/approve  (owner only)
router.patch('/promotion-requests/:id/approve', requireOwner, approvePromotionRequest)

// PATCH /admin/promotion-requests/:id/reject   (owner only — deletes from DB)
router.patch('/promotion-requests/:id/reject', requireOwner, rejectPromotionRequest)

// ── Role management ───────────────────────────────────────
// PATCH /admin/users/:id/role  (owner only)
router.patch('/users/:id/role',
  requireOwner,
  [body('role').isIn(['user', 'moderator', 'admin']).withMessage('Invalid role')],
  validate, setUserRole
)

module.exports = router
