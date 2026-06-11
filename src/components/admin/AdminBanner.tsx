'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

interface AdminBannerProps {
  adminEmail: string
}

export default function AdminBanner({ adminEmail }: AdminBannerProps) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-400 text-amber-950">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <p className="font-medium truncate">
          🛡 Estás navegando como <span className="font-bold">admin</span>
          <span className="hidden sm:inline"> ({adminEmail})</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {!pathname.startsWith('/admin') && (
            <Link
              href="/admin"
              className="font-semibold bg-amber-950/10 hover:bg-amber-950/20 px-3 py-1 rounded-lg transition-colors"
            >
              Panel
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="font-semibold bg-amber-950 text-amber-50 hover:bg-amber-900 px-3 py-1 rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
