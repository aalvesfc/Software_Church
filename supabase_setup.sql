-- Execute esse SQL no Supabase > SQL Editor

create table if not exists public.usuarios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text unique not null,
  senha_hash  text not null,
  perfil      text not null default 'voluntario'
                check (perfil in ('admin', 'lider', 'voluntario')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Índice para busca por e-mail
create index if not exists idx_usuarios_email on public.usuarios (email);

-- RLS: apenas o service_role (backend) acessa esta tabela
alter table public.usuarios enable row level security;

-- Usuário admin inicial (senha: Admin@123)
-- Gere o hash via: node -e "const b=require('bcryptjs');b.hash('Admin@123',10).then(console.log)"
-- e substitua abaixo antes de executar
insert into public.usuarios (nome, email, senha_hash, perfil)
values ('Administrador', 'admin@hugapp.com', '$HASH_AQUI', 'admin')
on conflict (email) do nothing;
