const { supabaseAdmin } = require('./supabase')

async function registrarLog({
  churchId,
  userId,
  action,
  entity,
  entityId,
  description,
  metadata = null,
  ipAddress = null
}) {
  try {
    await supabaseAdmin
      .from('db_log')
      .insert({
        church_id:   churchId,
        user_id:     userId,
        action,
        entity,
        entity_id:   entityId,
        description,
        metadata,
        ip_address:  ipAddress
      })
  } catch (err) {
    console.error('[logger] erro ao registrar log:', err.message)
  }
}

module.exports = { registrarLog }
