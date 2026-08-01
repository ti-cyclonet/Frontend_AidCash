"use client"

import { usePlan } from "@/lib/plan-context"
import { Lock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

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
        Función exclusiva de KIRI PLUS
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        Esta funcionalidad no está disponible en tu plan actual
        {plan?.planName && ` (${plan.planName})`}. Actualiza para desbloquear
        todas las herramientas de Kiri Finance.
      </p>
      <Button
        onClick={() => window.open(`${process.env.NEXT_PUBLIC_LANDING_URL || "https://kirifinance.app"}/#planes`, "_blank")}
        className="gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Ver planes
      </Button>
    </div>
  )
}
