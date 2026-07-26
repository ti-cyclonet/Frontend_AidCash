"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { impulseApi, TopConsumoItem } from "@/lib/api-client"
import { useAppContext } from "@/lib/app-context"
import { Info, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

// Emojis por tipo de gasto detectado
function getItemEmoji(nombre: string): string {
  const lower = nombre.toLowerCase()
  if (lower.includes("hamburguesa") || lower.includes("comida") || lower.includes("almuerzo")) return "🍔"
  if (lower.includes("mercado") || lower.includes("supermercado")) return "🛒"
  if (lower.includes("café") || lower.includes("cafe") || lower.includes("starbucks")) return "☕"
  if (lower.includes("rappi") || lower.includes("domicilio") || lower.includes("uber eats")) return "🛵"
  if (lower.includes("cine") || lower.includes("netflix")) return "🎬"
  if (lower.includes("uber") || lower.includes("taxi") || lower.includes("didi")) return "🚕"
  if (lower.includes("cerveza") || lower.includes("bar") || lower.includes("trago")) return "🍺"
  if (lower.includes("gas") || lower.includes("tanqueo")) return "⛽"
  if (lower.includes("pollo") || lower.includes("arroz")) return "🍗"
  if (lower.includes("pizza")) return "🍕"
  if (lower.includes("postre") || lower.includes("dulce") || lower.includes("helado")) return "🍰"
  if (lower.includes("comida saludable") || lower.includes("ensalada") || lower.includes("fruta")) return "🥗"
  return "💸"
}

interface DesgloseGastosSectionProps {
  /** Gastos que pertenecen a la categoría seleccionada (ya filtrados) */
  expenses: { id: string; nombre: string; monto: number; categoria?: string; createdAt?: string; periodo?: string }[]
  /** Nombre de la categoría para contextualizar */
  categoryName: string
  /** Color de la categoría */
  categoryColor: string
  /** Total gastado en esta categoría */
  totalSpent: number
}

/**
 * Sección "Desglose de gastos" para la vista detallada de una categoría.
 * Agrupa los gastos por nombre y muestra barras de progreso relativas al total de la categoría.
 */
export function DesgloseGastosSection({ expenses, categoryName, categoryColor, totalSpent }: DesgloseGastosSectionProps) {
  const { formatAmount } = useAppContext()

  // Agrupar gastos por nombre y sumar montos (local, sin API call)
  const grouped = useMemo(() => {
    const map = new Map<string, { nombre: string; total: number; count: number }>()

    for (const exp of expenses) {
      // Quitar el tag [Categoria] del nombre si existe
      const cleanName = exp.nombre.replace(/^\[.*?\]\s*/, '')
      const existing = map.get(cleanName)
      if (existing) {
        existing.total += exp.monto
        existing.count += 1
      } else {
        map.set(cleanName, { nombre: cleanName, total: exp.monto, count: 1 })
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
  }, [expenses])

  if (grouped.length === 0) return null

  return (
    <div className="pt-4 border-t border-border/50">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <h4 className="text-xs font-bold">Desglose de gastos</h4>
        <Info className="h-3 w-3 text-muted-foreground" />
      </div>
      <p className="text-[9px] text-muted-foreground mb-4">
        Aquí puedes ver en qué se te va el dinero dentro de {categoryName}.
      </p>

      {/* Table header */}
      <div className="grid grid-cols-[auto_1fr_80px_60px] gap-3 items-center px-2 mb-2">
        <span className="text-[9px] text-muted-foreground font-medium w-6"></span>
        <span className="text-[9px] text-muted-foreground font-medium">Ítem</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right">Total gastado</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right">% del gasto en esta categoría</span>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {grouped.map((item) => {
          const percentage = totalSpent > 0 ? Math.round((item.total / totalSpent) * 1000) / 10 : 0

          return (
            <div key={item.nombre} className="group rounded-xl hover:bg-muted/10 transition-colors px-2 py-2">
              <div className="grid grid-cols-[auto_1fr_80px_60px] gap-3 items-center">
                {/* Emoji */}
                <span className="text-sm w-6 text-center">{getItemEmoji(item.nombre)}</span>

                {/* Nombre + barra */}
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium truncate">{item.nombre}</p>
                  <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: categoryColor,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>

                {/* Total */}
                <span className="text-xs font-bold text-right">{formatAmount(item.total)}</span>

                {/* Porcentaje */}
                <span className="text-[10px] text-muted-foreground text-right">{percentage}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer total */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30 px-2">
        <p className="text-[10px] text-muted-foreground">
          Total gastado en esta categoría: <strong className="text-foreground">{formatAmount(totalSpent)}</strong>
        </p>
        <span className="text-[10px] font-bold text-muted-foreground">100%</span>
      </div>

      {/* Dots menu placeholder */}
      <div className="flex justify-end mt-2">
        <button className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/20 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
