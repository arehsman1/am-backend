const supabase = require('../config/supabase')
const { sendSuccess, sendError } = require('../utils/helpers')

/** POST /auth/register */
const register = async (req, res) => {
  const { email, password } = req.body
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: false,
    })
    if (error) return sendError(res, error.message, 400)

    // Profile + wallet created by DB trigger (handle_new_user)
    return sendSuccess(res, { user_id: data.user.id }, 'Registration successful. Please verify your email.', 201)
  } catch (err) {
    console.error('register:', err.message)
    return sendError(res, 'Registration failed')
  }
}

/** POST /auth/login */
const login = async (req, res) => {
  const { email, password } = req.body
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return sendError(res, 'Invalid email or password', 401)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_verified, is_banned')
      .eq('id', data.user.id)
      .single()

    if (profile?.is_banned) return sendError(res, 'Account banned. Contact support.', 403)

    return sendSuccess(res, {
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id:          data.user.id,
        email:       data.user.email,
        role:        profile?.role        || 'user',
        is_verified: profile?.is_verified || false,
      },
    }, 'Login successful')
  } catch (err) {
    console.error('login:', err.message)
    return sendError(res, 'Login failed')
  }
}

/** POST /auth/logout */
const logout = async (req, res) => {
  try {
    await supabase.auth.admin.signOut(req.headers.authorization?.split(' ')[1])
    return sendSuccess(res, null, 'Logged out')
  } catch {
    return sendSuccess(res, null, 'Logged out')
  }
}

/** GET /auth/me */
const getMe = async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_verified, gender, age, location_city, location_country, bio, intent, profile_picture, created_at')
      .eq('id', req.user.id)
      .single()

    return sendSuccess(res, profile)
  } catch (err) {
    return sendError(res, 'Failed to fetch user')
  }
}

/** POST /auth/refresh */
const refreshToken = async (req, res) => {
  const { refresh_token } = req.body
  if (!refresh_token) return sendError(res, 'Refresh token required', 400)
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token })
    if (error) return sendError(res, 'Invalid refresh token', 401)
    return sendSuccess(res, {
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  } catch (err) {
    return sendError(res, 'Token refresh failed')
  }
}

module.exports = { register, login, logout, getMe, refreshToken }
