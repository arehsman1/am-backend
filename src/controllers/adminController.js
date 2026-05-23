const supabase = require('../config/supabase')
const { sendSuccess, sendError, getPagination } = require('../utils/helpers')

// ── Admin Promotion Flow ──────────────────────────────────

/** POST /admin/promotion-requests
 *  Admin submits a request to promote a user to admin role.
 *  Only owner can approve it.
 */
const submitPromotionRequest = async (req, res) => {
  const { target_user_id, reason } = req.body

  if (!target_user_id) return sendError(res, 'target_user_id is required', 400)

  try {
    // Check target exists and is a regular user
    const { data: target } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', target_user_id)
      .single()

    if (!target) return sendError(res, 'Target user not found', 404)
    if (target.role !== 'user' && target.role !== 'moderator') {
      return sendError(res, 'User is already an admin or owner', 400)
    }

    // Check no existing pending request for this user
    const { data: existing } = await supabase
      .from('admin_requests')
      .select('id')
      .eq('target_user_id', target_user_id)
      .eq('status', 'pending')
      .single()

    if (existing) return sendError(res, 'A pending promotion request already exists for this user', 409)

    const { data, error } = await supabase
      .from('admin_requests')
      .insert({
        requested_by:   req.user.id,
        target_user_id,
        reason:         reason || null,
        status:         'pending',
        created_at:     new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return sendSuccess(res, data, 'Promotion request submitted. Awaiting owner approval.', 201)
  } catch (err) {
    console.error('submitPromotionRequest:', err.message)
    return sendError(res, 'Failed to submit promotion request')
  }
}

/** GET /admin/promotion-requests — owner sees all pending */
const getPromotionRequests = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_requests')
      .select(`
        id, status, reason, created_at,
        requester:profiles!requested_by(id, full_name, email),
        target:profiles!target_user_id(id, full_name, email, role)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return sendSuccess(res, data)
  } catch (err) {
    return sendError(res, 'Failed to fetch promotion requests')
  }
}

/** PATCH /admin/promotion-requests/:id/approve — owner only */
const approvePromotionRequest = async (req, res) => {
  const { id } = req.params

  try {
    const { data: request, error: fetchErr } = await supabase
      .from('admin_requests')
      .select('id, target_user_id, status')
      .eq('id', id)
      .single()

    if (fetchErr || !request) return sendError(res, 'Request not found', 404)
    if (request.status !== 'pending') return sendError(res, 'Request already actioned', 400)

    // Promote the user
    const { error: promoteErr } = await supabase
      .from('profiles')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('id', request.target_user_id)

    if (promoteErr) throw promoteErr

    // Mark request as approved
    await supabase
      .from('admin_requests')
      .update({ status: 'approved', actioned_by: req.user.id, actioned_at: new Date().toISOString() })
      .eq('id', id)

    return sendSuccess(res, null, 'User promoted to admin successfully')
  } catch (err) {
    console.error('approvePromotionRequest:', err.message)
    return sendError(res, 'Failed to approve promotion')
  }
}

/** PATCH /admin/promotion-requests/:id/reject — owner only
 *  Rejected requests are deleted from the database.
 */
const rejectPromotionRequest = async (req, res) => {
  const { id } = req.params

  try {
    const { data: request } = await supabase
      .from('admin_requests')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!request) return sendError(res, 'Request not found', 404)
    if (request.status !== 'pending') return sendError(res, 'Request already actioned', 400)

    // Delete the request (rejected requests do not remain in DB)
    const { error } = await supabase.from('admin_requests').delete().eq('id', id)
    if (error) throw error

    return sendSuccess(res, null, 'Promotion request rejected and deleted')
  } catch (err) {
    console.error('rejectPromotionRequest:', err.message)
    return sendError(res, 'Failed to reject promotion request')
  }
}

/** PATCH /admin/users/:id/role — owner only: set any role */
const setUserRole = async (req, res) => {
  const { role } = req.body
  const validRoles = ['user', 'moderator', 'admin']

  // Owner cannot be set via API (must be done in DB directly)
  if (!validRoles.includes(role)) {
    return sendError(res, `Role must be one of: ${validRoles.join(', ')}`, 400)
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .neq('role', 'owner') // owner cannot be changed via API
      .select('id, full_name, role')
      .single()

    if (error) throw error
    return sendSuccess(res, data, `User role updated to ${role}`)
  } catch (err) {
    return sendError(res, 'Failed to update role')
  }
}

/** GET /admin/stats */
const getStats = async (req, res) => {
  try {
    const [userStats, mediaStats, reportStats, requestStats] = await Promise.all([
      supabase.from('profiles').select('role, is_verified, is_banned', { count: 'exact', head: false }),
      supabase.from('media').select('status', { count: 'exact', head: false }),
      supabase.from('reports').select('status', { count: 'exact', head: false }),
      supabase.from('admin_requests').select('status', { count: 'exact', head: false }),
    ])

    const users   = userStats.data   || []
    const media   = mediaStats.data  || []
    const reports = reportStats.data || []
    const reqs    = requestStats.data || []

    return sendSuccess(res, {
      users: {
        total:       users.length,
        verified:    users.filter(u => u.is_verified).length,
        unverified:  users.filter(u => !u.is_verified).length,
        banned:      users.filter(u => u.is_banned).length,
        by_role: {
          user:       users.filter(u => u.role === 'user').length,
          moderator:  users.filter(u => u.role === 'moderator').length,
          admin:      users.filter(u => u.role === 'admin').length,
        },
      },
      media: {
        total:    media.length,
        pending:  media.filter(m => m.status === 'pending').length,
        approved: media.filter(m => m.status === 'approved').length,
        rejected: media.filter(m => m.status === 'rejected').length,
      },
      reports: {
        total:    reports.length,
        open:     reports.filter(r => r.status === 'open').length,
        resolved: reports.filter(r => r.status === 'resolved').length,
      },
      promotion_requests: {
        pending: reqs.filter(r => r.status === 'pending').length,
      },
    })
  } catch (err) {
    console.error('getStats:', err.message)
    return sendError(res, 'Failed to fetch stats')
  }
}

module.exports = {
  submitPromotionRequest,
  getPromotionRequests,
  approvePromotionRequest,
  rejectPromotionRequest,
  setUserRole,
  getStats,
}
