import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'

const EDIT_WINDOW_MS = 10 * 60 * 1000

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { foto_url, edit_token } = body as { foto_url?: string; edit_token?: string }

    if (!foto_url?.trim()) {
      return NextResponse.json({ error: 'URL de foto requerida' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: profesor } = await supabase
      .from('profesores')
      .select('*')
      .eq('id', id)
      .single()

    if (!profesor) {
      return NextResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })
    }

    // Admin cambia la foto sin restricción; autor requiere token vigente
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      if (!edit_token) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      const tokenHash = createHash('sha256').update(edit_token).digest('hex')
      if (tokenHash !== profesor.edit_token_hash) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
      }

      const elapsed = Date.now() - new Date(profesor.created_at).getTime()
      if (elapsed > EDIT_WINDOW_MS) {
        return NextResponse.json({ error: 'El tiempo de edición ha expirado' }, { status: 403 })
      }
    }

    const { error } = await supabase
      .from('profesores')
      .update({ foto_url: foto_url.trim() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar foto' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
