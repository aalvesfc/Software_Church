const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')


// GET /api/funcao?department_id=xxx
router.get('/', authMiddleware, checkPermissao('funcao', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  let query = supabaseAdmin
    .from('db_funcao_dept')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: true })

  if (req.query.department_id) query = query.eq('department_id', req.query.department_id)

  const { data, error } = await query
  if (error) { console.error('[funcao GET]', error); return res.status(500).json({ error: error.message }) }
  res.json({ funcoes: data || [] })
})

// POST /api/funcao
router.post('/', authMiddleware, checkPermissao('funcao', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, description, department_id } = req.body
  if (!name?.trim())    return res.status(400).json({ error: 'Nome obrigatório' })
  if (!department_id)   return res.status(400).json({ error: 'Departamento obrigatório' })

  const { data, error } = await supabaseAdmin
    .from('db_funcao_dept')
    .insert({ church_id: churchId, department_id, name: name.trim(), description: description?.trim() || null, is_active: true })
    .select()
    .single()

  if (error) { console.error('[funcao POST]', error); return res.status(500).json({ error: error.message }) }
  res.status(201).json({ funcao: data })
})

// PUT /api/funcao/:id
router.put('/:id', authMiddleware, checkPermissao('funcao', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, description, is_active } = req.body
  const updates = {}
  if (name        !== undefined) updates.name        = name.trim()
  if (description !== undefined) updates.description = description?.trim() || null
  if (is_active   !== undefined) updates.is_active   = is_active

  const { data, error } = await supabaseAdmin
    .from('db_funcao_dept')
    .update(updates)
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .select()

  if (error) { console.error('[funcao PUT]', error); return res.status(500).json({ error: error.message }) }
  if (!data?.length) return res.status(404).json({ error: 'Função não encontrada' })
  res.json({ funcao: data[0] })
})

// DELETE /api/funcao/:id
router.delete('/:id', authMiddleware, checkPermissao('funcao', 'arquivar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { error } = await supabaseAdmin
    .from('db_funcao_dept')
    .delete()
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) {
    console.error('[funcao DELETE]', error)
    if (error.code === '23503') return res.status(410).json({ error: 'Tem voluntario vinculado a está função' })
    return res.status(500).json({ error: error.message })
  }
  res.json({ ok: true })
})

module.exports = router
