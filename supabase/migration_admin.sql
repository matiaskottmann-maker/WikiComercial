-- =========================================================
-- WikiFEDUC — Migración: admins y reportes
-- Ejecutar en: Supabase SQL Editor → New query → Run
-- Idempotente: se puede correr varias veces.
-- =========================================================

-- ---------- 1. TABLA admins ----------
CREATE TABLE IF NOT EXISTS admins (
  email      text PRIMARY KEY,            -- siempre en minúsculas
  added_by   text,                        -- email del admin que lo agregó
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo accesible vía service_role desde el servidor.

INSERT INTO admins (email) VALUES
  ('diegodomeyko@estudiante.uc.cl'),
  ('r.olalde@uc.cl'),
  ('matiaskottmann@estudiante.uc.cl'),
  ('vicentenazer@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- ---------- 2. TABLA reportes ----------
CREATE TABLE IF NOT EXISTS reportes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id uuid REFERENCES evaluaciones(id) ON DELETE CASCADE,
  aporte_id     uuid REFERENCES aportes_wiki(id) ON DELETE CASCADE,
  motivo        text CHECK (char_length(motivo) <= 500),
  ip_hash       text NOT NULL,
  resuelto      boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  CHECK (num_nonnulls(evaluacion_id, aporte_id) = 1)
);

-- 1 reporte por IP por contenido
CREATE UNIQUE INDEX IF NOT EXISTS reportes_ip_evaluacion
  ON reportes (ip_hash, evaluacion_id) WHERE evaluacion_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reportes_ip_aporte
  ON reportes (ip_hash, aporte_id) WHERE aporte_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reportes_pendientes
  ON reportes (resuelto, created_at);

ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;
-- Sin políticas: INSERT/SELECT/UPDATE solo vía API routes con service_role.

-- ---------- 3. VERIFICACIÓN ----------
--   SELECT * FROM admins;
--   SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('admins','reportes');
