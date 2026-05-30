const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')

// GET /api/church — retorna dados da igreja do usuário logado
router.get('/', authMiddleware, async (req, res) => {
  const { data: dbUser } = await supabaseAdmin
    .from('db_user')
    .select('church_id')
    .eq('user_id', req.authUser.id)
    .single()

  if (!dbUser?.church_id) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data: church, error } = await supabaseAdmin
    .from('db_church')
    .select('*')
    .eq('id', dbUser.church_id)
    .single()

  if (error || !church) return res.status(404).json({ error: 'Igreja não encontrada' })

  res.json({ church })
})

// GET /api/church/public?slug= — dados públicos da igreja (sem auth)
router.get('/public', async (req, res) => {
  const { slug } = req.query
  if (!slug) return res.status(400).json({ error: 'Slug obrigatório' })

  const { data: church, error } = await supabaseAdmin
    .from('db_church')
    .select('name, logo_url, is_active')
    .eq('slug', slug.trim())
    .single()

  if (error || !church || !church.is_active) {
    return res.status(404).json({ error: 'Igreja não encontrada' })
  }

  res.json({ name: church.name, logo_url: church.logo_url })
})

module.exports = router
