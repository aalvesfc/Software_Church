;(function () {
  /**
   * sidebar-ui.js
   * 1. Cria div.sidebar-footer no final da sidebar.
   * 2. Move o collapseBtn do topbar para o footer (preserva o listener).
   * 3. Move o avatar-menu-wrap do topbar para o footer.
   * 4. Injeta botão flutuante para restaurar a sidebar quando colapsada.
   */
  function initSidebarUI() {
    const sidebar = document.querySelector('.sidebar')
    if (!sidebar) return

    // 1. Cria o footer da sidebar
    let footer = sidebar.querySelector(':scope > .sidebar-footer')
    if (!footer) {
      footer = document.createElement('div')
      footer.className = 'sidebar-footer'
      sidebar.appendChild(footer)
    }

    // 2. Move collapseBtn para o footer (preserva event listeners)
    const collapseBtn = document.querySelector('.topbar-actions #collapseBtn')
    if (collapseBtn) footer.appendChild(collapseBtn)

    // 3. Move avatar-menu-wrap para o footer
    const avatarWrap = document.querySelector('.topbar-actions .avatar-menu-wrap')
    if (avatarWrap) footer.appendChild(avatarWrap)

    // 4. Botão flutuante para restaurar a sidebar quando colapsada
    if (!document.getElementById('sidebarRestoreBtn')) {
      const btn = document.createElement('button')
      btn.id        = 'sidebarRestoreBtn'
      btn.className = 'sidebar-restore-btn'
      btn.title     = 'Mostrar menu'
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>`
      btn.addEventListener('click', () => {
        document.body.classList.remove('sidebar-collapsed')
        localStorage.setItem('sidebar-collapsed', '0')
      })
      document.body.appendChild(btn)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarUI)
  } else {
    initSidebarUI()
  }
})()
