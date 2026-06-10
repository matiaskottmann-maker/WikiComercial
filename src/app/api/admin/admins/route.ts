import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminEmail } from '@/lib/admin'

export async function GET() {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Error al listar' }, { status: 500 })

  return NextResponse.json({ admins: data })
}

export async function POST(request: NextRequest) {
  try {
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { error } = await supabase
      .from('admins')
      .insert({ email, added_by: adminEmail })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ese email ya es admin' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al agregar' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    if (email === adminEmail) {
      return NextResponse.json(
        { error: 'No puedes eliminarte a ti mismo' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    const { count } = await supabase
      .from('admins')
      .select('email', { count: 'exact', head: true })

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Debe quedar al menos un admin' },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('admins').delete().eq('email', email)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
