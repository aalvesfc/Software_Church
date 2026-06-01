const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')
const { dbError, serverError } = require('../lib/apiError') // SEC-006

async function validateEvent(eventId, churchId) {
  const { data } = await supabaseAdmin
    .from('db_event')
    .select('id')
    .eq('id', eventId)
    .eq('church_id', churchId)
    .single()
  return !!data
}

async function getCronograma(cronogramaId, churchId) {
  const { data } = await supabaseAdmin
    .from('db_cronograma')
    .select('*')
    .eq('id', cronogramaId)
    .eq('church_id', churchId)
    .single()
  return data || null
}

// ── Cronograma ────────────────────────────────────────────────────────────────

// GET /api/cronograma — lista todos os cronogramas da igreja (para modal reutilizar)
router.get('/', authMiddleware, checkPermissao('cronograma', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_cronograma')
    .select('*, evento:event_id (id, name, start_date)')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })

  if (error) { console.error('[cronograma GET /]', error); return dbError(res, error, 'cronograma') }
  res.json({ cronogramas: data || [] })
})

// GET /api/cronograma/:eventId — busca cronograma do evento
router.get('/:eventId', authMiddleware, checkPermissao('cronograma', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_cronograma')
    .select('*')
    .eq('event_id', req.params.eventId)
    .eq('church_id', churchId)
    .maybeSingle()

  if (error) { console.error('[cronograma GET :eventId]', error); return dbError(res, error, 'cronograma') }
  console.log('[cronograma GET :eventId] eventId=%s church=%s found=%s', req.params.eventId, churchId, !!data)
  res.json({ cronograma: data || null })
})

// POST /api/cronograma/:eventId — cria cronograma
router.post('/:eventId', authMiddleware, checkPermissao('cronograma', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  if (!await validateEvent(req.params.eventId, churchId))
    return res.status(404).json({ error: 'Evento não encontrado' })

  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' })

  const { data, error } = await supabaseAdmin
    .from('db_cronograma')
    .insert({ church_id: churchId, event_id: req.params.eventId, name: name.trim() })
    .select('*')
    .single()

  if (error) { console.error('[cronograma POST]', error); return dbError(res, error, 'cronograma') }
  res.status(201).json({ cronograma: data })
})

// PUT /api/cronograma/:id — edita nome
router.put('/:id', authMiddleware, checkPermissao('cronograma', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' })

  const { data, error } = await supabaseAdmin
    .from('db_cronograma')
    .update({ name: name.trim() })
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .select('*')
    .single()

  if (error) { console.error('[cronograma PUT]', error); return dbError(res, error, 'cronograma') }
  if (!data) return res.status(404).json({ error: 'Cronograma não encontrado' })
  res.json({ cronograma: data })
})

// ── Itens ─────────────────────────────────────────────────────────────────────

// GET /api/cronograma/:cronogramaId/itens
router.get('/:cronogramaId/itens', authMiddleware, checkPermissao('cronograma', 'ver'), async (req, res) => {
  console.log('[cronograma itens GET] START cronogramaId=%s', req.params.cronogramaId)
  const churchId = req.churchId
  if (!churchId) { console.log('[cronograma itens GET] church not found'); return res.status(404).json({ error: 'Igreja não encontrada' }) }

  const cronograma = await getCronograma(req.params.cronogramaId, churchId)
  if (!cronograma) { console.log('[cronograma itens GET] cronograma not found id=%s church=%s', req.params.cronogramaId, churchId); return res.status(404).json({ error: 'Cronograma não encontrado' }) }

  const { data, error } = await supabaseAdmin
    .from('db_cronograma_item')
    .select('*, musica:musica_id (id, title, artist, tom, bpm, duration)')
    .eq('cronograma_id', req.params.cronogramaId)
    .eq('church_id', churchId)
    .order('ordem', { ascending: true })

  if (error) { console.error('[cronograma itens GET]', error); return dbError(res, error, 'cronograma') }
  console.log('[cronograma itens GET] cronogramaId=%s church=%s itens=%d', req.params.cronogramaId, churchId, data?.length ?? 0)
  res.json({ cronograma, itens: data || [] })
})

// POST /api/cronograma/:cronogramaId/itens
router.post('/:cronogramaId/itens', authMiddleware, checkPermissao('cronograma', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const cronograma = await getCronograma(req.params.cronogramaId, churchId)
  if (!cronograma) return res.status(404).json({ error: 'Cronograma não encontrado' })

  const { type, title, description, duration, musica_id, ordem } = req.body
  if (!type)          return res.status(400).json({ error: 'Tipo obrigatório' })
  if (!title?.trim()) return res.status(400).json({ error: 'Título obrigatório' })

  let nextOrdem = ordem
  if (nextOrdem == null) {
    const { data: last } = await supabaseAdmin
      .from('db_cronograma_item')
      .select('ordem')
      .eq('cronograma_id', req.params.cronogramaId)
      .order('ordem', { ascending: false })
      .limit(1)
    nextOrdem = last?.length ? (last[0].ordem + 1) : 0
  }

  const { data, error } = await supabaseAdmin
    .from('db_cronograma_item')
    .insert({
      church_id:     churchId,
      event_id:      cronograma.event_id,
      cronograma_id: req.params.cronogramaId,
      type,
      title:         title.trim(),
      description:   description?.trim() || null,
      duration:      duration || null,
      musica_id:     musica_id || null,
      ordem:         nextOrdem,
    })
    .select('*, musica:musica_id (id, title, artist, tom, bpm, duration)')
    .single()

  if (error) { console.error('[cronograma itens POST]', error); return dbError(res, error, 'cronograma') }
  res.status(201).json({ item: data })
})

// PUT /api/cronograma/:cronogramaId/reorder  — antes de itens/:id
router.put('/:cronogramaId/reorder', authMiddleware, checkPermissao('cronograma', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { ordem } = req.body
  if (!Array.isArray(ordem)) return res.status(400).json({ error: 'ordem deve ser um array' })

  await Promise.all(
    ordem.map(({ id, ordem: o }) =>
      supabaseAdmin
        .from('db_cronograma_item')
        .update({ ordem: o })
        .eq('id', id)
        .eq('church_id', churchId)
    )
  )
  res.json({ ok: true })
})

// POST /api/cronograma/:cronogramaId/reutilizar
router.post('/:cronogramaId/reutilizar', authMiddleware, checkPermissao('cronograma', 'criar'), async (req, res) => {
  console.log('[reutilizar] START cronogramaId=%s source=%s', req.params.cronogramaId, req.body?.source_cronograma_id)
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const cronograma = await getCronograma(req.params.cronogramaId, churchId)
  if (!cronograma) { console.log('[reutilizar] cronograma destino nao encontrado'); return res.status(404).json({ error: 'Cronograma não encontrado' }) }

  const { source_cronograma_id } = req.body
  if (!source_cronograma_id) return res.status(400).json({ error: 'source_cronograma_id obrigatório' })

  const { data: source, error: srcErr } = await supabaseAdmin
    .from('db_cronograma_item')
    .select('*')
    .eq('cronograma_id', source_cronograma_id)
    .eq('church_id', churchId)
    .order('ordem', { ascending: true })

  console.log('[reutilizar] source itens=%d srcErr=%s', source?.length, srcErr?.message)
  if (srcErr) return dbError(res, srcErr, 'cronograma')
  if (!source?.length) return res.status(400).json({ error: 'O cronograma selecionado não possui itens para copiar' })

  const copies = source.map(item => ({
    church_id:     churchId,
    event_id:      cronograma.event_id,
    cronograma_id: req.params.cronogramaId,
    type:          item.type,
    title:         item.title,
    description:   item.description,
    duration:      item.duration,
    musica_id:     item.musica_id,
    ordem:         item.ordem,
  }))

  const { data, error } = await supabaseAdmin
    .from('db_cronograma_item')
    .insert(copies)
    .select('*, musica:musica_id (id, title, artist, tom, bpm, duration)')

  if (error) { console.error('[cronograma reutilizar]', error); return dbError(res, error, 'cronograma') }
  res.status(201).json({ itens: data })
})

// PUT /api/cronograma/:cronogramaId/itens/:id
router.put('/:cronogramaId/itens/:id', authMiddleware, checkPermissao('cronograma', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { type, title, description, duration, musica_id } = req.body
  const updates = {}
  if (type        !== undefined) updates.type        = type
  if (title       !== undefined) updates.title       = title.trim()
  if (description !== undefined) updates.description = description?.trim() || null
  if (duration    !== undefined) updates.duration    = duration || null
  if (musica_id   !== undefined) updates.musica_id   = musica_id || null

  const { data, error } = await supabaseAdmin
    .from('db_cronograma_item')
    .update(updates)
    .eq('id', req.params.id)
    .eq('cronograma_id', req.params.cronogramaId)
    .eq('church_id', churchId)
    .select('*, musica:musica_id (id, title, artist, tom, bpm, duration)')
    .single()

  if (error) { console.error('[cronograma itens PUT]', error); return dbError(res, error, 'cronograma') }
  if (!data) return res.status(404).json({ error: 'Item não encontrado' })
  res.json({ item: data })
})

// DELETE /api/cronograma/:cronogramaId/itens/:id
router.delete('/:cronogramaId/itens/:id', authMiddleware, checkPermissao('cronograma', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { error } = await supabaseAdmin
    .from('db_cronograma_item')
    .delete()
    .eq('id', req.params.id)
    .eq('cronograma_id', req.params.cronogramaId)
    .eq('church_id', churchId)

  if (error) { console.error('[cronograma itens DELETE]', error); return dbError(res, error, 'cronograma') }
  res.json({ ok: true })
})

module.exports = router
