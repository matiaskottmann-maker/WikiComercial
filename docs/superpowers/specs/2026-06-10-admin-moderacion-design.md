# Diseño: Cuentas de admin y moderación — WikiFEDUC

**Fecha:** 2026-06-10
**Estado:** Aprobado en conversación, pendiente de plan de implementación

## Contexto y problema

WikiFEDUC es 100% anónima: cualquiera publica evaluaciones y aportes sin login. Editar/eliminar
contenido propio solo es posible con un `edit_token` guardado en el navegador del autor y dentro
de una ventana de 10 minutos. Pasado ese tiempo, **nadie puede moderar** salvo entrando al
dashboard de Supabase. Para una plataforma de reseñas sobre personas reales, se necesita
moderación: eliminar contenido difamatorio, corregir profesores mal creados y atender reportes.

## Decisiones tomadas

- **Login de admin:** magic link por email (Supabase Auth). Sin contraseñas.
- **Lista de admins:** tabla `admins` en Supabase (no env var), para que cualquier admin pueda
  agregar/quitar admins sin redeploy. Emails iniciales:
  - diegodomeyko@estudiante.uc.cl
  - r.olalde@uc.cl
  - matiaskottmann@estudiante.uc.cl
  - vicentenazer@gmail.com
- **Experiencia:** botones de moderación inline en la app existente (no panel separado).
- **Alcance admin:** eliminar evaluaciones/aportes, editar/eliminar profesores, cola de reportes,
  gestión de la lista de admins.
- **Fuera de alcance:** panel de estadísticas, roles intermedios, moderación previa a publicación,
  registro de usuarios normales (la app sigue anónima para estudiantes).

## 1. Schema (nueva migración SQL)

### Tabla `admins`

```sql
create table admins (
  email      text primary key,           -- siempre en minúsculas
  added_by   text,                       -- email del admin que lo agregó
  created_at timestamptz default now()
);
alter table admins enable row level security;
-- Sin políticas: solo accesible vía service_role desde el servidor.
```

Seed con los 4 emails iniciales (`added_by = null`).

### Tabla `reportes`

```sql
create table reportes (
  id            uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references evaluaciones(id) on delete cascade,
  aporte_id     uuid references aportes_wiki(id) on delete cascade,
  motivo        text check (char_length(motivo) <= 500),  -- opcional
  ip_hash       text not null,
  resuelto      boolean not null default false,
  created_at    timestamptz default now(),
  check (num_nonnulls(evaluacion_id, aporte_id) = 1)
);
-- 1 reporte por IP por contenido:
create unique index reportes_ip_evaluacion on reportes (ip_hash, evaluacion_id)
  where evaluacion_id is not null;
create unique index reportes_ip_aporte on reportes (ip_hash, aporte_id)
  where aporte_id is not null;
alter table reportes enable row level security;
-- Sin políticas: INSERT/SELECT/UPDATE solo vía API routes con service_role.
```

Si el contenido reportado se elimina, sus reportes desaparecen en cascada (quedan "resueltos"
implícitamente).

## 2. Autenticación de admin

### Flujo de login

1. Tu primo entra a `/admin` y escribe su email.
2. `POST /api/admin/login` con `{ email }`:
   - Normaliza a minúsculas y verifica contra la tabla `admins` (service role).
   - Si está en la lista → `supabase.auth.signInWithOtp({ email })` envía el magic link.
   - Si NO está → no se envía nada.
   - **En ambos casos** responde 200 con el mismo mensaje genérico
     ("Si tu correo es de administrador, recibirás un enlace"), para no revelar quiénes son admins.
3. El magic link redirige a `/auth/confirm` (route handler que hace `verifyOtp` con el
   `token_hash` del enlace — patrón oficial de `@supabase/ssr`, funciona aunque el correo se abra
   en otro navegador/dispositivo) y de ahí a `/admin`. Requiere ajustar el template del email
   Magic Link en Supabase a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
4. Cerrar sesión: `signOut()` con el browser client desde `/admin`.

### Verificación server-side (helper central)

Nuevo helper en `src/lib/admin.ts`:

```typescript
// Retorna el email del admin logueado, o null si no hay sesión o no es admin.
export async function getAdminEmail(): Promise<string | null>
```

Implementación: `createServerClient().auth.getUser()` → si hay user, consultar tabla `admins`
con service role por `user.email` (minúsculas). Se usa en **todas** las API routes admin y en los
Server Components que deciden mostrar UI de admin.

**Regla de seguridad:** tener sesión de Supabase NO otorga poderes. El poder lo da estar en la
tabla `admins`, verificado en el servidor en cada request. Ningún flag del cliente se considera
confiable.

## 3. API

### Rutas existentes extendidas (bypass de admin)

- `DELETE /api/evaluaciones/[id]`: si `getAdminEmail()` retorna admin → eliminar sin exigir
  `edit_token` ni ventana de 10 min. Si no es admin → lógica actual intacta.
- `DELETE /api/aportes/[id]`: ídem.
- `PUT /api/profesores/[id]`: admin edita nombre/apellido sin token ni ventana (regenera slug,
  lógica actual de `generarSlug` se reutiliza). No admin → lógica actual intacta.

El body puede venir sin `edit_token` cuando es admin; la rama admin se evalúa primero.

- `PUT /api/profesores/[id]/foto`: **corrección de seguridad** — hoy esta ruta no exige ninguna
  autorización (cualquiera puede cambiar la foto de cualquier profesor). Se endurece con la misma
  regla que el resto: admin sin restricción, o autor con `edit_token` válido dentro de la ventana
  de 10 minutos.

### Rutas nuevas

- `DELETE /api/profesores/[id]` (solo admin): elimina profesor; las evaluaciones y relaciones
  caen en cascada (ya definido en el schema con `on delete cascade`).
- `GET /api/admin/admins` (solo admin): lista de admins.
- `POST /api/admin/admins` (solo admin): `{ email }` → valida formato, normaliza minúsculas,
  inserta con `added_by` = admin actual. Email duplicado → error claro.
- `DELETE /api/admin/admins` (solo admin): `{ email }` → guardas: no puedes eliminar tu propio
  email; debe quedar al menos 1 admin.
- `POST /api/reportes` (público): `{ evaluacion_id | aporte_id, motivo? }` → valida que el
  contenido exista, valida `motivo` (≤500 chars, filtro de groserías existente), hashea IP
  (mismo patrón SHA256 de `/api/evaluaciones`), inserta. Duplicado (misma IP, mismo contenido)
  → 429.
- `GET /api/admin/reportes` (solo admin): reportes con `resuelto = false`, con el contenido
  reportado embebido (join a evaluaciones/aportes) y conteo de reportes por contenido.
- `PATCH /api/admin/reportes/[id]` (solo admin): marca `resuelto = true` ("ignorar").
  "Eliminar contenido" no necesita endpoint propio: la UI llama al DELETE del contenido y los
  reportes caen en cascada.

## 4. UI

### Página `/admin`

Server Component que decide según `getAdminEmail()`:

- **Sin sesión admin** → formulario de login (Client Component): input email + botón
  "Enviar enlace". Mensaje genérico tras enviar.
- **Con sesión admin** → dashboard mínimo:
  - Link a `/admin/reportes` con contador de pendientes.
  - Sección **Administradores**: lista de emails, input para agregar, botón eliminar por fila
    (deshabilitado para el propio email).
  - Botón "Cerrar sesión".

### Página `/admin/reportes`

Solo admin (redirige a `/admin` si no). Lista de reportes pendientes: contenido reportado
(comentario/aporte completo, profesor asociado, fecha), motivo del reporte, cantidad de reportes
sobre el mismo contenido. Acciones por fila: **Eliminar contenido** (confirmación) e **Ignorar**.

### Moderación inline en la app

Los Server Components existentes (perfil de profesor, asignatura, home) calculan `isAdmin` con
`getAdminEmail()` y lo pasan como prop:

- `EvaluacionLista`: si `isAdmin`, botón "Eliminar" siempre visible en cada evaluación (con
  confirmación), independiente del token de autor.
- `WikiSeccion`: ídem para aportes.
- Perfil de profesor: si `isAdmin`, botón "Editar" (modal con nombre/apellido y foto, reutilizando
  la ruta de foto existente ya endurecida) y botón
  "Eliminar profesor" con confirmación fuerte (escribir el nombre del profesor para confirmar,
  advirtiendo que borra todas sus evaluaciones).

### Botón "Reportar" (todos los usuarios)

En cada evaluación y aporte, botón discreto "Reportar" → modal con motivo opcional →
`POST /api/reportes`. Tras reportar, feedback "Reporte enviado" (o "Ya reportaste este
contenido" si 429).

## 5. Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` sigue solo en servidor; las tablas nuevas no tienen políticas RLS
  públicas (solo service role).
- Toda decisión de autorización ocurre server-side vía `getAdminEmail()`; la prop `isAdmin` del
  cliente es solo cosmética (mostrar/ocultar botones).
- Login no revela si un email es admin (respuesta genérica).
- Rate limiting implícito de Supabase para magic links (limita abuso del endpoint de login).
- Guardas en gestión de admins: no auto-eliminarse, mínimo 1 admin.
- Reportes con anti-spam por `ip_hash` (mismo patrón existente; nunca IP en crudo).

## 6. Configuración requerida (manual, fuera del código)

- Habilitar el proveedor Email (magic link / OTP) en Supabase Auth.
- Configurar Site URL y Redirect URLs (localhost y producción) en la configuración de Auth de
  Supabase, y el template del email Magic Link apuntando a `/auth/confirm` (ver flujo de login).

## 7. Testing

- Manual con `npm run dev`: flujo completo de login con un email de la lista y uno fuera de ella;
  eliminar evaluación como admin pasada la ventana de 10 min; reportar el mismo contenido dos
  veces desde la misma IP; agregar y quitar un admin; intentar quitarse a sí mismo.
- Verificar con un navegador sin sesión que las rutas admin responden 401/403 y que `/admin/reportes`
  redirige.
- `npm run build` y `npm run lint` sin errores.
