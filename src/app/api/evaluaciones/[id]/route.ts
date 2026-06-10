import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'

const EDIT_WINDOW_MS = 10 * 60 * 1000

interface RouteContext {
  params: Promise<{ id: string }>
}

async function verifyToken(id: string, edit_token: string) {
  const supabase = createServiceRoleClient()

  const { data: record } = await supabase
    .from('evaluaciones')
    .select('*')
    .eq('id', id)
    .single()

  if (!record) return { error: 'Evaluación no encontrada', status: 404 }

  const tokenHash = createHash('sha256').update(edit_token).digest('hex')
  if (tokenHash !== record.edit_token_hash) return { error: 'Token inválido', status: 403 }

  const elapsed = Date.now() - new Date(record.created_at).getTime()
  if (elapsed > EDIT_WINDOW_MS) return { error: 'El tiempo de edición ha expirado', status: 403 }

  return { record, supabase }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { edit_token, comentario, rating_general, rating_claridad, rating_exigencia, rating_disponibilidad } = body

    if (!edit_token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const ratings = [rating_general, rating_claridad, rating_exigencia, rating_disponibilidad]
    if (ratings.some((r) => r !== undefined && (r < 1 || r > 5))) {
      return NextResponse.json({ error: 'Ratings deben estar entre 1 y 5' }, { status: 400 })
    }

    if (comentario !== undefined && comentario.length > 1000) {
      return NextResponse.json({ error: 'Máximo 1000 caracteres' }, { status: 400 })
    }

    const result = await verifyToken(id, edit_token)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const updates: Record<string, unknown> = {}
    if (comentario !== undefined) updates.comentario = comentario || null
    if (rating_general !== undefined) updates.rating_general = rating_general
    if (rating_claridad !== undefined) updates.rating_claridad = rating_claridad
    if (rating_exigencia !== undefined) updates.rating_exigencia = rating_exigencia
    if (rating_disponibilidad !== undefined) updates.rating_disponibilidad = rating_disponibilidad

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay cambios' }, { status: 400 })
    }

    const { error } = await result.supabase
      .from('evaluaciones')
      .update(updates)
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    // Admin: elimina sin token ni ventana de tiempo
    const adminEmail = await getAdminEmail()
    if (adminEmail) {
      const supabase = createServiceRoleClient()
      const { error } = await supabase.from('evaluaciones').delete().eq('id', id)
      if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Autor: requiere edit_token dentro de la ventana de 10 min
    const body = await request.json().catch(() => ({}))
    const { edit_token } = body as { edit_token?: string }

    if (!edit_token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const result = await verifyToken(id, edit_token)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { error } = await result.supabase
      .from('evaluaciones')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
