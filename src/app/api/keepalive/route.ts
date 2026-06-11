import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Consulta mínima diaria (cron de Vercel) para que Supabase registre actividad
// y no pause el proyecto del plan gratuito por inactividad.
export async function GET() {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('asignaturas').select('id').limit(1)

  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
