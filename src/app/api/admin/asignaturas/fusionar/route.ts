import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'

export async function POST(request: NextRequest) {
  try {
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { origen_id, destino_id } = body as { origen_id?: string; destino_id?: string }

    if (!origen_id || !destino_id) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    if (origen_id === destino_id) {
      return NextResponse.json(
        { error: 'No puedes fusionar una asignatura consigo misma' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    const { data: ambas } = await supabase
      .from('asignaturas')
      .select('id')
      .in('id', [origen_id, destino_id])

    if (!ambas || ambas.length !== 2) {
      return NextResponse.json({ error: 'Asignatura no encontrada' }, { status: 404 })
    }

    // 1. Mover evaluaciones de la asignatura origen a la destino
    const { error: errEval } = await supabase
      .from('evaluaciones')
      .update({ asignatura_id: destino_id })
      .eq('asignatura_id', origen_id)

    if (errEval) {
      return NextResponse.json({ error: 'Error al mover evaluaciones' }, { status: 500 })
    }

    // 2. Mover vínculos profesor-asignatura sin duplicar
    const { data: relaciones } = await supabase
      .from('profesor_asignatura')
      .select('profesor_id')
      .eq('asignatura_id', origen_id)

    if (relaciones && relaciones.length > 0) {
      const { error: errUpsert } = await supabase.from('profesor_asignatura').upsert(
        relaciones.map((r) => ({ profesor_id: r.profesor_id, asignatura_id: destino_id })),
        { onConflict: 'profesor_id,asignatura_id', ignoreDuplicates: true }
      )

      if (errUpsert) {
        return NextResponse.json({ error: 'Error al mover profesores' }, { status: 500 })
      }
    }

    const { error: errDelRel } = await supabase
      .from('profesor_asignatura')
      .delete()
      .eq('asignatura_id', origen_id)

    if (errDelRel) {
      return NextResponse.json({ error: 'Error al limpiar vínculos' }, { status: 500 })
    }

    // 3. Eliminar la asignatura origen (ya sin evaluaciones ni vínculos)
    const { error: errDel } = await supabase
      .from('asignaturas')
      .delete()
      .eq('id', origen_id)

    if (errDel) {
      return NextResponse.json({ error: 'Error al eliminar la asignatura duplicada' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
