import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { foto_url } = body as { foto_url?: string }

    if (!foto_url?.trim()) {
      return NextResponse.json({ error: 'URL de foto requerida' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: profesor } = await supabase
      .from('profesores')
      .select('id')
      .eq('id', id)
      .single()

    if (!profesor) {
      return NextResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })
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
