const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')

async function getMemberId(dbUserId, churchId) {
  const { data: u } = await supabaseAdmin.from('db_user').select('email').eq('id', dbUserId).single()
  if (!u?.email) return null
  const { data: m } = await supabaseAdmin.from('db_member').select('id').eq('email', u.email).eq('church_id', churchId).maybeSingle()
  return m?.id || null
}

// ── ROTAS /me — voluntário gerencia suas próprias indisponibilidades ──

// GET /api/indisponibilidade/me
router.get('/me', authMiddleware, checkPermissao('voluntario', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const memberId = await getMemberId(req.dbUser.id, churchId)
  if (!memberId) return res.status(404).json({ error: 'Membro não encontrado' })

  const { data, error } = await supabaseAdmin
    .from('db_indisponibilidade')
    .select('*, db_department(name)')
    .eq('church_id', churchId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })

  if (error) { console.error('[indisp/me GET]', error); return res.status(500).json({ error: error.message }) }
  res.json({ indisponibilidades: data || [] })
})

// POST /api/indisponibilidade/me
router.post('/me', authMiddleware, checkPermissao('voluntario', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const memberId = await getMemberId(req.dbUser.id, churchId)
  if (!memberId) return res.status(404).json({ error: 'Membro não encontrado' })

  const { type, start_date, end_date, department_id, notes } = req.body

  const TIPOS = ['data_unica', 'periodo', 'departamento']
  if (!type || !TIPOS.includes(type))
    return res.status(400).json({ error: 'Tipo inválido' })

  if (type === 'data_unica' && !start_date)
    return res.status(400).json({ error: 'Data obrigatória' })
  if (type === 'periodo') {
    if (!start_date || !end_date) return res.status(400).json({ error: 'Data início e fim obrigatórias' })
    if (end_date <= start_date)   return res.status(400).json({ error: 'Data fim deve ser após a data início' })
  }
  if (type === 'departamento') {
    if (!department_id)           return res.status(400).json({ error: 'Departamento obrigatório' })
    if (!start_date || !end_date) return res.status(400).json({ error: 'Data início e fim obrigatórias' })
    if (end_date <= start_date)   return res.status(400).json({ error: 'Data fim deve ser após a data início' })
  }

  const { data, error } = await supabaseAdmin
    .from('db_indisponibilidade')
    .insert({
      church_id:     churchId,
      member_id:     memberId,
      type,
      start_date:    start_date     || null,
      end_date:      end_date       || null,
      department_id: department_id  || null,
      notes:         notes          || null,
    })
    .select('*, db_department(name)')
    .single()

  if (error) { console.error('[indisp/me POST]', error); return res.status(500).json({ error: error.message }) }
  res.status(201).json({ indisponibilidade: data })
})

// DELETE /api/indisponibilidade/me/:id
router.delete('/me/:id', authMiddleware, checkPermissao('voluntario', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const memberId = await getMemberId(req.dbUser.id, churchId)
  if (!memberId) return res.status(404).json({ error: 'Membro não encontrado' })

  const { error } = await supabaseAdmin
    .from('db_indisponibilidade')
    .delete()
    .eq('id', req.params.id)
    .eq('member_id', memberId)
    .eq('church_id', churchId)

  if (error) { console.error('[indisp/me DELETE]', error); return res.status(500).json({ error: error.message }) }
  res.json({ ok: true })
})

// ── ROTAS /:memberId — líderes gerenciam indisponibilidades de qualquer membro ──

// GET /api/indisponibilidade/:memberId
router.get('/:memberId', authMiddleware, checkPermissao('voluntario', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_indisponibilidade')
    .select('*, db_department(name)')
    .eq('church_id', churchId)
    .eq('member_id', req.params.memberId)
    .order('created_at', { ascending: false })

  if (error) { console.error('[indisp GET]', error); return res.status(500).json({ error: error.message }) }
  res.json({ indisponibilidades: data || [] })
})

// POST /api/indisponibilidade/:memberId
router.post('/:memberId', authMiddleware, checkPermissao('voluntario', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { type, start_date, end_date, department_id, notes } = req.body

  const TIPOS = ['data_unica', 'periodo', 'departamento']
  if (!type || !TIPOS.includes(type))
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
      church_id:     churchId,
      member_id:     req.params.memberId,
      type,
      start_date:    start_date     || null,
      end_date:      end_date       || null,
      department_id: department_id  || null,
      notes:         notes          || null,
    })
    .select('*, db_department(name)')
    .single()

  if (error) { console.error('[indisp POST]', error); return res.status(500).json({ error: error.message }) }
  res.status(201).json({ indisponibilidade: data })
})

// DELETE /api/indisponibilidade/:memberId/:id
router.delete('/:memberId/:id', authMiddleware, checkPermissao('voluntario', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { error } = await supabaseAdmin
    .from('db_indisponibilidade')
    .delete()
    .eq('id', req.params.id)
    .eq('member_id', req.params.memberId)
    .eq('church_id', churchId)

  if (error) { console.error('[indisp DELETE]', error); return res.status(500).json({ error: error.message }) }
  res.json({ ok: true })
})

module.exports = router
