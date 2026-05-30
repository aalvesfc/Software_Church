-- ============================================================
-- Tabela: db_musica
-- Descrição: Repertório de músicas de cada igreja (multi-tenant)
-- Execute este script no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.db_musica (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id  uuid        NOT NULL REFERENCES public.db_church(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  artist     text,
  tom        text,
  bpm        integer,
  duration   interval,
  notes      text,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_db_musica_church_id ON public.db_musica (church_id);
CREATE INDEX IF NOT EXISTS idx_db_musica_title     ON public.db_musica (church_id, title);

CREATE OR REPLACE TRIGGER trg_db_musica_updated_at
  BEFORE UPDATE ON public.db_musica
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.db_musica ENABLE ROW LEVEL SECURITY;
