(() => {
  function init() {
    const sidebar = document.querySelector('.sidebar')
    const topbarActions = document.querySelector('.topbar-actions')
    if (!sidebar || !topbarActions) return

    // Overlay
    const overlay = document.createElement('div')
    overlay.className = 'sidebar-mobile-overlay'
    document.body.appendChild(overlay)

    // Botão hamburger
    const btn = document.createElement('button')
    btn.className = 'mobile-menu-btn'
    btn.title = 'Menu'
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
    topbarActions.prepend(btn)

    function open() {
      sidebar.classList.add('mobile-open')
      overlay.classList.add('open')
      document.body.style.overflow = 'hidden'
    }

    function close() {
      sidebar.classList.remove('mobile-open')
      overlay.classList.remove('open')
      document.body.style.overflow = ''
    }

    btn.addEventListener('click', () => {
      sidebar.classList.contains('mobile-open') ? close() : open()
    })

    overlay.addEventListener('click', close)

    // Fecha ao clicar em item do menu no mobile
    sidebar.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) close()
      })
    })

    // Fecha ao redimensionar para desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) close()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
