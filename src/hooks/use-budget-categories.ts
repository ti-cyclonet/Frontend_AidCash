"use client"

import { useState, useEffect, useCallback } from "react"
import { budgetCategoriesApi, ResumenCategorias } from "@/lib/api-client"
import { useFinanceData } from "@/hooks/use-finance-data"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * useBudgetCategories — Acceso compartido a las categorías de presupuesto
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Fuente de verdad: el backend real (`budgetCategoriesApi`), no localStorage —
 * antes cada componente leía `kiri_budget_categories` por su cuenta, lo que hacía
 * que perdieras tus categorías/límites al cambiar de navegador. Este hook es el
 * único punto de lectura para componentes (usa `refreshBudgetCategories()` tras
 * cualquier mutación hecha en otro lado, ya que no hay evento del navegador que
 * avise de un cambio en la misma pestaña).
 *
 * También expone el mapping de keywords para auto-detectar la categoría de presupuesto
 * a partir de la descripción del gasto.
 */

export interface BudgetCategoryItem {
  id: string
  name: string
  budget: number
  spent: number
  color: string
  icon: string
  linkedFixedIds?: string[]
}

// Keywords predefinidas por nombre de categoría de presupuesto
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Vivienda": ["arriendo", "renta", "hipoteca", "administracion", "arreglo casa", "muebles"],
  "Alimentacion": ["comida", "mercado", "supermercado", "restaurante", "hamburguesa", "almuerzo", "cena", "cafeteria", "snack", "desayuno", "pizza", "pollo", "arroz", "cafe", "café"],
  "Transporte": ["gasolina", "uber", "taxi", "bus", "peaje", "parqueadero", "metro", "moto", "lavada", "mantenimiento", "aceite", "llanta"],
  "Servicios": ["internet", "luz", "agua", "gas", "telefono", "celular", "plan datos", "streaming"],
  "Deudas": ["tarjeta", "credito", "prestamo", "cuota", "banco", "interes"],
  "Ocio": ["netflix", "spotify", "cine", "juego", "bar", "fiesta", "salida", "discoteca", "cerveza", "trago"],
  "Salud": ["medico", "doctor", "farmacia", "odontologo", "hospital", "lentes", "examen", "cirugia"],
  "Familia": ["colegio", "guarderia", "juguete", "mesada", "hijos", "papa", "mama", "regalo familia"],
  "Educacion": ["universidad", "curso", "libro", "matricula", "capacitacion", "idiomas", "diplomado", "estudio"],
  "Ahorro": ["ahorro", "inversion", "fondo", "meta", "emergencia"],
  "Mascotas": ["veterinario", "perro", "gato", "mascota", "comida mascota", "peluqueria mascota", "vacuna mascota"],
  "Compras": ["ropa", "zapatos", "accesorios", "electronica", "amazon", "tienda", "online"],
  "Deporte": ["gym", "gimnasio", "cancha", "yoga", "suplemento", "proteina"],
  "Viajes": ["vuelo", "hotel", "vacaciones", "paseo", "hospedaje", "maleta"],
}

async function loadCategories(): Promise<BudgetCategoryItem[]> {
  const { data } = await budgetCategoriesApi.list()
  if (!data) return []
  return data.categories.map(c => ({
    id: c.id, name: c.nombre, budget: c.montoLimite, spent: 0,
    color: c.color, icon: c.icono, linkedFixedIds: c.linkedFixedExpenseIds,
  }))
}

/**
 * Auto-detecta a qué categoría de presupuesto pertenece una descripción de gasto.
 * Retorna el nombre de la categoría o null si no hay match.
 */
export function detectBudgetCategory(description: string, categories: BudgetCategoryItem[]): string | null {
  if (!description || categories.length === 0) return null
  const lower = description.toLowerCase()

  for (const cat of categories) {
    // Buscar en keywords predefinidas
    const keywords = CATEGORY_KEYWORDS[cat.name] ?? []
    const allKeys = [...keywords, cat.name.toLowerCase()]

    if (allKeys.some(k => lower.includes(k))) {
      return cat.name
    }
  }
  return null
}

export function useBudgetCategories() {
  const [categories, setCategories] = useState<BudgetCategoryItem[]>([])

  const refresh = useCallback(() => {
    loadCategories().then(setCategories)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { budgetCategories: categories, refreshBudgetCategories: refresh }
}

/**
 * Resumen de gasto por categoría calculado en el servidor — la MISMA cifra en
 * Presupuesto, Consejo Kiri y Balance (antes cada pantalla lo calculaba a su
 * manera en el navegador). Se recarga solo cuando cambian gastos, pagos de
 * gastos fijos o de deudas (cualquier cosa que mueva el gasto de una categoría).
 */
export function useCategoryResumen(alcance: 'periodo' | 'mes' = 'periodo') {
  const { impulseExpenses, fixedExpenses, debts } = useFinanceData()
  const [resumen, setResumen] = useState<ResumenCategorias | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await budgetCategoriesApi.resumen(alcance)
    if (data) setResumen(data)
    setLoading(false)
  }, [alcance])

  useEffect(() => { refresh() }, [refresh, impulseExpenses, fixedExpenses, debts])

  return { resumen, loading, refreshResumen: refresh }
}

/**
 * Categoría que Kiri sugiere para una descripción mientras el usuario escribe
 * (con pausa de 350 ms). Usa el historial del usuario: si ya puso "InDriver"
 * en Transporte, la próxima vez lo propone solo.
 */
export function useCategoriaSugerida(nombre: string) {
  const [sugerencia, setSugerencia] = useState<{ categoryId: string; nombre: string; fuente: 'historial' | 'palabra_clave' } | null>(null)
  useEffect(() => {
    const texto = nombre.trim()
    if (texto.length < 3) { setSugerencia(null); return }
    let vigente = true
    const t = setTimeout(() => {
      budgetCategoriesApi.sugerir(texto).then(({ data }) => { if (vigente) setSugerencia(data?.sugerencia ?? null) })
    }, 350)
    return () => { vigente = false; clearTimeout(t) }
  }, [nombre])
  return sugerencia
}
