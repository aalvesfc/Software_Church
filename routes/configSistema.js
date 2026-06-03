// MÓDULO: core — painel-sistema (sistema_owner only)
const express           = require('express')
const router            = express.Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware    = require('../middleware/auth')

const CHURCH_SISTEMA = '00000000-0000-0000-0000-000000000001'
const BUCKET         = 'login-carousel'

// Verifica se o usuário autenticado é sistema_owner
async function checkSistemaOwner(req, res, next) {
  try {
    const userId = req.authUser?.id
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' })
    }

    const { data: dbUser } = await supabaseAdmin
      .from('db_user')
      .select('db_perfil:perfil_id(slug)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (dbUser?.db_perfil?.slug !== 'sistema_owner') {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    next()
  } catch (err) {
    console.error('[checkSistemaOwner]', err)
    return res.status(500).json({ error: 'Erro ao verificar acesso' })
  }
}

// GET /api/config/sistema/login-carousel — pública (usada na tela de login)
router.get('/login-carousel', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('db_login_carousel')
      .select('slide_index, foto_url, frase, autor, cargo')
      .eq('church_id', CHURCH_SISTEMA)
      .eq('is_active', true)
      .order('slide_index')

    if (error) throw error

    const slides = [1, 2, 3].map(i => {
      const found = data?.find(s => s.slide_index === i)
      return {
        foto:  found?.foto_url || null,
        frase: found?.frase    || '',
        autor: found?.autor    || '',
        cargo: found?.cargo    || '',
      }
    })

    res.json({ slides })
  } catch (err) {
    console.error('[carousel GET]', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/config/sistema/login-carousel — sistema_owner only
router.post('/login-carousel', authMiddleware, checkSistemaOwner, async (req, res) => {
  try {
    const { slides } = req.body

    if (!Array.isArray(slides) || slides.length !== 3) {
      return res.status(400).json({ error: 'Envie exatamente 3 slides' })
    }

    const resultado = []

    for (let i = 0; i < 3; i++) {
      const slide      = slides[i]
      const slideIndex = i + 1
      let   foto_url   = slide.foto_atual || null

      if (slide.foto_base64) {
        const matches = slide.foto_base64.match(/^data:(image\/\w+);base64,(.+)$/)
        if (!matches) {
          return res.status(400).json({ error: `Slide ${slideIndex}: base64 inválido` })
        }

        const mimeType  = matches[1]
        const base64Str = matches[2]
        const buffer    = Buffer.from(base64Str, 'base64')

        if (buffer.length > 2 * 1024 * 1024) {
          return res.status(400).json({ error: `Slide ${slideIndex}: imagem maior que 2 MB` })
        }

        const allowed = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowed.includes(mimeType)) {
          return res.status(400).json({ error: `Slide ${slideIndex}: formato inválido` })
        }

        const ext      = mimeType.split('/')[1].replace('jpeg', 'jpg')
        const filePath = `slide-${slideIndex}-${Date.now()}.${ext}`

        const { error: uploadError } = await supabaseAdmin
          .storage
          .from(BUCKET)
          .upload(filePath, buffer, { contentType: mimeType, upsert: true })

        if (uploadError) throw uploadError

        const { data: urlData } = supabaseAdmin
          .storage
          .from(BUCKET)
          .getPublicUrl(filePath)

        foto_url = urlData.publicUrl
      }

      const { error: upsertError } = await supabaseAdmin
        .from('db_login_carousel')
        .upsert(
          {
            church_id:   CHURCH_SISTEMA,
            slide_index: slideIndex,
            foto_url,
            frase:       slide.frase || null,
            autor:       slide.autor || null,
            cargo:       slide.cargo || null,
          },
          { onConflict: 'church_id,slide_index' }
        )

      if (upsertError) throw upsertError

      resultado.push({ foto: foto_url })
    }

    res.json({ success: true, slides: resultado })
  } catch (err) {
    console.error('[carousel POST]', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
