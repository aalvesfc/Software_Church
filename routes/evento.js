const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')

function generateRecurDates(startDate, recurrenceType, recurrenceConfig) {
  const count = parseInt(recurrenceConfig?.count) || 0
  const base  = new Date(startDate + 'T12:00:00')
  const toStr = d => d.toISOString().split('T')[0]
  const dates = []

  if (recurrenceType === 'personalizado') {
    return (recurrenceConfig?.datas || []).filter(d => d !== startDate)
  }

  if (!count) return []

  if (recurrenceType === 'semanal' || recurrenceType === 'quinzenal') {
    const step = recurrenceType === 'semanal' ? 7 : 14
    const cur  = new Date(base)
    for (let i = 0; i < count; i++) {
      cur.setDate(cur.getDate() + step)
      dates.push(toStr(cur))
    }
    return dates
  }

  if (recurrenceType === 'mensal') {
    const modo = recurrenceConfig?.modo
    if (modo === 'dia') {
      const day = base.getDate()
      let year  = base.getFullYear()
      let month = base.getMonth()
      for (let i = 0; i < count; i++) {
        // Avança mês sem overflow: seta dia 1 antes de trocar o mês
        month++
        if (month > 11) { month = 0; year++ }
        const maxDay = new Date(year, month + 1, 0).getDate()
        const d = new Date(year, month, Math.min(day, maxDay))
        dates.push(toStr(d))
      }
    } else {
      // Mesma Nth ocorrência do dia da semana no mês
      const dow     = base.getDay()
      const nthWeek = Math.ceil(base.getDate() / 7)
      let year  = base.getFullYear()
      let month = base.getMonth()
      for (let i = 0; i < count; i++) {
        month++
        if (month > 11) { month = 0; year++ }
        const d = new Date(year, month, 1)
        while (d.getDay() !== dow) d.setDate(d.getDate() + 1)
        d.setDate(d.getDate() + (nthWeek - 1) * 7)
        dates.push(toStr(d))
      }
    }
    return dates
  }

  return []
}

function normalizeLocation(location) {
  if (!location) return null
  const arr = Array.isArray(location) ? location : [location]
  const seen = new Set()
  const deduped = arr
    .map(l => (l || '').trim())
    .filter(l => {
      if (!l) return false
      const key = l.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  return deduped.length ? deduped : null
}

// GET /api/evento/datas — datas com eventos do mês (acessível a todos os autenticados, para o calendário)
router.get('/datas', authMiddleware, async (req, res) => {
  const { data: dbUser } = await supabaseAdmin
    .from('db_user')
    .select('church_id')
    .eq('user_id', req.authUser.id)
    .single()
  if (!dbUser) return res.json({ datas: [] })

  const year  = parseInt(req.query.year)  || new Date().getFullYear()
  const month = parseInt(req.query.month) || new Date().getMonth() + 1
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end   = new Date(year, month, 0).toISOString().split('T')[0]

  const { data } = await supabaseAdmin
    .from('db_event')
    .select('start_date')
    .eq('church_id', dbUser.church_id)
    .eq('is_active', true)
    .gte('start_date', start)
    .lte('start_date', end)

  res.json({ datas: (data || []).map(e => e.start_date) })
})

// GET /api/evento — lista eventos pai da igreja
router.get('/', authMiddleware, checkPermissao('evento', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  let query = supabaseAdmin
    .from('db_event')
    .select('*')
    .eq('church_id', churchId)
    .order('start_date', { ascending: true })

  if (req.query.status) query = query.eq('status', req.query.status)

  const { data, error } = await query
  if (error) { console.error('[evento GET]', error); return res.status(500).json({ error: error.message }) }
  console.log('[evento GET] church=%s total=%d', churchId, (data||[]).length)
  res.json({ eventos: data || [] })
})

// GET /api/evento/:id
router.get('/:id', authMiddleware, checkPermissao('evento', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_event')
    .select('*')
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Evento não encontrado' })
  res.json({ evento: data })
})

// POST /api/evento
router.post('/', authMiddleware, checkPermissao('evento', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const {
    name, description, start_date, end_date, start_time, end_time,
    location, template_id, has_setlist, has_cronograma,
    recurrence_type, recurrence_end_date, recurrence_config, parent_event_id,
  } = req.body

  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' })
  if (!start_date)   return res.status(400).json({ error: 'Data de início obrigatória' })
  if (!start_time)   return res.status(400).json({ error: 'Horário obrigatório' })

  const { data, error } = await supabaseAdmin
    .from('db_event')
    .insert({
      church_id:           churchId,
      name:                name.trim(),
      description:         description?.trim() || null,
      start_date,
      end_date:            end_date || null,
      start_time:          start_time || null,
      end_time:            end_time || null,
      location:            normalizeLocation(location),
      template_id:         template_id || null,
      has_setlist:         has_setlist || false,
      has_cronograma:      has_cronograma || false,
      recurrence_type:     recurrence_type || null,
      recurrence_end_date: recurrence_end_date || null,
      recurrence_config:   recurrence_config || null,
      parent_event_id:     parent_event_id || null,
      status:              'agendado',
      is_active:           true,
    })
    .select()
    .single()

  if (error) { console.error('[evento POST]', error); return res.status(500).json({ error: error.message }) }

  // Cria eventos filhos para recorrência
  if (!parent_event_id && recurrence_type) {
    const dates = generateRecurDates(data.start_date, recurrence_type, recurrence_config)
    console.log('[evento POST] recurrence_type=%s config=%j dates=%j', recurrence_type, recurrence_config, dates)
    if (dates.length) {
      // Calcula o offset de dias entre start_date e end_date do pai
      const endDateOffsetDays = data.end_date
        ? Math.round((new Date(data.end_date + 'T12:00:00') - new Date(data.start_date + 'T12:00:00')) / 86400000)
        : null

      const childBase = {
        church_id:         churchId,
        parent_event_id:   data.id,
        name:              data.name,
        description:       data.description,
        start_time:        data.start_time,
        end_time:          data.end_time,
        location:          data.location,
        template_id:       data.template_id,
        has_setlist:       data.has_setlist,
        has_cronograma:    data.has_cronograma,
        recurrence_type:   null,
        recurrence_config: null,
        status:            'agendado',
        is_active:         true,
      }

      const children = dates.map(d => {
        let endDate = null
        if (endDateOffsetDays !== null) {
          const childEnd = new Date(d + 'T12:00:00')
          childEnd.setDate(childEnd.getDate() + endDateOffsetDays)
          endDate = childEnd.toISOString().split('T')[0]
        }
        return { ...childBase, start_date: d, end_date: endDate }
      })

      const { error: childErr } = await supabaseAdmin
        .from('db_event')
        .insert(children)
      if (childErr) console.error('[evento POST children]', childErr)
    }
  }

  res.status(201).json({ evento: data })
})

// PUT /api/evento/:id
router.put('/:id', authMiddleware, checkPermissao('evento', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const {
    name, description, start_date, end_date, start_time, end_time,
    location, status, template_id, has_setlist, has_cronograma,
    recurrence_type, recurrence_end_date, recurrence_config,
  } = req.body

  const updates = {}
  if (name                !== undefined) updates.name                = name.trim()
  if (description         !== undefined) updates.description         = description?.trim() || null
  if (start_date          !== undefined) updates.start_date          = start_date
  if (end_date            !== undefined) updates.end_date            = end_date || null
  if (start_time          !== undefined) updates.start_time          = start_time || null
  if (end_time            !== undefined) updates.end_time            = end_time || null
  if (location            !== undefined) updates.location            = normalizeLocation(location)
  if (status              !== undefined) updates.status              = status
  if (template_id         !== undefined) updates.template_id         = template_id || null
  if (has_setlist         !== undefined) updates.has_setlist         = has_setlist
  if (has_cronograma      !== undefined) updates.has_cronograma      = has_cronograma
  if (recurrence_type     !== undefined) updates.recurrence_type     = recurrence_type || null
  if (recurrence_end_date !== undefined) updates.recurrence_end_date = recurrence_end_date || null
  if (recurrence_config   !== undefined) updates.recurrence_config   = recurrence_config || null

  const { data, error } = await supabaseAdmin
    .from('db_event')
    .update(updates)
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .select()

  if (error) { console.error('[evento PUT]', error); return res.status(500).json({ error: error.message }) }
  if (!data?.length) return res.status(404).json({ error: 'Evento não encontrado' })
  res.json({ evento: data[0] })
})

// DELETE /api/evento/:id
router.delete('/:id', authMiddleware, checkPermissao('evento', 'cancelar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { error } = await supabaseAdmin
    .from('db_event')
    .delete()
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) { console.error('[evento DELETE]', error); return res.status(500).json({ error: error.message }) }
  res.json({ ok: true })
})

module.exports = router
