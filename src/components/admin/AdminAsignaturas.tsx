'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Asignatura } from '@/types'

export interface AsignaturaConUso extends Asignatura {
  profesores: number
  evaluaciones: number
}

interface AdminAsignaturasProps {
  asignaturas: AsignaturaConUso[]
}

export default function AdminAsignaturas({ asignaturas }: AdminAsignaturasProps) {
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [fusionandoId, setFusionandoId] = useState<string | null>(null)
  const [destinoId, setDestinoId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function cerrarPaneles() {
    setRenombrandoId(null)
    setFusionandoId(null)
    setNuevoNombre('')
    setDestinoId('')
    setError(null)
  }

  async function handleRenombrar(id: string) {
    if (!nuevoNombre.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/asignaturas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al renombrar')

      cerrarPaneles()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleFusionar(origenId: string) {
    if (!destinoId) return
    const origen = asignaturas.find((a) => a.id === origenId)
    const destino = asignaturas.find((a) => a.id === destinoId)
    if (!origen || !destino) return

    if (
      !confirm(
        `Se moverán las ${origen.evaluaciones} evaluaciones y ${origen.profesores} profesores de "${origen.nombre}" a "${destino.nombre}", y "${origen.nombre}" se eliminará. ¿Continuar?`
      )
    )
      return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/asignaturas/fusionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen_id: origenId, destino_id: destinoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al fusionar')

      cerrarPaneles()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (asignaturas.length === 0) {
    return <p className="text-center text-gray-400 py-12">No hay asignaturas todavía.</p>
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
      {error && (
        <p className="text-red-600 text-sm px-5 py-3 bg-red-50 rounded-t-2xl">⚠️ {error}</p>
      )}

      {asignaturas.map((a) => (
        <div key={a.id} className="px-5 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{a.nombre}</p>
              <p className="text-xs text-gray-400">
                {a.profesores} {a.profesores === 1 ? 'profesor' : 'profesores'} ·{' '}
                {a.evaluaciones} {a.evaluaciones === 1 ? 'evaluación' : 'evaluaciones'}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => {
                  cerrarPaneles()
                  setRenombrandoId(a.id)
                  setNuevoNombre(a.nombre)
                }}
                className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ✎ Renombrar
              </button>
              <button
                onClick={() => {
                  cerrarPaneles()
                  setFusionandoId(a.id)
                }}
                className="text-xs bg-white border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
              >
                ⇄ Fusionar
              </button>
            </div>
          </div>

          {renombrandoId === a.id && (
            <div className="flex gap-2 mt-3">
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-sm"
                autoFocus
              />
              <button
                onClick={cerrarPaneles}
                className="text-xs text-gray-500 hover:text-gray-700 px-3"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRenombrar(a.id)}
                disabled={loading || !nuevoNombre.trim()}
                className="text-xs bg-uc-blue text-white px-4 py-2 rounded-lg hover:bg-uc-blue-light disabled:opacity-50 transition-colors"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}

          {fusionandoId === a.id && (
            <div className="mt-3 p-3 bg-amber-50 rounded-xl space-y-2">
              <p className="text-xs text-amber-800">
                Las evaluaciones y profesores de <strong>{a.nombre}</strong> se moverán a la
                asignatura que elijas, y esta se eliminará:
              </p>
              <div className="flex gap-2">
                <select
                  value={destinoId}
                  onChange={(e) => setDestinoId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-sm bg-white"
                >
                  <option value="">Elegir asignatura destino...</option>
                  {asignaturas
                    .filter((otra) => otra.id !== a.id)
                    .map((otra) => (
                      <option key={otra.id} value={otra.id}>
                        {otra.nombre} ({otra.evaluaciones} evaluaciones)
                      </option>
                    ))}
                </select>
                <button
                  onClick={cerrarPaneles}
                  className="text-xs text-gray-500 hover:text-gray-700 px-3"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleFusionar(a.id)}
                  disabled={loading || !destinoId}
                  className="text-xs bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Fusionando...' : 'Fusionar'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
