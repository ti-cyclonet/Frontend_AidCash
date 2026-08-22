"use client"

import { usePlan } from "@/lib/plan-context"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

export function PlanWelcomeModal() {
  const { welcomePackage, dismissWelcome } = usePlan()

  if (!welcomePackage) return null

  return (
    <Dialog open={!!welcomePackage} onOpenChange={(v) => { if (!v) dismissWelcome() }}>
      <DialogContent className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-br from-kiri-forest via-kiri-emerald to-kiri-sage px-6 pt-10 pb-8 text-center">
          <div className="h-20 w-20 bg-white/15 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="h-10 w-10 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-black text-white">¡En hora buena! 🎉</h2>
          <p className="text-white/70 text-sm mt-1">Tu plan {welcomePackage} está activo</p>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-6 text-center space-y-4">
          <p className="text-foreground text-sm leading-relaxed">
            Diste un paso enorme hacia el control total de tus finanzas. Admiramos tu decisión de
            invertir en ti y en tu futuro.
          </p>
          <div className="bg-kiri-emerald/8 rounded-2xl p-4">
            <p className="text-kiri-forest text-xs leading-relaxed">
              💚 Ya tienes acceso a todas las herramientas premium de Kiri. Recuerda: las mejores
              decisiones financieras no son las más grandes, sino las más constantes.
            </p>
          </div>
          <Button
            onClick={dismissWelcome}
            className="w-full h-12 rounded-2xl bg-kiri-emerald hover:bg-kiri-sage text-white font-bold mt-2"
          >
            ¡Empecemos!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
