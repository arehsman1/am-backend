const supabase = require('../config/supabase')
const { sendSuccess, sendError, getPagination } = require('../utils/helpers')

const VALID_INTENTS = [
  'Serious relationship', 'Marriage minded',
  'Situationship / No strings attached', 'Friendship', 'ovn/st',
]

const ALLOWED_UPDATE_FIELDS = [
  'full_name', 'age', 'location_city', 'location_country',
  'bio', 'intent', 'profile_picture', 'phone_number',
  'occupation', 'religion', 'genotype', 'blood_group',
  'num_kids', 'marital_status',
  // NOTE: gender is NOT in this list — backend enforces this
]

/** GET /users/explore */
const getExploreFeed = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query)
  const userId = req.user.id

  try {
    // Get caller's city for location sorting
    const { data: me } = await supabase
      .from('profiles')
      .select('location_city')
      .eq('id', userId)
      .single()

    // Fetch all non-banned, non-self profiles
    const { data: profiles, error, count } = await supabase
      .from('profiles')
      .select(`
        id, full_name, age, gender, location_city, location_country,
        bio, intent, profile_picture, is_verified, last_active_at,
        boosts!left(is_active, expires_at)
      `, { count: 'exact' })
      .neq('id', userId)
      .eq('is_banned', false)
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Sort: boosted → recently active → same city → newest
    const now = new Date()
    const sorted = (profiles || [])
      .map(p => ({
        ...p,
        is_boosted: p.boosts?.some(b => b.is_active && new Date(b.expires_at) > now) || false,
        is_recently_active: p.last_active_at && (now - new Date(p.last_active_at)) < 7 * 24 * 3600 * 1000,
        boosts: undefined, // strip raw boost data
      }))
      .sort((a, b) => {
        if (a.is_boosted !== b.is_boosted) return b.is_boosted ? 1 : -1
        if (a.is_recently_active !== b.is_recently_active) return b.is_recently_active ? 1 : -1
        const aCity = a.location_city === me?.location_city
        const bCity = b.location_city === me?.location_city
        if (aCity !== bCity) return bCity ? 1 : -1
        return 0
      })

    return sendSuccess(res, {
      profiles: sorted,
      pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
    })
  } catch (err) {
    console.error('getExploreFeed:', err.message)
    return sendError(res, 'Failed to load explore feed')
  }
}

/** GET /users/:id */
const getUserProfile = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, age, gender, location_city, location_country, bio, intent, profile_picture, is_verified, created_at')
      .eq('id', req.params.id)
      .eq('is_banned', false)
      .single()

    if (error || !data) return sendError(res, 'User not found', 404)
    return sendSuccess(res, data)
  } catch (err) {
    return sendError(res, 'Failed to fetch profile')
  }
}

/** PATCH /users/me — update own profile */
const updateMyProfile = async (req, res) => {
  const updates = {}

  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  // Enforce: gender cannot be changed
  if (req.body.gender !== undefined) {
    return sendError(res, 'Gender cannot be changed after registration.', 400)
  }

  // Validate intent
  if (updates.intent && !VALID_INTENTS.includes(updates.intent)) {
    return sendError(res, `Invalid intent. Must be one of: ${VALID_INTENTS.join(', ')}`, 400)
  }

  if (Object.keys(updates).length === 0) {
    return sendError(res, 'No valid fields to update', 400)
  }

  updates.updated_at = new Date().toISOString()

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single()

    if (error) throw error
    return sendSuccess(res, data, 'Profile updated')
  } catch (err) {
    console.error('updateMyProfile:', err.message)
    return sendError(res, 'Failed to update profile')
  }
}

/** PATCH /users/:id/verify — admin/owner only */
const verifyUser = async (req, res) => {
  const { id } = req.params
  const { is_verified } = req.body

  if (typeof is_verified !== 'boolean') {
    return sendError(res, 'is_verified must be a boolean', 400)
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_verified, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, email, is_verified')
      .single()

    if (error) throw error
    return sendSuccess(res, data, `User ${is_verified ? 'verified' : 'unverified'} successfully`)
  } catch (err) {
    console.error('verifyUser:', err.message)
    return sendError(res, 'Failed to update verification status')
  }
}

/** PATCH /users/:id/ban — admin/owner only */
const banUser = async (req, res) => {
  const { id } = req.params
  const { banned, reason } = req.body

  // Owner cannot be banned by admin
  const { data: target } = await supabase.from('profiles').select('role').eq('id', id).single()
  if (target?.role === 'owner') return sendError(res, 'Cannot ban the owner', 403)
  if (target?.role === 'admin' && req.user.role !== 'owner') {
    return sendError(res, 'Only the owner can ban admins', 403)
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_banned: !!banned, ban_reason: reason || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, is_banned')
      .single()

    if (error) throw error
    return sendSuccess(res, data, `User ${banned ? 'banned' : 'unbanned'}`)
  } catch (err) {
    return sendError(res, 'Failed to update ban status')
  }
}

/** GET /users — admin list all users */
const listUsers = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query)
  const { role, is_verified, search } = req.query

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, role, is_verified, is_banned, gender, location_city, created_at', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false })

  if (role)        query = query.eq('role', role)
  if (is_verified) query = query.eq('is_verified', is_verified === 'true')
  if (search)      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)

  try {
    const { data, error, count } = await query
    if (error) throw error
    return sendSuccess(res, {
      users: data,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    })
  } catch (err) {
    return sendError(res, 'Failed to fetch users')
  }
}

module.exports = { getExploreFeed, getUserProfile, updateMyProfile, verifyUser, banUser, listUsers }
