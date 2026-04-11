import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generarSlug } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nombre, apellido, foto_url, email } = body as {
      nombre?: string
      apellido?: string
      foto_url?: string
      email?: string
    }

    if (!nombre?.trim() || !apellido?.trim()) {
      return NextResponse.json(
        { error: 'Nombre y apellido son obligatorios' },
        { status: 400 }
      )
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ?? '127.0.0.1'
    const ipHash = createHash('sha256').update(ip).digest('hex')

    const supabase = createServiceRoleClient()

    // Anti-spam: máximo 5 profesores por IP por día
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('profesores')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', hace24h)

    if (count !== null && count >= 5) {
      return NextResponse.json(
        { error: 'Has creado demasiados profesores hoy. Intenta mañana.' },
        { status: 429 }
      )
    }

    // Generar slug único
    let slug = generarSlug(nombre.trim(), apellido.trim())
    const { data: existingSlug } = await supabase
      .from('profesores')
      .select('id')
      .eq('slug', slug)
      .limit(1)

    if (existingSlug && existingSlug.length > 0) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    // Generar token de edición
    const editToken = randomUUID()
    const editTokenHash = createHash('sha256').update(editToken).digest('hex')

    const { data, error } = await supabase.from('profesores').insert({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      slug,
      foto_url: foto_url?.trim() || null,
      email: email?.trim() || null,
      ip_hash: ipHash,
      edit_token_hash: editTokenHash,
    }).select('id, slug').single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Error al crear el profesor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: data.id, slug: data.slug, editToken }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
