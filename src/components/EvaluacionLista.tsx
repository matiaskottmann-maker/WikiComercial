'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { EvaluacionConAsignatura } from '@/types'
import RatingStars from './RatingStars'
import CountdownTimer from './CountdownTimer'
import { getEditToken, removeEditToken } from '@/lib/utils'
import ReportarButton from './ReportarButton'

interface EvaluacionListaProps {
  evaluaciones: EvaluacionConAsignatura[]
  isAdmin?: boolean
}

export default function EvaluacionLista({ evaluaciones, isAdmin = false }: EvaluacionListaProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, setForceUpdate] = useState(0)
  const router = useRouter()

  const forceRender = useCallback(() => setForceUpdate((n) => n + 1), [])

  async function handleDelete(evId: string) {
    const token = getEditToken(evId)
    if (!token && !isAdmin) return
    if (isAdmin && !token && !confirm('¿Eliminar esta evaluación definitivamente?')) return

    setDeletingId(evId)
    try {
      const res = await fetch(`/api/evaluaciones/${evId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { edit_token: token.token } : {}),
      })

      if (res.ok) {
        removeEditToken(evId)
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (evaluaciones.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-gray-400 font-medium">Aun no hay evaluaciones</p>
        <p className="text-gray-300 text-sm mt-1">Se el primero en evaluar!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {evaluaciones.map((ev) => {
        const token = getEditToken(ev.id)

        return (
          <div
            key={ev.id}
            className={`bg-white rounded-2xl border p-5 transition-all duration-200 hover:shadow-sm ${
              token ? 'border-uc-blue/20 bg-blue-50/20' : 'border-gray-100'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-uc-blue">{ev.rating_general}.0</span>
                <RatingStars rating={ev.rating_general} size="sm" />
              </div>
              <div className="flex items-center gap-2">
                {token && (
                  <CountdownTimer createdAt={token.createdAt} onExpire={forceRender} />
                )}
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{ev.semestre}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm mb-3">
              <span className="flex items-center gap-1 text-gray-500">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                Claridad {ev.rating_claridad}/5
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                Exigencia {ev.rating_exigencia}/5
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                Disponibilidad {ev.rating_disponibilidad}/5
              </span>
            </div>

            {ev.asignaturas && (
              <span className="inline-block text-xs font-medium text-uc-blue bg-blue-50 px-2.5 py-1 rounded-lg mb-2">
                {ev.asignaturas.nombre}
              </span>
            )}

            {ev.aprobado !== null && (
              <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-lg mb-2 ml-2 ${
                ev.aprobado ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {ev.aprobado ? 'Aprobo' : 'No aprobo'}
              </span>
            )}

            {ev.comentario && (
              <p className="text-gray-700 mt-2 leading-relaxed">{ev.comentario}</p>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-400">
                {new Date(ev.created_at).toLocaleDateString('es-CL')}
              </p>
              <div className="flex items-center gap-3">
                <ReportarButton evaluacionId={ev.id} />
                {(token || isAdmin) && (
                  <button
                    onClick={() => handleDelete(ev.id)}
                    disabled={deletingId === ev.id}
                    className="text-xs text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    {deletingId === ev.id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
