"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Heart, Users, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HomeBudgetDashboard — Presupuesto unificado de la pareja
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Visualiza el presupuesto combinado del hogar usando un gráfico circular (recharts).
 * Muestra la distribución en 4 bloques: Obligaciones, Ahorro, Gasto Libre, Capacidad.
 * Incluye el desglose de contribución por cada usuario.
 *
 * Se conecta al endpoint GET /api/home-budget que calcula todo en el backend.
 */

interface HomeBudgetData {
  ingresoTotal: number
  ingresoUser1: number
  ingresoUser2: number
  obligacionesTotal: number
  obligacionesUser1: number
  obligacionesUser2: number
  ahorro: number
  ahorroPct: number
  libre: number
  librePct: number
  capacidadEndeudamiento: number
  capacidadPct: number
  obligacionesPct: number
  isOverloaded: boolean
}

interface Props {
  /** Datos del presupuesto del hogar (del API) */
  budget: HomeBudgetData | null
  /** Nombre del partner */
  partnerName?: string
  /** Loading state */
  loading?: boolean
}

const COLORS = {
  obligaciones: "#ef4444",
  ahorro: "#10b981",
  libre: "#3b82f6",
  capacidad: "#8b5cf6",
}

export function HomeBudgetDashboard({ budget, partnerName = "Pareja", loading }: Props) {
  const { formatAmount } = useAppContext()

  if (loading) {
    return (
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-6 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-32 bg-muted/30 rounded mx-auto" />
            <div className="h-[200px] w-[200px] bg-muted/20 rounded-full mx-auto" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!budget) {
    return (
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-6 text-center space-y-3">
          <Heart className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Conecta con tu pareja (rol PARTNER) para ver el presupuesto del hogar.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Datos para el gráfico circular
  const chartData = [
    { name: "Obligaciones", value: budget.obligacionesTotal, pct: budget.obligacionesPct, color: COLORS.obligaciones },
    { name: "Ahorro", value: budget.ahorro, pct: budget.ahorroPct, color: COLORS.ahorro },
    { name: "Gasto Libre", value: budget.libre, pct: budget.librePct, color: COLORS.libre },
    { name: "Capacidad", value: budget.capacidadEndeudamiento, pct: budget.capacidadPct, color: COLORS.capacidad },
  ].filter(d => d.value > 0)

  // Porcentaje de contribución de cada usuario
  const pctUser1 = budget.ingresoTotal > 0 ? Math.round((budget.ingresoUser1 / budget.ingresoTotal) * 100) : 50
  const pctUser2 = 100 - pctUser1

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center shrink-0">
              <Heart className="h-5 w-5 text-pink-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Presupuesto del Hogar</h3>
              <p className="text-[10px] text-muted-foreground">
                Ingreso combinado con {partnerName}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-lg font-black text-kiri-emerald">{formatAmount(budget.ingresoTotal)}</p>
              <p className="text-[9px] text-muted-foreground">ingreso total</p>
            </div>
          </div>

          {/* Barra de contribución */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[9px]">
              <span className="font-bold">Tú ({pctUser1}%)</span>
              <span className="font-bold text-muted-foreground">{partnerName} ({pctUser2}%)</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden flex">
              <div className="h-full bg-kiri-emerald transition-all" style={{ width: `${pctUser1}%` }} />
              <div className="h-full bg-pink-500 transition-all" style={{ width: `${pctUser2}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>{formatAmount(budget.ingresoUser1)}</span>
              <span>{formatAmount(budget.ingresoUser2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico + Distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        {/* Donut chart */}
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col items-center">
            <p className="text-[10px] text-muted-foreground font-medium mb-2">Distribución del hogar</p>
            <div className="h-[200px] w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-[10px] font-bold">{d.name}</p>
                          <p className="text-xs">{formatAmount(d.value)} ({Math.round(d.pct)}%)</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown */}
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <h4 className="text-xs font-bold">Desglose del presupuesto</h4>

            {budget.isOverloaded && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-500">
                  Las obligaciones del hogar superan el ingreso combinado. Revisen juntos cómo reducir gastos.
                </p>
              </div>
            )}

            <BudgetRow
              label="Obligaciones" color={COLORS.obligaciones}
              amount={formatAmount(budget.obligacionesTotal)} pct={Math.round(budget.obligacionesPct)}
              detail={`Tú: ${formatAmount(budget.obligacionesUser1)} · ${partnerName}: ${formatAmount(budget.obligacionesUser2)}`}
            />
            <BudgetRow
              label="Ahorro" color={COLORS.ahorro}
              amount={formatAmount(budget.ahorro)} pct={Math.round(budget.ahorroPct)}
            />
            <BudgetRow
              label="Gasto Libre" color={COLORS.libre}
              amount={formatAmount(budget.libre)} pct={Math.round(budget.librePct)}
            />
            <BudgetRow
              label="Capacidad de endeudamiento" color={COLORS.capacidad}
              amount={formatAmount(budget.capacidadEndeudamiento)} pct={Math.round(budget.capacidadPct)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Subcomponent ─────────────────────────────────────────────────────────────

function BudgetRow({ label, color, amount, pct, detail }: {
  label: string; color: string; amount: string; pct: number; detail?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-bold">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold">{amount}</span>
          <span className="text-[9px] text-muted-foreground ml-1">({pct}%)</span>
        </div>
      </div>
      {detail && <p className="text-[9px] text-muted-foreground pl-4">{detail}</p>}
      <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden ml-4">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
