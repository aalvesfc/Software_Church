;(function () {

  // ── Configuração de menus por perfil efetivo ───────────────────────────────
  const MENU_CONFIG = {
    owner:         ['*'],
    admin:         ['*'],
    sistema_owner: ['*'],

    lider_departamento: [
      'dashboard', 'departamentos', 'escalacao', 'eventos',
      'ministerios', 'musicas', 'templates', 'voluntarios',
      'notificacoes', 'presenca',
    ],

    lider_ministerio: [
      'dashboard', 'departamentos', 'escalacao', 'eventos',
      'ministerios', 'musicas', 'templates', 'voluntarios',
      'notificacoes', 'presenca',
    ],

    voluntario: [
      'dashboard', 'escalacao', 'eventos',
      'indisponibilidade', 'musicas', 'notificacoes',
    ],

    secretario: [
      'dashboard', 'membros', 'voluntarios',
      'eventos', 'templates', 'musicas',
    ],
  }

  function calcularPerfilEfetivo() {
    const perfil_slug  = localStorage.getItem('perfil_slug') || ''
    const modulo_ativo = localStorage.getItem('modulo_ativo')

    if (
      ['lider_departamento', 'lider_ministerio'].includes(perfil_slug) &&
      modulo_ativo === 'voluntario'
    ) {
      return 'voluntario'
    }
    return perfil_slug
  }

  function aplicar() {
    const perfilEfetivo = calcularPerfilEfetivo()

    // Persiste para que outras páginas usem sem recalcular
    localStorage.setItem('perfil_efetivo', perfilEfetivo)

    const permitidos = MENU_CONFIG[perfilEfetivo] || []
    const tudo = permitidos.includes('*')

    document.querySelectorAll('[data-menu]').forEach(el => {
      const menu = el.dataset.menu
      el.style.display = tudo || permitidos.includes(menu) ? '' : 'none'
    })

    // Dropdown "Configurações" no avatar-dropdown
    document.querySelectorAll('[data-menu-dropdown="configuracoes"]').forEach(el => {
      el.style.display = tudo || permitidos.includes('configuracoes') ? '' : 'none'
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicar)
  } else {
    aplicar()
  }

  window.aplicarMenuPermissoes = aplicar
  window.calcularPerfilEfetivo = calcularPerfilEfetivo
})()
