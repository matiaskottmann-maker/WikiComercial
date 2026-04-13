// Palabras prohibidas (groserías en español chileno y general)
// Se buscan como subcadenas, case-insensitive, normalizadas sin tildes
const PALABRAS_PROHIBIDAS = [
  // Groserías comunes
  'ctm', 'conchetumare', 'conchetumadre', 'conchesumadre', 'conchatumare',
  'weon', 'hueon', 'weona', 'hueona', 'aweonao', 'aweonado', 'aweona',
  'culiao', 'culiado', 'culia', 'culiao', 'qliao', 'qliado', 'qlia',
  'maricon', 'marica', 'maraco',
  'puto', 'puta', 'putita', 'hijo de puta', 'hijueputa',
  'mierda', 'mrda',
  'chucha', 'chuchetumare', 'chupetumare',
  'verga',
  'pendejo', 'pendeja',
  'imbecil', 'imbécil',
  'idiota',
  'estupido', 'estupida',
  'tarado', 'tarada',
  'subnormal',
  'retrasado', 'retrasada',
  'mogolico', 'mongolico',
  'down',
  'gay',
  'lesbiana',
  'travesti',
  'transexual',
  'negro de mierda', 'negra de mierda',
  'indio', 'india de mierda',
  'prostituta', 'prostituto',
  'zorra', 'zorro',
  'perro', 'perra', 'perraje',
  'basura',
  'csm',
  'wn',
  'ctmre', 'ctmare',
  'sacowea', 'sacoewea', 'saco de weas',
  'pajero', 'pajera',
  'cagon', 'cagona',
  'chupenlo',
  'violador', 'violadora',
  'pedofilo', 'pedófilo',
  'nazi',
  'concha',
  'pichula', 'pico', 'callampa',
  'caca',
  'feo', 'fea', 'gordo', 'gorda', 'flaco', 'flaca',
]

// Normalizar texto: minúsculas, sin tildes, sin caracteres especiales repetidos
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/(.)\1{2,}/g, '$1$1')   // reducir letras repetidas (aaaa -> aa)
    .replace(/[0-9@#$%&*!]/g, '')    // quitar numeros y simbolos comunes
}

// Variaciones comunes de evasión
function expandirVariaciones(texto: string): string[] {
  const variaciones = [texto]

  // Reemplazos leetspeak comunes
  const reemplazos: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a',
  }

  let variacion = texto
  for (const [from, to] of Object.entries(reemplazos)) {
    variacion = variacion.replaceAll(from, to)
  }
  if (variacion !== texto) variaciones.push(variacion)

  // Sin espacios
  variaciones.push(texto.replace(/\s+/g, ''))

  // Sin puntos/guiones (p.u.t.a -> puta)
  variaciones.push(texto.replace(/[.\-_]/g, ''))

  return variaciones
}

/**
 * Verifica si un texto contiene palabras prohibidas.
 * Retorna la primera palabra encontrada o null si está limpio.
 */
export function contienePalabraProhibida(texto: string): string | null {
  const textoNorm = normalizar(texto)
  const variaciones = expandirVariaciones(textoNorm)

  for (const variacion of variaciones) {
    for (const palabra of PALABRAS_PROHIBIDAS) {
      const palabraNorm = normalizar(palabra)
      if (variacion.includes(palabraNorm)) {
        return palabra
      }
    }
  }

  return null
}

/**
 * Valida un texto y retorna un mensaje de error si contiene groserías.
 */
export function validarContenido(texto: string): string | null {
  const palabra = contienePalabraProhibida(texto)
  if (palabra) {
    return 'Tu mensaje contiene lenguaje inapropiado. Por favor, se respetuoso.'
  }
  return null
}
