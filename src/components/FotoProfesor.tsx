'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getEditToken } from '@/lib/utils'

interface FotoProfesorProps {
  profesorId: string
  nombre: string
  apellido: string
  fotoUrl: string | null
  isAdmin?: boolean
}

export default function FotoProfesor({ profesorId, nombre, apellido, fotoUrl, isAdmin = false }: FotoProfesorProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const token = getEditToken(profesorId)
  const puedeEditar = isAdmin || !!token

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo JPG, PNG o WebP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Max 5MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Subir imagen
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error)

      // Actualizar profesor
      const res = await fetch(`/api/profesores/${profesorId}/foto`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foto_url: uploadData.url,
          ...(token ? { edit_token: token.token } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="relative group">
      {fotoUrl ? (
        <Image
          src={fotoUrl}
          alt={`${nombre} ${apellido}`}
          width={96}
          height={96}
          className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover"
        />
      ) : (
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-uc-blue to-uc-blue-light text-white flex items-center justify-center text-3xl font-semibold shrink-0 shadow-lg shadow-uc-blue/20">
          {nombre[0]}{apellido[0]}
        </div>
      )}

      {/* Overlay para cambiar foto — solo admin o autor con token vigente */}
      {puedeEditar && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
          >
            {uploading ? (
              <span className="text-white text-xs font-medium">Subiendo...</span>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </>
      )}

      {error && (
        <p className="absolute -bottom-6 left-0 text-xs text-red-500 whitespace-nowrap">{error}</p>
      )}
    </div>
  )
}
