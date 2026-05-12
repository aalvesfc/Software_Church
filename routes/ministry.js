const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')

// Resolve church_id do usuário logado
async function getChurchId(userId) {
  const { data, error } = await supabaseAdmin
    .from('db_user')
    .select('church_id')
    .eq('user_id', userId)
    .single()
  if (error || !data?.church_id) return null
  return data.church_id
}

// GET /api/ministry/:id — busca ministério único
router.get('/:id', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_ministry')
    .select('*')
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Ministério não encontrado' })
  res.json({ ministry: data })
})

// GET /api/ministry — lista ministérios da igreja
router.get('/', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_ministry')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[ministry GET]', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ ministries: data || [] })
})

// POST /api/ministry — cria ministério
router.post('/', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, description } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' })

  const payload = {
    church_id:   churchId,
    name:        name.trim(),
    description: description?.trim() || null,
  }

  const { data, error } = await supabaseAdmin
    .from('db_ministry')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('[ministry POST]', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ ministry: data })
})

// PUT /api/ministry/:id — atualiza ministério
router.put('/:id', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, description, is_active } = req.body
  const updates = {}
  if (name        !== undefined) updates.name        = name.trim()
  if (description !== undefined) updates.description = description?.trim() || null
  if (is_active   !== undefined) updates.is_active   = is_active

  const { data, error } = await supabaseAdmin
    .from('db_ministry')
    .update(updates)
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .select()

  if (error) {
    console.error('[ministry PUT]', error)
    return res.status(500).json({ error: error.message })
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'Ministério não encontrado' })
  }

  // Ao arquivar o ministério, arquiva todos os departamentos vinculados
  if (is_active === false) {
    const { error: deptError } = await supabaseAdmin
      .from('db_department')
      .update({ is_active: false })
      .eq('ministry_id', req.params.id)
      .eq('church_id', churchId)

    if (deptError) console.error('[ministry PUT — archive depts]', deptError)
  }

  res.json({ ministry: data[0] })
})

// DELETE /api/ministry/:id — remove ministério
router.delete('/:id', authMiddleware, async (req, res) => {
  const churchId = await getChurchId(req.authUser.id)
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  // Verifica se há departamentos vinculados
  const { count, error: countError } = await supabaseAdmin
    .from('db_department')
    .select('id', { count: 'exact', head: true })
    .eq('ministry_id', req.params.id)

  if (countError) {
    console.error('[ministry DELETE count]', countError)
    return res.status(500).json({ error: countError.message })
  }

  if (count > 0) {
    return res.status(409).json({
      error: `Este ministério possui ${count} departamento${count > 1 ? 's' : ''} vinculado${count > 1 ? 's' : ''} e não pode ser excluído.`
    })
  }

  const { error } = await supabaseAdmin
    .from('db_ministry')
    .delete()
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) {
    console.error('[ministry DELETE]', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ ok: true })
})

module.exports = router
