"use client"

import { useEffect, useRef } from "react"
import { usePlan } from "@/lib/plan-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sparkles, CheckCircle2 } from "lucide-react"
import { useAppContext } from "@/lib/app-context"

export function PlanWelcomeModal() {
  const { welcomePackage, welcomePlanPrice, dismissWelcome } = usePlan()
  const { addFixedExpense } = useFinanceData()
  const { formatAmount } = useAppContext()
  const registeredRef = useRef(false)

  // Registrar el gasto fijo del plan automáticamente al activarse
  useEffect(() => {
    if (!welcomePackage || !welcomePlanPrice || registeredRef.current) return
    registeredRef.current = true

    const today = new Date()
    const diaPago = String(today.getDate())

    addFixedExpense({
      nombre: `Kiri Finance ${welcomePackage}`,
      monto: welcomePlanPrice,
      fechaCorte: diaPago,
      // La suscripción de Kiri se cobra mensual siempre — no depende de con
      // qué frecuencia le pagan a el usuario (quincenal/semanal rompería el
      // cálculo de montoPorPeriodo si se atara a incomeFrequency).
      frecuencia: "mensual",
      pagoAutomatico: true,
      renovacionAuto: true,
      // El usuario acaba de activar/pagar el plan AHORA — ese pago cubre el
      // periodo actual, así que no debe nacer "vencido". Sin esto, apenas
      // pasaba un día (o incluso el mismo día, según el momento del webhook
      // de Authoriza vs. cuándo el usuario abre la app) el gasto quedaba
      // marcado como vencido de forma automática, sin que el usuario hubiera
      // hecho nada mal — el próximo cobro real es el mes siguiente.
      yaPagoEstePeriodo: true,
    })
  }, [welcomePackage, welcomePlanPrice, addFixedExpense])

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

          {/* Confirmación del gasto fijo registrado */}
          {welcomePlanPrice && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Gasto fijo registrado automáticamente
                </p>
              </div>
              <div className="pl-6 space-y-0.5">
                <p className="text-[11px] text-foreground">
                  <span className="font-medium">Kiri Finance {welcomePackage}</span> — {formatAmount(welcomePlanPrice)}/mes
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Se agregó a tus obligaciones para que no pierdas de vista este compromiso.
                </p>
              </div>
            </div>
          )}

          <div className="bg-kiri-emerald/8 rounded-2xl p-4">
            <p className="text-kiri-forest dark:text-kiri-emerald text-xs leading-relaxed">
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
