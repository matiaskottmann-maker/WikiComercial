import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'
import { generarSlug } from '@/lib/utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

    if (!nombre) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: asignatura } = await supabase
      .from('asignaturas')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!asignatura) {
      return NextResponse.json({ error: 'Asignatura no encontrada' }, { status: 404 })
    }

    const { error } = await supabase
      .from('asignaturas')
      .update({ nombre, slug: generarSlug(nombre, '') })
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una asignatura con ese nombre. Usa "Fusionar" en su lugar.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Error al renombrar' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
