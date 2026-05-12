const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')

async function getChurchId(userId) {
  const { data, error } = await supabaseAdmin
    .from('db_user')
    .select('church_id')
    .eq('user_id', userId)
    .single()
  if (error || !data?.church_id) return null
  return data.church_id
}

// GET /api/department — lista departamentos (opcional: ?ministry_id=)
router.get('/', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
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

  res.json({ departments: data || [] })
})

// GET /api/department/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_department')
    .select('*, db_ministry(id, name)')
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Departamento não encontrado' })
  res.json({ department: data })
})

// POST /api/department — cria departamento
router.post('/', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
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
router.put('/:id', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, description, ministry_id, is_active } = req.body
  const updates = {}
  if (name        !== undefined) updates.name        = name.trim()
  if (description !== undefined) updates.description = description?.trim() || null
  if (ministry_id !== undefined) updates.ministry_id = ministry_id
  if (is_active   !== undefined) updates.is_active   = is_active

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
router.delete('/:id', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
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
