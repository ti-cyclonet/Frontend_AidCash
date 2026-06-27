"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from "recharts"
import {
  ArrowUpRight, Wallet, ReceiptText, PiggyBank,
  ChevronRight, TrendingUp, AlertCircle, Sparkles, Coffee,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useRouter } from "next/navigation"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { getPeriodData } from "@/lib/period-filter"
import { analyzeFinances } from "@/lib/recommendations"
import { RecommendationsPanel } from "@/components/recommendations/recommendations-panel"
import { ExportButtons } from "@/components/balance/ExportButtons"
import { reportsApi } from "@/lib/api-client"
import { useState, useEffect } from "react"
import type { BalanceReport } from "@/lib/api-client"

export default function DashboardPage() {
  const { formatAmount, income, incomeFrequency, onboardingDone } = useAppContext()
  const {
    debts, fixedExpenses, extraIncomes, totalAhorrado,
    savingsHistory, totalImpulseThisPeriod,
  } = useFinanceData()
  const router = useRouter()

  // Reporte para botones de exportación
  const [report, setReport] = useState<BalanceReport | null>(null)
  useEffect(() => {
    reportsApi.getBalance("month").then(({ data }) => { if (data) setReport(data) })
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

  const recommendations = useMemo(
    () => allocation ? analyzeFinances(allocation, periodDebts, incomeFrequency) : null,
    [allocation, periodDebts, incomeFrequency]
  )

  const pendingDebts = periodDebts.filter(d => !d.pagadoEstePeriodo)
  const totalDebtAmount = pendingDebts.reduce((acc, d) => acc + d.cuotaPeriodo, 0)

  const savingsGoal = 5000
  const savingsProgress = savingsGoal > 0 ? Math.min((totalAhorrado / savingsGoal) * 100, 100) : 0

  // ── Pie chart — con porción de Gastos Hormiga separada ─────────────────────
  const impulsePct = allocation && totalIncome > 0
    ? Math.round((totalImpulseThisPeriod / totalIncome) * 100)
    : 0
  const freePctAdjusted = allocation
    ? Math.max(0, Math.round(allocation.freeInvestmentPct) - impulsePct)
    : 30

  const pieData = allocation
    ? [
        { name: "Obligaciones",     value: Math.round(allocation.obligationsPct), color: "#8096E6" },
        { name: "Ahorro",           value: Math.round(allocation.savingsPct),     color: "#B9FBC0" },
        { name: "Libre disponible", value: freePctAdjusted,                       color: "#A2D2FF" },
        ...(impulsePct > 0 ? [{ name: "Gastos Hormiga", value: impulsePct, color: "#FFB3C6" }] : []),
      ]
    : [
        { name: "Necesidades", value: 50, color: "#8096E6" },
        { name: "Libre",       value: 30, color: "#A2D2FF" },
        { name: "Ahorro",      value: 20, color: "#B9FBC0" },
      ]

  // ── Barras de progreso del presupuesto ─────────────────────────────────────
  const progressBars = allocation
    ? [
        {
          label: "Obligaciones",
          sublabel: "Deudas + Gastos Fijos",
          pct: allocation.obligationsPct,
          amount: allocation.obligationsAmount,
          color: "bg-[#8096E6]",
          alert: allocation.isTight,
        },
        {
          label: "Ahorro",
          sublabel: "Págate a ti mismo primero",
          pct: allocation.savingsPct,
          amount: allocation.savingsAmount,
          color: "bg-[#B9FBC0]",
        },
        {
          label: "Gasto Libre",
          sublabel: "Blindado · comida, día a día",
          pct: allocation.dailyFreePct,
          amount: allocation.dailyFreeAmount,
          color: "bg-[#A2D2FF]",
        },
        ...(impulsePct > 0
          ? [{
              label: "Gastos Hormiga",
              sublabel: `${impulsePct}% del ingreso gastado`,
              pct: impulsePct,
              amount: totalImpulseThisPeriod,
              color: "bg-[#FFB3C6]",
              alert: totalImpulseThisPeriod > (allocation.dailyFreeAmount),
            }]
          : []),
        {
          label: "Cap. Endeudamiento",
          sublabel: "Margen real disponible",
          pct: allocation.debtCapacityPct,
          amount: allocation.debtCapacityAmount,
          color: "bg-cyclon-lavender",
        },
      ]
    : []

  return (
    <div className="space-y-6 pb-8">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-cyclon-lavender">Resumen</h1>
          <p className="text-muted-foreground text-sm font-medium">Tu salud financiera hoy.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons report={report} />
          <div className="h-12 w-12 bg-card rounded-2xl shadow-sm flex items-center justify-center border border-border">
            <TrendingUp className="h-6 w-6 text-cyclon-lavender" />
          </div>
        </div>
      </header>

      {/* ── 1. Onboarding CTA ── */}
      {!onboardingDone && (
        <button onClick={() => router.push("/onboarding")} className="w-full text-left">
          <Card className="border-none bg-cyclon-lavender rounded-3xl overflow-hidden shadow-lg shadow-cyclon-lavender/30">
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

      {/* ── 2. Botón de Recomendaciones de IA ── */}
      {recommendations && (
        <RecommendationsPanel result={recommendations} />
      )}

      {/* ── 3. Gráfico principal de distribución ── */}
      <Link href="/gestion">
        <Card className="border-none bg-card shadow-xl shadow-cyclon-lavender/5 rounded-[2.5rem] overflow-hidden group transition-all hover:scale-[1.02] active:scale-95 cursor-pointer">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Ingreso {incomeFrequency}
                </span>
                <h2 className="text-2xl font-black text-foreground">
                  {totalIncome > 0
                    ? formatAmount(totalIncome)
                    : <span className="text-muted-foreground text-lg">Sin configurar</span>
                  }
                </h2>
              </div>
              <div className="h-10 w-10 bg-cyclon-lavender/10 rounded-xl flex items-center justify-center text-cyclon-lavender group-hover:bg-cyclon-lavender group-hover:text-white transition-colors">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              {/* Gráfico donut */}
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={40} outerRadius={60} paddingAngle={6} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <ChartTooltip formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Leyenda */}
              <div className="space-y-2.5">
                {pieData.map(item => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-muted-foreground truncate">{item.name}</span>
                    <span className="text-xs font-black ml-auto">{item.value}%</span>
                  </div>
                ))}
                {allocation && (
                  <div className="pt-1 border-t border-dashed border-border">
                    <p className="text-[10px] text-muted-foreground">
                      Capacidad libre:{" "}
                      <span className={cn(
                        "font-black",
                        allocation.debtCapacityAmount > 0 ? "text-cyclon-lavender" : "text-destructive"
                      )}>
                        {formatAmount(allocation.debtCapacityAmount)}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* ── 4. Barras de progreso detalladas (debajo del gráfico) ── */}
      {allocation && progressBars.length > 0 && (
        <div className="space-y-2.5">
          {progressBars.map(bar => (
            <div
              key={bar.label}
              className={cn(
                "bg-card rounded-2xl px-4 py-3 shadow-sm flex items-center gap-4",
                bar.alert && "ring-1 ring-red-400/40"
              )}
            >
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold">{bar.label}</span>
                    {bar.label === "Gastos Hormiga" && (
                      <Coffee className="h-3 w-3 inline ml-1.5 text-cyclon-pink" />
                    )}
                    <p className="text-[10px] text-muted-foreground">{bar.sublabel}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black">{formatAmount(bar.amount)}</span>
                    <p className={cn(
                      "text-[10px] font-bold",
                      bar.alert ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {Math.round(Math.min(bar.pct, 100))}%
                    </p>
                  </div>
                </div>
                <Progress
                  value={Math.min(bar.pct, 100)}
                  className="h-2"
                  indicatorClassName={cn(
                    bar.alert ? "bg-red-500" : bar.color
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Quick access cards ── */}
      <div className="grid grid-cols-1 gap-3">
        <Link href="/obligaciones">
          <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden hover:bg-muted/30 transition-colors cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-14 w-14 bg-cyclon-pink/20 rounded-2xl flex items-center justify-center text-cyclon-pink">
                <ReceiptText className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">Obligaciones Pendientes</h3>
                <p className="text-xs text-muted-foreground">{pendingDebts.length} compromisos este periodo</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-lg font-black text-foreground">{formatAmount(totalDebtAmount)}</span>
                  {pendingDebts.length > 0 && (
                    <div className="h-4 w-4 bg-cyclon-pink/10 rounded-full flex items-center justify-center">
                      <AlertCircle className="h-3 w-3 text-cyclon-pink" />
                    </div>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/ahorro">
          <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden hover:bg-muted/30 transition-colors cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-14 w-14 bg-cyclon-mint/30 rounded-2xl flex items-center justify-center text-cyclon-mint">
                <PiggyBank className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">Ahorro Acumulado</h3>
                <p className="text-xs text-muted-foreground">
                  {savingsHistory.filter(e => e.tipo === "ahorro").length} periodos ahorrados
                </p>
                <div className="mt-1.5 space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>{Math.round(savingsProgress)}% de la meta</span>
                    <span>{formatAmount(totalAhorrado)} / {formatAmount(savingsGoal)}</span>
                  </div>
                  <Progress value={savingsProgress} className="h-1.5 bg-muted" indicatorClassName="bg-cyclon-mint" />
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <Link href="/gestion">
        <Button className="w-full h-16 rounded-[2rem] bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white font-bold text-lg shadow-xl shadow-cyclon-lavender/30 gap-3">
          <Wallet className="h-6 w-6" />
          Registrar Ingreso
        </Button>
      </Link>
    </div>
  )
}
