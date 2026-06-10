import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { validarContenido } from '@/lib/filtro-palabras'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { evaluacion_id, aporte_id, motivo } = body as {
      evaluacion_id?: string
      aporte_id?: string
      motivo?: string
    }

    // Exactamente uno de los dos
    if ((!evaluacion_id && !aporte_id) || (evaluacion_id && aporte_id)) {
      return NextResponse.json(
        { error: 'Debes indicar qué contenido reportar' },
        { status: 400 }
      )
    }

    if (motivo && motivo.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 caracteres' }, { status: 400 })
    }

    if (motivo) {
      const errorFiltro = validarContenido(motivo)
      if (errorFiltro) {
        return NextResponse.json({ error: errorFiltro }, { status: 400 })
      }
    }

    const supabase = createServiceRoleClient()

    // Verificar que el contenido existe
    const tabla = evaluacion_id ? 'evaluaciones' : 'aportes_wiki'
    const contenidoId = evaluacion_id ?? aporte_id
    const { data: contenido } = await supabase
      .from(tabla)
      .select('id')
      .eq('id', contenidoId)
      .maybeSingle()

    if (!contenido) {
      return NextResponse.json({ error: 'Contenido no encontrado' }, { status: 404 })
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ?? '127.0.0.1'
    const ipHash = createHash('sha256').update(ip).digest('hex')

    const { error } = await supabase.from('reportes').insert({
      evaluacion_id: evaluacion_id ?? null,
      aporte_id: aporte_id ?? null,
      motivo: motivo?.trim() || null,
      ip_hash: ipHash,
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya reportaste este contenido' },
          { status: 429 }
        )
      }
      return NextResponse.json({ error: 'Error al reportar' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
