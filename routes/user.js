const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const { dbError, serverError } = require('../lib/apiError') // SEC-006

// GET /api/user/lista — lista usuários ativos da igreja (para seleção de líderes)
router.get('/lista', authMiddleware, async (req, res) => {
  const { data: me } = await supabaseAdmin
    .from('db_user')
    .select('church_id')
    .eq('user_id', req.authUser.id)
    .single()

  if (!me?.church_id) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_user')
    .select('id, full_name, nickname, email, avatar_url, db_perfil(slug)')
    .eq('church_id', me.church_id)
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) return dbError(res, error, 'user')

  const usuarios = (data || []).map(u => ({
    id:          u.id,
    full_name:   u.full_name || u.nickname || u.email || '—',
    email:       u.email       || '',
    avatar_url:  u.avatar_url  || null,
    perfil_slug: u.db_perfil?.slug || null,
  }))

  res.json({ usuarios })
})

// GET /api/user/generos — lista todos os gêneros disponíveis
router.get('/generos', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('db_genero')
    .select('*')

  if (error) {
    console.error('[generos] erro Supabase:', JSON.stringify(error))
    return dbError(res, error, 'user')
  }

  const normalizado = (data || []).map(row => ({
    id:   row.id,
    name: row.name || row.nome || row.descricao || row.label || Object.values(row).find(v => typeof v === 'string' && v !== row.id) || ''
  }))

  res.json(normalizado)
})

// GET /api/user/estados-civis — lista todos os estados civis disponíveis
router.get('/estados-civis', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('db_status_civil')
    .select('*')

  if (error) {
    console.error('[estados-civis] erro Supabase:', JSON.stringify(error))
    return dbError(res, error, 'user')
  }

  // Normaliza qualquer nome de coluna para { id, name }
  const normalizado = (data || []).map(row => ({
    id:   row.id,
    name: row.name || row.nome || row.descricao || row.label || Object.values(row).find(v => typeof v === 'string' && v !== row.id) || ''
  }))

  res.json(normalizado)
})

// PUT /api/user/profile — atualiza perfil do usuário logado
router.put('/profile', authMiddleware, async (req, res) => {
  const { full_name, nickname, phone, genero_id, status_civil_id, birth_date } = req.body

  if (!nickname || !nickname.trim()) {
    return res.status(400).json({ error: 'O campo "Como quer ser chamado" é obrigatório.' })
  }

  const updates = {
    nickname: nickname.trim(),
    updated_at: new Date().toISOString()
  }

  if (full_name !== undefined)      updates.full_name = full_name.trim()
  if (phone !== undefined)          updates.phone = phone.trim()
  if (genero_id !== undefined)      updates.genero_id = genero_id || null
  if (status_civil_id !== undefined) updates.status_civil_id = status_civil_id || null
  if (birth_date !== undefined)     updates.birth_date = birth_date || null

  const { data: dbUser, error } = await supabaseAdmin
    .from('db_user')
    .update(updates)
    .eq('user_id', req.authUser.id)
    .select(`
      id, nickname, full_name, email, phone, avatar_url, role, genero_id, status_civil_id, birth_date,
      db_genero ( id, name )
    `)
    .single()

  if (error) return res.status(500).json({ error: 'Erro ao salvar perfil.' })

  const generoNome = dbUser.db_genero?.name || ''
  const prefixo = generoNome === 'Masculino' ? 'Sr.' : generoNome === 'Feminino' ? 'Sra.' : ''
  const nomeExibicao = prefixo ? `${prefixo} ${dbUser.nickname}` : dbUser.nickname

  res.json({
    ok: true,
    usuario: {
      id: dbUser.id,
      nome: nomeExibicao,
      nickname: dbUser.nickname,
      full_name: dbUser.full_name || '',
      email: dbUser.email,
      phone: dbUser.phone || '',
      genero_id: dbUser.genero_id || null,
      status_civil_id: dbUser.status_civil_id || null,
      birth_date: dbUser.birth_date || null,
      avatar: dbUser.avatar_url,
      role: dbUser.role
    }
  })
})

// helper: resolve member_id from logged-in user
async function getMemberId(authUserId) {
  const { data: dbUser } = await supabaseAdmin
    .from('db_user')
    .select('email, church_id')
    .eq('user_id', authUserId)
    .single()
  if (!dbUser) return null
  const { data: member } = await supabaseAdmin
    .from('db_member')
    .select('id')
    .eq('email', dbUser.email)
    .eq('church_id', dbUser.church_id)
    .single()
  return member ? { memberId: member.id, churchId: dbUser.church_id } : null
}

// GET /api/user/departamentos — departamentos do usuário logado
router.get('/departamentos', authMiddleware, async (req, res) => {
  const ctx = await getMemberId(req.authUser.id)
  if (!ctx) return res.json({ departamentos: [] })

  const { data: links, error } = await supabaseAdmin
    .from('db_member_dept')
    .select('id, status, funcao_id, department_id')
    .eq('member_id', ctx.memberId)

  if (error) return dbError(res, error, 'user')
  if (!links?.length) return res.json({ departamentos: [], member_id: ctx.memberId })

  const deptIds   = [...new Set(links.map(l => l.department_id))]
  const funcaoIds = [...new Set(links.filter(l => l.funcao_id).map(l => l.funcao_id))]

  const [{ data: depts }, { data: funcoes }] = await Promise.all([
    supabaseAdmin.from('db_department').select('id, name').in('id', deptIds),
    funcaoIds.length
      ? supabaseAdmin.from('db_funcao_dept').select('id, name').in('id', funcaoIds)
      : { data: [] }
  ])

  const deptMap   = Object.fromEntries((depts   || []).map(d => [d.id, d]))
  const funcaoMap = Object.fromEntries((funcoes || []).map(f => [f.id, f]))

  res.json({
    member_id: ctx.memberId,
    departamentos: links.map(l => ({
      id:              l.id,
      status:          l.status,
      department_id:   l.department_id,
      department_name: deptMap[l.department_id]?.name || '',
      funcao_id:       l.funcao_id || null,
      funcao_name:     l.funcao_id ? (funcaoMap[l.funcao_id]?.name || '') : '',
    }))
  })
})

// GET /api/user/indisponibilidades — indisponibilidades do usuário logado
router.get('/indisponibilidades', authMiddleware, async (req, res) => {
  const ctx = await getMemberId(req.authUser.id)
  if (!ctx) return res.json({ indisponibilidades: [] })

  const { data, error } = await supabaseAdmin
    .from('db_indisponibilidade')
    .select('*, db_department(name)')
    .eq('church_id', ctx.churchId)
    .eq('member_id', ctx.memberId)
    .order('start_date', { ascending: false })

  if (error) return dbError(res, error, 'user')
  res.json({ indisponibilidades: data || [], member_id: ctx.memberId })
})

// POST /api/user/indisponibilidades — cria indisponibilidade
router.post('/indisponibilidades', authMiddleware, async (req, res) => {
  const ctx = await getMemberId(req.authUser.id)
  if (!ctx) return res.status(404).json({ error: 'Membro não encontrado' })

  const { type, start_date, end_date, department_id, notes } = req.body
  if (!type || !['data_unica', 'periodo', 'departamento'].includes(type))
    return res.status(400).json({ error: 'Tipo inválido' })
  if (!start_date)
    return res.status(400).json({ error: 'Data de início obrigatória' })
  if ((type === 'periodo' || type === 'departamento') && !end_date)
    return res.status(400).json({ error: 'Data de fim obrigatória' })
  if (type === 'departamento' && !department_id)
    return res.status(400).json({ error: 'Departamento obrigatório' })

  const { data, error } = await supabaseAdmin
    .from('db_indisponibilidade')
    .insert({
      church_id:     ctx.churchId,
      member_id:     ctx.memberId,
      type,
      start_date,
      end_date:      end_date      || null,
      department_id: department_id || null,
      notes:         notes         || null,
    })
    .select('*, db_department(name)')
    .single()

  if (error) return dbError(res, error, 'user')
  res.status(201).json({ indisponibilidade: data })
})

// DELETE /api/user/indisponibilidades/:id
router.delete('/indisponibilidades/:id', authMiddleware, async (req, res) => {
  const ctx = await getMemberId(req.authUser.id)
  if (!ctx) return res.status(404).json({ error: 'Membro não encontrado' })

  const { error } = await supabaseAdmin
    .from('db_indisponibilidade')
    .delete()
    .eq('id', req.params.id)
    .eq('member_id', ctx.memberId)
    .eq('church_id', ctx.churchId)

  if (error) return dbError(res, error, 'user')
  res.json({ ok: true })
})

// GET /api/user/eventos-escalados — eventos futuros em que o usuário está escalado
router.get('/eventos-escalados', authMiddleware, async (req, res) => {
  const ctx = await getMemberId(req.authUser.id)
  if (!ctx) return res.json({ eventos: [] })

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('db_escala_item')
    .select('id, escala_id, funcao_id, status')
    .eq('member_id', ctx.memberId)
    .eq('church_id', ctx.churchId)

  if (itemsErr) return dbError(res, itemsErr, 'user')
  if (!items?.length) return res.json({ eventos: [] })

  const escalaIds = [...new Set(items.map(i => i.escala_id))]
  const funcaoIds = [...new Set(items.filter(i => i.funcao_id).map(i => i.funcao_id))]

  const [{ data: escalas }, { data: funcoes }] = await Promise.all([
    supabaseAdmin.from('db_escala').select('id, event_id, department_id, status').in('id', escalaIds),
    funcaoIds.length
      ? supabaseAdmin.from('db_funcao_dept').select('id, name').in('id', funcaoIds)
      : { data: [] }
  ])

  const eventIds = [...new Set((escalas || []).map(e => e.event_id))]
  const deptIds  = [...new Set((escalas || []).map(e => e.department_id))]
  const _d = new Date()
  const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`

  const [{ data: eventos }, { data: depts }] = await Promise.all([
    supabaseAdmin.from('db_event')
      .select('id, name, start_date, start_time')
      .in('id', eventIds)
      .eq('church_id', ctx.churchId)
      .gte('start_date', today)
      .order('start_date', { ascending: true }),
    supabaseAdmin.from('db_department').select('id, name').in('id', deptIds)
  ])

  const escalaMap = Object.fromEntries((escalas || []).map(e => [e.id, e]))
  const eventMap  = Object.fromEntries((eventos  || []).map(e => [e.id, e]))
  const deptMap   = Object.fromEntries((depts    || []).map(d => [d.id, d]))
  const funcMap   = Object.fromEntries((funcoes  || []).map(f => [f.id, f]))

  // Busca check-ins reais do db_checkin para os eventos futuros
  const eventIdsFuturos = Object.keys(eventMap)
  const { data: checkins } = eventIdsFuturos.length
    ? await supabaseAdmin.from('db_checkin')
        .select('event_id, status, checkin_at, checkout_at')
        .eq('member_id', ctx.memberId)
        .eq('church_id', ctx.churchId)
        .in('event_id', eventIdsFuturos)
    : { data: [] }
  const checkinMap = Object.fromEntries((checkins || []).map(c => [c.event_id, c]))

  const seen   = new Set()
  const result = items
    .map(item => {
      const escala = escalaMap[item.escala_id]
      if (!escala) return null
      const evento = eventMap[escala.event_id]
      if (!evento) return null
      const checkin = checkinMap[evento.id] || null
      return {
        item_id:         item.id,
        item_status:     checkin ? checkin.status : null,
        checkin:         checkin,
        evento_id:       evento.id,
        evento_nome:     evento.name,
        evento_data:     evento.start_date,
        evento_hora:     evento.start_time || null,
        escala_status:   escala.status || 'rascunho',
        department_name: deptMap[escala.department_id]?.name || '',
        funcao_name:     item.funcao_id ? (funcMap[item.funcao_id]?.name || '') : '',
      }
    })
    .filter(r => {
      if (!r) return false
      const key = `${r.evento_id}-${r.department_name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.evento_data.localeCompare(b.evento_data))

  res.json({ eventos: result })
})

// POST /api/user/checkin/:itemId — registra check-in do voluntário em um item de escala
router.post('/checkin/:itemId', authMiddleware, async (req, res) => {
  const ctx = await getMemberId(req.authUser.id)
  if (!ctx) return res.status(404).json({ error: 'Membro não encontrado' })

  const { data, error } = await supabaseAdmin
    .from('db_escala_item')
    .update({ status: 'presente' })
    .eq('id', req.params.itemId)
    .eq('member_id', ctx.memberId)
    .eq('church_id', ctx.churchId)
    .select('id, status')
    .single()

  if (error) return dbError(res, error, 'user')
  if (!data) return res.status(404).json({ error: 'Item não encontrado ou sem permissão' })

  res.json({ ok: true, item: data })
})

// PUT /api/user/avatar — upload avatar do usuário logado (base64)
router.put('/avatar', authMiddleware, async (req, res) => {
  const { photo_base64 } = req.body
  if (!photo_base64) return res.status(400).json({ error: 'Imagem obrigatória' })

  const matches = photo_base64.match(/^data:(.+);base64,(.+)$/)
  if (!matches) return res.status(400).json({ error: 'Formato inválido' })

  const contentType = matches[1]
  const buffer      = Buffer.from(matches[2], 'base64')
  const ext         = contentType.split('/')[1]?.split('+')[0] || 'jpg'
  const fileName    = `avatars/${req.authUser.id}-${Date.now()}.${ext}`

  await supabaseAdmin.storage.createBucket('avatars', { public: true }).catch(() => {})

  const { error: uploadError } = await supabaseAdmin.storage
    .from('avatars')
    .upload(fileName, buffer, { contentType, upsert: true })

  if (uploadError) {
    console.error('[avatar upload]', uploadError)
    return res.status(500).json({ error: 'Erro ao fazer upload da imagem' })
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName)

  // Busca email para atualizar db_member também
  const { data: dbUser } = await supabaseAdmin
    .from('db_user')
    .select('email, church_id')
    .eq('user_id', req.authUser.id)
    .single()

  const [{ error: updateUserErr }] = await Promise.all([
    supabaseAdmin.from('db_user').update({ avatar_url: publicUrl }).eq('user_id', req.authUser.id),
    dbUser
      ? supabaseAdmin.from('db_member').update({ photo_url: publicUrl }).eq('email', dbUser.email).eq('church_id', dbUser.church_id)
      : Promise.resolve()
  ])

  if (updateUserErr) return res.status(500).json({ error: 'Erro ao salvar avatar' })

  res.json({ ok: true, avatar_url: publicUrl })
})

module.exports = router
