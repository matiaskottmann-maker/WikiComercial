import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

const RESPUESTA_GENERICA = {
  message: 'Si tu correo es de administrador, recibirás un enlace de acceso.',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data: admin } = await service
      .from('admins')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (admin) {
      const supabase = await createServerClient()
      await supabase.auth.signInWithOtp({ email })
    }

    return NextResponse.json(RESPUESTA_GENERICA)
  } catch {
    return NextResponse.json(RESPUESTA_GENERICA)
  }
}
