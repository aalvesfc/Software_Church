// Gera o hash da senha e cria o usuário admin no Supabase
// Uso: node scripts/criar_admin.js
require('dotenv').config()
const bcrypt = require('bcryptjs')
const supabase = require('../lib/supabase')

async function main() {
  const senha = 'Admin@123'
  const hash  = await bcrypt.hash(senha, 10)

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
  console.log('Login: admin@hugapp.com / Admin@123')
}

main()
