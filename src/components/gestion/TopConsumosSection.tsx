"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { impulseApi, TopConsumoItem } from "@/lib/api-client"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { Info, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { tr } from "@/lib/i18n"

// Colores para las barras (degradado por posición)
const BAR_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#3b82f6", "#6366f1"]

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
  if (lower.includes("ropa") || lower.includes("zapatos")) return "👕"
  if (lower.includes("gym") || lower.includes("gimnasio")) return "💪"
  return "💸"
}

/**
 * Sección "Top Mayores Consumos" para la vista general de presupuesto.
 * Muestra los 5 ítems en los que más se ha gastado en el periodo, con barras de progreso.
 */
export function TopConsumosSection() {
  const { formatAmount } = useAppContext()
  const { impulseExpenses } = useFinanceData()
  const [items, setItems] = useState<TopConsumoItem[]>([])
  const [totalGastado, setTotalGastado] = useState(0)
  const [loading, setLoading] = useState(true)
  // "periodo" = tu quincena/mes de ingreso actual; "mes" = el mes calendario
  // completo. Para un usuario quincenal el periodo es solo media quincena de
  // gastos, y el top parecía "no traer toda la información".
  const [alcance, setAlcance] = useState<'periodo' | 'mes'>('periodo')

  // Se recarga al registrar/borrar/reclasificar un gasto (impulseExpenses
  // cambia) — antes solo se cargaba al montar y se quedaba desactualizado.
  useEffect(() => {
    impulseApi.topConsumos({ limit: 5, alcance }).then(({ data }) => {
      if (data) {
        setItems(data.items)
        setTotalGastado(data.totalGastado)
      }
      setLoading(false)
    })
  }, [alcance, impulseExpenses])

  if (loading) {
    return (
      <Card className="border-none bg-card shadow-sm rounded-2xl animate-pulse">
        <CardContent className="p-5 h-[200px]" />
      </Card>
    )
  }

  if (items.length === 0 && alcance === 'periodo') return null

  // El máximo para escalar las barras
  const maxAmount = items.length > 0 ? items[0].totalGastado : 1
  const topTotal = items.reduce((sum, i) => sum + i.totalGastado, 0)

  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">{tr("Top Mayores Consumos")}</h3>
            <span title={tr("Suma todos los registros del mismo consumo, aunque tengan distinta categoría o mayúsculas (ej. «InDriver» e «InDriver [Transporte]»).")}>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </div>
          <div className="flex gap-1">
            {(['periodo', 'mes'] as const).map(a => (
              <button key={a} onClick={() => setAlcance(a)}
                className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors",
                  alcance === a ? "bg-kiri-emerald text-white" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
                {a === 'periodo' ? tr("Este periodo") : tr("Este mes")}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground mb-4">{tr("Tus 5 mayores consumos variables {0}", [alcance === 'periodo' ? tr("en el periodo actual") : tr("en el mes calendario")])}</p>
        {items.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{tr("Sin gastos registrados en este rango.")}</p>}

        {/* Items */}
        <div className="space-y-3">
          {items.map((item, index) => {
            const barWidth = maxAmount > 0 ? (item.totalGastado / maxAmount) * 100 : 0
            const color = BAR_COLORS[index] || BAR_COLORS[BAR_COLORS.length - 1]

            return (
              <div key={item.nombre} className="flex items-center gap-3">
                {/* Emoji */}
                <span className="text-base w-6 text-center shrink-0">{getItemEmoji(item.nombre)}</span>

                {/* Nombre */}
                <span className="text-xs font-medium w-[120px] truncate shrink-0">
                  {item.nombre}
                  {item.cantidad > 1 && <span className="text-muted-foreground font-normal"> ×{item.cantidad}</span>}
                </span>

                {/* Barra de progreso */}
                <div className="flex-1 h-3 bg-muted/20 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>

                {/* Monto */}
                <span className="text-xs font-bold w-[70px] text-right shrink-0">
                  {formatAmount(item.totalGastado)}
                </span>

                {/* Porcentaje */}
                <span className="text-[10px] text-muted-foreground w-[40px] text-right shrink-0">
                  {item.porcentaje}%
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground">{tr("Total gastado en estos ítems:")}{" "}<strong className="text-foreground">{formatAmount(topTotal)}</strong>
            {totalGastado > 0 && (
              <span className="text-muted-foreground">{" "}{tr("({0}% del total gastado)", [Math.round((topTotal / totalGastado) * 100)])}</span>
            )}
          </p>
          <Link
            href="/balance"
            className="text-[10px] font-bold text-kiri-emerald hover:underline flex items-center gap-1"
          >
            <TrendingDown className="h-3 w-3" />{" "}{tr("Ver todos los gastos")}</Link>
        </div>
      </CardContent>
    </Card>
  )
}
