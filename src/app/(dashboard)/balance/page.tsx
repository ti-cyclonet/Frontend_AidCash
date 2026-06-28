"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  BookOpen, TrendingUp, TrendingDown, Wallet,
  Coffee, ReceiptText, PiggyBank, Zap, ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { reportsApi, userApi, type BalanceReport, type Timeframe, type WalletState } from "@/lib/api-client"
import { ExportButtons } from "@/components/balance/ExportButtons"

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "week",  label: "Semana" },
  { value: "month", label: "Mes"    },
  { value: "year",  label: "Año"    },
  { value: "all",   label: "Todo"   },
]

type HistoryTab = "gastos_hormiga" | "ahorro" | "ingresos_extra" | "deudas" | "gastos_fijos"

const HISTORY_TABS: { value: HistoryTab; label: string; icon: React.ReactNode }[] = [
  { value: "gastos_hormiga",  label: "Hormiga",  icon: <Coffee className="h-3.5 w-3.5" /> },
  { value: "ahorro",          label: "Ahorro",   icon: <PiggyBank className="h-3.5 w-3.5" /> },
  { value: "ingresos_extra",  label: "Extras",   icon: <Zap className="h-3.5 w-3.5" /> },
  { value: "deudas",          label: "Deudas",   icon: <ReceiptText className="h-3.5 w-3.5" /> },
  { value: "gastos_fijos",    label: "Fijos",    icon: <Wallet className="h-3.5 w-3.5" /> },
]

export default function BalancePage() {
  const { formatAmount } = useAppContext()
  const { debts, fixedExpenses } = useFinanceData()

  const [timeframe, setTimeframe] = useState<Timeframe>("month")
  const [report, setReport] = useState<BalanceReport | null>(null)
  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  const [loading, setLoading] = useState(true)
  const [historyTab, setHistoryTab] = useState<HistoryTab>("gastos_hormiga")

  const fetchReport = useCallback(async (tf: Timeframe) => {
    setLoading(true)
    const { data } = await reportsApi.getBalance(tf)
    if (data) setReport(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchReport(timeframe) }, [timeframe, fetchReport])
  useEffect(() => { userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) }) }, [])

  const s = report?.summary

  // Total de obligaciones: suma de TODAS las deudas activas (montoTotal)
  const totalDeudaViva = debts.reduce((a, d) => a + d.montoTotal, 0)

  // Ingreso real = cashBalance actual (lo que realmente ha entrado)
  const ingresoReal = wallet.cashBalance

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-cyclon-lavender flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Balance
          </h1>
          <p className="text-muted-foreground text-sm">Tu libro mayor financiero en tiempo real.</p>
        </div>
      </header>

      {/* Filtro de tiempo */}
      <div className="grid grid-cols-4 gap-2">
        {TIMEFRAMES.map(tf => (
          <button key={tf.value} onClick={() => setTimeframe(tf.value)} className={cn(
            "h-10 rounded-xl text-xs font-bold border-2 transition-colors",
            timeframe === tf.value ? "bg-cyclon-lavender text-white border-cyclon-lavender" : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
          )}>{tf.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-3xl" />)}
        </div>
      ) : (
        <>
          {/* ═══ TARJETAS PRINCIPALES: Ingreso Real + Deuda Total ═══ */}
          <div className="grid grid-cols-2 gap-3">
            {/* Ingreso Real */}
            <Card className="border-none bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 rounded-3xl shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ingreso Real</span>
                </div>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{formatAmount(ingresoReal)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Saldo disponible en billetera</p>
              </CardContent>
            </Card>

            {/* Deuda Total Viva */}
            <Card className="border-none bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 rounded-3xl shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Deuda Total</span>
                </div>
                <p className="text-2xl font-black text-red-600 dark:text-red-400">{formatAmount(totalDeudaViva)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Suma de todas tus deudas activas</p>
              </CardContent>
            </Card>
          </div>

          {/* Ingresos Totales + Egresos Totales (toda la vida) */}
          {s && (
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-none bg-card shadow-sm rounded-3xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ingresos Totales</span>
                  </div>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{formatAmount(s.totalIngresosHistorico)}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">Todo lo que has recibido</p>
                </CardContent>
              </Card>

              <Card className="border-none bg-card shadow-sm rounded-3xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Egresos Totales</span>
                  </div>
                  <p className="text-xl font-black text-red-600 dark:text-red-400">{formatAmount(s.totalEgresosHistorico)}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">Todo lo gastado en obligaciones</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Balance neto del periodo */}
          {s && (
            <Card className="border-none bg-card shadow-sm rounded-3xl">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold">Balance neto del periodo</span>
                  <span className={cn(
                    "text-sm font-black",
                    s.totalIngreso >= s.totalEgreso ? "text-emerald-600" : "text-red-500"
                  )}>
                    {s.totalIngreso >= s.totalEgreso ? "+" : ""}{formatAmount(s.totalIngreso - s.totalEgreso)}
                  </span>
                </div>
                <Progress
                  value={s.totalIngreso > 0 ? Math.min(((s.totalIngreso - s.totalEgreso) / s.totalIngreso) * 100 + 50, 100) : 50}
                  className="h-2"
                  indicatorClassName={s.totalIngreso >= s.totalEgreso ? "bg-emerald-500" : "bg-red-500"}
                />
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[
                    { label: "Deudas",  val: s.totalDebts,   color: "text-cyclon-periwinkle" },
                    { label: "Fijos",   val: s.totalFixed,   color: "text-cyclon-sky" },
                    { label: "Hormiga", val: s.totalImpulse, color: "text-cyclon-pink" },
                    { label: "Ahorro",  val: s.totalSaved,   color: "text-emerald-600" },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <p className={cn("text-xs font-black", item.color)}>{formatAmount(item.val)}</p>
                      <p className="text-[9px] text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ HISTORIAL DETALLADO ═══ */}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  Historial detallado
                </h3>
                <ExportButtons report={report} />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {HISTORY_TABS.map(tab => (
                  <button key={tab.value} onClick={() => setHistoryTab(tab.value)} className={cn(
                    "flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold border-2 shrink-0 transition-colors",
                    historyTab === tab.value ? "bg-cyclon-lavender text-white border-cyclon-lavender" : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
                  )}>{tab.icon}{tab.label}</button>
                ))}
              </div>

              {historyTab === "gastos_hormiga" && (
                <HistoryList items={report.impulseExpenses} emptyMsg="Sin gastos hormiga" renderRow={(e) => ({
                  icon: "☕", title: e.nombre as string,
                  subtitle: `${e.categoria as string} · ${fmtDate(e.createdAt as string)}`,
                  amount: -(e.monto as number), formatAmount,
                })} />
              )}
              {historyTab === "ahorro" && (
                <HistoryList items={report.savingsHistory} emptyMsg="Sin registros de ahorro" renderRow={(e) => ({
                  icon: (e.tipo as string) === "ahorro" ? "✅" : "⏭️",
                  title: (e.tipo as string) === "ahorro" ? `Ahorro · ${e.periodo as string}` : `Sin ahorro · ${e.periodo as string}`,
                  subtitle: fmtDate(e.createdAt as string),
                  amount: (e.tipo as string) === "ahorro" ? -(e.monto as number) : 0, formatAmount,
                })} />
              )}
              {historyTab === "ingresos_extra" && (
                <HistoryList items={report.extraIncomes} emptyMsg="Sin ingresos extra" renderRow={(e) => ({
                  icon: "⚡", title: e.nombre as string,
                  subtitle: `${e.temporalidad as string} · ${fmtDate(e.createdAt as string)}`,
                  amount: e.monto as number, formatAmount,
                })} />
              )}
              {historyTab === "deudas" && (
                <HistoryList items={report.debts} emptyMsg="Sin deudas registradas" renderRow={(d) => ({
                  icon: (d.pagadoEstePeriodo as boolean) ? "✅" : "🔴",
                  title: d.nombre as string,
                  subtitle: `Vence: ${d.fechaVencimiento as string} · Total: ${formatAmount(d.montoTotal as number)}`,
                  amount: -(d.cuotaPeriodo as number), formatAmount,
                  faded: !(d.pagadoEstePeriodo as boolean),
                })} />
              )}
              {historyTab === "gastos_fijos" && (
                <HistoryList items={report.fixedExpenses} emptyMsg="Sin gastos fijos" renderRow={(f) => ({
                  icon: (f.pagadoEstePeriodo as boolean) ? "✅" : "⏳",
                  title: f.nombre as string, subtitle: `Corte: ${f.fechaCorte as string}`,
                  amount: -(f.monto as number), formatAmount,
                  faded: !(f.pagadoEstePeriodo as boolean),
                })} />
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
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return String(iso) }
}

interface RowConfig {
  icon: string; title: string; subtitle: string; amount: number
  formatAmount: (n: number) => string; faded?: boolean
}

function HistoryList({ items, emptyMsg, renderRow }: {
  items: Record<string, unknown>[]; emptyMsg: string
  renderRow: (item: Record<string, unknown>) => RowConfig
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{emptyMsg}</p>
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const row = renderRow(item)
        const isPositive = row.amount > 0
        const isZero = row.amount === 0
        return (
          <div key={(item.id as string) ?? i} className={cn("flex items-center gap-3 bg-card rounded-2xl px-4 py-3 shadow-sm", row.faded && "opacity-50")}>
            <span className="text-lg shrink-0">{row.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{row.title}</p>
              <p className="text-[10px] text-muted-foreground">{row.subtitle}</p>
            </div>
            <span className={cn("font-black text-sm shrink-0", isZero ? "text-muted-foreground" : isPositive ? "text-emerald-600" : "text-red-500")}>
              {isZero ? "—" : isPositive ? `+${row.formatAmount(row.amount)}` : row.formatAmount(Math.abs(row.amount))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
