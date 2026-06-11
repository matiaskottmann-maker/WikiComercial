import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'
import AdminAsignaturas, { AsignaturaConUso } from '@/components/admin/AdminAsignaturas'
import type { Asignatura } from '@/types'

export const metadata = { title: 'Asignaturas — WikiFEDUC' }

interface AsignaturaRaw extends Asignatura {
  profesor_asignatura: { count: number }[]
  evaluaciones: { count: number }[]
}

export default async function AdminAsignaturasPage() {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) redirect('/admin')

  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('asignaturas')
    .select('*, profesor_asignatura(count), evaluaciones(count)')
    .order('nombre', { ascending: true })

  const asignaturas: AsignaturaConUso[] = ((data ?? []) as unknown as AsignaturaRaw[]).map(
    (a) => ({
      ...a,
      profesores: a.profesor_asignatura?.[0]?.count ?? 0,
      evaluaciones: a.evaluaciones?.[0]?.count ?? 0,
    })
  )

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-uc-blue transition-colors"
        >
          ← Volver a administración
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Asignaturas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Renombra asignaturas mal escritas o fusiona duplicadas (las evaluaciones y profesores se
          mueven a la asignatura que quede).
        </p>
      </div>

      <AdminAsignaturas asignaturas={asignaturas} />
    </div>
  )
}
