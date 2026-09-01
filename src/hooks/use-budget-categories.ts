"use client"

import { useState, useEffect, useCallback } from "react"
import { budgetCategoriesApi } from "@/lib/api-client"

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
