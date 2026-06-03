// MÓDULO: core (sistema)
const router      = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware    = require('../middleware/auth')
const { dbError, serverError } = require('../lib/apiError')

// ── Guard: apenas o dono do sistema (email configurado em SYSTEM_OWNER_EMAIL) ──
async function ownerGuard(req, res, next) {
  try {
    const userId = req.authUser?.id
    if (!userId) return res.status(401).json({ error: 'Não autenticado' })

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = authUser?.user?.email?.toLowerCase()

    const ownerEmail = (process.env.SYSTEM_OWNER_EMAIL || '').toLowerCase()
    if (!ownerEmail) {
      return res.status(500).json({ error: 'SYSTEM_OWNER_EMAIL não configurado' })
    }
    if (email !== ownerEmail) {
      return res.status(403).json({ error: 'Acesso restrito ao dono do sistema' })
    }

    next()
  } catch (e) {
    return serverError(res, e, 'ownerGuard')
  }
}

// ── Job: atualiza status de contratos vencidos/bloqueados ──────────────────
async function rodarJobInadimplencia() {
  const hoje = new Date().toISOString().split('T')[0]

  // Ativos → inadimplentes
  await supabaseAdmin
    .from('db_contrato')
    .update({ status: 'inadimplente' })
    .eq('status', 'ativo')
    .lt('vencimento_em', hoje)

  // Inadimplentes → bloqueados
  await supabaseAdmin
    .from('db_contrato')
    .update({ status: 'bloqueado' })
    .eq('status', 'inadimplente')
    .lt('bloqueio_em', hoje)
}

// ── GET /api/contrato ── lista igrejas com status do contrato ──────────────
router.get('/', authMiddleware, ownerGuard, async (req, res) => {
  try {
    await rodarJobInadimplencia()

    const { data: churches, error: cErr } = await supabaseAdmin
      .from('db_church')
      .select('id, name')
      .order('name', { ascending: true })

    if (cErr) return dbError(res, cErr, 'contrato GET churches')

    const churchIds = (churches || []).map(c => c.id)

    const { data: contratos, error: conErr } = await supabaseAdmin
      .from('db_contrato')
      .select('id, church_id, status, periodicidade, inicio_em, vencimento_em, bloqueio_em, valor, observacoes')
      .in('church_id', churchIds)

    if (conErr) return dbError(res, conErr, 'contrato GET contratos')

    const contratoMap = {}
    ;(contratos || []).forEach(c => { contratoMap[c.church_id] = c })

    // Busca modulos de cada contrato
    const contratoIds = (contratos || []).map(c => c.id)
    const { data: modulos } = contratoIds.length
      ? await supabaseAdmin
          .from('db_contrato_modulo')
          .select('contrato_id, limite, is_active, db_modulo:modulo_id(slug, name)')
          .in('contrato_id', contratoIds)
          .eq('is_active', true)
      : { data: [] }

    const moduloMap = {}
    ;(modulos || []).forEach(m => {
      if (!moduloMap[m.contrato_id]) moduloMap[m.contrato_id] = []
      moduloMap[m.contrato_id].push({ slug: m.db_modulo?.slug, name: m.db_modulo?.name, limite: m.limite })
    })

    const result = (churches || []).map(church => {
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

// ── GET /api/contrato/:churchId ── detalhe do contrato de uma igreja ────────
router.get('/:churchId', authMiddleware, ownerGuard, async (req, res) => {
  try {
    const { churchId } = req.params

    const { data: church, error: cErr } = await supabaseAdmin
      .from('db_church')
      .select('id, name')
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

    // Lista todos os módulos disponíveis
    const { data: todosModulos } = await supabaseAdmin
      .from('db_modulo')
      .select('id, slug, name, description')
      .eq('is_active', true)
      .order('name', { ascending: true })

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

// ── POST /api/contrato/:churchId ── cria ou atualiza contrato ───────────────
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

    // Busca contrato existente
    const { data: existente } = await supabaseAdmin
      .from('db_contrato')
      .select('id, status')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let contratoId
    if (existente?.id) {
      // Atualiza contrato existente
      const { data: updated, error: uErr } = await supabaseAdmin
        .from('db_contrato')
        .update({ periodicidade, vencimento_em, bloqueio_em, valor: valor || null, observacoes: observacoes || null })
        .eq('id', existente.id)
        .select('id')
        .single()

      if (uErr) return dbError(res, uErr, 'contrato POST update')
      contratoId = updated.id
    } else {
      // Cria novo contrato
      const { data: authUserInfo } = await supabaseAdmin.auth.admin.getUserById(req.authUser.id)
      const ownerEmail = authUserInfo?.user?.email

      const { data: created, error: iErr } = await supabaseAdmin
        .from('db_contrato')
        .insert({
          church_id:     churchId,
          periodicidade,
          status:        'trial',
          inicio_em:     new Date().toISOString().split('T')[0],
          vencimento_em,
          bloqueio_em,
          valor:         valor || null,
          observacoes:   observacoes || null,
          created_by:    ownerEmail || 'system',
        })
        .select('id')
        .single()

      if (iErr) return dbError(res, iErr, 'contrato POST insert')
      contratoId = created.id
    }

    // Sincroniza módulos: desativa todos e reinsere os selecionados
    await supabaseAdmin
      .from('db_contrato_modulo')
      .update({ is_active: false })
      .eq('contrato_id', contratoId)

    if (modulos.length) {
      const rows = modulos.map(m => ({
        contrato_id: contratoId,
        church_id:   churchId,
        modulo_id:   m.modulo_id,
        limite:      m.limite || null,
        is_active:   true,
      }))

      const { error: mErr } = await supabaseAdmin
        .from('db_contrato_modulo')
        .upsert(rows, { onConflict: 'contrato_id,modulo_id' })

      if (mErr) return dbError(res, mErr, 'contrato POST modulos')
    }

    res.json({ ok: true, contrato_id: contratoId })
  } catch (e) {
    return serverError(res, e, 'contrato POST :churchId')
  }
})

// ── PUT /api/contrato/:churchId/status ── muda status manualmente ───────────
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
