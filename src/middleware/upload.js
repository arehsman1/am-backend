const multer = require('multer')
const path   = require('path')
const { v4: uuidv4 } = require('uuid')

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime']
const ALL_ALLOWED   = [...ALLOWED_IMAGE, ...ALLOWED_VIDEO]

const storage = multer.memoryStorage() // store in memory → upload to Supabase Storage

const fileFilter = (req, file, cb) => {
  if (!ALL_ALLOWED.includes(file.mimetype)) {
    return cb(new Error(`Unsupported file type: ${file.mimetype}`), false)
  }
  cb(null, true)
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
})

const uploadSingle = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Max 50MB.'
        : err.message
      return res.status(400).json({ status: 'error', message: msg })
    }
    next()
  })
}

module.exports = { uploadSingle, ALLOWED_IMAGE, ALLOWED_VIDEO }
