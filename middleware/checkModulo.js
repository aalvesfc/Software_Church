const { supabaseAdmin } = require('../lib/supabase')

/**
 * Middleware factory que verifica se a igreja do request tem acesso ao módulo.
 * Se req.churchId já estiver populado (via checkPermissao), usa diretamente.
 * Caso contrário, busca church_id via req.authUser.id (necessário em router.use()).
 *
 * Uso em router.use(): router.use(authMiddleware); router.use(checkModulo('voluntariado'))
 * Uso inline:          router.get('/rota', authMiddleware, checkPermissao(...), checkModulo('voluntariado'), handler)
 */
function checkModulo(moduloSlug) {
  return async (req, res, next) => {
    try {
      let churchId = req.churchId

      if (!churchId) {
        const userId = req.authUser?.id
        if (!userId) {
          return res.status(401).json({ error: 'Não autenticado', code: 'sem_auth' })
        }
        const { data: dbUser } = await supabaseAdmin
          .from('db_user')
          .select('church_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()
        if (!dbUser?.church_id) {
          return res.status(401).json({ error: 'Igreja não identificada', code: 'sem_church_id' })
        }
        req.churchId = dbUser.church_id
        churchId = dbUser.church_id
      }
      // Busca contrato_modulo ativo com join em modulo e contrato
      const { data } = await supabaseAdmin
        .from('db_contrato_modulo')
        .select('limite, is_active, db_modulo:modulo_id(slug), db_contrato:contrato_id(status)')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .maybeSingle()

      // Filtra pelo slug após o fetch (join aninhado não permite .eq em campo relacionado no PostgREST diretamente)
      const moduloAtivo = data && data.db_modulo?.slug === moduloSlug ? data : null

      if (!moduloAtivo) {
        return res.status(403).json({
          error: 'Módulo não contratado',
          code: 'modulo_nao_contratado',
        })
      }

      const contratoStatus = moduloAtivo.db_contrato?.status
      if (contratoStatus === 'bloqueado' || contratoStatus === 'cancelado') {
        return res.status(403).json({
          error: 'Contrato bloqueado ou cancelado',
          code: 'contrato_bloqueado',
        })
      }

      req.moduloLimite = moduloAtivo.limite
      next()
    } catch (e) {
      console.error('[checkModulo]', moduloSlug, e?.message)
      return res.status(500).json({ error: 'Erro ao verificar módulo' })
    }
  }
}

module.exports = checkModulo
