import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import type { Asignatura, EvaluacionConAsignatura, AporteWiki } from '@/types'
import { SECCIONES_WIKI } from '@/types'
import RatingStars from '@/components/RatingStars'
import EvaluacionLista from '@/components/EvaluacionLista'
import EvaluacionForm from '@/components/EvaluacionForm'
import WikiSeccion from '@/components/WikiSeccion'
import FotoProfesor from '@/components/FotoProfesor'
import AdminProfesorAcciones from '@/components/admin/AdminProfesorAcciones'
import { formatRating } from '@/lib/utils'
import { getAdminEmail } from '@/lib/admin'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ProfesorPerfilPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createServerClient()
  const isAdmin = !!(await getAdminEmail())

  const { data: profesor } = await supabase
    .from('profesores_con_stats')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!profesor) notFound()

  const { data: relaciones } = await supabase
    .from('profesor_asignatura')
    .select('asignatura_id, asignaturas(*)')
    .eq('profesor_id', profesor.id)

  const asignaturas: Asignatura[] = (relaciones ?? [])
    .map((r) => r.asignaturas as unknown as Asignatura)
    .filter(Boolean)

  const { data: evaluaciones } = await supabase
    .from('evaluaciones')
    .select('*, asignaturas(*)')
    .eq('profesor_id', profesor.id)
    .order('created_at', { ascending: false })

  const { data: aportes } = await supabase
    .from('aportes_wiki')
    .select('*')
    .eq('profesor_id', profesor.id)
    .order('created_at', { ascending: true })

  const aportesTyped = (aportes ?? []) as AporteWiki[]

  return (
    <div className="space-y-8">
      {/* Volver */}
      <Link
        href="/profesores"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-uc-blue transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a profesores
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <FotoProfesor
            profesorId={profesor.id}
            nombre={profesor.nombre}
            apellido={profesor.apellido}
            fotoUrl={profesor.foto_url}
            isAdmin={isAdmin}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
              {profesor.nombre} {profesor.apellido}
            </h1>
            {profesor.email && (
              <p className="text-gray-400 text-sm mt-1">{profesor.email}</p>
            )}
            {asignaturas.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {asignaturas.map((a) => (
                  <span
                    key={a.id}
                    className="text-xs font-medium bg-blue-50 text-uc-blue px-3 py-1 rounded-lg"
                  >
                    {a.nombre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <AdminProfesorAcciones
          profesorId={profesor.id}
          nombre={profesor.nombre}
          apellido={profesor.apellido}
        />
      )}

      {/* Stats */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="flex flex-col items-center">
            <span className="text-5xl font-bold text-uc-blue">
              {formatRating(profesor.avg_general)}
            </span>
            <RatingStars rating={profesor.avg_general} size="lg" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-400">
              {profesor.total_evaluaciones} {profesor.total_evaluaciones === 1 ? 'evaluacion' : 'evaluaciones'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center bg-gray-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{formatRating(profesor.avg_claridad)}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Claridad</p>
          </div>
          <div className="text-center bg-gray-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{formatRating(profesor.avg_exigencia)}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Exigencia</p>
          </div>
          <div className="text-center bg-gray-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{formatRating(profesor.avg_disponibilidad)}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Disponibilidad</p>
          </div>
        </div>
      </div>

      {/* Secciones Wiki */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Informacion del profesor</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {SECCIONES_WIKI.map(({ key, label, icon }) => (
            <WikiSeccion
              key={key}
              profesorId={profesor.id}
              seccion={key}
              label={label}
              icon={icon}
              aportes={aportesTyped.filter((a) => a.seccion === key)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </div>

      {/* Evaluacion */}
      <EvaluacionForm profesorId={profesor.id} />

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Evaluaciones</h2>
        <EvaluacionLista evaluaciones={(evaluaciones ?? []) as EvaluacionConAsignatura[]} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
