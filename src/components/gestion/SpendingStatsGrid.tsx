"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Zap, Clock, Activity, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { projectionsApi, type SpendingProjection } from "@/lib/api-client"
import { useAppContext } from "@/lib/app-context"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SpendingStatsGrid — Estadísticas de gasto rápidas para el dashboard
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Grilla 2x2 con: gasto de esta semana, semana anterior, gasto del mes y el
 * presupuesto diario recomendado. Comparte la misma fuente de datos
 * (`projectionsApi.getSpending()`) que antes alimentaba el widget completo de
 * "Velocidad de gasto" — solo se muestran estos cuatro datos, sin el velocímetro
 * ni el consejo de la IA.
 */

export function SpendingStatsGrid() {
  const { formatAmount } = useAppContext()
  const [projection, setProjection] = useState<SpendingProjection | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    projectionsApi.getSpending().then(({ data }) => {
      if (data) setProjection(data.projection)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-none bg-card shadow-sm rounded-2xl animate-pulse">
            <CardContent className="p-3 h-[74px]" />
          </Card>
        ))}
      </div>
    )
  }

  if (!projection) return null

  const { presupuestoDiarioRecomendado, stats } = projection

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        icon={<Zap className="h-4 w-4 text-amber-500" />}
        label="Gasto esta semana"
        value={formatAmount(stats.gastoSemanaActual)}
        sub={`${stats.transaccionesSemana} transacciones`}
      />
      <StatCard
        icon={<Clock className="h-4 w-4 text-blue-500" />}
        label="Semana anterior"
        value={formatAmount(stats.gastoSemanaAnterior)}
        sub={stats.gastoSemanaActual > stats.gastoSemanaAnterior ? '↑ Aumentó' : stats.gastoSemanaActual < stats.gastoSemanaAnterior ? '↓ Disminuyó' : '= Igual'}
        subColor={stats.gastoSemanaActual > stats.gastoSemanaAnterior ? 'text-red-500' : stats.gastoSemanaActual < stats.gastoSemanaAnterior ? 'text-emerald-500' : 'text-muted-foreground'}
      />
      <StatCard
        icon={<Activity className="h-4 w-4 text-purple-500" />}
        label="Gasto del mes"
        value={formatAmount(stats.gastoMes)}
        sub={`${stats.transaccionesMes} transacciones`}
      />
      <StatCard
        icon={<Target className="h-4 w-4 text-kiri-emerald" />}
        label="Presupuesto diario"
        value={formatAmount(presupuestoDiarioRecomendado)}
        sub="Para llegar bien"
        subColor="text-kiri-emerald"
      />
    </div>
  )
}

function StatCard({ icon, label, value, sub, subColor }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  subColor?: string
}) {
  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
        </div>
        <p className="text-sm font-black">{value}</p>
        <p className={cn("text-[9px]", subColor || "text-muted-foreground")}>{sub}</p>
      </CardContent>
    </Card>
  )
}
