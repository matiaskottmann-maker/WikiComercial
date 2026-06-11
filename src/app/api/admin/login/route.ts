import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

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

    if (!admin) {
      return NextResponse.json(
        { error: 'Este correo no está registrado como administrador.' },
        { status: 403 }
      )
    }

    const supabase = await createServerClient()
    const { error } = await supabase.auth.signInWithOtp({ email })

    if (error) {
      if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
        return NextResponse.json(
          {
            error:
              'Se alcanzó el límite de correos por hora de Supabase. Espera ~1 hora e intenta de nuevo. Si ya tienes una sesión iniciada, sigue siendo válida.',
          },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: 'No se pudo enviar el enlace. Intenta de nuevo en unos minutos.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Te enviamos un enlace de acceso a tu correo.',
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
