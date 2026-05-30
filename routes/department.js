const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')


// GET /api/department — lista departamentos (opcional: ?ministry_id=)
router.get('/', authMiddleware, checkPermissao('departamento', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  let query = supabaseAdmin
    .from('db_department')
    .select('*, db_ministry(id, name)')
    .eq('church_id', churchId)
    .order('created_at', { ascending: true })

  if (req.query.ministry_id) {
    query = query.eq('ministry_id', req.query.ministry_id)
  }

  const { data, error } = await query

  if (error) {
    console.error('[department GET]', error)
    return res.status(500).json({ error: error.message })
  }

  // Busca líderes de todos os departamentos
  const deptIds = (data || []).map(d => d.id)
  let liderByDept = {}
  if (deptIds.length) {
    const { data: lidRows } = await supabaseAdmin
      .from('db_department_lider')
      .select('department_id, user_id')
      .eq('church_id', churchId)
      .in('department_id', deptIds)

    const userIds = [...new Set((lidRows || []).map(l => l.user_id))]
    let userMap = {}
    if (userIds.length) {
      const { data: users } = await supabaseAdmin
        .from('db_user')
        .select('id, full_name, nickname, avatar_url')
        .in('id', userIds)
      ;(users || []).forEach(u => { userMap[u.id] = u })
    }
    ;(lidRows || []).forEach(l => {
      if (!liderByDept[l.department_id]) liderByDept[l.department_id] = userMap[l.user_id] || null
    })
  }

  const departments = (data || []).map(d => ({
    ...d,
    leader_name:   liderByDept[d.id]?.nickname || liderByDept[d.id]?.full_name || null,
    leader_id:     liderByDept[d.id]?.id       || null,
    leader_avatar: liderByDept[d.id]?.avatar_url || null,
  }))

  res.json({ departments })
})

// GET /api/department/:id
router.get('/:id', authMiddleware, checkPermissao('departamento', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_department')
    .select('*, db_ministry(id, name)')
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Departamento não encontrado' })

  // Busca líder do departamento
  const { data: liderRow } = await supabaseAdmin
    .from('db_department_lider')
    .select('user_id')
    .eq('department_id', req.params.id)
    .eq('church_id', churchId)
    .limit(1)
    .maybeSingle()

  let leaderData = null
  if (liderRow?.user_id) {
    const { data: u } = await supabaseAdmin
      .from('db_user')
      .select('id, full_name, nickname, avatar_url')
      .eq('id', liderRow.user_id)
      .single()
    leaderData = u || null
  }

  res.json({
    department: {
      ...data,
      leader_name:   leaderData?.nickname || leaderData?.full_name || null,
      leader_id:     leaderData?.id       || null,
      leader_avatar: leaderData?.avatar_url || null,
    }
  })
})

// POST /api/department — cria departamento
router.post('/', authMiddleware, checkPermissao('departamento', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, description, ministry_id } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' })
  if (!ministry_id)  return res.status(400).json({ error: 'Ministério obrigatório' })

  const payload = {
    church_id:   churchId,
    ministry_id,
    name:        name.trim(),
    description: description?.trim() || null,
    is_active:   true,
  }

  const { data, error } = await supabaseAdmin
    .from('db_department')
    .insert(payload)
    .select('*, db_ministry(id, name)')
    .single()

  if (error) {
    console.error('[department POST]', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ department: data })
})

// PUT /api/department/:id — atualiza departamento
router.put('/:id', authMiddleware, checkPermissao('departamento', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, description, ministry_id, is_active, is_music_dept } = req.body
  const updates = {}
  if (name         !== undefined) updates.name         = name.trim()
  if (description  !== undefined) updates.description  = description?.trim() || null
  if (ministry_id  !== undefined) updates.ministry_id  = ministry_id
  if (is_active    !== undefined) updates.is_active    = is_active
  if (is_music_dept !== undefined) updates.is_music_dept = is_music_dept

  const { data, error } = await supabaseAdmin
    .from('db_department')
    .update(updates)
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .select('*, db_ministry(id, name)')

  if (error) {
    console.error('[department PUT]', error)
    return res.status(500).json({ error: error.message })
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'Departamento não encontrado' })
  }

  res.json({ department: data[0] })
})

// DELETE /api/department/:id
router.delete('/:id', authMiddleware, checkPermissao('departamento', 'arquivar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { error } = await supabaseAdmin
    .from('db_department')
    .delete()
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) {
    console.error('[department DELETE]', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ ok: true })
})

module.exports = router
