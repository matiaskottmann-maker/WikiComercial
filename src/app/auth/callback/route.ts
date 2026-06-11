import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Callback del flujo OAuth (Google): intercambia el código por una sesión.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  const redirectTo = new URL('/admin', request.url)

  if (code) {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(redirectTo)
  }

  redirectTo.searchParams.set('error', 'enlace-invalido')
  return NextResponse.redirect(redirectTo)
}
