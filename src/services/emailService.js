const nodemailer = require('nodemailer')
const axios      = require('axios')

/**
 * sendEmail({ to, subject, html, text })
 * Routes through the provider set in EMAIL_PROVIDER env var.
 * Defaults to SMTP if not set.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase()
  switch (provider) {
    case 'resend':   return _sendViaResend({ to, subject, html })
    case 'sendgrid': return _sendViaSendGrid({ to, subject, html })
    case 'brevo':    return _sendViaBrevo({ to, subject, html })
    default:         return _sendViaSMTP({ to, subject, html, text })
  }
}

// ── SMTP ─────────────────────────────────────────────────
const _sendViaSMTP = async ({ to, subject, html, text }) => {
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to, subject, html, text,
  })
}

// ── Resend ────────────────────────────────────────────────
const _sendViaResend = async ({ to, subject, html }) => {
  await axios.post('https://api.resend.com/emails', {
    from: process.env.SMTP_FROM || 'noreply@matchapp.com',
    to, subject, html,
  }, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } })
}

// ── SendGrid ──────────────────────────────────────────────
const _sendViaSendGrid = async ({ to, subject, html }) => {
  await axios.post('https://api.sendgrid.com/v3/mail/send', {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: process.env.SMTP_FROM || 'noreply@matchapp.com' },
    subject,
    content: [{ type: 'text/html', value: html }],
  }, { headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` } })
}

// ── Brevo ─────────────────────────────────────────────────
const _sendViaBrevo = async ({ to, subject, html }) => {
  await axios.post('https://api.brevo.com/v3/smtp/email', {
    sender:      { email: process.env.SMTP_FROM || 'noreply@matchapp.com' },
    to:          [{ email: to }],
    subject,
    htmlContent: html,
  }, { headers: { 'api-key': process.env.BREVO_API_KEY } })
}

// ── Templates ─────────────────────────────────────────────
const buildWarningEmail = (userName) => ({
  subject: 'Account Warning — MatchApp',
  html: `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#ef4444">Account Warning</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>Your account has been flagged by our moderation team for a policy violation.
         Further violations may result in a permanent ban.</p>
      <p>If you believe this is an error, please contact our support team.</p>
      <p style="color:#888;font-size:12px;margin-top:24px">MatchApp Trust &amp; Safety</p>
    </div>
  `,
})

const buildBanEmail = (userName) => ({
  subject: 'Account Banned — MatchApp',
  html: `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#ef4444">Account Banned</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>Your account has been permanently banned due to repeated or serious violations
         of our community guidelines.</p>
      <p>To appeal this decision, contact support.</p>
      <p style="color:#888;font-size:12px;margin-top:24px">MatchApp Trust &amp; Safety</p>
    </div>
  `,
})

const buildOtpEmail = (code, appName = 'MatchApp') => ({
  subject: `${appName} — Your verification code`,
  html: `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#f0a500">${appName}</h2>
      <p>Your verification code is:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#111;background:#f5f5f5;padding:20px;text-align:center;border-radius:8px">
        ${code}
      </div>
      <p style="color:#888;font-size:13px;margin-top:16px">
        This code expires in 15 minutes. Do not share it with anyone.
      </p>
    </div>
  `,
})

module.exports = { sendEmail, buildWarningEmail, buildBanEmail, buildOtpEmail }
