---
name: project_status
description: Current implementation status of WikiFEDUC — what has been built, what is pending
type: project
---

WikiFEDUC initial build completed on 2026-03-17.

**Completed:**
- Next.js 14 project initialized with TypeScript, Tailwind CSS, App Router
- Supabase SQL files: schema.sql, seed.sql, rls.sql
- TypeScript types in src/types/index.ts
- Supabase clients (browser + server + service role)
- All components: RatingStars, RatingInput, ProfesorCard, Buscador, FiltroAsignatura, EvaluacionForm, EvaluacionLista
- All pages: home, /profesores, /profesores/[slug], /asignaturas/[slug]
- API route POST /api/evaluaciones with anti-spam (IP hash + 1 eval per professor per semester)
- Tailwind configured with UC colors (#003F8A)

**Pending:**
- Connect to actual Supabase instance (need credentials in .env.local)
- Run schema.sql, rls.sql, seed.sql on Supabase
- Deploy to Vercel

**Why:** This is the initial scaffolding. The app needs Supabase credentials to function.
**How to apply:** Next step is configuring .env.local with real Supabase credentials and running the SQL files.
