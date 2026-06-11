import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data: admin } = await service
      .from('admins')
      .select('email, password_creada')
      .eq('email', email)
      .maybeSingle()

    if (!admin) {
      return NextResponse.json(
        { error: 'Este correo no está registrado como administrador.' },
        { status: 403 }
      )
    }

    // Primer login (o contraseña reseteada): la UI pasa a modo "crear contraseña"
    if (!admin.password_creada) {
      return NextResponse.json({ necesitaCrear: true })
    }

    if (!password) {
      return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
