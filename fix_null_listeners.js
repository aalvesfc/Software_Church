const fs   = require('fs')
const path = require('path')

const dir = path.join(__dirname, 'public')
let updated = 0

// IDs que causam erro quando não existem no HTML
// Padrão: document.getElementById('X').addEventListener(  →  const _X = document.getElementById('X'); if (_X) _X.addEventListener(
const PROBLEMATIC_IDS = [
  'collapseTopBtn',   // escalacoes.html / escalacao.html — ID antigo, não existe
  'collapseBtn',      // pode não existir em alguns contextos
  'logoutBtn',        // já corrigido antes, mas pode ter restante
]

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(file => {
  const fp   = path.join(dir, file)
  let html   = fs.readFileSync(fp, 'utf8')
  let changed = false

  PROBLEMATIC_IDS.forEach(id => {
    const pattern = new RegExp(
      `document\\.getElementById\\('${id}'\\)\\.addEventListener\\(`,
      'g'
    )
    if (pattern.test(html)) {
      html = html.replace(
        new RegExp(`document\\.getElementById\\('${id}'\\)\\.addEventListener\\(`, 'g'),
        `(document.getElementById('${id}')||{addEventListener:()=>{}}).addEventListener(`
      )
      changed = true
    }
  })

  if (changed) {
    fs.writeFileSync(fp, html, 'utf8')
    console.log(`✓ ${file}`)
    updated++
  }
})

console.log(`\nPronto — ${updated} páginas corrigidas.`)
