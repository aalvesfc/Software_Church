// MÓDULO: voluntariado
const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')
const checkModulo = require('../middleware/checkModulo')
const { dbError, serverError } = require('../lib/apiError') // SEC-006

router.use(authMiddleware)
router.use(checkModulo('voluntariado'))

// ── GET / ── lista eventos com status de escala
router.get('/', authMiddleware, checkPermissao('escala', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data: eventos, error } = await supabaseAdmin
    .from('db_event')
    .select('id, name, start_date, start_time, status')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('start_date', { ascending: true })

  if (error) return dbError(res, error, 'escala')
  if (!eventos?.length) return res.json({ eventos: [] })

  const eventIds = eventos.map(e => e.id)
  // Inclui department_id e status para calcular lider_status
  const { data: escalas } = await supabaseAdmin
    .from('db_escala')
    .select('id, event_id, department_id, status')
    .in('event_id', eventIds)
    .eq('church_id', churchId)

  const escalaIds = (escalas || []).map(e => e.id)
  let itemCounts = {}
  if (escalaIds.length) {
    const { data: items } = await supabaseAdmin
      .from('db_escala_item')
      .select('escala_id')
      .in('escala_id', escalaIds)
      .eq('church_id', churchId)
    ;(items || []).forEach(i => { itemCounts[i.escala_id] = (itemCounts[i.escala_id] || 0) + 1 })
  }

  const escalaByEvent = {}
  ;(escalas || []).forEach(e => {
    if (!escalaByEvent[e.event_id]) escalaByEvent[e.event_id] = { count: 0, totalItems: 0 }
    escalaByEvent[e.event_id].count++
    escalaByEvent[e.event_id].totalItems += itemCounts[e.id] || 0
  })

  // Para líderes: calcula lider_status por evento com base nos departamentos que lidera
  const perfilSlug = req.dbUser.db_perfil?.slug

  if (perfilSlug === 'lider') {
    const { data: deptLider } = await supabaseAdmin
      .from('db_department_lider')
      .select('department_id')
      .eq('user_id', req.dbUser.id)
      .eq('church_id', churchId)

    const meusDepts = new Set((deptLider || []).map(d => d.department_id))

    return res.json({
      eventos: eventos.map(e => {
        const minhasEscalas = (escalas || []).filter(
          s => s.event_id === e.id && meusDepts.has(s.department_id)
        )

        let lider_status
        if (minhasEscalas.length === 0) {
          // Departamentos do líder não fazem parte deste evento
          lider_status = 'sem_dept'
        } else {
          const todasPublicadas = minhasEscalas.every(s => s.status === 'publicado')
          if (todasPublicadas) {
            lider_status = 'concluida'
          } else {
            const temItens = minhasEscalas.some(s => (itemCounts[s.id] || 0) > 0)
            lider_status = temItens ? 'em_andamento' : 'a_fazer'
          }
        }

        return { ...e, escala: escalaByEvent[e.id] || null, lider_status }
      })
    })
  }

  if (perfilSlug === 'lider_departamento') {
    // 1. Busca o departamento que o líder gerencia
    const { data: deptLiderRow } = await supabaseAdmin
      .from('db_department_lider')
      .select('department_id')
      .eq('user_id', req.dbUser.id)
      .eq('church_id', churchId)
      .limit(1)
      .maybeSingle()

    if (!deptLiderRow?.department_id) return res.json({ eventos: [] })
    const deptId = deptLiderRow.department_id

    // 2. Busca template_ids que contêm esse departamento
    const { data: tdRows } = await supabaseAdmin
      .from('db_template_dept')
      .select('template_id')
      .eq('department_id', deptId)
      .eq('church_id', churchId)

    const templateIds = (tdRows || []).map(r => r.template_id)
    console.log('[escala lider_dept] deptId=%s templateIds=%j', deptId, templateIds)
    if (!templateIds.length) return res.json({ eventos: [] })

    // 3. Busca eventos futuros com esses templates (data local, não UTC)
    const _d = new Date()
    const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`
    const { data: evLider, error: evLiderErr } = await supabaseAdmin
      .from('db_event')
      .select('id, name, start_date, start_time, status')
      .eq('church_id', churchId)
      .eq('is_active', true)
      .in('template_id', templateIds)
      .gte('start_date', today)
      .order('start_date', { ascending: true })

    console.log('[escala lider_dept] evLider count=%d (from=%s)', evLider?.length || 0, today)
    if (evLiderErr) return dbError(res, evLiderErr, 'escala')
    if (!evLider?.length) return res.json({ eventos: [] })

    const evLiderIds = evLider.map(e => e.id)

    // 4. Busca escalas desse departamento nesses eventos
    const { data: escLider } = await supabaseAdmin
      .from('db_escala')
      .select('id, event_id, status')
      .in('event_id', evLiderIds)
      .eq('department_id', deptId)
      .eq('church_id', churchId)

    const escByEvent = Object.fromEntries((escLider || []).map(e => [e.event_id, e]))

    // 5. Conta itens por escala
    const escLiderIds = (escLider || []).map(e => e.id)
    let itemCnts = {}
    if (escLiderIds.length) {
      const { data: liderItens } = await supabaseAdmin
        .from('db_escala_item')
        .select('escala_id')
        .in('escala_id', escLiderIds)
        .eq('church_id', churchId)
      ;(liderItens || []).forEach(i => { itemCnts[i.escala_id] = (itemCnts[i.escala_id] || 0) + 1 })
    }

    // 6. Calcula lider_status por evento
    return res.json({
      eventos: evLider.map(e => {
        const esc = escByEvent[e.id]
        let lider_status
        if (!esc) {
          lider_status = 'a_fazer'
        } else if (esc.status === 'publicado') {
          lider_status = 'concluida'
        } else {
          lider_status = (itemCnts[esc.id] || 0) > 0 ? 'em_andamento' : 'a_fazer'
        }
        return { ...e, lider_status }
      })
    })
  }

  res.json({ eventos: eventos.map(e => ({ ...e, escala: escalaByEvent[e.id] || null })) })
})

// ── GET /funcao/:funcaoId/tem-membros ── verifica se há itens de escala ativos para a função
router.get('/funcao/:funcaoId/tem-membros', authMiddleware, async (req, res) => {
  const { data: dbUser } = await supabaseAdmin
    .from('db_user')
    .select('church_id')
    .eq('user_id', req.authUser.id)
    .single()
  const churchId = dbUser?.church_id
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })
  const { data, error } = await supabaseAdmin
    .from('db_escala_item')
    .select('id')
    .eq('funcao_id', req.params.funcaoId)
    .eq('church_id', churchId)
    .neq('status', 'cancelado')
    .limit(1)
  if (error) return dbError(res, error, 'escala')
  res.json({ temMembros: (data || []).length > 0 })
})

// ── GET /meus-eventos ── eventos em que o voluntário logado está escalado
router.get('/meus-eventos', authMiddleware, async (req, res) => {
  // 1. Busca email e church_id pelo user_id autenticado
  const { data: dbUser } = await supabaseAdmin
    .from('db_user')
    .select('email, church_id')
    .eq('user_id', req.authUser.id)
    .single()

  if (!dbUser) return res.json({ eventos: [] })

  // 2. Busca o membro pelo email na mesma igreja
  const { data: dbMember } = await supabaseAdmin
    .from('db_member')
    .select('id')
    .eq('email', dbUser.email)
    .eq('church_id', dbUser.church_id)
    .single()

  if (!dbMember) return res.json({ eventos: [] })

  const { data: items, error } = await supabaseAdmin
    .from('db_escala_item')
    .select(`
      status,
      db_funcao_dept(name),
      db_escala(
        department_id,
        db_department(id, name),
        db_event(
          id, name, start_date, start_time, end_time, location, status
        )
      )
    `)
    .eq('member_id', dbMember.id)

  if (error) { console.error('[meus-eventos]', error); return dbError(res, error, 'escala') }

  const eventos = (items || [])
    .filter(i => i.db_escala?.db_event)
    .map(i => ({
      evento_id:       i.db_escala.db_event.id,
      evento_nome:     i.db_escala.db_event.name,
      evento_data:     i.db_escala.db_event.start_date,
      evento_hora:     i.db_escala.db_event.start_time || null,
      evento_hora_fim: i.db_escala.db_event.end_time   || null,
      evento_local:    i.db_escala.db_event.location   || null,
      evento_status:   i.db_escala.db_event.status,
      department_id:   i.db_escala.department_id         || null,
      department_name: i.db_escala.db_department?.name  || '',
      funcao_name:     i.db_funcao_dept?.name            || '',
      item_status:     i.status                          || null,
    }))
    .sort((a, b) => a.evento_data.localeCompare(b.evento_data))

  res.json({ eventos })
})

// ── GET /:eventId/bloqueios ── member_ids com indisponibilidade na data do evento
router.get('/:eventId/bloqueios', authMiddleware, checkPermissao('escala', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data: evento } = await supabaseAdmin
    .from('db_event')
    .select('start_date')
    .eq('id', req.params.eventId)
    .eq('church_id', churchId)
    .single()

  if (!evento?.start_date) return res.json({ bloqueios: [] })
  const eventDate = evento.start_date

  const { data, error } = await supabaseAdmin
    .from('db_indisponibilidade')
    .select('member_id, type, start_date, end_date')
    .eq('church_id', churchId)

  if (error) return dbError(res, error, 'escala')

  const bloqueados = (data || [])
    .filter(d => {
      if (d.type === 'data_unica') return d.start_date === eventDate
      return d.start_date <= eventDate && d.end_date >= eventDate
    })
    .map(d => d.member_id)

  res.json({ bloqueios: [...new Set(bloqueados)] })
})

// ── GET /:eventId ── estrutura completa da escala (cria registros db_escala se não existir)
router.get('/:eventId', authMiddleware, checkPermissao('escala', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data: evento } = await supabaseAdmin
    .from('db_event')
    .select('id, name, start_date, start_time, end_time, template_id, status')
    .eq('id', req.params.eventId)
    .eq('church_id', churchId)
    .single()

  if (!evento) return res.status(404).json({ error: 'Evento não encontrado' })

  // Monta estrutura de departamentos a partir do template
  let templateDepts = []
  if (evento.template_id) {
    const [{ data: depts }, { data: funcs }, { data: deptNames }, { data: funcNames }] = await Promise.all([
      supabaseAdmin.from('db_template_dept').select('department_id').eq('template_id', evento.template_id),
      supabaseAdmin.from('db_template_funcao').select('department_id, funcao_id, vagas').eq('template_id', evento.template_id),
      supabaseAdmin.from('db_department').select('id, name').eq('church_id', churchId),
      supabaseAdmin.from('db_funcao_dept').select('id, name, department_id').eq('church_id', churchId).eq('is_active', true),
    ])

    const deptMap = Object.fromEntries((deptNames || []).map(d => [d.id, d.name]))
    const funcMap = Object.fromEntries((funcNames || []).map(f => [f.id, { name: f.name }]))

    templateDepts = (depts || []).map(d => ({
      department_id:   d.department_id,
      department_name: deptMap[d.department_id] || 'Departamento',
      funcoes: (funcs || [])
        .filter(f => f.department_id === d.department_id)
        .map(f => ({
          funcao_id:   f.funcao_id,
          funcao_name: funcMap[f.funcao_id]?.name || 'Função',
          vagas:       f.vagas || 1,
        })),
    }))
  }

  // Garante que existe um db_escala para cada departamento do template
  const deptIds = templateDepts.map(d => d.department_id)
  let escalas = []
  if (deptIds.length) {
    // Primeiro: cria registros faltantes via upsert (ON CONFLICT DO NOTHING)
    await supabaseAdmin
      .from('db_escala')
      .upsert(
        deptIds.map(department_id => ({ event_id: req.params.eventId, church_id: churchId, department_id })),
        { onConflict: 'event_id,department_id', ignoreDuplicates: true }
      )

    // Depois: lê tudo de uma vez (incluindo status se existir)
    const { data: existing, error: selErr } = await supabaseAdmin
      .from('db_escala')
      .select('id, department_id, status')
      .eq('event_id', req.params.eventId)
      .eq('church_id', churchId)
      .in('department_id', deptIds)

    if (selErr) { console.error('[escala select]', selErr); return dbError(res, selErr, 'escala') }
    escalas = existing || []
  }

  const escalaByDept       = Object.fromEntries(escalas.map(e => [e.department_id, e.id]))
  const escalaStatusByDept = Object.fromEntries(escalas.map(e => [e.department_id, e.status || 'rascunho']))
  const escalaIds          = escalas.map(e => e.id)

  // Busca itens de todas as escalas
  let itens = []
  if (escalaIds.length) {
    const { data: rawItems } = await supabaseAdmin
      .from('db_escala_item')
      .select('id, escala_id, member_id, funcao_id, status, notes')
      .in('escala_id', escalaIds)
      .eq('church_id', churchId)

    const memberIds = [...new Set((rawItems || []).map(i => i.member_id))]
    let memberMap = {}
    if (memberIds.length) {
      const { data: members } = await supabaseAdmin
        .from('db_member')
        .select('id, full_name, nickname, photo_url')
        .in('id', memberIds)
      ;(members || []).forEach(m => { memberMap[m.id] = m })
    }
    itens = (rawItems || []).map(i => ({ ...i, member: memberMap[i.member_id] || null }))
  }

  // Injeta escala_id, status e itens em cada departamento
  const result = templateDepts.map(d => ({
    ...d,
    escala_id:     escalaByDept[d.department_id] || null,
    escala_status: escalaStatusByDept[d.department_id] || 'rascunho',
    itens:         itens.filter(i => i.escala_id === escalaByDept[d.department_id]),
  }))

  // Filtra departamentos para 'lider' e 'lider_departamento': mostra apenas os que ele lidera
  const perfilSlug = req.dbUser.db_perfil?.slug
  let templateDeptsResult = result

  if (perfilSlug === 'lider' || perfilSlug === 'lider_departamento') {
    const { data: deptLider } = await supabaseAdmin
      .from('db_department_lider')
      .select('department_id')
      .eq('user_id', req.dbUser.id)
      .eq('church_id', churchId)

    if ((deptLider?.length ?? 0) > 0) {
      const meusDepts = new Set(deptLider.map(d => d.department_id))
      templateDeptsResult = result.filter(d => meusDepts.has(d.department_id))
    } else {
      // líder sem departamentos atribuídos → array vazio (frontend mostrará aviso)
      templateDeptsResult = []
    }
  }

  // Status geral: publicado se todos os depts estiverem publicados
  const statusGeral = templateDeptsResult.length > 0 && templateDeptsResult.every(d => d.escala_status === 'publicado')
    ? 'publicado' : 'rascunho'

  res.json({ evento, templateDepts: templateDeptsResult, statusGeral })
})

// ── PUT /:eventId/status ── publica ou volta para rascunho todas as escalas do evento
router.put('/:eventId/status', authMiddleware, checkPermissao('escala', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { status } = req.body
  if (!['rascunho', 'publicado'].includes(status))
    return res.status(400).json({ error: 'Status inválido' })

  // lider_departamento: atualiza apenas a escala do seu departamento
  if (req.dbUser.db_perfil?.slug === 'lider_departamento') {
    const { data: deptRow } = await supabaseAdmin
      .from('db_department_lider')
      .select('department_id')
      .eq('user_id', req.dbUser.id)
      .eq('church_id', churchId)
      .limit(1)
      .maybeSingle()
    if (!deptRow?.department_id) return res.status(403).json({ error: 'Sem departamento atribuído' })
    const { error: dErr } = await supabaseAdmin
      .from('db_escala')
      .update({ status })
      .eq('event_id', req.params.eventId)
      .eq('department_id', deptRow.department_id)
      .eq('church_id', churchId)
    if (dErr) { console.error('[escala PUT status lider_dept]', dErr); return dbError(res, dErr, 'escala') }

    // Ao publicar: itens pendentes passam para "escalado"
    if (status === 'publicado') {
      const { data: escRow } = await supabaseAdmin
        .from('db_escala').select('id')
        .eq('event_id', req.params.eventId).eq('department_id', deptRow.department_id).eq('church_id', churchId).maybeSingle()
      if (escRow?.id) {
        await supabaseAdmin.from('db_escala_item')
          .update({ status: 'escalado' })
          .eq('escala_id', escRow.id).eq('church_id', churchId).eq('status', 'pendente')
      }
    }

    return res.json({ ok: true, status })
  }

  // Atualiza status de todas as escalas do evento
  const { error } = await supabaseAdmin
    .from('db_escala')
    .update({ status })
    .eq('event_id', req.params.eventId)
    .eq('church_id', churchId)

  if (error) { console.error('[escala PUT status]', error); return dbError(res, error, 'escala') }

  // Ao publicar: itens pendentes de todas as escalas passam para "escalado"
  if (status === 'publicado') {
    const { data: escalasDoEvento } = await supabaseAdmin
      .from('db_escala').select('id')
      .eq('event_id', req.params.eventId).eq('church_id', churchId)
    const escIds = (escalasDoEvento || []).map(e => e.id)
    if (escIds.length) {
      await supabaseAdmin.from('db_escala_item')
        .update({ status: 'escalado' })
        .in('escala_id', escIds).eq('church_id', churchId).eq('status', 'pendente')
    }
  }

  // Ao voltar para rascunho: itens "escalado" voltam para "pendente"
  if (status === 'rascunho') {
    const { data: escalasDoEvento } = await supabaseAdmin
      .from('db_escala').select('id')
      .eq('event_id', req.params.eventId).eq('church_id', churchId)
    const escIds = (escalasDoEvento || []).map(e => e.id)
    if (escIds.length) {
      await supabaseAdmin.from('db_escala_item')
        .update({ status: 'pendente' })
        .in('escala_id', escIds).eq('church_id', churchId).eq('status', 'escalado')
    }
  }

  // Ao publicar: notifica os voluntários escalados que tiverem conta no sistema
  if (status === 'publicado') {
    try {
      // Busca evento
      const { data: evento } = await supabaseAdmin
        .from('db_event').select('id, name').eq('id', req.params.eventId).single()

      // Busca todas as escalas do evento
      const { data: escalas } = await supabaseAdmin
        .from('db_escala').select('id').eq('event_id', req.params.eventId).eq('church_id', churchId)
      const escalaIds = (escalas || []).map(e => e.id)

      if (escalaIds.length) {
        // Busca itens escalados
        const { data: itens } = await supabaseAdmin
          .from('db_escala_item').select('escala_id, member_id')
          .in('escala_id', escalaIds).eq('church_id', churchId)

        if (itens?.length) {
          const memberIds = [...new Set(itens.map(i => i.member_id))]

          // Busca email dos membros
          const { data: members } = await supabaseAdmin
            .from('db_member').select('id, full_name, email').in('id', memberIds)

          const memberEmails = (members || []).filter(m => m.email).map(m => m.email)

          // Encontra db_user com os mesmos emails (voluntários com conta no sistema)
          let userMap = {}
          if (memberEmails.length) {
            const { data: users } = await supabaseAdmin
              .from('db_user').select('id, email').eq('church_id', churchId).in('email', memberEmails)
            ;(users || []).forEach(u => { userMap[u.email] = u.id })
          }

          const memberMap = Object.fromEntries((members || []).map(m => [m.id, m]))

          // Cria uma notificação por voluntário que tem conta
          const notifs = itens
            .map(item => {
              const member = memberMap[item.member_id]
              if (!member?.email) return null
              const userId = userMap[member.email]
              if (!userId) return null
              return {
                church_id:  churchId,
                user_id:    userId,
                tipo_id:    1,
                title:      'Você foi escalado!',
                body:       `Você foi escalado para o evento "${evento?.name || 'evento'}". Confirme sua presença.`,
                event_id:   req.params.eventId,
                member_id:  item.member_id,
                escala_id:  item.escala_id,
                is_read:    false,
              }
            })
            .filter(Boolean)

          if (notifs.length) {
            const { error: notifErr } = await supabaseAdmin.from('db_notificacao').insert(notifs)
            if (notifErr) console.error('[escala notificacao]', notifErr)
          }
        }
      }
    } catch (notifEx) {
      console.error('[escala notificacao exception]', notifEx)
    }
  }

  res.json({ ok: true, status })
})

// ── POST /:escalaId/item ── adiciona voluntário à escala de um departamento
router.post('/:escalaId/item', authMiddleware, checkPermissao('escala', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { member_id, funcao_id, notes } = req.body
  if (!member_id) return res.status(400).json({ error: 'member_id obrigatório' })

  const { data: escala } = await supabaseAdmin
    .from('db_escala')
    .select('id, event_id, department_id')
    .eq('id', req.params.escalaId)
    .eq('church_id', churchId)
    .single()

  if (!escala) return res.status(404).json({ error: 'Escala não encontrada' })

  // Verifica duplicidade: mesmo voluntário na mesma função desta escala
  const { data: dup } = await supabaseAdmin
    .from('db_escala_item')
    .select('id')
    .eq('escala_id', escala.id)
    .eq('member_id', member_id)
    .eq('funcao_id', funcao_id || null)

  if (dup?.length) return res.status(409).json({ error: 'Voluntário já escalado nesta função' })

  // Verifica indisponibilidade
  const { data: evento } = await supabaseAdmin
    .from('db_event').select('start_date').eq('id', escala.event_id).single()

  let indisponivel = false
  if (evento?.start_date) {
    const d = evento.start_date
    const deptId = escala.department_id
    const { data: indisp } = await supabaseAdmin
      .from('db_indisponibilidade')
      .select('id')
      .eq('member_id', member_id)
      .eq('church_id', churchId)
      .or(
        `and(type.eq.data_unica,start_date.eq.${d}),` +
        `and(type.eq.periodo,start_date.lte.${d},end_date.gte.${d}),` +
        `and(type.eq.departamento,department_id.eq.${deptId},start_date.lte.${d},end_date.gte.${d})`
      )
    indisponivel = (indisp?.length || 0) > 0
  }

  const { data: item, error } = await supabaseAdmin
    .from('db_escala_item')
    .insert({ escala_id: escala.id, church_id: churchId, member_id, funcao_id: funcao_id || null, notes: notes || null, status: 'pendente' })
    .select()
    .single()

  if (error) { console.error('[escala_item POST]', error); return dbError(res, error, 'escala') }

  const { data: member } = await supabaseAdmin
    .from('db_member').select('id, full_name, nickname, photo_url').eq('id', member_id).single()

  res.status(201).json({ item: { ...item, member: member || null }, indisponivel })
})

// ── POST /:eventId/automatica ── preenche slots vazios com voluntários disponíveis
router.post('/:eventId/automatica', authMiddleware, checkPermissao('escala', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data: evento } = await supabaseAdmin
    .from('db_event')
    .select('id, name, start_date, start_time, end_time, template_id')
    .eq('id', req.params.eventId)
    .eq('church_id', churchId)
    .single()
  if (!evento) return res.status(404).json({ error: 'Evento não encontrado' })
  if (!evento.template_id) return res.status(400).json({ error: 'Evento sem template vinculado' })

  // Estrutura do template
  const [{ data: depts }, { data: funcs }, { data: deptNames }, { data: funcNames }] = await Promise.all([
    supabaseAdmin.from('db_template_dept').select('department_id').eq('template_id', evento.template_id),
    supabaseAdmin.from('db_template_funcao').select('department_id, funcao_id, vagas').eq('template_id', evento.template_id),
    supabaseAdmin.from('db_department').select('id, name').eq('church_id', churchId),
    supabaseAdmin.from('db_funcao_dept').select('id, name').eq('church_id', churchId).eq('is_active', true),
  ])

  const deptMap = Object.fromEntries((deptNames || []).map(d => [d.id, d.name]))
  const funcMap = Object.fromEntries((funcNames || []).map(f => [f.id, f.name]))
  const deptIds = (depts || []).map(d => d.department_id)

  // Garante escalas por departamento via upsert (ON CONFLICT DO NOTHING)
  await supabaseAdmin
    .from('db_escala')
    .upsert(
      deptIds.map(department_id => ({ event_id: req.params.eventId, church_id: churchId, department_id })),
      { onConflict: 'event_id,department_id', ignoreDuplicates: true }
    )
  const { data: escalasData } = await supabaseAdmin
    .from('db_escala').select('id, department_id')
    .eq('event_id', req.params.eventId).eq('church_id', churchId).in('department_id', deptIds)
  let escalas = escalasData || []
  const escalaByDept = Object.fromEntries(escalas.map(e => [e.department_id, e.id]))
  const escalaIds    = escalas.map(e => e.id)

  // Itens já existentes
  const { data: existingItems } = await supabaseAdmin
    .from('db_escala_item').select('id, escala_id, member_id, funcao_id, status')
    .in('escala_id', escalaIds).eq('church_id', churchId)
  const itemsByEscala = {}
  ;(existingItems || []).forEach(i => { if (!itemsByEscala[i.escala_id]) itemsByEscala[i.escala_id] = []; itemsByEscala[i.escala_id].push(i) })

  // Indisponibilidades na data do evento
  let indispMembers = new Set()
  if (evento.start_date) {
    const d = evento.start_date
    const { data: indisps } = await supabaseAdmin
      .from('db_indisponibilidade').select('member_id, department_id, type, start_date, end_date')
      .eq('church_id', churchId)
      .or(`and(type.eq.data_unica,start_date.eq.${d}),and(type.eq.periodo,start_date.lte.${d},end_date.gte.${d}),type.eq.departamento`)
    ;(indisps || []).forEach(i => {
      if (i.type === 'data_unica' || i.type === 'periodo') {
        indispMembers.add(`${i.member_id}:*`)
      } else if (i.type === 'departamento' && i.start_date <= d && i.end_date >= d) {
        indispMembers.add(`${i.member_id}:${i.department_id}`)
      }
    })
  }

  // Voluntários por departamento
  const { data: membros } = await supabaseAdmin
    .from('db_member_dept').select('member_id, department_id, funcao_id')
    .eq('church_id', churchId).eq('status', 'ativo').in('department_id', deptIds)

  const volsByDept = {}
  ;(membros || []).forEach(m => { if (!volsByDept[m.department_id]) volsByDept[m.department_id] = []; volsByDept[m.department_id].push(m) })

  // Preenche slots vazios — um voluntário só pode aparecer uma vez no evento inteiro
  const toInsert = []
  const escaladosNoEvento = new Set((existingItems || []).map(i => i.member_id))

  for (const dept of (depts || [])) {
    const deptId   = dept.department_id
    const escalaId = escalaByDept[deptId]
    if (!escalaId) continue
    const jaEscaladosDept = new Set((itemsByEscala[escalaId] || []).map(i => i.member_id))
    const disponíveis = (volsByDept[deptId] || []).filter(v =>
      !escaladosNoEvento.has(v.member_id) &&
      !indispMembers.has(`${v.member_id}:*`) &&
      !indispMembers.has(`${v.member_id}:${deptId}`)
    )

    const funcoesDept = (funcs || []).filter(f => f.department_id === deptId)
    for (const funcao of funcoesDept) {
      const jaNestaFuncao = (itemsByEscala[escalaId] || []).filter(i => i.funcao_id === funcao.funcao_id).length
      const vagas = funcao.vagas || 1
      let slots = vagas - jaNestaFuncao
      if (slots <= 0) continue

      // Preferência: voluntários com funcao_id correspondente, depois qualquer disponível
      const candidatos = [
        ...disponíveis.filter(v => v.funcao_id === funcao.funcao_id),
        ...disponíveis.filter(v => v.funcao_id !== funcao.funcao_id),
      ]
      for (const cand of candidatos) {
        if (slots <= 0) break
        if (escaladosNoEvento.has(cand.member_id)) continue
        toInsert.push({ escala_id: escalaId, church_id: churchId, member_id: cand.member_id, funcao_id: funcao.funcao_id, status: 'pendente' })
        escaladosNoEvento.add(cand.member_id)
        slots--
      }
    }
  }

  if (toInsert.length) {
    const { error: insErr } = await supabaseAdmin.from('db_escala_item').insert(toInsert)
    if (insErr) { console.error('[escala automatica]', insErr); return dbError(res, insErr, 'escala') }
  }

  // Retorna estrutura atualizada (reutiliza lógica do GET)
  const { data: allItems } = await supabaseAdmin
    .from('db_escala_item').select('id, escala_id, member_id, funcao_id, status, notes')
    .in('escala_id', escalaIds).eq('church_id', churchId)

  const memberIds = [...new Set((allItems || []).map(i => i.member_id))]
  let memberMap = {}
  if (memberIds.length) {
    const { data: members } = await supabaseAdmin.from('db_member').select('id, full_name, nickname, photo_url').in('id', memberIds)
    ;(members || []).forEach(m => { memberMap[m.id] = m })
  }
  const itensEnriquecidos = (allItems || []).map(i => ({ ...i, member: memberMap[i.member_id] || null }))

  const templateDepts = (depts || []).map(d => ({
    department_id:   d.department_id,
    department_name: deptMap[d.department_id] || 'Departamento',
    escala_id:       escalaByDept[d.department_id] || null,
    funcoes: (funcs || []).filter(f => f.department_id === d.department_id).map(f => ({
      funcao_id:   f.funcao_id,
      funcao_name: funcMap[f.funcao_id] || 'Função',
      vagas:       f.vagas || 1,
    })),
    itens: itensEnriquecidos.filter(i => i.escala_id === escalaByDept[d.department_id]),
  }))

  res.json({ templateDepts, adicionados: toInsert.length })
})

// ── DELETE /:escalaId/item/:itemId ── remove voluntário
router.delete('/:escalaId/item/:itemId', authMiddleware, checkPermissao('escala', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { error } = await supabaseAdmin
    .from('db_escala_item')
    .delete()
    .eq('id', req.params.itemId)
    .eq('escala_id', req.params.escalaId)
    .eq('church_id', churchId)

  if (error) { console.error('[escala_item DELETE]', error); return dbError(res, error, 'escala') }
  res.json({ ok: true })
})

module.exports = router
