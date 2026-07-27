"use client"

import { useEffect, useState } from "react"
import { usePlan, AvailablePlan } from "@/lib/plan-context"
import { api } from "@/lib/api-client"
import { Check, X, Sparkles, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Feature definitions for display (ordered by importance)
const ALL_FEATURES = [
  { key: "budgetManagement", label: "Gestión de presupuesto" },
  { key: "debtsTracking", label: "Control de deudas" },
  { key: "fixedExpenses", label: "Gastos fijos" },
  { key: "basicReports", label: "Reportes básicos" },
  { key: "impulseExpenses", label: "Gastos hormiga" },
  { key: "savingsPockets", label: "Bolsillos de ahorro" },
  { key: "extraIncomes", label: "Ingresos extras" },
  { key: "emergencyFund", label: "Fondo de emergencia" },
  { key: "gamification", label: "Gamificación y jardín virtual" },
  { key: "advancedReports", label: "Reportes avanzados (PDF/Excel)" },
  { key: "debtStrategies", label: "Estrategias de deuda" },
  { key: "aiCoach", label: "Asistente IA financiero" },
  { key: "socialConnections", label: "Conexiones sociales" },
  { key: "sharedPockets", label: "Bolsillos compartidos" },
  { key: "p2pLoans", label: "Préstamos P2P" },
]

export default function MiPlanPage() {
  const { plan, loading: planLoading } = usePlan()
  const [availablePlans, setAvailablePlans] = useState<AvailablePlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)

  useEffect(() => {
    async function fetchPlans() {
      const { data } = await api<AvailablePlan[]>("/plan/available")
      if (data) setAvailablePlans(data)
      setLoadingPlans(false)
    }
    fetchPlans()
  }, [])

  if (planLoading || loadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  const isCurrentPlan = (planName: string) =>
    plan?.planName?.toLowerCase() === planName.toLowerCase()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Mi Plan</h1>
        <p className="text-muted-foreground mt-1">
          {plan?.hasPlan
            ? `Tu plan actual: ${plan.planName}`
            : "No tienes un plan activo"}
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {availablePlans.map((availPlan) => {
          const isCurrent = isCurrentPlan(availPlan.name)
          const isHighlighted = availPlan.isHighlighted

          return (
            <div
              key={availPlan.packageId}
              className={`relative rounded-2xl border-2 p-6 transition-all ${
                isHighlighted
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-border bg-card"
              } ${isCurrent ? "ring-2 ring-primary/50" : ""}`}
            >
              {/* Current plan badge */}
              {isCurrent && (
                <Badge className="absolute -top-3 left-4 bg-primary text-primary-foreground">
                  Tu plan actual
                </Badge>
              )}

              {/* Highlighted badge */}
              {isHighlighted && !isCurrent && (
                <Badge className="absolute -top-3 left-4 bg-amber-500 text-white">
                  <Crown className="w-3 h-3 mr-1" />
                  Recomendado
                </Badge>
              )}

              <div className="mb-4">
                <h2 className="text-xl font-bold">{availPlan.displayName}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {availPlan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-6">
                {availPlan.price > 0 ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      ${availPlan.price.toLocaleString("es-CO")}
                    </span>
                    <span className="text-muted-foreground text-sm">/ mes</span>
                  </div>
                ) : (
                  <span className="text-3xl font-bold text-green-600">
                    Gratis
                  </span>
                )}
              </div>

              {/* Features list */}
              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium">Incluye:</p>
                {availPlan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isCurrent ? (
                <Button disabled className="w-full" variant="outline">
                  Plan activo
                </Button>
              ) : (
                <Button
                  className="w-full gap-2"
                  variant={isHighlighted ? "default" : "outline"}
                >
                  <Sparkles className="w-4 h-4" />
                  {availPlan.ctaLabel}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Feature comparison table */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">
          Comparativa de funcionalidades
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 pr-4">Funcionalidad</th>
                {availablePlans.map((p) => (
                  <th key={p.packageId} className="text-center py-3 px-2">
                    {p.displayName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_FEATURES.map((feat) => (
                <tr key={feat.key} className="border-b last:border-0">
                  <td className="py-3 pr-4">{feat.label}</td>
                  {availablePlans.map((p) => {
                    // Check if this feature is listed in the plan's features array
                    const hasIt = p.features.some(
                      (f) =>
                        f.toLowerCase().includes(feat.label.toLowerCase().split(" ")[0])
                    )
                    return (
                      <td key={p.packageId} className="text-center py-3 px-2">
                        {hasIt ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-muted-foreground/40 mx-auto" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
