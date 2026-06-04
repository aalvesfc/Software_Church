// MÓDULO: core (sistema)
const router            = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware    = require('../middleware/auth')

const CHURCH_SISTEMA  = '00000000-0000-0000-0000-000000000001'
const BUCKET          = 'login-carousel'
const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/webp']

async function checkSistemaOwner(req, res, next) {
  try {
    const { data: dbUser } = await supabaseAdmin
      .from('db_user')
      .select('db_perfil:perfil_id(slug)')
      .eq('user_id', req.authUser.id)
      .limit(1)
      .maybeSingle()

    if (dbUser?.db_perfil?.slug !== 'sistema_owner') {
      return res.status(403).json({ error: 'Acesso negado' })
    }
    next()
  } catch (err) {
    console.error('[checkSistemaOwner carousel]', err)
    res.status(500).json({ error: 'Erro ao verificar acesso' })
  }
}

// ── GET /api/carousel — público (tela de login) ───────────────────────────────
router.get('/', async (req, res) => {
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
    console.error('[GET /api/carousel]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/carousel/:slideIndex — sistema_owner only ───────────────────────
router.put('/:slideIndex', authMiddleware, checkSistemaOwner, async (req, res) => {
  try {
    const slideIndex = parseInt(req.params.slideIndex, 10)
    if (![1, 2, 3].includes(slideIndex)) {
      return res.status(400).json({ error: 'slideIndex deve ser 1, 2 ou 3' })
    }

    const { frase, autor, cargo, is_active, foto_url: fotoUrlBody, foto_base64 } = req.body
    let foto_url = fotoUrlBody || null

    // Upload de imagem base64 → Supabase Storage
    if (foto_base64) {
      const matches = foto_base64.match(/^data:(image\/[\w+]+);base64,(.+)$/)
      if (!matches) {
        return res.status(400).json({ error: 'foto_base64 inválido' })
      }
      const mimeType = matches[1]
      const buffer   = Buffer.from(matches[2], 'base64')

      if (!ALLOWED_TYPES.includes(mimeType)) {
        return res.status(400).json({ error: 'Formato inválido. Use JPG, PNG ou WebP.' })
      }
      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'Imagem maior que 2 MB.' })
      }

      const ext      = mimeType.split('/')[1].replace('jpeg', 'jpg')
      const filePath = `slide-${slideIndex}-${Date.now()}.${ext}`

      // Garante que o bucket existe (ignorado se já criado)
      await supabaseAdmin.storage
        .createBucket(BUCKET, { public: true })
        .catch(() => {})

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(filePath, buffer, { contentType: mimeType, upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath)
      foto_url = urlData.publicUrl
    }

    const { error } = await supabaseAdmin
      .from('db_login_carousel')
      .upsert(
        {
          church_id:   CHURCH_SISTEMA,
          slide_index: slideIndex,
          foto_url,
          frase:       frase || null,
          autor:       autor || null,
          cargo:       cargo || null,
          is_active:   is_active !== false,
        },
        { onConflict: 'church_id,slide_index' }
      )

    if (error) throw error

    res.json({
      slide: { foto: foto_url, frase: frase || '', autor: autor || '', cargo: cargo || '' }
    })
  } catch (err) {
    console.error('[PUT /api/carousel/:slideIndex]', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
