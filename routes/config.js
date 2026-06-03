// MÓDULO: core (sistema)
const router = require('express').Router()
const { supabaseAdmin }      = require('../lib/supabase')
const authMiddleware         = require('../middleware/auth')
const { uploadCarouselPhoto } = require('../lib/uploadUtils')
const { dbError, serverError } = require('../lib/apiError')

const CONFIG_KEY = 'sistema_login_carousel'

// ── GET público — sem autenticação (usado na tela de login) ───────────────────
router.get('/sistema/login-carousel/public', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('db_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .limit(1)
      .maybeSingle()

    if (!data) return res.json({ slides: null })
    return res.json(JSON.parse(data.value))
  } catch (err) {
    return res.json({ slides: null })
  }
})

// ── GET autenticado — para carregar na página de configuração ─────────────────
router.get('/sistema/login-carousel', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('db_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .limit(1)
      .maybeSingle()

    if (!data) return res.json({ slides: null })
    return res.json(JSON.parse(data.value))
  } catch (err) {
    return serverError(res, err, 'sistema login-carousel GET')
  }
})

// ── POST — salva carrossel (somente sistema_owner) ────────────────────────────
router.post('/sistema/login-carousel', authMiddleware, async (req, res) => {
  try {
    // Verifica que é sistema_owner
    const { data: dbUser } = await supabaseAdmin
      .from('db_user')
      .select('id, church_id, db_perfil:perfil_id(slug)')
      .eq('user_id', req.authUser.id)
      .limit(1)
      .maybeSingle()

    if (dbUser?.db_perfil?.slug !== 'sistema_owner') {
      return res.status(403).json({ error: 'Acesso restrito ao dono do sistema' })
    }

    const { slides } = req.body
    if (!Array.isArray(slides) || slides.length !== 3) {
      return res.status(400).json({ error: 'Esperado array de 3 slides' })
    }

    const processed = []
    for (let i = 0; i < 3; i++) {
      const slide = slides[i]
      let fotoUrl = slide.foto_atual || ''

      if (slide.foto_base64) {
        const url = await uploadCarouselPhoto(slide.foto_base64, i + 1, 'sistema')
        if (url) fotoUrl = url
      }

      processed.push({
        frase: String(slide.frase || '').slice(0, 120),
        autor: String(slide.autor || '').slice(0, 50),
        cargo: String(slide.cargo || '').slice(0, 50),
        foto:  fotoUrl,
      })
    }

    const { error } = await supabaseAdmin
      .from('db_config')
      .upsert(
        { church_id: dbUser.church_id, key: CONFIG_KEY, value: JSON.stringify({ slides: processed }) },
        { onConflict: 'church_id,key' }
      )

    if (error) return dbError(res, error, 'sistema login-carousel')
    return res.json({ slides: processed })
  } catch (err) {
    return serverError(res, err, 'sistema login-carousel POST')
  }
})

module.exports = router
