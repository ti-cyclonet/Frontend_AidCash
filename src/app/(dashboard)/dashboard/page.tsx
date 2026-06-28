"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from "recharts"
import {
  Wallet, ReceiptText, PiggyBank, ChevronRight,
  TrendingUp, AlertCircle, Sparkles, Eye, Flame,
  FileText, FileSpreadsheet, TreePine,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useStreaks } from "@/hooks/use-streaks"
import { useRouter } from "next/navigation"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { getPeriodData } from "@/lib/period-filter"
import { ExportButtons } from "@/components/balance/ExportButtons"
import { userApi, reportsApi, WalletState } from "@/lib/api-client"
import type { BalanceReport } from "@/lib/api-client"

export default function DashboardPage() {
  const { formatAmount, income, incomeFrequency, onboardingDone, user, metaAhorro } = useAppContext()
  const { debts, fixedExpenses, extraIncomes, totalAhorrado, savingsHistory } = useFinanceData()
  const { streakActual } = useStreaks(incomeFrequency)
  const router = useRouter()

  const [report, setReport] = useState<BalanceReport | null>(null)
  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })

  useEffect(() => {
    reportsApi.getBalance("month").then(({ data }) => { if (data) setReport(data) })
    userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) })
  }, [])

  const totalExtraIncome = extraIncomes.reduce((acc, e) => acc + e.monto, 0)
  const { effectiveIncome: totalIncome, totalObligations, periodDebts } = useMemo(
    () => getPeriodData(income, totalExtraIncome, debts, fixedExpenses, incomeFrequency),
    [income, totalExtraIncome, debts, fixedExpenses, incomeFrequency]
  )
  const allocation = useMemo(
    () => totalIncome > 0 ? calculateBudgetAllocation(totalIncome, totalObligations) : null,
    [totalIncome, totalObligations]
  )

  const pendingDebts = periodDebts.filter(d => !d.pagadoEstePeriodo)
  const pendingFixed = fixedExpenses.filter(f => !f.pagadoEstePeriodo)
  const totalPending = pendingDebts.reduce((a, d) => a + d.cuotaPeriodo, 0) + pendingFixed.reduce((a, f) => a + f.monto, 0)
  const savingsGoal = metaAhorro || 5000
  const savingsProgress = savingsGoal > 0 ? Math.min((totalAhorrado / savingsGoal) * 100, 100) : 0

  // Saldo total real
  const saldoTotal = wallet.cashBalance

  // Donut data
  const pieData = allocation ? [
    { name: "Ahorro", value: Math.round(allocation.savingsPct), color: "#B9FBC0", amount: allocation.savingsAmount },
    { name: "Obligaciones", value: Math.round(allocation.obligationsPct), color: "#8096E6", amount: allocation.obligationsAmount },
    { name: "Gasto libre", value: Math.round(allocation.dailyFreePct), color: "#A2D2FF", amount: allocation.dailyFreeAmount },
    { name: "Endeudamiento", value: Math.round(allocation.debtCapacityPct), color: "#C4B5FD", amount: allocation.debtCapacityAmount },
  ] : [
    { name: "Ahorro", value: 20, color: "#B9FBC0", amount: 0 },
    { name: "Obligaciones", value: 50, color: "#8096E6", amount: 0 },
    { name: "Gasto libre", value: 15, color: "#A2D2FF", amount: 0 },
    { name: "Endeudamiento", value: 15, color: "#C4B5FD", amount: 0 },
  ]

  // Nivel del árbol (basado en streak)
  const treeLevel = streakActual >= 12 ? 4 : streakActual >= 6 ? 3 : streakActual >= 3 ? 2 : 1
  const treeLevelPct = Math.min(100, Math.round((streakActual / (treeLevel === 4 ? 12 : treeLevel === 3 ? 12 : treeLevel === 2 ? 6 : 3)) * 100))

  return (
    <div className="space-y-6 pb-8">
      {/* ═══ HEADER ═══ */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            ¡Hola, {user.nombre?.split(" ")[0] || "Usuario"}! 👋
          </h1>
          <p className="text-muted-foreground text-sm">Estás construyendo tu mejor futuro financiero.</p>
        </div>
        {/* Saldo total pill */}
        <Card className="border-none bg-card shadow-sm rounded-2xl shrink-0">
          <CardContent className="px-5 py-3 flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                Saldo total <Eye className="h-3 w-3" />
              </span>
              <p className="text-xl sm:text-2xl font-black text-foreground">
                {saldoTotal > 0 ? formatAmount(saldoTotal) : formatAmount(totalIncome)}
              </p>
              <span className="text-[9px] text-muted-foreground">Actualizado hoy</span>
            </div>
          </CardContent>
        </Card>
      </header>

      {/* Onboarding CTA */}
      {!onboardingDone && (
        <button onClick={() => router.push("/onboarding")} className="w-full text-left">
          <Card className="border-none bg-cyclon-lavender rounded-3xl shadow-lg shadow-cyclon-lavender/30">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">Completa tu perfil financiero</p>
                <p className="text-white/70 text-xs mt-0.5">Configura ingresos, deudas y gastos en 2 min.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-white/70 shrink-0" />
            </CardContent>
          </Card>
        </button>
      )}

      {/* ═══ TWO COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── COLUMNA IZQUIERDA: Donut + Árbol Kiri (3/5) ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Distribución de presupuesto (Donut) */}
          <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-5">
              <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyclon-lavender" />
                Distribución de tu presupuesto
              </h2>
              <div className="grid grid-cols-2 gap-4 items-center">
                {/* Donut */}
                <div className="h-44 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(v) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centro del donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-muted-foreground font-medium">Total</span>
                    <span className="text-sm font-black">{saldoTotal > 0 ? formatAmount(saldoTotal) : formatAmount(totalIncome)}</span>
                  </div>
                </div>

                {/* Leyenda con montos */}
                <div className="space-y-3">
                  {pieData.map(item => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground truncate">{item.name}</span>
                          <span className="text-[9px] font-black bg-muted/50 px-1.5 py-0.5 rounded-full">{item.value}%</span>
                        </div>
                        <p className="text-xs font-black">{formatAmount(item.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mensaje de estado */}
              <div className="mt-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-3 flex items-center gap-2">
                <span className="text-lg">🌱</span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  {allocation?.isOverloaded
                    ? "⚠️ Tus obligaciones superan tu ingreso. Revisa tu presupuesto."
                    : allocation?.isTight
                      ? "Tu presupuesto está ajustado. Revisa si puedes reducir alguna obligación."
                      : "¡Vas por buen camino! 🌿 Estás distribuyendo tu dinero de forma inteligente."
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Árbol Kiri */}
          <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <TreePine className="h-4 w-4 text-emerald-600" />
                  Tu árbol Kiri
                </h2>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                  Nivel {treeLevel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                {/* Ilustración del árbol */}
                <div className="h-40 bg-gradient-to-b from-sky-100 to-green-50 dark:from-sky-950/30 dark:to-green-950/20 rounded-2xl flex items-end justify-center relative overflow-hidden">
                  {/* Suelo */}
                  <div className="absolute bottom-0 inset-x-0 h-1/4 bg-gradient-to-t from-emerald-200/60 to-transparent dark:from-emerald-900/30" />
                  {/* Árbol emoji escalado */}
                  <div className="text-6xl mb-4 select-none" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))" }}>
                    {treeLevel >= 4 ? "🌳" : treeLevel >= 3 ? "🌲" : treeLevel >= 2 ? "🌿" : "🌱"}
                  </div>
                </div>

                {/* Info del árbol */}
                <div className="space-y-3">
                  <div>
                    <p className="font-bold text-sm">
                      {treeLevel >= 4 ? "¡Tu árbol está en plena floración!" :
                       treeLevel >= 3 ? "¡Tu árbol está creciendo!" :
                       treeLevel >= 2 ? "Sigue manteniendo buenos hábitos." :
                       "Riega tu árbol cumpliendo tus metas."}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {treeLevel >= 4
                        ? "Eres un ejemplo de disciplina financiera."
                        : "Sigue manteniendo buenos hábitos y verás grandes resultados."
                      }
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>Siguiente nivel</span>
                      <span>{treeLevelPct}%</span>
                    </div>
                    <Progress value={treeLevelPct} className="h-2" indicatorClassName="bg-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-bold">Racha: {streakActual} {incomeFrequency === "quincenal" ? "quincenas" : "meses"} 🔥</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── COLUMNA DERECHA: Acciones + Detalles (2/5) ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Obligaciones pendientes */}
          <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-cyclon-periwinkle" />
                Obligaciones pendientes
              </h3>

              {pendingDebts.length === 0 && pendingFixed.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  ✅ No tienes obligaciones pendientes este periodo.
                </p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {/* Deudas pendientes */}
                  {pendingDebts.slice(0, 3).map(d => (
                    <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30">
                      <div className="h-8 w-8 rounded-lg bg-cyclon-periwinkle/10 flex items-center justify-center text-cyclon-periwinkle shrink-0">
                        <ReceiptText className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{d.nombre}</p>
                        <p className="text-[10px] text-muted-foreground">Vence {d.fechaVencimiento}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black">{formatAmount(d.cuotaPeriodo)}</p>
                      </div>
                    </div>
                  ))}
                  {/* Gastos fijos pendientes */}
                  {pendingFixed.slice(0, 2).map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                        <Wallet className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{f.nombre}</p>
                        <p className="text-[10px] text-muted-foreground">Corte {f.fechaCorte}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black">{formatAmount(f.monto)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(pendingDebts.length + pendingFixed.length) > 0 && (
                <Link href="/obligaciones" className="flex items-center justify-center gap-1 text-[11px] font-bold text-cyclon-lavender hover:text-cyclon-lavender/80 transition-colors pt-1">
                  Ver todas <ChevronRight className="h-3 w-3" />
                </Link>
              )}

              {totalPending > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-dashed border-border">
                  <span className="text-[10px] text-muted-foreground font-medium">Total pendiente</span>
                  <span className="text-sm font-black text-cyclon-periwinkle">{formatAmount(totalPending)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progreso de ahorro */}
          <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-cyclon-mint" />
                Progreso de ahorro
              </h3>

              <div className="flex items-center gap-4">
                <div className="text-4xl select-none">🐷</div>
                <div className="flex-1 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">Meta: {formatAmount(savingsGoal)} ✨</p>
                  <p className="text-xl font-black">{formatAmount(totalAhorrado)}</p>
                  <p className="text-[10px] text-muted-foreground">de {formatAmount(savingsGoal)}</p>
                  <div className="flex items-center gap-2">
                    <Progress value={savingsProgress} className="h-2 flex-1" indicatorClassName="bg-cyclon-mint" />
                    <span className="text-[10px] font-black text-cyclon-mint">{Math.round(savingsProgress)}%</span>
                  </div>
                </div>
              </div>

              <Link href="/ahorro" className="flex items-center justify-center gap-1 text-[11px] font-bold text-cyclon-lavender hover:text-cyclon-lavender/80 transition-colors pt-1">
                Ver todas mis metas <ChevronRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Exportar reportes */}
          <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Exportar reportes
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Descarga tus reportes y lleva el control de tus finanzas.
              </p>
              <ExportButtons report={report} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Botón flotante de acción principal (mobile) */}
      <Link href="/gestion" className="lg:hidden block">
        <Button className="w-full h-14 rounded-2xl bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white font-bold text-base shadow-xl shadow-cyclon-lavender/30 gap-2">
          <Wallet className="h-5 w-5" /> Registrar Ingreso
        </Button>
      </Link>
    </div>
  )
}
