const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')
const { dbError, serverError } = require('../lib/apiError') // SEC-006

const USER_SELECT = 'id, full_name, email, avatar_url'

function flattenLider(l) {
  return {
    id:         l.id,
    user_id:    l.user_id,
    full_name:  l.db_user?.full_name || '—',
    email:      l.db_user?.email     || '',
    avatar_url: l.db_user?.avatar_url || null,
  }
}

async function verificarUsuario(userId, churchId) {
  const { data } = await supabaseAdmin
    .from('db_user')
    .select('id')
    .eq('id', userId)
    .eq('church_id', churchId)
    .maybeSingle()
  return data ? null : 'Usuário não encontrado nesta igreja'
}

// Promove o usuário para o perfil 'lider' (só se for voluntário ou sem perfil)
async function promoverParaLider(userId, churchId) {
  const { data: perfilLider } = await supabaseAdmin
    .from('db_perfil')
    .select('id')
    .eq('church_id', churchId)
    .eq('slug', 'lider')
    .maybeSingle()

  if (!perfilLider) return

  const { data: dbUser } = await supabaseAdmin
    .from('db_user')
    .select('perfil_id, db_perfil(slug)')
    .eq('id', userId)
    .single()

  const perfilAtual = dbUser?.db_perfil?.slug
  const podeAtualizar = ['voluntario', null].includes(perfilAtual)

  if (podeAtualizar) {
    await supabaseAdmin
      .from('db_user')
      .update({ perfil_id: perfilLider.id })
      .eq('id', userId)
  }
}

// Rebaixa para 'voluntario' se o usuário não for mais líder em nenhum lugar
async function rebaixarSeNaoEhMaisLider(userId, churchId) {
  const [{ data: outrosMinisterios }, { data: outrosDepartamentos }] = await Promise.all([
    supabaseAdmin
      .from('db_ministry_lider')
      .select('id')
      .eq('user_id', userId)
      .eq('church_id', churchId),
    supabaseAdmin
      .from('db_department_lider')
      .select('id')
      .eq('user_id', userId)
      .eq('church_id', churchId),
  ])

  const aindaELider = (outrosMinisterios?.length ?? 0) > 0 ||
                      (outrosDepartamentos?.length ?? 0) > 0
  if (aindaELider) return

  const { data: perfilVoluntario } = await supabaseAdmin
    .from('db_perfil')
    .select('id')
    .eq('church_id', churchId)
    .eq('slug', 'voluntario')
    .maybeSingle()

  if (perfilVoluntario) {
    await supabaseAdmin
      .from('db_user')
      .update({ perfil_id: perfilVoluntario.id })
      .eq('id', userId)
  }
}

// ─── MINISTÉRIO ──────────────────────────────────────────────────────────────

// GET /api/lider/ministerio/:ministryId
router.get('/ministerio/:ministryId', authMiddleware, checkPermissao('ministerio', 'ver'), async (req, res) => {
  const churchId = req.churchId

  const { data, error } = await supabaseAdmin
    .from('db_ministry_lider')
    .select(`id, user_id, db_user(${USER_SELECT})`)
    .eq('ministry_id', req.params.ministryId)
    .eq('church_id', churchId)

  if (error) return dbError(res, error, 'lider')

  const lideres = (data || [])
    .map(flattenLider)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))

  res.json({ lideres })
})

// POST /api/lider/ministerio/:ministryId
router.post('/ministerio/:ministryId', authMiddleware, checkPermissao('ministerio', 'editar'), async (req, res) => {
  const churchId = req.churchId
  const { user_id } = req.body

  if (!user_id) return res.status(400).json({ error: 'user_id obrigatório' })

  const err = await verificarUsuario(user_id, churchId)
  if (err) return res.status(404).json({ error: err })

  const { data, error } = await supabaseAdmin
    .from('db_ministry_lider')
    .insert({ ministry_id: req.params.ministryId, user_id, church_id: churchId })
    .select(`id, user_id, db_user(${USER_SELECT})`)
    .single()

  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.message })

  // Promove para 'lider' se ainda for 'voluntario'
  await promoverParaLider(user_id, churchId)

  res.status(201).json({ lider: flattenLider(data) })
})

// DELETE /api/lider/ministerio/:ministryId/:userId
router.delete('/ministerio/:ministryId/:userId', authMiddleware, checkPermissao('ministerio', 'editar'), async (req, res) => {
  const churchId = req.churchId
  const userId   = req.params.userId

  const { error } = await supabaseAdmin
    .from('db_ministry_lider')
    .delete()
    .eq('ministry_id', req.params.ministryId)
    .eq('user_id', userId)
    .eq('church_id', churchId)

  if (error) return dbError(res, error, 'lider')

  // Rebaixa para 'voluntario' se não for mais líder em nenhum lugar
  await rebaixarSeNaoEhMaisLider(userId, churchId)

  res.json({ ok: true })
})

// ─── DEPARTAMENTO ─────────────────────────────────────────────────────────────

// GET /api/lider/departamento/:departmentId
router.get('/departamento/:departmentId', authMiddleware, checkPermissao('departamento', 'ver'), async (req, res) => {
  const churchId = req.churchId

  const { data, error } = await supabaseAdmin
    .from('db_department_lider')
    .select(`id, user_id, db_user(${USER_SELECT})`)
    .eq('department_id', req.params.departmentId)
    .eq('church_id', churchId)

  if (error) return dbError(res, error, 'lider')

  const lideres = (data || [])
    .map(flattenLider)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))

  res.json({ lideres })
})

// POST /api/lider/departamento/:departmentId
router.post('/departamento/:departmentId', authMiddleware, checkPermissao('departamento', 'editar'), async (req, res) => {
  const churchId = req.churchId
  const { user_id } = req.body

  if (!user_id) return res.status(400).json({ error: 'user_id obrigatório' })

  const err = await verificarUsuario(user_id, churchId)
  if (err) return res.status(404).json({ error: err })

  const { data, error } = await supabaseAdmin
    .from('db_department_lider')
    .insert({ department_id: req.params.departmentId, user_id, church_id: churchId })
    .select(`id, user_id, db_user(${USER_SELECT})`)
    .single()

  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.message })

  // Promove para 'lider' se ainda for 'voluntario'
  await promoverParaLider(user_id, churchId)

  res.status(201).json({ lider: flattenLider(data) })
})

// DELETE /api/lider/departamento/:departmentId/:userId
router.delete('/departamento/:departmentId/:userId', authMiddleware, checkPermissao('departamento', 'editar'), async (req, res) => {
  const churchId = req.churchId
  const userId   = req.params.userId

  const { error } = await supabaseAdmin
    .from('db_department_lider')
    .delete()
    .eq('department_id', req.params.departmentId)
    .eq('user_id', userId)
    .eq('church_id', churchId)

  if (error) return dbError(res, error, 'lider')

  // Rebaixa para 'voluntario' se não for mais líder em nenhum lugar
  await rebaixarSeNaoEhMaisLider(userId, churchId)

  res.json({ ok: true })
})

module.exports = router
