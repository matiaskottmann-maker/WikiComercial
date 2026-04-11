'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AporteWiki, SeccionWiki } from '@/types'
import { saveEditToken, getEditToken, removeEditToken } from '@/lib/utils'
import CountdownTimer from './CountdownTimer'

interface WikiSeccionProps {
  profesorId: string
  seccion: SeccionWiki
  label: string
  icon: string
  aportes: AporteWiki[]
}

export default function WikiSeccion({ profesorId, seccion, label, icon, aportes }: WikiSeccionProps) {
  const [abierto, setAbierto] = useState(false)
  const [contenido, setContenido] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContenido, setEditContenido] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [, setForceUpdate] = useState(0)
  const router = useRouter()

  const forceRender = useCallback(() => setForceUpdate((n) => n + 1), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!contenido.trim()) return

    setLoading(true)

    try {
      const res = await fetch('/api/aportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profesor_id: profesorId,
          seccion,
          contenido: contenido.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar')
      }

      // Guardar token de edición
      saveEditToken(data.id, 'aporte', data.editToken)

      setContenido('')
      setAbierto(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(aporteId: string) {
    const token = getEditToken(aporteId)
    if (!token || !editContenido.trim()) return

    setEditLoading(true)
    try {
      const res = await fetch(`/api/aportes/${aporteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_token: token.token, contenido: editContenido.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al editar')
      }

      setEditingId(null)
      setEditContenido('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete(aporteId: string) {
    const token = getEditToken(aporteId)
    if (!token) return

    try {
      const res = await fetch(`/api/aportes/${aporteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_token: token.token }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar')
      }

      removeEditToken(aporteId)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 px-5 py-3.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <span>{icon}</span>
        {label}
        {aportes.length > 0 && (
          <span className="ml-auto text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {aportes.length}
          </span>
        )}
      </h3>

      {aportes.length > 0 ? (
        <ul className="divide-y divide-gray-50">
          {aportes.map((a) => {
            const token = getEditToken(a.id)
            const isEditing = editingId === a.id

            return (
              <li key={a.id} className={`px-5 py-3 ${token ? 'bg-blue-50/30 border-l-2 border-l-uc-blue/20' : ''}`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContenido}
                      onChange={(e) => setEditContenido(e.target.value)}
                      maxLength={500}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-sm resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setEditingId(null); setEditContenido('') }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleEdit(a.id)}
                        disabled={editLoading || !editContenido.trim()}
                        className="text-xs bg-uc-blue text-white px-3 py-1 rounded-lg hover:bg-uc-blue-light disabled:opacity-50 transition-colors"
                      >
                        {editLoading ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-700 text-sm leading-relaxed">{a.contenido}</p>
                    {token && (
                      <div className="flex items-center gap-3 mt-2">
                        <CountdownTimer createdAt={token.createdAt} onExpire={forceRender} />
                        <button
                          onClick={() => { setEditingId(a.id); setEditContenido(a.contenido) }}
                          className="text-xs text-uc-blue hover:text-uc-blue-light transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-xs text-red-500 hover:text-red-600 transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-gray-400 italic">
          Sin aportes aun. Se el primero en agregar!
        </p>
      )}

      <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
        {!abierto ? (
          <button
            onClick={() => setAbierto(true)}
            className="text-sm text-uc-blue font-medium hover:text-uc-blue-light transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Agregar
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900 text-sm resize-none transition-all"
              placeholder={`Agrega algo sobre "${label}"...`}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{contenido.length}/500</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setAbierto(false); setContenido(''); setError(null) }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !contenido.trim()}
                  className="bg-uc-blue text-white px-4 py-1.5 rounded-xl text-sm font-semibold hover:bg-uc-blue-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Enviando...' : 'Agregar'}
                </button>
              </div>
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
