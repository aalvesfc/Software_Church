const router = require('express').Router()
const { supabaseAuth, supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' })
  }

  // 1. Autentica via Supabase Auth
  const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha
  })

  if (authError || !authData.session) {
    return res.status(401).json({ error: 'Email ou senha incorretos' })
  }

  const { session, user: authUser } = authData

  // 2. Busca perfil do usuário + dados da igreja + gênero
  const { data: dbUser, error: userError } = await supabaseAdmin
    .from('db_user')
    .select(`
      id,
      nickname,
      email,
      phone,
      avatar_url,
      role,
      is_active,
      church_id,
      db_church (
        id,
        name,
        slug,
        logo_url,
        is_active
      ),
      db_genero (
        name
      )
    `)
    .eq('user_id', authUser.id)
    .single()

  if (userError || !dbUser) {
    return res.status(403).json({ error: 'Usuário não encontrado no sistema' })
  }

  if (!dbUser.is_active) {
    return res.status(403).json({ error: 'Conta inativa. Contate o administrador.' })
  }

  if (!dbUser.db_church?.is_active) {
    return res.status(403).json({ error: 'Igreja inativa. Contate o suporte.' })
  }

  // 3. Atualiza último login
  await supabaseAdmin
    .from('db_user')
    .update({ last_sign_in: new Date().toISOString() })
    .eq('id', dbUser.id)

  const generoNome = dbUser.db_genero?.name || ''
  const prefixo = generoNome === 'Masculino' ? 'Sr.' : generoNome === 'Feminino' ? 'Sra.' : ''
  const nickname = (dbUser.nickname || '').trim()
  const nomeExibicao = prefixo ? `${prefixo} ${nickname}` : nickname

  res.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    usuario: {
      id: dbUser.id,
      nome: nomeExibicao,
      email: dbUser.email,
      avatar: dbUser.avatar_url,
      role: dbUser.role
    },
    igreja: {
      id: dbUser.db_church.id,
      nome: dbUser.db_church.name,
      slug: dbUser.db_church.slug,
      logo: dbUser.db_church.logo_url
    }
  })
})

// GET /api/auth/me — retorna dados do usuário logado
router.get('/me', authMiddleware, async (req, res) => {
  // Query principal — colunas que sempre existem
  const { data: dbUser, error } = await supabaseAdmin
    .from('db_user')
    .select(`
      id, nickname, full_name, email, phone, avatar_url, role, is_active,
      db_church ( id, name, slug, logo_url ),
      db_genero ( id, name )
    `)
    .eq('user_id', req.authUser.id)
    .single()

  if (error || !dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })

  // Query secundária — colunas opcionais (podem não existir ainda)
  const { data: dbExtra } = await supabaseAdmin
    .from('db_user')
    .select('genero_id, status_civil_id, birth_date')
    .eq('user_id', req.authUser.id)
    .single()

  const generoNome = dbUser.db_genero?.name || ''
  const prefixo = generoNome === 'Masculino' ? 'Sr.' : generoNome === 'Feminino' ? 'Sra.' : ''
  const nickname = (dbUser.nickname || '').trim()
  const nomeExibicao = prefixo ? `${prefixo} ${nickname}` : nickname

  res.json({
    usuario: {
      id: dbUser.id,
      nome: nomeExibicao,
      nickname: dbUser.nickname || '',
      full_name: dbUser.full_name || '',
      email: dbUser.email,
      phone: dbUser.phone || '',
      genero_id: dbExtra?.genero_id || null,
      status_civil_id: dbExtra?.status_civil_id || null,
      birth_date: dbExtra?.birth_date || null,
      avatar: dbUser.avatar_url,
      role: dbUser.role
    },
    igreja: {
      id: dbUser.db_church.id,
      nome: dbUser.db_church.name,
      slug: dbUser.db_church.slug,
      logo: dbUser.db_church.logo_url
    }
  })
})

// POST /api/auth/refresh — renova access_token usando refresh_token
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token obrigatório' })

  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token })

  if (error || !data.session) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' })
  }

  res.json({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at:    data.session.expires_at,
  })
})

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  await supabaseAuth.auth.admin?.signOut(token).catch(() => {})
  res.json({ ok: true })
})

module.exports = router
