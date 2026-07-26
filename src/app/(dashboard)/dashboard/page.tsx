"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from "recharts"
import {
  Wallet, ReceiptText, ChevronRight,
  TrendingUp, Sparkles, Eye, Flame,
  TreePine, CalendarDays,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useStreaks } from "@/hooks/use-streaks"
import { useRouter } from "next/navigation"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { analyzeFinances } from "@/lib/recommendations"
import { DebtStrategyPanel } from "@/components/recommendations/debt-strategy-panel"
import { userApi, WalletState } from "@/lib/api-client"
import { WelcomeOnboarding } from "@/components/gestion/WelcomeOnboarding"

export default function DashboardPage() {
  const { formatAmount, incomeFrequency, diasCobro, onboardingDone, user } = useAppContext()
  const { debts, fixedExpenses } = useFinanceData()
  const { streakActual } = useStreaks(incomeFrequency)
  const router = useRouter()

  // ── Welcome onboarding: se muestra una sola vez después del primer onboarding ──
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem('kiri_welcome_seen')
  })

  const handleWelcomeComplete = () => {
    setShowWelcome(false)
    localStorage.setItem('kiri_welcome_seen', 'true')
  }

  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })

  useEffect(() => {
    userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) })
  }, [])

  // ═══ FUENTE ÚNICA DE VERDAD: distribución DINÁMICA del periodo actual ═══
  // usePeriodBudget() hace:
  //   1. Filtra obligaciones según quincena/mes + excluye pagadas
  //   2. Calcula allocation con ingreso y obligaciones del periodo
  //   3. Cuando el usuario marca algo como pagado → % baja en tiempo real
  const { allocation, periodData } = usePeriodBudget()

  // Para recomendaciones y listados de pendientes
  const { periodDebts } = periodData

  // Recomendaciones y estrategias de deuda
  const recommendations = useMemo(
    () => allocation ? analyzeFinances(allocation, periodDebts, incomeFrequency) : null,
    [allocation, periodDebts, incomeFrequency]
  )

  const pendingDebts = periodDebts.filter(d => !d.pagadoEstePeriodo)
  const pendingFixed = fixedExpenses.filter(f => !f.pagadoEstePeriodo)
  const totalPending = pendingDebts.reduce((a, d) => a + d.cuotaPeriodo, 0) + pendingFixed.reduce((a, f) => a + f.monto, 0)

  // Saldo total real
  const saldoTotal = wallet.cashBalance

  // ═══ DISTRIBUCIÓN REAL basada en Sueldo Real (cashBalance) vs Obligaciones del periodo ═══
  // Si cashBalance es 0, no hay nada que distribuir. Solo se muestran obligaciones pendientes.
  const realIncome = saldoTotal
  const realObligations = totalPending

  const realAlloc = useMemo(() => {
    if (realIncome <= 0) return { obligPct: 0, savPct: 0, freePct: 0, debtPct: 0, obligAmt: realObligations, savAmt: 0, freeAmt: 0, debtAmt: 0 }
    const obligPct = Math.min(100, (realObligations / realIncome) * 100)
    const isOverloaded = realObligations >= realIncome
    const remanente = Math.max(0, realIncome - realObligations)
    if (isOverloaded) return { obligPct, savPct: 0, freePct: 0, debtPct: 0, obligAmt: realObligations, savAmt: 0, freeAmt: 0, debtAmt: 0 }
    const remPct = (remanente / realIncome) * 100
    const tgtSav = remPct >= 40 ? 20 : remPct >= 25 ? 15 : remPct >= 15 ? 10 : 5
    const savAmt = Math.min((tgtSav / 100) * realIncome, remanente)
    const savPct = (savAmt / realIncome) * 100
    const afterSav = remanente - savAmt
    const maxFree = (15 / 100) * realIncome
    const freeAmt = Math.min(afterSav, maxFree)
    const freePct = (freeAmt / realIncome) * 100
    const debtAmt = afterSav - freeAmt
    const debtPct = (debtAmt / realIncome) * 100
    return { obligPct, savPct, freePct, debtPct, obligAmt: realObligations, savAmt, freeAmt, debtAmt }
  }, [realIncome, realObligations])

  const pieData = [
    { name: "Ahorro", value: Math.round(realAlloc.savPct), color: "#B9FBC0", amount: Math.round(realAlloc.savAmt) },
    { name: "Obligaciones", value: Math.min(100, Math.round(realAlloc.obligPct)), color: "#8096E6", amount: Math.round(realAlloc.obligAmt) },
    { name: "Gasto libre", value: Math.round(realAlloc.freePct), color: "#A2D2FF", amount: Math.round(realAlloc.freeAmt) },
    { name: "Endeudamiento", value: Math.round(realAlloc.debtPct), color: "#C4B5FD", amount: Math.round(realAlloc.debtAmt) },
  ]

  // Nivel del árbol (basado en streak)
  const treeLevel = streakActual >= 12 ? 4 : streakActual >= 6 ? 3 : streakActual >= 3 ? 2 : 1
  const treeLevelPct = Math.min(100, Math.round((streakActual / (treeLevel === 4 ? 12 : treeLevel === 3 ? 12 : treeLevel === 2 ? 6 : 3)) * 100))

  return (
    <div className="space-y-6 pb-8">
      {/* ═══ WELCOME ONBOARDING — solo la primera vez que el usuario llega al dashboard ═══ */}
      {showWelcome && onboardingDone && (
        <WelcomeOnboarding onComplete={handleWelcomeComplete} />
      )}

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
                {formatAmount(saldoTotal)}
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

          {/* Periodo actual */}
          <Card className="border-none bg-gradient-to-r from-kiri-forest to-kiri-emerald rounded-2xl overflow-hidden">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Periodo actual: {incomeFrequency === "quincenal" ? `Quincena ${(() => {
                    const days = diasCobro.split(",").map((d: string) => parseInt(d.trim(), 10)).filter((d: number) => !isNaN(d)).sort((a: number, b: number) => a - b)
                    if (days.length < 2) return 1
                    return new Date().getDate() >= days[0] && new Date().getDate() < days[1] ? 1 : 2
                  })()}` : "Mensual"}
                </span>
                <span className="text-white/80 text-xs flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {(() => {
                    const days = diasCobro.split(",").map((d: string) => parseInt(d.trim(), 10)).filter((d: number) => !isNaN(d)).sort((a: number, b: number) => a - b)
                    const now = new Date(); const day = now.getDate()
                    const monthName = now.toLocaleString("es", { month: "long" })
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                    if (incomeFrequency === "mensual" || days.length < 2) return `1 - ${lastDay} de ${monthName}`
                    const [d1, d2] = days
                    if (day >= d1 && day < d2) return `${d1} - ${d2 - 1} de ${monthName}`
                    return `${d2} - ${lastDay} de ${monthName}`
                  })()}
                </span>
              </div>
              {(() => {
                const now = new Date(); const day = now.getDate()
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                const days = diasCobro.split(",").map((d: string) => parseInt(d.trim(), 10)).filter((d: number) => !isNaN(d)).sort((a: number, b: number) => a - b)
                let daysLeft = lastDay - day
                if (incomeFrequency === "quincenal" && days.length >= 2) {
                  const [d1, d2] = days
                  daysLeft = (day >= d1 && day < d2) ? d2 - day - 1 : lastDay - day + d1 - 1
                }
                const total = incomeFrequency === "quincenal" ? 15 : 30
                const pct = Math.min(100, Math.round(((total - daysLeft) / total) * 100))
                return (
                  <>
                    <p className="text-white/70 text-[11px]">Día actual: {day} de {now.toLocaleString("es", { month: "long" })}</p>
                    <Progress value={pct} className="h-2 bg-white/20 [&>div]:bg-white" />
                    <p className="text-white/60 text-[10px]">Faltan <span className="text-white font-bold">{daysLeft} días</span> para terminar el periodo</p>
                  </>
                )
              })()}
            </CardContent>
          </Card>

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
                    <span className="text-sm font-black">{formatAmount(saldoTotal)}</span>
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

              {/* Mensaje de estado — sincronizado con el motor de recomendaciones */}
              <div className={cn(
                "mt-4 rounded-2xl p-3 flex items-start gap-2",
                realAlloc.obligPct >= 100
                  ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40"
                  : realAlloc.obligPct >= 70
                    ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40"
                    : "bg-emerald-50 dark:bg-emerald-950/20"
              )}>
                <span className="text-lg shrink-0">{realAlloc.obligPct >= 100 ? "🚨" : realAlloc.obligPct >= 70 ? "⚠️" : "🌱"}</span>
                <div>
                  <p className={cn(
                    "text-[11px] font-bold",
                    realAlloc.obligPct >= 100
                      ? "text-red-700 dark:text-red-300"
                      : realAlloc.obligPct >= 70
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-emerald-700 dark:text-emerald-300"
                  )}>
                    {realAlloc.obligPct >= 100
                      ? "Alerta: Tus obligaciones superan tus ingresos"
                      : realAlloc.obligPct >= 70
                        ? "Navegando con poco margen"
                        : "¡Vas por buen camino! 🌿"
                    }
                  </p>
                  <p className={cn(
                    "text-[10px] mt-0.5",
                    realAlloc.obligPct >= 100
                      ? "text-red-600/80 dark:text-red-400/80"
                      : "text-muted-foreground"
                  )}>
                    {realAlloc.obligPct >= 100
                      ? `Tus compromisos superan tu saldo (${Math.round(realAlloc.obligPct)}% de carga). Revisa qué obligaciones reducir.`
                      : realAlloc.obligPct >= 70
                        ? `El ${Math.round(realAlloc.obligPct)}% va a obligaciones. Cada deuda que liquides te devuelve libertad.`
                        : "Estás distribuyendo tu dinero de forma inteligente."
                    }
                  </p>
                </div>
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

          {/* Obligaciones pendientes — debajo del árbol */}
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
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {/* Deudas pendientes */}
                  {pendingDebts.slice(0, 4).map(d => (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <ReceiptText className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{d.nombre}</p>
                        <p className="text-[10px] text-muted-foreground">Vence {d.diasPago}</p>
                      </div>
                      <p className="text-sm font-black shrink-0">{formatAmount(d.cuotaPeriodo)}</p>
                    </div>
                  ))}
                  {/* Gastos fijos pendientes */}
                  {pendingFixed.slice(0, 3).map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <Wallet className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{f.nombre}</p>
                        <p className="text-[10px] text-muted-foreground">Corte {f.fechaCorte}</p>
                      </div>
                      <p className="text-sm font-black shrink-0">{formatAmount(f.monto)}</p>
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
                  <span className="text-xs text-muted-foreground font-medium">Total pendiente</span>
                  <span className="text-sm font-black text-kiri-forest">{formatAmount(totalPending)}</span>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ── COLUMNA DERECHA: Estrategias (2/5) ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Estrategias para salir de deudas */}
          {recommendations?.strategies && debts.length > 0 && (
            <div className="space-y-3">
              {/* Sugerencia directa cuando está sobrecargado */}
              {realAlloc.obligPct >= 100 && recommendations.strategies && (
                <Card className="border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 rounded-2xl">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                      🎯 Estrategia sugerida: {recommendations.strategies.avalancheWins ? "Avalancha" : "Bola de Nieve"}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {recommendations.strategies.avalancheWins
                        ? `Ataca primero "${recommendations.strategies.avalanche.pasos[0]?.nombre ?? "tu deuda más pesada"}" — es la que más presión ejerce sobre tu presupuesto. Al liquidarla liberas ${formatAmount(recommendations.strategies.avalanche.pasos[0]?.cuotaLiberada ?? 0)}/periodo que puedes redirigir a la siguiente.`
                        : `Empieza por "${recommendations.strategies.snowball.pasos[0]?.nombre ?? "tu deuda más pequeña"}" — la liquidas en ${recommendations.strategies.snowball.pasos[0]?.liquidaEnPeriodo ?? "pocos"} periodos y liberas ${formatAmount(recommendations.strategies.snowball.pasos[0]?.cuotaLiberada ?? 0)}/periodo. Las victorias rápidas mantienen la motivación.`
                      }
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      📅 Libre de deudas en: <span className="font-bold">{recommendations.strategies.avalancheWins ? recommendations.strategies.avalanche.fechaLibre : recommendations.strategies.snowball.fechaLibre}</span>
                    </p>
                  </CardContent>
                </Card>
              )}
              <DebtStrategyPanel
                snowball={recommendations.strategies.snowball}
                avalanche={recommendations.strategies.avalanche}
                avalancheWins={recommendations.strategies.avalancheWins}
              />
            </div>
          )}

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
