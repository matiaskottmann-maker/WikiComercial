'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { saveEditToken } from '@/lib/utils'

export default function CrearProfesorModal() {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo se permiten imagenes JPG, PNG o WebP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar los 5MB')
      return
    }

    setError(null)
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  function clearFoto() {
    setFotoFile(null)
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function resetModal() {
    setOpen(false)
    setNombre('')
    setApellido('')
    clearFoto()
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nombre.trim() || !apellido.trim()) {
      setError('Nombre y apellido son obligatorios')
      return
    }

    setLoading(true)

    try {
      let foto_url: string | undefined

      // Subir foto si hay
      if (fotoFile) {
        const formData = new FormData()
        formData.append('file', fotoFile)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const uploadData = await uploadRes.json()

        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Error al subir la foto')
        }

        foto_url = uploadData.url
      }

      const res = await fetch('/api/profesores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          ...(foto_url && { foto_url }),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear profesor')
      }

      saveEditToken(data.id, 'profesor', data.editToken)
      resetModal()
      router.push(`/profesores/${data.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-uc-blue to-uc-blue-light text-white px-5 py-2.5 rounded-xl font-semibold hover:shadow-lg hover:shadow-uc-blue/25 transition-all duration-200 active:scale-[0.98]"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Agregar profesor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={resetModal}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Agregar profesor</h2>
              <button
                onClick={resetModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Foto de perfil */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto de perfil <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <div className="flex items-center gap-4">
                  {fotoPreview ? (
                    <div className="relative">
                      <Image
                        src={fotoPreview}
                        alt="Preview"
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearFoto}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                      >
                        x
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-uc-blue/40 hover:bg-blue-50/50 transition-all"
                    >
                      <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-uc-blue font-medium hover:text-uc-blue-light transition-colors"
                    >
                      {fotoPreview ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    <p className="text-xs text-gray-400 mt-0.5">JPG, PNG o WebP. Max 5MB.</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900 transition-all"
                  placeholder="Ej: Juan"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input
                  type="text"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900 transition-all"
                  placeholder="Ej: Perez"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !nombre.trim() || !apellido.trim()}
                className="w-full bg-gradient-to-r from-uc-blue to-uc-blue-light text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-uc-blue/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {loading ? (fotoFile ? 'Subiendo foto...' : 'Creando...') : 'Crear profesor'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Podras corregir el nombre durante 10 minutos.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
