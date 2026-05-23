const express  = require('express')
const { body } = require('express-validator')
const router   = express.Router()
const auth     = require('../middleware/auth')
const validate = require('../middleware/validate')
const { requireModerator } = require('../middleware/roles')
const { submitReport, getMyReports, getAllReports, actionReport } = require('../controllers/reportsController')

router.use(auth)

// POST /reports
router.post('/',
  [
    body('reported_user_id').isUUID().withMessage('Valid reported_user_id required'),
    body('reason').isIn(['harassment','fake_profile','spam','inappropriate_content','scam','other']),
    body('description').optional().isLength({ max: 1000 }),
  ],
  validate, submitReport
)

// GET  /reports/mine
router.get('/mine', getMyReports)

// GET  /reports  (admin/moderator)
router.get('/', requireModerator, getAllReports)

// PATCH /reports/:id/action  (admin/moderator)
router.patch('/:id/action',
  requireModerator,
  [
    body('action').isIn(['warn','ban','delete_content','close']),
    body('admin_note').optional().isLength({ max: 1000 }),
  ],
  validate, actionReport
)

module.exports = router
