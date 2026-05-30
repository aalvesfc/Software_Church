-- Tabela de líderes de departamento
CREATE TABLE IF NOT EXISTS db_department_leader (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL,
  member_id     UUID NOT NULL,
  church_id     UUID NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, member_id)
);
