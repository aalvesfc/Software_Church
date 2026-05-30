-- ============================================================
-- Tabela: db_escala
-- Uma escala por (event_id, department_id) — conforme BANCO.md
-- db_escala_item já existe no banco
-- Execute este script no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.db_escala (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid        NOT NULL REFERENCES public.db_church(id)      ON DELETE CASCADE,
  event_id      uuid        NOT NULL REFERENCES public.db_event(id)       ON DELETE CASCADE,
  department_id uuid        NOT NULL REFERENCES public.db_department(id)  ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_db_escala_church_id ON public.db_escala (church_id);
CREATE INDEX IF NOT EXISTS idx_db_escala_event_id  ON public.db_escala (event_id);
CREATE INDEX IF NOT EXISTS idx_db_escala_dept_id   ON public.db_escala (department_id);

CREATE OR REPLACE TRIGGER trg_db_escala_updated_at
  BEFORE UPDATE ON public.db_escala
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.db_escala ENABLE ROW LEVEL SECURITY;
