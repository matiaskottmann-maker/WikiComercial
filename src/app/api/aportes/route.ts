import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { SeccionWiki } from '@/types'

const SECCIONES_VALIDAS: SeccionWiki[] = [
  'curriculum', 'personalidad', 'sus_clases',
  'sus_pruebas', 'recomendaciones', 'datos_freak', 'frases_tipicas',
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profesor_id, seccion, contenido } = body as {
      profesor_id?: string
      seccion?: string
      contenido?: string
    }

    if (!profesor_id || !seccion || !contenido?.trim()) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    if (!SECCIONES_VALIDAS.includes(seccion as SeccionWiki)) {
      return NextResponse.json(
        { error: 'Sección inválida' },
        { status: 400 }
      )
    }

    if (contenido.length > 500) {
      return NextResponse.json(
        { error: 'El contenido no puede superar los 500 caracteres' },
        { status: 400 }
      )
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ?? '127.0.0.1'
    const ipHash = createHash('sha256').update(ip).digest('hex')

    const supabase = createServiceRoleClient()

    // Anti-spam: máximo 10 aportes por IP en 24 horas
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('aportes_wiki')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', hace24h)

    if (count !== null && count >= 10) {
      return NextResponse.json(
        { error: 'Has agregado demasiados aportes hoy. Intenta mañana.' },
        { status: 429 }
      )
    }

    // Generar token de edición
    const editToken = randomUUID()
    const editTokenHash = createHash('sha256').update(editToken).digest('hex')

    const { data, error } = await supabase.from('aportes_wiki').insert({
      profesor_id,
      seccion,
      contenido: contenido.trim(),
      ip_hash: ipHash,
      edit_token_hash: editTokenHash,
    }).select('id').single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Error al guardar el aporte' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: data.id, editToken }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
