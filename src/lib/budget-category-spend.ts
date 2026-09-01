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
export interface FixedLike { id: string; monto: number; pagadoEstePeriodo: boolean }

/**
 * Cuánto se gastó en una categoría: gastos hormiga que calzan por keyword/tag +
 * gastos fijos vinculados que ya se pagaron este periodo. Misma regla que usa
 * `PresupuestoTab.tsx` para "spent" — se replica acá en vez de importarla porque
 * esa función vive mezclada con el estado del componente; esta versión es pura.
 */
export function computeCategorySpend(
  cat: SpendCategoryInput,
  impulseExpenses: ImpulseLike[],
  fixedExpenses: FixedLike[],
): number {
  const sug = SUGGESTIONS.find(s => s.name.toLowerCase() === cat.name.toLowerCase())
  const keys = [...(sug?.keys ?? []), cat.name.toLowerCase()]
  const tagPattern = `[${cat.name.toLowerCase()}]`

  const matchedImpulse = impulseExpenses.filter(e => {
    const expName = e.nombre.toLowerCase()
    return expName.startsWith(tagPattern) || keys.some(k => expName.includes(k)) || expName.includes(cat.name.toLowerCase())
  })

  const linkedFixedPaid = (cat.linkedFixedIds ?? [])
    .map(id => fixedExpenses.find(f => f.id === id))
    .filter((f): f is FixedLike => !!f && f.pagadoEstePeriodo)

  const spentFromImpulse = matchedImpulse.reduce((a, e) => a + e.monto, 0)
  const spentFromFixed = linkedFixedPaid.reduce((a, f) => a + f.monto, 0)
  return spentFromImpulse + spentFromFixed
}
