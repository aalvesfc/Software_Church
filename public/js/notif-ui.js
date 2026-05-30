;(function () {
  const POLL_MS = 30000
  let contadorAnterior = 0
  let primeiraVerificacao = true

  function tocarSomNotificacao() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()

      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.frequency.value = 523
      osc1.type = 'sine'
      gain1.gain.setValueAtTime(0.3, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.3)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.value = 659
      osc2.type = 'sine'
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc2.start(ctx.currentTime + 0.15)
      osc2.stop(ctx.currentTime + 0.5)
    } catch (err) {
      console.log('Audio não disponível:', err)
    }
  }

  async function verificarNotificacoes() {
    try {
      const res = await window.authFetch('/api/notificacao/nao-lidas')
      if (!res.ok) return
      const { count } = await res.json()

      if (!primeiraVerificacao && count > contadorAnterior) {
        tocarSomNotificacao()
      }
      primeiraVerificacao = false
      contadorAnterior = count

      const badge = document.getElementById('notifBadge')
      if (!badge) return
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count
        badge.style.display = 'flex'
      } else {
        badge.style.display = 'none'
      }
    } catch {}
  }

  function formatarTempo(iso) {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'agora'
    if (m < 60) return `${m}min atrás`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h atrás`
    return `${Math.floor(h / 24)}d atrás`
  }

  async function carregarNotificacoes() {
    const list = document.getElementById('notifList')
    if (!list) return
    try {
      const res = await window.authFetch('/api/notificacao')
      if (!res.ok) return
      const { notificacoes } = await res.json()
      if (!notificacoes.length) {
        list.innerHTML = '<div style="padding:24px;text-align:center;color:#9E9B96;font-size:13px">Nenhuma notificação</div>'
        return
      }
      list.innerHTML = notificacoes.slice(0, 6).map(n => `
        <div class="notif-item${!n.is_read ? ' unread' : ''}" onclick="window._abrirNotif('${n.id}','${n.action_url || ''}')">
          <div class="notif-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div class="notif-content">
            <div class="notif-title">${n.title}</div>
            <div class="notif-body">${n.body}</div>
            <div class="notif-time">${formatarTempo(n.created_at)}</div>
          </div>
        </div>`).join('')
    } catch {}
  }

  window._abrirNotif = async function(id, url) {
    try { await window.authFetch('/api/notificacao/' + id + '/lida', { method: 'PUT' }) } catch {}
    verificarNotificacoes()
    if (url) window.location.href = url
  }

  function initNotifUI() {
    const btn = document.getElementById('notifBtn')
    const dropdown = document.getElementById('notifDropdown')
    const markAll = document.getElementById('markAllRead')
    if (!btn || !dropdown) return

    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const aberto = dropdown.classList.contains('open')
      dropdown.classList.toggle('open', !aberto)
      if (!aberto) await carregarNotificacoes()
    })
    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove('open')
    })
    if (markAll) {
      markAll.addEventListener('click', async () => {
        try { await window.authFetch('/api/notificacao/marcar-todas-lidas', { method: 'PUT' }) } catch {}
        verificarNotificacoes()
        carregarNotificacoes()
      })
    }

    verificarNotificacoes()
    setInterval(verificarNotificacoes, POLL_MS)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNotifUI)
  else initNotifUI()
})()
