const fs   = require('fs')
const path = require('path')
const dir  = path.join(__dirname, 'public')

// Ordem canônica alfabética (pt-BR, sem acento na chave de sort)
const SORT_KEY = {
  'configuracoes':    'configuracoes',
  'dashboard':        'dashboard',
  'departamentos':    'departamentos',
  'escalacao':        'escalacao',
  'eventos':          'eventos',
  'indisponibilidade':'indisponibilidade',
  'ministerios':      'ministerios',
  'musicas':          'musicas',
  'templates':        'templates',
  'voluntarios':      'voluntarios',
}

let updated = 0
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'))

files.forEach(file => {
  const fp  = path.join(dir, file)
  let html  = fs.readFileSync(fp, 'utf8')

  // Extrai bloco <nav class="sidebar-nav">...</nav>
  const navMatch = html.match(/(<nav class="sidebar-nav">)([\s\S]*?)(<\/nav>)/)
  if (!navMatch) return

  const navOpen    = navMatch[1]
  const navContent = navMatch[2]
  const navClose   = navMatch[3]

  // Extrai cada <a class="nav-item...">...</a>
  const itemRe = /( *<a class="nav-item[^"]*"[\s\S]*?<\/a>\n?)/g
  const items  = []
  let m
  while ((m = itemRe.exec(navContent)) !== null) {
    items.push(m[1])
  }

  if (items.length < 2) return

  // Determina a chave de sort de cada item pelo data-menu
  function sortKey(item) {
    const mm = item.match(/data-menu="([^"]+)"/)
    if (!mm) return 'zzz'
    return SORT_KEY[mm[1]] || mm[1]
  }

  const sorted = [...items].sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'pt-BR'))

  // Reconstrói o nav
  const newNavContent = sorted.join('')
  if (newNavContent === navContent) return   // sem mudança

  const newNav = navOpen + '\n' + newNavContent + navClose
  html = html.replace(navOpen + navContent + navClose, newNav)
  fs.writeFileSync(fp, html, 'utf8')
  console.log('✓ ' + file)
  updated++
})

console.log('\nPronto — ' + updated + ' páginas atualizadas.')
