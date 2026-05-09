const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')

// GET /api/user/generos — lista todos os gêneros disponíveis
router.get('/generos', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('db_genero')
    .select('*')

  if (error) {
    console.error('[generos] erro Supabase:', JSON.stringify(error))
    return res.status(500).json({ error: error.message, details: error })
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
    return res.status(500).json({ error: error.message, details: error })
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

module.exports = router
