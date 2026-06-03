// MÓDULO: voluntariado
const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')
const { dbError, serverError } = require('../lib/apiError') // SEC-006

// ── GET /api/dashboard/lider-departamento ──
router.get('/lider-departamento', authMiddleware, checkPermissao('escala', 'ver'), async (req, res) => {
  try {
    const churchId = req.churchId
    const userId   = req.dbUser.id
    const hoje     = (() => { const _d = new Date(); return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0') })()

    // 1. department_id do líder
    const { data: deptLiderRow } = await supabaseAdmin
      .from('db_department_lider')
      .select('department_id')
      .eq('user_id', userId)
      .eq('church_id', churchId)
      .limit(1)
      .maybeSingle()

    if (!deptLiderRow?.department_id) {
      return res.json({
        departamento: null,
        kpis: { voluntarios_ativos: 0, escalas_pendentes: 0, vagas_em_aberto: 0, proximo_evento: null },
        proximos_eventos: [],
        meus_voluntarios: [],
        alertas: []
      })
    }

    const meuDept = deptLiderRow.department_id

    // Nome do departamento
    const { data: deptInfo } = await supabaseAdmin
      .from('db_department')
      .select('id, name')
      .eq('id', meuDept)
      .maybeSingle()

    // 2. Queries paralelas ─────────────────────────────────────
    const [memberDeptResult, eventosResult, escalasResult] = await Promise.all([
      // member_ids ativos do departamento (status='ativo' exclui pendentes)
      supabaseAdmin
        .from('db_member_dept')
        .select('member_id')
        .eq('department_id', meuDept)
        .eq('status', 'ativo'),

      // TODOS os próximos eventos da igreja
      supabaseAdmin
        .from('db_event')
        .select('id, name, start_date, start_time, template_id')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .neq('status', 'cancelado')
        .gte('start_date', hoje)
        .order('start_date', { ascending: true })
        .limit(15),

      // Todas as escalas deste departamento
      supabaseAdmin
        .from('db_escala')
        .select('id, event_id, status')
        .eq('department_id', meuDept)
        .eq('church_id', churchId)
    ])

    // 3. DISTINCT em member_id — um membro pode ter várias funções no mesmo dept
    const membros_raw     = memberDeptResult.data || []
    const uniqueMemberIds = [...new Set(membros_raw.map(m => m.member_id))]
    const voluntariosAtivos = uniqueMemberIds.length   // Ryan (COORDENADOR + APOIO) = 1 pessoa

    const eventos = eventosResult.data || []
    const escalas = escalasResult.data || []

    // 4. Info dos membros — .in() com os IDs únicos
    let membros = []
    if (uniqueMemberIds.length) {
      const { data: membrosData } = await supabaseAdmin
        .from('db_member')
        .select('id, full_name, apelido, photo_url')
        .in('id', uniqueMemberIds)
        .eq('church_id', churchId)
      membros = membrosData || []
    }

    // Mapa escala por event_id
    const escalaByEvent = {}
    escalas.forEach(e => { escalaByEvent[e.event_id] = e })

    // 5. Itens de escala
    const escalaIds = escalas.map(e => e.id)
    let escalaItems = []
    if (escalaIds.length) {
      const { data } = await supabaseAdmin
        .from('db_escala_item')
        .select('id, escala_id, member_id, status')
        .in('escala_id', escalaIds)
        .eq('church_id', churchId)
      escalaItems = data || []
    }

    // 6. Próximo evento com escala para este dept
    const proxEvento = eventos.find(e => escalaByEvent[e.id])

    // 7. KPIs ─────────────────────────────────────────────────
    // escalas_pendentes: itens 'pendente' em eventos futuros
    const futurosSet   = new Set(eventos.map(e => e.id))
    const idsFuturas   = new Set(
      escalas.filter(e => futurosSet.has(e.event_id)).map(e => e.id)
    )
    const escalasPendentes = escalaItems.filter(
      i => idsFuturas.has(i.escala_id) && (i.status === 'pendente' || i.status === null)
    ).length

    // vagas_em_aberto: template vagas − escalados no próximo evento
    let vagasEmAberto = 0
    if (proxEvento) {
      const escala = escalaByEvent[proxEvento.id]
      let totalVagas = 0
      if (proxEvento.template_id) {
        const { data: tfRows } = await supabaseAdmin
          .from('db_template_funcao')
          .select('vagas')
          .eq('template_id', proxEvento.template_id)
          .eq('department_id', meuDept)
          .eq('church_id', churchId)
        totalVagas = (tfRows || []).reduce((s, r) => s + (r.vagas || 0), 0)
      }
      const escalados = escalaItems.filter(i => i.escala_id === escala.id).length
      vagasEmAberto   = Math.max(0, totalVagas - escalados)
    }

    // 8. Próximos eventos com lider_status ────────────────────
    const proximos_eventos = eventos.map(e => {
      const escala = escalaByEvent[e.id]
      let lider_status
      if (!escala) {
        lider_status = 'sem_dept'
      } else {
        const items = escalaItems.filter(i => i.escala_id === escala.id)
        if (escala.status === 'publicado') {
          lider_status = 'concluida'
        } else {
          lider_status = items.length > 0 ? 'em_andamento' : 'a_fazer'
        }
      }
      return { id: e.id, name: e.name, start_date: e.start_date, start_time: e.start_time, lider_status }
    })

    // 9. Meus voluntários + status no próximo evento ──────────
    let meus_voluntarios = []

    if (proxEvento) {
      const escalaProx   = escalaByEvent[proxEvento.id]
      const itensProx    = escalaItems.filter(i => i.escala_id === escalaProx.id)
      const memberStatus = {}
      itensProx.forEach(i => { memberStatus[i.member_id] = i.status })

      // Indisponibilidades para a data do próximo evento
      let indispMap = {}
      if (uniqueMemberIds.length) {
        const dt = proxEvento.start_date
        const { data: indispRows } = await supabaseAdmin
          .from('db_indisponibilidade')
          .select('member_id')
          .in('member_id', uniqueMemberIds)
          .eq('church_id', churchId)
          .or(
            `and(type.eq.data_unica,start_date.eq.${dt}),` +
            `and(type.eq.periodo,start_date.lte.${dt},end_date.gte.${dt}),` +
            `and(type.eq.departamento,department_id.eq.${meuDept},start_date.lte.${dt},end_date.gte.${dt})`
          )
        ;(indispRows || []).forEach(r => { indispMap[r.member_id] = true })
      }

      meus_voluntarios = membros.map(m => {
        const inEscala = m.id in memberStatus
        const st = memberStatus[m.id]
        let status_proximo_evento
        if      (st === 'confirmado' || st === 'presente')   status_proximo_evento = 'confirmado'
        else if (st === 'pendente' || (inEscala && !st))     status_proximo_evento = 'pendente'
        else if (st)                                          status_proximo_evento = 'indisponivel'
        else if (indispMap[m.id])                             status_proximo_evento = 'indisponivel'
        else                                                  status_proximo_evento = 'nao_escalado'
        return { id: m.id, full_name: m.full_name, apelido: m.apelido, photo_url: m.photo_url, status_proximo_evento }
      })
    } else {
      meus_voluntarios = membros.map(m => ({
        id: m.id, full_name: m.full_name, apelido: m.apelido, photo_url: m.photo_url,
        status_proximo_evento: 'nao_escalado'
      }))
    }

    // 10. Alertas ─────────────────────────────────────────────
    const alertas = []

    // Voluntários aguardando ativação no departamento
    const { data: pendDeptRows } = await supabaseAdmin
      .from('db_member_dept')
      .select('member_id')
      .eq('department_id', meuDept)
      .eq('church_id', churchId)
      .eq('status', 'pendente')
    const pendDeptCount = [...new Set((pendDeptRows || []).map(r => r.member_id))].length
    if (pendDeptCount > 0) {
      alertas.push({
        tipo: 'aguardando_ativacao',
        mensagem: `${pendDeptCount} voluntário${pendDeptCount > 1 ? 's' : ''} aguardando ativação no departamento`,
        link: '/voluntarios?filtro=pendentes'
      })
    }

    if (vagasEmAberto > 0 && proxEvento) {
      alertas.push({
        tipo: 'vagas_abertas',
        mensagem: `${vagasEmAberto} vaga${vagasEmAberto > 1 ? 's' : ''} em aberto para ${proxEvento.name}`
      })
    }

    meus_voluntarios
      .filter(v => v.status_proximo_evento === 'pendente')
      .forEach(v => {
        if (proxEvento) {
          const [yr, mo, da] = proxEvento.start_date.split('-')
          alertas.push({
            tipo: 'pendente_confirmacao',
            mensagem: `${v.apelido || v.full_name} não confirmou a escala de ${da}/${mo}/${yr}`
          })
        }
      })

    // Eventos futuros com escala não publicada para este departamento
    const eventosNaoPublicados = eventos.filter(e => {
      const esc = escalaByEvent[e.id]
      return !esc || esc.status !== 'publicado'
    })
    if (eventosNaoPublicados.length > 0) {
      const qtd = eventosNaoPublicados.length
      alertas.push({
        tipo: 'escala_nao_publicada',
        mensagem: `${qtd} evento${qtd > 1 ? 's' : ''} com escala ainda não publicada`,
        link: '/escalacoes'
      })
    }

    res.json({
      departamento: deptInfo,
      kpis: {
        voluntarios_ativos: voluntariosAtivos,
        escalas_pendentes:  escalasPendentes,
        vagas_em_aberto:    vagasEmAberto,
        proximo_evento:     proxEvento
          ? { name: proxEvento.name, start_date: proxEvento.start_date }
          : null
      },
      proximos_eventos,
      meus_voluntarios,
      alertas
    })

  } catch (err) {
    console.error('[GET /api/dashboard/lider-departamento]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

module.exports = router
