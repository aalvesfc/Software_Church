const { supabaseAdmin } = require('./supabase')

async function logAtividade({ churchId, userId, action, entity, entityId, description, metadata, req }) {
  const ip = req
    ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null)
    : null

  await supabaseAdmin.from('db_log').insert({
    church_id:   churchId,
    user_id:     userId    || null,
    action,
    entity,
    entity_id:   entityId  || null,
    description: description || null,
    metadata:    metadata  || null,
    ip_address:  ip,
  }).catch(err => console.error('[logAtividade]', err))
}

module.exports = logAtividade
