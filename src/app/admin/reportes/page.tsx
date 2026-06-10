import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'
import ReportesLista from '@/components/admin/ReportesLista'
import type { ReporteConContenido } from '@/types'

export const metadata = { title: 'Reportes — WikiFEDUC' }

export default async function ReportesPage() {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) redirect('/admin')

  const supabase = createServiceRoleClient()
  const { data: reportes } = await supabase
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

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-uc-blue transition-colors"
        >
          ← Volver a administración
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Reportes pendientes</h1>
      </div>

      <ReportesLista reportes={(reportes ?? []) as unknown as ReporteConContenido[]} />
    </div>
  )
}
