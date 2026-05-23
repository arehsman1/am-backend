const { sendError } = require('../utils/helpers')

// Role hierarchy — higher index = more permissions
const ROLE_LEVELS = { user: 0, moderator: 1, admin: 2, owner: 3 }

/**
 * requireRole(...roles)
 * Allows access only if req.user.role is in the allowed list.
 * Example: requireRole('admin', 'owner')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return sendError(res, 'Not authenticated', 401)
  if (!roles.includes(req.user.role)) {
    return sendError(res, `Access denied. Required role: ${roles.join(' or ')}`, 403)
  }
  next()
}

/**
 * requireMinRole(role)
 * Allows access if the user's role level is >= the required level.
 * Example: requireMinRole('admin') allows admin + owner
 */
const requireMinRole = (minRole) => (req, res, next) => {
  if (!req.user) return sendError(res, 'Not authenticated', 401)
  const userLevel     = ROLE_LEVELS[req.user.role]     ?? 0
  const requiredLevel = ROLE_LEVELS[minRole]            ?? 99
  if (userLevel < requiredLevel) {
    return sendError(res, `Access denied. Minimum role required: ${minRole}`, 403)
  }
  next()
}

/**
 * requireOwner
 * Only the owner role can pass.
 */
const requireOwner = requireRole('owner')

/**
 * requireAdmin
 * Admin or owner can pass.
 */
const requireAdmin = requireMinRole('admin')

/**
 * requireModerator
 * Moderator, admin, or owner can pass.
 */
const requireModerator = requireMinRole('moderator')

/**
 * requireVerified
 * User must have is_verified = true.
 * Used on interaction endpoints (send request, like, message, unlock image).
 */
const requireVerified = (req, res, next) => {
  if (!req.user) return sendError(res, 'Not authenticated', 401)
  if (!req.user.is_verified) {
    return sendError(res, 'Please verify your account to access this feature.', 403)
  }
  next()
}

module.exports = { requireRole, requireMinRole, requireOwner, requireAdmin, requireModerator, requireVerified }
