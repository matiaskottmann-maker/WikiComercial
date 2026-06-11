'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Admin } from '@/types'

interface AdminDashboardProps {
  adminEmail: string
  admins: Admin[]
  reportesPendientes: number
}

export default function AdminDashboard({
  adminEmail,
  admins,
  reportesPendientes,
}: AdminDashboardProps) {
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nuevoEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al agregar')

      setNuevoEmail('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleEliminar(email: string) {
    if (!confirm(`¿Quitar a ${email} de los administradores?`)) return
    setError(null)

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  async function handleLogout() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administración</h1>
          <p className="text-sm text-gray-500">{adminEmail}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-xl transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm text-gray-600 mb-3">
          Navega la página normalmente — como admin verás botones para eliminar y editar contenido
          en los perfiles de profesores.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="text-sm font-semibold bg-uc-blue text-white px-4 py-2 rounded-xl hover:bg-uc-blue-light transition-colors"
          >
            🏠 Ir al inicio
          </Link>
          <Link
            href="/profesores"
            className="text-sm font-semibold bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            👨‍🏫 Ver profesores
          </Link>
        </div>
      </div>

      <Link
        href="/admin/reportes"
        className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-900">🚩 Reportes pendientes</span>
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${
              reportesPendientes > 0
                ? 'bg-red-50 text-red-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {reportesPendientes}
          </span>
        </div>
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Administradores</h2>

        <ul className="divide-y divide-gray-50 mb-4">
          {admins.map((a) => (
            <li key={a.email} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-700">
                {a.email}
                {a.email === adminEmail && (
                  <span className="ml-2 text-xs text-gray-400">(tú)</span>
                )}
              </span>
              {a.email !== adminEmail && (
                <button
                  onClick={() => handleEliminar(a.email)}
                  className="text-xs text-red-500 hover:text-red-600 transition-colors"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={handleAgregar} className="flex gap-2">
          <input
            type="email"
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
            placeholder="nuevo-admin@uc.cl"
            required
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !nuevoEmail.trim()}
            className="bg-uc-blue text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-uc-blue-light transition-colors disabled:opacity-50"
          >
            {loading ? 'Agregando...' : 'Agregar'}
          </button>
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    </div>
  )
}
