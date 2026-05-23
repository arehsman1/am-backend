const cron     = require('node-cron')
const supabase = require('../config/supabase')

const startCronJobs = () => {

  // Expire stale requests every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const { count } = await supabase
        .from('requests')
        .update({ status: 'expired' })
        .eq('status', 'new')
        .lt('expires_at', new Date().toISOString())
      if (count > 0) console.log(`⏰ Expired ${count} request(s)`)
    } catch (err) {
      console.error('Cron expire requests:', err.message)
    }
  })

  // Deactivate expired boosts every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await supabase
        .from('boosts')
        .update({ is_active: false })
        .eq('is_active', true)
        .lt('expires_at', new Date().toISOString())
    } catch (err) {
      console.error('Cron expire boosts:', err.message)
    }
  })

  // Clean expired OTP codes every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await supabase
        .from('verification_codes')
        .delete()
        .lt('expires_at', new Date().toISOString())
    } catch (err) {
      console.error('Cron clean OTPs:', err.message)
    }
  })

  console.log('✅ Cron jobs started')
}

module.exports = { startCronJobs }
