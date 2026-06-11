import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

// Primer login de un admin: crea su contraseña (solo una vez por email;
// otro admin puede "resetear" desde el panel para permitir crearla de nuevo).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
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

    if (admin.password_creada) {
      return NextResponse.json(
        { error: 'Este correo ya tiene contraseña. Inicia sesión.' },
        { status: 409 }
      )
    }

    // El usuario puede existir de antes (ej. login por magic link) → actualizar.
    // Si no existe → crearlo con el email ya confirmado.
    const { data: lista } = await service.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    const existente = lista?.users.find((u) => u.email?.toLowerCase() === email)

    if (existente) {
      const { error } = await service.auth.admin.updateUserById(existente.id, {
        password,
      })
      if (error) {
        return NextResponse.json({ error: 'Error al guardar la contraseña' }, { status: 500 })
      }
    } else {
      const { error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error) {
        return NextResponse.json({ error: 'Error al crear el usuario' }, { status: 500 })
      }
    }

    const { error: errFlag } = await service
      .from('admins')
      .update({ password_creada: true })
      .eq('email', email)

    if (errFlag) {
      return NextResponse.json({ error: 'Error al registrar' }, { status: 500 })
    }

    // Iniciar sesión de inmediato
    const supabase = await createServerClient()
    const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password })

    if (errLogin) {
      return NextResponse.json({
        success: true,
        message: 'Contraseña creada. Inicia sesión.',
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
