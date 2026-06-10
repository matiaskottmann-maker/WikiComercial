import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'

export async function GET() {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('reportes')
    .select(
      `*,
      evaluaciones(id, comentario, rating_general, semestre, created_at,
        profesores(nombre, apellido, slug)),
      aportes_wiki(id, contenido, seccion, created_at,
        profesores(nombre, apellido, slug))`
    )
    .eq('resuelto', false)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Error al listar' }, { status: 500 })

  return NextResponse.json({ reportes: data })
}
