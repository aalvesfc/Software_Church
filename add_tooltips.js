const fs   = require('fs')
const path = require('path')

const dir = path.join(__dirname, 'public')

// Mapeamento data-menu → label do tooltip
const LABELS = {
  dashboard:        'Dashboard',
  eventos:          'Eventos',
  escalacao:        'Escalações',
  indisponibilidade:'Indisponibilidade',
  musicas:          'Músicas',
  ministerios:      'Ministérios',
  departamentos:    'Departamentos',
  voluntarios:      'Voluntários',
  templates:        'Templates',
  configuracoes:    'Configurações',
}

const TOOLTIP_CSS = `
    /* ── Tooltip sidebar ── */
    .nav-item {
      position: relative;
    }
    .nav-item::after {
      content: attr(data-tooltip);
      position: absolute;
      left: calc(100% + 12px);
      top: 50%;
      transform: translateY(-50%) translateX(-6px);
      background: #1a1a1a;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 8px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease, transform 0.15s ease;
      z-index: 9999;
      letter-spacing: 0.1px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.28);
    }
    .nav-item::before {
      content: '';
      position: absolute;
      left: calc(100% + 6px);
      top: 50%;
      transform: translateY(-50%) translateX(-6px);
      border: 5px solid transparent;
      border-right-color: #1a1a1a;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease, transform 0.15s ease;
      z-index: 9999;
    }
    .nav-item:hover::after,
    .nav-item:hover::before {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
`

let updated = 0

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(file => {
  const fp = path.join(dir, file)
  let html = fs.readFileSync(fp, 'utf8')

  // 1) Adicionar CSS se ainda não existir
  if (!html.includes('Tooltip sidebar')) {
    // Insere após o bloco de sidebar-collapsed
    html = html.replace(
      /body\.sidebar-collapsed #collapseBtn svg \{ transform: rotate\(180deg\); \}/,
      m => m + '\n' + TOOLTIP_CSS
    )
  }

  // 2) Adicionar data-tooltip em cada nav-item com data-menu
  html = html.replace(
    /(<a class="nav-item[^"]*"[^>]*data-menu="([^"]+)"[^>]*>)/g,
    (match, fullTag, menuKey) => {
      if (fullTag.includes('data-tooltip')) return match  // já tem
      const label = LABELS[menuKey]
      if (!label) return match
      return fullTag.replace('data-menu=', `data-tooltip="${label}" data-menu=`)
    }
  )

  fs.writeFileSync(fp, html, 'utf8')
  updated++
  console.log(`✓ ${file}`)
})

console.log(`\nPronto — ${updated} páginas atualizadas.`)
