# WikiFEDUC — Guía de migración a nuevo proyecto Supabase

Esta guía te lleva paso a paso para recrear el backend del proyecto en una cuenta distinta de Supabase. Sigue los pasos **en orden**.

---

## 0. Lo que vas a necesitar

- [ ] Acceso a la cuenta Supabase **destino** (donde vive la nueva organización)
- [ ] El archivo `migration_full.sql` (está en esta misma carpeta)
- [ ] Acceso al repo del frontend para cambiar `.env.local`
- [ ] Acceso al dashboard de Vercel para cambiar las env vars de producción
- [ ] *(Solo si la DB vieja tiene datos que quieres conservar)* la password de la DB vieja

---

## 1. Crear el proyecto nuevo

1. Entra a https://supabase.com/dashboard
2. Selecciona la **organización destino** (la de tu primo)
3. Click en **New project**
4. Llena los campos:
   - **Name:** `wikifeduc` (o como prefieras)
   - **Database password:** genera una fuerte y **guárdala**
   - **Region:** `South America (São Paulo)` o la más cercana a Chile
   - **Pricing plan:** Free
5. Click **Create new project** y espera ~2 minutos a que provisione

---

## 2. Correr el SQL de migración

1. En el proyecto nuevo, ve a **SQL Editor** (icono en la barra izquierda)
2. Click **New query**
3. Abre `supabase/migration_full.sql` de este repo
4. Copia **todo** el contenido y pégalo en el editor
5. Click **Run** (o `Cmd+Enter`)
6. Deberías ver `Success. No rows returned`

Esto crea:
- 5 tablas: `profesores`, `asignaturas`, `profesor_asignatura`, `evaluaciones`, `aportes_wiki`
- 1 vista: `profesores_con_stats`
- 8 índices
- RLS activado en las 5 tablas + 9 policies
- Bucket de Storage `fotos-profesores` (público, 5MB, solo JPG/PNG/WebP)
- Policy de lectura pública del bucket

### Verificar que todo quedó

Pega estas queries en SQL Editor para confirmar:

```sql
-- Tablas creadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
-- Debe devolver: aportes_wiki, asignaturas, evaluaciones, profesor_asignatura, profesores, profesores_con_stats

-- Policies creadas
SELECT tablename, policyname FROM pg_policies
WHERE schemaname IN ('public','storage') ORDER BY tablename;
-- Debe haber 9 policies en public + 1 en storage.objects

-- Bucket creado
SELECT id, name, public, file_size_limit FROM storage.buckets
WHERE id = 'fotos-profesores';
-- public debe ser true, file_size_limit = 5242880
```

---

## 3. Migrar los datos viejos *(SALTAR SI LA DB VIEJA ESTÁ VACÍA)*

### 3.1 Exportar datos de la DB vieja

Desde tu terminal local, necesitas el **connection string** del proyecto **viejo**:
- Ve al proyecto viejo → **Project Settings → Database → Connection string → URI**
- Copia el string (empieza con `postgresql://postgres:...`)

```bash
pg_dump "postgresql://postgres:[PASSWORD_VIEJA]@db.[REF_VIEJO].supabase.co:5432/postgres" \
  --data-only \
  --table=public.profesores \
  --table=public.asignaturas \
  --table=public.profesor_asignatura \
  --table=public.evaluaciones \
  --table=public.aportes_wiki \
  --column-inserts \
  --no-owner \
  --no-privileges \
  > wikifeduc_data.sql
```

> Si no tienes `pg_dump`, instálalo con `brew install postgresql` (Mac) o descárgalo de https://www.postgresql.org/download/

### 3.2 Importar datos en la DB nueva

```bash
psql "postgresql://postgres:[PASSWORD_NUEVA]@db.[REF_NUEVO].supabase.co:5432/postgres" \
  -f wikifeduc_data.sql
```

Si ves errores de duplicate key, significa que ya había datos. Puedes limpiar con:

```sql
TRUNCATE aportes_wiki, evaluaciones, profesor_asignatura, asignaturas, profesores CASCADE;
```

Y volver a correr el import.

### 3.3 Migrar archivos del Storage (fotos de profesores)

Los archivos del bucket **no** se exportan con `pg_dump`. Opciones:

**Opción A — Manual (rápido si son pocas fotos):**
1. En el proyecto viejo: **Storage → fotos-profesores** → selecciona todos → **Download**
2. En el proyecto nuevo: **Storage → fotos-profesores** → **Upload files** → sube todas respetando los nombres originales (son UUIDs)

**Opción B — Script Node (si son muchas):**
```javascript
// migrate-storage.mjs
import { createClient } from '@supabase/supabase-js'

const viejo = createClient(
  'https://[REF_VIEJO].supabase.co',
  '[SERVICE_ROLE_KEY_VIEJA]'
)
const nuevo = createClient(
  'https://[REF_NUEVO].supabase.co',
  '[SERVICE_ROLE_KEY_NUEVA]'
)

const { data: files } = await viejo.storage.from('fotos-profesores').list()
for (const f of files) {
  const { data: blob } = await viejo.storage.from('fotos-profesores').download(f.name)
  await nuevo.storage.from('fotos-profesores').upload(f.name, blob, {
    contentType: f.metadata?.mimetype,
    upsert: true
  })
  console.log('✓', f.name)
}
```

Córrelo con `node migrate-storage.mjs`.

### 3.4 Actualizar URLs de las fotos en la DB

Las URLs guardadas en `profesores.foto_url` apuntan al dominio del proyecto viejo. Corrígelas:

```sql
UPDATE profesores
SET foto_url = REPLACE(
  foto_url,
  'https://[REF_VIEJO].supabase.co',
  'https://[REF_NUEVO].supabase.co'
)
WHERE foto_url IS NOT NULL;
```

---

## 4. Actualizar variables de entorno

En el proyecto **nuevo**: **Project Settings → API** y copia:

| Supabase | Variable en tu app |
|----------|---------------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

### 4.1 Actualizar `.env.local` (desarrollo)

```env
NEXT_PUBLIC_SUPABASE_URL=https://[REF_NUEVO].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` NUNCA va en variables `NEXT_PUBLIC_`. Es secreta.

### 4.2 Actualizar Vercel (producción)

1. Ve al proyecto en https://vercel.com/dashboard
2. **Settings → Environment Variables**
3. Edita las 3 variables y reemplaza los valores
4. **Deployments → ... → Redeploy** en el último deploy

---

## 5. Pruebas de humo

Después del redeploy, entra a la web en producción y verifica:

- [ ] La home carga y muestra el listado de profesores
- [ ] Click a un profesor carga su perfil con stats y comentarios
- [ ] Crear una evaluación funciona (prueba con un profesor de prueba)
- [ ] Subir una foto de profesor funciona (si hay interfaz para eso)
- [ ] El filtro por asignatura funciona

Si algo falla, revisa **Vercel → Logs** y **Supabase → Logs → API** para ver los errores.

---

## 6. Eliminar el proyecto viejo *(OPCIONAL)*

Solo cuando hayas verificado que todo funciona en producción con el proyecto nuevo:

1. Proyecto viejo → **Project Settings → General → Delete project**
2. Confirma escribiendo el nombre

> Haz esto **solo cuando estés 100% seguro**. No hay vuelta atrás.

---

## Checklist final

- [ ] Proyecto nuevo creado en la org destino
- [ ] `migration_full.sql` ejecutado sin errores
- [ ] Queries de verificación devuelven lo esperado (5+1 tablas, 10 policies, 1 bucket)
- [ ] Datos migrados con `pg_dump` *(si aplica)*
- [ ] Fotos del bucket migradas *(si aplica)*
- [ ] URLs de `foto_url` actualizadas *(si migraste fotos)*
- [ ] `.env.local` actualizado
- [ ] Vercel env vars actualizadas y redeploy hecho
- [ ] Pruebas de humo en producción pasan
- [ ] *(Opcional)* Proyecto viejo eliminado

---

## Lo que este proyecto NO usa (tranquilo, no hay que migrarlo)

- Auth / usuarios registrados *(el sitio es 100% anónimo)*
- Edge Functions
- Database Webhooks
- Realtime
- Cron jobs / pg_cron
- Extensiones custom más allá de las que trae Supabase por defecto
- Secrets del Vault

Si en algún momento agregas algo de esto, recuerda replicarlo también.

---

## Preguntas frecuentes

**¿Por qué no puedo usar "Transfer project" de Supabase?**
Porque el dueño actual no es miembro de la organización destino. Supabase exige que seas miembro de ambas orgs para transferir. Como alternativa, se recrea el proyecto (lo que estás haciendo).

**¿Se pierden los IDs (UUIDs) al migrar?**
No. `pg_dump --data-only --column-inserts` preserva los UUIDs exactamente. Las FKs siguen funcionando.

**¿Qué pasa con el anti-spam de evaluaciones?**
Se basa en `ip_hash` + `profesor_id` + `semestre`. Al migrar los datos también se migran los hashes, así que el anti-spam sigue funcionando sin reinicios.

**¿Los slugs siguen siendo los mismos?**
Sí. Los slugs están en la tabla `profesores`, se copian tal cual. Las URLs tipo `/profesores/juan-perez` no cambian.
