'use client'

import { useState } from 'react'

interface ReportarButtonProps {
  evaluacionId?: string
  aporteId?: string
}

export default function ReportarButton({ evaluacionId, aporteId }: ReportarButtonProps) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleReportar() {
    setEstado('enviando')
    setError(null)

    try {
      const res = await fetch('/api/reportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacion_id: evaluacionId,
          aporte_id: aporteId,
          motivo: motivo.trim() || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al reportar')

      setEstado('enviado')
    } catch (err) {
      setEstado('error')
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  if (estado === 'enviado') {
    return <span className="text-xs text-green-600">Reporte enviado ✓</span>
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
      >
        Reportar
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full mt-2 p-3 bg-gray-50 rounded-xl">
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Motivo (opcional)"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 text-gray-900 text-xs resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setAbierto(false); setMotivo(''); setError(null); setEstado('idle') }}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
        >
          Cancelar
        </button>
        <button
          onClick={handleReportar}
          disabled={estado === 'enviando'}
          className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {estado === 'enviando' ? 'Enviando...' : 'Enviar reporte'}
        </button>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  )
}
