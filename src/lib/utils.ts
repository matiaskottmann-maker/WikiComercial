export function generarSlug(nombre: string, apellido: string): string {
  return `${nombre}-${apellido}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function getSemestreActual(): string {
  const now = new Date()
  const year = now.getFullYear()
  const semester = now.getMonth() < 6 ? '1' : '2'
  return `${year}-${semester}`
}

export function formatRating(rating: number | null): string {
  if (rating === null) return '-'
  return rating.toFixed(1)
}

// --- Token de edición (localStorage) ---

const STORAGE_KEY = 'wikicomercial_tokens'
const EDIT_WINDOW_MS = 10 * 60 * 1000 // 10 minutos

interface StoredToken {
  id: string
  type: 'aporte' | 'evaluacion' | 'profesor'
  token: string
  createdAt: string
}

export function saveEditToken(id: string, type: StoredToken['type'], token: string): void {
  const tokens = getEditTokens()
  tokens.push({ id, type, token, createdAt: new Date().toISOString() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function getEditToken(id: string): StoredToken | null {
  const tokens = getEditTokens()
  const token = tokens.find((t) => t.id === id)
  if (!token) return null

  const elapsed = Date.now() - new Date(token.createdAt).getTime()
  if (elapsed > EDIT_WINDOW_MS) {
    removeEditToken(id)
    return null
  }
  return token
}

export function removeEditToken(id: string): void {
  const tokens = getEditTokens().filter((t) => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function getEditTokens(): StoredToken[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const tokens: StoredToken[] = JSON.parse(raw)
    // Limpiar tokens expirados
    const now = Date.now()
    const valid = tokens.filter((t) => now - new Date(t.createdAt).getTime() < EDIT_WINDOW_MS)
    if (valid.length !== tokens.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
    }
    return valid
  } catch {
    return []
  }
}

export function getRemainingMs(createdAt: string): number {
  const elapsed = Date.now() - new Date(createdAt).getTime()
  return Math.max(0, EDIT_WINDOW_MS - elapsed)
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
