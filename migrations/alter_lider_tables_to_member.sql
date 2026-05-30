-- Recria as tabelas de líder usando user_id → db_user (usuários com login)
-- Execute no Supabase SQL Editor

DROP TABLE IF EXISTS db_ministry_lider;
CREATE TABLE db_ministry_lider (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   uuid NOT NULL REFERENCES db_church(id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES db_ministry(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES db_user(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ministry_id, user_id)
);

ALTER TABLE db_ministry_lider ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vê líderes de ministério da sua igreja"
  ON db_ministry_lider FOR SELECT TO authenticated
  USING (church_id = get_my_church_id());

DROP TABLE IF EXISTS db_department_lider;
CREATE TABLE db_department_lider (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid NOT NULL REFERENCES db_church(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES db_department(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES db_user(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(department_id, user_id)
);

ALTER TABLE db_department_lider ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vê líderes de departamento da sua igreja"
  ON db_department_lider FOR SELECT TO authenticated
  USING (church_id = get_my_church_id());
