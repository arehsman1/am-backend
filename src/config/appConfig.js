const supabase = require('./supabase')

// 60-second in-memory cache to avoid hitting DB on every request
const cache     = new Map()
const CACHE_TTL = 60 * 1000

/**
 * getConfig(key)
 * Reads a value from the app_config table.
 * Returns the string value or null if not found.
 */
const getConfig = async (key) => {
  const now = Date.now()
  if (cache.has(key)) {
    const { value, expiresAt } = cache.get(key)
    if (now < expiresAt) return value
  }
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('id', key)
      .single()
    const value = data?.value ?? null
    cache.set(key, { value, expiresAt: now + CACHE_TTL })
    return value
  } catch {
    return null
  }
}

/**
 * setConfig(key, value, updatedBy)
 * Upserts a config value and busts the cache for that key.
 */
const setConfig = async (key, value, updatedBy = null) => {
  await supabase.from('app_config').upsert({
    id: key, value: String(value),
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  })
  cache.delete(key)
}

/**
 * getAllConfig()
 * Returns all config rows, masking secret values.
 */
const getAllConfig = async () => {
  const { data } = await supabase
    .from('app_config')
    .select('id, value, description, is_secret, updated_at')
    .order('id')
  return (data || []).map(r => ({
    ...r,
    value: r.is_secret ? '••••••••' : r.value,
  }))
}

const bustCache = () => cache.clear()

module.exports = { getConfig, setConfig, getAllConfig, bustCache }
