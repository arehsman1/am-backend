require('dotenv').config()
const express   = require('express')
const helmet    = require('helmet')
const cors      = require('cors')
const rateLimit = require('express-rate-limit')
const path      = require('path')
const fs        = require('fs')

const { startCronJobs } = require('./src/cron/jobs')
const { sendError }     = require('./src/utils/helpers')

// ── Routes ────────────────────────────────────────────────
const authRoutes    = require('./src/routes/auth')
const usersRoutes   = require('./src/routes/users')
const adminRoutes   = require('./src/routes/admin')
const mediaRoutes   = require('./src/routes/media')
const reportsRoutes = require('./src/routes/reports')
const supportRoutes = require('./src/routes/support')
const walletRoutes  = require('./src/routes/wallet')
const app = express()

// ── Security ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ── Raw body for Paystack webhook (MUST be before express.json) ──
app.use('/api/wallet/webhook', express.raw({ type: 'application/json' }))

app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// ── Rate limiting ─────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests.' },
}))
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { status: 'error', message: 'Too many auth attempts.' },
}))
app.use('/api/wallet', rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  message: { status: 'error', message: 'Too many wallet requests.' },
}))

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
})

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth',    authRoutes)
app.use('/api/users',   usersRoutes)
app.use('/api/admin',   adminRoutes)
app.use('/api/media',   mediaRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/wallet',  walletRoutes)

// ── Public site settings (no auth) ───────────────────────
app.get('/api/public/site-settings', async (req, res) => {
  const { getAllConfig } = require('./src/config/appConfig')
  try {
    const { data } = require('./src/config/supabase')
    const sb = require('./src/config/supabase')
    const { data: rows } = await sb.from('app_config')
      .select('id, value')
      .eq('is_secret', false)
      .in('id', ['site_name','site_logo_url','site_favicon_url','seo_title','seo_description','seo_keywords','seo_og_image'])
    const map = Object.fromEntries((rows || []).map(r => [r.id, r.value]))
    res.json({ status: 'success', data: {
      site_name: map.site_name  || 'MatchApp',
      logo:      map.site_logo_url || '',
      favicon:   map.site_favicon_url || '',
      seo: { title: map.seo_title || '', description: map.seo_description || '', keywords: map.seo_keywords || '', og_image: map.seo_og_image || '' },
    }})
  } catch (err) {
    res.json({ status: 'success', data: { site_name: 'MatchApp', logo: '', seo: {} } })
  }
})

// ── Admin config endpoints ────────────────────────────────
const authenticate = require('./src/middleware/auth')
const { requireAdmin } = require('./src/middleware/roles')
const { getConfig, setConfig, getAllConfig, bustCache } = require('./src/config/appConfig')

app.get('/api/admin/config', authenticate, requireAdmin, async (req, res) => {
  try {
    const config = await getAllConfig()
    res.json({ status: 'success', data: config })
  } catch (err) { res.status(500).json({ status: 'error', message: 'Failed to fetch config' }) }
})

app.post('/api/admin/config/update', authenticate, requireAdmin, async (req, res) => {
  const { key, value } = req.body
  if (!key || value === undefined) return res.status(400).json({ status: 'error', message: 'key and value required' })
  try {
    await setConfig(key.trim(), String(value), req.user.id)
    res.json({ status: 'success', message: 'Config updated', data: { key, value } })
  } catch (err) { res.status(500).json({ status: 'error', message: 'Failed to update config' }) }
})

// ── Serve React admin build ───────────────────────────────
const PUBLIC = path.join(__dirname, 'public')

app.use(express.static(PUBLIC))

app.get('*', (req, res) => {
  const index = path.join(PUBLIC, 'index.html')
  if (!fs.existsSync(index)) {
    return res.status(503).send(`
      <html><body style="font-family:sans-serif;padding:40px">
        <h2>Admin UI not built</h2>
        <p>Run <code>npm run build</code> to generate it.</p>
        <p>API is live at <a href="/api/health">/api/health</a></p>
      </body></html>
    `)
  }
  res.sendFile(index)
})

// ── API 404 ───────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  sendError(res, `${req.method} ${req.originalUrl} not found`, 404)
})

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message)
  if (req.path.startsWith('/api')) {
    return sendError(res, process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message, 500)
  }
  res.status(500).send('Internal server error')
})

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`\n🚀  Matchmaking app on port ${PORT}`)
  console.log(`    API    → http://localhost:${PORT}/api`)
  console.log(`    Admin  → http://localhost:${PORT}\n`)
  startCronJobs()
})

module.exports = app
