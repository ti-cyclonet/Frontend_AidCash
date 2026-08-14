"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Activity, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Zap, Clock, Target, ArrowRight, RefreshCw, Gauge, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { projectionsApi, type SpendingProjection } from "@/lib/api-client"
import { useAppContext } from "@/lib/app-context"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SpendingVelocityWidget — Widget de Velocidad de Gasto (IA Proactiva)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Muestra al usuario:
 *   - Su velocidad de gasto diario actual
 *   - Cuántos días le quedan a ese ritmo
 *   - El presupuesto diario recomendado para llegar al próximo pago
 *   - Nivel de riesgo con indicador visual
 *   - Tendencia (creciente/decreciente/estable)
 *   - Recomendación personalizada de la IA
 */

export function SpendingVelocityWidget() {
  const { formatAmount } = useAppContext()
  const [projection, setProjection] = useState<SpendingProjection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjection = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: apiError } = await projectionsApi.getSpending()
      if (apiError) {
        setError(apiError)
      } else if (data) {
        setProjection(data.projection)
      }
    } catch {
      setError('Error al cargar proyecciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjection()
  }, [])

  if (loading) {
    return (
      <Card className="border-none bg-card shadow-sm rounded-2xl animate-pulse">
        <CardContent className="p-5">
          <div className="h-6 w-48 bg-muted/30 rounded-lg mb-4" />
          <div className="h-20 bg-muted/20 rounded-xl mb-3" />
          <div className="h-4 w-full bg-muted/20 rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (error || !projection) {
    return (
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-5 flex flex-col items-center justify-center py-10 space-y-3">
          <Activity className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground text-center">
            {error || 'Registra gastos hormiga para ver tu velocidad de gasto.'}
          </p>
          <button onClick={fetchProjection} className="text-xs text-kiri-emerald font-bold flex items-center gap-1 hover:underline">
            <RefreshCw className="h-3 w-3" /> Reintentar
          </button>
        </CardContent>
      </Card>
    )
  }

  const { riesgo, tendencia, diasRestantes, diasHastaPago, gastoPromediodiario7d, presupuestoDiarioRecomendado, diferencia, recomendacion, stats } = projection

  // Colores según riesgo
  const riesgoConfig = {
    bajo: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Bajo', icon: '🟢', progressColor: 'bg-emerald-500' },
    medio: { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Medio', icon: '🟡', progressColor: 'bg-amber-500' },
    alto: { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'Alto', icon: '🟠', progressColor: 'bg-orange-500' },
    critico: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Crítico', icon: '🔴', progressColor: 'bg-red-500' },
  }

  const config = riesgoConfig[riesgo]
  const tendenciaIcon = tendencia === 'creciente' ? <TrendingUp className="h-3.5 w-3.5 text-red-500" /> :
                         tendencia === 'decreciente' ? <TrendingDown className="h-3.5 w-3.5 text-emerald-500" /> :
                         <Minus className="h-3.5 w-3.5 text-muted-foreground" />

  // Porcentaje de "combustible" restante (días restantes / días hasta pago)
  const fuelPct = Math.min(100, Math.max(0, (diasRestantes / Math.max(diasHastaPago, 1)) * 100))

  return (
    <div className="space-y-4">
      {/* ═══ TARJETA PRINCIPAL: Velocímetro de gasto ═══ */}
      <Card className={cn("border-none shadow-sm rounded-2xl overflow-hidden", config.bg)}>
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", config.bg)}>
                <Gauge className={cn("h-5 w-5", config.color)} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Velocidad de gasto</h3>
                <p className="text-[10px] text-muted-foreground">Análisis de los últimos 7 días</p>
              </div>
            </div>
            <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1", config.bg, config.color)}>
              {config.icon} Riesgo {config.label}
            </div>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-3 gap-3">
            {/* Gasto diario actual */}
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-[9px] text-muted-foreground font-medium">Gastas/día</p>
              <p className="text-base font-black mt-0.5">{formatAmount(gastoPromediodiario7d)}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {tendenciaIcon}
                <span className="text-[9px] text-muted-foreground capitalize">{tendencia}</span>
              </div>
            </div>

            {/* Presupuesto diario recomendado */}
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-[9px] text-muted-foreground font-medium">Recomendado/día</p>
              <p className="text-base font-black text-kiri-emerald mt-0.5">{formatAmount(presupuestoDiarioRecomendado)}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Target className="h-3 w-3 text-kiri-emerald" />
                <span className="text-[9px] text-muted-foreground">Para llegar</span>
              </div>
            </div>

            {/* Diferencia */}
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-[9px] text-muted-foreground font-medium">Diferencia</p>
              <p className={cn("text-base font-black mt-0.5", diferencia >= 0 ? "text-emerald-500" : "text-red-500")}>
                {diferencia >= 0 ? '+' : ''}{formatAmount(diferencia)}
              </p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {diferencia >= 0 ? <TrendingDown className="h-3 w-3 text-emerald-500" /> : <AlertTriangle className="h-3 w-3 text-red-500" />}
                <span className="text-[9px] text-muted-foreground">{diferencia >= 0 ? 'Margen' : 'Exceso'}</span>
              </div>
            </div>
          </div>

          {/* Barra de "combustible" — Días restantes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold flex items-center gap-1">
                <Clock className="h-3 w-3" /> Autonomía de tu wallet libre
              </span>
              <span className="text-[10px] text-muted-foreground">
                {diasRestantes > 99 ? '+99' : diasRestantes} días restantes · Próx. pago en {diasHastaPago} días
              </span>
            </div>
            <div className="relative">
              <Progress value={fuelPct} className="h-3 rounded-full" indicatorClassName={cn("rounded-full transition-all", config.progressColor)} />
              {/* Marcador del día de pago */}
              <div className="absolute top-0 h-3 w-0.5 bg-foreground/40 rounded-full" style={{ left: '100%', transform: 'translateX(-2px)' }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Hoy</span>
              <span className="font-bold">Próximo pago</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ RECOMENDACIÓN DE LA IA ═══ */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyclon-lavender/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4.5 w-4.5 text-cyclon-lavender" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-cyclon-lavender">Consejo de Kiri Coach 🌱</p>
              <p className="text-xs text-foreground mt-1 leading-relaxed">{recomendacion}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ ESTADÍSTICAS DETALLADAS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

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

// ─── Exportar un mini-resumen para el dashboard principal ─────────────────────

function Sparklines() { return null } // Placeholder para futura gráfica de sparklines
