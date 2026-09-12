"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
  BookOpen, TrendingUp, TrendingDown, Trash2, Calendar,
  PiggyBank, ArrowUpRight, ArrowDownRight, CreditCard, ReceiptText,
  Trophy, BarChart3, Target, ChevronDown, Search, ShieldCheck, Percent,
  Home, Sparkles,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useCountUp } from "@/hooks/use-count-up"
import { useBudgetCategories } from "@/hooks/use-budget-categories"
import { getPeriodDateRange } from "@/lib/period-filter"
import { computeCategorySpend } from "@/lib/budget-category-spend"
import { reportsApi, userApi, type BalanceReport, type Timeframe, type WalletState, type Movement, type MovementType } from "@/lib/api-client"
import { ExportButtons } from "@/components/balance/ExportButtons"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"
import { FeatureGate } from "@/components/plan/feature-gate"
import Link from "next/link"

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "week",  label: "Semana" },
  { value: "month", label: "Mes"    },
  { value: "year",  label: "Año"    },
  { value: "all",   label: "Todo"   },
]

const MOVEMENT_FILTERS: { value: MovementType | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "deudas", label: "Deudas" },
  { value: "gastos_fijos", label: "Gastos Fijos" },
  { value: "hormiga", label: "Hormiga" },
  { value: "ingresos", label: "Ingresos" },
  { value: "ahorros", label: "Ahorros" },
]

// Color de acento (borde izquierdo + ícono) por tipo de movimiento en el historial.
const MOVEMENT_META: Record<MovementType, { color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  ingresos: { color: "#22c55e", icon: TrendingUp },
  deudas: { color: "#f97362", icon: CreditCard },
  gastos_fijos: { color: "#3b82f6", icon: Home },
  hormiga: { color: "#a855f7", icon: Sparkles },
  ahorros: { color: "#22d3ee", icon: PiggyBank },
}

export default function BalancePage() {
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("balance")
  const { formatAmount, metaAhorro, incomeFrequency, diasCobro } = useAppContext()
  const { debts, impulseExpenses, fixedExpenses } = useFinanceData()
  const { budgetCategories } = useBudgetCategories()

  const [timeframe, setTimeframe] = useState<Timeframe>("month")
  const [report, setReport] = useState<BalanceReport | null>(null)
  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  const [loading, setLoading] = useState(true)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  // Historial unificado — búsqueda + filtro por tipo
  const [movementFilter, setMovementFilter] = useState<MovementType | "todos">("todos")
  const [movementSearch, setMovementSearch] = useState("")
  const [expandedMovement, setExpandedMovement] = useState<string | null>(null)

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

  // Distribución por categoría — las categorías reales creadas en Presupuesto,
  // con el mismo cálculo de "gastado" (gastos hormiga por keyword/tag + gastos
  // fijos vinculados pagados, dentro del periodo actual mensual/quincenal) que
  // ya usa PresupuestoTab, para que el número coincida entre ambas pantallas.
  const periodRange = useMemo(() => getPeriodDateRange(incomeFrequency, diasCobro), [incomeFrequency, diasCobro])
  const impulseThisBudgetPeriod = useMemo(() => impulseExpenses.filter(e => {
    const created = new Date(e.createdAt)
    return created >= periodRange.start && created < periodRange.end
  }), [impulseExpenses, periodRange])

  const categoryData = useMemo(() => {
    return budgetCategories
      .map(cat => ({
        name: cat.name,
        value: computeCategorySpend(cat, impulseThisBudgetPeriod, fixedExpenses, debts),
        color: cat.color,
      }))
      .filter(c => c.value > 0)
  }, [budgetCategories, impulseThisBudgetPeriod, fixedExpenses, debts])
  const categoryTotal = categoryData.reduce((a, c) => a + c.value, 0)

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

  // ═══ Historial unificado — mismo movements[] que antes vivía en /historial ═══
  const allMovements = useMemo((): Movement[] => {
    if (!report) return []
    const movements: Movement[] = []

    for (const p of (report.debtPayments ?? [])) {
      movements.push({
        id: (p.id as string) ?? `dp-${Math.random()}`,
        fecha: p.createdAt as string,
        nombre: (p.debtName as string) ?? 'Deuda',
        tipo: "deudas",
        tipoLabel: "Pago de deuda",
        monto: p.montoPagado as number,
        estado: 'pagado',
        abonoCapital: p.abonoCapital as number,
        pagoInteres: p.pagoInteres as number,
        saldoAnterior: p.saldoAnterior as number,
        saldoPosterior: p.saldoPosterior as number,
        tasaInteres: p.tasaAplicada ? `${Number(p.tasaAplicada).toFixed(2)}% M.V.` : undefined,
        acreedor: p.acreedor as string | undefined,
        tarjetaNombre: p.tarjetaNombre as string | null | undefined,
      })
    }

    // Ledger real de pagos (fixedExpensePayments), acotado por el rango
    // pedido — antes esto se reconstruía desde fixedExpenses.pagadoEstePeriodo,
    // que SIEMPRE refleja el periodo actual sin importar qué rango se esté
    // viendo, así que un mes pasado mostraba "$0 en gastos fijos" aunque el
    // total del resumen sí los hubiera sumado.
    for (const p of (report.fixedExpensePayments ?? [])) {
      movements.push({
        id: (p.id as string) ?? `fep-${Math.random()}`,
        fecha: p.createdAt as string,
        nombre: p.nombre as string,
        tipo: "gastos_fijos",
        tipoLabel: "Gasto fijo",
        monto: p.montoPagado as number,
        estado: 'pagado',
        tarjetaNombre: p.tarjetaNombre as string | null | undefined,
      })
    }

    for (const e of report.impulseExpenses) {
      movements.push({
        id: e.id as string,
        fecha: e.createdAt as string,
        nombre: e.nombre as string,
        tipo: "hormiga",
        tipoLabel: `Gasto hormiga · ${e.categoria as string}`,
        monto: e.monto as number,
        estado: 'pagado',
        tarjetaNombre: e.tarjetaNombre as string | null | undefined,
      })
    }

    for (const r of (report.incomeRecords ?? [])) {
      movements.push({
        id: (r.id as string) ?? `ir-${Math.random()}`,
        fecha: r.createdAt as string,
        nombre: (r.tipo as string) === 'salario' ? 'Sueldo' : 'Ingreso extra',
        tipo: "ingresos",
        tipoLabel: (r.tipo as string) === 'salario' ? 'Salario' : 'Extra',
        monto: r.monto as number,
        estado: 'pagado',
      })
    }

    for (const sv of report.savingsHistory) {
      const tipoSv = sv.tipo as string
      if (tipoSv === 'ahorro') {
        movements.push({
          id: sv.id as string,
          fecha: sv.createdAt as string,
          nombre: `Ahorro — ${sv.periodo as string}`,
          tipo: "ahorros",
          tipoLabel: "Ahorro",
          monto: sv.monto as number,
          estado: 'pagado',
        })
      } else if (tipoSv === 'retiro') {
        // Retirar de un bolsillo devuelve el dinero al saldo disponible —
        // antes esto no dejaba ningún rastro en el historial (el retiro era
        // real, pero invisible en Balance/PDF).
        movements.push({
          id: sv.id as string,
          fecha: sv.createdAt as string,
          nombre: `Retiro de ahorro — ${sv.periodo as string}`,
          tipo: "ahorros",
          tipoLabel: "Retiro de ahorro",
          monto: sv.monto as number,
          estado: 'pagado',
          direccion: 'entrada',
        })
      }
    }

    return movements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [report])

  const filteredMovements = useMemo(() => {
    let result = allMovements
    if (movementFilter !== "todos") result = result.filter(m => m.tipo === movementFilter)
    if (movementSearch) {
      const q = movementSearch.toLowerCase()
      result = result.filter(m => m.nombre.toLowerCase().includes(q) || m.tipoLabel.toLowerCase().includes(q))
    }
    return result
  }, [allMovements, movementFilter, movementSearch])

  return (
    <FeatureGate feature="basicReports">
    <>
      {showTutorial && <TutorialSlider module="balance" onClose={dismissTutorial} />}
    <div className="space-y-6 pb-10">
      {/* ═══ HEADER ═══ */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Balance
          </h1>
          <p className="text-muted-foreground text-sm">Todo lo que pasa con tu plata, en un solo lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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

          {/* ═══ 6 TARJETAS KPI (animadas) ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Balance neto actual" value={balanceNeto} color="text-emerald-500" formatAmount={formatAmount} icon={<BarChart3 className="h-3.5 w-3.5" />} />
            <KpiCard label="Total recibido" value={ingresosTotales} color="text-emerald-500" formatAmount={formatAmount} icon={<TrendingUp className="h-3.5 w-3.5" />} />
            <KpiCard label="Total gastado" value={egresosTotales} color="text-red-500" formatAmount={formatAmount} icon={<TrendingDown className="h-3.5 w-3.5" />} />
            <KpiCard label="Ahorro del período" value={ahorroDelPeriodo} color="text-cyclon-lavender" formatAmount={formatAmount} icon={<PiggyBank className="h-3.5 w-3.5" />} />
            <KpiCard label="Interés pagado" value={interesPagado} color="text-amber-500" formatAmount={formatAmount} icon={<Percent className="h-3.5 w-3.5" />} />
            <KpiCard label="Interés evitado" value={interesEvitado} color="text-violet-500" formatAmount={formatAmount} icon={<ShieldCheck className="h-3.5 w-3.5" />} sub="Por tus abonos extra" />
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

          {/* ═══ DISTRIBUCIÓN POR CATEGORÍA + INGRESOS VS EGRESOS ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-none bg-card shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <h2 className="font-bold text-sm mb-3">Distribución por categoría</h2>
                {categoryData.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 items-center bg-card">
                    <div className="h-[150px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} paddingAngle={3}>
                            {categoryData.map((c, i) => <Cell key={i} fill={c.color} stroke="none" />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip formatAmount={formatAmount} />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[8px] text-muted-foreground">Total</span>
                        <span className="text-xs font-black">{formatAmount(categoryTotal)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {categoryData.map(c => (
                        <div key={c.name} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold truncate">{c.name}</p>
                            <p className="text-[9px] text-muted-foreground">{formatAmount(c.value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : budgetCategories.length === 0 ? (
                  <div className="h-[150px] flex flex-col items-center justify-center gap-2 text-center px-4">
                    <p className="text-muted-foreground text-xs">Aún no has creado categorías de presupuesto.</p>
                    <Link href="/gestion" className="text-[10px] font-bold text-kiri-emerald hover:underline">
                      Crear una categoría →
                    </Link>
                  </div>
                ) : (
                  <div className="h-[150px] flex items-center justify-center text-muted-foreground text-xs">
                    Sin gasto registrado en tus categorías este periodo
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none bg-card shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <h2 className="font-bold text-sm mb-3">Ingresos vs Egresos</h2>
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
                  <div className="h-[150px] flex items-center justify-center text-muted-foreground text-xs">
                    Sin movimientos en este periodo
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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

          {/* ═══ RESUMEN DE DEUDAS + COMPARACIÓN ═══ */}
          {s && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Resumen de deudas */}
              <Card className="border-none bg-card shadow-sm rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-bold">Resumen de deudas</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">Total de deudas</p>
                      <p className="text-sm font-black">{formatAmount(debts.reduce((a, d) => a + d.montoTotal, 0))}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">Saldo restante</p>
                      <p className="text-sm font-black text-red-500">{formatAmount(debts.reduce((a, d) => a + d.saldoRestante, 0))}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">Interés pagado (periodo)</p>
                      <p className="text-sm font-black text-amber-500">{formatAmount(s.totalInteresPagado)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] text-muted-foreground">Capital abonado</p>
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
                      <h3 className="text-sm font-bold">Comparación vs mes anterior</h3>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Ingresos</span>
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
                          <span className="text-xs text-muted-foreground">Egresos</span>
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
                          <span className="text-xs font-bold">Balance neto</span>
                          <span className={cn("text-sm font-black",
                            (current.ingresos - current.egresos) >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            {formatAmount(current.ingresos - current.egresos)}
                          </span>
                        </div>
                        <p className="text-[9px] text-muted-foreground">
                          Mes anterior: {formatAmount(previous.ingresos - previous.egresos)}
                        </p>
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
                  <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                    Resumen del mes
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {balanceNeto > 0
                      ? `Tu saldo neto aumentó. Has ahorrado ${formatAmount(ahorroDelPeriodo)} este periodo. ¡Vas por buen camino! 💚`
                      : "Registra un ingreso para comenzar a construir tu balance positivo."}
                  </p>
                </div>
                {/* Mini stats del resumen */}
                <div className="hidden lg:flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <p className="text-xs font-black text-emerald-500">+{formatAmount(ingresosTotales)}</p>
                    <p className="text-[8px] text-muted-foreground">Ingresos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-red-500">-{formatAmount(egresosTotales)}</p>
                    <p className="text-[8px] text-muted-foreground">Egresos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-cyclon-lavender">{formatAmount(ahorroDelPeriodo)}</p>
                    <p className="text-[8px] text-muted-foreground">Ahorrado</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ HISTORIAL UNIFICADO ═══ */}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Historial de movimientos</h3>
                <ExportButtons report={report} />
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, acreedor, tipo..."
                  value={movementSearch}
                  onChange={e => setMovementSearch(e.target.value)}
                  className="h-11 rounded-xl pl-10"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {MOVEMENT_FILTERS.map(f => (
                  <button key={f.value} onClick={() => setMovementFilter(f.value)} className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold shrink-0 border-2 transition-colors",
                    movementFilter === f.value ? "bg-cyclon-lavender text-white border-cyclon-lavender" : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
                  )}>{f.label}</button>
                ))}
              </div>

              {filteredMovements.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ReceiptText className="h-12 w-12 mx-auto opacity-20 mb-3" />
                  <p className="text-sm">No hay movimientos que mostrar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMovements.map(m => {
                    const isExpanded = expandedMovement === m.id
                    const isIngreso = m.tipo === 'ingresos' || m.direccion === 'entrada'
                    const hasDetail = m.tipo === 'deudas' && m.abonoCapital != null
                    const meta = MOVEMENT_META[m.tipo]
                    const Icon = meta.icon

                    return (
                      <Card
                        key={m.id}
                        style={{ borderLeft: `3px solid ${meta.color}` }}
                        className={cn("border-y-0 border-r-0 bg-card shadow-sm rounded-2xl transition-all", hasDetail && "cursor-pointer hover:ring-1 hover:ring-cyclon-lavender/30")}
                        onClick={() => hasDetail && setExpandedMovement(isExpanded ? null : m.id)}
                      >
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}1a` }}>
                              <Icon className="h-4 w-4" style={{ color: meta.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{m.nombre}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {m.tipoLabel}
                                {m.acreedor && ` · ${m.acreedor}`}
                                {m.tarjetaNombre && ` · 💳 pagado con ${m.tarjetaNombre}`}
                                {' · '}
                                {m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn("text-sm font-black", isIngreso ? "text-emerald-500" : m.tipo === 'deudas' ? "text-red-500" : "text-foreground")}>
                                {isIngreso ? '+' : ''}{formatAmount(m.monto)}
                              </p>
                              {hasDetail && (
                                <p className="text-[8px] text-muted-foreground flex items-center gap-0.5 justify-end">
                                  <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", isExpanded && "rotate-180")} />
                                  {isExpanded ? 'Ocultar' : 'Ver detalle'}
                                </p>
                              )}
                            </div>
                          </div>

                          {isExpanded && hasDetail && (
                            <div className="bg-muted/10 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Capital pagado</p>
                                  <p className="text-xs font-black text-emerald-500">{formatAmount(m.abonoCapital!)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Intereses pagados</p>
                                  <p className="text-xs font-black text-red-500">{formatAmount(m.pagoInteres!)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Saldo anterior</p>
                                  <p className="text-xs font-bold">{formatAmount(m.saldoAnterior!)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-muted-foreground">Saldo actual</p>
                                  <p className="text-xs font-bold">{formatAmount(m.saldoPosterior!)}</p>
                                </div>
                              </div>
                              {m.tasaInteres && (
                                <p className="text-[9px] text-muted-foreground pt-1 border-t border-border/30">
                                  Interés aplicado: <span className="font-bold text-amber-500">{m.tasaInteres}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
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
  try { return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return String(iso) }
}
