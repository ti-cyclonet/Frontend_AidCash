/**
 * Clasificación automática de gasto hormiga — espejo de
 * Backend_AidCash/src/lib/hormiga.ts (si se cambia una, cambiar la otra). Acá
 * solo se usa para pre-marcar el interruptor "Gasto hormiga" al registrar; la
 * fuente de verdad es el campo `esHormiga` que guarda el backend.
 */

export const HORMIGA_MONTO_MAX = 50_000

const HORMIGA_KEYWORDS: string[] = [
  'café', 'cafe', 'starbucks', 'tinto', 'capuchino', 'latte', 'espresso', 'juan valdez',
  'almuerzo', 'desayuno', 'hamburguesa', 'pizza', 'empanada', 'arepa', 'sandwich', 'perro', 'perrito',
  'buñuelo', 'domicilio', 'rappi', 'ifood', 'uber eats', 'didi food', 'snack', 'helado', 'postre', 'comida rapida',
  'uber', 'indriver', 'in driver', 'didi', 'cabify', 'picap', 'taxi', 'bus', 'transmilenio', 'metro', 'pasaje',
  'parqueadero', 'peaje',
  'dulce', 'chocolate', 'galleta', 'chicle', 'golosina', 'antojo', 'vending', 'papas', 'gaseosa', 'jugo',
  'cerveza', 'trago', 'cover', 'boleta', 'cine',
  'propina', 'fotocopia', 'impresion', 'recarga',
]

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const KEYWORD_REGEXES = HORMIGA_KEYWORDS
  .map(normalizar)
  .map(k => new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))

export function esGastoHormiga(nombre: string, monto: number): boolean {
  if (monto > 0 && monto <= HORMIGA_MONTO_MAX) return true
  const n = normalizar(nombre)
  return KEYWORD_REGEXES.some(r => r.test(n))
}

/** Nombre sin etiqueta de categoría ("[Cat] X" o "X [Cat]") ni 🐜 legacy — para mostrar y agrupar. */
export function nombreBaseGasto(nombre: string): string {
  return nombre
    .replace(/^🐜\s*/u, '')
    .replace(/^\[[^\]]*\]\s*/, '')
    .replace(/\s*\[[^\]]*\]$/, '')
    .replace(/\s*\(gasto fijo\)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}
