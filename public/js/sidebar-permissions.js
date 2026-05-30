;(function () {
  // Cada regra controla a visibilidade do item de menu baseado em permissão.
  // Referência: doc_log/BANCO.md — tabela de permissões por perfil.
  const menuRules = [
    // ── Módulos com acesso de Líder ────────────────────────────────────────
    { selector: '[data-menu="ministerios"]',   module: 'ministerio',   action: 'ver' },
    { selector: '[data-menu="departamentos"]', module: 'departamento', action: 'ver' },
    { selector: '[data-menu="voluntarios"]',   module: 'voluntario',   action: 'ver' },
    { selector: '[data-menu="eventos"]',       module: 'evento',       action: 'ver' },
    { selector: '[data-menu="escalacao"]',     module: 'escala',       action: 'ver' },
    { selector: '[data-menu="cronograma"]',    module: 'cronograma',   action: 'ver' },
    { selector: '[data-menu="musicas"]',       module: 'musica',       action: 'ver' },
    { selector: '[data-menu="templates"]',     module: 'template',     action: 'ver' },
    { selector: '[data-menu="relatorios"]',    module: 'relatorio',    action: 'ver' },
    // ── Módulos owner-only ─────────────────────────────────────────────────
    { selector: '[data-menu="configuracoes"]', module: 'configuracao', action: 'ver' },
    { selector: '[data-menu="financeiro"]',    module: 'financeiro',   action: 'ver' },
    { selector: '[data-menu="perfis"]',        module: 'perfil',       action: 'ver' },
  ]

  /**
   * Lê permissions e perfil_slug do localStorage e ajusta display de cada
   * item de menu. Usa style.display (não remove o elemento) para poder
   * ser chamada novamente após atualização de cache.
   */
  function aplicar() {
    const permissions = JSON.parse(localStorage.getItem('permissions') || '[]')
    const perfil_slug = localStorage.getItem('perfil_slug')

    function temPermissao(module, action) {
      if (permissions.includes('*')) return true
      return permissions.includes(`${module}:${action}`)
    }

    menuRules.forEach(({ selector, module, action }) => {
      // Escopo restrito à sidebar-nav para não afetar links fora do menu
      document.querySelectorAll(`.sidebar-nav ${selector}`).forEach(el => {
        el.style.display = temPermissao(module, action) ? '' : 'none'
      })
    })

    // Dropdown de configurações (ex.: sub-menu com perfis + financeiro)
    document.querySelectorAll('[data-menu-dropdown="configuracoes"]').forEach(el => {
      el.style.display = temPermissao('configuracao', 'ver') ? '' : 'none'
    })

    // Indisponibilidade: visível apenas para voluntário
    document.querySelectorAll('.sidebar-nav [data-menu="indisponibilidade"]').forEach(el => {
      el.style.display = perfil_slug === 'voluntario' ? '' : 'none'
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicar)
  } else {
    aplicar()
  }

  // Exporta para ser chamada por auth-check.js após rebuscar permissões
  window.aplicarMenuPermissoes = aplicar
})()
