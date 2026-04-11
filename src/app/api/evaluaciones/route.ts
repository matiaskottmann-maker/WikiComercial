import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generarSlug } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      profesor_id, asignatura_nombre,
      rating_general, rating_claridad, rating_exigencia, rating_disponibilidad,
      comentario, semestre, aprobado,
    } = body

    if (!profesor_id || !asignatura_nombre?.trim() || !semestre) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    const ratings = [rating_general, rating_claridad, rating_exigencia, rating_disponibilidad]
    if (ratings.some((r: number) => !r || r < 1 || r > 5)) {
      return NextResponse.json(
        { error: 'Los ratings deben estar entre 1 y 5' },
        { status: 400 }
      )
    }

    if (comentario && comentario.length > 1000) {
      return NextResponse.json(
        { error: 'El comentario no puede superar los 1000 caracteres' },
        { status: 400 }
      )
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ?? '127.0.0.1'
    const ipHash = createHash('sha256').update(ip).digest('hex')

    const supabase = createServiceRoleClient()

    // Buscar o crear asignatura por nombre
    const nombreNorm = asignatura_nombre.trim()
    const slugAsig = generarSlug(nombreNorm, '')

    let { data: asignatura } = await supabase
      .from('asignaturas')
      .select('id')
      .ilike('nombre', nombreNorm)
      .limit(1)
      .single()

    if (!asignatura) {
      const { data: nueva, error: errAsig } = await supabase
        .from('asignaturas')
        .insert({ nombre: nombreNorm, slug: slugAsig })
        .select('id')
        .single()

      if (errAsig || !nueva) {
        // Slug ya existe — intentar con sufijo
        const { data: nueva2 } = await supabase
          .from('asignaturas')
          .insert({ nombre: nombreNorm, slug: `${slugAsig}-${Date.now().toString(36)}` })
          .select('id')
          .single()
        asignatura = nueva2
      } else {
        asignatura = nueva
      }
    }

    if (!asignatura) {
      return NextResponse.json(
        { error: 'Error al crear la asignatura' },
        { status: 500 }
      )
    }

    // Vincular profesor con asignatura si no existe la relacion
    await supabase
      .from('profesor_asignatura')
      .upsert({ profesor_id, asignatura_id: asignatura.id }, { onConflict: 'profesor_id,asignatura_id' })

    // Anti-spam: 1 evaluacion por IP + profesor + semestre
    const { data: existing } = await supabase
      .from('evaluaciones')
      .select('id')
      .eq('ip_hash', ipHash)
      .eq('profesor_id', profesor_id)
      .eq('semestre', semestre)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya evaluaste a este profesor este semestre' },
        { status: 429 }
      )
    }

    // Generar token de edicion
    const editToken = randomUUID()
    const editTokenHash = createHash('sha256').update(editToken).digest('hex')

    const { data, error } = await supabase.from('evaluaciones').insert({
      profesor_id,
      asignatura_id: asignatura.id,
      rating_general,
      rating_claridad,
      rating_exigencia,
      rating_disponibilidad,
      comentario: comentario ?? null,
      semestre,
      aprobado: aprobado ?? null,
      ip_hash: ipHash,
      edit_token_hash: editTokenHash,
    }).select('id').single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Error al guardar la evaluacion' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: data.id, editToken }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
