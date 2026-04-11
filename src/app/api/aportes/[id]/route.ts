import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'

const EDIT_WINDOW_MS = 10 * 60 * 1000

interface RouteContext {
  params: Promise<{ id: string }>
}

async function verifyToken(id: string, edit_token: string) {
  const supabase = createServiceRoleClient()

  const { data: record } = await supabase
    .from('aportes_wiki')
    .select('*')
    .eq('id', id)
    .single()

  if (!record) return { error: 'Aporte no encontrado', status: 404 }

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
    const { edit_token, contenido } = body as { edit_token?: string; contenido?: string }

    if (!edit_token || !contenido?.trim()) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    if (contenido.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 caracteres' }, { status: 400 })
    }

    const result = await verifyToken(id, edit_token)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { error } = await result.supabase
      .from('aportes_wiki')
      .update({ contenido: contenido.trim() })
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
    const body = await request.json()
    const { edit_token } = body as { edit_token?: string }

    if (!edit_token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const result = await verifyToken(id, edit_token)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { error } = await result.supabase
      .from('aportes_wiki')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
