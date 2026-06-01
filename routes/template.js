const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')
const { dbError, serverError } = require('../lib/apiError') // SEC-006

// GET /api/template — lista templates com depts e funções
router.get('/', authMiddleware, checkPermissao('template', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data: templates, error } = await supabaseAdmin
    .from('db_template_event')
    .select('*')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[template GET]', error)
    return dbError(res, error, 'template')
  }

  if (!templates?.length) return res.json({ templates: [] })

  // Busca depts e funções em paralelo
  const ids = templates.map(t => t.id)

  const [{ data: depts }, { data: funcs }] = await Promise.all([
    supabaseAdmin.from('db_template_dept').select('*').in('template_id', ids),
    supabaseAdmin.from('db_template_funcao').select('*').in('template_id', ids),
  ])

  // Monta estrutura aninhada
  const result = templates.map(t => ({
    ...t,
    depts: (depts || [])
      .filter(d => d.template_id === t.id)
      .map(d => ({
        department_id: d.department_id,
        funcoes: (funcs || [])
          .filter(f => f.template_id === t.id && f.department_id === d.department_id)
          .map(f => ({ funcao_id: f.funcao_id, vagas: f.vagas }))
      }))
  }))

  res.json({ templates: result })
})

// GET /api/template/:id
router.get('/:id', authMiddleware, checkPermissao('template', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_template_event')
    .select('*')
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Template não encontrado' })

  const [{ data: depts }, { data: funcs }] = await Promise.all([
    supabaseAdmin.from('db_template_dept').select('*').eq('template_id', data.id),
    supabaseAdmin.from('db_template_funcao').select('*').eq('template_id', data.id),
  ])

  const template = {
    ...data,
    depts: (depts || []).map(d => ({
      department_id: d.department_id,
      funcoes: (funcs || [])
        .filter(f => f.department_id === d.department_id)
        .map(f => ({ funcao_id: f.funcao_id, vagas: f.vagas }))
    }))
  }

  res.json({ template })
})

// POST /api/template — cria template + depts + funções
router.post('/', authMiddleware, checkPermissao('template', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })
  if (req.dbUser.db_perfil?.slug === 'lider_departamento')
    return res.status(403).json({ error: 'Sem permissão para criar templates' })

  const { name, tags, depts } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' })

  // 1. Cria o template
  const { data: tmpl, error: tmplErr } = await supabaseAdmin
    .from('db_template_event')
    .insert({ church_id: churchId, name: name.trim(), tags: tags || [], is_active: true })
    .select()
    .single()

  if (tmplErr) {
    console.error('[template POST]', tmplErr)
    return dbError(res, tmplErr, 'template')
  }

  // 2. Insere departamentos e funções
  if (depts?.length) {
    const deptRows = depts.map(d => ({
      template_id:   tmpl.id,
      department_id: d.department_id,
      church_id:     churchId,
    }))

    const { error: deptErr } = await supabaseAdmin
      .from('db_template_dept')
      .insert(deptRows)

    if (deptErr) {
      console.error('[template POST depts]', deptErr)
      return dbError(res, deptErr, 'template')
    }

    const funcRows = []
    for (const d of depts) {
      for (const f of (d.funcoes || [])) {
        funcRows.push({
          template_id:   tmpl.id,
          department_id: d.department_id,
          funcao_id:     f.funcao_id,
          vagas:         f.vagas ?? 1,
          church_id:     churchId,
        })
      }
    }

    if (funcRows.length) {
      const { error: funcErr } = await supabaseAdmin
        .from('db_template_funcao')
        .insert(funcRows)

      if (funcErr) {
        console.error('[template POST funcoes]', funcErr)
        return dbError(res, funcErr, 'template')
      }
    }
  }

  res.status(201).json({ template: tmpl })
})

// PUT /api/template/:id — atualiza nome, tags e substitui depts/funções
router.put('/:id', authMiddleware, checkPermissao('template', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, tags, depts, is_active } = req.body
  const updates = {}
  if (name      !== undefined) updates.name      = name.trim()
  if (tags      !== undefined) updates.tags      = tags
  if (is_active !== undefined) updates.is_active = is_active

  const { data, error } = await supabaseAdmin
    .from('db_template_event')
    .update(updates)
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .select()

  if (error) {
    console.error('[template PUT]', error)
    return dbError(res, error, 'template')
  }
  if (!data?.length) return res.status(404).json({ error: 'Template não encontrado' })

  // Substitui depts e funções se enviados
  if (depts !== undefined) {
    await supabaseAdmin.from('db_template_funcao').delete()
      .eq('template_id', req.params.id).eq('church_id', churchId)
    await supabaseAdmin.from('db_template_dept').delete()
      .eq('template_id', req.params.id).eq('church_id', churchId)

    if (depts.length) {
      const deptRows = depts.map(d => ({
        template_id: req.params.id, department_id: d.department_id, church_id: churchId
      }))
      const { error: deptErr } = await supabaseAdmin.from('db_template_dept').insert(deptRows)
      if (deptErr) { console.error('[template PUT depts]', deptErr); return dbError(res, deptErr, 'template') }

      const funcRows = []
      for (const d of depts) {
        for (const f of (d.funcoes || [])) {
          funcRows.push({ template_id: req.params.id, department_id: d.department_id, funcao_id: f.funcao_id, vagas: f.vagas ?? 1, church_id: churchId })
        }
      }
      if (funcRows.length) {
        const { error: funcErr } = await supabaseAdmin.from('db_template_funcao').insert(funcRows)
        if (funcErr) { console.error('[template PUT funcoes]', funcErr); return dbError(res, funcErr, 'template') }
      }
    }
  }

  res.json({ template: data[0] })
})

// DELETE /api/template/:id — remove template e filhos
router.delete('/:id', authMiddleware, checkPermissao('template', 'excluir'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  // Cascata manual: funções → depts → template
  await supabaseAdmin.from('db_template_funcao').delete()
    .eq('template_id', req.params.id).eq('church_id', churchId)

  await supabaseAdmin.from('db_template_dept').delete()
    .eq('template_id', req.params.id).eq('church_id', churchId)

  const { error } = await supabaseAdmin
    .from('db_template_event')
    .delete()
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) {
    console.error('[template DELETE]', error)
    return dbError(res, error, 'template')
  }

  res.json({ ok: true })
})

// PATCH /api/template/:id/vagas — lider_departamento atualiza vagas do próprio dept
router.patch('/:id/vagas', authMiddleware, checkPermissao('template', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  // Obtém departamento do lider
  const { data: deptLider } = await supabaseAdmin
    .from('db_department_lider').select('department_id')
    .eq('user_id', req.dbUser.id).eq('church_id', churchId).maybeSingle()

  if (!deptLider?.department_id)
    return res.status(403).json({ error: 'Sem departamento associado' })

  const deptId      = deptLider.department_id
  const { funcoes } = req.body // [{ funcao_id, vagas }]

  // Remove todas as funções atuais do dept do líder neste template
  await supabaseAdmin.from('db_template_funcao').delete()
    .eq('template_id', req.params.id)
    .eq('department_id', deptId)
    .eq('church_id', churchId)

  if (funcoes?.length) {
    // Garante que o dept existe na tabela de depts do template
    const { data: existeDept } = await supabaseAdmin.from('db_template_dept')
      .select('id').eq('template_id', req.params.id).eq('department_id', deptId).eq('church_id', churchId).maybeSingle()
    if (!existeDept) {
      await supabaseAdmin.from('db_template_dept').insert({
        template_id: req.params.id, department_id: deptId, church_id: churchId
      })
    }

    // Insere as funções selecionadas
    const rows = funcoes.map(f => ({
      template_id: req.params.id,
      department_id: deptId,
      funcao_id: f.funcao_id,
      vagas: Math.max(1, parseInt(f.vagas) || 1),
      church_id: churchId
    }))
    const { error: insErr } = await supabaseAdmin.from('db_template_funcao').insert(rows)
    if (insErr) { console.error('[template PATCH vagas]', insErr); return dbError(res, insErr, 'template') }
  }

  res.json({ ok: true })
})

module.exports = router
