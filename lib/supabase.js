const { createClient } = require('@supabase/supabase-js')

// Cliente admin — acessa tudo, ignora RLS (usado no backend)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Cliente público — respeita RLS (usado para auth em nome do usuário)
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

module.exports = { supabaseAdmin, supabaseAuth }
