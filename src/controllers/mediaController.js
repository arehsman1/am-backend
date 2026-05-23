const { v4: uuidv4 }  = require('uuid')
const path            = require('path')
const supabase        = require('../config/supabase')
const { sendSuccess, sendError, getPagination } = require('../utils/helpers')

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'matchmaking-media'

// ── User-facing ───────────────────────────────────────────

/** POST /media/upload
 *  Uploads file to Supabase Storage, creates a media record with status = pending.
 *  Admin must approve before the file is visible to others.
 */
const uploadMedia = async (req, res) => {
  if (!req.file) return sendError(res, 'No file provided', 400)

  const userId    = req.user.id
  const file      = req.file
  const ext       = path.extname(file.originalname).toLowerCase()
  const fileName  = `${userId}/${uuidv4()}${ext}`
  const fileType  = file.mimetype.startsWith('image/') ? 'image' : 'video'
  const isProfile = req.body.set_as_profile === 'true' && fileType === 'image'

  try {
    // Upload to Supabase Storage (private bucket)
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file.buffer, {
        contentType:  file.mimetype,
        upsert:       false,
      })

    if (storageErr) throw storageErr

    // Create media record — status starts as 'pending', not yet visible
    const { data, error: dbErr } = await supabase
      .from('media')
      .insert({
        user_id:       userId,
        type:          fileType,
        storage_path:  fileName,
        original_name: file.originalname,
        mimetype:      file.mimetype,
        size_bytes:    file.size,
        status:        'pending',  // ← always starts pending
        is_primary:    isProfile,
      })
      .select()
      .single()

    if (dbErr) throw dbErr

    return sendSuccess(res, {
      id:     data.id,
      status: 'pending',
      message: 'Upload received. Your media will be visible once reviewed by our team.',
    }, 'Media uploaded', 201)
  } catch (err) {
    console.error('uploadMedia:', err.message)
    // Try to clean up storage if DB insert failed
    await supabase.storage.from(BUCKET).remove([fileName]).catch(() => {})
    return sendError(res, 'Upload failed')
  }
}

/** GET /media/my — user sees their own media (all statuses) */
const getMyMedia = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('id, type, status, is_primary, size_bytes, created_at, storage_path')
      .eq('user_id', req.user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Generate signed URLs for the caller's own media
    const withUrls = await Promise.all((data || []).map(async (m) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(m.storage_path, 3600)
      return { ...m, url: signed?.signedUrl || null }
    }))

    return sendSuccess(res, withUrls)
  } catch (err) {
    console.error('getMyMedia:', err.message)
    return sendError(res, 'Failed to fetch media')
  }
}

/** DELETE /media/:id — user deletes own file */
const deleteMyMedia = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('id, storage_path, is_primary, user_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) return sendError(res, 'Media not found', 404)

    // Remove from storage
    await supabase.storage.from(BUCKET).remove([data.storage_path])

    // Soft delete in DB
    await supabase.from('media').update({ is_deleted: true }).eq('id', data.id)

    if (data.is_primary) {
      await supabase.from('profiles').update({ profile_picture: null }).eq('id', req.user.id)
    }

    return sendSuccess(res, null, 'Media deleted')
  } catch (err) {
    return sendError(res, 'Failed to delete media')
  }
}

/** GET /media/profile/:userId
 *  Returns ONLY approved media for a user profile.
 *  Primary image is always shown; others need unlock check.
 */
const getProfileMedia = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('id, type, is_primary, storage_path')
      .eq('user_id', req.params.userId)
      .eq('status', 'approved')   // ← only approved media visible publicly
      .eq('is_deleted', false)
      .order('is_primary', { ascending: false })

    if (error) throw error

    // Generate signed URLs (short expiry for approved media)
    const withUrls = await Promise.all((data || []).map(async (m) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(m.storage_path, 1800)
      return { id: m.id, type: m.type, is_primary: m.is_primary, url: signed?.signedUrl || null }
    }))

    return sendSuccess(res, withUrls)
  } catch (err) {
    return sendError(res, 'Failed to fetch profile media')
  }
}

// ── Admin / Moderator moderation ──────────────────────────

/** GET /media/admin/pending — list all pending media */
const getPendingMedia = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query)
  try {
    const { data, error, count } = await supabase
      .from('media')
      .select('id, user_id, type, storage_path, mimetype, size_bytes, created_at, profiles!user_id(full_name, email)', { count: 'exact' })
      .eq('status', 'pending')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const withUrls = await Promise.all((data || []).map(async (m) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET).createSignedUrl(m.storage_path, 3600)
      return { ...m, url: signed?.signedUrl || null }
    }))

    return sendSuccess(res, {
      media: withUrls,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    })
  } catch (err) {
    return sendError(res, 'Failed to fetch pending media')
  }
}

/** PATCH /media/admin/:id/approve */
const approveMedia = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('media')
      .update({ status: 'approved', moderated_by: req.user.id, moderated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, user_id, is_primary, storage_path')
      .single()

    if (error) throw error

    // If this is a primary image, update the profile picture URL
    if (data.is_primary) {
      const { data: signed } = await supabase.storage
        .from(BUCKET).createSignedUrl(data.storage_path, 365 * 24 * 3600)
      if (signed?.signedUrl) {
        await supabase.from('profiles')
          .update({ profile_picture: signed.signedUrl })
          .eq('id', data.user_id)
      }
    }

    return sendSuccess(res, null, 'Media approved')
  } catch (err) {
    return sendError(res, 'Failed to approve media')
  }
}

/** PATCH /media/admin/:id/reject
 *  Rejects media: deletes record from DB and file from storage.
 */
const rejectMedia = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('id, storage_path, user_id, is_primary')
      .eq('id', req.params.id)
      .single()

    if (error || !data) return sendError(res, 'Media not found', 404)

    // Delete file from Supabase Storage
    await supabase.storage.from(BUCKET).remove([data.storage_path])

    // Hard delete record from database (rejected media is gone entirely)
    await supabase.from('media').delete().eq('id', req.params.id)

    // If it was a primary image, clear the profile picture
    if (data.is_primary) {
      await supabase.from('profiles').update({ profile_picture: null }).eq('id', data.user_id)
    }

    return sendSuccess(res, null, 'Media rejected and permanently deleted')
  } catch (err) {
    console.error('rejectMedia:', err.message)
    return sendError(res, 'Failed to reject media')
  }
}

module.exports = {
  uploadMedia, getMyMedia, deleteMyMedia, getProfileMedia,
  getPendingMedia, approveMedia, rejectMedia,
}
