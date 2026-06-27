"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, Legend, ResponsiveContainer,
} from "recharts"
import {
  BookOpen, TrendingUp, TrendingDown, Wallet,
  Coffee, ReceiptText, PiggyBank, Zap, CheckCircle2, XCircle,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { reportsApi, type BalanceReport, type Timeframe } from "@/lib/api-client"
import { ExportButtons } from "@/components/balance/ExportButtons"

// ─── Tipos de filtro ──────────────────────────────────────────────────────────

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "week",  label: "Semana" },
  { value: "month", label: "Mes"    },
  { value: "year",  label: "Año"    },
  { value: "all",   label: "Todo"   },
]

// ─── Colores del gráfico ──────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  "Deudas":         "#8096E6",
  "Gastos Fijos":   "#A2D2FF",
  "Gastos Hormiga": "#FFB3C6",
  "Ahorro":         "#B9FBC0",
}

// ─── Tab secundarios del historial ───────────────────────────────────────────

type HistoryTab = "gastos_hormiga" | "ahorro" | "ingresos_extra" | "deudas" | "gastos_fijos"

const HISTORY_TABS: { value: HistoryTab; label: string; icon: React.ReactNode }[] = [
  { value: "gastos_hormiga",  label: "Hormiga",  icon: <Coffee className="h-3.5 w-3.5" /> },
  { value: "ahorro",          label: "Ahorro",   icon: <PiggyBank className="h-3.5 w-3.5" /> },
  { value: "ingresos_extra",  label: "Extras",   icon: <Zap className="h-3.5 w-3.5" /> },
  { value: "deudas",          label: "Deudas",   icon: <ReceiptText className="h-3.5 w-3.5" /> },
  { value: "gastos_fijos",    label: "Fijos",    icon: <Wallet className="h-3.5 w-3.5" /> },
]

// ─── Página ───────────────────────────────────────────────────────────────────

export default function BalancePage() {
  const { formatAmount } = useAppContext()

  const [timeframe, setTimeframe] = useState<Timeframe>("month")
  const [report, setReport] = useState<BalanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyTab, setHistoryTab] = useState<HistoryTab>("gastos_hormiga")

  const fetchReport = useCallback(async (tf: Timeframe) => {
    setLoading(true)
    const { data, error } = await reportsApi.getBalance(tf)
    if (!error && data) setReport(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchReport(timeframe) }, [timeframe, fetchReport])

  const s = report?.summary

  // ── Tooltip personalizado para el Bar Chart ──────────────────────────────
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: { name: string; value: number; fill: string }[]
    label?: string
  }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border border-border rounded-xl shadow-xl px-4 py-3 text-xs space-y-1">
        <p className="font-bold text-muted-foreground mb-1">{label}</p>
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
              <span>{p.name}</span>
            </div>
            <span className="font-bold ml-4">{formatAmount(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">

      {/* ── Encabezado ── */}
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-cyclon-lavender flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Balance
          </h1>
          <p className="text-muted-foreground text-sm">Libro mayor de tu actividad financiera.</p>
        </div>
        <ExportButtons report={report} />
      </header>

      {/* ── Filtro de tiempo ── */}
      <div className="grid grid-cols-4 gap-2">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={cn(
              "h-10 rounded-xl text-xs font-bold border-2 transition-colors",
              timeframe === tf.value
                ? "bg-cyclon-lavender text-white border-cyclon-lavender"
                : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
            )}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded-3xl" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Tarjetas de resumen ── */}
          {s && (
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-none bg-cyclon-mint/10 rounded-3xl shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpRight className="h-4 w-4 text-cyclon-mint" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ingresos</span>
                  </div>
                  <p className="text-2xl font-black text-cyclon-periwinkle">{formatAmount(s.totalIngreso)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Base {formatAmount(s.ingresoBase)} + Extras {formatAmount(s.totalExtra)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none bg-cyclon-pink/10 rounded-3xl shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownRight className="h-4 w-4 text-cyclon-pink" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Egresos</span>
                  </div>
                  <p className="text-2xl font-black text-cyclon-periwinkle">{formatAmount(s.totalEgreso)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Deudas + Fijos + Hormiga + Ahorro
                  </p>
                </CardContent>
              </Card>

              {/* Barra de balance neto (ocupa todo el ancho) */}
              <Card className="col-span-2 border-none bg-card shadow-sm rounded-3xl">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">Balance neto del periodo</span>
                    <span className={cn(
                      "text-sm font-black",
                      s.totalIngreso >= s.totalEgreso ? "text-cyclon-mint" : "text-cyclon-pink"
                    )}>
                      {s.totalIngreso >= s.totalEgreso ? "+" : ""}
                      {formatAmount(s.totalIngreso - s.totalEgreso)}
                    </span>
                  </div>
                  <Progress
                    value={s.totalIngreso > 0
                      ? Math.min((s.totalIngreso - s.totalEgreso) / s.totalIngreso * 100 + 50, 100)
                      : 50
                    }
                    className="h-2"
                    indicatorClassName={s.totalIngreso >= s.totalEgreso ? "bg-cyclon-mint" : "bg-cyclon-pink"}
                  />
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[
                      { label: "Deudas",    val: s.totalDebts,   color: "text-cyclon-periwinkle" },
                      { label: "Fijos",     val: s.totalFixed,   color: "text-cyclon-sky" },
                      { label: "Hormiga",   val: s.totalImpulse, color: "text-cyclon-pink" },
                      { label: "Ahorro",    val: s.totalSaved,   color: "text-cyclon-mint" },
                    ].map(item => (
                      <div key={item.label} className="text-center">
                        <p className={cn("text-xs font-black", item.color)}>{formatAmount(item.val)}</p>
                        <p className="text-[9px] text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Gráfico de Pastel ── */}
          {report && report.categoryDistribution.length > 0 && (
            <Card className="border-none bg-card shadow-sm rounded-3xl">
              <CardContent className="p-5 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-cyclon-lavender" />
                  Distribución de gastos por categoría
                </h3>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={report.categoryDistribution}
                          innerRadius={48}
                          outerRadius={72}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {report.categoryDistribution.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.color ?? CAT_COLORS[entry.name] ?? "#ccc"}
                              stroke="none"
                            />
                          ))}
                        </Pie>
                        <ChartTooltip
                          formatter={(v: number, name: string) => [formatAmount(v), name]}
                          contentStyle={{ borderRadius: 12, fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {report.categoryDistribution.map(item => {
                      const total = report.categoryDistribution.reduce((a, c) => a + c.value, 0)
                      const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                      return (
                        <div key={item.name} className="space-y-0.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-[10px] font-bold text-muted-foreground truncate">{item.name}</span>
                            </div>
                            <span className="text-[10px] font-black">{pct}%</span>
                          </div>
                          <Progress
                            value={pct}
                            className="h-1"
                            indicatorClassName="transition-all"
                            style={{ '--indicator-color': item.color } as React.CSSProperties}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Gráfico de Barras: Ingresos vs Egresos por mes ── */}
          {report && report.monthlySeries.length > 0 && (
            <Card className="border-none bg-card shadow-sm rounded-3xl">
              <CardContent className="p-5 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyclon-lavender" />
                  Ingresos vs Egresos por periodo
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.monthlySeries}
                      barGap={2}
                      barCategoryGap="30%"
                      margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 9, fill: '#888' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: '#888' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <ChartTooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                        iconType="circle"
                        iconSize={8}
                      />
                      <Bar dataKey="ingresos" name="Ingresos" fill="#B9FBC0" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="egresos"  name="Egresos"  fill="#FFB3C6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Historial detallado (tabs) ── */}
          {report && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Historial detallado
              </h3>

              {/* Sub-tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {HISTORY_TABS.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setHistoryTab(tab.value)}
                    className={cn(
                      "flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold border-2 shrink-0 transition-colors",
                      historyTab === tab.value
                        ? "bg-cyclon-lavender text-white border-cyclon-lavender"
                        : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Gastos Hormiga */}
              {historyTab === "gastos_hormiga" && (
                <HistoryList
                  items={report.impulseExpenses}
                  emptyMsg="Sin gastos hormiga en este periodo"
                  renderRow={(e) => ({
                    icon: "☕",
                    title: e.nombre as string,
                    subtitle: `${e.categoria as string} · ${fmtDate(e.createdAt as string)}`,
                    amount: -(e.monto as number),
                    formatAmount,
                  })}
                />
              )}

              {/* Ahorro */}
              {historyTab === "ahorro" && (
                <HistoryList
                  items={report.savingsHistory}
                  emptyMsg="Sin registros de ahorro en este periodo"
                  renderRow={(e) => ({
                    icon: (e.tipo as string) === "ahorro" ? "✅" : "⏭️",
                    title: (e.tipo as string) === "ahorro"
                      ? `Ahorro · ${e.periodo as string}`
                      : `Sin ahorro · ${e.periodo as string}`,
                    subtitle: fmtDate(e.createdAt as string),
                    amount: (e.tipo as string) === "ahorro" ? -(e.monto as number) : 0,
                    formatAmount,
                  })}
                />
              )}

              {/* Ingresos extra */}
              {historyTab === "ingresos_extra" && (
                <HistoryList
                  items={report.extraIncomes}
                  emptyMsg="Sin ingresos extra en este periodo"
                  renderRow={(e) => ({
                    icon: "⚡",
                    title: e.nombre as string,
                    subtitle: `${e.temporalidad as string} · ${fmtDate(e.createdAt as string)}`,
                    amount: e.monto as number,
                    formatAmount,
                  })}
                />
              )}

              {/* Deudas */}
              {historyTab === "deudas" && (
                <HistoryList
                  items={report.debts}
                  emptyMsg="Sin deudas registradas"
                  renderRow={(d) => ({
                    icon: (d.pagadoEstePeriodo as boolean) ? "✅" : "🔴",
                    title: d.nombre as string,
                    subtitle: `Vence: ${d.fechaVencimiento as string}  ·  Total: ${formatAmount(d.montoTotal as number)}`,
                    amount: -(d.cuotaPeriodo as number),
                    formatAmount,
                    faded: !(d.pagadoEstePeriodo as boolean),
                  })}
                />
              )}

              {/* Gastos fijos */}
              {historyTab === "gastos_fijos" && (
                <HistoryList
                  items={report.fixedExpenses}
                  emptyMsg="Sin gastos fijos registrados"
                  renderRow={(f) => ({
                    icon: (f.pagadoEstePeriodo as boolean) ? "✅" : "⏳",
                    title: f.nombre as string,
                    subtitle: `Corte: ${f.fechaCorte as string}`,
                    amount: -(f.monto as number),
                    formatAmount,
                    faded: !(f.pagadoEstePeriodo as boolean),
                  })}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return String(iso) }
}

// ─── HistoryList ──────────────────────────────────────────────────────────────

interface RowConfig {
  icon: string
  title: string
  subtitle: string
  amount: number
  formatAmount: (n: number) => string
  faded?: boolean
}

function HistoryList({
  items,
  emptyMsg,
  renderRow,
}: {
  items: Record<string, unknown>[]
  emptyMsg: string
  renderRow: (item: Record<string, unknown>) => RowConfig
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">{emptyMsg}</p>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const row = renderRow(item)
        const isPositive = row.amount > 0
        const isZero = row.amount === 0
        return (
          <div
            key={(item.id as string) ?? i}
            className={cn(
              "flex items-center gap-3 bg-card rounded-2xl px-4 py-3 shadow-sm",
              row.faded && "opacity-50"
            )}
          >
            <span className="text-lg shrink-0">{row.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{row.title}</p>
              <p className="text-[10px] text-muted-foreground">{row.subtitle}</p>
            </div>
            <span className={cn(
              "font-black text-sm shrink-0",
              isZero     ? "text-muted-foreground" :
              isPositive ? "text-cyclon-mint"      : "text-cyclon-pink"
            )}>
              {isZero ? "—" :
               isPositive
                ? `+${row.formatAmount(row.amount)}`
                : row.formatAmount(Math.abs(row.amount))
              }
            </span>
          </div>
        )
      })}
    </div>
  )
}
