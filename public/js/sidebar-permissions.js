;(function () {

  // ── Configuração de menus por perfil efetivo ───────────────────────────────
  const MENU_LIDER = [
    'dashboard', 'departamentos', 'escalacao', 'eventos',
    'ministerios', 'musicas', 'templates', 'voluntarios',
    'notificacoes', 'presenca',
  ]

  // Itens a ocultar mesmo quando o perfil tem acesso total ('*')
  const MENU_EXCLUDE = {
    owner: ['configuracoes'],
  }

  const MENU_CONFIG = {
    owner:         ['*'],
    admin:         ['*'],
    sistema_owner: ['*'],

    lider:              MENU_LIDER, // fallback para slug puro do banco
    lider_departamento: MENU_LIDER,
    lider_ministerio:   MENU_LIDER,

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
      ['lider', 'lider_departamento', 'lider_ministerio'].includes(perfil_slug) &&
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
    const excluidos = MENU_EXCLUDE[perfilEfetivo] || []

    document.querySelectorAll('[data-menu]').forEach(el => {
      const menu = el.dataset.menu
      const visivel = (tudo || permitidos.includes(menu)) && !excluidos.includes(menu)
      el.style.display = visivel ? '' : 'none'
    })

    // Dropdown "Configurações" no avatar-dropdown
    document.querySelectorAll('[data-menu-dropdown="configuracoes"]').forEach(el => {
      const visivel = (tudo || permitidos.includes('configuracoes')) && !excluidos.includes('configuracoes')
      el.style.display = visivel ? '' : 'none'
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
