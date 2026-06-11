'use client'

import { useState } from 'react'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMensaje(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar')
      }

      setMensaje(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Administración</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ingresa tu correo y te enviaremos un enlace de acceso.
        </p>

        {mensaje ? (
          <div className="bg-blue-50 text-uc-blue rounded-xl p-4 text-sm">
            ✉️ {mensaje} Revisa tu bandeja de entrada (y spam).
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu-correo@uc.cl"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900"
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-uc-blue text-white py-2.5 rounded-xl font-semibold hover:bg-uc-blue-light transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                ⚠️ {error}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
