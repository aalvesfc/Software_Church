const { supabaseAdmin } = require('../lib/supabase')

function checkPermissao(module, action) {
  return async (req, res, next) => {
    const userId = req.authUser?.id
    if (!userId) return res.status(401).json({ error: 'Não autenticado' })

    // SEC-010: .limit(1).maybeSingle() evita erro 403 em caso de usuário duplicado no db_user
    const { data: dbUser } = await supabaseAdmin
      .from('db_user')
      .select('id, church_id, perfil_id, full_name, nickname, db_perfil:perfil_id(slug)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (!dbUser) {
      return res.status(403).json({ error: 'Usuário não encontrado' })
    }

    // Disponibiliza church_id para os handlers evitando query redundante
    req.churchId = dbUser.church_id
    req.dbUser   = dbUser

    // owner tem acesso total — não verifica permissões
    if (dbUser.db_perfil?.slug === 'owner') return next()

    // Voluntário que é líder de ministério/departamento usa as permissões do perfil 'lider'
    let perfil_id_check = dbUser.perfil_id
    if (dbUser.db_perfil?.slug === 'voluntario') {
      const [{ count: cMin }, { count: cDept }] = await Promise.all([
        supabaseAdmin.from('db_ministry_lider')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', dbUser.id).eq('church_id', dbUser.church_id),
        supabaseAdmin.from('db_department_lider')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', dbUser.id).eq('church_id', dbUser.church_id),
      ])
      if (cMin > 0 || cDept > 0) {
        const { data: liderPerfil } = await supabaseAdmin
          .from('db_perfil')
          .select('id')
          .eq('church_id', dbUser.church_id)
          .eq('slug', 'lider')
          .maybeSingle()
        if (liderPerfil) perfil_id_check = liderPerfil.id
      }
    }

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

    // Verifica se o perfil efetivo possui essa permissão
    const { data: pp } = await supabaseAdmin
      .from('db_perfil_permissao')
      .select('id')
      .eq('perfil_id', perfil_id_check)
      .eq('permissao_id', permData.id)
      .maybeSingle()

    if (!pp) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' })
    }

    next()
  }
}

module.exports = checkPermissao
