import type { createServerClient } from '@/lib/supabase/server'
import type {
  Asignatura,
  ProfesorConStats,
  ProfesorConStatsYAsignaturas,
} from '@/types'

type ServerClient = Awaited<ReturnType<typeof createServerClient>>

/**
 * Adjunta las asignaturas de cada profesor (vía profesor_asignatura) a una
 * lista de profesores con stats. La vista profesores_con_stats no incluye
 * asignaturas, por eso se consultan y mergean aparte.
 */
export async function adjuntarAsignaturas(
  supabase: ServerClient,
  profesores: ProfesorConStats[]
): Promise<ProfesorConStatsYAsignaturas[]> {
  if (profesores.length === 0) return []

  const { data: relaciones } = await supabase
    .from('profesor_asignatura')
    .select('profesor_id, asignaturas(*)')
    .in(
      'profesor_id',
      profesores.map((p) => p.id)
    )

  const porProfesor = new Map<string, Asignatura[]>()
  for (const rel of relaciones ?? []) {
    // PostgREST puede entregar la relación embebida como objeto o como array
    const embebida = (rel as { asignaturas: Asignatura | Asignatura[] | null })
      .asignaturas
    const asignaturasRel = Array.isArray(embebida)
      ? embebida
      : embebida
        ? [embebida]
        : []
    if (asignaturasRel.length === 0) continue
    const lista = porProfesor.get(rel.profesor_id) ?? []
    lista.push(...asignaturasRel)
    porProfesor.set(rel.profesor_id, lista)
  }

  return profesores.map((profesor) => ({
    ...profesor,
    asignaturas: porProfesor.get(profesor.id) ?? [],
  }))
}
