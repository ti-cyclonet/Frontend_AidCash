"use client"

import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useStreaks } from "@/hooks/use-streaks"
import { GamifiedGarden } from "@/components/ui/gamified-garden"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { Card, CardContent } from "@/components/ui/card"
import { Sprout, Trophy, Flame, Star } from "lucide-react"
import { cn } from "@/lib/utils"

export default function JardinPage() {
  const { income, incomeFrequency } = useAppContext()
  const { debts, fixedExpenses, totalAhorrado, totalImpulseThisPeriod } = useFinanceData()
  const { streakActual, streakMejor, badgesDesbloqueados, loading: streakLoading } = useStreaks(incomeFrequency)
  const { allocation } = usePeriodBudget()

  const growthLevel = debts.length === 0 && totalAhorrado > 0 ? 4
    : totalAhorrado > 0 ? 3
    : income > 0 ? 2
    : 1

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-kiri-emerald">Kiri Garden</h1>
        <p className="text-muted-foreground text-sm">Tu árbol crece con tus buenos hábitos financieros.</p>
      </header>

      {/* Garden visualization */}
      <GamifiedGarden
        isActionPositive={false}
        freeSpendingExceeded={allocation ? totalImpulseThisPeriod > allocation.dailyFreeAmount : false}
        debtPercentage={allocation?.obligationsPct ?? 0}
        hasActiveLoan={debts.length > 0}
        emergencyFundComplete={false}
        growthLevel={growthLevel}
      />

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex flex-col gap-2">
            <div className="h-9 w-9 bg-kiri-mint/30 rounded-xl flex items-center justify-center text-kiri-emerald">
              <Flame className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Racha actual</p>
            <p className="text-xl font-bold">{streakActual} {incomeFrequency === 'quincenal' ? 'quincenas' : 'meses'}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex flex-col gap-2">
            <div className="h-9 w-9 bg-kiri-mint/30 rounded-xl flex items-center justify-center text-kiri-emerald">
              <Trophy className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Mejor racha</p>
            <p className="text-xl font-bold">{streakMejor} {incomeFrequency === 'quincenal' ? 'quincenas' : 'meses'}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex flex-col gap-2">
            <div className="h-9 w-9 bg-kiri-mint/30 rounded-xl flex items-center justify-center text-kiri-emerald">
              <Star className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Insignias</p>
            <p className="text-xl font-bold">{badgesDesbloqueados.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Growth level indicator */}
      <Card className="border-none shadow-sm bg-kiri-emerald/5">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 bg-kiri-emerald rounded-2xl flex items-center justify-center">
            <Sprout className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">
              Etapa: {growthLevel === 1 ? "Semilla" : growthLevel === 2 ? "Brote" : growthLevel === 3 ? "Arbusto" : "Gran Kiri"} 🌱
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {growthLevel === 1 && "Configura tu ingreso para empezar a crecer"}
              {growthLevel === 2 && "Tu jardín comienza a brotar. ¡Sigue así!"}
              {growthLevel === 3 && "Tienes ahorro acumulado. Tu árbol crece fuerte."}
              {growthLevel === 4 && "Sin deudas y con ahorro. ¡Tu Kiri está en plena floración!"}
            </p>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(level => (
              <div
                key={level}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  level <= growthLevel ? "bg-kiri-emerald" : "bg-border"
                )}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Badges section */}
      {badgesDesbloqueados.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Insignias desbloqueadas</h3>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
            {badgesDesbloqueados.map(badgeId => (
              <div key={badgeId} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-2xl">🏅</p>
                <p className="text-[10px] font-medium text-muted-foreground mt-1 truncate">{badgeId.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
