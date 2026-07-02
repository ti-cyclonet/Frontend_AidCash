"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PartyPopper, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

export type RecommendationType = "no_obligations" | "extra_income" | null

interface RecommendationModalProps {
  type: RecommendationType
  open: boolean
  onClose: () => void
  formatAmount?: (n: number) => string
}

/**
 * Modal inteligente que se dispara automáticamente tras registrar un ingreso
 * cuando se detectan condiciones favorables para el usuario.
 *
 * Condición A (no_obligations):
 *   Las obligaciones pendientes del periodo actual son 0.
 *   → Mensaje motivador + sugerencia de abonar a deudas futuras.
 *
 * Condición B (extra_income):
 *   El cashBalance supera el ingreso base configurado.
 *   → Mensaje de oportunidad + sugerencia de abonar extra a deudas.
 */
export function RecommendationModal({ type, open, onClose, formatAmount }: RecommendationModalProps) {
  if (!type) return null

  const config = RECOMMENDATIONS[type]

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader className="text-center space-y-3 pt-2">
          {/* Icono decorativo */}
          <div className={cn(
            "mx-auto h-16 w-16 rounded-2xl flex items-center justify-center",
            config.iconBg
          )}>
            {config.icon}
          </div>

          <DialogTitle className="text-lg font-black text-center">
            {config.title}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground text-center leading-relaxed">
            {config.message}
          </DialogDescription>
        </DialogHeader>

        {/* Sugerencia */}
        <div className={cn(
          "rounded-2xl p-4 text-center space-y-1",
          config.suggestionBg
        )}>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            💡 Sugerencia Kiri
          </p>
          <p className="text-sm font-medium">
            {config.suggestion}
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white font-bold text-sm"
          >
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Configuraciones por tipo ─────────────────────────────────────────────────

const RECOMMENDATIONS: Record<NonNullable<RecommendationType>, {
  title: string
  message: string
  suggestion: string
  icon: React.ReactNode
  iconBg: string
  suggestionBg: string
}> = {
  no_obligations: {
    title: "¡Excelente! 🎉",
    message: "No tienes obligaciones que pagar este periodo. Todo tu presupuesto está libre para avanzar en tus metas.",
    suggestion: "Puedes ir abonando a tus obligaciones futuras para salir pronto de ellas y liberar capacidad financiera.",
    icon: <PartyPopper className="h-8 w-8 text-emerald-600" />,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    suggestionBg: "bg-emerald-50 dark:bg-emerald-950/20",
  },
  extra_income: {
    title: "¡Excelente! 💰",
    message: "Recibiste más de lo esperado. Tu presupuesto total supera tu ingreso base configurado.",
    suggestion: "Puedes abonar un poco más en tus deudas para salir pronto de ellas y reducir los intereses acumulados.",
    icon: <TrendingUp className="h-8 w-8 text-cyclon-lavender" />,
    iconBg: "bg-cyclon-lavender/10",
    suggestionBg: "bg-cyclon-lavender/5",
  },
}
