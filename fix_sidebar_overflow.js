const fs   = require('fs')
const path = require('path')

const dir = path.join(__dirname, 'public')
let updated = 0

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(file => {
  const fp = path.join(dir, file)
  let html = fs.readFileSync(fp, 'utf8')

  // Fix sidebar overflow: hidden → visible (para tooltips funcionarem)
  const before = html
  html = html.replace(
    /\.sidebar \{([^}]*?)overflow: hidden !important;/g,
    (m, inner) => `.sidebar {${inner}overflow: visible !important;`
  )

  if (html !== before) {
    fs.writeFileSync(fp, html, 'utf8')
    console.log(`✓ ${file}`)
    updated++
  } else {
    console.log(`  ${file} (sem alteração)`)
  }
})

console.log(`\nPronto — ${updated} páginas corrigidas.`)
