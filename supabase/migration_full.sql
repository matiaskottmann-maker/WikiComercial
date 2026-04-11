-- =========================================================
-- WikiFEDUC — Migración completa a nuevo proyecto Supabase
-- =========================================================
-- Ejecutar TODO este archivo en: SQL Editor → New query → Run
-- Es idempotente: se puede correr varias veces sin romper nada.
-- =========================================================

-- ---------- 1. LIMPIEZA (por si se reintenta) ----------
DROP VIEW  IF EXISTS profesores_con_stats;
DROP TABLE IF EXISTS aportes_wiki        CASCADE;
DROP TABLE IF EXISTS evaluaciones        CASCADE;
DROP TABLE IF EXISTS profesor_asignatura CASCADE;
DROP TABLE IF EXISTS asignaturas         CASCADE;
DROP TABLE IF EXISTS profesores          CASCADE;

-- ---------- 2. TABLAS ----------

CREATE TABLE profesores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  apellido        text NOT NULL,
  slug            text NOT NULL UNIQUE,
  foto_url        text,
  email           text,
  edit_token_hash text,
  ip_hash         text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE asignaturas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  codigo        text UNIQUE,
  slug          text NOT NULL UNIQUE,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE profesor_asignatura (
  profesor_id   uuid REFERENCES profesores(id)  ON DELETE CASCADE,
  asignatura_id uuid REFERENCES asignaturas(id) ON DELETE CASCADE,
  PRIMARY KEY (profesor_id, asignatura_id)
);

CREATE TABLE evaluaciones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id           uuid REFERENCES profesores(id)  ON DELETE CASCADE NOT NULL,
  asignatura_id         uuid REFERENCES asignaturas(id) NOT NULL,
  rating_general        int2 CHECK (rating_general        BETWEEN 1 AND 5) NOT NULL,
  rating_claridad       int2 CHECK (rating_claridad       BETWEEN 1 AND 5) NOT NULL,
  rating_exigencia      int2 CHECK (rating_exigencia      BETWEEN 1 AND 5) NOT NULL,
  rating_disponibilidad int2 CHECK (rating_disponibilidad BETWEEN 1 AND 5) NOT NULL,
  comentario            text CHECK (char_length(comentario) <= 1000),
  semestre              text,
  aprobado              boolean,
  ip_hash               text NOT NULL,
  edit_token_hash       text,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE aportes_wiki (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id     uuid REFERENCES profesores(id) ON DELETE CASCADE NOT NULL,
  seccion         text NOT NULL CHECK (seccion IN (
    'curriculum', 'personalidad', 'sus_clases',
    'sus_pruebas', 'recomendaciones', 'datos_freak', 'frases_tipicas'
  )),
  contenido       text NOT NULL CHECK (char_length(contenido) BETWEEN 1 AND 500),
  ip_hash         text NOT NULL,
  edit_token_hash text,
  created_at      timestamptz DEFAULT now()
);

-- ---------- 3. VISTA ----------

CREATE OR REPLACE VIEW profesores_con_stats AS
SELECT
  p.*,
  COUNT(e.id)::int                                AS total_evaluaciones,
  ROUND(AVG(e.rating_general)::numeric, 1)        AS avg_general,
  ROUND(AVG(e.rating_claridad)::numeric, 1)       AS avg_claridad,
  ROUND(AVG(e.rating_exigencia)::numeric, 1)      AS avg_exigencia,
  ROUND(AVG(e.rating_disponibilidad)::numeric, 1) AS avg_disponibilidad
FROM profesores p
LEFT JOIN evaluaciones e ON e.profesor_id = p.id
GROUP BY p.id;

-- ---------- 4. ÍNDICES ----------

CREATE INDEX idx_evaluaciones_profesor   ON evaluaciones(profesor_id);
CREATE INDEX idx_evaluaciones_asignatura ON evaluaciones(asignatura_id);
CREATE INDEX idx_evaluaciones_ip_hash    ON evaluaciones(ip_hash);
CREATE INDEX idx_profesores_slug         ON profesores(slug);
CREATE INDEX idx_profesores_ip_hash      ON profesores(ip_hash);
CREATE INDEX idx_asignaturas_slug        ON asignaturas(slug);
CREATE INDEX idx_aportes_wiki_profesor   ON aportes_wiki(profesor_id);
CREATE INDEX idx_aportes_wiki_seccion    ON aportes_wiki(profesor_id, seccion);

-- ---------- 5. ROW LEVEL SECURITY ----------

ALTER TABLE profesores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaturas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profesor_asignatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE aportes_wiki        ENABLE ROW LEVEL SECURITY;

-- profesores
DROP POLICY IF EXISTS "Profesores son públicos"           ON profesores;
DROP POLICY IF EXISTS "Cualquiera puede crear profesores" ON profesores;
CREATE POLICY "Profesores son públicos"
  ON profesores FOR SELECT TO public USING (true);
CREATE POLICY "Cualquiera puede crear profesores"
  ON profesores FOR INSERT TO public WITH CHECK (true);

-- asignaturas
DROP POLICY IF EXISTS "Asignaturas son públicas" ON asignaturas;
CREATE POLICY "Asignaturas son públicas"
  ON asignaturas FOR SELECT TO public USING (true);

-- profesor_asignatura
DROP POLICY IF EXISTS "Relación profesor-asignatura es pública" ON profesor_asignatura;
DROP POLICY IF EXISTS "Cualquiera puede asignar asignaturas"    ON profesor_asignatura;
CREATE POLICY "Relación profesor-asignatura es pública"
  ON profesor_asignatura FOR SELECT TO public USING (true);
CREATE POLICY "Cualquiera puede asignar asignaturas"
  ON profesor_asignatura FOR INSERT TO public WITH CHECK (true);

-- evaluaciones
DROP POLICY IF EXISTS "Evaluaciones son públicas"              ON evaluaciones;
DROP POLICY IF EXISTS "Cualquiera puede insertar evaluaciones" ON evaluaciones;
CREATE POLICY "Evaluaciones son públicas"
  ON evaluaciones FOR SELECT TO public USING (true);
CREATE POLICY "Cualquiera puede insertar evaluaciones"
  ON evaluaciones FOR INSERT TO public WITH CHECK (true);

-- aportes_wiki
DROP POLICY IF EXISTS "Aportes wiki son públicos"              ON aportes_wiki;
DROP POLICY IF EXISTS "Cualquiera puede insertar aportes wiki" ON aportes_wiki;
CREATE POLICY "Aportes wiki son públicos"
  ON aportes_wiki FOR SELECT TO public USING (true);
CREATE POLICY "Cualquiera puede insertar aportes wiki"
  ON aportes_wiki FOR INSERT TO public WITH CHECK (true);

-- NOTA: UPDATE y DELETE no tienen policies → nadie puede hacerlo vía RLS.
-- El backend usa service_role que bypasea RLS (comportamiento correcto).

-- ---------- 6. STORAGE BUCKET: fotos-profesores ----------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-profesores',
  'fotos-profesores',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura pública del bucket (la escritura la hace el backend con service_role)
DROP POLICY IF EXISTS "Fotos profesores lectura pública" ON storage.objects;
CREATE POLICY "Fotos profesores lectura pública"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'fotos-profesores');

-- ---------- 7. VERIFICACIÓN ----------
-- Corre esto después para confirmar que todo quedó:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
--
--   SELECT schemaname, tablename, policyname FROM pg_policies
--   WHERE schemaname IN ('public','storage') ORDER BY tablename;
--
--   SELECT id, name, public FROM storage.buckets WHERE id = 'fotos-profesores';

-- =========================================================
-- LISTO. Schema + RLS + Bucket creados.
-- Siguiente paso: actualizar .env.local y Vercel con las
-- nuevas URL y keys del proyecto (Settings → API).
-- =========================================================
