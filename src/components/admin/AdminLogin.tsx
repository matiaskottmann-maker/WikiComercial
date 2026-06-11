'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

interface AdminLoginProps {
  // Email de una sesión activa que NO es admin (para mostrar aviso)
  sesionNoAdmin?: string | null
}

export default function AdminLogin({ sesionNoAdmin = null }: AdminLoginProps) {
  const [modo, setModo] = useState<'login' | 'crear'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogoutSesionNoAdmin() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión')

      if (data.necesitaCrear) {
        // Primer login: pasar a modo crear contraseña
        setModo('crear')
        setPassword('')
        setConfirmacion('')
        return
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/admin/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al crear la contraseña')

      router.refresh()
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

        {sesionNoAdmin && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm mb-4">
            ⚠️ Iniciaste sesión con <strong>{sesionNoAdmin}</strong>, pero ese correo no es
            administrador.{' '}
            <button
              onClick={handleLogoutSesionNoAdmin}
              className="underline font-semibold hover:text-amber-950"
            >
              Cerrar sesión
            </button>{' '}
            y entra con un correo autorizado.
          </div>
        )}

        {modo === 'login' ? (
          <>
            <p className="text-sm text-gray-500 mb-6">
              Ingresa con tu correo y contraseña. Si es tu primera vez, te pediremos crear una.
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu-correo@uc.cl"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900"
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-uc-blue text-white py-2.5 rounded-xl font-semibold hover:bg-uc-blue-light transition-colors disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="bg-blue-50 text-uc-blue rounded-xl p-4 text-sm mb-4">
              👋 Es tu primera vez aquí (<strong>{email.trim().toLowerCase()}</strong>). Crea tu
              contraseña para entrar.
            </div>
            <form onSubmit={handleCrear} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nueva contraseña (mín. 8 caracteres)"
                required
                minLength={8}
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900"
              />
              <input
                type="password"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder="Repite la contraseña"
                required
                minLength={8}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900"
              />
              <button
                type="submit"
                disabled={loading || !password || !confirmacion}
                className="w-full bg-uc-blue text-white py-2.5 rounded-xl font-semibold hover:bg-uc-blue-light transition-colors disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear contraseña y entrar'}
              </button>
              <button
                type="button"
                onClick={() => { setModo('login'); setError(null) }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                ← Volver
              </button>
            </form>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mt-4">
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  )
}
