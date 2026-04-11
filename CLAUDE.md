# WikiFEDUC — CLAUDE.md

## Qué es este proyecto
Plataforma web comunitaria para estudiantes de Ingeniería Comercial de la Pontificia Universidad Católica de Chile (Facultad de Ciencias Económicas y Administrativas — FEDUC). Permite evaluar profesores de forma anónima y consultar reseñas de otros estudiantes. Inspirado en wikifen.cl (plataforma equivalente de la FEN, U. de Chile).

**NO hay sección de apuntes. Solo profesores y evaluaciones.**

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 — App Router |
| Lenguaje | TypeScript (strict) |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth — magic link con email (sin registro de contraseña) |
| Estilos | Tailwind CSS v3 |
| Deploy frontend | Vercel |
| Deploy DB | Supabase cloud (proyecto dedicado) |

**No usar:** Pages Router, JavaScript puro, Prisma, otras bases de datos, Express, MongoDB.

---

## Estructura de carpetas

```
wikifeduc/
├── CLAUDE.md
├── MEMORY.md
├── .env.local               # nunca commitear
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── supabase/
│   ├── schema.sql           # schema completo, fuente de verdad
│   ├── seed.sql             # datos iniciales (profesores, asignaturas)
│   └── rls.sql              # todas las políticas RLS
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                        # home — buscador + listado
│   │   ├── profesores/
│   │   │   ├── page.tsx                    # listado completo con filtros
│   │   │   └── [slug]/
│   │   │       └── page.tsx                # perfil del profesor
│   │   ├── asignaturas/
│   │   │   └── [slug]/
│   │   │       └── page.tsx                # asignatura con sus profes
│   │   └── api/
│   │       └── evaluaciones/
│   │           └── route.ts                # POST nueva evaluación
│   │
│   ├── components/
│   │   ├── ui/                             # componentes base reutilizables
│   │   ├── ProfesorCard.tsx
│   │   ├── ProfesorPerfil.tsx
│   │   ├── EvaluacionForm.tsx
│   │   ├── EvaluacionLista.tsx
│   │   ├── RatingStars.tsx
│   │   ├── Buscador.tsx
│   │   └── FiltroAsignatura.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # createBrowserClient
│   │   │   └── server.ts                   # createServerClient
│   │   └── utils.ts
│   │
│   └── types/
│       └── index.ts                        # todos los tipos TypeScript
```

---

## Schema de base de datos

### Tabla: `profesores`
```sql
id            uuid primary key default gen_random_uuid()
nombre        text not null
apellido      text not null
slug          text not null unique          -- ej: "juan-perez"
foto_url      text                          -- nullable, foto opcional
email         text                          -- email institucional UC, nullable
created_at    timestamptz default now()
```

### Tabla: `asignaturas`
```sql
id            uuid primary key default gen_random_uuid()
nombre        text not null
codigo        text unique                   -- ej: "ICC2233"
slug          text not null unique
created_at    timestamptz default now()
```

### Tabla: `profesor_asignatura` (relación muchos a muchos)
```sql
profesor_id   uuid references profesores(id) on delete cascade
asignatura_id uuid references asignaturas(id) on delete cascade
primary key (profesor_id, asignatura_id)
```

### Tabla: `evaluaciones`
```sql
id              uuid primary key default gen_random_uuid()
profesor_id     uuid references profesores(id) on delete cascade not null
asignatura_id   uuid references asignaturas(id) not null
rating_general  int2 check (rating_general between 1 and 5) not null
rating_claridad int2 check (rating_claridad between 1 and 5) not null
rating_exigencia int2 check (rating_exigencia between 1 and 5) not null
rating_disponibilidad int2 check (rating_disponibilidad between 1 and 5) not null
comentario      text check (char_length(comentario) <= 1000)
semestre        text                        -- ej: "2024-2", "2025-1"
aprobado        boolean                     -- si el alumno aprobó el ramo
ip_hash         text not null               -- SHA256 del IP para anti-spam
created_at      timestamptz default now()
```

**Nunca almacenar IP en crudo — solo el hash.**

### Vista: `profesores_con_stats`
```sql
-- Vista que agrega ratings promedio por profesor
-- calcular en la vista, no en el frontend
SELECT 
  p.*,
  COUNT(e.id) as total_evaluaciones,
  ROUND(AVG(e.rating_general)::numeric, 1) as avg_general,
  ROUND(AVG(e.rating_claridad)::numeric, 1) as avg_claridad,
  ROUND(AVG(e.rating_exigencia)::numeric, 1) as avg_exigencia,
  ROUND(AVG(e.rating_disponibilidad)::numeric, 1) as avg_disponibilidad
FROM profesores p
LEFT JOIN evaluaciones e ON e.profesor_id = p.id
GROUP BY p.id
```

---

## RLS (Row Level Security)

**Siempre activar RLS en todas las tablas.**

```
profesores       → SELECT: public | INSERT/UPDATE/DELETE: solo service_role
asignaturas      → SELECT: public | INSERT/UPDATE/DELETE: solo service_role  
profesor_asignatura → SELECT: public | INSERT/UPDATE/DELETE: solo service_role
evaluaciones     → SELECT: public | INSERT: public (anónimo) | UPDATE/DELETE: nadie
```

La lógica anti-spam va en la API route de Next.js, no en RLS.

---

## Variables de entorno

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # solo en servidor, nunca exponer al cliente
```

**Regla:** `NEXT_PUBLIC_` solo para valores que pueden ser públicos. El `service_role` NUNCA va en variables públicas.

---

## Reglas de negocio

### Evaluaciones anónimas
- No se requiere registro ni login para evaluar
- Se hashea el IP del evaluador (SHA256) antes de guardar
- Un mismo IP puede evaluar a un mismo profesor máximo **1 vez por semestre**
- Esta validación ocurre en la API route `/api/evaluaciones` con el `SUPABASE_SERVICE_ROLE_KEY`
- El frontend nunca tiene acceso al service role key

### Anti-spam en API route
```typescript
// Lógica requerida en POST /api/evaluaciones
1. Recibir { profesor_id, asignatura_id, ratings, comentario, semestre }
2. Obtener IP del request (headers['x-forwarded-for'] o connection.remoteAddress)
3. Hashear IP con SHA256
4. Verificar en Supabase si ya existe evaluación con ese ip_hash + profesor_id + semestre
5. Si existe → return 429 "Ya evaluaste a este profesor este semestre"
6. Si no → insertar evaluación
```

### Moderación de comentarios
- Los comentarios son visibles inmediatamente (sin moderación previa)
- Campo `comentario` es opcional
- Máximo 1000 caracteres
- El admin puede eliminar evaluaciones directamente desde Supabase dashboard

### Slugs
- Generados automáticamente desde nombre + apellido
- Formato: `nombre-apellido` en minúsculas, sin tildes, sin espacios
- Únicos en BD

---

## Convenciones de código

### TypeScript
```typescript
// BIEN — tipos explícitos en types/index.ts
export interface Profesor {
  id: string
  nombre: string
  apellido: string
  slug: string
  foto_url: string | null
  email: string | null
  created_at: string
}

export interface ProfesorConStats extends Profesor {
  total_evaluaciones: number
  avg_general: number | null
  avg_claridad: number | null
  avg_exigencia: number | null
  avg_disponibilidad: number | null
  asignaturas: Asignatura[]
}
```

### Supabase client
```typescript
// En Server Components y API routes → usar server client
import { createServerClient } from '@/lib/supabase/server'

// En Client Components → usar browser client
import { createBrowserClient } from '@/lib/supabase/client'
```

### Fetching de datos
- Server Components para datos estáticos o que no cambian con interacción
- Client Components solo cuando se necesita interactividad real (formulario de evaluación, búsqueda en tiempo real)
- Nunca hacer fetch en useEffect cuando se puede hacer en Server Component

### Errores
- Siempre manejar errores de Supabase explícitamente
- No usar `!` (non-null assertion) a menos que sea absolutamente seguro
- Mostrar estados de carga y error en la UI

---

## UI y diseño

- Colores institucionales UC: **azul UC (#003F8A)** y **blanco**
- Diseño limpio, universitario, sin excesos
- Mobile-first — la mayoría accede desde el celular
- Rating visual con estrellas (★★★★☆)
- Separar claramente: rating general (número grande destacado) y sub-ratings (claridad, exigencia, disponibilidad)
- Mostrar cantidad de evaluaciones junto al rating ("4.2 ★ — 47 evaluaciones")
- Página de profesor debe mostrar: foto (si hay), nombre, asignaturas que hace, stats, lista de comentarios, formulario para evaluar

---

## Lo que NO hacer

- ❌ No implementar sistema de login/registro completo — es anónimo
- ❌ No usar `any` en TypeScript
- ❌ No hardcodear strings de Supabase — siempre desde env vars
- ❌ No poner lógica de negocio en el frontend
- ❌ No crear sección de apuntes (fuera de scope)
- ❌ No usar `useEffect` para fetching de datos que pueden ser Server Components
- ❌ No exponer `SUPABASE_SERVICE_ROLE_KEY` en el cliente

---

## Comandos útiles

```bash
npm run dev          # desarrollo local
npm run build        # build de producción
npm run lint         # lint
npx supabase db push # aplicar migraciones (si se usa Supabase CLI)
```

---

## Estado del proyecto
Ver MEMORY.md para el estado actual de implementación.