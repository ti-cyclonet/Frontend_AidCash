/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Gasto por categoría de presupuesto (fuente compartida)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * `SUGGESTIONS` y el algoritmo de match viven acá para que Presupuesto y Balance
 * calculen "cuánto gastaste en Mercado este periodo" con EXACTAMENTE la misma
 * lógica — antes cada uno hubiera tenido su propia copia de las keywords, lo que
 * con el tiempo las desincroniza y hace que el mismo gasto cuente distinto en
 * cada pantalla.
 */

export interface CategorySuggestion {
  name: string
  icon: string
  color: string
  keys: string[]
}

export const SUGGESTIONS: CategorySuggestion[] = [
  { name: "Vivienda", icon: "home", color: "#06b6d4", keys: ["arriendo", "renta", "hipoteca", "administracion", "arreglo casa", "muebles"] },
  { name: "Alimentacion", icon: "utensils", color: "#10b981", keys: ["comida", "mercado", "supermercado", "restaurante", "hamburguesa", "almuerzo", "cena", "cafeteria", "snack", "desayuno", "pizza", "pollo", "arroz"] },
  { name: "Transporte", icon: "car", color: "#3b82f6", keys: ["gasolina", "uber", "taxi", "bus", "peaje", "parqueadero", "metro", "moto", "lavada", "mantenimiento", "aceite", "llanta"] },
  { name: "Servicios", icon: "wifi", color: "#f59e0b", keys: ["internet", "luz", "agua", "gas", "telefono", "celular", "plan datos", "streaming"] },
  { name: "Deudas", icon: "more", color: "#ef4444", keys: ["tarjeta", "credito", "prestamo", "cuota", "banco", "interes"] },
  { name: "Ocio", icon: "gamepad", color: "#a855f7", keys: ["netflix", "spotify", "cine", "juego", "bar", "fiesta", "salida", "discoteca", "cerveza", "trago"] },
  { name: "Salud", icon: "heart", color: "#ec4899", keys: ["medico", "doctor", "farmacia", "odontologo", "hospital", "lentes", "examen", "cirugia"] },
  { name: "Familia", icon: "baby", color: "#14b8a6", keys: ["colegio", "guarderia", "juguete", "mesada", "hijos", "papa", "mama", "regalo familia"] },
  { name: "Educacion", icon: "education", color: "#6366f1", keys: ["universidad", "curso", "libro", "matricula", "capacitacion", "idiomas", "diplomado"] },
  { name: "Ahorro", icon: "gift", color: "#84cc16", keys: ["ahorro", "inversion", "fondo", "meta", "emergencia"] },
  { name: "Mascotas", icon: "paw", color: "#f97316", keys: ["veterinario", "perro", "gato", "mascota", "comida mascota", "peluqueria mascota", "vacuna mascota"] },
  { name: "Compras", icon: "shopping", color: "#e11d48", keys: ["ropa", "zapatos", "accesorios", "electronica", "amazon", "tienda", "online"] },
  { name: "Deporte", icon: "dumbbell", color: "#8b5cf6", keys: ["gym", "gimnasio", "cancha", "yoga", "suplemento", "proteina"] },
  { name: "Viajes", icon: "plane", color: "#0ea5e9", keys: ["vuelo", "hotel", "vacaciones", "paseo", "hospedaje", "maleta"] },
]

export interface SpendCategoryInput {
  id: string
  name: string
  color: string
  linkedFixedIds?: string[]
}

export interface ImpulseLike { nombre: string; monto: number }
export interface FixedLike { id: string; monto: number; pagadoEstePeriodo: boolean; budgetCategoryId?: string | null; montoPagadoEstePeriodo?: number | null }
export interface DebtLike { id: string; budgetCategoryId?: string | null; montoPagadoEstePeriodo?: number | null }

/**
 * Si el usuario eligió una categoría a mano al registrar el gasto, el nombre
 * viene con esa categoría envuelta en corchetes — pero el formulario de
 * Presupuesto la agrega al INICIO ("[Alimentacion] Mercado semanal") y el de
 * Obligaciones la agrega al FINAL ("Mercado semanal [Alimentacion]"), dos
 * formularios que nacieron por separado y nunca se unificaron. Hay que
 * reconocer ambas posiciones — si solo se busca el prefijo, un gasto tageado
 * desde Obligaciones nunca calza con su tag y cae al detector automático por
 * palabra clave, pudiendo sumar el mismo gasto en 2 o 3 categorías a la vez
 * aunque el usuario solo haya elegido una.
 */
export function extractCategoryTag(expNameLower: string): string | null {
  return expNameLower.match(/^\[([^\]]+)\]/)?.[1]
    ?? expNameLower.match(/\[([^\]]+)\]$/)?.[1]
    ?? null
}

/**
 * Cuánto se gastó en una categoría: gastos hormiga que calzan por keyword/tag +
 * gastos fijos vinculados desde la propia categoría (legacy, `linkedFixedIds`)
 * que ya se pagaron este periodo + deudas y gastos fijos vinculados desde SU
 * propio formulario de creación/edición (`budgetCategoryId`), sumando el pago
 * REAL de este periodo (`montoPagadoEstePeriodo`) en vez del monto configurado
 * completo — así una cuota parcial o quincenal también cuenta bien. Misma regla
 * que usa `PresupuestoTab.tsx` para "spent" — se replica acá en vez de
 * importarla porque esa función vive mezclada con el estado del componente;
 * esta versión es pura.
 */
export function computeCategorySpend(
  cat: SpendCategoryInput,
  impulseExpenses: ImpulseLike[],
  fixedExpenses: FixedLike[],
  debts: DebtLike[] = [],
): number {
  const sug = SUGGESTIONS.find(s => s.name.toLowerCase() === cat.name.toLowerCase())
  const keys = sug?.keys ?? []

  // Si el gasto ya trae un tag explícito "[Categoría] ..." (el usuario la
  // eligió al registrarlo), esa elección es la ÚNICA fuente de verdad — antes
  // un gasto como "[Alimentación] pagué con tarjeta en el súper" TAMBIÉN se
  // sumaba a "Deudas" solo por contener la palabra "tarjeta", así un mismo
  // gasto terminaba contando en 2 categorías aunque el usuario solo hubiera
  // elegido una. La detección automática por palabra clave solo aplica a
  // gastos SIN tag (gasto hormiga libre, sin categoría asignada a mano).
  const matchedImpulse = impulseExpenses.filter(e => {
    const expName = e.nombre.toLowerCase()
    const tag = extractCategoryTag(expName)
    if (tag) return tag === cat.name.toLowerCase()
    return keys.some(k => expName.includes(k)) || expName.includes(cat.name.toLowerCase())
  })

  const legacyIds = new Set(cat.linkedFixedIds ?? [])
  // Si el gasto YA tiene su propia categoría asignada (budgetCategoryId) y no
  // es esta misma, esa es la fuente de verdad — contarlo también acá por el
  // mecanismo legacy lo duplicaría en dos categorías distintas a la vez. Esto
  // puede pasar con datos guardados antes de que el formulario bloqueara
  // vincular por ambos mecanismos a la vez (ver PresupuestoTab).
  const linkedFixedPaid = [...legacyIds]
    .map(id => fixedExpenses.find(f => f.id === id))
    .filter((f): f is FixedLike => !!f && f.pagadoEstePeriodo && (!f.budgetCategoryId || f.budgetCategoryId === cat.id))

  // Vinculados desde el formulario de la propia deuda/gasto fijo — sin contar
  // dos veces algo que ya venga por el mecanismo legacy de arriba.
  const linkedByOwnCategory = [
    ...fixedExpenses.filter(f => f.budgetCategoryId === cat.id && !legacyIds.has(f.id)),
    ...debts.filter(d => d.budgetCategoryId === cat.id),
  ]

  const spentFromImpulse = matchedImpulse.reduce((a, e) => a + e.monto, 0)
  const spentFromLegacyFixed = linkedFixedPaid.reduce((a, f) => a + f.monto, 0)
  const spentFromOwnCategory = linkedByOwnCategory.reduce((a, x) => a + (x.montoPagadoEstePeriodo ?? 0), 0)
  return spentFromImpulse + spentFromLegacyFixed + spentFromOwnCategory
}
