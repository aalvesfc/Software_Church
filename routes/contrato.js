// MÓDULO: core (sistema)
const router          = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware  = require('../middleware/auth')
const { dbError, serverError } = require('../lib/apiError')

const CHURCH_SISTEMA = '00000000-0000-0000-0000-000000000001'

// ── Guard: apenas sistema_owner ───────────────────────────────────────────────
// Nota: /api/contrato está em ROTAS_LIBERADAS do authMiddleware (para que o
// sistema_owner acesse sem contrato próprio). Por isso req.dbUser pode ser null
// aqui — ownerGuard faz sua própria busca por perfil_slug.
async function ownerGuard(req, res, next) {
  try {
    const userId = req.authUser?.id
    if (!userId) return res.status(401).json({ error: 'Não autenticado' })

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
  } catch (e) {
    return serverError(res, e, 'ownerGuard')
  }
}

// ── Job: atualiza status de contratos vencidos/bloqueados ─────────────────────
async function rodarJobInadimplencia() {
  const hoje = new Date().toISOString().split('T')[0]

  await supabaseAdmin
    .from('db_contrato')
    .update({ status: 'inadimplente' })
    .eq('status', 'ativo')
    .lt('vencimento_em', hoje)

  await supabaseAdmin
    .from('db_contrato')
    .update({ status: 'bloqueado' })
    .eq('status', 'inadimplente')
    .lt('bloqueio_em', hoje)
}

// ── GET /api/contrato/modulos ── lista todos os módulos disponíveis ───────────
// (registrado antes de /:churchId para não ser capturado como parâmetro)
router.get('/modulos', authMiddleware, ownerGuard, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('db_modulo')
      .select('id, name, slug, description')
      .eq('is_active', true)
      .order('name')

    if (error) return dbError(res, error, 'modulos GET')
    res.json({ modulos: data || [] })
  } catch (e) {
    return serverError(res, e, 'modulos GET')
  }
})

// ── POST /api/contrato/job-inadimplencia ── dispara job manualmente ──────────
router.post('/job-inadimplencia', authMiddleware, ownerGuard, async (req, res) => {
  try {
    await rodarJobInadimplencia()
    res.json({ ok: true })
  } catch (e) {
    return serverError(res, e, 'job-inadimplencia')
  }
})

// ── GET /api/contrato ── lista igrejas com contratos e módulos ────────────────
router.get('/', authMiddleware, ownerGuard, async (req, res) => {
  try {

    // Busca todas as igrejas exceto a virtual do sistema
    const { data: igrejas, error: cErr } = await supabaseAdmin
      .from('db_church')
      .select('id, name, slug, logo_url, is_active')
      .neq('id', CHURCH_SISTEMA)
      .order('name')

    if (cErr) return dbError(res, cErr, 'contrato GET churches')

    const churchIds = (igrejas || []).map(c => c.id)
    if (!churchIds.length) return res.json({ igrejas: [] })

    // Busca contratos de todas as igrejas de uma vez
    const { data: contratos } = await supabaseAdmin
      .from('db_contrato')
      .select('id, church_id, status, periodicidade, inicio_em, vencimento_em, bloqueio_em, valor')
      .in('church_id', churchIds)

    const contratoMap = {}
    ;(contratos || []).forEach(c => { contratoMap[c.church_id] = c })

    // Busca módulos de todos os contratos de uma vez
    const contratoIds = (contratos || []).map(c => c.id)
    const { data: modulos } = contratoIds.length
      ? await supabaseAdmin
          .from('db_contrato_modulo')
          .select('contrato_id, limite, is_active, db_modulo:modulo_id(id, slug, name)')
          .in('contrato_id', contratoIds)
          .eq('is_active', true)
      : { data: [] }

    const moduloMap = {}
    ;(modulos || []).forEach(m => {
      if (!moduloMap[m.contrato_id]) moduloMap[m.contrato_id] = []
      moduloMap[m.contrato_id].push({
        slug:   m.db_modulo?.slug,
        name:   m.db_modulo?.name,
        limite: m.limite,
      })
    })

    const result = (igrejas || []).map(church => {
      const contrato = contratoMap[church.id] || null
      return {
        church_id:     church.id,
        church_name:   church.name,
        status:        contrato?.status        || null,
        periodicidade: contrato?.periodicidade || null,
        vencimento_em: contrato?.vencimento_em || null,
        bloqueio_em:   contrato?.bloqueio_em   || null,
        valor:         contrato?.valor         || null,
        contrato_id:   contrato?.id            || null,
        modulos:       contrato ? (moduloMap[contrato.id] || []) : [],
      }
    })

    res.json({ igrejas: result })
  } catch (e) {
    return serverError(res, e, 'contrato GET')
  }
})

// ── GET /api/contrato/:churchId ── detalhe de uma igreja ─────────────────────
router.get('/:churchId', authMiddleware, ownerGuard, async (req, res) => {
  try {
    const { churchId } = req.params

    const { data: church, error: cErr } = await supabaseAdmin
      .from('db_church')
      .select('id, name, slug, logo_url')
      .eq('id', churchId)
      .maybeSingle()

    if (cErr)    return dbError(res, cErr, 'contrato GET church')
    if (!church) return res.status(404).json({ error: 'Igreja não encontrada' })

    const { data: contrato, error: conErr } = await supabaseAdmin
      .from('db_contrato')
      .select('*')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (conErr) return dbError(res, conErr, 'contrato GET contrato')

    let modulos = []
    if (contrato?.id) {
      const { data: mods } = await supabaseAdmin
        .from('db_contrato_modulo')
        .select('id, modulo_id, limite, is_active, db_modulo:modulo_id(id, slug, name, description)')
        .eq('contrato_id', contrato.id)

      modulos = (mods || []).map(m => ({
        id:          m.id,
        modulo_id:   m.modulo_id,
        slug:        m.db_modulo?.slug,
        name:        m.db_modulo?.name,
        description: m.db_modulo?.description,
        limite:      m.limite,
        is_active:   m.is_active,
      }))
    }

    // Todos os módulos disponíveis para o modal
    const { data: todosModulos } = await supabaseAdmin
      .from('db_modulo')
      .select('id, slug, name, description')
      .eq('is_active', true)
      .order('name')

    res.json({
      church,
      contrato:      contrato || null,
      modulos,
      todos_modulos: todosModulos || [],
    })
  } catch (e) {
    return serverError(res, e, 'contrato GET :churchId')
  }
})

// ── POST /api/contrato/:churchId ── cria ou atualiza contrato ────────────────
router.post('/:churchId', authMiddleware, ownerGuard, async (req, res) => {
  try {
    const { churchId } = req.params
    const { periodicidade, vencimento_em, valor, observacoes, modulos = [] } = req.body

    if (!periodicidade || !vencimento_em) {
      return res.status(400).json({ error: 'periodicidade e vencimento_em são obrigatórios' })
    }

    // Calcula bloqueio_em = vencimento_em + 3 meses
    const venc       = new Date(vencimento_em)
    const bloqueioAt = new Date(venc)
    bloqueioAt.setMonth(bloqueioAt.getMonth() + 3)
    const bloqueio_em = bloqueioAt.toISOString().split('T')[0]

    // Upsert contrato (cria se não existe, atualiza se existe)
    const { error: uErr } = await supabaseAdmin
      .from('db_contrato')
      .upsert(
        { church_id: churchId, periodicidade, vencimento_em, bloqueio_em, valor: valor || null, observacoes: observacoes || null },
        { onConflict: 'church_id' }
      )

    if (uErr) return dbError(res, uErr, 'contrato POST upsert')

    // Busca o contrato_id após upsert
    const { data: contratoSalvo, error: selErr } = await supabaseAdmin
      .from('db_contrato')
      .select('id')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (selErr || !contratoSalvo) return dbError(res, selErr, 'contrato POST select')

    const contratoId = contratoSalvo.id

    // Remove módulos antigos e insere os novos selecionados
    await supabaseAdmin
      .from('db_contrato_modulo')
      .delete()
      .eq('contrato_id', contratoId)

    if (modulos.length) {
      const { error: mErr } = await supabaseAdmin
        .from('db_contrato_modulo')
        .insert(modulos.map(m => ({
          contrato_id: contratoId,
          church_id:   churchId,
          modulo_id:   m.modulo_id,
          limite:      m.limite || null,
          is_active:   true,
        })))

      if (mErr) return dbError(res, mErr, 'contrato POST modulos')
    }

    // Gera parcelas do contrato recém criado/renovado (sem bloquear a resposta)
    try {
      const { gerarParcelasParaContrato } = require('./pagamento')
      gerarParcelasParaContrato(churchId).catch(err =>
        console.error('[contrato POST] gerarParcelas falhou:', err.message)
      )
    } catch (_) { /* pagamento module não disponível ainda */ }

    res.json({ ok: true, contrato_id: contratoId })
  } catch (e) {
    return serverError(res, e, 'contrato POST :churchId')
  }
})

// ── PUT /api/contrato/:churchId/status ── muda status manualmente ────────────
router.put('/:churchId/status', authMiddleware, ownerGuard, async (req, res) => {
  try {
    const { churchId } = req.params
    const { status }   = req.body

    const statusValidos = ['trial', 'ativo', 'inadimplente', 'bloqueado', 'cancelado']
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Use: ${statusValidos.join(', ')}` })
    }

    const { data: contrato } = await supabaseAdmin
      .from('db_contrato')
      .select('id')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado para esta igreja' })

    const { error } = await supabaseAdmin
      .from('db_contrato')
      .update({ status })
      .eq('id', contrato.id)

    if (error) return dbError(res, error, 'contrato PUT status')

    res.json({ ok: true, status })
  } catch (e) {
    return serverError(res, e, 'contrato PUT :churchId/status')
  }
})

module.exports = router
