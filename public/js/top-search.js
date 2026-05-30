(() => {
  const PAGES = [
    { label: 'Configurações',    href: '/configuracoes',   icon: 'M12 20h9M12 4H3M12 12H3M12 12h9' },
    { label: 'Dashboard',        href: '/dashboard',       icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
    { label: 'Departamentos',    href: '/departamentos',   icon: 'M2 7h20v14H2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 12h20' },
    { label: 'Escalações',       href: '/escalacoes',      icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
    { label: 'Eventos',          href: '/eventos',         icon: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18' },
    { label: 'Indisponibilidade',href: '/indisponibilidade',icon: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18M9 16l2 2 4-4' },
    { label: 'Ministérios',      href: '/ministerios',     icon: 'M12 2v4M10 4h4M3 11l9-7 9 7M5 11v10h14V11M10 21v-5h4v5' },
    { label: 'Músicas',          href: '/musicas',         icon: 'M9 18V5l12-2v13M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
    { label: 'Templates',        href: '/templates',       icon: 'M3 3h18v18H3zM3 9h18M9 21V9' },
    { label: 'Voluntários',      href: '/voluntarios',     icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  ]

  const CSS = `
    .ts-wrap { position: relative; }
    .ts-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      width: 100%;
      min-width: 280px;
      background: #fff;
      border: 1.5px solid #EEEEEE;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(139,92,246,0.14);
      z-index: 9999;
      overflow: hidden;
      display: none;
    }
    .ts-dropdown.open { display: block; }
    .ts-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 16px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #1A1A1A;
      transition: background 0.12s;
      font-family: inherit;
    }
    .ts-item:hover, .ts-item.focused {
      background: #F5F0FF;
      color: #8B5CF6;
    }
    .ts-item:hover .ts-icon, .ts-item.focused .ts-icon { color: #8B5CF6; }
    .ts-icon {
      width: 32px; height: 32px;
      border-radius: 8px;
      background: #EDE9FE;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      color: #8B5CF6;
    }
    .ts-icon svg { width: 15px; height: 15px; }
    .ts-empty {
      padding: 16px;
      font-size: 13px;
      color: #AAAAAA;
      text-align: center;
    }
  `

  function injectStyles() {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)
  }

  function buildSVG(d) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`
  }

  function init() {
    const input = document.getElementById('topSearch')
    if (!input) return

    injectStyles()

    // Envolve o input em .ts-wrap
    const wrap = document.createElement('div')
    wrap.className = 'ts-wrap'
    input.parentNode.insertBefore(wrap, input)
    wrap.appendChild(input)

    // Dropdown
    const dropdown = document.createElement('div')
    dropdown.className = 'ts-dropdown'
    wrap.appendChild(dropdown)

    let focusedIndex = -1

    function render(q) {
      const term = q.trim().toLowerCase()
      if (!term) { dropdown.classList.remove('open'); return }

      const matches = PAGES.filter(p =>
        p.label.toLowerCase().includes(term) ||
        p.href.includes(term)
      )

      focusedIndex = -1

      if (!matches.length) {
        dropdown.innerHTML = `<div class="ts-empty">Nenhuma página encontrada</div>`
      } else {
        dropdown.innerHTML = matches.map((p, i) => `
          <div class="ts-item" data-href="${p.href}" data-idx="${i}">
            <div class="ts-icon">${buildSVG(p.icon)}</div>
            <span>${p.label}</span>
          </div>
        `).join('')

        dropdown.querySelectorAll('.ts-item').forEach(el => {
          el.addEventListener('click', () => {
            window.location.href = el.dataset.href
          })
          el.addEventListener('mouseenter', () => {
            focusedIndex = parseInt(el.dataset.idx)
            updateFocus()
          })
        })
      }

      dropdown.classList.add('open')
    }

    function updateFocus() {
      dropdown.querySelectorAll('.ts-item').forEach((el, i) => {
        el.classList.toggle('focused', i === focusedIndex)
      })
    }

    input.addEventListener('input', e => render(e.target.value))

    input.addEventListener('keydown', e => {
      const items = dropdown.querySelectorAll('.ts-item')
      if (!items.length) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        focusedIndex = Math.min(focusedIndex + 1, items.length - 1)
        updateFocus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        focusedIndex = Math.max(focusedIndex - 1, 0)
        updateFocus()
      } else if (e.key === 'Enter') {
        const focused = dropdown.querySelector('.ts-item.focused')
        if (focused) window.location.href = focused.dataset.href
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('open')
        input.blur()
      }
    })

    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) dropdown.classList.remove('open')
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
