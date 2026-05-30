const router = require('express').Router()
const { supabaseAdmin } = require('../lib/supabase')
const authMiddleware = require('../middleware/auth')
const checkPermissao = require('../middleware/checkPermissao')


async function uploadPhoto(base64Data, memberId) {
  try {
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/)
    if (!matches) return null
    const contentType = matches[1]
    const buffer = Buffer.from(matches[2], 'base64')
    const ext = contentType.split('/')[1]?.split('+')[0] || 'jpg'
    const fileName = `photos/${memberId}-${Date.now()}.${ext}`

    await supabaseAdmin.storage.createBucket('voluntarios', { public: true }).catch(() => {})

    const { error } = await supabaseAdmin.storage
      .from('voluntarios')
      .upload(fileName, buffer, { contentType, upsert: true })

    if (error) { console.error('[photo upload]', error); return null }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('voluntarios')
      .getPublicUrl(fileName)

    return publicUrl
  } catch (e) {
    console.error('[photo upload exception]', e)
    return null
  }
}

async function syncDepts(memberId, departmentIds, churchId) {
  await supabaseAdmin.from('db_member_dept').delete().eq('member_id', memberId)
  if (departmentIds?.length) {
    const today = new Date().toISOString().split('T')[0]
    const rows = departmentIds.map(did => ({
      member_id:     memberId,
      department_id: did,
      church_id:     churchId,
      status:        'ativo',
      joined_at:     today,
    }))
    const { error } = await supabaseAdmin.from('db_member_dept').insert(rows)
    if (error) console.error('[syncDepts]', error)
  }
}

// Busca departamentos de um ou mais membros e anexa ao objeto
async function attachDepts(members) {
  const ids = members.map(m => m.id)
  if (!ids.length) return members

  // Query 1: vínculos membro ↔ departamento (sem joins embutidos)
  const { data: links } = await supabaseAdmin
    .from('db_member_dept')
    .select('id, member_id, department_id, funcao_id, status')
    .in('member_id', ids)

  if (!links?.length) return members.map(m => ({ ...m, db_member_dept: [] }))

  // Query 2: nomes dos departamentos
  const deptIds = [...new Set(links.map(l => l.department_id))]
  const { data: depts } = await supabaseAdmin
    .from('db_department')
    .select('id, name')
    .in('id', deptIds)

  const deptMap = {}
  ;(depts || []).forEach(d => { deptMap[d.id] = d })

  const memberMap = {}
  links.forEach(l => {
    if (!memberMap[l.member_id]) memberMap[l.member_id] = []
    memberMap[l.member_id].push({ id: l.id, department_id: l.department_id, funcao_id: l.funcao_id || null, status: l.status, db_department: deptMap[l.department_id] || null })
  })

  return members.map(m => ({ ...m, db_member_dept: memberMap[m.id] || [] }))
}

const SELECT = '*, db_genero(id, name), db_status_civil(id, name)'

// GET /api/voluntario/pendentes — cadastros aguardando aprovação
router.get('/pendentes', authMiddleware, checkPermissao('voluntario', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  // Seleciona apenas colunas que existem em db_user com certeza
  const { data: users, error } = await supabaseAdmin
    .from('db_user')
    .select('id, user_id, email, full_name, nickname, phone')
    .eq('church_id', churchId)
    .eq('is_active', false)
    .order('id', { ascending: false })

  if (error) {
    console.error('[pendentes] db_user query error:', error.message, '| churchId:', churchId)
    return res.status(500).json({ error: error.message })
  }

  console.log('[pendentes] churchId=%s found %d pending users', churchId, users?.length ?? 0)

  if (!users?.length) return res.json({ pendentes: [] })

  const emails = users.map(u => u.email)
  const { data: members, error: membErr } = await supabaseAdmin
    .from('db_member')
    .select('id, full_name, whatsapp, email, photo_url')
    .eq('church_id', churchId)
    .in('email', emails)

  if (membErr) console.error('[pendentes] db_member query error:', membErr.message)

  const memberByEmail = {}
  ;(members || []).forEach(m => { memberByEmail[m.email] = m })

  const pendentes = users.map(u => ({
    user_id:   u.id,
    auth_id:   u.user_id,
    member_id: memberByEmail[u.email]?.id    || null,
    full_name: u.full_name || memberByEmail[u.email]?.full_name || '',
    email:     u.email,
    phone:     u.phone || memberByEmail[u.email]?.whatsapp || '',
    photo_url: memberByEmail[u.email]?.photo_url || null,
  }))

  res.json({ pendentes })
})

// PUT /api/voluntario/:id/aprovar
router.put('/:id/aprovar', authMiddleware, checkPermissao('voluntario', 'editar'), async (req, res) => {
  const churchId = req.churchId
  const { error } = await supabaseAdmin
    .from('db_user')
    .update({ is_active: true })
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// PUT /api/voluntario/:id/rejeitar
router.put('/:id/rejeitar', authMiddleware, checkPermissao('voluntario', 'editar'), async (req, res) => {
  const churchId = req.churchId

  const { data: dbUser } = await supabaseAdmin
    .from('db_user')
    .select('id, user_id, email')
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .single()

  if (!dbUser) return res.status(404).json({ error: 'Usuário não encontrado' })

  if (dbUser.email) {
    await supabaseAdmin
      .from('db_member')
      .update({ is_active: false })
      .eq('church_id', churchId)
      .eq('email', dbUser.email)
  }

  await supabaseAdmin.from('db_user').delete().eq('id', dbUser.id)

  if (dbUser.user_id) {
    await supabaseAdmin.auth.admin.deleteUser(dbUser.user_id).catch(() => {})
  }

  res.json({ ok: true })
})

// GET /api/voluntario
router.get('/', authMiddleware, checkPermissao('voluntario', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_member')
    .select(SELECT)
    .eq('church_id', churchId)
    .order('full_name', { ascending: true })

  if (error) { console.error('[voluntario GET]', error); return res.status(500).json({ error: error.message }) }

  const voluntarios = await attachDepts(data || [])
  res.json({ voluntarios })
})

// GET /api/voluntario/:id/disponibilidade?event_id=uuid[&department_id=uuid]
router.get('/:id/disponibilidade', authMiddleware, checkPermissao('voluntario', 'ver'), async (req, res) => {
  const churchId  = req.churchId
  const memberId  = req.params.id
  const { event_id, department_id } = req.query

  if (!event_id) return res.status(400).json({ error: 'event_id obrigatório' })

  const { data: evento } = await supabaseAdmin
    .from('db_event')
    .select('start_date, start_time')
    .eq('id', event_id)
    .eq('church_id', churchId)
    .maybeSingle()

  if (!evento) return res.status(404).json({ error: 'Evento não encontrado' })

  const motivos = []

  if (evento.start_date) {
    const [y, m, d] = evento.start_date.split('-').map(Number)
    const diaSemana = new Date(y, m - 1, d).getDay()

    let turno = null
    if (evento.start_time) {
      const h = parseInt(evento.start_time.split(':')[0], 10)
      if (h >= 6 && h < 12)       turno = 'manha'
      else if (h >= 12 && h < 18) turno = 'tarde'
      else                         turno = 'noite'
    }

    const { data: dispList } = await supabaseAdmin
      .from('db_disponibilidade')
      .select('dia_semana, turno')
      .eq('church_id', churchId)
      .eq('member_id', memberId)

    if (dispList?.length) {
      const diasDisp = dispList.map(r => r.dia_semana)
      if (!diasDisp.includes(diaSemana)) {
        const DIAS = ['domingos','segundas','terças','quartas','quintas','sextas','sábados']
        motivos.push(`Não disponível às ${DIAS[diaSemana]}`)
      } else if (turno) {
        const turnosNoDia = dispList.filter(r => r.dia_semana === diaSemana).map(r => r.turno)
        if (!turnosNoDia.includes(turno)) {
          const LABELS = { manha: 'manhã', tarde: 'tarde', noite: 'noite' }
          const DIAS   = ['domingos','segundas','terças','quartas','quintas','sextas','sábados']
          motivos.push(`Não disponível no turno da ${LABELS[turno]} às ${DIAS[diaSemana]}`)
        }
      }
    }

    const { data: indispList } = await supabaseAdmin
      .from('db_indisponibilidade')
      .select('type, start_date, end_date, department_id')
      .eq('church_id', churchId)
      .eq('member_id', memberId)

    for (const ind of (indispList || [])) {
      if (ind.type === 'data_unica' && ind.start_date === evento.start_date) {
        motivos.push('Indisponível nesta data'); break
      }
      if (ind.type === 'periodo' &&
          ind.start_date <= evento.start_date && evento.start_date <= ind.end_date) {
        motivos.push('Indisponível neste período'); break
      }
      if (ind.type === 'departamento' &&
          ind.start_date <= evento.start_date && evento.start_date <= ind.end_date &&
          (!department_id || ind.department_id === department_id)) {
        motivos.push('Indisponível para este departamento neste período'); break
      }
    }
  }

  res.json({ disponivel: motivos.length === 0, motivos })
})

// GET /api/voluntario/:id
router.get('/:id', authMiddleware, checkPermissao('voluntario', 'ver'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data, error } = await supabaseAdmin
    .from('db_member')
    .select(SELECT)
    .eq('id', req.params.id)
    .eq('church_id', churchId)
    .single()

  if (error) { console.error('[voluntario GET/:id]', error); return res.status(500).json({ error: error.message }) }
  if (!data) return res.status(404).json({ error: 'Voluntário não encontrado' })

  const [voluntario] = await attachDepts([data])
  res.json({ voluntario })
})

// POST /api/voluntario
router.post('/', authMiddleware, checkPermissao('voluntario', 'criar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, nickname, email, whatsapp, birth_date, gender, status_civil_id,
          address, emergency_contact_name, emergency_contact_phone,
          department_ids, photo_base64 } = req.body

  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' })

  const row = {
    church_id:       churchId,
    full_name:       name.trim(),
    nickname:        nickname?.trim()          || null,
    email:           email?.trim()            || null,
    whatsapp:        whatsapp?.trim()         || null,
    birth_date:      birth_date              || null,
    genero_id:       gender                  || null,
    status_civil_id: status_civil_id         || null,
    address:         address?.trim()         || null,
    emergency_contact_name:  emergency_contact_name?.trim()  || null,
    emergency_contact_phone: emergency_contact_phone?.trim() || null,
    is_active:       true,
    is_volunteer:    true,
  }

  const { data: created, error: insErr } = await supabaseAdmin
    .from('db_member')
    .insert(row)
    .select('id')
    .single()

  if (insErr) { console.error('[voluntario POST]', insErr); return res.status(500).json({ error: insErr.message }) }

  await syncDepts(created.id, department_ids, churchId)

  if (photo_base64) {
    const url = await uploadPhoto(photo_base64, created.id)
    if (url) await supabaseAdmin.from('db_member').update({ photo_url: url }).eq('id', created.id)
  }

  const { data, error } = await supabaseAdmin.from('db_member').select(SELECT).eq('id', created.id).single()
  if (error) return res.status(500).json({ error: error.message })

  const [voluntario] = await attachDepts([data])
  res.status(201).json({ voluntario })
})

// PUT /api/voluntario/:id
router.put('/:id', authMiddleware, checkPermissao('voluntario', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { name, nickname, email, whatsapp, birth_date, gender, status_civil_id,
          address, number, complement, neighborhood, city, state, zip_code,
          emergency_contact_name, emergency_contact_phone,
          department_ids, is_active, photo_base64 } = req.body

  const updates = {}
  if (name             !== undefined) updates.full_name        = name.trim()
  if (nickname         !== undefined) updates.nickname         = nickname?.trim()          || null
  if (email            !== undefined) updates.email            = email?.trim()            || null
  if (whatsapp         !== undefined) updates.whatsapp         = whatsapp?.trim()         || null
  if (birth_date       !== undefined) updates.birth_date       = birth_date              || null
  if (gender           !== undefined) updates.genero_id        = gender                  || null
  if (status_civil_id  !== undefined) updates.status_civil_id  = status_civil_id         || null
  if (address          !== undefined) updates.address          = address?.trim()         || null
  if (number           !== undefined) updates.number           = number?.trim()          || null
  if (complement       !== undefined) updates.complement       = complement?.trim()      || null
  if (neighborhood     !== undefined) updates.neighborhood     = neighborhood?.trim()    || null
  if (city             !== undefined) updates.city             = city?.trim()            || null
  if (state            !== undefined) updates.state            = state?.trim()?.toUpperCase() || null
  if (zip_code         !== undefined) updates.zip_code         = zip_code?.trim()        || null
  if (emergency_contact_name   !== undefined) updates.emergency_contact_name   = emergency_contact_name?.trim()  || null
  if (emergency_contact_phone  !== undefined) updates.emergency_contact_phone  = emergency_contact_phone?.trim() || null
  if (is_active        !== undefined) updates.is_active        = is_active

  if (photo_base64) {
    const url = await uploadPhoto(photo_base64, req.params.id)
    if (url) updates.photo_url = url
  }

  const { error } = await supabaseAdmin
    .from('db_member')
    .update(updates)
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) { console.error('[voluntario PUT]', error); return res.status(500).json({ error: error.message }) }

  if (department_ids !== undefined) await syncDepts(req.params.id, department_ids, churchId)

  const { data } = await supabaseAdmin.from('db_member').select(SELECT).eq('id', req.params.id).single()
  if (!data) return res.status(404).json({ error: 'Voluntário não encontrado' })

  const [voluntario] = await attachDepts([data])
  res.json({ voluntario })
})

// POST /api/voluntario/:id/departamento — vincula um departamento com função opcional
router.post('/:id/departamento', authMiddleware, checkPermissao('voluntario', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { department_id, funcao_id, status } = req.body
  if (!department_id) return res.status(400).json({ error: 'department_id obrigatório' })

  // Valida duplicidade: mesma função no mesmo departamento
  const { data: existing } = await supabaseAdmin
    .from('db_member_dept')
    .select('id, funcao_id')
    .eq('member_id', req.params.id)
    .eq('department_id', department_id)
    .eq('church_id', churchId)

  if (existing?.length) {
    const conflict = funcao_id
      ? existing.some(r => r.funcao_id === funcao_id)
      : existing.some(r => !r.funcao_id)
    if (conflict) {
      const msg = funcao_id ? 'Esta função já está atribuída neste departamento' : 'Voluntário já está neste departamento sem função'
      return res.status(409).json({ error: msg })
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabaseAdmin
    .from('db_member_dept')
    .insert({
      member_id:     req.params.id,
      department_id,
      church_id:     churchId,
      funcao_id:     funcao_id || null,
      status:        status || 'pendente',
      joined_at:     today,
    })
    .select()
    .single()

  if (error) { console.error('[dept POST]', error); return res.status(500).json({ error: error.message }) }
  res.status(201).json({ vínculo: data })
})

// PATCH /api/voluntario/dept-ativar/:linkId — lider ativa vínculo pendente de departamento
router.patch('/dept-ativar/:linkId', authMiddleware, checkPermissao('voluntario', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { data: link, error: linkErr } = await supabaseAdmin
    .from('db_member_dept')
    .select('id, member_id, department_id, status')
    .eq('id', req.params.linkId)
    .eq('church_id', churchId)
    .maybeSingle()

  if (linkErr || !link) return res.status(404).json({ error: 'Vínculo não encontrado' })
  if (link.status === 'ativo') return res.json({ ok: true, already: true })

  // lider_departamento só pode ativar voluntários do seu próprio departamento
  if (req.dbUser.db_perfil?.slug === 'lider_departamento') {
    const { data: deptLider } = await supabaseAdmin
      .from('db_department_lider')
      .select('department_id')
      .eq('user_id', req.dbUser.id)
      .eq('church_id', churchId)
      .maybeSingle()
    if (!deptLider?.department_id || deptLider.department_id !== link.department_id)
      return res.status(403).json({ error: 'Sem permissão para ativar neste departamento' })
  }

  const { error } = await supabaseAdmin
    .from('db_member_dept')
    .update({ status: 'ativo' })
    .eq('id', req.params.linkId)
    .eq('church_id', churchId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// PUT /api/voluntario/:id/funcao — atualiza função de um vínculo pelo link_id
router.put('/:id/funcao', authMiddleware, checkPermissao('voluntario', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { link_id, funcao_id, status } = req.body
  if (!link_id) return res.status(400).json({ error: 'link_id obrigatório' })

  // Valida duplicidade: mesma função no mesmo departamento (excluindo o próprio vínculo)
  if (funcao_id) {
    const { data: current } = await supabaseAdmin
      .from('db_member_dept').select('department_id').eq('id', link_id).single()
    if (current) {
      const { data: conflict } = await supabaseAdmin
        .from('db_member_dept').select('id')
        .eq('member_id', req.params.id).eq('department_id', current.department_id)
        .eq('funcao_id', funcao_id).eq('church_id', churchId).neq('id', link_id)
      if (conflict?.length) return res.status(409).json({ error: 'Esta função já está atribuída neste departamento' })
    }
  }

  const updates = { funcao_id: funcao_id || null }
  if (status) updates.status = status

  const { error } = await supabaseAdmin
    .from('db_member_dept')
    .update(updates)
    .eq('id', link_id)
    .eq('church_id', churchId)

  if (error) { console.error('[funcao PUT]', error); return res.status(500).json({ error: error.message }) }
  res.json({ ok: true })
})

// DELETE /api/voluntario/:id/departamento/:linkId — remove vínculo pelo id do registro
router.delete('/:id/departamento/:linkId', authMiddleware, checkPermissao('voluntario', 'editar'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  const { error } = await supabaseAdmin
    .from('db_member_dept')
    .delete()
    .eq('id', req.params.linkId)
    .eq('church_id', churchId)

  if (error) { console.error('[dept DELETE]', error); return res.status(500).json({ error: error.message }) }
  res.json({ ok: true })
})

// DELETE /api/voluntario/:id
router.delete('/:id', authMiddleware, checkPermissao('voluntario', 'excluir'), async (req, res) => {
  const churchId = req.churchId
  if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada' })

  await supabaseAdmin.from('db_member_dept').delete().eq('member_id', req.params.id)

  const { error } = await supabaseAdmin
    .from('db_member')
    .delete()
    .eq('id', req.params.id)
    .eq('church_id', churchId)

  if (error) { console.error('[voluntario DELETE]', error); return res.status(500).json({ error: error.message }) }
  res.json({ ok: true })
})

module.exports = router
