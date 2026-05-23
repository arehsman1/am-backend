const express  = require('express')
const { body } = require('express-validator')
const router   = express.Router()
const auth     = require('../middleware/auth')
const validate = require('../middleware/validate')
const { requireModerator } = require('../middleware/roles')
const {
  createTicket, getMyTickets, getTicketThread,
  replyToTicket, getAllTickets, closeTicket,
} = require('../controllers/supportController')

router.use(auth)

// POST /support/tickets  (user opens ticket — only way to contact admin)
router.post('/tickets',
  [
    body('subject').trim().notEmpty().withMessage('Subject required').isLength({ max: 200 }),
    body('message').trim().notEmpty().withMessage('Message required').isLength({ max: 2000 }),
  ],
  validate, createTicket
)

// GET  /support/tickets  (user's own tickets)
router.get('/tickets', getMyTickets)

// GET  /support/tickets/:id  (thread view)
router.get('/tickets/:id', getTicketThread)

// POST /support/tickets/:id/reply
router.post('/tickets/:id/reply',
  [body('message').trim().notEmpty().isLength({ max: 2000 })],
  validate, replyToTicket
)

// ── Admin ─────────────────────────────────────────────────
// GET  /support/admin/tickets
router.get('/admin/tickets', requireModerator, getAllTickets)

// PATCH /support/admin/tickets/:id/close
router.patch('/admin/tickets/:id/close', requireModerator, closeTicket)

module.exports = router
