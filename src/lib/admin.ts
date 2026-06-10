import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Retorna el email del admin logueado (en minúsculas), o null si no hay
 * sesión o el email no está en la tabla admins.
 * Única fuente de verdad de autorización — usar en TODA ruta/página admin.
 */
export async function getAdminEmail(): Promise<string | null> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const email = user.email.toLowerCase()
  const service = createServiceRoleClient()
  const { data } = await service
    .from('admins')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  return data ? email : null
}
