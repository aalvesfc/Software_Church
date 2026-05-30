-- ============================================================
-- Tabela: db_cronograma
-- Descrição: Itens do cronograma de cada evento (multi-tenant)
-- Execute este script no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.db_cronograma (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid        NOT NULL REFERENCES public.db_church(id)  ON DELETE CASCADE,
  event_id    uuid        NOT NULL REFERENCES public.db_event(id)   ON DELETE CASCADE,
  musica_id   uuid        REFERENCES public.db_musica(id)            ON DELETE SET NULL,
  type        text        NOT NULL CHECK (type IN ('secao', 'tarefa', 'musica')),
  title       text        NOT NULL,
  description text,
  duration    interval,
  ordem       integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_db_cronograma_event_id   ON public.db_cronograma (event_id);
CREATE INDEX IF NOT EXISTS idx_db_cronograma_church_id  ON public.db_cronograma (church_id);
CREATE INDEX IF NOT EXISTS idx_db_cronograma_ordem      ON public.db_cronograma (event_id, ordem);

CREATE OR REPLACE TRIGGER trg_db_cronograma_updated_at
  BEFORE UPDATE ON public.db_cronograma
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.db_cronograma ENABLE ROW LEVEL SECURITY;
