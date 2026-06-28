"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Plus, RefreshCw, Wallet, Zap, Info, AlertTriangle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { userApi, WalletState } from "@/lib/api-client"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { getPeriodData } from "@/lib/period-filter"
import { analyzeFinances, AlertLevel } from "@/lib/recommendations"

const POCKETS = [
  {
    key: "ahorro" as const, allocKey: "savingsPct" as const,
    title: "Ahorro", subtitle: "Tu futuro te lo agradecerá", emoji: "💚",
    bg: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20",
    ringStroke: "stroke-emerald-400", ringBg: "stroke-emerald-100 dark:stroke-emerald-900/40",
    badgeBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    illustration: "🐷",
  },
  {
    key: "obligaciones" as const, allocKey: "obligationsPct" as const,
    title: "Obligaciones", subtitle: "Lo importante primero", emoji: "🔒",
    bg: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20",
    ringStroke: "stroke-amber-400", ringBg: "stroke-amber-100 dark:stroke-amber-900/40",
    badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    illustration: "📋",
  },
  {
    key: "libre" as const, allocKey: "dailyFreePct" as const,
    title: "Gasto libre", subtitle: "Disfruta tu dinero sin culpa", emoji: "😎",
    bg: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/20",
    ringStroke: "stroke-blue-400", ringBg: "stroke-blue-100 dark:stroke-blue-900/40",
    badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    illustration: "🎮",
  },
  {
    key: "endeudamiento" as const, allocKey: "debtCapacityPct" as const,
    title: "Endeudamiento", subtitle: "Menos deuda, más libertad", emoji: "💪",
    bg: "bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20",
    ringStroke: "stroke-purple-400", ringBg: "stroke-purple-100 dark:stroke-purple-900/40",
    badgeBg: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    illustration: "💳",
  },
] as const

export function BilleteraTab() {
  const { formatAmount, income, incomeFrequency, user } = useAppContext()
  const { debts, fixedExpenses, extraIncomes } = useFinanceData()
  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [monto, setMonto] = useState("")
  const [tipo, setTipo] = useState<"salario" | "extra">("salario")
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) })
  }, [])

  const handleRegisterIncome = async () => {
    if (!monto || Number(monto) <= 0) return
    setSaving(true)
    const { data } = await userApi.walletIncome(Number(monto), tipo)
    if (data) setWallet(data.wallet)
    setSaving(false)
    setIncomeOpen(false)
    setMonto("")
  }

  const handleReset = async () => {
    setResetting(true)
    const { data } = await userApi.walletReset()
    if (data) setWallet(data.wallet)
    setResetting(false)
  }

  const total = wallet.cashBalance
  const pocketValues: Record<string, number> = {
    ahorro: wallet.ahorro, obligaciones: wallet.obligaciones,
    libre: wallet.libre, endeudamiento: wallet.endeudamiento,
  }

  // ── Proyección: calcula los % ideales basados en el sueldo fijo (la RUTA) ──
  const totalExtraIncome = extraIncomes.reduce((acc, e) => acc + e.monto, 0)
  const { effectiveIncome, totalObligations, periodDebts } = useMemo(
    () => getPeriodData(income, totalExtraIncome, debts, fixedExpenses, incomeFrequency),
    [income, totalExtraIncome, debts, fixedExpenses, incomeFrequency]
  )
  const allocation = useMemo(
    () => effectiveIncome > 0 ? calculateBudgetAllocation(effectiveIncome, totalObligations) : null,
    [effectiveIncome, totalObligations]
  )

  // Porcentajes del embudo (proyección)
  const projectedPcts: Record<string, number> = allocation ? {
    ahorro: Math.round(allocation.savingsPct),
    obligaciones: Math.round(allocation.obligationsPct),
    libre: Math.round(allocation.dailyFreePct),
    endeudamiento: Math.round(allocation.debtCapacityPct),
  } : { ahorro: 20, obligaciones: 50, libre: 15, endeudamiento: 15 }

  // Recomendaciones unificadas
  const recommendations = useMemo(
    () => allocation ? analyzeFinances(allocation, periodDebts, incomeFrequency) : null,
    [allocation, periodDebts, incomeFrequency]
  )

  // Determinar estado general para el bloque unificado
  const hasAlerts = recommendations && recommendations.alerts.length > 0
  const topAlert = hasAlerts ? recommendations!.alerts[0] : null
  const isHealthy = !hasAlerts && allocation && !allocation.isOverloaded && !allocation.isTight

  return (
    <div className="space-y-5">
      {/* Hero: Saldo Real Total */}
      <Card className="border-none bg-gradient-to-br from-kiri-forest to-kiri-emerald rounded-3xl shadow-xl overflow-hidden">
        <CardContent className="p-6 text-center relative">
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
            ¡Hola, {user.nombre?.split(" ")[0] || "Usuario"}! 👋
          </p>
          <p className="text-white/80 text-[11px] mt-0.5">Este es tu presupuesto total</p>
          <p className="text-4xl font-black text-white mt-2 drop-shadow-sm">
            {total > 0 ? formatAmount(total) : "$0"}
          </p>
          {total > 0 && (
            <button onClick={handleReset} disabled={resetting}
              className="mt-2 text-white/40 hover:text-white/70 text-[10px] flex items-center gap-1 mx-auto transition-colors">
              <RefreshCw className={cn("h-2.5 w-2.5", resetting && "animate-spin")} /> Reiniciar
            </button>
          )}
        </CardContent>
      </Card>

      {/* Botón Registrar Ingreso */}
      <Button onClick={() => setIncomeOpen(true)}
        className="w-full h-14 rounded-2xl bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white font-bold text-base shadow-xl shadow-cyclon-lavender/25 gap-2">
        <Plus className="h-5 w-5" /> Registrar Ingreso
      </Button>

      {/* Sección título */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold flex items-center gap-2">Tu presupuesto 💰</h2>
      </div>

      {/* Grid 4 tarjetas — porcentaje es de la PROYECCIÓN */}
      <div className="grid grid-cols-2 gap-3">
        {POCKETS.map(pocket => (
          <PocketCard
            key={pocket.key}
            pocket={pocket}
            amount={pocketValues[pocket.key]}
            pct={projectedPcts[pocket.key]}
            formatAmount={formatAmount}
          />
        ))}
      </div>

      {/* ── Bloque unificado: Estado + Recomendaciones ── */}
      <Card className={cn(
        "border-none rounded-2xl overflow-hidden",
        isHealthy
          ? "bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20"
          : topAlert?.level === "critical"
            ? "bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20"
            : topAlert?.level === "warning"
              ? "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20"
              : "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20"
      )}>
        <CardContent className="p-4 flex items-start gap-3">
          {isHealthy ? (
            <>
              <span className="text-2xl shrink-0">🌱</span>
              <div>
                <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                  ¡Vas por buen camino! 🚀
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tu presupuesto está equilibrado. Tienes margen para ahorrar, para el día a día, y para metas nuevas. ¡Sigue así!
                </p>
              </div>
            </>
          ) : topAlert ? (
            <>
              <div className={cn("shrink-0 mt-0.5", topAlert.level === "critical" ? "text-red-500" : topAlert.level === "warning" ? "text-amber-600" : "text-blue-500")}>
                {topAlert.level === "critical" ? <XCircle className="h-5 w-5" /> : topAlert.level === "warning" ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
              </div>
              <div>
                <p className={cn("font-bold text-sm", topAlert.level === "critical" ? "text-red-700 dark:text-red-300" : topAlert.level === "warning" ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300")}>
                  {topAlert.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{topAlert.message}</p>
              </div>
            </>
          ) : (
            <>
              <span className="text-2xl shrink-0">🌱</span>
              <div>
                <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">Tu billetera está lista</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Registra un ingreso para empezar a distribuir tu dinero automáticamente.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Registrar Ingreso */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-cyclon-lavender" /> Registrar Ingreso
            </DialogTitle>
            <DialogDescription>
              Se distribuirá automáticamente en tus 4 bolsillos según tu distribución inteligente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "salario" as const, label: "Sueldo", icon: <Wallet className="h-4 w-4" /> },
                  { value: "extra" as const, label: "Extra", icon: <Zap className="h-4 w-4" /> },
                ]).map(opt => (
                  <button key={opt.value} onClick={() => setTipo(opt.value)} className={cn(
                    "flex items-center justify-center gap-2 h-11 rounded-xl border-2 font-bold text-sm transition-colors",
                    tipo === opt.value ? "border-cyclon-lavender bg-cyclon-lavender/5 text-cyclon-lavender" : "border-muted text-muted-foreground"
                  )}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monto recibido</Label>
              <MoneyInput value={monto} onChange={setMonto} className="h-16 text-3xl font-bold bg-muted/30 border-none rounded-2xl" placeholder="0" autoFocus />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIncomeOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegisterIncome} disabled={saving || !monto || Number(monto) <= 0}
              className="bg-cyclon-lavender text-white font-bold rounded-xl px-8">
              {saving ? "Distribuyendo..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tarjeta de bolsillo ──────────────────────────────────────────────────────

function PocketCard({ pocket, amount, pct, formatAmount }: {
  pocket: typeof POCKETS[number]
  amount: number
  pct: number
  formatAmount: (n: number) => string
}) {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <Card className={cn("border-none rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all", pocket.bg)}>
      <CardContent className="p-4 space-y-2 relative min-h-[170px]">
        {/* Ilustración decorativa */}
        <div className="absolute top-2 right-2 text-3xl opacity-80 select-none pointer-events-none">
          {pocket.illustration}
        </div>

        {/* Título */}
        <div>
          <h3 className="font-black text-sm leading-tight">{pocket.title}</h3>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            {pocket.subtitle} {pocket.emoji}
          </p>
        </div>

        {/* Monto real */}
        <p className="text-xl font-black leading-none mt-1">{formatAmount(amount)}</p>

        {/* Badge porcentaje proyectado + Donut */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", pocket.badgeBg)}>
              {pct}%
            </span>
            <p className="text-[9px] text-muted-foreground mt-1">de tu presupuesto</p>
          </div>

          {/* Mini donut */}
          <div className="relative h-12 w-12">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r={radius} fill="none" strokeWidth="5"
                className={pocket.ringBg} />
              <circle cx="28" cy="28" r={radius} fill="none" strokeWidth="5"
                className={pocket.ringStroke}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] font-black">{pct}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
