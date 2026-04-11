'use client'

import { useState } from 'react'
import RatingInput from './RatingInput'
import { getSemestreActual, saveEditToken } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface EvaluacionFormProps {
  profesorId: string
}

export default function EvaluacionForm({ profesorId }: EvaluacionFormProps) {
  const [asignatura, setAsignatura] = useState('')
  const [ratingGeneral, setRatingGeneral] = useState(0)
  const [ratingClaridad, setRatingClaridad] = useState(0)
  const [ratingExigencia, setRatingExigencia] = useState(0)
  const [ratingDisponibilidad, setRatingDisponibilidad] = useState(0)
  const [comentario, setComentario] = useState('')
  const [aprobado, setAprobado] = useState<boolean | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!asignatura.trim()) {
      setError('Escribe el nombre de la asignatura')
      return
    }
    if (ratingGeneral === 0 || ratingClaridad === 0 || ratingExigencia === 0 || ratingDisponibilidad === 0) {
      setError('Completa todos los ratings')
      return
    }

    setLoading(true)

    const payload = {
      profesor_id: profesorId,
      asignatura_nombre: asignatura.trim(),
      rating_general: ratingGeneral,
      rating_claridad: ratingClaridad,
      rating_exigencia: ratingExigencia,
      rating_disponibilidad: ratingDisponibilidad,
      semestre: getSemestreActual(),
      ...(comentario && { comentario }),
      ...(aprobado !== undefined && { aprobado }),
    }

    try {
      const res = await fetch('/api/evaluaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar evaluacion')
      }

      saveEditToken(data.id, 'evaluacion', data.editToken)

      setSuccess(true)
      setRatingGeneral(0)
      setRatingClaridad(0)
      setRatingExigencia(0)
      setRatingDisponibilidad(0)
      setComentario('')
      setAprobado(undefined)
      setAsignatura('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-green-700 font-semibold text-lg">Evaluacion enviada!</p>
        <p className="text-green-600 text-sm mt-1">Puedes editarla durante los proximos 10 minutos.</p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-4 text-sm text-uc-blue font-medium hover:underline"
        >
          Enviar otra evaluacion
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <h3 className="text-lg font-bold text-gray-900">Evaluar profesor</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Asignatura</label>
        <input
          type="text"
          value={asignatura}
          onChange={(e) => setAsignatura(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900 transition-all"
          placeholder="Ej: Microeconomia, Contabilidad, Finanzas..."
        />
      </div>

      <div className="space-y-3">
        <RatingInput label="General" value={ratingGeneral} onChange={setRatingGeneral} />
        <RatingInput label="Claridad" value={ratingClaridad} onChange={setRatingClaridad} />
        <RatingInput label="Exigencia" value={ratingExigencia} onChange={setRatingExigencia} />
        <RatingInput label="Disponibilidad" value={ratingDisponibilidad} onChange={setRatingDisponibilidad} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Comentario <span className="text-gray-400 font-normal">(opcional, max. 1000 caracteres)</span>
        </label>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-uc-blue/30 focus:border-uc-blue text-gray-900 transition-all resize-none"
          placeholder="Comparte tu experiencia con este profesor..."
        />
        <p className="text-xs text-gray-400 mt-1">{comentario.length}/1000</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Aprobaste? <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setAprobado(aprobado === true ? undefined : true)}
            className={`px-5 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
              aprobado === true
                ? 'bg-green-50 border-green-300 text-green-700 shadow-sm'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            Si
          </button>
          <button
            type="button"
            onClick={() => setAprobado(aprobado === false ? undefined : false)}
            className={`px-5 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
              aprobado === false
                ? 'bg-red-50 border-red-300 text-red-700 shadow-sm'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            No
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-xl">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-uc-blue to-uc-blue-light text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-uc-blue/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
      >
        {loading ? 'Enviando...' : 'Enviar evaluacion'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Tu evaluacion es completamente anonima.
      </p>
    </form>
  )
}
