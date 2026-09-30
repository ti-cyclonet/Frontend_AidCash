"use client"

import { guiaVista, marcarGuiaVista } from "@/lib/guias"
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
import { OdometerAmount } from "@/components/ui/odometer-amount"
import { useAppContext } from "@/lib/app-context"
import { usePlan } from "@/lib/plan-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useStreaks } from "@/hooks/use-streaks"
import { useRouter } from "next/navigation"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { analyzeFinances } from "@/lib/recommendations"
import { DebtStrategyPanel } from "@/components/recommendations/debt-strategy-panel"
import { userApi, WalletState, getUserId } from "@/lib/api-client"
import { WelcomeOnboarding } from "@/components/gestion/WelcomeOnboarding"
import { SpendingStatsGrid } from "@/components/gestion/SpendingStatsGrid"
import { TopConsumosSection } from "@/components/gestion/TopConsumosSection"
import { CategoryDistributionCard } from "@/components/gestion/CategoryDistributionCard"
import { tr, localeFecha } from "@/lib/i18n"

export default function DashboardPage() {
  const { formatAmount, incomeFrequency, diasCobro, onboardingDone, user } = useAppContext()
  const { plan } = usePlan()
  const { debts, fixedExpenses } = useFinanceData()
  const { streakActual } = useStreaks(incomeFrequency)
  const router = useRouter()

  // ── Welcome onboarding: se muestra una sola vez después del primer onboarding ──
  // La llave incluye el userId (mismo criterio que el tour de módulos en
  // TutorialSlider.tsx) — antes era un solo flag global en localStorage, así
  // que en cualquier dispositivo donde YA se hubiera completado el onboarding
  // con OTRA cuenta, una cuenta nueva registrada ahí jamás veía la bienvenida.
  const welcomeSeenKey = () => {
    const userId = getUserId()
    return userId ? `kiri_welcome_seen_${userId}` : null
  }
  // Bienvenida: solo la primera vez que se registra (lib/guias.ts la
  // recuerda en el servidor, no solo en este navegador).
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false
    return welcomeSeenKey() ? !guiaVista('welcome') : false
  })

  const handleWelcomeComplete = () => {
    setShowWelcome(false)
    marcarGuiaVista('welcome')
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

  // La distribución que se muestra acá DEBE ser la misma `allocation` de
  // usePeriodBudget() que ya usan Ahorro/Presupuesto/Obligaciones — antes este
  // componente recalculaba su propia versión ("realAlloc") a partir de
  // wallet.cashBalance en vez del ingreso del periodo, así que el "Ahorro"
  // que mostraba el dashboard nunca coincidía con el "Sugerido este periodo"
  // de un bolsillo de ahorro (que sí lee de usePeriodBudget()), aunque ambos
  // decían representar lo mismo.
  const realAlloc = {
    obligPct: allocation?.obligationsPct ?? 0,
    savPct: allocation?.savingsPct ?? 0,
    freePct: allocation?.dailyFreePct ?? 0,
    debtPct: allocation?.debtCapacityPct ?? 0,
    obligAmt: allocation?.obligationsAmount ?? totalPending,
    savAmt: allocation?.savingsAmount ?? 0,
    freeAmt: allocation?.dailyFreeAmount ?? 0,
    debtAmt: allocation?.debtCapacityAmount ?? 0,
  }

  const pieData = [
    { name: tr("Ahorro"), value: Math.round(realAlloc.savPct), color: "#B9FBC0", amount: Math.round(realAlloc.savAmt) },
    { name: tr("Obligaciones"), value: Math.min(100, Math.round(realAlloc.obligPct)), color: "#8096E6", amount: Math.round(realAlloc.obligAmt) },
    { name: tr("Gasto libre"), value: Math.round(realAlloc.freePct), color: "#A2D2FF", amount: Math.round(realAlloc.freeAmt) },
    { name: tr("Endeudamiento"), value: Math.round(realAlloc.debtPct), color: "#C4B5FD", amount: Math.round(realAlloc.debtAmt) },
  ]

  // Nivel del árbol (basado en streak)
  const treeLevel = streakActual >= 12 ? 4 : streakActual >= 6 ? 3 : streakActual >= 3 ? 2 : 1
  const treeLevelPct = Math.min(100, Math.round((streakActual / (treeLevel === 4 ? 12 : treeLevel === 3 ? 12 : treeLevel === 2 ? 6 : 3)) * 100))

  return (
    <div className="space-y-6 pb-8 max-w-5xl mx-auto">
      {/* ═══ WELCOME ONBOARDING — solo la primera vez que el usuario llega al dashboard ═══ */}
      {showWelcome && onboardingDone && (
        <WelcomeOnboarding onComplete={handleWelcomeComplete} />
      )}

      {/* ═══ HEADER ═══ */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">{tr("¡Hola, {0}! 👋", [user.nombre?.split(" ")[0] || tr("Usuario")])}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">{tr("Estás construyendo tu mejor futuro financiero.")}</p>
            <Link href="/mi-plan" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-kiri-emerald/10 text-kiri-emerald hover:bg-kiri-emerald/20 transition-colors">
              {plan?.planName || "FREE"}
            </Link>
          </div>
        </div>
        {/* Saldo total pill */}
        <Card className="border-none bg-card shadow-sm rounded-2xl shrink-0">
          <CardContent className="px-5 py-3 flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">{tr("Saldo total")}{" "}<Eye className="h-3 w-3" />
              </span>
              <OdometerAmount value={saldoTotal} formatAmount={formatAmount} className="text-xl sm:text-2xl font-black text-foreground" />
              <span className="text-[9px] text-muted-foreground">{tr("Actualizado hoy")}</span>
            </div>
          </CardContent>
        </Card>
      </header>

      {/* ═══ PERIODO ACTUAL ═══ */}
      <PeriodCard frequency={incomeFrequency} diasCobro={diasCobro} />

      {/* Onboarding CTA */}
      {!onboardingDone && (
        <button onClick={() => router.push("/onboarding")} className="w-full text-left">
          <Card className="border-none bg-cyclon-lavender rounded-3xl shadow-lg shadow-cyclon-lavender/30">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">{tr("Completa tu perfil financiero")}</p>
                <p className="text-white/70 text-xs mt-0.5">{tr("Configura ingresos, deudas y gastos en 2 min.")}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-white/70 shrink-0" />
            </CardContent>
          </Card>
        </button>
      )}

      {/* ═══ TWO COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── COLUMNA IZQUIERDA: Árbol + Obligaciones (3/5) ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Árbol Kiri */}
          <Link href="/jardin" className="block">
          <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <TreePine className="h-4 w-4 text-emerald-600" />{tr("Tu árbol Kiri")}</h2>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full">{tr("Nivel {0}", [treeLevel])}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="h-40 bg-gradient-to-b from-sky-100 to-green-50 dark:from-sky-950/30 dark:to-green-950/20 rounded-2xl flex items-end justify-center relative overflow-hidden">
                  <div className="absolute bottom-0 inset-x-0 h-1/4 bg-gradient-to-t from-emerald-200/60 to-transparent dark:from-emerald-900/30" />
                  <div className="text-6xl mb-4 select-none" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))" }}>
                    {treeLevel >= 4 ? "🌳" : treeLevel >= 3 ? "🌲" : treeLevel >= 2 ? "🌿" : "🌱"}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="font-bold text-sm">
                      {treeLevel >= 4 ? tr("¡Tu árbol está en plena floración!") :
                       treeLevel >= 3 ? tr("¡Tu árbol está creciendo!") :
                       treeLevel >= 2 ? tr("Sigue manteniendo buenos hábitos.") :
                       tr("Riega tu árbol cumpliendo tus metas.")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">{tr("Sigue manteniendo buenos hábitos y verás grandes resultados.")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>{tr("Siguiente nivel")}</span>
                      <span>{treeLevelPct}%</span>
                    </div>
                    <Progress value={treeLevelPct} className="h-2" indicatorClassName="bg-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-bold">{tr("Racha: {0} {1} 🔥", [streakActual, incomeFrequency === "quincenal" ? tr("quincenas") : tr("meses")])}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </Link>

          {/* Distribución de presupuesto (Donut) — debajo del árbol */}
          <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-5">
              <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyclon-lavender" />{tr("Distribución de tu presupuesto")}</h2>
              <div className="grid grid-cols-2 gap-4 items-center">
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {/* Lo que se reparte (el ingreso del periodo): antes decía "Total"
                        con el saldo de la billetera y las partes no sumaban eso */}
                    <span className="text-[9px] text-muted-foreground font-medium">{tr("Del periodo")}</span>
                    <OdometerAmount value={pieData.reduce((a, p) => a + p.amount, 0)} formatAmount={formatAmount} className="text-sm font-black" />
                  </div>
                </div>
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
              <div className={cn(
                "mt-4 rounded-2xl p-3 flex items-start gap-2",
                realAlloc.obligPct >= 100 ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40" :
                realAlloc.obligPct >= 70 ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40" :
                "bg-emerald-50 dark:bg-emerald-950/20"
              )}>
                <span className="text-lg shrink-0">{realAlloc.obligPct >= 100 ? "🚨" : realAlloc.obligPct >= 70 ? "⚠️" : "🌱"}</span>
                <div>
                  <p className={cn("text-[11px] font-bold",
                    realAlloc.obligPct >= 100 ? "text-red-700 dark:text-red-300" :
                    realAlloc.obligPct >= 70 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
                  )}>
                    {realAlloc.obligPct >= 100 ? tr("Alerta: Obligaciones superan ingresos") :
                     realAlloc.obligPct >= 70 ? tr("Navegando con poco margen") : tr("¡Vas por buen camino! 🌿")}
                  </p>
                  <p className={cn("text-[10px] mt-0.5", realAlloc.obligPct >= 100 ? "text-red-600/80" : "text-muted-foreground")}>
                    {realAlloc.obligPct >= 100 ? tr("{0}% de carga.", [Math.round(realAlloc.obligPct)]) :
                     realAlloc.obligPct >= 70 ? tr("El {0}% va a obligaciones.", [Math.round(realAlloc.obligPct)]) :
                     tr("Distribución inteligente activa.")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── COLUMNA DERECHA: Estadísticas de gasto + Estrategia (2/5) ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Estadísticas rápidas de gasto — al lado del árbol */}
          <SpendingStatsGrid />

          {/* Estrategias para salir de deudas */}
          {recommendations?.strategies && debts.length > 0 && (
            <div className="space-y-3">
              {realAlloc.obligPct >= 100 && recommendations.strategies && (
                <Card className="border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 rounded-2xl">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">{tr("🎯 Estrategia sugerida: {0}", [recommendations.strategies.avalancheWins ? tr("Avalancha") : tr("Bola de Nieve")])}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {recommendations.strategies.avalancheWins
                        ? tr("Ataca primero \"{0}\".", [recommendations.strategies.avalanche.pasos[0]?.nombre ?? tr("tu deuda más pesada")])
                        : tr("Empieza por \"{0}\".", [recommendations.strategies.snowball.pasos[0]?.nombre ?? tr("tu deuda más pequeña")])}
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

      {/* ═══ DISTRIBUCIÓN POR CATEGORÍA — misma gráfica de Balance ═══ */}
      <CategoryDistributionCard verMas={{ href: "/balance", label: tr("Ver en Balance") }} />

      {/* ═══ TOP MAYORES CONSUMOS ═══ */}
      <TopConsumosSection />

      {/* Botón flotante de acción principal (mobile) */}
      <Link href="/gestion" className="lg:hidden block">
        <Button className="w-full h-14 rounded-2xl bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white font-bold text-base shadow-xl shadow-cyclon-lavender/30 gap-2">
          <Wallet className="h-5 w-5" />{" "}{tr("Registrar Ingreso")}</Button>
      </Link>
    </div>
  )
}

// ─── Period Card ──────────────────────────────────────────────────────────────

function PeriodCard({ frequency, diasCobro }: { frequency: string; diasCobro: string }) {
  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Parse payment days (e.g., "1,16" or "15,30")
  const days = diasCobro.split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d)).sort((a, b) => a - b)

  // El periodo va del último día de pago (hoy incluido) al día antes del
  // siguiente, con fechas reales. Antes la quincena 2 salía "día 30 - 30" (en
  // realidad termina el 14 del mes siguiente) y entre el 1 y el 14 decía
  // "Quincena 1 (día 15 - 29)" con el cobro el 30, cuando seguía la quincena 2.
  // Un día de pago que no existe en el mes (30 en febrero) cae en el último.
  const quincenal = frequency === "quincenal" && days.length >= 2
  const diasUsados = quincenal ? days.slice(0, 2) : [days[0] || 1]
  const fechaReal = (m: number, d: number) => new Date(currentYear, m, Math.min(d, new Date(currentYear, m + 1, 0).getDate()))
  const fechas = [-1, 0, 1].flatMap(k => diasUsados.map((d, i) => ({ fecha: fechaReal(currentMonth + k, d), i })))
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
  const hoy = new Date(currentYear, currentMonth, currentDay)
  const inicio = [...fechas].reverse().find(f => f.fecha <= hoy) ?? fechas[0]
  const nextPayDate = (fechas.find(f => f.fecha > hoy) ?? fechas[fechas.length - 1]).fecha
  const fin = new Date(nextPayDate.getFullYear(), nextPayDate.getMonth(), nextPayDate.getDate() - 1)
  const fmtDia = (d: Date) => d.toLocaleDateString(localeFecha(), { day: "numeric", month: "short" })
  const periodLabel = quincenal
    ? tr("Quincena {0} ({1} – {2})", [inicio.i + 1, fmtDia(inicio.fecha), fmtDia(fin)])
    : tr("Periodo mensual ({0} – {1})", [fmtDia(inicio.fecha), fmtDia(fin)])

  // Calculate days left
  const diffMs = nextPayDate.getTime() - now.getTime()
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

  const nextPayLabel = nextPayDate.toLocaleDateString(localeFecha(), { day: "numeric", month: "short" })

  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-cyclon-sky/10 flex items-center justify-center text-cyclon-sky">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold">{periodLabel}</p>
            <p className="text-[10px] text-muted-foreground">{tr("Próximo cobro: {0}", [nextPayLabel])}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-foreground">{daysLeft}</p>
          <p className="text-[9px] text-muted-foreground">{tr("días restantes")}</p>
        </div>
      </CardContent>
    </Card>
  )
}
