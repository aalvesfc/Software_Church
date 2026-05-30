const fs   = require('fs')
const path = require('path')

const dir = path.join(__dirname, 'public')
let updated = 0

// CSS a injetar no bloco do sidebar redesign
// Botão restaurar: left:16px + width:40px = right edge em x=56
// Conteúdo com padding-left:60px + margin-left:16px → inicia em x=76 (sempre à direita do botão)
const INJECT_CSS = `
    /* ── Quando collapsed: empurra conteúdo à direita do botão restaurar ── */
    body.sidebar-collapsed .content {
      padding-left: 60px !important;
    }
    body.sidebar-collapsed .topbar {
      padding-left: 64px !important;
    }
`

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(file => {
  const fp = path.join(dir, file)
  let html = fs.readFileSync(fp, 'utf8')

  // Evita duplicata
  if (html.includes('empurra conteúdo à direita do botão restaurar')) {
    console.log(`  ${file} (já tem)`)
    return
  }

  // Injeta após a linha do body.sidebar-collapsed .main { margin-left: 16px }
  const anchor = `body.sidebar-collapsed .main { margin-left: 16px !important; }`
  if (!html.includes(anchor)) {
    console.log(`  ${file} (ancora não encontrada)`)
    return
  }

  html = html.replace(anchor, anchor + INJECT_CSS)
  fs.writeFileSync(fp, html, 'utf8')
  console.log(`✓ ${file}`)
  updated++
})

console.log(`\nPronto — ${updated} páginas atualizadas.`)
