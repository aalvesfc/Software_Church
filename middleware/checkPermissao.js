const { supabaseAdmin } = require('../lib/supabase')

function checkPermissao(module, action) {
  return async (req, res, next) => {
    const userId = req.authUser?.id
    if (!userId) return res.status(401).json({ error: 'Não autenticado' })

    const { data: dbUser, error: userErr } = await supabaseAdmin
      .from('db_user')
      .select('id, church_id, perfil_id, db_perfil(slug)')
      .eq('user_id', userId)
      .single()

    if (userErr || !dbUser) {
      return res.status(403).json({ error: 'Usuário não encontrado' })
    }

    // Disponibiliza church_id para os handlers evitando query redundante
    req.churchId = dbUser.church_id
    req.dbUser   = dbUser

    // owner tem acesso total — não verifica permissões
    if (dbUser.db_perfil?.slug === 'owner') return next()

    // Busca o id da permissão pelo módulo + ação
    const { data: permData } = await supabaseAdmin
      .from('db_permissao')
      .select('id')
      .eq('module', module)
      .eq('action', action)
      .single()

    if (!permData) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' })
    }

    // Verifica se o perfil do usuário possui essa permissão
    const { data: pp } = await supabaseAdmin
      .from('db_perfil_permissao')
      .select('id')
      .eq('perfil_id', dbUser.perfil_id)
      .eq('permissao_id', permData.id)
      .maybeSingle()

    if (!pp) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' })
    }

    next()
  }
}

module.exports = checkPermissao
