'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReporteConContenido } from '@/types'

interface ReportesListaProps {
  reportes: ReporteConContenido[]
}

export default function ReportesLista({ reportes }: ReportesListaProps) {
  const [procesando, setProcesando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleEliminarContenido(reporte: ReporteConContenido) {
    const esEvaluacion = !!reporte.evaluacion_id
    const tipo = esEvaluacion ? 'evaluación' : 'aporte'
    if (!confirm(`¿Eliminar este ${tipo} definitivamente?`)) return

    setProcesando(reporte.id)
    setError(null)

    try {
      const url = esEvaluacion
        ? `/api/evaluaciones/${reporte.evaluacion_id}`
        : `/api/aportes/${reporte.aporte_id}`

      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar')
      }

      // Los reportes del contenido caen en cascada
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setProcesando(null)
    }
  }

  async function handleIgnorar(reporteId: string) {
    setProcesando(reporteId)
    setError(null)

    try {
      const res = await fetch(`/api/admin/reportes/${reporteId}`, {
        method: 'PATCH',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al ignorar')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setProcesando(null)
    }
  }

  if (reportes.length === 0) {
    return (
      <p className="text-center text-gray-400 py-12">
        No hay reportes pendientes 🎉
      </p>
    )
  }

  // Cantidad de reportes por contenido (mismo contenido puede tener varios)
  const conteoPorContenido = new Map<string, number>()
  for (const r of reportes) {
    const key = r.evaluacion_id ?? r.aporte_id ?? r.id
    conteoPorContenido.set(key, (conteoPorContenido.get(key) ?? 0) + 1)
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {reportes.map((r) => {
        const contenido = r.evaluaciones ?? r.aportes_wiki
        const profesor = contenido?.profesores
        const conteo = conteoPorContenido.get(r.evaluacion_id ?? r.aporte_id ?? r.id) ?? 1
        const texto = r.evaluaciones
          ? r.evaluaciones.comentario ?? '(evaluación sin comentario)'
          : r.aportes_wiki?.contenido ?? '(contenido eliminado)'

        return (
          <div
            key={r.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">
                {r.evaluacion_id ? '📝 Evaluación' : '📚 Aporte wiki'}
                {' · '}
                {new Date(r.created_at).toLocaleDateString('es-CL')}
                {conteo > 1 && (
                  <span className="ml-2 text-red-500 font-semibold">×{conteo} reportes</span>
                )}
              </span>
              {profesor && (
                <Link
                  href={`/profesores/${profesor.slug}`}
                  className="text-xs text-uc-blue hover:underline"
                >
                  {profesor.nombre} {profesor.apellido}
                </Link>
              )}
            </div>

            <p className="text-gray-700 text-sm bg-gray-50 rounded-xl p-3 mb-2">
              {texto}
            </p>

            {r.motivo && (
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-medium">Motivo del reporte:</span> {r.motivo}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleIgnorar(r.id)}
                disabled={procesando === r.id}
                className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-1.5 rounded-xl transition-colors disabled:opacity-50"
              >
                Ignorar
              </button>
              <button
                onClick={() => handleEliminarContenido(r)}
                disabled={procesando === r.id || !contenido}
                className="text-sm bg-red-500 text-white px-4 py-1.5 rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {procesando === r.id ? 'Procesando...' : 'Eliminar contenido'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
