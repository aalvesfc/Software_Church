-- Adiciona tipo de notificação: novo cadastro aguardando aprovação
INSERT INTO public.db_notificacao_tipo (id, code, name)
VALUES (6, 'novo_cadastro', 'Novo cadastro aguardando aprovação')
ON CONFLICT (id) DO NOTHING;
