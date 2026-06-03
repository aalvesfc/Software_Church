const { supabaseAdmin } = require('../lib/supabase')

async function checkLimiteVoluntarios(req, res, next) {
  try {
    if (!req.moduloLimite) {
      return next()
    }

    const { count } = await supabaseAdmin
      .from('db_member')
      .select('*', { count: 'exact', head: true })
      .eq('church_id', req.churchId)
      .eq('is_volunteer', true)
      .eq('is_active', true)

    if (count >= req.moduloLimite) {
      await supabaseAdmin
        .from('db_notificacao')
        .insert({
          church_id: '00000000-0000-0000-0000-000000000001',
          user_id: null,
          tipo_id: 6,
          title: 'Igreja no limite de voluntários',
          body: `A igreja atingiu o limite de ${req.moduloLimite} voluntários contratados`,
          is_read: false
        })

      req.limiteAtingido = true
    }

    next()
  } catch (err) {
    console.error('[checkLimiteVoluntarios]', err)
    next()
  }
}

module.exports = checkLimiteVoluntarios
