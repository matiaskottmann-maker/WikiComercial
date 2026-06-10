'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminProfesorAccionesProps {
  profesorId: string
  nombre: string
  apellido: string
}

export default function AdminProfesorAcciones({
  profesorId,
  nombre,
  apellido,
}: AdminProfesorAccionesProps) {
  const [editando, setEditando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState(nombre)
  const [nuevoApellido, setNuevoApellido] = useState(apellido)
  const [confirmacion, setConfirmacion] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const nombreCompleto = `${nombre} ${apellido}`

  async function handleGuardar() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/profesores/${profesorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre.trim(), apellido: nuevoApellido.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')

      setEditando(false)
      // El slug puede haber cambiado — navegar al nuevo
      router.push(`/profesores/${data.slug}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleEliminar() {
    if (confirmacion !== nombreCompleto) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/profesores/${profesorId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')

      router.push('/profesores')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setLoading(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
        Zona de administración
      </p>

      {editando ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-sm"
            />
            <input
              value={nuevoApellido}
              onChange={(e) => setNuevoApellido(e.target.value)}
              placeholder="Apellido"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditando(false); setError(null) }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={loading || (!nuevoNombre.trim() && !nuevoApellido.trim())}
              className="text-xs bg-uc-blue text-white px-3 py-1.5 rounded-lg hover:bg-uc-blue-light disabled:opacity-50 transition-colors"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : eliminando ? (
        <div className="space-y-2">
          <p className="text-xs text-red-600">
            Esto elimina al profesor y TODAS sus evaluaciones y aportes. Escribe{' '}
            <strong>{nombreCompleto}</strong> para confirmar:
          </p>
          <input
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={nombreCompleto}
            className="w-full px-3 py-2 rounded-xl border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-900 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEliminando(false); setConfirmacion(''); setError(null) }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleEliminar}
              disabled={loading || confirmacion !== nombreCompleto}
              className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Eliminando...' : 'Eliminar definitivamente'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setEditando(true)}
            className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ✎ Editar profesor
          </button>
          <button
            onClick={() => setEliminando(true)}
            className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            🗑 Eliminar profesor
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  )
}
