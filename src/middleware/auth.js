const supabase      = require('../config/supabase')
const { sendError } = require('../utils/helpers')

/**
 * authenticate
 * Verifies the Supabase Bearer token.
 * Loads the user's profile (including role) from the database.
 * Attaches req.user = { id, email, role, is_verified }
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required', 401)
  }

  const token = authHeader.split(' ')[1]

  try {
    // Verify token with Supabase — always server-side, never trust frontend
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return sendError(res, 'Invalid or expired token', 401)
    }

    // Load profile to get role and verification status
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, role, is_verified, is_banned')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return sendError(res, 'User profile not found', 401)
    }

    if (profile.is_banned) {
      return sendError(res, 'Your account has been banned. Contact support.', 403)
    }

    req.user = {
      id:          user.id,
      email:       user.email,
      role:        profile.role        || 'user',
      is_verified: profile.is_verified || false,
    }

    next()
  } catch (err) {
    console.error('authenticate error:', err.message)
    return sendError(res, 'Authentication failed', 401)
  }
}

module.exports = authenticate
