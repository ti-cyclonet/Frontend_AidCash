"use client"

import { usePlan } from "@/lib/plan-context"
import { Lock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

/** Plan desde el que viene cada función (igual que la matriz del backend). */
const PLAN_DE_FUNCION: Record<string, string> = {
  advancedReports: "KIRI PLUS", debtStrategies: "KIRI PLUS", p2pLoans: "KIRI PLUS", sharedDebts: "KIRI PLUS", sharedPockets: "KIRI PLUS",
  householdBudget: "KIRI PRO", openBanking: "KIRI PRO", receiptItems: "KIRI PRO", savedScenarios: "KIRI PRO", exclusiveBadges: "KIRI PRO", prioritySupport: "KIRI PRO",
}

interface FeatureGateProps {
  /** The feature variable name to check (e.g., 'aiCoach', 'socialConnections') */
  feature: string
  /** Content to render if the feature is enabled */
  children: React.ReactNode
  /** Optional: render a custom fallback instead of the default upgrade prompt */
  fallback?: React.ReactNode
}

/**
 * FeatureGate wraps content that requires a specific plan feature.
 * If the user's plan doesn't include the feature, it shows an upgrade prompt.
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasFeature, loading, plan } = usePlan()
  const router = useRouter()
  const planNecesario = PLAN_DE_FUNCION[feature] ?? "KIRI PLUS"

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="h-6 w-6 rounded-full border-3 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  if (hasFeature(feature)) {
    return <>{children}</>
  }

  // Feature is locked — show upgrade prompt
  if (fallback) return <>{fallback}</>

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        Función de {planNecesario}
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        Esta funcionalidad no está disponible en tu plan actual
        {plan?.planName && ` (${plan.planName})`}. Actualiza para desbloquear
        todas las herramientas de Kiri Finance.
      </p>
      <Button
        onClick={() => router.push("/mi-plan")}
        className="gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Ver {planNecesario}
      </Button>
    </div>
  )
}
