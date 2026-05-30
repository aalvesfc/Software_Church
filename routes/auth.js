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
    console.log('[login] falha auth:', authError?.message)
    return res.status(401).json({ error: 'Email ou senha incorretos' })
  }

  const { session, user: authUser } = authData

  // 2. Busca perfil do usuário + dados da igreja + gênero
  const { data: dbUser, error: userError } = await supabaseAdmin
    .from('db_user')
    .select(`
      id, nickname, email, phone, avatar_url, is_active, church_id, perfil_id,
      db_church ( id, name, slug, logo_url, is_active ),
      db_genero ( name ),
      db_perfil ( slug )
    `)
    .eq('user_id', authUser.id)
    .single()

  if (userError || !dbUser) {
    console.log('[login] db_user não encontrado para user_id=%s erro=%s', authUser.id, userError?.message)
    return res.status(403).json({ error: 'Usuário não encontrado no sistema' })
  }

  if (!dbUser.is_active) {
    console.log('[login] usuário inativo email=%s', dbUser.email)
    return res.status(403).json({ error: 'Conta inativa. Contate o administrador.' })
  }

  if (!dbUser.db_church?.is_active) {
    console.log('[login] igreja inativa church_id=%s', dbUser.church_id)
    return res.status(403).json({ error: 'Igreja inativa. Contate o suporte.' })
  }

  // 3. Atualiza último login + busca foto do membro em paralelo
  const [, { data: dbMemberLogin }] = await Promise.all([
    supabaseAdmin.from('db_user').update({ last_sign_in: new Date().toISOString() }).eq('id', dbUser.id),
    supabaseAdmin.from('db_member').select('photo_url').eq('email', dbUser.email).eq('church_id', dbUser.church_id).maybeSingle()
  ])

  // 4. Busca permissões do perfil
  const { data: permissoes } = await supabaseAdmin
    .from('db_perfil_permissao')
    .select('db_permissao(module, action)')
    .eq('perfil_id', dbUser.perfil_id)

  const isAdmin = ['owner', 'admin'].includes(dbUser.db_perfil?.slug)
  const permissions = isAdmin
    ? ['*']
    : (permissoes || []).filter(p => p.db_permissao).map(p => `${p.db_permissao.module}:${p.db_permissao.action}`)

  const perfil_slug = dbUser.db_perfil?.slug || null


  const generoNome = dbUser.db_genero?.name || ''
  const prefixo = generoNome === 'Masculino' ? 'Sr.' : generoNome === 'Feminino' ? 'Sra.' : ''
  const nickname = (dbUser.nickname || '').trim()
  const nomeExibicao = prefixo ? `${prefixo} ${nickname}` : nickname

  res.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    usuario: {
      id:          dbUser.id,
      nome:        nomeExibicao,
      email:       dbUser.email,
      avatar:      dbMemberLogin?.photo_url || dbUser.avatar_url || null,
      perfil_slug,
      permissions
    },
    igreja: {
      id:   dbUser.db_church.id,
      nome: dbUser.db_church.name,
      slug: dbUser.db_church.slug,
      logo: dbUser.db_church.logo_url
    }
  })
})

// GET /api/auth/me — retorna dados do usuário logado
router.get('/me', authMiddleware, async (req, res) => {
  const { data: dbUser, error } = await supabaseAdmin
    .from('db_user')
    .select(`
      id, nickname, full_name, email, phone, avatar_url, role, is_active, perfil_id,
      db_church ( id, name, slug, logo_url ),
      db_genero ( id, name ),
      db_perfil ( slug )
    `)
    .eq('user_id', req.authUser.id)
    .single()

  if (error || !dbUser) {
    console.error('[auth/me] db_user not found for user_id=%s error=%s', req.authUser.id, error?.message)
    return res.status(404).json({ error: 'Usuário não encontrado' })
  }

  const [{ data: dbExtra }, { data: dbMemberMe }, { data: permissoes }] = await Promise.all([
    supabaseAdmin.from('db_user').select('genero_id, status_civil_id, birth_date').eq('user_id', req.authUser.id).single(),
    supabaseAdmin.from('db_member').select('photo_url').eq('email', dbUser.email).eq('church_id', dbUser.church_id).maybeSingle(),
    supabaseAdmin.from('db_perfil_permissao').select('db_permissao(module, action)').eq('perfil_id', dbUser.perfil_id)
  ])

  const isAdmin = ['owner', 'admin'].includes(dbUser.db_perfil?.slug)
  const permissions = isAdmin
    ? ['*']
    : (permissoes || []).filter(p => p.db_permissao).map(p => `${p.db_permissao.module}:${p.db_permissao.action}`)

  const perfil_slug = dbUser.db_perfil?.slug || null

  console.log('[me] email=%s perfil_id=%s db_perfil=%j perfil_slug=%s permissions_count=%d',
    dbUser.email, dbUser.perfil_id, dbUser.db_perfil, perfil_slug, permissions.length)

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
      avatar: dbMemberMe?.photo_url || dbUser.avatar_url || null,
      perfil_slug,
      permissions
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

// GET /api/auth/config — configuração pública Supabase (URL + anon key)
router.get('/config', (req, res) => {
  res.json({ url: process.env.SUPABASE_URL, anon_key: process.env.SUPABASE_ANON_KEY })
})

// GET /api/auth/generos — lista de gêneros (público, para o cadastro)
router.get('/generos', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('db_genero').select('id, name').order('name')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ generos: data || [] })
})

// GET /api/auth/estados-civis — lista de estados civis (público, para o cadastro)
router.get('/estados-civis', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('db_status_civil').select('id, name').order('name')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ estados: data || [] })
})

// POST /api/auth/otp/send — envia OTP de verificação de email
router.post('/otp/send', async (req, res) => {
  const { email, church_slug } = req.body
  if (!email || !church_slug) {
    return res.status(400).json({ error: 'Email e church_slug são obrigatórios' })
  }

  const { data: church, error: churchErr } = await supabaseAdmin
    .from('db_church')
    .select('id, is_active')
    .eq('slug', church_slug.trim())
    .single()

  if (churchErr || !church || !church.is_active) {
    return res.status(404).json({ error: 'Igreja não encontrada' })
  }

  const { data: existing } = await supabaseAdmin
    .from('db_user')
    .select('id')
    .eq('church_id', church.id)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (existing) {
    return res.status(409).json({ error: 'Este e-mail já está cadastrado nesta igreja' })
  }

  const { error } = await supabaseAuth.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true }
  })

  if (error) {
    console.error('[otp/send]', error)
    return res.status(500).json({ error: 'Erro ao enviar código. Tente novamente.' })
  }

  res.json({ ok: true })
})

// POST /api/auth/otp/verify — verifica OTP e retorna user_id
router.post('/otp/verify', async (req, res) => {
  const { email, token } = req.body
  if (!email || !token) {
    return res.status(400).json({ error: 'Email e código são obrigatórios' })
  }

  const { data, error } = await supabaseAuth.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email'
  })

  if (error || !data.user) {
    return res.status(400).json({ error: 'Código inválido ou expirado' })
  }

  res.json({ ok: true, user_id: data.user.id })
})

// POST /api/auth/cadastro — finaliza cadastro de voluntário via link público
router.post('/cadastro', async (req, res) => {
  const {
    church_slug, auth_user_id, email, senha,
    full_name, apelido, whatsapp, birth_date,
    genero_id, status_civil_id,
    address, number, complement, neighborhood, city, state, zip_code,
    emergency_contact_name, emergency_contact_phone,
    photo_base64
  } = req.body

  if (!church_slug || !email || !full_name?.trim() || !whatsapp?.trim()) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' })
  }
  if (!auth_user_id && !senha) {
    return res.status(400).json({ error: 'Senha obrigatória' })
  }

  // 1. Valida a igreja
  const { data: church, error: churchErr } = await supabaseAdmin
    .from('db_church')
    .select('id, name, is_active')
    .eq('slug', church_slug.trim())
    .single()

  if (churchErr || !church || !church.is_active) {
    return res.status(404).json({ error: 'Igreja não encontrada' })
  }

  // 2. Verifica email único na igreja
  const { data: existing } = await supabaseAdmin
    .from('db_user')
    .select('id')
    .eq('church_id', church.id)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (existing) {
    return res.status(409).json({ error: 'Este e-mail já está cadastrado nesta igreja' })
  }

  let userId
  try {
    if (auth_user_id) {
      // OTP ou Google: verifica que o auth_user_id corresponde ao email declarado
      const { data: { user: authUser }, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(auth_user_id)
      console.log('[cadastro] getUserById: auth_user_id=%s authUser_email=%s getUserErr=%s', auth_user_id, authUser?.email, getUserErr?.message)
      if (!authUser || authUser.email !== email.trim().toLowerCase()) {
        console.error('[cadastro] 403: authUser.email=%s req.email=%s auth_user_id=%s', authUser?.email, email.trim().toLowerCase(), auth_user_id)
        return res.status(403).json({ error: 'Verificação de email inválida' })
      }
      userId = auth_user_id
      // OTP flow: define senha; Google flow: senha não necessária
      if (senha) {
        const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(auth_user_id, {
          password: senha,
          email_confirm: true
        })
        if (pwErr) return res.status(500).json({ error: 'Erro ao definir senha' })
      }
    } else {
      // Criação direta com email + senha
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: senha,
        email_confirm: true
      })
      if (authErr || !authData.user) {
        if (authErr?.message?.includes('already registered')) {
          return res.status(409).json({ error: 'Este e-mail já possui uma conta no sistema' })
        }
        return res.status(500).json({ error: authErr?.message || 'Erro ao criar conta' })
      }
      userId = authData.user.id
    }

    // 3. Busca perfil_id do voluntário
    const { data: perfil } = await supabaseAdmin
      .from('db_perfil')
      .select('id')
      .eq('church_id', church.id)
      .eq('slug', 'voluntario')
      .maybeSingle()

    // 4. Insere db_user (is_active: false — aguarda aprovação do líder)
    const { error: userErr } = await supabaseAdmin.from('db_user').insert({
      user_id:         userId,
      church_id:       church.id,
      perfil_id:       perfil?.id || null,
      full_name:       full_name.trim(),
      nickname:        apelido?.trim() || null,
      email:           email.trim().toLowerCase(),
      phone:           whatsapp?.trim() || null,
      genero_id:       genero_id || null,
      status_civil_id: status_civil_id || null,
      birth_date:      birth_date || null,
      is_active:       false
    })

    if (userErr) {
      console.error('[cadastro] db_user insert:', userErr)
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
      return res.status(500).json({ error: 'Erro ao criar perfil de usuário' })
    }

    // 5. Insere db_member
    try {
      const { data: memberData, error: memberErr } = await supabaseAdmin
        .from('db_member')
        .insert({
          church_id:               church.id,
          full_name:               full_name.trim(),
          nickname:                apelido?.trim() || null,
          email:                   email.trim().toLowerCase(),
          whatsapp:                whatsapp?.trim() || null,
          birth_date:              birth_date || null,
          genero_id:               genero_id || null,
          status_civil_id:         status_civil_id || null,
          address:                 address?.trim() || null,
          number:                  number?.trim() || null,
          complement:              complement?.trim() || null,
          neighborhood:            neighborhood?.trim() || null,
          city:                    city?.trim() || null,
          state:                   state?.trim() || null,
          zip_code:                zip_code?.trim() || null,
          emergency_contact_name:  emergency_contact_name?.trim() || null,
          emergency_contact_phone: emergency_contact_phone?.trim() || null,
          is_volunteer:            true,
          is_active:               true
        })
        .select()
        .single()

      console.log('[cadastro] db_member resultado:', memberData, memberErr)

      if (memberErr) {
        console.error('[cadastro] db_member ERRO:', JSON.stringify(memberErr))
        return res.status(500).json({ error: memberErr.message })
      }

      // Upload foto se fornecida
      if (photo_base64 && memberData) {
        try {
          const matches = photo_base64.match(/^data:(.+);base64,(.+)$/)
          if (matches) {
            const contentType = matches[1]
            const buffer = Buffer.from(matches[2], 'base64')
            const ext = contentType.split('/')[1]?.split('+')[0] || 'jpg'
            const fileName = `photos/${memberData.id}-${Date.now()}.${ext}`
            await supabaseAdmin.storage.createBucket('voluntarios', { public: true }).catch(() => {})
            const { error: uploadErr } = await supabaseAdmin.storage
              .from('voluntarios').upload(fileName, buffer, { contentType, upsert: true })
            if (!uploadErr) {
              const { data: { publicUrl } } = supabaseAdmin.storage.from('voluntarios').getPublicUrl(fileName)
              await supabaseAdmin.from('db_member').update({ photo_url: publicUrl }).eq('id', memberData.id)
            }
          }
        } catch (e) { console.error('[cadastro photo]', e) }
      }
    } catch (e) {
      console.error('[cadastro] db_member EXCEPTION:', e.message)
      return res.status(500).json({ error: e.message })
    }

    // 6. Notifica owners da igreja
    const { data: ownerPerfil } = await supabaseAdmin
      .from('db_perfil')
      .select('id')
      .eq('church_id', church.id)
      .eq('slug', 'owner')
      .maybeSingle()

    if (ownerPerfil) {
      const { data: owners } = await supabaseAdmin
        .from('db_user')
        .select('id')
        .eq('church_id', church.id)
        .eq('perfil_id', ownerPerfil.id)
        .eq('is_active', true)

      if (owners?.length) {
        await supabaseAdmin.from('db_notificacao').insert(
          owners.map(o => ({
            church_id: church.id,
            user_id:   o.id,
            tipo_id:   6,
            title:     'Novo voluntário aguardando aprovação',
            body:      `${full_name.trim()} se cadastrou como voluntário e aguarda aprovação.`,
            is_read:   false
          }))
        )
      }
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[cadastro] erro inesperado:', err)
    if (userId) await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
    res.status(500).json({ error: 'Erro interno ao processar cadastro' })
  }
})

module.exports = router
