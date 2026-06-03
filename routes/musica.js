// MÓDULO: voluntariado
const router = require('express').Router()
const https  = require('https')
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')
const { dbError, serverError } = require('../lib/apiError') // SEC-006

function deezerSearch(q) {
  return new Promise((resolve, reject) => {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`
    https.get(url, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch(e) { reject(e) } })
    }).on('error', reject)
  })
}

// GET /api/musica/buscar?q=  — Deezer autocomplete proxy (must be before /:id)
router.get('/buscar', authMiddleware, checkPermissao('musica', 'ver'), async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q || q.length < 2) return res.json({ resultados: [] })
  try {
    const deezer = await deezerSearch(q)
    const resultados = (deezer.data || []).map(t => ({
      title:      t.title,
      artist:     t.artist?.name  || '',
      album:      t.album?.title  || '',
      duration:   t.duration      || null,
      deezer_url: t.link          || null,
    }))
    res.json({ resultados })
  } catch (e) {
    console.error('[musica buscar]', e.message)
    res.status(500).json({ error: 'Erro ao buscar na Deezer' })
  }
})

const FIELDS = 'id, title, artist, tom, bpm, duration, youtube_url, deezer_url, spotify_url, cifra_url, is_active, status, created_by'

// GET /api/musica?q=
router.get('/', authMiddleware, checkPermissao('musica', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const isVoluntario = req.dbUser.db_perfil?.slug === 'voluntario'
  const q = (req.query.q || '').trim()

  let query = supabaseAdmin
    .from('db_musica')
    .select(FIELDS)
    .eq('church_id', churchId)
    .order('title', { ascending: true })
    .limit(200)

  if (q) query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`)

  const { data, error } = await query
  if (error) { console.error('[musica GET]', error); return dbError(res, error, 'musica') }

  let musicas = data || []
  if (isVoluntario) {
    musicas = musicas.filter(m => m.is_active === true)
  }

  res.json({ musicas })
})

// GET /api/musica/:id
router.get('/:id', authMiddleware, checkPermissao('musica', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_musica')
    .select(FIELDS)
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .single()

  if (error) return res.status(404).json({ error: 'Música não encontrada' })
  res.json({ musica: data })
})

// POST /api/musica
router.post('/', authMiddleware, checkPermissao('musica', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const isVoluntario = req.dbUser.db_perfil?.slug === 'voluntario'
  const { title, artist, tom, bpm, duration, youtube_url, deezer_url, spotify_url } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'Título obrigatório' })

  const { data, error } = await supabaseAdmin
    .from('db_musica')
    .insert({
      church_id:   churchId,
      title:       title.trim(),
      artist:      artist?.trim()      || null,
      tom:         tom?.trim()         || null,
      bpm:         bpm                 || null,
      duration:    duration            || null,
      youtube_url: youtube_url?.trim() || null,
      deezer_url:  deezer_url?.trim()  || null,
      spotify_url: spotify_url?.trim() || null,
      cifra_url:   req.body.cifra_url?.trim() || null,
      is_active:   !isVoluntario,
      status:      isVoluntario ? 'pendente' : 'ativo',
      created_by:  req.dbUser.id,
    })
    .select(FIELDS)
    .single()

  if (error) { console.error('[musica POST]', error); return dbError(res, error, 'musica') }

  const musica = data

  // Dispara notificações para líderes de depts musicais (apenas quando é voluntário e entra como pendente)
  if (isVoluntario) {
    try {
      const { data: depts } = await supabaseAdmin
        .from('db_department')
        .select('id, ministry_id')
        .eq('church_id', req.churchId)
        .eq('is_music_dept', true)
        .eq('is_active', true)

      if (depts?.length > 0) {
        const [{ data: lideresDept }, { data: lideresMin }] = await Promise.all([
          supabaseAdmin.from('db_department_lider').select('user_id')
            .in('department_id', depts.map(d => d.id)).eq('church_id', req.churchId),
          supabaseAdmin.from('db_ministry_lider').select('user_id')
            .in('ministry_id', depts.map(d => d.ministry_id)).eq('church_id', req.churchId)
        ])
        const todosLideres = [...new Set([
          ...(lideresDept || []).map(l => l.user_id),
          ...(lideresMin || []).map(l => l.user_id)
        ])]
        if (todosLideres.length > 0) {
          await supabaseAdmin.from('db_notificacao').insert(
            todosLideres.map(userId => ({
              church_id:  req.churchId,
              user_id:    userId,
              tipo_id:    7,
              title:      'Nova música aguardando aprovação',
              body:       `${req.dbUser?.full_name || 'Um voluntário'} adicionou "${musica.title}" e aguarda aprovação`,
              action_url: `/musicas?id=${musica.id}`,
              is_read:    false
            }))
          )
        }
      }
    } catch (e) { console.error('[notif musica]', e) }
  }

  res.status(201).json({ musica })
})

// PUT /api/musica/:id/aprovar  — deve vir ANTES de /:id
router.put('/:id/aprovar', authMiddleware, checkPermissao('musica', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_musica')
    .update({ status: 'ativo', is_active: true })
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .select(FIELDS)
    .single()

  if (error) { console.error('[musica aprovar]', error); return dbError(res, error, 'musica') }
  if (!data) return res.status(404).json({ error: 'Música não encontrada' })
  res.json({ musica: data })
})

// PUT /api/musica/:id/rejeitar  — deve vir ANTES de /:id
router.put('/:id/rejeitar', authMiddleware, checkPermissao('musica', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_musica')
    .update({ status: 'rejeitado', is_active: false })
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .select(FIELDS)
    .single()

  if (error) { console.error('[musica rejeitar]', error); return dbError(res, error, 'musica') }
  if (!data) return res.status(404).json({ error: 'Música não encontrada' })
  res.json({ musica: data })
})

// PUT /api/musica/:id
router.put('/:id', authMiddleware, checkPermissao('musica', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { title, artist, tom, bpm, duration, youtube_url, deezer_url, spotify_url, cifra_url, is_active } = req.body
  const u = {}
  if (title       !== undefined) u.title       = title.trim()
  if (artist      !== undefined) u.artist      = artist?.trim()      || null
  if (tom         !== undefined) u.tom         = tom?.trim()         || null
  if (bpm         !== undefined) u.bpm         = bpm                 || null
  if (duration    !== undefined) u.duration    = duration            || null
  if (youtube_url !== undefined) u.youtube_url = youtube_url?.trim() || null
  if (deezer_url  !== undefined) u.deezer_url  = deezer_url?.trim()  || null
  if (spotify_url !== undefined) u.spotify_url = spotify_url?.trim() || null
  if (cifra_url   !== undefined) u.cifra_url   = cifra_url?.trim()   || null
  if (is_active   !== undefined) {
    u.is_active = is_active
    if (is_active === true) u.status = 'ativo'
  }

  const { data, error } = await supabaseAdmin
    .from('db_musica')
    .update(u)
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .select(FIELDS)
    .single()

  if (error) { console.error('[musica PUT]', error); return dbError(res, error, 'musica') }
  if (!data) return res.status(404).json({ error: 'Música não encontrada' })
  res.json({ musica: data })
})

// DELETE /api/musica/:id
router.delete('/:id', authMiddleware, checkPermissao('musica', 'excluir'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { error } = await supabaseAdmin
    .from('db_musica')
    .delete()
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) { console.error('[musica DELETE]', error); return dbError(res, error, 'musica') }
  res.json({ ok: true })
})

module.exports = router
