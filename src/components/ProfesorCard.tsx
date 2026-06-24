import Link from 'next/link'
import Image from 'next/image'
import type { Asignatura, ProfesorConStats } from '@/types'
import RatingStars from './RatingStars'
import { formatRating } from '@/lib/utils'

interface ProfesorCardProps {
  profesor: ProfesorConStats & { asignaturas?: Asignatura[] }
}

export default function ProfesorCard({ profesor }: ProfesorCardProps) {
  return (
    <Link
      href={`/profesores/${profesor.slug}`}
      className="group block bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-gray-200/50 hover:border-gray-200 transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        {profesor.foto_url ? (
          <Image
            src={profesor.foto_url}
            alt={`${profesor.nombre} ${profesor.apellido}`}
            width={56}
            height={56}
            className="w-14 h-14 rounded-xl object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-uc-blue to-uc-blue-light text-white flex items-center justify-center text-lg font-semibold shrink-0 group-hover:shadow-md group-hover:shadow-uc-blue/20 transition-shadow">
            {profesor.nombre[0]}{profesor.apellido[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-uc-blue transition-colors">
            {profesor.nombre} {profesor.apellido}
          </h3>
          {profesor.asignaturas && profesor.asignaturas.length > 0 && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {profesor.asignaturas.map((a) => a.nombre).join(' · ')}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xl font-bold text-uc-blue">
              {formatRating(profesor.avg_general)}
            </span>
            <RatingStars rating={profesor.avg_general} size="sm" />
          </div>
          <span className="text-xs text-gray-400 mt-0.5 block">
            {profesor.total_evaluaciones} {profesor.total_evaluaciones === 1 ? 'evaluacion' : 'evaluaciones'}
          </span>
        </div>
      </div>
    </Link>
  )
}
