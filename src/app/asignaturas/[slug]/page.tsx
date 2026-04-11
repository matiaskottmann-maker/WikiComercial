import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { Asignatura, ProfesorConStats } from '@/types'
import ProfesorCard from '@/components/ProfesorCard'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function AsignaturaPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createServerClient()

  const { data: asignatura } = await supabase
    .from('asignaturas')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!asignatura) notFound()

  const asig = asignatura as Asignatura

  const { data: relaciones } = await supabase
    .from('profesor_asignatura')
    .select('profesor_id')
    .eq('asignatura_id', asig.id)

  const profesorIds = (relaciones ?? []).map((r) => r.profesor_id)

  let profesores: ProfesorConStats[] = []
  if (profesorIds.length > 0) {
    const { data } = await supabase
      .from('profesores_con_stats')
      .select('*')
      .in('id', profesorIds)
      .order('avg_general', { ascending: false, nullsFirst: false })

    profesores = (data ?? []) as ProfesorConStats[]
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{asig.nombre}</h1>
        {asig.codigo && (
          <p className="text-gray-500">{asig.codigo}</p>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-900">
        Profesores que dictan esta asignatura
      </h2>

      {profesores.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No hay profesores registrados para esta asignatura.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {profesores.map((profesor) => (
            <ProfesorCard key={profesor.id} profesor={profesor} />
          ))}
        </div>
      )}
    </div>
  )
}
