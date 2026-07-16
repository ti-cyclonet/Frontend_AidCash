"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  BookOpen, TrendingUp, TrendingDown, Trash2, Calendar,
  Coffee, ReceiptText, PiggyBank, ArrowUpRight, ArrowDownRight,
  Trophy, AlertTriangle, BarChart3, Target, Sparkles, ChevronRight,
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { reportsApi, userApi, type BalanceReport, type Timeframe, type WalletState } from "@/lib/api-client"
import { ExportButtons } from "@/components/balance/ExportButtons"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "week",  label: "Semana" },
  { value: "month", label: "Mes"    },
  { value: "year",  label: "Año"    },
  { value: "all",   label: "Todo"   },
]

type HistoryTab = "ingresos" | "obligaciones" | "ahorro" | "gastos_hormiga"
type IngresoFilter = "todos" | "sueldo" | "extra"
type ObligacionFilter = "todos" | "deudas" | "fijos"

const HISTORY_TABS: { value: HistoryTab; label: string; icon: React.ReactNode }[] = [
  { value: "ingresos",       label: "Ingresos",      icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { value: "obligaciones",   label: "Obligaciones",  icon: <ReceiptText className="h-3.5 w-3.5" /> },
  { value: "ahorro",         label: "Ahorro",        icon: <PiggyBank className="h-3.5 w-3.5" /> },
  { value: "gastos_hormiga", label: "Hormiga",       icon: <Coffee className="h-3.5 w-3.5" /> },
]

export default function BalancePage() {
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("balance")
  const { formatAmount, metaAhorro } = useAppContext()
  const { debts, fixedExpenses } = useFinanceData()

  const [timeframe, setTimeframe] = useState<Timeframe>("month")
  const [report, setReport] = useState<BalanceReport | null>(null)
  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  const [loading, setLoading] = useState(true)
  const [historyTab, setHistoryTab] = useState<HistoryTab>("ingresos")
  const [ingresoFilter, setIngresoFilter] = useState<IngresoFilter>("todos")
  const [obligacionFilter, setObligacionFilter] = useState<ObligacionFilter>("todos")
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

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

  // Meta real de ahorro: suma de metas de los bolsillos de ahorro
  const [realSavingsMeta, setRealSavingsMeta] = useState(0)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("kiri_saving_pockets")
      if (raw) {
        const pockets = JSON.parse(raw) as { meta: number }[]
        setRealSavingsMeta(pockets.reduce((a, p) => a + (p.meta || 0), 0))
      }
    } catch {}
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
    <>
      {showTutorial && <TutorialSlider module="balance" onClose={dismissTutorial} />}
    <div className="space-y-6 pb-10">
      {/* ═══ HEADER ═══ */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Balance
          </h1>
          <p className="text-muted-foreground text-sm">Tu libro mayor financiero en tiempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro de tiempo */}
          <div className="flex bg-muted/30 rounded-xl p-1">
            {TIMEFRAMES.map(tf => (
              <button key={tf.value} onClick={() => setTimeframe(tf.value)} className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-colors",
                timeframe === tf.value ? "bg-kiri-emerald text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{tf.label}</button>
            ))}
          </div>
          {/* Rango de fechas */}
          {dateRange && (
            <span className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
              <Calendar className="h-3.5 w-3.5" /> {dateRange}
            </span>
          )}
          {/* Reiniciar balance */}
          <button onClick={() => setResetConfirmOpen(true)}
            className="h-8 px-3 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1">
            <Trash2 className="h-3 w-3" /> Reiniciar
          </button>
        </div>
      </header>

      {/* Confirm reset */}
      {resetConfirmOpen && (
        <Card className="border-2 border-destructive/30 bg-destructive/5 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-destructive">¿Reiniciar historial del balance?</p>
              <p className="text-[10px] text-muted-foreground">Se borrarán los registros de ingresos, ahorro y gastos hormiga del historial. Tu saldo real y obligaciones no se tocan.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setResetConfirmOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted">Cancelar</button>
              <button onClick={handleResetBalance} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-destructive text-white hover:bg-destructive/90">Confirmar</button>
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

          {/* ═══ 4 TARJETAS MÉTRICAS ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Balance neto actual" value={formatAmount(balanceNeto)} color="text-emerald-500" trend={s ? `${((balanceNeto / Math.max(ingresosTotales, 1)) * 100).toFixed(1)}% de ingresos` : undefined} positive />
            <MetricCard label="Ingresos totales" value={formatAmount(ingresosTotales)} color="text-emerald-500" />
            <MetricCard label="Egresos totales" value={formatAmount(egresosTotales)} color="text-red-500" />
            <MetricCard label="Ahorro del período" value={formatAmount(ahorroDelPeriodo)} color="text-cyclon-lavender" trend={ingresosTotales > 0 ? `${Math.round((ahorroDelPeriodo / ingresosTotales) * 100)}% de tus ingresos` : undefined} />
          </div>

          {/* ═══ GRÁFICA DE EVOLUCIÓN ═══ */}
          <Card className="border-none bg-card shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-sm flex items-center gap-2">
                    Evolución de tu balance
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Así ha cambiado tu balance neto en el período seleccionado.</p>
                </div>
                {/* Filtros de gráfica: seleccionar qué líneas ver */}
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleChartFilter("balance")} className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold transition-colors flex items-center gap-1",
                    chartFilter.has("balance") ? "bg-emerald-500/20 text-emerald-500" : "bg-muted/30 text-muted-foreground")}>
                    <BarChart3 className="h-3 w-3" /> Balance
                  </button>
                  <button onClick={() => toggleChartFilter("ingresos")} className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold transition-colors",
                    chartFilter.has("ingresos") ? "bg-emerald-500/20 text-emerald-500" : "bg-muted/30 text-muted-foreground")}>
                    Ingresos
                  </button>
                  <button onClick={() => toggleChartFilter("egresos")} className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold transition-colors",
                    chartFilter.has("egresos") ? "bg-red-500/20 text-red-500" : "bg-muted/30 text-muted-foreground")}>
                    Egresos
                  </button>
                </div>
              </div>

              {chartData.length > 0 ? (
                <div className="h-[220px] lg:h-[280px]">
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
                      <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
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
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  Registra ingresos y pagos para ver tu evolución
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ MINI STATS ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <MiniStat icon={<Trophy className="h-4 w-4 text-emerald-500" />} label="Promedio diario" value={formatAmount(stats.promedio)} />
            <MiniStat icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />} label="Mayor ingreso" value={`+${formatAmount(stats.mayorAumento)}`} color="text-emerald-500" />
            <MiniStat icon={<ArrowDownRight className="h-4 w-4 text-red-500" />} label="Mayor egreso" value={formatAmount(stats.mayorDisminucion)} color="text-red-500" />
            {stats.meta > 0 && (
              <MiniStat icon={<Target className="h-4 w-4 text-cyclon-lavender" />} label="Meta de ahorro" value={formatAmount(stats.meta)} extra={
                <div className="flex items-center gap-1.5 mt-1">
                  <Progress value={stats.metaPct} className="h-1.5 flex-1" indicatorClassName="bg-cyclon-lavender" />
                  <span className="text-[9px] font-bold text-cyclon-lavender">{stats.metaPct}%</span>
                </div>
              } />
            )}
          </div>

          {/* ═══ BANNER MOTIVACIONAL ═══ */}
          {s && (
            <Card className="border-none bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/10 rounded-2xl">
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-3xl shrink-0">🌱</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                    {balanceNeto > 0 ? "¡Vas por buen camino! 🌿" : "Sigue adelante 💪"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {balanceNeto > 0
                      ? `Tu balance neto es positivo. Has ahorrado ${formatAmount(ahorroDelPeriodo)} este periodo.`
                      : "Registra un ingreso para comenzar a construir tu balance positivo."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ HISTORIAL DETALLADO ═══ */}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Historial detallado</h3>
                <ExportButtons report={report} />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {HISTORY_TABS.map(tab => (
                  <button key={tab.value} onClick={() => setHistoryTab(tab.value)} className={cn(
                    "flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold border-2 shrink-0 transition-colors",
                    historyTab === tab.value ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
                  )}>{tab.icon}{tab.label}</button>
                ))}
              </div>

              {historyTab === "ingresos" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(["todos", "sueldo", "extra"] as IngresoFilter[]).map(f => (
                      <button key={f} onClick={() => setIngresoFilter(f)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
                        ingresoFilter === f ? "bg-emerald-600 text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                        {f === "todos" ? "Todos" : f === "sueldo" ? "Sueldo" : "Extra"}
                      </button>
                    ))}
                  </div>
                  <HistoryList items={(report.incomeRecords ?? []).filter(r => {
                    if (ingresoFilter === "todos") return true
                    return (r.tipo as string) === (ingresoFilter === "sueldo" ? "salario" : "extra")
                  })} emptyMsg="Sin ingresos registrados" renderRow={(r) => ({
                    icon: (r.tipo as string) === "salario" ? "💰" : "⚡",
                    title: (r.tipo as string) === "salario" ? "Sueldo" : "Ingreso Extra",
                    subtitle: `${(r.tipo as string) === "salario" ? "Salario" : "Extra"} · ${fmtDate(r.createdAt as string)}`,
                    amount: r.monto as number, formatAmount,
                  })} onDelete={async (id) => { await reportsApi.deleteIncomeRecord(id); fetchReport(timeframe) }} />
                </div>
              )}

              {historyTab === "obligaciones" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(["todos", "deudas", "fijos"] as ObligacionFilter[]).map(f => (
                      <button key={f} onClick={() => setObligacionFilter(f)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
                        obligacionFilter === f ? "bg-cyclon-periwinkle text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                        {f === "todos" ? "Todos" : f === "deudas" ? "Deudas" : "Gastos Fijos"}
                      </button>
                    ))}
                  </div>
                  {/* Pagos de deudas (con historial real de debtPayments) */}
                  {(obligacionFilter === "todos" || obligacionFilter === "deudas") && (
                    <HistoryList items={report.debtPayments ?? []} emptyMsg="Sin pagos de deudas en este periodo" renderRow={(p) => ({
                      icon: "💳",
                      title: p.debtName as string,
                      subtitle: `Deuda · ${fmtDate(p.createdAt as string)} · Capital: ${formatAmount(p.abonoCapital as number)} · Interés: ${formatAmount(p.pagoInteres as number)}`,
                      amount: -(p.montoPagado as number),
                      formatAmount,
                    })} />
                  )}
                  {/* Gastos fijos pagados */}
                  {(obligacionFilter === "todos" || obligacionFilter === "fijos") && (
                    <HistoryList items={report.fixedExpenses.filter(f => f.pagadoEstePeriodo as boolean)} emptyMsg="Sin gastos fijos pagados este periodo" renderRow={(f) => ({
                      icon: "✅",
                      title: f.nombre as string,
                      subtitle: `Gasto Fijo · Corte: ${f.fechaCorte as string} · ${(f as any).frecuencia === "quincenal" ? "Quincenal" : "Mensual"}`,
                      amount: -(((f as any).montoPagadoEstePeriodo ?? (f.monto as number))),
                      formatAmount,
                    })} />
                  )}
                </div>
              )}

              {historyTab === "ahorro" && (
                <HistoryList items={report.savingsHistory} emptyMsg="Sin registros de ahorro" renderRow={(e) => ({
                  icon: (e.tipo as string) === "ahorro" ? "✅" : "⏭️",
                  title: (e.tipo as string) === "ahorro" ? `Ahorro · ${e.periodo as string}` : `Sin ahorro · ${e.periodo as string}`,
                  subtitle: fmtDate(e.createdAt as string),
                  amount: (e.tipo as string) === "ahorro" ? -(e.monto as number) : 0, formatAmount,
                })} onDelete={async (id) => { await reportsApi.deleteSavingsRecord(id); fetchReport(timeframe) }} />
              )}

              {historyTab === "gastos_hormiga" && (
                <HistoryList items={report.impulseExpenses} emptyMsg="Sin gastos hormiga" renderRow={(e) => ({
                  icon: "☕", title: e.nombre as string,
                  subtitle: `${e.categoria as string} · ${fmtDate(e.createdAt as string)}`,
                  amount: -(e.monto as number), formatAmount,
                })} />
              )}
            </div>
          )}
        </>
      )}
    </div>
    </>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function MetricCard({ label, value, color, trend, positive }: { label: string; value: string; color: string; trend?: string; positive?: boolean }) {
  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-4 space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn("text-xl lg:text-2xl font-black", color)}>{value}</p>
        {trend && (
          <p className={cn("text-[9px] font-medium flex items-center gap-1", positive ? "text-emerald-500" : "text-muted-foreground")}>
            {positive && <ArrowUpRight className="h-3 w-3" />}
            {trend}
          </p>
        )}
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

function CustomTooltip({ active, payload, formatAmount }: { active?: boolean; payload?: { value: number; dataKey: string; name?: string; color?: string }[]; label?: string; formatAmount: (n: number) => string }) {
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

// ─── History List ─────────────────────────────────────────────────────────────

interface RowConfig {
  icon: string; title: string; subtitle: string; amount: number
  formatAmount: (n: number) => string; faded?: boolean
}

function HistoryList({ items, emptyMsg, renderRow, onDelete }: {
  items: Record<string, unknown>[]; emptyMsg: string
  renderRow: (item: Record<string, unknown>) => RowConfig
  onDelete?: (id: string) => void
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{emptyMsg}</p>
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const row = renderRow(item)
        const isPositive = row.amount > 0
        const isZero = row.amount === 0
        const id = item.id as string
        return (
          <div key={id ?? i} className={cn("flex items-center gap-3 bg-card rounded-2xl px-4 py-3 shadow-sm", row.faded && "opacity-50")}>
            <span className="text-lg shrink-0">{row.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{row.title}</p>
              <p className="text-[10px] text-muted-foreground">{row.subtitle}</p>
            </div>
            <span className={cn("font-black text-sm shrink-0", isZero ? "text-muted-foreground" : isPositive ? "text-emerald-600" : "text-red-500")}>
              {isZero ? "—" : isPositive ? `+${row.formatAmount(row.amount)}` : row.formatAmount(Math.abs(row.amount))}
            </span>
            {onDelete && id && (
              <button onClick={() => onDelete(id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(iso) }
}

function fmtDateShort(iso: string | undefined | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return String(iso) }
}
