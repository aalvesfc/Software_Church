-- ============================================================
-- Tabela: db_event
-- Descrição: Eventos e programações de cada igreja (multi-tenant)
-- Execute este script no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.db_event (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id            uuid        NOT NULL REFERENCES public.db_church(id) ON DELETE CASCADE,
  template_id          uuid        REFERENCES public.db_template_event(id) ON DELETE SET NULL,
  parent_event_id      uuid        REFERENCES public.db_event(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  description          text,
  start_date           date        NOT NULL,
  end_date             date,
  start_time           time,
  end_time             time,
  location             text,
  has_setlist          boolean     NOT NULL DEFAULT false,
  has_cronograma       boolean     NOT NULL DEFAULT false,
  recurrence_type      text        CHECK (recurrence_type IN ('semanal', 'quinzenal', 'mensal', 'personalizado')),
  recurrence_end_date  date,
  recurrence_config    jsonb,
  status               text        NOT NULL DEFAULT 'agendado'
                                   CHECK (status IN ('agendado', 'concluido', 'cancelado')),
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_db_event_church_id       ON public.db_event (church_id);
CREATE INDEX IF NOT EXISTS idx_db_event_start_date      ON public.db_event (start_date);
CREATE INDEX IF NOT EXISTS idx_db_event_status          ON public.db_event (church_id, status);
CREATE INDEX IF NOT EXISTS idx_db_event_parent_event_id ON public.db_event (parent_event_id);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_db_event_updated_at ON public.db_event;
CREATE TRIGGER trg_db_event_updated_at
  BEFORE UPDATE ON public.db_event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: habilita Row Level Security (o backend usa service key e ignora RLS,
-- mas é boa prática manter ativo para segurança extra)
ALTER TABLE public.db_event ENABLE ROW LEVEL SECURITY;

-- Política: apenas o service role (backend) acessa — sem políticas abertas
-- O controle de acesso é feito pelo authMiddleware + church_id no backend.

-- ============================================================
-- Se a tabela já existir com o schema antigo, rode o ALTER abaixo
-- para adicionar as colunas novas sem recriar a tabela:
-- ============================================================
-- ALTER TABLE public.db_event
--   ADD COLUMN IF NOT EXISTS end_date             date,
--   ADD COLUMN IF NOT EXISTS has_setlist          boolean NOT NULL DEFAULT false,
--   ADD COLUMN IF NOT EXISTS has_cronograma       boolean NOT NULL DEFAULT false,
--   ADD COLUMN IF NOT EXISTS recurrence_type      text CHECK (recurrence_type IN ('semanal','quinzenal','mensal','personalizado')),
--   ADD COLUMN IF NOT EXISTS recurrence_end_date  date,
--   ADD COLUMN IF NOT EXISTS recurrence_config    jsonb,
--   ADD COLUMN IF NOT EXISTS parent_event_id      uuid REFERENCES public.db_event(id) ON DELETE CASCADE,
--   ADD COLUMN IF NOT EXISTS is_active            boolean NOT NULL DEFAULT true;
--
-- -- Renomear colunas do schema antigo (se existirem):
-- ALTER TABLE public.db_event RENAME COLUMN event_date TO start_date;
-- ALTER TABLE public.db_event RENAME COLUMN time_start TO start_time;
-- ALTER TABLE public.db_event RENAME COLUMN time_end   TO end_time;
