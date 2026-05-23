const supabase = require('../config/supabase')
const { sendSuccess, sendError, getPagination } = require('../utils/helpers')

/**
 * Support system rules:
 *  - Users can ONLY contact admin via support tickets
 *  - Direct messaging to admin users is NOT allowed
 *  - Each ticket creates a thread; replies are stored as messages
 */

/** POST /support/tickets — user opens a support ticket */
const createTicket = async (req, res) => {
  const { subject, message } = req.body
  const userId = req.user.id

  if (!subject?.trim() || !message?.trim()) {
    return sendError(res, 'Subject and message are required', 400)
  }
  if (message.length > 2000) {
    return sendError(res, 'Message too long (max 2000 characters)', 400)
  }

  try {
    // Create ticket
    const { data: ticket, error: ticketErr } = await supabase
      .from('support_tickets')
      .insert({
        user_id:    userId,
        subject:    subject.trim(),
        status:     'open',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (ticketErr) throw ticketErr

    // Add first message
    const { error: msgErr } = await supabase
      .from('support_messages')
      .insert({
        ticket_id:  ticket.id,
        sender_id:  userId,
        sender_role:'user',
        message:    message.trim(),
        created_at: new Date().toISOString(),
      })

    if (msgErr) throw msgErr

    return sendSuccess(res, { ticket_id: ticket.id, status: ticket.status }, 'Support ticket created', 201)
  } catch (err) {
    console.error('createTicket:', err.message)
    return sendError(res, 'Failed to create support ticket')
  }
}

/** GET /support/tickets — user sees their own tickets */
const getMyTickets = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, subject, status, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return sendSuccess(res, data)
  } catch (err) {
    return sendError(res, 'Failed to fetch tickets')
  }
}

/** GET /support/tickets/:id — user or admin views a thread */
const getTicketThread = async (req, res) => {
  const { id } = req.params
  const isAdmin = ['admin', 'owner', 'moderator'].includes(req.user.role)

  try {
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .select('id, subject, status, user_id, created_at')
      .eq('id', id)
      .single()

    if (error || !ticket) return sendError(res, 'Ticket not found', 404)

    // Regular user can only see their own tickets
    if (!isAdmin && ticket.user_id !== req.user.id) {
      return sendError(res, 'Not authorized', 403)
    }

    const { data: messages, error: msgErr } = await supabase
      .from('support_messages')
      .select('id, message, sender_role, created_at, sender:profiles!sender_id(full_name)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    if (msgErr) throw msgErr

    return sendSuccess(res, { ticket, messages })
  } catch (err) {
    return sendError(res, 'Failed to fetch ticket thread')
  }
}

/** POST /support/tickets/:id/reply — user or admin replies */
const replyToTicket = async (req, res) => {
  const { id } = req.params
  const { message } = req.body
  const isAdmin = ['admin', 'owner', 'moderator'].includes(req.user.role)

  if (!message?.trim()) return sendError(res, 'Message is required', 400)
  if (message.length > 2000) return sendError(res, 'Message too long', 400)

  try {
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, status, user_id')
      .eq('id', id)
      .single()

    if (!ticket) return sendError(res, 'Ticket not found', 404)
    if (!isAdmin && ticket.user_id !== req.user.id) return sendError(res, 'Not authorized', 403)
    if (ticket.status === 'closed') return sendError(res, 'This ticket is closed', 400)

    const { error } = await supabase.from('support_messages').insert({
      ticket_id:   id,
      sender_id:   req.user.id,
      sender_role: isAdmin ? 'admin' : 'user',
      message:     message.trim(),
      created_at:  new Date().toISOString(),
    })

    if (error) throw error

    // Update ticket updated_at
    await supabase.from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)

    return sendSuccess(res, null, 'Reply sent')
  } catch (err) {
    console.error('replyToTicket:', err.message)
    return sendError(res, 'Failed to send reply')
  }
}

/** GET /support/admin/tickets — admin sees all tickets */
const getAllTickets = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query)
  const { status } = req.query

  let query = supabase
    .from('support_tickets')
    .select('id, subject, status, created_at, updated_at, user:profiles!user_id(id, full_name, email)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  try {
    const { data, error, count } = await query
    if (error) throw error
    return sendSuccess(res, {
      tickets: data,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    })
  } catch (err) {
    return sendError(res, 'Failed to fetch tickets')
  }
}

/** PATCH /support/admin/tickets/:id/close */
const closeTicket = async (req, res) => {
  try {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'closed', updated_at: new Date().toISOString(), closed_by: req.user.id })
      .eq('id', req.params.id)

    if (error) throw error
    return sendSuccess(res, null, 'Ticket closed')
  } catch (err) {
    return sendError(res, 'Failed to close ticket')
  }
}

module.exports = { createTicket, getMyTickets, getTicketThread, replyToTicket, getAllTickets, closeTicket }
