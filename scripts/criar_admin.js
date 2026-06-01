// Gera o hash da senha e cria o usuário admin no Supabase
// Uso: ADMIN_PASSWORD=suasenha node scripts/criar_admin.js
//   ou: node scripts/criar_admin.js SuaSenhaAqui
// SEC-011: senha nunca hardcoded — lida de variável de ambiente ou argumento CLI
require('dotenv').config()
const bcrypt = require('bcryptjs')
const supabase = require('../lib/supabase')

async function main() {
  // Lê senha de variável de ambiente ou argumento CLI
  const senha = process.env.ADMIN_PASSWORD || process.argv[2]

  if (!senha) {
    console.error('ERRO: senha obrigatória.')
    console.error('Use: ADMIN_PASSWORD=suasenha node scripts/criar_admin.js')
    console.error(' ou: node scripts/criar_admin.js SuaSenhaAqui')
    process.exit(1)
  }

  const hash = await bcrypt.hash(senha, 10)

  const { data, error } = await supabase
    .from('usuarios')
    .insert({ nome: 'Administrador', email: 'admin@hugapp.com', senha_hash: hash, perfil: 'admin' })
    .select('id, email')
    .single()

  if (error) {
    console.error('Erro:', error.message)
    process.exit(1)
  }

  console.log('Admin criado:', data)
  // SEC-011: nunca exibe a senha no log
  console.log('Login: admin@hugapp.com / [senha fornecida]')
}

main()
