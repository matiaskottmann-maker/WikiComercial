import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'
import AdminLogin from '@/components/admin/AdminLogin'
import AdminDashboard from '@/components/admin/AdminDashboard'
import type { Admin } from '@/types'

export const metadata = { title: 'Administración — WikiFEDUC' }

export default async function AdminPage() {
  const adminEmail = await getAdminEmail()

  if (!adminEmail) {
    // Detectar si hay sesión activa de un correo que NO es admin
    const authClient = await createServerClient()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    return <AdminLogin sesionNoAdmin={user?.email ?? null} />
  }

  const supabase = createServiceRoleClient()

  const { data: admins } = await supabase
    .from('admins')
    .select('*')
    .order('created_at', { ascending: true })

  const { count } = await supabase
    .from('reportes')
    .select('id', { count: 'exact', head: true })
    .eq('resuelto', false)

  return (
    <AdminDashboard
      adminEmail={adminEmail}
      admins={(admins ?? []) as Admin[]}
      reportesPendientes={count ?? 0}
    />
  )
}
