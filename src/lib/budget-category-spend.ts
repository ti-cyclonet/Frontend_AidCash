/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Gasto por categoría de presupuesto (fuente compartida)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Categorías sugeridas al crear una categoría de presupuesto (nombre, ícono,
 * color). El gasto por categoría ya NO se calcula acá: lo hace el backend
 * (GET /budget-categories/resumen) con la categoría real (FK) de cada gasto —
 * ver Backend_AidCash/src/lib/category-summary.ts.
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
