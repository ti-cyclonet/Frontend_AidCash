"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  BookOpen, History, TrendingUp, TrendingDown, Trash2, Calendar, PiggyBank,
  ArrowUpRight, ArrowDownRight, Trophy, BarChart3, Target, ShieldCheck,
  Percent,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useCountUp } from "@/hooks/use-count-up"
import { CategoryDistributionCard } from "@/components/gestion/CategoryDistributionCard"
import { reportsApi, userApi, type BalanceReport, type Timeframe, type WalletState } from "@/lib/api-client"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"
import { FeatureGate } from "@/components/plan/feature-gate"
import Link from "next/link"
import { tr, localeFecha } from "@/lib/i18n"

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "week",  label: tr("Semana") },
  { value: "month", label: tr("Mes")    },
  { value: "year",  label: tr("Año")    },
  { value: "all",   label: tr("Todo")   },
]

export default function BalancePage() {
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("balance")
  const { formatAmount, metaAhorro, incomeFrequency, diasCobro } = useAppContext()
  const { debts, impulseExpenses, fixedExpenses } = useFinanceData()

  const [timeframe, setTimeframe] = useState<Timeframe>("month")
  const [report, setReport] = useState<BalanceReport | null>(null)
  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  const [loading, setLoading] = useState(true)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  // Historial unificado — búsqueda + filtro por tipo

  const handleResetBalance = async () => {
    // Solo borra el historial (income_records, savings_history, impulse_expenses)
    // NO toca el cashBalance ni el wallet
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/reports/reset-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await import('@/lib/api-client')).getAccessToken()}` },
      })
      if (res.ok) {
        setResetConfirmOpen(false)
        fetchReport(timeframe)
      }
    } catch {}
  }

  const fetchReport = useCallback(async (tf: Timeframe) => {
    setLoading(true)
    const { data } = await reportsApi.getBalance(tf)
    if (data) setReport(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchReport(timeframe) }, [timeframe, fetchReport])
  useEffect(() => { userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) }) }, [])

  // Meta real de ahorro: suma de metas de los bolsillos de ahorro — venía de
  // una clave de localStorage ("kiri_saving_pockets") que la página de Ahorro
  // dejó de escribir hace tiempo (ver comentario en ahorro/page.tsx), así que
  // para cualquier usuario con bolsillos reales esto siempre quedaba en $0 y
  // la tarjeta "Meta de ahorro" ni siquiera se mostraba (se oculta si meta<=0).
  const [realSavingsMeta, setRealSavingsMeta] = useState(0)
  useEffect(() => {
    import("@/lib/api-client").then(({ savingsPocketsApi }) => {
      savingsPocketsApi.list().then(({ data }) => {
        if (data?.pockets) setRealSavingsMeta(data.pockets.reduce((a, p) => a + (Number(p.meta) || 0), 0))
      })
    })
  }, [])

  // Filtro de la gráfica: qué líneas mostrar
  const [chartFilter, setChartFilter] = useState<Set<"balance" | "ingresos" | "egresos">>(new Set(["balance"]))
  const toggleChartFilter = (key: "balance" | "ingresos" | "egresos") => {
    setChartFilter(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      if (next.size === 0) next.add("balance") // Al menos uno activo
      return next
    })
  }

  const s = report?.summary
  const balanceNeto = wallet.cashBalance
  const ingresosTotales = s?.totalIngresosHistorico ?? 0
  const egresosTotales = s?.totalEgresosHistorico ?? 0
  const ahorroDelPeriodo = s?.totalSaved ?? 0
  const interesPagado = s?.totalInteresPagado ?? 0
  const interesEvitado = s?.interesEvitado ?? 0

  // Datos para la gráfica de evolución
  const chartData = useMemo(() => {
    if (!report?.monthlySeries?.length) return []
    return report.monthlySeries.map(m => ({
      name: m.month,
      balance: m.ingresos - m.egresos,
      ingresos: m.ingresos,
      egresos: m.egresos,
    }))
  }, [report?.monthlySeries])


  // Rango de fechas legible
  const dateRange = report ? `${fmtDateShort(report.from)} – ${fmtDateShort(report.to)}` : ""

  // Stats calculados
  const stats = useMemo(() => {
    const ingresos = s?.totalIngreso ?? 0
    const egresos = s?.totalEgreso ?? 0
    const days = timeframe === "week" ? 7 : timeframe === "month" ? 30 : timeframe === "year" ? 365 : 30
    const promedio = days > 0 ? Math.round(balanceNeto / Math.max(days, 1)) : 0
    const meta = realSavingsMeta > 0 ? realSavingsMeta : (metaAhorro || 0)
    const metaPct = meta > 0 ? Math.min(Math.round((ahorroDelPeriodo / meta) * 100), 999) : 0
    return { promedio, meta, metaPct, mayorAumento: ingresos, mayorDisminucion: egresos }
  }, [s, balanceNeto, timeframe, metaAhorro, ahorroDelPeriodo, realSavingsMeta])


  return (
    <FeatureGate feature="basicReports">
    <>
      {showTutorial && <TutorialSlider module="balance" onClose={dismissTutorial} />}
    <div className="space-y-6 pb-10">
      {/* ═══ HEADER ═══
          Título a la izquierda y "Historial" a la derecha; el selector de
          periodo va centrado debajo. El historial completo (búsqueda,
          filtros, PDF y elegir mes) vive en su propio módulo: /balance/historial. */}
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6" />{" "}{tr("Balance")}</h1>
            <p className="text-muted-foreground text-sm">{tr("Todo lo que pasa con tu plata, en un solo lugar.")}</p>
          </div>
          {/* Historial es su propio módulo (/balance/historial), no una ventana. */}
          <Link href="/balance/historial" className="shrink-0">
            <Button className="rounded-xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold gap-2">
              <History className="h-4 w-4" />{" "}{tr("Historial")}</Button>
          </Link>
        </div>
        <div className="flex flex-col items-center gap-2">
          {/* Filtro de tiempo */}
          <div className="flex bg-muted/30 rounded-xl p-1">
            {TIMEFRAMES.map(tf => (
              <button key={tf.value} onClick={() => setTimeframe(tf.value)} className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-colors",
                timeframe === tf.value ? "bg-kiri-emerald text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{tf.label}</button>
            ))}
          </div>
          {/* El plan recortó el rango (KIRI FREE ve 3 meses; PLUS 24) */}
          {report?.historialLimitado && (
            <Link href="/mi-plan#planes" className="text-[11px] text-center text-muted-foreground bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 hover:bg-amber-500/15">{tr("Tu plan muestra los últimos {0} meses.", [report.historialLimitado.meses])}{report.historialLimitado.mejora && <strong className="text-amber-700 dark:text-amber-400">{" "}{tr("Con {0} ves más →", [report.historialLimitado.mejora.plan])}</strong>}
            </Link>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Rango de fechas */}
            {dateRange && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg">
                <Calendar className="h-3.5 w-3.5" /> {dateRange}
              </span>
            )}
            {/* Reiniciar balance */}
            <button onClick={() => setResetConfirmOpen(true)}
              className="h-8 px-3 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1">
              <Trash2 className="h-3 w-3" />{" "}{tr("Reiniciar")}</button>
          </div>
        </div>
      </header>

      {/* Confirm reset */}
      {resetConfirmOpen && (
        <Card className="border-2 border-destructive/30 bg-destructive/5 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-destructive">{tr("¿Reiniciar historial del balance?")}</p>
              <p className="text-[10px] text-muted-foreground">{tr("Se borrarán los registros de ingresos, ahorro y gastos hormiga del historial. Tu saldo real y obligaciones no se tocan.")}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setResetConfirmOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted">{tr("Cancelar")}</button>
              <button onClick={handleResetBalance} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-destructive text-white hover:bg-destructive/90">{tr("Confirmar")}</button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted/30 rounded-2xl" />)}
        </div>
      ) : (
        <>

          {/* ═══ 6 TARJETAS KPI (animadas) ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label={tr("Balance neto actual")} value={balanceNeto} color="text-emerald-500" formatAmount={formatAmount} icon={<BarChart3 className="h-3.5 w-3.5" />} />
            <KpiCard label={tr("Total recibido")} value={ingresosTotales} color="text-emerald-500" formatAmount={formatAmount} icon={<TrendingUp className="h-3.5 w-3.5" />} sub={tr("Desde que usas Kiri")} />
            <KpiCard label={tr("Total gastado")} value={egresosTotales} color="text-red-500" formatAmount={formatAmount} icon={<TrendingDown className="h-3.5 w-3.5" />} sub={tr("Desde que usas Kiri")} />
            <KpiCard label={tr("Ahorro del período")} value={ahorroDelPeriodo} color="text-cyclon-lavender" formatAmount={formatAmount} icon={<PiggyBank className="h-3.5 w-3.5" />} />
            <KpiCard label={tr("Interés pagado")} value={interesPagado} color="text-amber-500" formatAmount={formatAmount} icon={<Percent className="h-3.5 w-3.5" />} />
            <KpiCard label={tr("Interés evitado")} value={interesEvitado} color="text-violet-500" formatAmount={formatAmount} icon={<ShieldCheck className="h-3.5 w-3.5" />} sub={tr("Por tus abonos extra")} />
          </div>

          {/* ═══ GRÁFICA DE EVOLUCIÓN ═══ */}
          <Card className="border-none bg-card shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-sm flex items-center gap-2">{tr("Evolución de tu balance")}</h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{tr("Así ha cambiado tu balance neto en el período seleccionado.")}</p>
                </div>
                {/* Filtros de gráfica: seleccionar qué líneas ver */}
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleChartFilter("balance")} className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold transition-colors flex items-center gap-1",
                    chartFilter.has("balance") ? "bg-emerald-500/20 text-emerald-500" : "bg-muted/30 text-muted-foreground")}>
                    <BarChart3 className="h-3 w-3" />{" "}{tr("Balance")}</button>
                  <button onClick={() => toggleChartFilter("ingresos")} className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold transition-colors",
                    chartFilter.has("ingresos") ? "bg-emerald-500/20 text-emerald-500" : "bg-muted/30 text-muted-foreground")}>{tr("Ingresos")}</button>
                  <button onClick={() => toggleChartFilter("egresos")} className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold transition-colors",
                    chartFilter.has("egresos") ? "bg-red-500/20 text-red-500" : "bg-muted/30 text-muted-foreground")}>{tr("Egresos")}</button>
                </div>
              </div>

              {chartData.length > 0 ? (
                <div className="h-[220px] lg:h-[280px] bg-card">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ingresosGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="egresosGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" tickFormatter={v => tr("${0}k", [(v / 1000).toFixed(0)])} />
                      <Tooltip content={<CustomTooltip formatAmount={formatAmount} />} />
                      {chartFilter.has("balance") && (
                        <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2} fill="url(#balanceGradient)" name="Balance neto" />
                      )}
                      {chartFilter.has("ingresos") && (
                        <Area type="monotone" dataKey="ingresos" stroke="#34d399" strokeWidth={1.5} fill="url(#ingresosGradient)" strokeDasharray="4 2" name="Ingresos" />
                      )}
                      {chartFilter.has("egresos") && (
                        <Area type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={1.5} fill="url(#egresosGradient)" strokeDasharray="4 2" name="Egresos" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">{tr("Registra ingresos y pagos para ver tu evolución")}</div>
              )}
            </CardContent>
          </Card>

          {/* ═══ DISTRIBUCIÓN POR CATEGORÍA + INGRESOS VS EGRESOS ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Mismo componente que el Dashboard (ver CategoryDistributionCard). */}
            <CategoryDistributionCard verMas={{ href: "/gestion", label: tr("Ver presupuesto") }} />

            <Card className="border-none bg-card shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <h2 className="font-bold text-sm mb-3">{tr("Ingresos vs Egresos")}</h2>
                {chartData.length > 0 ? (
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip content={<CustomTooltip formatAmount={formatAmount} />} />
                        {/* Sin esto, con un solo periodo de datos (ej. un único
                            día con gastos y $0 de ingresos) la barra de egresos
                            se ve como un bloque sólido sin ninguna referencia de
                            qué representa cada color. */}
                        <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} iconType="circle" />
                        <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[150px] flex items-center justify-center text-muted-foreground text-xs">{tr("Sin movimientos en este periodo")}</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ MINI STATS ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <MiniStat icon={<Trophy className="h-4 w-4 text-emerald-500" />} label={tr("Promedio diario")} value={formatAmount(stats.promedio)} />
            {/* Son los totales del periodo elegido (antes decían "Mayor ingreso /
                egreso" y salía un "mayor ingreso" más alto que el total recibido) */}
            <MiniStat icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />} label={tr("Ingresos del periodo")} value={`+${formatAmount(stats.mayorAumento)}`} color="text-emerald-500" />
            <MiniStat icon={<ArrowDownRight className="h-4 w-4 text-red-500" />} label={tr("Egresos del periodo")} value={formatAmount(stats.mayorDisminucion)} color="text-red-500" />
            {stats.meta > 0 && (
              <MiniStat icon={<Target className="h-4 w-4 text-cyclon-lavender" />} label={tr("Meta de ahorro")} value={formatAmount(stats.meta)} extra={
                <div className="flex items-center gap-1.5 mt-1">
                  <Progress value={stats.metaPct} className="h-1.5 flex-1" indicatorClassName="bg-cyclon-lavender" />
                  <span className="text-[9px] font-bold text-cyclon-lavender">{stats.metaPct}%</span>
                </div>
              } />
            )}
          </div>

          {/* ═══ RESUMEN DE DEUDAS + COMPARACIÓN ═══ */}
          {s && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Resumen de deudas */}
              <Card className="border-none bg-card shadow-sm rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-bold">{tr("Resumen de deudas")}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">{tr("Total de deudas")}</p>
                      <p className="text-sm font-black">{formatAmount(debts.reduce((a, d) => a + d.montoTotal, 0))}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">{tr("Saldo restante")}</p>
                      <p className="text-sm font-black text-red-500">{formatAmount(debts.reduce((a, d) => a + d.saldoRestante, 0))}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">{tr("Interés pagado (periodo)")}</p>
                      <p className="text-sm font-black text-amber-500">{formatAmount(s.totalInteresPagado)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">{tr("Capital abonado")}</p>
                      <p className="text-sm font-black text-emerald-500">{formatAmount(s.totalCapitalAbonado)}</p>
                    </div>
                  </div>
                  {debts.length > 0 && (
                    <Progress
                      value={Math.round(((debts.reduce((a, d) => a + d.montoTotal, 0) - debts.reduce((a, d) => a + d.saldoRestante, 0)) / Math.max(1, debts.reduce((a, d) => a + d.montoTotal, 0))) * 100)}
                      className="h-2"
                      indicatorClassName="bg-emerald-500"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Comparación vs mes anterior */}
              {report?.monthlySeries && report.monthlySeries.length >= 2 && (() => {
                const current = report.monthlySeries[report.monthlySeries.length - 1]
                const previous = report.monthlySeries[report.monthlySeries.length - 2]
                const ingresosChange = previous.ingresos > 0 ? ((current.ingresos - previous.ingresos) / previous.ingresos) * 100 : 0
                const egresosChange = previous.egresos > 0 ? ((current.egresos - previous.egresos) / previous.egresos) * 100 : 0
                return (
                  <Card className="border-none bg-card shadow-sm rounded-2xl">
                    <CardContent className="p-4 space-y-3">
                      <h3 className="text-sm font-bold">{tr("Comparación vs mes anterior")}</h3>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{tr("Ingresos")}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{formatAmount(current.ingresos)}</span>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                              ingresosChange >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                            )}>
                              {ingresosChange >= 0 ? '↑' : '↓'}{Math.abs(ingresosChange).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{tr("Egresos")}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{formatAmount(current.egresos)}</span>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                              egresosChange <= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                            )}>
                              {egresosChange >= 0 ? '↑' : '↓'}{Math.abs(egresosChange).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-xs font-bold">{tr("Balance neto")}</span>
                          <span className={cn("text-sm font-black",
                            (current.ingresos - current.egresos) >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            {formatAmount(current.ingresos - current.egresos)}
                          </span>
                        </div>
                        <p className="text-[9px] text-muted-foreground">{tr("Mes anterior: {0}", [formatAmount(previous.ingresos - previous.egresos)])}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}
            </div>
          )}

          {/* ═══ BANNER MOTIVACIONAL ═══ */}
          {s && (
            <Card className="border-none bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/10 rounded-2xl">
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-3xl shrink-0">🌱</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">{tr("Resumen del mes")}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {balanceNeto > 0
                      ? tr("Tu saldo neto aumentó. Has ahorrado {0} este periodo. ¡Vas por buen camino! 💚", [formatAmount(ahorroDelPeriodo)])
                      : tr("Registra un ingreso para comenzar a construir tu balance positivo.")}
                  </p>
                </div>
                {/* Mini stats del resumen */}
                <div className="hidden lg:flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <p className="text-xs font-black text-emerald-500">+{formatAmount(ingresosTotales)}</p>
                    <p className="text-[8px] text-muted-foreground">{tr("Ingresos")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-red-500">-{formatAmount(egresosTotales)}</p>
                    <p className="text-[8px] text-muted-foreground">{tr("Egresos")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-cyclon-lavender">{formatAmount(ahorroDelPeriodo)}</p>
                    <p className="text-[8px] text-muted-foreground">{tr("Ahorrado")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
    </>
    </FeatureGate>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, formatAmount, icon, sub }: {
  label: string; value: number; color: string
  formatAmount: (n: number) => string; icon: React.ReactNode; sub?: string
}) {
  const animated = useCountUp(value)
  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-4 space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <span className={color}>{icon}</span> {label}
        </p>
        <p className={cn("text-xl lg:text-2xl font-black tabular-nums", color)}>{formatAmount(Math.round(animated))}</p>
        {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function MiniStat({ icon, label, value, color, extra }: { icon: React.ReactNode; label: string; value: string; color?: string; extra?: React.ReactNode }) {
  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-3 flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
          <p className={cn("text-sm font-black", color)}>{value}</p>
          {extra}
        </div>
      </CardContent>
    </Card>
  )
}

function CustomTooltip({ active, payload, formatAmount }: { active?: boolean; payload?: { value: number; dataKey?: string; name?: string; color?: string }[]; label?: string; formatAmount: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg space-y-1">
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[10px] text-muted-foreground">{p.name || p.dataKey}:</span>
          <span className={cn("text-xs font-black", p.dataKey === "egresos" ? "text-red-500" : "text-emerald-500")}>{formatAmount(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateShort(iso: string | undefined | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString(localeFecha(), { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return String(iso) }
}
