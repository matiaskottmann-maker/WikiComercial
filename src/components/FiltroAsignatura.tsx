'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Asignatura } from '@/types'

interface FiltroAsignaturaProps {
  asignaturas: Asignatura[]
}

export default function FiltroAsignatura({ asignaturas }: FiltroAsignaturaProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = searchParams.get('asignatura') ?? ''

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('asignatura', value)
    } else {
      params.delete('asignatura')
    }
    router.push(`/profesores?${params.toString()}`)
  }

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900 bg-white transition-all"
    >
      <option value="">Todas las asignaturas</option>
      {asignaturas.map((a) => (
        <option key={a.id} value={a.id}>
          {a.codigo ? `${a.codigo} — ` : ''}{a.nombre}
        </option>
      ))}
    </select>
  )
}
