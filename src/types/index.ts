export interface Profesor {
  id: string
  nombre: string
  apellido: string
  slug: string
  foto_url: string | null
  email: string | null
  edit_token_hash: string | null
  ip_hash: string | null
  created_at: string
}

export interface Asignatura {
  id: string
  nombre: string
  codigo: string | null
  slug: string
  created_at: string
}

export interface ProfesorAsignatura {
  profesor_id: string
  asignatura_id: string
}

export interface Evaluacion {
  id: string
  profesor_id: string
  asignatura_id: string
  rating_general: number
  rating_claridad: number
  rating_exigencia: number
  rating_disponibilidad: number
  comentario: string | null
  semestre: string | null
  aprobado: boolean | null
  ip_hash: string
  edit_token_hash: string | null
  created_at: string
}

export interface EvaluacionConAsignatura extends Evaluacion {
  asignaturas: Asignatura
}

export interface ProfesorConStats extends Profesor {
  total_evaluaciones: number
  avg_general: number | null
  avg_claridad: number | null
  avg_exigencia: number | null
  avg_disponibilidad: number | null
}

export interface ProfesorConStatsYAsignaturas extends ProfesorConStats {
  asignaturas: Asignatura[]
}

export type SeccionWiki =
  | 'curriculum'
  | 'personalidad'
  | 'sus_clases'
  | 'sus_pruebas'
  | 'recomendaciones'
  | 'datos_freak'
  | 'frases_tipicas'

export interface AporteWiki {
  id: string
  profesor_id: string
  seccion: SeccionWiki
  contenido: string
  ip_hash: string
  edit_token_hash: string | null
  created_at: string
}

export const SECCIONES_WIKI: { key: SeccionWiki; label: string; icon: string }[] = [
  { key: 'curriculum', label: 'Curriculum', icon: '📚' },
  { key: 'personalidad', label: 'Personalidad', icon: '🧑' },
  { key: 'sus_clases', label: 'Sus Clases', icon: '🏫' },
  { key: 'sus_pruebas', label: 'Sus Pruebas', icon: '📝' },
  { key: 'recomendaciones', label: 'Recomendaciones', icon: '💡' },
  { key: 'datos_freak', label: 'Datos Freak', icon: '🤓' },
  { key: 'frases_tipicas', label: 'Frases Tipicas', icon: '💬' },
]

export interface EvaluacionPayload {
  profesor_id: string
  asignatura_id: string
  rating_general: number
  rating_claridad: number
  rating_exigencia: number
  rating_disponibilidad: number
  comentario?: string
  semestre: string
  aprobado?: boolean
}

// Token de edición guardado en localStorage
export interface EditToken {
  id: string
  type: 'aporte' | 'evaluacion' | 'profesor'
  token: string
  createdAt: string
}

// --- Admin y moderación ---

export interface Admin {
  email: string
  added_by: string | null
  created_at: string
}

export interface Reporte {
  id: string
  evaluacion_id: string | null
  aporte_id: string | null
  motivo: string | null
  resuelto: boolean
  created_at: string
}

export interface ReporteConContenido extends Reporte {
  evaluaciones:
    | (Pick<Evaluacion, 'id' | 'comentario' | 'rating_general' | 'semestre' | 'created_at'> & {
        profesores: Pick<Profesor, 'nombre' | 'apellido' | 'slug'> | null
      })
    | null
  aportes_wiki:
    | (Pick<AporteWiki, 'id' | 'contenido' | 'seccion' | 'created_at'> & {
        profesores: Pick<Profesor, 'nombre' | 'apellido' | 'slug'> | null
      })
    | null
}
