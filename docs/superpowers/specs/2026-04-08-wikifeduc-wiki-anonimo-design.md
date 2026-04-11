# WikiFEDUC — Diseño: Wiki Anónimo con Edición Temporal

**Fecha:** 2026-04-08  
**Estado:** Aprobado por usuario

---

## Resumen

Transformar WikiFEDUC de una plataforma append-only a un **wiki comunitario anónimo** donde cualquier persona puede:
- Crear profesores
- Agregar aportes wiki y evaluaciones
- Editar/borrar sus propios aportes dentro de una **ventana de 10 minutos**

Sin login. Sin registro. Totalmente anónimo.

---

## Decisiones clave

| Decisión | Resolución |
|----------|-----------|
| ¿Quién crea profesores? | Cualquiera (anti-spam: max 5/día por IP) |
| ¿Quién edita datos del profesor (nombre/foto)? | Solo el creador, dentro de 10 min |
| ¿Quién edita aportes wiki? | Solo el autor, dentro de 10 min |
| ¿Quién edita evaluaciones? | Solo el autor, dentro de 10 min |
| ¿Cómo se identifica al autor? | Token secreto (UUID) en localStorage |
| ¿Muro anónimo? | Eliminado (ruido) |
| ¿Admins? | No — el dueño administra directo desde Supabase dashboard |
| ¿Diseño visual? | Moderno, limpio, con cariño — no estilo Wikipedia plano |

---

## Schema de base de datos

### Cambios respecto al schema anterior

- `profesores`: agregar `edit_token_hash text`, `ip_hash text`
- `evaluaciones`: agregar `edit_token_hash text`
- `aportes_wiki`: agregar `edit_token_hash text`
- **Eliminar** tabla `opiniones`
- **Sin seed data** — la web se entrega en blanco

### Tablas finales

```sql
-- profesores
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

-- asignaturas
CREATE TABLE asignaturas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  codigo        text UNIQUE,
  slug          text NOT NULL UNIQUE,
  created_at    timestamptz DEFAULT now()
);

-- profesor_asignatura
CREATE TABLE profesor_asignatura (
  profesor_id   uuid REFERENCES profesores(id) ON DELETE CASCADE,
  asignatura_id uuid REFERENCES asignaturas(id) ON DELETE CASCADE,
  PRIMARY KEY (profesor_id, asignatura_id)
);

-- evaluaciones
CREATE TABLE evaluaciones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id           uuid REFERENCES profesores(id) ON DELETE CASCADE NOT NULL,
  asignatura_id         uuid REFERENCES asignaturas(id) NOT NULL,
  rating_general        int2 CHECK (rating_general BETWEEN 1 AND 5) NOT NULL,
  rating_claridad       int2 CHECK (rating_claridad BETWEEN 1 AND 5) NOT NULL,
  rating_exigencia      int2 CHECK (rating_exigencia BETWEEN 1 AND 5) NOT NULL,
  rating_disponibilidad int2 CHECK (rating_disponibilidad BETWEEN 1 AND 5) NOT NULL,
  comentario            text CHECK (char_length(comentario) <= 1000),
  semestre              text,
  aprobado              boolean,
  ip_hash               text NOT NULL,
  edit_token_hash       text,
  created_at            timestamptz DEFAULT now()
);

-- aportes_wiki
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

-- Vista
CREATE OR REPLACE VIEW profesores_con_stats AS
SELECT p.*,
  COUNT(e.id)::int AS total_evaluaciones,
  ROUND(AVG(e.rating_general)::numeric, 1) AS avg_general,
  ROUND(AVG(e.rating_claridad)::numeric, 1) AS avg_claridad,
  ROUND(AVG(e.rating_exigencia)::numeric, 1) AS avg_exigencia,
  ROUND(AVG(e.rating_disponibilidad)::numeric, 1) AS avg_disponibilidad
FROM profesores p
LEFT JOIN evaluaciones e ON e.profesor_id = p.id
GROUP BY p.id;
```

### RLS

- Todas las tablas: SELECT público
- `profesores`: INSERT público (crear profes), UPDATE/DELETE solo service_role
- `asignaturas`: solo lectura pública (INSERT/UPDATE/DELETE solo service_role)
- `profesor_asignatura`: INSERT público, DELETE solo service_role
- `evaluaciones`: INSERT público, UPDATE/DELETE solo service_role
- `aportes_wiki`: INSERT público, UPDATE/DELETE solo service_role

> UPDATE y DELETE se ejecutan desde API routes con service_role tras validar el edit_token.

---

## Sistema de tokens de edición

### Flujo completo

1. Usuario publica un aporte/evaluación/profesor
2. Servidor genera `editToken = crypto.randomUUID()`
3. Servidor guarda `SHA256(editToken)` en columna `edit_token_hash`
4. Servidor devuelve `{ id, editToken }` al frontend
5. Frontend guarda en localStorage:
   ```json
   {
     "wikifeduc_tokens": [
       { "id": "uuid", "type": "aporte|evaluacion|profesor", "token": "uuid-token", "createdAt": "ISO-string" }
     ]
   }
   ```
6. Frontend muestra botones Editar/Eliminar si token existe y `createdAt < 10 min`
7. Al editar/borrar: frontend envía `{ edit_token }` → servidor verifica `SHA256(token) === hash` AND `created_at > now() - 10min`
8. Tokens expirados se limpian del localStorage automáticamente

### Seguridad

- Sin token válido → no se puede editar. No hay bypass.
- El token solo vive en el navegador del usuario. Si cierra o borra caché, pierde la capacidad de editar (aceptable para 10 min).
- Anti-spam se mantiene por IP hash en todas las rutas.

---

## API Routes

### Existentes (modificadas)

| Método | Ruta | Cambio |
|--------|------|--------|
| POST | `/api/evaluaciones` | Genera y devuelve `editToken` |
| POST | `/api/aportes` | Genera y devuelve `editToken` |

### Nuevas

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/profesores` | Crear profesor. Anti-spam: max 5/IP/día |
| PUT | `/api/aportes/[id]` | Editar aporte (token + 10 min) |
| DELETE | `/api/aportes/[id]` | Borrar aporte (token + 10 min) |
| PUT | `/api/evaluaciones/[id]` | Editar evaluación (token + 10 min) |
| DELETE | `/api/evaluaciones/[id]` | Borrar evaluación (token + 10 min) |
| PUT | `/api/profesores/[id]` | Editar nombre/apellido del profesor creado (token + 10 min) |

### Eliminadas

| Método | Ruta | Razón |
|--------|------|-------|
| POST | `/api/opiniones` | Muro eliminado |

### Validación PUT/DELETE (todas las rutas)

```
1. Recibir { edit_token, ...datos }
2. Buscar registro por id
3. Verificar SHA256(edit_token) === edit_token_hash
4. Verificar created_at > now() - 10 minutos
5. Si OK → ejecutar operación
6. Si no → 403
```

---

## Páginas y UI

### Estructura de páginas

| Ruta | Descripción | Cambio |
|------|-------------|--------|
| `/` | Home — buscador + top profesores + "Agregar profesor" | Agregar botón crear profe |
| `/profesores` | Listado con búsqueda y filtros | Agregar botón crear profe |
| `/profesores/[slug]` | Perfil — wiki + evaluaciones + formularios | Botones editar/eliminar con timer |
| `/asignaturas/[slug]` | Asignatura con sus profes | Sin cambios |
| `/muro` | **ELIMINAR** | — |

### Componentes nuevos

- **CrearProfesorModal** — modal para crear profesor (nombre + apellido obligatorio)
- **EditableAporte** — wrapper de aporte wiki con botones editar/eliminar y countdown
- **EditableEvaluacion** — wrapper de evaluación con botones editar/eliminar y countdown
- **CountdownTimer** — componente que muestra "Puedes editar por X:XX"

### Componentes a eliminar

- **MuroForm**
- **MuroLista**

### Experiencia de edición

- Cada aporte/evaluación que el usuario acaba de publicar muestra:
  - Borde sutil destacado (ej: borde azul UC suave)
  - Timer: "Puedes editar por 8:42"
  - Botón "Editar" → abre textarea/form inline
  - Botón "Eliminar" → confirmación y borrado
- Cuando el timer llega a 0, los botones desaparecen con transición suave
- El countdown corre en el frontend (useEffect con setInterval)

### Diseño visual

**Principios:**
- Moderno y limpio, no estilo Wikipedia plano
- Colores UC (#003F8A azul principal) con acentos suaves
- Cards con bordes redondeados, sombras sutiles, hover effects
- Tipografía clara, jerarquía visual marcada
- Mobile-first — mayoría accede desde celular
- Animaciones sutiles (transiciones de hover, aparición de elementos)
- Glassmorphism suave en algunos elementos (sin exagerar)
- Gradientes sutiles en headers/CTAs
- Espaciado generoso — no apretar elementos

**Componentes UI:**
- Cards de profesor: foto circular, nombre grande, rating destacado con color, badges de asignaturas
- Secciones wiki: acordeones elegantes con iconos, no bloques de texto plano
- Formularios: inputs con bordes suaves, focus states bonitos, botones con gradiente
- Timer de edición: badge pill con countdown, color que cambia cuando queda poco tiempo
- Empty states: ilustraciones simples o iconos grandes con mensaje amigable
- Toasts para confirmaciones (no alerts nativos del browser)

---

## Anti-spam

| Recurso | Límite |
|---------|--------|
| Crear profesor | 5 por IP por día |
| Evaluaciones | 1 por IP + profesor + semestre |
| Aportes wiki | 10 por IP por día |

---

## Lo que NO cambia

- Stack: Next.js 14 + TypeScript + Supabase + Tailwind
- Sistema de ratings con 4 dimensiones
- Slugs automáticos
- IP siempre hasheado, nunca en crudo
- Lógica anti-spam en API routes, no en frontend
- Deploy: Vercel + Supabase cloud
