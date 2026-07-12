"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * useBudgetCategories — Acceso compartido a las categorías de presupuesto
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Las categorías del presupuesto se almacenan en localStorage (kiri_budget_categories).
 * Este hook permite leerlas desde cualquier componente (ej: el modal de gastos hormiga
 * en obligaciones) sin duplicar lógica.
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
}

const LS_KEY = "kiri_budget_categories"

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

function loadCategories(): BudgetCategoryItem[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]")
  } catch {
    return []
  }
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

  useEffect(() => {
    setCategories(loadCategories())

    // Escuchar cambios en localStorage desde otras tabs/componentes
    const handler = (e: StorageEvent) => {
      if (e.key === LS_KEY) setCategories(loadCategories())
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [])

  const refresh = useCallback(() => {
    setCategories(loadCategories())
  }, [])

  return { budgetCategories: categories, refreshBudgetCategories: refresh }
}
