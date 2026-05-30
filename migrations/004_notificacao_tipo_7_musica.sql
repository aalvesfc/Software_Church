-- Adiciona tipo de notificação: nova música aguardando aprovação
INSERT INTO public.db_notificacao_tipo (id, code, name)
VALUES (7, 'nova_musica', 'Nova música aguardando aprovação')
ON CONFLICT (id) DO NOTHING;

-- Adiciona coluna is_music_dept na tabela db_department (identifica dept musical)
ALTER TABLE public.db_department
  ADD COLUMN IF NOT EXISTS is_music_dept boolean NOT NULL DEFAULT false;
