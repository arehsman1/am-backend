const supabase = require('../config/supabase')
const { sendSuccess, sendError, getPagination } = require('../utils/helpers')
const { notifyWarning, notifyBan } = require('../services/notificationService')

const VALID_ACTIONS  = ['warn', 'ban', 'delete_content', 'close']
const VALID_REASONS  = ['harassment', 'fake_profile', 'spam', 'inappropriate_content', 'scam', 'other']

/** POST /reports — user submits a report */
const submitReport = async (req, res) => {
  const { reported_user_id, reason, description } = req.body
  const reporterId = req.user.id

  if (reporterId === reported_user_id) return sendError(res, 'Cannot report yourself', 400)
  if (!VALID_REASONS.includes(reason)) {
    return sendError(res, `Reason must be one of: ${VALID_REASONS.join(', ')}`, 400)
  }

  try {
    // Prevent duplicate open reports
    const { data: existing } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('reported_user_id', reported_user_id)
      .eq('status', 'open')
      .single()

    if (existing) return sendError(res, 'You already have an open report against this user', 409)

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id:      reporterId,
        reported_user_id,
        reason,
        description:  description || null,
        status:       'open',
      })
      .select()
      .single()

    if (error) throw error
    return sendSuccess(res, data, 'Report submitted. Our team will review it.', 201)
  } catch (err) {
    console.error('submitReport:', err.message)
    return sendError(res, 'Failed to submit report')
  }
}

/** GET /reports/mine — user's own submitted reports */
const getMyReports = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('id, reason, status, description, created_at, reported_user:profiles!reported_user_id(full_name)')
      .eq('reporter_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return sendSuccess(res, data)
  } catch (err) {
    return sendError(res, 'Failed to fetch reports')
  }
}

/** GET /reports — admin/moderator list all reports */
const getAllReports = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query)
  const { status } = req.query

  let query = supabase
    .from('reports')
    .select(`
      id, reason, description, status, admin_note, created_at,
      reporter:profiles!reporter_id(id, full_name, email),
      reported:profiles!reported_user_id(id, full_name, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  try {
    const { data, error, count } = await query
    if (error) throw error
    return sendSuccess(res, {
      reports: data,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    })
  } catch (err) {
    return sendError(res, 'Failed to fetch reports')
  }
}

/** PATCH /reports/:id/action — admin takes action */
const actionReport = async (req, res) => {
  const { action, admin_note } = req.body

  if (!VALID_ACTIONS.includes(action)) {
    return sendError(res, `Action must be one of: ${VALID_ACTIONS.join(', ')}`, 400)
  }

  try {
    const { data: report } = await supabase
      .from('reports')
      .select('id, reported_user_id, status')
      .eq('id', req.params.id)
      .single()

    if (!report) return sendError(res, 'Report not found', 404)
    if (report.status !== 'open') return sendError(res, 'Report already actioned', 400)

    // Take action on the reported user
    if (action === 'ban') {
      // Fetch reported user's details for notification
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', report.reported_user_id)
        .single()

      if (targetUser?.role === 'owner') {
        return sendError(res, 'Cannot ban the owner', 403)
      }

      await supabase.from('profiles')
        .update({ is_banned: true, ban_reason: admin_note || 'Banned following report', updated_at: new Date().toISOString() })
        .eq('id', report.reported_user_id)
        .neq('role', 'owner')

      // Send in-app + email notification (non-fatal)
      await notifyBan(report.reported_user_id, targetUser?.email, targetUser?.full_name)
    }

    if (action === 'warn') {
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', report.reported_user_id)
        .single()

      // Send in-app + email warning notification
      await notifyWarning(
        report.reported_user_id,
        targetUser?.email,
        targetUser?.full_name,
        admin_note
      )
    }

    if (action === 'delete_content') {
      // Admin manually deletes flagged content — handled separately
      // Here we just mark the report as actioned
    }

    // Update report status
    const { data: updated, error } = await supabase
      .from('reports')
      .update({
        status:       action === 'close' ? 'closed' : 'resolved',
        admin_note:   admin_note || null,
        actioned_by:  req.user.id,
        actioned_at:  new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    return sendSuccess(res, updated, `Report ${action === 'close' ? 'closed' : 'resolved'} with action: ${action}`)
  } catch (err) {
    console.error('actionReport:', err.message)
    return sendError(res, 'Failed to action report')
  }
}

module.exports = { submitReport, getMyReports, getAllReports, actionReport }
