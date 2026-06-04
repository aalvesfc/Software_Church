const { supabaseAdmin } = require('../lib/supabase')

// Rotas que não passam pela verificação de contrato
// (autenticação de login/refresh, polling de notif, painel sistema)
const ROTAS_LIBERADAS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/notificacao/nao-lidas',
  '/api/contrato',
  '/api/config/sistema',
  '/api/pagamento',
]

function _rotaLiberada(req) {
  const path = req.originalUrl.split('?')[0]
  return ROTAS_LIBERADAS.some(r => path.startsWith(r))
}

async function authMiddleware(req, res, next) {
  // Idempotência: já autenticado neste request (ex: router.use + por rota)
  if (req.authUser) return next()

  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Token não fornecido' })

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }

  req.authUser = user

  // Rotas liberadas não passam pela verificação de contrato
  if (_rotaLiberada(req)) return next()

  // Busca db_user para obter church_id e perfil
  // (evita query duplicada se checkPermissao já rodou antes)
  if (!req.churchId) {
    const { data: dbUser } = await supabaseAdmin
      .from('db_user')
      .select('id, church_id, db_perfil:perfil_id(slug)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (dbUser) {
      req.dbUser   = dbUser
      req.churchId = dbUser.church_id
    }
  }

  // sistema_owner tem acesso irrestrito — não verifica contrato
  if (req.dbUser?.db_perfil?.slug === 'sistema_owner') return next()

  // Sem church_id → sem contrato → bloqueia
  if (!req.churchId) {
    return res.status(403).json({
      error: 'Igreja não identificada',
      code:  'sem_contrato',
    })
  }

  // Verifica status do contrato da igreja
  const { data: contrato } = await supabaseAdmin
    .from('db_contrato')
    .select('status')
    .eq('church_id', req.churchId)
    .maybeSingle()

  if (!contrato) {
    return res.status(403).json({
      error: 'Igreja sem contrato ativo',
      code:  'sem_contrato',
    })
  }

  if (['bloqueado', 'cancelado'].includes(contrato.status)) {
    return res.status(403).json({
      error: 'Contrato bloqueado ou cancelado',
      code:  'contrato_bloqueado',
    })
  }

  next()
}

module.exports = authMiddleware
