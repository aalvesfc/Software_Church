const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const { dbError, serverError } = require('../lib/apiError') // SEC-006

async function getDbUser(userId) {
  const { data } = await supabaseAdmin.from('db_user').select('id, church_id, full_name').eq('user_id', userId).single()
  return data
}

// GET / — últimas 20 notificações
router.get('/', authMiddleware, async (req, res) => {
  const dbUser = await getDbUser(req.authUser.id)
  if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })
  const { data, error } = await supabaseAdmin
    .from('db_notificacao')
    .select('*')
    .eq('user_id', dbUser.id)
    .eq('church_id', dbUser.church_id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return dbError(res, error, 'notificacao')
  res.json({ notificacoes: data || [] })
})

// GET /nao-lidas — count de não lidas
router.get('/nao-lidas', authMiddleware, async (req, res) => {
  const dbUser = await getDbUser(req.authUser.id)
  if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })
  const { count, error } = await supabaseAdmin
    .from('db_notificacao')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', dbUser.id)
    .eq('church_id', dbUser.church_id)
    .eq('is_read', false)
    .eq('is_archived', false)
  if (error) return dbError(res, error, 'notificacao')
  res.json({ count: count || 0 })
})

// PUT /marcar-todas-lidas
router.put('/marcar-todas-lidas', authMiddleware, async (req, res) => {
  const dbUser = await getDbUser(req.authUser.id)
  if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })
  await supabaseAdmin.from('db_notificacao')
    .update({ is_read: true })
    .eq('user_id', dbUser.id)
    .eq('church_id', dbUser.church_id)
    .eq('is_read', false)
  res.json({ ok: true })
})

// PUT /:id/lida
router.put('/:id/lida', authMiddleware, async (req, res) => {
  const dbUser = await getDbUser(req.authUser.id)
  if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })
  await supabaseAdmin.from('db_notificacao')
    .update({ is_read: true })
    .eq('id', req.params.id)
    .eq('user_id', dbUser.id)
  res.json({ ok: true })
})

// PUT /:id/arquivar
router.put('/:id/arquivar', authMiddleware, async (req, res) => {
  const dbUser = await getDbUser(req.authUser.id)
  if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })
  await supabaseAdmin.from('db_notificacao')
    .update({ is_archived: true })
    .eq('id', req.params.id)
    .eq('user_id', dbUser.id)
  res.json({ ok: true })
})

// DELETE /:id — exclui notificação permanentemente
router.delete('/:id', authMiddleware, async (req, res) => {
  const dbUser = await getDbUser(req.authUser.id)
  if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })
  await supabaseAdmin.from('db_notificacao')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', dbUser.id)
  res.json({ ok: true })
})

module.exports = router
