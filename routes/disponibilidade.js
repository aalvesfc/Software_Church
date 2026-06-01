const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const { dbError, serverError } = require('../lib/apiError') // SEC-006

const TURNOS_VALIDOS = ['manha', 'tarde', 'noite']

async function getDbUser(authUserId) {
  const { data } = await supabaseAdmin
    .from('db_user')
    .select('id, email, church_id')
    .eq('user_id', authUserId)
    .single()
  return data || null
}

async function getMemberId(email, churchId) {
  const { data: m } = await supabaseAdmin
    .from('db_member')
    .select('id')
    .eq('email', email)
    .eq('church_id', churchId)
    .maybeSingle()
  return m?.id || null
}

// GET /api/disponibilidade/me
router.get('/me', authMiddleware, async (req, res) => {
  const dbUser = await getDbUser(req.authUser.id)
  if (!dbUser?.church_id) return res.status(404).json({ error: 'Igreja não encontrada' })

  const memberId = await getMemberId(dbUser.email, dbUser.church_id)
  if (!memberId) return res.status(404).json({ error: 'Membro não encontrado' })

  const { data, error } = await supabaseAdmin
    .from('db_disponibilidade')
    .select('id, dia_semana, turno')
    .eq('church_id', dbUser.church_id)
    .eq('member_id', memberId)
    .order('dia_semana', { ascending: true })

  if (error) { console.error('[dispon/me GET]', error); return dbError(res, error, 'disponibilidade') }
  res.json({ disponibilidades: data || [] })
})

// POST /api/disponibilidade/me — substitui tudo (delete + insert)
router.post('/me', authMiddleware, async (req, res) => {
  const dbUser = await getDbUser(req.authUser.id)
  if (!dbUser?.church_id) return res.status(404).json({ error: 'Igreja não encontrada' })

  const memberId = await getMemberId(dbUser.email, dbUser.church_id)
  if (!memberId) return res.status(404).json({ error: 'Membro não encontrado' })

  const { disponibilidades } = req.body
  if (!Array.isArray(disponibilidades)) return res.status(400).json({ error: 'disponibilidades deve ser array' })

  for (const d of disponibilidades) {
    if (typeof d.dia_semana !== 'number' || d.dia_semana < 0 || d.dia_semana > 6)
      return res.status(400).json({ error: 'dia_semana inválido' })
    if (!TURNOS_VALIDOS.includes(d.turno))
      return res.status(400).json({ error: 'turno inválido' })
  }

  const { error: delErr } = await supabaseAdmin
    .from('db_disponibilidade')
    .delete()
    .eq('church_id', dbUser.church_id)
    .eq('member_id', memberId)

  if (delErr) { console.error('[dispon/me DELETE]', delErr); return dbError(res, delErr, 'disponibilidade') }

  if (disponibilidades.length) {
    const rows = disponibilidades.map(d => ({
      church_id:  dbUser.church_id,
      member_id:  memberId,
      dia_semana: d.dia_semana,
      turno:      d.turno,
    }))
    const { error: insErr } = await supabaseAdmin.from('db_disponibilidade').insert(rows)
    if (insErr) { console.error('[dispon/me INSERT]', insErr); return dbError(res, insErr, 'disponibilidade') }
  }

  res.json({ ok: true })
})

// GET /api/disponibilidade/:memberId — líderes consultam qualquer membro
router.get('/:memberId', authMiddleware, async (req, res) => {
  const dbUser = await getDbUser(req.authUser.id)
  if (!dbUser?.church_id) return res.status(404).json({ error: 'Igreja não encontrada' })

  const ownMemberId = await getMemberId(dbUser.email, dbUser.church_id)

  // voluntário só pode ver a própria disponibilidade
  if (req.params.memberId !== ownMemberId) {
    const { data: perfil } = await supabaseAdmin
      .from('db_user')
      .select('db_perfil:perfil_id(slug)')
      .eq('id', dbUser.id)
      .single()
    if (perfil?.db_perfil?.slug === 'voluntario')
      return res.status(403).json({ error: 'Acesso não permitido' })
  }

  const { data, error } = await supabaseAdmin
    .from('db_disponibilidade')
    .select('id, dia_semana, turno')
    .eq('church_id', dbUser.church_id)
    .eq('member_id', req.params.memberId)
    .order('dia_semana', { ascending: true })

  if (error) { console.error('[dispon GET]', error); return dbError(res, error, 'disponibilidade') }
  res.json({ disponibilidades: data || [] })
})

module.exports = router
