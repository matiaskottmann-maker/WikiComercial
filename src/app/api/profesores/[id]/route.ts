import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'
import { generarSlug } from '@/lib/utils'

const EDIT_WINDOW_MS = 10 * 60 * 1000

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { edit_token, nombre, apellido } = body as {
      edit_token?: string
      nombre?: string
      apellido?: string
    }

    if (!nombre?.trim() && !apellido?.trim()) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: record } = await supabase
      .from('profesores')
      .select('*')
      .eq('id', id)
      .single()

    if (!record) return NextResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })

    // Admin edita sin token ni ventana; autor requiere token vigente
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      if (!edit_token) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
      }

      const tokenHash = createHash('sha256').update(edit_token).digest('hex')
      if (tokenHash !== record.edit_token_hash) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
      }

      const elapsed = Date.now() - new Date(record.created_at).getTime()
      if (elapsed > EDIT_WINDOW_MS) {
        return NextResponse.json({ error: 'El tiempo de edición ha expirado' }, { status: 403 })
      }
    }

    const newNombre = nombre?.trim() || record.nombre
    const newApellido = apellido?.trim() || record.apellido
    const newSlug = generarSlug(newNombre, newApellido)

    const { error } = await supabase
      .from('profesores')
      .update({ nombre: newNombre, apellido: newApellido, slug: newSlug })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    return NextResponse.json({ success: true, slug: newSlug })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const supabase = createServiceRoleClient()

    const { data: record } = await supabase
      .from('profesores')
      .select('id')
      .eq('id', id)
      .single()

    if (!record) return NextResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })

    // Evaluaciones, aportes y relaciones caen en cascada (ON DELETE CASCADE)
    const { error } = await supabase.from('profesores').delete().eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
