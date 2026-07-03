"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp, TrendingDown, Target, Sparkles, ChevronRight,
  Calendar, RefreshCw, Zap, Shield, PiggyBank, AlertTriangle,
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { calculateProjections, type ProjectionResult, type ProjectionHito } from "@/lib/projections-logic"
import Link from "next/link"

export function ProyeccionesTab() {
  const { formatAmount, income, incomeFrequency } = useAppContext()
  const { debts, fixedExpenses, totalAhorrado } = useFinanceData()
  const { periodData } = usePeriodBudget()

  const [activeRoute, setActiveRoute] = useState<"kiri" | "actual">("kiri")
  const [meses, setMeses] = useState(6)

  // Calcular proyecciones
  const projection = useMemo((): ProjectionResult | null => {
    if (income <= 0) return null
    const debtInputs = debts.filter(d => d.estado === "activa").map(d => ({
      id: d.id, nombre: d.nombre, saldoRestante: d.saldoRestante,
      cuotaPeriodo: d.cuotaPeriodo, tasaInteres: d.tasaInteres,
    }))
    const gastosFijos = fixedExpenses.reduce((a, f) => a + f.monto, 0)
    return calculateProjections(income, debtInputs, totalAhorrado, gastosFijos, incomeFrequency, meses)
  }, [income, debts, fixedExpenses, totalAhorrado, incomeFrequency, meses])

  if (!projection) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <TrendingUp className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground text-center">Configura tu ingreso y obligaciones<br />para ver tus proyecciones financieras.</p>
      </div>
    )
  }

  const deudaTotal = debts.filter(d => d.estado === "activa").reduce((a, d) => a + d.saldoRestante, 0)
  const patrimonioActual = totalAhorrado - deudaTotal
  const now = new Date()
  const rangeStart = now.toLocaleDateString("es-ES", { month: "short", year: "numeric" })
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + meses, 1).toLocaleDateString("es-ES", { month: "short", year: "numeric" })

  return (
    <div className="space-y-5">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Proyecciones</h1>
          <p className="text-xs text-muted-foreground">Visualiza tu futuro financiero y toma mejores decisiones hoy.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de meses */}
          <div className="flex bg-muted/30 rounded-xl p-1">
            {[3, 6, 12, 24].map(m => (
              <button key={m} onClick={() => setMeses(m)} className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
                meses === m ? "bg-kiri-emerald text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{m} meses</button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {rangeStart} – {rangeEnd}
          </span>
        </div>
      </div>

      {/* ═══ RESUMEN: Patrimonio actual vs proyectado ═══ */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-kiri-emerald/10 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-kiri-emerald" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Tu futuro financiero en {meses} meses</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Proyecciones según tu comportamiento actual vs. el plan optimizado de Kiri.</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] text-muted-foreground">Patrimonio neto actual</p>
              <p className={cn("text-lg font-black", patrimonioActual >= 0 ? "text-emerald-500" : "text-red-500")}>
                {patrimonioActual >= 0 ? "+" : ""}{formatAmount(patrimonioActual)}
              </p>
              <p className="text-[8px] text-muted-foreground">{patrimonioActual < 0 ? "(Deudas > Ahorros)" : ""}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] text-muted-foreground">Patrimonio proyectado (Kiri)</p>
              <p className={cn("text-lg font-black", projection.kiriFinal.patrimonio >= 0 ? "text-emerald-500" : "text-red-500")}>
                {projection.kiriFinal.patrimonio >= 0 ? "+" : ""}{formatAmount(projection.kiriFinal.patrimonio)}
              </p>
              <p className="text-[8px] text-muted-foreground">En {meses} meses</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ GRÁFICA + HITOS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfica */}
        <Card className="lg:col-span-2 border-none bg-card shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            {/* Toggle Ruta */}
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setActiveRoute("actual")} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors",
                activeRoute === "actual" ? "bg-red-500/10 text-red-500" : "bg-muted/30 text-muted-foreground")}>
                <TrendingDown className="h-3 w-3" /> Ruta actual
              </button>
              <button onClick={() => setActiveRoute("kiri")} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors",
                activeRoute === "kiri" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/30 text-muted-foreground")}>
                <TrendingUp className="h-3 w-3" /> Ruta Kiri (optimizado)
              </button>
            </div>

            {/* Leyenda */}
            <div className="flex gap-4 mb-3 text-[9px]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ahorro acumulado</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Deuda total</span>
              <span className="flex items-center gap-1 text-muted-foreground">--- Patrimonio neto</span>
            </div>

            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projection.months} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ahorroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="deudaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip content={<ProjectionTooltip formatAmount={formatAmount} />} />
                  <Area type="monotone" dataKey={activeRoute === "kiri" ? "ahorroKiri" : "ahorroActual"} stroke="#10b981" strokeWidth={2} fill="url(#ahorroGrad)" name="Ahorro" />
                  <Area type="monotone" dataKey={activeRoute === "kiri" ? "deudaKiri" : "deudaActual"} stroke="#ef4444" strokeWidth={2} fill="url(#deudaGrad)" name="Deuda" />
                  <Area type="monotone" dataKey={activeRoute === "kiri" ? "patrimonioKiri" : "patrimonioActual"} stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 3" fill="none" name="Patrimonio" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Hitos */}
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-sm">Hitos importantes <span className="text-muted-foreground font-normal">(Plan Kiri)</span></h3>
            <div className="space-y-3">
              {projection.hitos.slice(0, 4).map((h, i) => (
                <HitoItem key={i} hito={h} />
              ))}
            </div>
            {projection.hitos.length > 4 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">Ver todos los hitos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ COMPARACIÓN DE RESULTADOS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Comparación VS */}
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-sm">Comparación de resultados en {meses} meses</h3>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              {/* Ruta actual */}
              <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                <p className="text-[9px] font-bold text-muted-foreground">Ruta actual (sin cambios)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-[8px] text-muted-foreground">Ahorro acumulado</p><p className="text-xs font-black">{formatAmount(projection.actualFinal.ahorro)}</p></div>
                  <div><p className="text-[8px] text-muted-foreground">Deuda total</p><p className="text-xs font-black text-red-500">-{formatAmount(projection.actualFinal.deuda)}</p></div>
                </div>
                <div className="pt-1 border-t border-border">
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", projection.actualFinal.patrimonio >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                    Patrimonio neto: {formatAmount(projection.actualFinal.patrimonio)}
                  </span>
                </div>
              </div>
              {/* VS */}
              <span className="text-xs font-black text-muted-foreground">VS</span>
              {/* Ruta Kiri */}
              <div className="bg-kiri-emerald/5 border border-kiri-emerald/20 rounded-xl p-3 space-y-2">
                <p className="text-[9px] font-bold text-kiri-emerald">Ruta Kiri (plan optimizado)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-[8px] text-muted-foreground">Ahorro acumulado</p><p className="text-xs font-black text-emerald-600">{formatAmount(projection.kiriFinal.ahorro)}</p></div>
                  <div><p className="text-[8px] text-muted-foreground">Deuda total</p><p className="text-xs font-black text-red-500">-{formatAmount(projection.kiriFinal.deuda)}</p></div>
                </div>
                <div className="pt-1 border-t border-kiri-emerald/20">
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", projection.kiriFinal.patrimonio >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    Patrimonio neto: +{formatAmount(projection.kiriFinal.patrimonio)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recomendaciones Kiri Coach */}
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm">Recomendaciones de Kiri Coach</h3>
              <span className="text-lg">🌱</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Consejos personalizados para acelerar tu progreso.</p>
            <div className="space-y-2">
              <RecoCard icon={<Zap className="h-3.5 w-3.5 text-amber-500" />} title="Prioridad #1" desc="Continúa usando la estrategia Bola de Nieve. Te ahorrará en intereses." />
              <RecoCard icon={<PiggyBank className="h-3.5 w-3.5 text-emerald-500" />} title="Ahorro automático" desc="Aumenta tu ahorro al 15% de tu ingreso. Tendrás tu fondo de emergencia antes." />
              <RecoCard icon={<Shield className="h-3.5 w-3.5 text-cyclon-lavender" />} title="Gasto hormiga" desc="Reducir gastos hormiga libera capacidad para ahorrar." />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ MÉTRICAS FINALES ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniMetric label="Intereses que ahorrarías" value={formatAmount(projection.interesesAhorrados)} sub="Con el plan Kiri" />
        <MiniMetric label="Tiempo para libertad financiera" value={`${projection.mesesMenosDeuda} meses menos`} sub="Que con la ruta actual" />
        <MiniMetric label="Mejora en tu patrimonio" value={`+${formatAmount(projection.mejoraPatrimonio)}`} sub={`Diferencia en ${meses} meses`} color="text-emerald-500" />
        <MiniMetric label="Probabilidad de éxito" value={`${projection.probabilidadExito}%`} sub="Con el plan optimizado" extra={
          <Progress value={projection.probabilidadExito} className="h-1.5 mt-1" indicatorClassName="bg-kiri-emerald" />
        } />
      </div>

      {/* Disclaimer */}
      <p className="text-[9px] text-muted-foreground text-center">
        *Las proyecciones son estimaciones basadas en tus datos actuales y pueden variar.
      </p>
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function ProjectionTooltip({ active, payload, formatAmount }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string; formatAmount: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg space-y-1">
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[9px] text-muted-foreground">{p.name}:</span>
          <span className="text-[10px] font-black">{formatAmount(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function HitoItem({ hito }: { hito: ProjectionHito }) {
  const colors = { deuda: "bg-amber-500", ahorro: "bg-emerald-500", emergencia: "bg-blue-500", meta: "bg-cyclon-lavender" }
  return (
    <div className="flex items-start gap-2.5">
      <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5", colors[hito.tipo] + "/20")}>
        {hito.tipo === "deuda" ? <AlertTriangle className="h-3 w-3 text-amber-500" /> :
         hito.tipo === "ahorro" ? <PiggyBank className="h-3 w-3 text-emerald-500" /> :
         hito.tipo === "emergencia" ? <Shield className="h-3 w-3 text-blue-500" /> :
         <Target className="h-3 w-3 text-cyclon-lavender" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground">{hito.mesLabel}</p>
        <p className="text-xs font-bold">{hito.titulo}</p>
        <p className="text-[10px] text-muted-foreground">{hito.descripcion}</p>
      </div>
    </div>
  )
}

function RecoCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
      <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold">{title}</p>
        <p className="text-[9px] text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
    </div>
  )
}

function MiniMetric({ label, value, sub, color, extra }: { label: string; value: string; sub: string; color?: string; extra?: React.ReactNode }) {
  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-3">
        <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-sm font-black mt-0.5", color)}>{value}</p>
        <p className="text-[8px] text-muted-foreground mt-0.5">{sub}</p>
        {extra}
      </CardContent>
    </Card>
  )
}
