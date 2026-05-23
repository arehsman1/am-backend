const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { requireAdmin, requireModerator } = require('../middleware/roles')
const { uploadSingle } = require('../middleware/upload')
const {
  uploadMedia, getMyMedia, deleteMyMedia, getProfileMedia,
  getPendingMedia, approveMedia, rejectMedia,
} = require('../controllers/mediaController')

router.use(auth)

// POST /media/upload  (authenticated user)
router.post('/upload', uploadSingle, uploadMedia)

// GET  /media/my
router.get('/my', getMyMedia)

// DELETE /media/:id
router.delete('/:id', deleteMyMedia)

// GET  /media/profile/:userId  (approved media only — public)
router.get('/profile/:userId', getProfileMedia)

// ── Admin / Moderator moderation ──────────────────────────
// GET  /media/admin/pending
router.get('/admin/pending', requireModerator, getPendingMedia)

// PATCH /media/admin/:id/approve
router.patch('/admin/:id/approve', requireModerator, approveMedia)

// PATCH /media/admin/:id/reject  (deletes file + record)
router.patch('/admin/:id/reject', requireModerator, rejectMedia)

module.exports = router
