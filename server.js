require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet') // SEC-004: headers de segurança HTTP
const path = require('path')
const rateLimit = require('express-rate-limit') // SEC-002: rate limiting

const app = express()

// SEC-002: limitadores para endpoints críticos de autenticação
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // janela de 15 minutos
  max: 10,                   // máximo 10 tentativas por IP
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // janela de 1 hora
  max: 5,                    // máximo 5 envios de OTP por IP
  message: { error: 'Limite de envio de códigos atingido. Aguarde 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const cadastroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // janela de 1 hora
  max: 20,                   // máximo 20 cadastros por IP
  message: { error: 'Limite de cadastros atingido. Aguarde 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// SEC-004: headers de segurança HTTP via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:      ["'self'"],
      scriptSrc:       ["'self'", "'unsafe-inline'"],
      scriptSrcAttr:   ["'unsafe-inline'"],  // permite onclick/onX inline nos HTMLs
      styleSrc:        ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc:          ["'self'", "data:", "https://*.supabase.co"],
      fontSrc:         ["'self'", "https://fonts.gstatic.com", "https://use.typekit.net", "data:"],
      connectSrc:      ["'self'", "https://*.supabase.co"],
      frameAncestors:  ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // necessário para assets externos (fontes, imagens Supabase)
}))

// SEC-003: CORS restrito — adicione o domínio de produção em ALLOWED_ORIGINS antes do deploy
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // 'https://SEU-DOMINIO-PRODUCAO.com', // ← descomentar e preencher antes do deploy
]

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (ex: Postman, apps mobile, curl)
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    callback(new Error('Origem não permitida pelo CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))
app.use(express.json({ limit: '10mb' }))

// SEC-002: aplica limitadores antes do router de auth
app.use('/api/auth/login',    loginLimiter)
app.use('/api/auth/otp/send', otpLimiter)
app.use('/api/auth/cadastro', cadastroLimiter)
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
  }
  next()
})
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/user', require('./routes/user'))
app.use('/api/church', require('./routes/church'))
app.use('/api/ministry', require('./routes/ministry'))
app.use('/api/department', require('./routes/department'))
app.use('/api/funcao',      require('./routes/funcao'))
app.use('/api/voluntario', require('./routes/voluntario'))
app.use('/api/template',   require('./routes/template'))
app.use('/api/musica',     require('./routes/musica'))
app.use('/api/evento',     require('./routes/evento'))
// Public cronograma viewer — registered before the cronograma router to avoid
// Express 5 path-to-regexp conflicts with /:eventId wildcard routes inside the router
;(function () {
  const { supabaseAdmin } = require('./lib/supabase')
  const authMiddleware = require('./middleware/auth')

  app.get('/api/cronograma/evento/:eventId/itens', authMiddleware, async (req, res) => {
    try {
      const { data: dbUser } = await supabaseAdmin
        .from('db_user')
        .select('church_id')
        .eq('user_id', req.authUser.id)
        .single()

      if (!dbUser?.church_id) return res.status(404).json({ error: 'Igreja não encontrada' })
      const churchId = dbUser.church_id

      const { data: cronograma } = await supabaseAdmin
        .from('db_cronograma')
        .select('*')
        .eq('event_id', req.params.eventId)
        .eq('church_id', churchId)
        .maybeSingle()

      if (!cronograma) return res.json({ cronograma: null, itens: [] })

      const { data: itens, error } = await supabaseAdmin
        .from('db_cronograma_item')
        .select('*, musica:musica_id (id, title, artist, tom, bpm, duration)')
        .eq('cronograma_id', cronograma.id)
        .eq('church_id', churchId)
        .order('ordem', { ascending: true })

      if (error) return res.status(500).json({ error: error.message })
      res.json({ cronograma, itens: itens || [] })
    } catch (e) {
      console.error('[GET /api/cronograma/evento/:eventId/itens]', e)
      res.status(500).json({ error: 'Erro interno' })
    }
  })
})()

app.use('/api/cronograma',          require('./routes/cronograma'))
app.use('/api/disponibilidade',    require('./routes/disponibilidade'))
app.use('/api/indisponibilidade',  require('./routes/indisponibilidade'))
// Rota de equipe do líder — caminho exclusivo para evitar conflito com /:eventId do router
;(function () {
  const { supabaseAdmin } = require('./lib/supabase')
  const authMiddleware    = require('./middleware/auth')
  const checkPermissao    = require('./middleware/checkPermissao')

  app.get('/api/escala-equipe/:eventId', authMiddleware, checkPermissao('escala', 'ver'), async (req, res) => {
    try {
      const churchId = req.churchId
      const userId   = req.dbUser.id
      const eventId  = req.params.eventId
      console.log('[GET /api/escala-equipe] eventId=%s userId=%s church=%s', eventId, userId, churchId)

      const { data: deptLiderRow } = await supabaseAdmin
        .from('db_department_lider')
        .select('department_id')
        .eq('user_id', userId)
        .eq('church_id', churchId)
        .limit(1)
        .maybeSingle()

      if (!deptLiderRow?.department_id) return res.json({ departamento: null, funcoes: [] })
      const deptId = deptLiderRow.department_id

      const [{ data: deptInfo }, { data: evento }] = await Promise.all([
        supabaseAdmin.from('db_department').select('id, name').eq('id', deptId).maybeSingle(),
        supabaseAdmin.from('db_event').select('template_id').eq('id', eventId).eq('church_id', churchId).maybeSingle(),
      ])

      if (!evento) return res.status(404).json({ error: 'Evento não encontrado' })

      let templateFuncoes = []
      if (evento.template_id) {
        const [{ data: tfRows }, { data: funcRows }] = await Promise.all([
          supabaseAdmin.from('db_template_funcao').select('funcao_id, vagas')
            .eq('template_id', evento.template_id).eq('department_id', deptId).eq('church_id', churchId),
          supabaseAdmin.from('db_funcao_dept').select('id, name')
            .eq('department_id', deptId).eq('church_id', churchId).eq('is_active', true),
        ])
        const funcMap = Object.fromEntries((funcRows || []).map(f => [f.id, f.name]))
        templateFuncoes = (tfRows || []).map(tf => ({
          funcao_id:   tf.funcao_id,
          funcao_nome: funcMap[tf.funcao_id] || 'Função',
          vagas:       tf.vagas || 1,
        }))
      }

      const { data: escalaRow } = await supabaseAdmin
        .from('db_escala').select('id, status')
        .eq('event_id', eventId).eq('department_id', deptId).eq('church_id', churchId).maybeSingle()

      const escalaPublicada = escalaRow?.status === 'publicado'

      let itens = []
      if (escalaRow?.id) {
        const { data: rawItems } = await supabaseAdmin
          .from('db_escala_item').select('id, member_id, funcao_id, status')
          .eq('escala_id', escalaRow.id).eq('church_id', churchId)
        const memberIds = [...new Set((rawItems || []).map(i => i.member_id))]
        console.log('[escala-equipe] escalaId=%s items=%d memberIds=%j', escalaRow.id, (rawItems||[]).length, memberIds)
        let memberMap = {}
        if (memberIds.length) {
          const { data: membersDb } = await supabaseAdmin
            .from('db_member').select('id, full_name, nickname, photo_url').in('id', memberIds)
          ;(membersDb || []).forEach(m => { memberMap[m.id] = { ...m, apelido: m.nickname } })
        }
        itens = (rawItems || []).map(i => ({ ...i, member: memberMap[i.member_id] || null }))
      }

      const funcoes = templateFuncoes.map(tf => {
        const escalados = itens.filter(i => i.funcao_id === tf.funcao_id).map(i => {
          // Se a escala está publicada e o item ainda está pendente, exibe como "escalado"
          const statusEfetivo = (escalaPublicada && i.status === 'pendente') ? 'escalado' : (i.status || 'pendente')
          return {
            item_id:   i.id,
            member_id: i.member_id,
            full_name: i.member?.apelido || i.member?.full_name || 'Voluntário',
            photo_url: i.member?.photo_url || null,
            status:    statusEfetivo,
          }
        })
        return { funcao_id: tf.funcao_id, funcao_nome: tf.funcao_nome, vagas: tf.vagas,
                 escalados, vagas_abertas: Math.max(0, tf.vagas - escalados.length) }
      })

      res.json({ departamento: deptInfo, funcoes })
    } catch (err) {
      console.error('[GET /api/escala/:eventId/minha-equipe]', err)
      res.status(500).json({ error: 'Erro interno' })
    }
  })
})()

app.use('/api/escala',            require('./routes/escala'))
app.use('/api/lider',            require('./routes/lider'))
app.use('/api/dashboard',        require('./routes/dashboard'))
app.use('/api/notificacao',      require('./routes/notificacao'))
app.use('/api/checkin',          require('./routes/checkin'))
app.use('/api/local-checkin',    require('./routes/local-checkin'))

app.get('/checkin',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'checkin.html')))
app.get('/presenca', (req, res) => res.sendFile(path.join(__dirname, 'public', 'presenca.html')))

app.get('/cadastro', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cadastro.html')))

// Serve login como raiz
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')))
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')))
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')))
app.get('/editar-perfil', (req, res) => res.sendFile(path.join(__dirname, 'public', 'editar-perfil.html')))
app.get('/configuracoes', (req, res) => res.sendFile(path.join(__dirname, 'public', 'configuracoes.html')))
app.get('/ministerios', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ministerios.html')))
app.get('/ministerio/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ministerio-detalhe.html')))
app.get('/departamentos', (req, res) => res.sendFile(path.join(__dirname, 'public', 'departamentos.html')))
app.get('/departamento/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'departamento-detalhe.html')))
app.get('/voluntarios',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'voluntarios.html')))
app.get('/voluntario/:id',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'voluntario-detalhe.html')))
app.get('/musicas',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'musicas.html')))
app.get('/templates',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'templates.html')))
app.get('/template/:id',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'template-detalhe.html')))
app.get('/eventos', (req, res) => res.sendFile(path.join(__dirname, 'public', 'eventos.html')))
app.get('/evento/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'evento-detalhe.html')))
app.get('/cronograma/:eventId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cronograma.html')))
app.get('/escalacoes',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'escalacoes.html')))
app.get('/escalacao/:eventId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'escalacao.html')))
app.get('/indisponibilidade',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'indisponibilidade.html')))
app.get('/notificacoes',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'notificacoes.html')))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`))
