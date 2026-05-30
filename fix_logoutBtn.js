const fs   = require('fs')
const path = require('path')

const dir = path.join(__dirname, 'public')
let updated = 0

// Padrão a substituir:
// document.getElementById('logoutBtn').addEventListener('click', e => {
// Por versão null-safe:
// const _lBtn = document.getElementById('logoutBtn'); if (_lBtn) _lBtn.addEventListener('click', e => {
// OBS: o bloco fecha com });  — precisamos apenas envolver o início

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(file => {
  const fp = path.join(dir, file)
  let html = fs.readFileSync(fp, 'utf8')

  if (!html.includes("document.getElementById('logoutBtn').addEventListener")) {
    return
  }

  // Substituição segura: envolve com null-check
  html = html.replace(
    /document\.getElementById\('logoutBtn'\)\.addEventListener\('click'/g,
    "const _lBtn = document.getElementById('logoutBtn'); if (_lBtn) _lBtn.addEventListener('click'"
  )

  fs.writeFileSync(fp, html, 'utf8')
  console.log(`✓ ${file}`)
  updated++
})

console.log(`\nPronto — ${updated} páginas corrigidas.`)
