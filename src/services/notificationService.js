const supabase = require('../config/supabase')
const { sendEmail, buildWarningEmail, buildBanEmail } = require('./emailService')

/**
 * createNotification(userId, type, data)
 * Inserts a notification row.
 * Failure never crashes the caller — always non-fatal.
 */
const createNotification = async (userId, type, data = {}) => {
  try {
    await supabase.from('notifications').insert({
      user_id:    userId,
      type,
      data,
      is_read:    false,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error(`createNotification(${type}) failed:`, err.message)
  }
}

/**
 * notifyNewRequest(receiverId, senderId)
 */
const notifyNewRequest = (receiverId, senderId) =>
  createNotification(receiverId, 'new_request', { sender_id: senderId })

/**
 * notifyRequestAccepted(senderId, acceptorId)
 */
const notifyRequestAccepted = (senderId, acceptorId) =>
  createNotification(senderId, 'request_accepted', { acceptor_id: acceptorId })

/**
 * notifyImageUnlocked(ownerId, unlockerId, imageId, amount)
 */
const notifyImageUnlocked = (ownerId, unlockerId, imageId, amount) =>
  createNotification(ownerId, 'image_unlock', { unlocker_id: unlockerId, image_id: imageId, amount })

/**
 * notifyWarning(userId, email, name, note)
 * Creates in-app warning notification + sends email.
 */
const notifyWarning = async (userId, email, name, note) => {
  await createNotification(userId, 'warning', {
    message: note || 'Your behaviour has been flagged. Further violations may result in a ban.',
  })
  if (email) {
    const { subject, html } = buildWarningEmail(name)
    await sendEmail({ to: email, subject, html }).catch(err =>
      console.error('Warning email failed:', err.message)
    )
  }
}

/**
 * notifyBan(userId, email, name)
 * Creates in-app ban notification + sends email.
 */
const notifyBan = async (userId, email, name) => {
  await createNotification(userId, 'banned', {
    message: 'Your account has been permanently banned.',
  })
  if (email) {
    const { subject, html } = buildBanEmail(name)
    await sendEmail({ to: email, subject, html }).catch(err =>
      console.error('Ban email failed:', err.message)
    )
  }
}

module.exports = {
  createNotification,
  notifyNewRequest,
  notifyRequestAccepted,
  notifyImageUnlocked,
  notifyWarning,
  notifyBan,
}
