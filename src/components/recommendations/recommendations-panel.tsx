"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertTriangle, XCircle, Info, TrendingDown, Snowflake, PiggyBank, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { RecommendationResult, AlertLevel } from "@/lib/recommendations"
import { useAppContext } from "@/lib/app-context"
import Link from "next/link"

interface Props {
  result: RecommendationResult
}

const LEVEL_STYLES: Record<AlertLevel, { bg: string; border: string; icon: React.ReactNode; text: string }> = {
  info:     { bg: "bg-cyclon-sky/10",     border: "border-cyclon-sky/30",     icon: <Info className="h-4 w-4" />,          text: "text-cyclon-periwinkle" },
  warning:  { bg: "bg-yellow-50",          border: "border-yellow-300/50",      icon: <AlertTriangle className="h-4 w-4" />, text: "text-yellow-700" },
  critical: { bg: "bg-destructive/10",     border: "border-destructive/30",     icon: <XCircle className="h-4 w-4" />,       text: "text-destructive" },
}

export function RecommendationsPanel({ result }: Props) {
  const { formatAmount } = useAppContext()
  const [pauseModalOpen, setPauseModalOpen] = useState(false)
  const { alerts, snowballDebts, suggestPauseSavings, savingsToRedirect } = result

  if (alerts.length === 0 && snowballDebts.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <TrendingDown className="h-4 w-4" />
        Recomendaciones
      </h2>

      {/* ── Alertas ── */}
      {alerts.map(alert => {
        const style = LEVEL_STYLES[alert.level]
        return (
          <Card key={alert.id} className={cn("border rounded-2xl shadow-none", style.bg, style.border)}>
            <CardContent className="p-4 flex gap-3 items-start">
              <div className={cn("shrink-0 mt-0.5", style.text)}>{style.icon}</div>
              <div className="space-y-0.5">
                <p className={cn("font-bold text-sm", style.text)}>{alert.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* ── Bola de nieve ── */}
      {snowballDebts.length > 0 && (
        <Card className="border-none bg-card shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-cyclon-sky/20 rounded-xl flex items-center justify-center text-cyclon-periwinkle shrink-0">
                <Snowflake className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-sm">Estrategia Bola de Nieve</p>
                <p className="text-[10px] text-muted-foreground">Liquida estas primero para liberar flujo de caja</p>
              </div>
            </div>
            <div className="space-y-2">
              {snowballDebts.map(({ debt, periodsToFinish, reason }) => (
                <Link href="/obligaciones" key={debt.id}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{debt.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">{reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm text-cyclon-periwinkle">{formatAmount(debt.montoTotal)}</p>
                      <p className="text-[10px] text-muted-foreground">{periodsToFinish} cuotas</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sugerir pausar ahorro ── */}
      {suggestPauseSavings && (
        <Card className="border border-cyclon-lavender/20 bg-cyclon-lavender/5 rounded-2xl shadow-none">
          <CardContent className="p-4 flex gap-3 items-start">
            <div className="h-8 w-8 bg-cyclon-lavender/20 rounded-xl flex items-center justify-center text-cyclon-lavender shrink-0 mt-0.5">
              <PiggyBank className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="font-bold text-sm text-cyclon-lavender">¿Pausar el ahorro temporalmente?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Podrías redirigir {formatAmount(savingsToRedirect)} de tu bloque de ahorro para atacar las deudas prioritarias y liberar flujo más rápido.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setPauseModalOpen(true)}
                className="h-8 rounded-xl bg-cyclon-lavender text-white font-bold text-xs px-4 hover:bg-cyclon-lavender/90"
              >
                Ver recomendación
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Modal: Pausar ahorro ── */}
      <Dialog open={pauseModalOpen} onOpenChange={setPauseModalOpen}>
        <DialogContent >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyclon-lavender">
              <PiggyBank className="h-5 w-5" />
              Pausar Ahorro Temporalmente
            </DialogTitle>
            <DialogDescription>
              Esta es una recomendación estratégica, no una acción automática.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Card className="border-none bg-muted/40 rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ahorro actual por periodo</span>
                  <span className="font-black text-cyclon-lavender">{formatAmount(savingsToRedirect)}</span>
                </div>
                <div className="border-t border-dashed border-border" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Si pausas el ahorro y destinas esos <strong>{formatAmount(savingsToRedirect)}</strong> a tus deudas prioritarias, podrías liquidarlas más rápido y recuperar capacidad de endeudamiento antes.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Una vez liquidadas las deudas críticas, retoma el ahorro con el flujo liberado.
                </p>
              </CardContent>
            </Card>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pasos sugeridos</p>
              {[
                "Ve a Deudas y aplica pagos extra a las deudas de la lista Bola de Nieve",
                "Usa el monto de ahorro como abono adicional cada periodo",
                "Cuando liquides la primera deuda, retoma el ahorro normal",
              ].map((step, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="h-5 w-5 rounded-full bg-cyclon-lavender/20 text-cyclon-lavender flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{i + 1}</div>
                  <p className="text-xs text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPauseModalOpen(false)} className="w-full bg-cyclon-lavender text-white font-bold rounded-xl h-12">
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
