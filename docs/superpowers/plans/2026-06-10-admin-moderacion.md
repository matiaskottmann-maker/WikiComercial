# Cuentas de Admin y Moderación — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar login de admin por magic link (lista de admins en tabla `admins`), moderación inline (eliminar evaluaciones/aportes, editar/eliminar profesores sin límite de tiempo), botón de reportar para todos y cola de reportes en `/admin/reportes`.

**Architecture:** La autorización vive 100% en el servidor: un helper `getAdminEmail()` verifica la sesión de Supabase Auth contra la tabla `admins` (vía service role) en cada API route y Server Component. Las rutas existentes de DELETE/PUT ganan una rama de bypass admin que se evalúa antes de la verificación de `edit_token`. La UI reutiliza los componentes existentes pasando una prop `isAdmin` calculada server-side (solo cosmética).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (PostgreSQL + Auth magic link via `@supabase/ssr`), Tailwind CSS v3.

**Spec:** `docs/superpowers/specs/2026-06-10-admin-moderacion-design.md`

**Nota sobre testing:** El proyecto no tiene framework de tests (ver `package.json` — solo `dev/build/start/lint`). No se monta uno en este plan (YAGNI; requeriría mockear Supabase). Cada tarea se verifica con `npm run build` (TypeScript strict atrapa errores de tipos) y pruebas manuales con `curl`/navegador descritas en cada paso. La Tarea 11 es la verificación integral.

**Convención de imports:** alias `@/` = `src/` (ya configurado en `tsconfig.json`).

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `supabase/migration_admin.sql` | Crear | Tablas `admins` y `reportes` + seed |
| `src/types/index.ts` | Modificar | Tipos `Admin`, `Reporte`, `ReporteConContenido` |
| `src/lib/admin.ts` | Crear | Helper `getAdminEmail()` |
| `src/app/api/admin/login/route.ts` | Crear | POST: enviar magic link solo a admins |
| `src/app/auth/confirm/route.ts` | Crear | GET: canjear token del magic link por sesión |
| `src/app/api/evaluaciones/[id]/route.ts` | Modificar | Bypass admin en DELETE |
| `src/app/api/aportes/[id]/route.ts` | Modificar | Bypass admin en DELETE |
| `src/app/api/profesores/[id]/route.ts` | Modificar | Bypass admin en PUT + nuevo DELETE (solo admin) |
| `src/app/api/profesores/[id]/foto/route.ts` | Modificar | **Fix seguridad**: exigir admin o edit_token |
| `src/app/api/admin/admins/route.ts` | Crear | GET/POST/DELETE gestión de admins |
| `src/app/api/reportes/route.ts` | Crear | POST público para reportar |
| `src/app/api/admin/reportes/route.ts` | Crear | GET reportes pendientes (admin) |
| `src/app/api/admin/reportes/[id]/route.ts` | Crear | PATCH marcar resuelto (admin) |
| `src/app/admin/page.tsx` | Crear | Login o dashboard según sesión |
| `src/components/admin/AdminLogin.tsx` | Crear | Formulario de magic link |
| `src/components/admin/AdminDashboard.tsx` | Crear | Lista de admins + link a reportes + logout |
| `src/app/admin/reportes/page.tsx` | Crear | Cola de reportes (server) |
| `src/components/admin/ReportesLista.tsx` | Crear | Acciones Eliminar/Ignorar (client) |
| `src/components/ReportarButton.tsx` | Crear | Botón "Reportar" para todos |
| `src/components/admin/AdminProfesorAcciones.tsx` | Crear | Editar/eliminar profesor (admin) |
| `src/components/EvaluacionLista.tsx` | Modificar | Prop `isAdmin` + botón eliminar admin + Reportar |
| `src/components/WikiSeccion.tsx` | Modificar | Prop `isAdmin` + botón eliminar admin + Reportar |
| `src/components/FotoProfesor.tsx` | Modificar | Overlay solo para admin/autor; enviar edit_token |
| `src/app/profesores/[slug]/page.tsx` | Modificar | Calcular `isAdmin` y pasarlo a componentes |

---

### Task 1: Migración SQL (tablas `admins` y `reportes`)

**Files:**
- Create: `supabase/migration_admin.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
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
```

- [ ] **Step 2: Ejecutar la migración en Supabase**

Abrir el dashboard de Supabase → SQL Editor → pegar el contenido completo de `supabase/migration_admin.sql` → Run.
Expected: "Success. No rows returned" y `SELECT * FROM admins;` devuelve 4 filas.

- [ ] **Step 3: Configurar Supabase Auth (manual, en el dashboard)**

1. **Authentication → Sign In / Up → Email**: habilitado (es el default). Desactivar "Confirm email" no es necesario; magic link funciona igual.
2. **Authentication → URL Configuration**:
   - Site URL: la URL de producción (ej. `https://wikifeduc.vercel.app`)
   - Redirect URLs: agregar `http://localhost:3000/**` y `https://<dominio-producción>/**`
3. **Authentication → Emails → Magic Link**: reemplazar el href del enlace por:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```
   (Patrón oficial de `@supabase/ssr` para Next.js server-side auth; evita problemas de PKCE cuando el correo se abre en otro navegador.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migration_admin.sql
git commit -m "feat: migración de tablas admins y reportes"
```

---

### Task 2: Tipos y helper `getAdminEmail()`

**Files:**
- Modify: `src/types/index.ts` (agregar al final)
- Create: `src/lib/admin.ts`

- [ ] **Step 1: Agregar tipos al final de `src/types/index.ts`**

```typescript
// --- Admin y moderación ---

export interface Admin {
  email: string
  added_by: string | null
  created_at: string
}

export interface Reporte {
  id: string
  evaluacion_id: string | null
  aporte_id: string | null
  motivo: string | null
  resuelto: boolean
  created_at: string
}

export interface ReporteConContenido extends Reporte {
  evaluaciones:
    | (Pick<Evaluacion, 'id' | 'comentario' | 'rating_general' | 'semestre' | 'created_at'> & {
        profesores: Pick<Profesor, 'nombre' | 'apellido' | 'slug'> | null
      })
    | null
  aportes_wiki:
    | (Pick<AporteWiki, 'id' | 'contenido' | 'seccion' | 'created_at'> & {
        profesores: Pick<Profesor, 'nombre' | 'apellido' | 'slug'> | null
      })
    | null
}
```

- [ ] **Step 2: Crear `src/lib/admin.ts`**

```typescript
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Retorna el email del admin logueado (en minúsculas), o null si no hay
 * sesión o el email no está en la tabla admins.
 * Única fuente de verdad de autorización — usar en TODA ruta/página admin.
 */
export async function getAdminEmail(): Promise<string | null> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const email = user.email.toLowerCase()
  const service = createServiceRoleClient()
  const { data } = await service
    .from('admins')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  return data ? email : null
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build exitoso sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/admin.ts
git commit -m "feat: tipos de admin/reportes y helper getAdminEmail"
```

---

### Task 3: Rutas de autenticación (login + confirm)

**Files:**
- Create: `src/app/api/admin/login/route.ts`
- Create: `src/app/auth/confirm/route.ts`

- [ ] **Step 1: Crear `src/app/api/admin/login/route.ts`**

Respuesta SIEMPRE genérica (mismo mensaje esté o no en la lista) para no revelar quiénes son admins.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

const RESPUESTA_GENERICA = {
  message: 'Si tu correo es de administrador, recibirás un enlace de acceso.',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data: admin } = await service
      .from('admins')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (admin) {
      const supabase = await createServerClient()
      await supabase.auth.signInWithOtp({ email })
    }

    return NextResponse.json(RESPUESTA_GENERICA)
  } catch {
    return NextResponse.json(RESPUESTA_GENERICA)
  }
}
```

- [ ] **Step 2: Crear `src/app/auth/confirm/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const redirectTo = new URL('/admin', request.url)

  if (token_hash && type) {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) return NextResponse.redirect(redirectTo)
  }

  redirectTo.searchParams.set('error', 'enlace-invalido')
  return NextResponse.redirect(redirectTo)
}
```

- [ ] **Step 3: Verificar manualmente**

```bash
npm run dev
# En otra terminal — email NO admin (debe responder genérico y NO enviar correo):
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' -d '{"email":"random@gmail.com"}'
# Expected: {"message":"Si tu correo es de administrador, recibirás un enlace de acceso."}

# Email admin (debe responder igual y SÍ enviar correo):
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' -d '{"email":"vicentenazer@gmail.com"}'
# Expected: misma respuesta; revisar bandeja de entrada.

# Email malformado:
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' -d '{"email":"no-es-email"}'
# Expected: {"error":"Email inválido"} con status 400
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/login/route.ts src/app/auth/confirm/route.ts
git commit -m "feat: login de admin por magic link con allowlist"
```

---

### Task 4: Bypass admin en DELETE de evaluaciones y aportes

**Files:**
- Modify: `src/app/api/evaluaciones/[id]/route.ts` (función DELETE, líneas 79-105)
- Modify: `src/app/api/aportes/[id]/route.ts` (función DELETE, líneas 69-95)

- [ ] **Step 1: Modificar DELETE en `src/app/api/evaluaciones/[id]/route.ts`**

Agregar el import al inicio del archivo:

```typescript
import { getAdminEmail } from '@/lib/admin'
```

Reemplazar la función `DELETE` completa por:

```typescript
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    // Admin: elimina sin token ni ventana de tiempo
    const adminEmail = await getAdminEmail()
    if (adminEmail) {
      const supabase = createServiceRoleClient()
      const { error } = await supabase.from('evaluaciones').delete().eq('id', id)
      if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Autor: requiere edit_token dentro de la ventana de 10 min
    const body = await request.json().catch(() => ({}))
    const { edit_token } = body as { edit_token?: string }

    if (!edit_token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const result = await verifyToken(id, edit_token)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { error } = await result.supabase
      .from('evaluaciones')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

(Nota: `request.json().catch(() => ({}))` porque el admin puede llamar sin body.)

- [ ] **Step 2: Modificar DELETE en `src/app/api/aportes/[id]/route.ts`**

Agregar el import al inicio del archivo:

```typescript
import { getAdminEmail } from '@/lib/admin'
```

Reemplazar la función `DELETE` completa por (idéntica estructura, tabla `aportes_wiki`):

```typescript
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    // Admin: elimina sin token ni ventana de tiempo
    const adminEmail = await getAdminEmail()
    if (adminEmail) {
      const supabase = createServiceRoleClient()
      const { error } = await supabase.from('aportes_wiki').delete().eq('id', id)
      if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Autor: requiere edit_token dentro de la ventana de 10 min
    const body = await request.json().catch(() => ({}))
    const { edit_token } = body as { edit_token?: string }

    if (!edit_token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const result = await verifyToken(id, edit_token)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { error } = await result.supabase
      .from('aportes_wiki')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: build exitoso.

```bash
# Sin sesión y sin token debe seguir rechazando:
curl -s -X DELETE http://localhost:3000/api/evaluaciones/00000000-0000-0000-0000-000000000000
# Expected: {"error":"Token requerido"} status 400
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/evaluaciones/[id]/route.ts" "src/app/api/aportes/[id]/route.ts"
git commit -m "feat: admin puede eliminar evaluaciones y aportes sin token"
```

---

### Task 5: Profesores — bypass admin en PUT, nuevo DELETE y fix de seguridad en foto

**Files:**
- Modify: `src/app/api/profesores/[id]/route.ts`
- Modify: `src/app/api/profesores/[id]/foto/route.ts`

- [ ] **Step 1: Reemplazar `src/app/api/profesores/[id]/route.ts` completo**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'
import { generarSlug } from '@/lib/utils'

const EDIT_WINDOW_MS = 10 * 60 * 1000

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { edit_token, nombre, apellido } = body as {
      edit_token?: string
      nombre?: string
      apellido?: string
    }

    if (!nombre?.trim() && !apellido?.trim()) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: record } = await supabase
      .from('profesores')
      .select('*')
      .eq('id', id)
      .single()

    if (!record) return NextResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })

    // Admin edita sin token ni ventana; autor requiere token vigente
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      if (!edit_token) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
      }

      const tokenHash = createHash('sha256').update(edit_token).digest('hex')
      if (tokenHash !== record.edit_token_hash) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
      }

      const elapsed = Date.now() - new Date(record.created_at).getTime()
      if (elapsed > EDIT_WINDOW_MS) {
        return NextResponse.json({ error: 'El tiempo de edición ha expirado' }, { status: 403 })
      }
    }

    const newNombre = nombre?.trim() || record.nombre
    const newApellido = apellido?.trim() || record.apellido
    const newSlug = generarSlug(newNombre, newApellido)

    const { error } = await supabase
      .from('profesores')
      .update({ nombre: newNombre, apellido: newApellido, slug: newSlug })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    return NextResponse.json({ success: true, slug: newSlug })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const supabase = createServiceRoleClient()

    const { data: record } = await supabase
      .from('profesores')
      .select('id')
      .eq('id', id)
      .single()

    if (!record) return NextResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })

    // Evaluaciones, aportes y relaciones caen en cascada (ON DELETE CASCADE)
    const { error } = await supabase.from('profesores').delete().eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Reemplazar `src/app/api/profesores/[id]/foto/route.ts` completo (fix de seguridad)**

Hoy esta ruta no exige autorización. Nueva regla: admin sin restricción, o autor con `edit_token` vigente.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'

const EDIT_WINDOW_MS = 10 * 60 * 1000

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { foto_url, edit_token } = body as { foto_url?: string; edit_token?: string }

    if (!foto_url?.trim()) {
      return NextResponse.json({ error: 'URL de foto requerida' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: profesor } = await supabase
      .from('profesores')
      .select('*')
      .eq('id', id)
      .single()

    if (!profesor) {
      return NextResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })
    }

    // Admin cambia la foto sin restricción; autor requiere token vigente
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      if (!edit_token) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      const tokenHash = createHash('sha256').update(edit_token).digest('hex')
      if (tokenHash !== profesor.edit_token_hash) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
      }

      const elapsed = Date.now() - new Date(profesor.created_at).getTime()
      if (elapsed > EDIT_WINDOW_MS) {
        return NextResponse.json({ error: 'El tiempo de edición ha expirado' }, { status: 403 })
      }
    }

    const { error } = await supabase
      .from('profesores')
      .update({ foto_url: foto_url.trim() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar foto' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: build exitoso.

```bash
# Cambiar foto sin token ni sesión debe rechazar ahora:
curl -s -X PUT http://localhost:3000/api/profesores/00000000-0000-0000-0000-000000000000/foto \
  -H 'Content-Type: application/json' -d '{"foto_url":"https://example.com/x.jpg"}'
# Expected: {"error":"Profesor no encontrado"} (uuid falso) — y con un uuid real: {"error":"No autorizado"} status 403

# DELETE profesor sin sesión:
curl -s -X DELETE http://localhost:3000/api/profesores/00000000-0000-0000-0000-000000000000
# Expected: {"error":"No autorizado"} status 403
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/profesores/[id]/route.ts" "src/app/api/profesores/[id]/foto/route.ts"
git commit -m "feat: admin edita/elimina profesores; fix seguridad en ruta de foto"
```

---

### Task 6: API de gestión de admins

**Files:**
- Create: `src/app/api/admin/admins/route.ts`

- [ ] **Step 1: Crear `src/app/api/admin/admins/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'

export async function GET() {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Error al listar' }, { status: 500 })

  return NextResponse.json({ admins: data })
}

export async function POST(request: NextRequest) {
  try {
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { error } = await supabase
      .from('admins')
      .insert({ email, added_by: adminEmail })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ese email ya es admin' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al agregar' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    if (email === adminEmail) {
      return NextResponse.json(
        { error: 'No puedes eliminarte a ti mismo' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    const { count } = await supabase
      .from('admins')
      .select('email', { count: 'exact', head: true })

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Debe quedar al menos un admin' },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('admins').delete().eq('email', email)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar**

Run: `npm run build`
Expected: build exitoso.

```bash
# Sin sesión, todo debe rechazar:
curl -s http://localhost:3000/api/admin/admins
# Expected: {"error":"No autorizado"} status 403
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/admins/route.ts
git commit -m "feat: API de gestión de admins con guardas"
```

---

### Task 7: API de reportes

**Files:**
- Create: `src/app/api/reportes/route.ts`
- Create: `src/app/api/admin/reportes/route.ts`
- Create: `src/app/api/admin/reportes/[id]/route.ts`

- [ ] **Step 1: Crear `src/app/api/reportes/route.ts` (POST público)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { validarContenido } from '@/lib/filtro-palabras'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { evaluacion_id, aporte_id, motivo } = body as {
      evaluacion_id?: string
      aporte_id?: string
      motivo?: string
    }

    // Exactamente uno de los dos
    if ((!evaluacion_id && !aporte_id) || (evaluacion_id && aporte_id)) {
      return NextResponse.json(
        { error: 'Debes indicar qué contenido reportar' },
        { status: 400 }
      )
    }

    if (motivo && motivo.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 caracteres' }, { status: 400 })
    }

    if (motivo) {
      const errorFiltro = validarContenido(motivo)
      if (errorFiltro) {
        return NextResponse.json({ error: errorFiltro }, { status: 400 })
      }
    }

    const supabase = createServiceRoleClient()

    // Verificar que el contenido existe
    const tabla = evaluacion_id ? 'evaluaciones' : 'aportes_wiki'
    const contenidoId = evaluacion_id ?? aporte_id
    const { data: contenido } = await supabase
      .from(tabla)
      .select('id')
      .eq('id', contenidoId)
      .maybeSingle()

    if (!contenido) {
      return NextResponse.json({ error: 'Contenido no encontrado' }, { status: 404 })
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ?? '127.0.0.1'
    const ipHash = createHash('sha256').update(ip).digest('hex')

    const { error } = await supabase.from('reportes').insert({
      evaluacion_id: evaluacion_id ?? null,
      aporte_id: aporte_id ?? null,
      motivo: motivo?.trim() || null,
      ip_hash: ipHash,
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya reportaste este contenido' },
          { status: 429 }
        )
      }
      return NextResponse.json({ error: 'Error al reportar' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Crear `src/app/api/admin/reportes/route.ts` (GET admin)**

```typescript
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'

export async function GET() {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('reportes')
    .select(
      `*,
      evaluaciones(id, comentario, rating_general, semestre, created_at,
        profesores(nombre, apellido, slug)),
      aportes_wiki(id, contenido, seccion, created_at,
        profesores(nombre, apellido, slug))`
    )
    .eq('resuelto', false)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Error al listar' }, { status: 500 })

  return NextResponse.json({ reportes: data })
}
```

- [ ] **Step 3: Crear `src/app/api/admin/reportes/[id]/route.ts` (PATCH admin = ignorar)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const supabase = createServiceRoleClient()
    const { error } = await supabase
      .from('reportes')
      .update({ resuelto: true })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: build exitoso.

```bash
# Reportar sin indicar contenido:
curl -s -X POST http://localhost:3000/api/reportes \
  -H 'Content-Type: application/json' -d '{}'
# Expected: {"error":"Debes indicar qué contenido reportar"} status 400

# Reportar contenido inexistente:
curl -s -X POST http://localhost:3000/api/reportes \
  -H 'Content-Type: application/json' \
  -d '{"evaluacion_id":"00000000-0000-0000-0000-000000000000"}'
# Expected: {"error":"Contenido no encontrado"} status 404

# Reportar una evaluación real dos veces (tomar un id real de la BD):
# 1ª vez → {"success":true} 201 · 2ª vez → {"error":"Ya reportaste este contenido"} 429

# GET admin sin sesión:
curl -s http://localhost:3000/api/admin/reportes
# Expected: {"error":"No autorizado"} status 403
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reportes/route.ts src/app/api/admin/reportes/
git commit -m "feat: API de reportes con anti-spam por IP"
```

---

### Task 8: Página `/admin` (login + dashboard)

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/components/admin/AdminLogin.tsx`
- Create: `src/components/admin/AdminDashboard.tsx`

- [ ] **Step 1: Crear `src/components/admin/AdminLogin.tsx`**

```tsx
'use client'

import { useState } from 'react'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMensaje(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar')
      }

      setMensaje(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Administración</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ingresa tu correo y te enviaremos un enlace de acceso.
        </p>

        {mensaje ? (
          <div className="bg-blue-50 text-uc-blue rounded-xl p-4 text-sm">
            {mensaje} Revisa tu bandeja de entrada (y spam).
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu-correo@uc.cl"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900"
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-uc-blue text-white py-2.5 rounded-xl font-semibold hover:bg-uc-blue-light transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `src/components/admin/AdminDashboard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Admin } from '@/types'

interface AdminDashboardProps {
  adminEmail: string
  admins: Admin[]
  reportesPendientes: number
}

export default function AdminDashboard({
  adminEmail,
  admins,
  reportesPendientes,
}: AdminDashboardProps) {
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nuevoEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al agregar')

      setNuevoEmail('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleEliminar(email: string) {
    if (!confirm(`¿Quitar a ${email} de los administradores?`)) return
    setError(null)

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  async function handleLogout() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administración</h1>
          <p className="text-sm text-gray-500">{adminEmail}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-xl transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      <Link
        href="/admin/reportes"
        className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-900">🚩 Reportes pendientes</span>
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${
              reportesPendientes > 0
                ? 'bg-red-50 text-red-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {reportesPendientes}
          </span>
        </div>
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Administradores</h2>

        <ul className="divide-y divide-gray-50 mb-4">
          {admins.map((a) => (
            <li key={a.email} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-700">
                {a.email}
                {a.email === adminEmail && (
                  <span className="ml-2 text-xs text-gray-400">(tú)</span>
                )}
              </span>
              {a.email !== adminEmail && (
                <button
                  onClick={() => handleEliminar(a.email)}
                  className="text-xs text-red-500 hover:text-red-600 transition-colors"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={handleAgregar} className="flex gap-2">
          <input
            type="email"
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
            placeholder="nuevo-admin@uc.cl"
            required
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !nuevoEmail.trim()}
            className="bg-uc-blue text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-uc-blue-light transition-colors disabled:opacity-50"
          >
            {loading ? 'Agregando...' : 'Agregar'}
          </button>
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear `src/app/admin/page.tsx`**

```tsx
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'
import AdminLogin from '@/components/admin/AdminLogin'
import AdminDashboard from '@/components/admin/AdminDashboard'
import type { Admin } from '@/types'

export const metadata = { title: 'Administración — WikiFEDUC' }

export default async function AdminPage() {
  const adminEmail = await getAdminEmail()

  if (!adminEmail) {
    return <AdminLogin />
  }

  const supabase = createServiceRoleClient()

  const { data: admins } = await supabase
    .from('admins')
    .select('*')
    .order('created_at', { ascending: true })

  const { count } = await supabase
    .from('reportes')
    .select('id', { count: 'exact', head: true })
    .eq('resuelto', false)

  return (
    <AdminDashboard
      adminEmail={adminEmail}
      admins={(admins ?? []) as Admin[]}
      reportesPendientes={count ?? 0}
    />
  )
}
```

- [ ] **Step 4: Verificar manualmente**

```bash
npm run dev
```
1. Abrir `http://localhost:3000/admin` → debe verse el formulario de login.
2. Poner un email admin → mensaje genérico → revisar correo → clic en el enlace → debe redirigir a `/admin` mostrando el dashboard con los 4 admins.
3. Agregar un email de prueba → aparece en la lista. Quitarlo → desaparece.
4. Intentar quitarse a sí mismo → no hay botón "Quitar" en tu fila.
5. Cerrar sesión → vuelve el formulario.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/components/admin/AdminLogin.tsx src/components/admin/AdminDashboard.tsx
git commit -m "feat: página /admin con login magic link y gestión de admins"
```

---

### Task 9: Página `/admin/reportes` (cola de moderación)

**Files:**
- Create: `src/app/admin/reportes/page.tsx`
- Create: `src/components/admin/ReportesLista.tsx`

- [ ] **Step 1: Crear `src/components/admin/ReportesLista.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReporteConContenido } from '@/types'

interface ReportesListaProps {
  reportes: ReporteConContenido[]
}

export default function ReportesLista({ reportes }: ReportesListaProps) {
  const [procesando, setProcesando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleEliminarContenido(reporte: ReporteConContenido) {
    const esEvaluacion = !!reporte.evaluacion_id
    const tipo = esEvaluacion ? 'evaluación' : 'aporte'
    if (!confirm(`¿Eliminar este ${tipo} definitivamente?`)) return

    setProcesando(reporte.id)
    setError(null)

    try {
      const url = esEvaluacion
        ? `/api/evaluaciones/${reporte.evaluacion_id}`
        : `/api/aportes/${reporte.aporte_id}`

      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar')
      }

      // Los reportes del contenido caen en cascada
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setProcesando(null)
    }
  }

  async function handleIgnorar(reporteId: string) {
    setProcesando(reporteId)
    setError(null)

    try {
      const res = await fetch(`/api/admin/reportes/${reporteId}`, {
        method: 'PATCH',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al ignorar')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setProcesando(null)
    }
  }

  if (reportes.length === 0) {
    return (
      <p className="text-center text-gray-400 py-12">
        No hay reportes pendientes 🎉
      </p>
    )
  }

  // Cantidad de reportes por contenido (mismo contenido puede tener varios)
  const conteoPorContenido = new Map<string, number>()
  for (const r of reportes) {
    const key = r.evaluacion_id ?? r.aporte_id ?? r.id
    conteoPorContenido.set(key, (conteoPorContenido.get(key) ?? 0) + 1)
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {reportes.map((r) => {
        const contenido = r.evaluaciones ?? r.aportes_wiki
        const profesor = contenido?.profesores
        const conteo = conteoPorContenido.get(r.evaluacion_id ?? r.aporte_id ?? r.id) ?? 1
        const texto = r.evaluaciones
          ? r.evaluaciones.comentario ?? '(evaluación sin comentario)'
          : r.aportes_wiki?.contenido ?? '(contenido eliminado)'

        return (
          <div
            key={r.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">
                {r.evaluacion_id ? '📝 Evaluación' : '📚 Aporte wiki'}
                {' · '}
                {new Date(r.created_at).toLocaleDateString('es-CL')}
                {conteo > 1 && (
                  <span className="ml-2 text-red-500 font-semibold">×{conteo} reportes</span>
                )}
              </span>
              {profesor && (
                <Link
                  href={`/profesores/${profesor.slug}`}
                  className="text-xs text-uc-blue hover:underline"
                >
                  {profesor.nombre} {profesor.apellido}
                </Link>
              )}
            </div>

            <p className="text-gray-700 text-sm bg-gray-50 rounded-xl p-3 mb-2">
              {texto}
            </p>

            {r.motivo && (
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-medium">Motivo del reporte:</span> {r.motivo}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleIgnorar(r.id)}
                disabled={procesando === r.id}
                className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-1.5 rounded-xl transition-colors disabled:opacity-50"
              >
                Ignorar
              </button>
              <button
                onClick={() => handleEliminarContenido(r)}
                disabled={procesando === r.id || !contenido}
                className="text-sm bg-red-500 text-white px-4 py-1.5 rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {procesando === r.id ? 'Procesando...' : 'Eliminar contenido'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Crear `src/app/admin/reportes/page.tsx`**

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'
import ReportesLista from '@/components/admin/ReportesLista'
import type { ReporteConContenido } from '@/types'

export const metadata = { title: 'Reportes — WikiFEDUC' }

export default async function ReportesPage() {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) redirect('/admin')

  const supabase = createServiceRoleClient()
  const { data: reportes } = await supabase
    .from('reportes')
    .select(
      `*,
      evaluaciones(id, comentario, rating_general, semestre, created_at,
        profesores(nombre, apellido, slug)),
      aportes_wiki(id, contenido, seccion, created_at,
        profesores(nombre, apellido, slug))`
    )
    .eq('resuelto', false)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-uc-blue transition-colors"
        >
          ← Volver a administración
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Reportes pendientes</h1>
      </div>

      <ReportesLista reportes={(reportes ?? []) as unknown as ReporteConContenido[]} />
    </div>
  )
}
```

- [ ] **Step 3: Verificar manualmente**

1. Sin sesión: `http://localhost:3000/admin/reportes` → redirige a `/admin`.
2. Con sesión admin y un reporte creado vía curl (Task 7): se ve la tarjeta del reporte con el contenido.
3. "Ignorar" → desaparece de la lista (y `resuelto = true` en la BD).
4. "Eliminar contenido" → el contenido desaparece de la app y el reporte de la cola.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/reportes/page.tsx src/components/admin/ReportesLista.tsx
git commit -m "feat: cola de reportes en /admin/reportes"
```

---

### Task 10: UI inline — Reportar, botones de admin y acciones de profesor

**Files:**
- Create: `src/components/ReportarButton.tsx`
- Create: `src/components/admin/AdminProfesorAcciones.tsx`
- Modify: `src/components/EvaluacionLista.tsx`
- Modify: `src/components/WikiSeccion.tsx`
- Modify: `src/components/FotoProfesor.tsx`
- Modify: `src/app/profesores/[slug]/page.tsx`

- [ ] **Step 1: Crear `src/components/ReportarButton.tsx`**

```tsx
'use client'

import { useState } from 'react'

interface ReportarButtonProps {
  evaluacionId?: string
  aporteId?: string
}

export default function ReportarButton({ evaluacionId, aporteId }: ReportarButtonProps) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleReportar() {
    setEstado('enviando')
    setError(null)

    try {
      const res = await fetch('/api/reportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacion_id: evaluacionId,
          aporte_id: aporteId,
          motivo: motivo.trim() || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al reportar')

      setEstado('enviado')
    } catch (err) {
      setEstado('error')
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  if (estado === 'enviado') {
    return <span className="text-xs text-green-600">Reporte enviado ✓</span>
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
      >
        Reportar
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full mt-2 p-3 bg-gray-50 rounded-xl">
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Motivo (opcional)"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-xs resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setAbierto(false); setMotivo(''); setError(null); setEstado('idle') }}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
        >
          Cancelar
        </button>
        <button
          onClick={handleReportar}
          disabled={estado === 'enviando'}
          className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {estado === 'enviando' ? 'Enviando...' : 'Enviar reporte'}
        </button>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Crear `src/components/admin/AdminProfesorAcciones.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminProfesorAccionesProps {
  profesorId: string
  nombre: string
  apellido: string
}

export default function AdminProfesorAcciones({
  profesorId,
  nombre,
  apellido,
}: AdminProfesorAccionesProps) {
  const [editando, setEditando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState(nombre)
  const [nuevoApellido, setNuevoApellido] = useState(apellido)
  const [confirmacion, setConfirmacion] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const nombreCompleto = `${nombre} ${apellido}`

  async function handleGuardar() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/profesores/${profesorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre.trim(), apellido: nuevoApellido.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')

      setEditando(false)
      // El slug puede haber cambiado — navegar al nuevo
      router.push(`/profesores/${data.slug}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleEliminar() {
    if (confirmacion !== nombreCompleto) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/profesores/${profesorId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')

      router.push('/profesores')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setLoading(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
        Zona de administración
      </p>

      {editando ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-sm"
            />
            <input
              value={nuevoApellido}
              onChange={(e) => setNuevoApellido(e.target.value)}
              placeholder="Apellido"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditando(false); setError(null) }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={loading || (!nuevoNombre.trim() && !nuevoApellido.trim())}
              className="text-xs bg-uc-blue text-white px-3 py-1.5 rounded-lg hover:bg-uc-blue-light disabled:opacity-50 transition-colors"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : eliminando ? (
        <div className="space-y-2">
          <p className="text-xs text-red-600">
            Esto elimina al profesor y TODAS sus evaluaciones y aportes. Escribe{' '}
            <strong>{nombreCompleto}</strong> para confirmar:
          </p>
          <input
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={nombreCompleto}
            className="w-full px-3 py-2 rounded-xl border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-900 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEliminando(false); setConfirmacion(''); setError(null) }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleEliminar}
              disabled={loading || confirmacion !== nombreCompleto}
              className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Eliminando...' : 'Eliminar definitivamente'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setEditando(true)}
            className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ✎ Editar profesor
          </button>
          <button
            onClick={() => setEliminando(true)}
            className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            🗑 Eliminar profesor
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Modificar `src/components/EvaluacionLista.tsx`**

3a. Agregar import de ReportarButton después de los imports existentes:

```typescript
import ReportarButton from './ReportarButton'
```

3b. Reemplazar la interface de props:

```typescript
interface EvaluacionListaProps {
  evaluaciones: EvaluacionConAsignatura[]
  isAdmin?: boolean
}

export default function EvaluacionLista({ evaluaciones, isAdmin = false }: EvaluacionListaProps) {
```

3c. Reemplazar `handleDelete` para soportar admin (sin token):

```typescript
  async function handleDelete(evId: string) {
    const token = getEditToken(evId)
    if (!token && !isAdmin) return
    if (isAdmin && !token && !confirm('¿Eliminar esta evaluación definitivamente?')) return

    setDeletingId(evId)
    try {
      const res = await fetch(`/api/evaluaciones/${evId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { edit_token: token.token } : {}),
      })

      if (res.ok) {
        removeEditToken(evId)
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }
```

3d. Reemplazar el bloque del pie de tarjeta (el `div` final con la fecha y el botón Eliminar, líneas 114-127 del archivo original):

```tsx
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-400">
                {new Date(ev.created_at).toLocaleDateString('es-CL')}
              </p>
              <div className="flex items-center gap-3">
                <ReportarButton evaluacionId={ev.id} />
                {(token || isAdmin) && (
                  <button
                    onClick={() => handleDelete(ev.id)}
                    disabled={deletingId === ev.id}
                    className="text-xs text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    {deletingId === ev.id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                )}
              </div>
            </div>
```

Nota: `ReportarButton` abre un panel; al estar dentro del flex puede empujar el layout — aceptable para esta versión.

- [ ] **Step 4: Modificar `src/components/WikiSeccion.tsx`**

4a. Agregar import:

```typescript
import ReportarButton from './ReportarButton'
```

4b. Reemplazar la interface y la firma:

```typescript
interface WikiSeccionProps {
  profesorId: string
  seccion: SeccionWiki
  label: string
  icon: string
  aportes: AporteWiki[]
  isAdmin?: boolean
}

export default function WikiSeccion({ profesorId, seccion, label, icon, aportes, isAdmin = false }: WikiSeccionProps) {
```

4c. Reemplazar `handleDelete`:

```typescript
  async function handleDelete(aporteId: string) {
    const token = getEditToken(aporteId)
    if (!token && !isAdmin) return
    if (isAdmin && !token && !confirm('¿Eliminar este aporte definitivamente?')) return

    try {
      const res = await fetch(`/api/aportes/${aporteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { edit_token: token.token } : {}),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar')
      }

      removeEditToken(aporteId)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }
```

4d. Reemplazar el bloque de acciones bajo cada aporte (el `{token && (...)}` con CountdownTimer/Editar/Eliminar, líneas 167-183 del archivo original):

```tsx
                    <div className="flex items-center gap-3 mt-2">
                      {token && (
                        <>
                          <CountdownTimer createdAt={token.createdAt} onExpire={forceRender} />
                          <button
                            onClick={() => { setEditingId(a.id); setEditContenido(a.contenido) }}
                            className="text-xs text-uc-blue hover:text-uc-blue-light transition-colors"
                          >
                            Editar
                          </button>
                        </>
                      )}
                      {(token || isAdmin) && (
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-xs text-red-500 hover:text-red-600 transition-colors"
                        >
                          Eliminar
                        </button>
                      )}
                      <ReportarButton aporteId={a.id} />
                    </div>
```

(El "Editar" sigue siendo solo del autor con token: la spec da al admin solo eliminar aportes, no editarlos.)

- [ ] **Step 5: Modificar `src/components/FotoProfesor.tsx`**

5a. Agregar import:

```typescript
import { getEditToken } from '@/lib/utils'
```

5b. Reemplazar la interface y la firma:

```typescript
interface FotoProfesorProps {
  profesorId: string
  nombre: string
  apellido: string
  fotoUrl: string | null
  isAdmin?: boolean
}

export default function FotoProfesor({ profesorId, nombre, apellido, fotoUrl, isAdmin = false }: FotoProfesorProps) {
```

5c. Dentro del componente, antes del `return`, calcular permiso:

```typescript
  const token = getEditToken(profesorId)
  const puedeEditar = isAdmin || !!token
```

5d. En `handleFileChange`, reemplazar el fetch del PUT de la foto:

```typescript
      const res = await fetch(`/api/profesores/${profesorId}/foto`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foto_url: uploadData.url,
          ...(token ? { edit_token: token.token } : {}),
        }),
      })
```

5e. Envolver el botón overlay y el input file en la condición — reemplazar el comentario `{/* Overlay para cambiar foto */}` y el `<button>` + `<input>` por:

```tsx
      {/* Overlay para cambiar foto — solo admin o autor con token vigente */}
      {puedeEditar && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
          >
            {uploading ? (
              <span className="text-white text-xs font-medium">Subiendo...</span>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </>
      )}
```

- [ ] **Step 6: Modificar `src/app/profesores/[slug]/page.tsx`**

6a. Agregar imports:

```typescript
import { getAdminEmail } from '@/lib/admin'
import AdminProfesorAcciones from '@/components/admin/AdminProfesorAcciones'
```

6b. Después de `const supabase = await createServerClient()`, agregar:

```typescript
  const isAdmin = !!(await getAdminEmail())
```

6c. Pasar la prop a los componentes — reemplazar:

```tsx
          <FotoProfesor
            profesorId={profesor.id}
            nombre={profesor.nombre}
            apellido={profesor.apellido}
            fotoUrl={profesor.foto_url}
            isAdmin={isAdmin}
          />
```

```tsx
            <WikiSeccion
              key={key}
              profesorId={profesor.id}
              seccion={key}
              label={label}
              icon={icon}
              aportes={aportesTyped.filter((a) => a.seccion === key)}
              isAdmin={isAdmin}
            />
```

```tsx
        <EvaluacionLista evaluaciones={(evaluaciones ?? []) as EvaluacionConAsignatura[]} isAdmin={isAdmin} />
```

6d. Agregar el bloque de acciones de admin justo después del cierre del `div` del Header (después de la línea `</div>` que cierra el bloque `{/* Header */}`):

```tsx
      {isAdmin && (
        <AdminProfesorAcciones
          profesorId={profesor.id}
          nombre={profesor.nombre}
          apellido={profesor.apellido}
        />
      )}
```

- [ ] **Step 7: Verificar**

Run: `npm run build`
Expected: build exitoso.

Manual (con `npm run dev`):
1. **Sin sesión**: en un perfil de profesor se ve el botón "Reportar" en evaluaciones y aportes; NO se ven botones de admin ni overlay de foto (salvo contenido propio recién creado).
2. **Reportar**: clic en Reportar → panel con motivo → enviar → "Reporte enviado ✓". Reintentar desde la misma IP → error "Ya reportaste este contenido".
3. **Con sesión admin**: aparece la "Zona de administración" en el perfil, botones "Eliminar" en todas las evaluaciones/aportes (incluso viejos), y el overlay de foto.
4. **Eliminar como admin** una evaluación vieja → desaparece.
5. **Editar profesor** → cambia nombre → redirige al nuevo slug.
6. **Eliminar profesor** → exige escribir el nombre completo → redirige a /profesores.

- [ ] **Step 8: Commit**

```bash
git add src/components/ReportarButton.tsx src/components/admin/AdminProfesorAcciones.tsx \
  src/components/EvaluacionLista.tsx src/components/WikiSeccion.tsx \
  src/components/FotoProfesor.tsx "src/app/profesores/[slug]/page.tsx"
git commit -m "feat: moderación inline, botón reportar y acciones de admin en perfil"
```

---

### Task 11: Verificación integral

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build y lint**

```bash
npm run build && npm run lint
```
Expected: ambos sin errores.

- [ ] **Step 2: Checklist funcional completo (con `npm run dev`)**

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | `POST /api/admin/login` con email no admin | Respuesta genérica, no llega correo |
| 2 | Login con email admin → clic en magic link | Sesión activa, dashboard en `/admin` |
| 3 | `/admin/reportes` sin sesión | Redirige a `/admin` |
| 4 | Eliminar evaluación >10 min como admin | Funciona |
| 5 | Eliminar evaluación sin sesión ni token (curl) | 400 "Token requerido" |
| 6 | Reportar 2 veces el mismo contenido | 2ª vez: 429 |
| 7 | Cambiar foto sin token ni sesión (curl) | 403 "No autorizado" |
| 8 | Agregar y quitar un admin desde el dashboard | Funciona; no hay botón "Quitar" en la propia fila |
| 9 | DELETE del propio email vía curl con sesión | 400 "No puedes eliminarte a ti mismo" |
| 10 | Eliminar profesor con confirmación | Redirige a `/profesores`, evaluaciones eliminadas |
| 11 | Flujo de autor intacto: crear evaluación → eliminarla con su token <10 min | Funciona como antes |

- [ ] **Step 3: Commit final (si hubo ajustes) y verificación de estado**

```bash
git status   # working tree limpio
git log --oneline -8   # commits de las tareas 1-10 presentes
```

**Despliegue:** al hacer push a producción, recordar la configuración manual de la Task 1 Step 3 (Site URL, Redirect URLs y template del Magic Link apuntando al dominio de producción).
