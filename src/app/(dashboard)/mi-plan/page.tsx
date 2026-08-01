"use client"

import { usePlan } from "@/lib/plan-context"
import {
  Check, Sparkles, Crown, ArrowRight, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || "https://kirifinance.app"

// PLUS exclusive benefits for the highlight section
const PLUS_BENEFITS = [
  { title: "Asistente IA", desc: "Coach financiero personal 24/7" },
  { title: "Reportes PDF/Excel", desc: "Exporta y analiza tus finanzas" },
  { title: "Bolsillos compartidos", desc: "Ahorra junto a familia y amigos" },
  { title: "Préstamos P2P", desc: "Presta y pide entre contactos" },
  { title: "Estrategias de deuda", desc: "Bola de nieve y avalancha" },
  { title: "Autogestión de facturas", desc: "Gestiona tu facturación en FactoNet" },
]

export default function MiPlanPage() {
  const { plan, loading: planLoading } = usePlan()

  if (planLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  const isPlus = plan?.planName?.toLowerCase().includes("plus")

  const handleGoToLanding = () => {
    window.open(`${LANDING_URL}/#planes`, "_blank")
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mi Plan</h1>
          <p className="text-muted-foreground mt-1">
            {plan?.hasPlan
              ? `Tu plan actual: ${plan.planName}`
              : "No tienes un plan activo"}
          </p>
        </div>
        {!isPlus && (
          <Button
            onClick={handleGoToLanding}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Cambiar a KIRI PLUS
            <ExternalLink className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Current plan info (for PLUS users) */}
      {isPlus && (
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">KIRI PLUS</h2>
              <p className="text-sm text-muted-foreground">
                Tienes acceso a todas las funcionalidades
              </p>
            </div>
            <Badge className="ml-auto bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Activo
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PLUS_BENEFITS.map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>{benefit.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLUS Benefits Hero (only if user is NOT on PLUS) */}
      {!isPlus && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-amber-50 dark:from-primary/10 dark:via-primary/5 dark:to-amber-900/10 p-6 md:p-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl font-bold">Desbloquea KIRI PLUS</h2>
            </div>
            <p className="text-muted-foreground text-sm mb-6 max-w-lg">
              Accede a todas las herramientas de Kiri Finance. Tu cuenta se integrará
              automáticamente con FactoNet para autogestión de facturación.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {PLUS_BENEFITS.map((benefit, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/50 dark:border-white/10"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{benefit.title}</p>
                    <p className="text-xs text-muted-foreground">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button
                size="lg"
                onClick={handleGoToLanding}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Cambiar a KIRI PLUS
                <ArrowRight className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                $29.900 / mes
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
