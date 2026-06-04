// MÓDULO: core (sistema)
const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const { dbError, serverError } = require('../lib/apiError')

// ── Guard: apenas sistema_owner ─────────────────────────────────────────────
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
    return serverError(res, e, 'ownerGuard pagamento')
  }
}

// ── Job: atualiza parcelas vencidas (pendente → atrasado) ─────────────────────
async function atualizarStatusPagamentos() {
  try {
    const hoje = new Date().toISOString().split('T')[0]
    const { error } = await supabaseAdmin
      .from('db_pagamento')
      .update({ status: 'atrasado' })
      .eq('status', 'pendente')
      .lt('vencimento', hoje)

    if (error) console.error('[pagamento job] erro ao atualizar status:', error.message)
    else console.log('[pagamento job] status de parcelas atualizado —', new Date().toLocaleString('pt-BR'))
  } catch (e) {
    console.error('[pagamento job] exceção:', e.message)
  }
}

// ── Helper: gera parcelas para um contrato (exportado para uso em contrato.js) ─
async function gerarParcelasParaContrato(churchId) {
  try {
    const { data: contrato, error: cErr } = await supabaseAdmin
      .from('db_contrato')
      .select('id, periodicidade, inicio_em, valor')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cErr || !contrato) return { ok: false, error: 'Contrato não encontrado' }

    // Não regera se já existem parcelas
    const { count } = await supabaseAdmin
      .from('db_pagamento')
      .select('id', { count: 'exact', head: true })
      .eq('contrato_id', contrato.id)

    if (count > 0) return { ok: true, skipped: true }

    const parcelas = []
    const inicio = new Date(contrato.inicio_em)
    const { periodicidade, valor, id: contratoId } = contrato

    function montarParcela(venc) {
      const raw = venc.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        .replace(/\.\s*/g, '/')
      const ref = raw.charAt(0).toUpperCase() + raw.slice(1)
      return {
        church_id:   churchId,
        contrato_id: contratoId,
        referencia:  ref,
        valor,
        vencimento:  venc.toISOString().split('T')[0],
        status:      'pendente',
      }
    }

    if (periodicidade === 'mensal') {
      for (let i = 0; i < 12; i++) {
        const venc = new Date(inicio)
        venc.setMonth(venc.getMonth() + i)
        parcelas.push(montarParcela(venc))
      }
    } else if (periodicidade === 'trimestral') {
      for (let i = 0; i < 4; i++) {
        const venc = new Date(inicio)
        venc.setMonth(venc.getMonth() + i * 3)
        parcelas.push(montarParcela(venc))
      }
    } else if (periodicidade === 'anual') {
      parcelas.push(montarParcela(new Date(inicio)))
    }

    if (!parcelas.length) return { ok: true, skipped: true }

    const { error: iErr } = await supabaseAdmin.from('db_pagamento').insert(parcelas)
    if (iErr) {
      console.error('[gerarParcelas]', iErr.message)
      return { ok: false, error: iErr.message }
    }

    return { ok: true, parcelas: parcelas.length }
  } catch (e) {
    console.error('[gerarParcelasParaContrato]', e.message)
    return { ok: false, error: e.message }
  }
}

// ── PUT /api/pagamento/atualizar-status ── disparo manual do job ──────────────
router.put('/atualizar-status', authMiddleware, ownerGuard, async (req, res) => {
  try {
    await atualizarStatusPagamentos()
    res.json({ ok: true })
  } catch (e) {
    return serverError(res, e, 'pagamento PUT atualizar-status')
  }
})

// ── POST /api/pagamento/gerar/:churchId ── gera parcelas do contrato ──────────
router.post('/gerar/:churchId', authMiddleware, ownerGuard, async (req, res) => {
  try {
    const result = await gerarParcelasParaContrato(req.params.churchId)
    if (!result.ok) return res.status(400).json({ error: result.error })
    res.json(result)
  } catch (e) {
    return serverError(res, e, 'pagamento POST gerar')
  }
})

// ── GET /api/pagamento ── lista pagamentos com filtros opcionais ───────────────
router.get('/', authMiddleware, ownerGuard, async (req, res) => {
  try {
    const { status, church_id, mes, ano } = req.query

    let query = supabaseAdmin
      .from('db_pagamento')
      .select('id, church_id, contrato_id, referencia, valor, vencimento, status, pago_em, observacoes, db_church:church_id(name)')
      .order('vencimento', { ascending: false })
      .limit(500)

    if (status)    query = query.eq('status', status)
    if (church_id) query = query.eq('church_id', church_id)

    if (mes && ano) {
      const m = parseInt(mes), a = parseInt(ano)
      const inicio = `${a}-${String(m).padStart(2, '0')}-01`
      const fim    = new Date(a, m, 0).toISOString().split('T')[0]
      query = query.gte('vencimento', inicio).lte('vencimento', fim)
    }

    const { data, error } = await query
    if (error) return dbError(res, error, 'pagamento GET')

    const pagamentos = (data || []).map(p => ({
      id:          p.id,
      church_id:   p.church_id,
      church_name: p.db_church?.name || '—',
      contrato_id: p.contrato_id,
      referencia:  p.referencia,
      valor:       p.valor,
      vencimento:  p.vencimento,
      status:      p.status,
      pago_em:     p.pago_em,
      observacoes: p.observacoes,
    }))

    res.json({ pagamentos })
  } catch (e) {
    return serverError(res, e, 'pagamento GET')
  }
})

// ── GET /api/pagamento/:churchId ── pagamentos de uma igreja ──────────────────
router.get('/:churchId', authMiddleware, ownerGuard, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('db_pagamento')
      .select('id, church_id, contrato_id, referencia, valor, vencimento, status, pago_em, observacoes')
      .eq('church_id', req.params.churchId)
      .order('vencimento', { ascending: false })

    if (error) return dbError(res, error, 'pagamento GET :churchId')
    res.json({ pagamentos: data || [] })
  } catch (e) {
    return serverError(res, e, 'pagamento GET :churchId')
  }
})

// ── PUT /api/pagamento/:id/pagar ── marca parcela como paga ──────────────────
router.put('/:id/pagar', authMiddleware, ownerGuard, async (req, res) => {
  try {
    const { id } = req.params
    const { pago_em, observacoes } = req.body
    const pagoEm = pago_em || new Date().toISOString().split('T')[0]

    const { data: pagamento, error: pErr } = await supabaseAdmin
      .from('db_pagamento')
      .select('id, contrato_id')
      .eq('id', id)
      .maybeSingle()

    if (pErr)       return dbError(res, pErr, 'pagamento PUT pagar select')
    if (!pagamento) return res.status(404).json({ error: 'Parcela não encontrada' })

    const { error: uErr } = await supabaseAdmin
      .from('db_pagamento')
      .update({ status: 'pago', pago_em: pagoEm, observacoes: observacoes || null })
      .eq('id', id)

    if (uErr) return dbError(res, uErr, 'pagamento PUT pagar update')

    // Avança vencimento_em do contrato para a próxima parcela não paga
    const { data: proxima } = await supabaseAdmin
      .from('db_pagamento')
      .select('vencimento')
      .eq('contrato_id', pagamento.contrato_id)
      .in('status', ['pendente', 'atrasado'])
      .order('vencimento', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (proxima?.vencimento) {
      await supabaseAdmin
        .from('db_contrato')
        .update({ vencimento_em: proxima.vencimento })
        .eq('id', pagamento.contrato_id)
    }

    res.json({ ok: true })
  } catch (e) {
    return serverError(res, e, 'pagamento PUT pagar')
  }
})

module.exports = router
module.exports.atualizarStatusPagamentos  = atualizarStatusPagamentos
module.exports.gerarParcelasParaContrato  = gerarParcelasParaContrato
