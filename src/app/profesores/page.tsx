import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import type { ProfesorConStats, Asignatura } from '@/types'
import ProfesorCard from '@/components/ProfesorCard'
import Buscador from '@/components/Buscador'
import FiltroAsignatura from '@/components/FiltroAsignatura'
import CrearProfesorModal from '@/components/CrearProfesorModal'

interface Props {
  searchParams: Promise<{ q?: string; asignatura?: string }>
}

export default async function ProfesoresPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createServerClient()

  const { data: asignaturas } = await supabase
    .from('asignaturas')
    .select('*')
    .order('nombre')

  let query = supabase
    .from('profesores_con_stats')
    .select('*')
    .order('avg_general', { ascending: false, nullsFirst: false })

  if (params.q) {
    query = query.or(`nombre.ilike.%${params.q}%,apellido.ilike.%${params.q}%`)
  }

  const { data: profesores } = await query

  let filteredProfesores = (profesores ?? []) as ProfesorConStats[]

  if (params.asignatura) {
    const { data: relaciones } = await supabase
      .from('profesor_asignatura')
      .select('profesor_id')
      .eq('asignatura_id', params.asignatura)

    const profesorIds = new Set((relaciones ?? []).map((r) => r.profesor_id))
    filteredProfesores = filteredProfesores.filter((p) => profesorIds.has(p.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profesores</h1>
        <CrearProfesorModal />
      </div>

      <Suspense fallback={null}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Buscador />
          </div>
          <FiltroAsignatura asignaturas={(asignaturas ?? []) as Asignatura[]} />
        </div>
      </Suspense>

      {filteredProfesores.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-gray-400 font-medium">No se encontraron profesores</p>
          <p className="text-gray-300 text-sm mt-1">Intenta con otro nombre o agrega uno nuevo</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredProfesores.map((profesor) => (
            <ProfesorCard key={profesor.id} profesor={profesor} />
          ))}
        </div>
      )}
    </div>
  )
}
