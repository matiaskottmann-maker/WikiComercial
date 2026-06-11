import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import type { ProfesorConStats } from '@/types'
import ProfesorCard from '@/components/ProfesorCard'
import CrearProfesorModal from '@/components/CrearProfesorModal'

export default async function HomePage() {
  const supabase = await createServerClient()

  const { data: profesores } = await supabase
    .from('profesores_con_stats')
    .select('*')
    .order('total_evaluaciones', { ascending: false })
    .limit(6)

  const hayProfesores = profesores && profesores.length > 0

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-16">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-uc-blue text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-uc-blue rounded-full animate-pulse"></span>
          Plataforma comunitaria y anónima
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
          Wiki<span className="text-uc-blue">Comercial</span>
        </h1>
        <p className="text-lg text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
           Evalúa y descubre cómo son los profesores de Ingeniería Comercial UC
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/profesores"
            className="bg-gradient-to-r from-uc-blue to-uc-blue-light text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-uc-blue/25 transition-all duration-200 active:scale-[0.98]"
          >
            Buscar profesores
          </Link>
          <CrearProfesorModal />
        </div>
      </section>

      {/* Top profesores */}
      {hayProfesores && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Profesores más evaluados
            </h2>
            <Link
              href="/profesores"
              className="text-sm text-uc-blue font-medium hover:text-uc-blue-light transition-colors"
            >
              Ver todos
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(profesores as ProfesorConStats[]).map((profesor) => (
              <ProfesorCard key={profesor.id} profesor={profesor} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!hayProfesores && (
        <section className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Aun no hay profesores</h2>
          <p className="text-gray-400 mb-6">Se el primero en agregar un profesor a WikiComercial!</p>
        </section>
      )}
    </div>
  )
}
