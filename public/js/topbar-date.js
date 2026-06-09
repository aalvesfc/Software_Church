;(function () {
  // ── Estilos injetados ────────────────────────────────────────────────────────
  const css = `
    .topbar-date-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 1;
      min-width: 0;
    }
    .topbar-date-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 14px 6px 12px;
      background: #8054FF;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      color: #FFFFFF;
      white-space: nowrap;
      flex-shrink: 0;
      line-height: 1;
    }
    .topbar-date-dot {
      color: #d8ff6e;
      font-size: 9px;
      line-height: 1;
    }
    .topbar-event-name {
      font-size: 14px;
      font-weight: 500;
      font-style: italic;
      color: #5A5A5A;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 300px;
    }
  `
  const styleEl = document.createElement('style')
  styleEl.textContent = css
  document.head.appendChild(styleEl)

  // ── Helpers de data ──────────────────────────────────────────────────────────
  const DIAS   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
  const MESES  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  function formatarData() {
    const d = new Date()
    return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`
  }

  // ── Próximo evento ───────────────────────────────────────────────────────────
  async function buscarProximoEvento() {
    try {
      const res = await authFetch('/api/evento?status=agendado')
      if (!res.ok) return null
      const { eventos } = await res.json()
      if (!eventos || !eventos.length) return null

      const agora = new Date()

      // Filtra eventos que ainda não terminaram
      const futuros = eventos.filter(e => {
        const endDate = e.end_date || e.start_date
        const endTime = e.end_time  || '23:59:59'
        const fim = new Date(`${endDate}T${endTime}`)
        return fim > agora
      })

      if (!futuros.length) return null

      // Ordena por data/hora de início
      futuros.sort((a, b) => {
        const da = new Date(`${a.start_date}T${a.start_time || '00:00:00'}`)
        const db = new Date(`${b.start_date}T${b.start_time || '00:00:00'}`)
        return da - db
      })

      return futuros[0]
    } catch {
      return null
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  async function render() {
    const topbar = document.querySelector('.topbar')
    if (!topbar) return

    // Garante que o topbar distribui espaço entre left e right
    topbar.style.justifyContent = 'space-between'

    // Cria ou reutiliza o wrapper esquerdo
    let wrap = document.getElementById('topbarDateWrap')
    if (!wrap) {
      wrap = document.createElement('div')
      wrap.id = 'topbarDateWrap'
      wrap.className = 'topbar-date-wrap'
      topbar.insertBefore(wrap, topbar.firstChild)
    }

    const evento = await buscarProximoEvento()
    const nomeEvento = evento ? evento.name : 'Sem eventos recentes'

    wrap.innerHTML = `
      <div class="topbar-date-pill">
        <span class="topbar-date-dot">◆</span>
        ${formatarData()}
      </div>
      <span class="topbar-event-name" title="${nomeEvento}">${nomeEvento}</span>
    `
  }

  // Aguarda o DOM e authFetch estarem prontos
  function init() {
    if (typeof authFetch !== 'function') {
      setTimeout(init, 100)
      return
    }
    render()
    // Atualiza a cada minuto para troca automática de evento
    setInterval(render, 60 * 1000)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
