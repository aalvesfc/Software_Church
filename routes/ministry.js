// MÓDULO: voluntariado
const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')
const { dbError, serverError } = require('../lib/apiError') // SEC-006
const { registrarLog } = require('../lib/logger')


// GET /api/ministry/:id — busca ministério único
router.get('/:id', authMiddleware, checkPermissao('ministerio', 'ver'), async (req, res) => {
  const churchId = req.churchId
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
router.get('/', authMiddleware, checkPermissao('ministerio', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_ministry')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[ministry GET]', error)
    return dbError(res, error, 'ministry')
  }

  res.json({ ministries: data || [] })
})

// POST /api/ministry — cria ministério
router.post('/', authMiddleware, checkPermissao('ministerio', 'criar'), async (req, res) => {
  const churchId = req.churchId
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
    return dbError(res, error, 'ministry')
  }

  registrarLog({ churchId, userId: req.dbUser?.id, action: 'created', entity: 'ministerio', entityId: data.id, description: `${req.dbUser?.full_name || 'Usuário'} criou ministério ${data.name}`, ipAddress: req.ip })
  res.status(201).json({ ministry: data })
})

// PUT /api/ministry/:id — atualiza ministério
router.put('/:id', authMiddleware, checkPermissao('ministerio', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })
  if (req.dbUser.db_perfil?.slug === 'lider_departamento')
    return res.status(403).json({ error: 'Sem permissão para editar ministérios' })

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
    return dbError(res, error, 'ministry')
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

  const action = data[0].is_active === false ? 'deleted' : 'updated'
  registrarLog({ churchId, userId: req.dbUser?.id, action, entity: 'ministerio', entityId: req.params.id, description: `${req.dbUser?.full_name || 'Usuário'} ${action === 'deleted' ? 'arquivou' : 'atualizou'} ministério ${data[0].name}`, ipAddress: req.ip })
  res.json({ ministry: data[0] })
})

// DELETE /api/ministry/:id — remove ministério
router.delete('/:id', authMiddleware, checkPermissao('ministerio', 'arquivar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })
  if (req.dbUser.db_perfil?.slug === 'lider_departamento')
    return res.status(403).json({ error: 'Sem permissão para excluir ministérios' })

  // Verifica se há departamentos vinculados
  const { count, error: countError } = await supabaseAdmin
    .from('db_department')
    .select('id', { count: 'exact', head: true })
    .eq('ministry_id', req.params.id)

  if (countError) {
    console.error('[ministry DELETE count]', countError)
    return dbError(res, countError, 'ministry')
  }

  if (count > 0) {
    return res.status(409).json({
      error: `Este ministério possui ${count} departamento${count > 1 ? 's' : ''} vinculado${count > 1 ? 's' : ''} e não pode ser excluído.`
    })
  }

  const { data: target } = await supabaseAdmin.from('db_ministry').select('name').eq('id', req.params.id).eq('church_id', churchId).maybeSingle()

  const { error } = await supabaseAdmin
    .from('db_ministry')
    .delete()
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) {
    console.error('[ministry DELETE]', error)
    return dbError(res, error, 'ministry')
  }

  registrarLog({ churchId, userId: req.dbUser?.id, action: 'deleted', entity: 'ministerio', entityId: req.params.id, description: `${req.dbUser?.full_name || 'Usuário'} excluiu ministério ${target?.name || req.params.id}`, ipAddress: req.ip })
  res.json({ ok: true })
})

module.exports = router
