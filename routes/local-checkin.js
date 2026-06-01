const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')

// GET / — lista locais ativos
router.get('/', authMiddleware, checkPermissao('configuracao', 'ver'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('db_local_checkin')
    .select('*')
    .eq('church_id', req.churchId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ locais: data || [] })
})

// POST / — cria novo local
router.post('/', authMiddleware, checkPermissao('configuracao', 'editar'), async (req, res) => {
  const { name, latitude, longitude, raio_metros } = req.body
  if (!name || latitude == null || longitude == null) return res.status(400).json({ error: 'name, latitude e longitude são obrigatórios' })
  const { data, error } = await supabaseAdmin
    .from('db_local_checkin')
    .insert({ church_id: req.churchId, name, latitude, longitude, raio_metros: raio_metros || 500, is_active: true })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ local: data })
})

// PUT /:id — edita local
router.put('/:id', authMiddleware, checkPermissao('configuracao', 'editar'), async (req, res) => {
  const { name, latitude, longitude, raio_metros } = req.body
  const updates = {}
  if (name       != null) updates.name       = name
  if (latitude   != null) updates.latitude   = latitude
  if (longitude  != null) updates.longitude  = longitude
  if (raio_metros != null) updates.raio_metros = raio_metros
  const { data, error } = await supabaseAdmin
    .from('db_local_checkin')
    .update(updates)
    .eq('id', req.params.id)
    .eq('church_id', req.churchId)
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ local: data })
})

// DELETE /:id — exclusão lógica
router.delete('/:id', authMiddleware, checkPermissao('configuracao', 'editar'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('db_local_checkin')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('church_id', req.churchId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

module.exports = router
