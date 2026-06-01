const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')

function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

async function getDbUser(userId) {
  const { data } = await supabaseAdmin.from('db_user')
    .select('id, church_id, full_name, email')
    .eq('user_id', userId).single()
  if (!data) return null
  const { data: member } = await supabaseAdmin.from('db_member')
    .select('id')
    .eq('church_id', data.church_id)
    .eq('email', data.email)
    .maybeSingle()
  return { ...data, member_id: member?.id || null }
}

// GET /api/checkin/meu-evento
// Busca o evento do dia em que o voluntário está escalado
router.get('/meu-evento', authMiddleware, async (req, res) => {
  try {
    const dbUser = await getDbUser(req.authUser.id)
    if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })
    if (!dbUser.member_id) return res.json({ evento: null, checkin: null })

    const hoje = new Date().toISOString().split('T')[0]

    // Busca eventos de hoje em que o voluntário está escalado
    const { data: escalas } = await supabaseAdmin
      .from('db_escala_item')
      .select('escala_id, escala:escala_id(event_id, db_event:event_id(id, name, start_date, start_time, status))')
      .eq('member_id', dbUser.member_id)
      .eq('church_id', dbUser.church_id)
      .neq('status', 'cancelado')

    if (!escalas?.length) return res.json({ evento: null, checkin: null })

    // Filtra eventos de hoje
    const eventosHoje = escalas
      .map(e => e.escala?.db_event)
      .filter(ev => ev && ev.start_date === hoje)

    if (!eventosHoje.length) return res.json({ evento: null, checkin: null })

    const evento = eventosHoje[0]

    // Busca check-in existente
    const { data: checkin } = await supabaseAdmin
      .from('db_checkin')
      .select('*')
      .eq('member_id', dbUser.member_id)
      .eq('event_id', evento.id)
      .eq('church_id', dbUser.church_id)
      .maybeSingle()

    // Busca local de check-in ativo
    const { data: local } = await supabaseAdmin
      .from('db_local_checkin')
      .select('*')
      .eq('church_id', dbUser.church_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    // Busca configurações de check-in da igreja (db_config, chaves key-value)
    const { data: cfgRows } = await supabaseAdmin
      .from('db_config')
      .select('key, value')
      .eq('church_id', dbUser.church_id)
      .in('key', ['checkin_geolocalizacao', 'checkin_tolerancia_min'])

    const churchConfig = Object.fromEntries((cfgRows || []).map(r => [r.key, r.value]))
    res.json({ evento, checkin, local, config: churchConfig })
  } catch (e) {
    console.error('[checkin/meu-evento]', e)
    res.status(500).json({ error: e.message })
  }
})

// POST /api/checkin
router.post('/', authMiddleware, async (req, res) => {
  try {
    const dbUser = await getDbUser(req.authUser.id)
    if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })
    if (!dbUser.member_id) {
      console.warn('[checkin POST] 403 sem member_id — email:', dbUser.email)
      return res.status(403).json({ error: 'Você não está cadastrado como voluntário nesta igreja' })
    }

    const { event_id, latitude, longitude, method = 'manual' } = req.body
    if (!event_id) return res.status(400).json({ error: 'event_id obrigatório' })

    // Verifica se está escalado: parte do member_id → db_escala_item → db_escala.event_id
    // (mesmo padrão do /api/user/eventos-escalados, que é a fonte de verdade do dashboard)
    const { data: itensDoMembro } = await supabaseAdmin
      .from('db_escala_item')
      .select('id, escala:escala_id(id, event_id)')
      .eq('member_id', dbUser.member_id)
      .eq('church_id', dbUser.church_id)
      .neq('status', 'substituido')

    const escalaItem = (itensDoMembro || []).find(i => i.escala?.event_id === event_id)

    if (!escalaItem) {
      console.warn('[checkin POST] 403 não escalado — member_id:', dbUser.member_id,
        'event_id:', event_id, 'itens encontrados:', itensDoMembro?.length,
        'event_ids:', (itensDoMembro || []).map(i => i.escala?.event_id))
      return res.status(403).json({ error: 'Você não está escalado neste evento' })
    }

    // Busca evento e config em paralelo — config vem de db_config (chaves key-value)
    const [{ data: evento }, { data: cfgRows }] = await Promise.all([
      supabaseAdmin.from('db_event').select('id, start_date, start_time').eq('id', event_id).single(),
      supabaseAdmin.from('db_config').select('key, value').eq('church_id', dbUser.church_id)
        .in('key', ['checkin_geolocalizacao', 'checkin_antecedencia_min', 'checkin_tolerancia_min'])
    ])
    const config = Object.fromEntries((cfgRows || []).map(r => [r.key, r.value]))

    if (!evento) return res.status(404).json({ error: 'Evento não encontrado' })

    // 1. Validação de data
    const hoje = new Date().toISOString().split('T')[0]
    if (evento.start_date !== hoje) {
      console.warn('[checkin POST] 403 data errada — evento:', evento.start_date, 'hoje:', hoje)
      return res.status(403).json({ error: 'Check-in só pode ser feito no dia do evento' })
    }

    // 2. Validação de horário (janela de antecedência e tolerância)
    if (evento.start_time) {
      const antecedencia = parseInt(config?.checkin_antecedencia_min || '120')
      const tolerancia   = parseInt(config?.checkin_tolerancia_min   || '15')
      const agora        = new Date()
      const inicioEvento    = new Date(`${evento.start_date}T${evento.start_time}`)
      const aberturaCheckin = new Date(inicioEvento.getTime() - antecedencia * 60000)

      if (agora < aberturaCheckin) {
        const hora = aberturaCheckin.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        return res.status(403).json({ error: `Check-in disponível a partir das ${hora}` })
      }
    }

    // 3. Validação de GPS
    const geoAtivo = config?.checkin_geolocalizacao === true || config?.checkin_geolocalizacao === 'true'
    if (geoAtivo) {
      if (!latitude || !longitude) {
        return res.status(403).json({ error: 'Localização GPS necessária para check-in' })
      }
      const { data: locais } = await supabaseAdmin
        .from('db_local_checkin')
        .select('*')
        .eq('church_id', dbUser.church_id)
        .eq('is_active', true)

      if (!locais?.length) {
        return res.status(403).json({ error: 'Nenhum local de check-in configurado' })
      }

      const distancias = locais.map(local => {
        const dist = calcularDistancia(
          parseFloat(latitude), parseFloat(longitude),
          parseFloat(local.latitude), parseFloat(local.longitude)
        )
        console.log('[checkin GPS] local=%s raio=%dm distancia=%dm lat_local=%s lng_local=%s lat_user=%s lng_user=%s',
          local.name, local.raio_metros, Math.round(dist),
          local.latitude, local.longitude, latitude, longitude)
        return dist <= parseFloat(local.raio_metros)
      })

      const dentroDoRaio = distancias.some(Boolean)

      if (!dentroDoRaio) {
        return res.status(403).json({ error: 'Você está fora do local permitido para check-in' })
      }
    }

    // 4. Determina status
    const agora = new Date()
    const inicioEvento = evento.start_time ? new Date(`${evento.start_date}T${evento.start_time}`) : null
    const status = (inicioEvento && agora > inicioEvento) ? 'atrasado' : 'presente'

    // Upsert check-in
    const payload = {
      church_id:      dbUser.church_id,
      member_id:      dbUser.member_id,
      event_id,
      checkin_at:     new Date().toISOString(),
      checkin_lat:    latitude  || null,
      checkin_lng:    longitude || null,
      checkin_method: method,
      status
    }
    console.log('[checkin POST] payload:', JSON.stringify(payload))

    const { data: checkin, error } = await supabaseAdmin
      .from('db_checkin')
      .upsert(payload, { onConflict: 'member_id,event_id', ignoreDuplicates: false })
      .select().single()

    if (error) { console.error('[checkin POST] upsert error:', JSON.stringify(error)); return res.status(500).json({ error: error.message }) }
    console.log('[checkin POST] saved:', JSON.stringify(checkin))
    res.json({ checkin })
  } catch (e) {
    console.error('[checkin POST]', e)
    res.status(500).json({ error: e.message })
  }
})

// POST /api/checkin/checkout
router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    const dbUser = await getDbUser(req.authUser.id)
    if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })
    if (!dbUser.member_id) return res.status(403).json({ error: 'Você não está cadastrado como voluntário nesta igreja' })

    const { event_id, latitude, longitude, method = 'manual' } = req.body
    if (!event_id) return res.status(400).json({ error: 'event_id obrigatório' })

    const { data, error } = await supabaseAdmin
      .from('db_checkin')
      .update({
        checkout_at: new Date().toISOString(),
        checkout_lat: latitude || null,
        checkout_lng: longitude || null,
        checkout_method: method,
        status: 'saiu'
      })
      .eq('member_id', dbUser.member_id)
      .eq('event_id', event_id)
      .eq('church_id', dbUser.church_id)
      .select().single()

    if (error) return res.status(500).json({ error: error.message })
    res.json({ checkin: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/checkin/presenca/:eventId
router.get('/presenca/:eventId', authMiddleware, async (req, res) => {
  try {
    const dbUser = await getDbUser(req.authUser.id)
    if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })

    const { data: dbUserFull } = await supabaseAdmin
      .from('db_user')
      .select('perfil:perfil_id(slug)')
      .eq('user_id', req.authUser.id).single()

    const perfil = dbUserFull?.perfil?.slug
    const isLider = perfil === 'lider' || perfil === 'lider_departamento'

    // Busca escala do evento
    const { data: escalas } = await supabaseAdmin
      .from('db_escala')
      .select('id')
      .eq('event_id', req.params.eventId)
      .eq('church_id', dbUser.church_id)

    if (!escalas?.length) return res.json({ itens: [] })

    const escalaIds = escalas.map(e => e.id)

    let query = supabaseAdmin
      .from('db_escala_item')
      .select(`
        id, member_id, funcao_id, status, escala_id,
        membro:member_id(id, full_name, email),
        funcao:funcao_id(id, name, department_id, db_department:department_id(id, name))
      `)
      .in('escala_id', escalaIds)
      .eq('church_id', dbUser.church_id)
      .neq('status', 'cancelado')

    // Líder filtra por departamento
    if (isLider) {
      const { data: deptLider } = await supabaseAdmin
        .from('db_department_lider')
        .select('department_id')
        .eq('user_id', dbUser.id)
        .eq('church_id', dbUser.church_id)
        .limit(1).maybeSingle()

      if (deptLider?.department_id) {
        const { data: funcoesDoDepto } = await supabaseAdmin
          .from('db_funcao_dept')
          .select('id')
          .eq('department_id', deptLider.department_id)
          .eq('church_id', dbUser.church_id)
        const ids = (funcoesDoDepto || []).map(f => f.id)
        if (ids.length) query = query.in('funcao_id', ids)
      }
    }

    const { data: itens, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Busca check-ins
    const memberIds = (itens || []).map(i => i.member_id).filter(Boolean)
    const { data: checkins } = memberIds.length
      ? await supabaseAdmin.from('db_checkin')
          .select('*')
          .eq('event_id', req.params.eventId)
          .eq('church_id', dbUser.church_id)
          .in('member_id', memberIds)
      : { data: [] }

    const checkinMap = {}
    ;(checkins || []).forEach(c => { checkinMap[c.member_id] = c })

    const resultado = (itens || []).map(item => ({
      ...item,
      checkin: checkinMap[item.member_id] || null
    }))

    res.json({ itens: resultado })
  } catch (e) {
    console.error('[checkin/presenca]', e)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/checkin/eventos-hoje — lista eventos de hoje para selector da presença
router.get('/eventos-hoje', authMiddleware, async (req, res) => {
  try {
    const dbUser = await getDbUser(req.authUser.id)
    if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })

    const hoje = new Date().toISOString().split('T')[0]

    const { data: eventos, error } = await supabaseAdmin
      .from('db_event')
      .select('id, name, start_time, status')
      .eq('church_id', dbUser.church_id)
      .eq('start_date', hoje)
      .neq('status', 'cancelado')
      .order('start_time', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ eventos: eventos || [] })
  } catch (e) {
    console.error('[checkin/eventos-hoje]', e)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
