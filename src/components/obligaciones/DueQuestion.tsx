"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { getNextPaymentInfo } from "@/lib/payment-schedule"

export type DueQuestionKind = "vencido" | "hoy"

/**
 * ¿Hay que preguntar por la cuota de ESTE periodo? Sí cuando, con el día de
 * pago ingresado, la obligación saldría vencida o venciendo hoy — si no se
 * pregunta, nace (o queda, al editar) marcada "vencida" con una fecha que a
 * lo mejor ya se resolvió o que todavía no le aplica.
 */
export function useDueQuestion(diasPago: string, isQuincenal: boolean, enabled = true): DueQuestionKind | null {
  return useMemo(() => {
    if (!enabled || !diasPago) return null
    const days = diasPago.split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 1 && d <= 31)
    if (days.length === 0) return null
    const info = getNextPaymentInfo(days.join(","), false, isQuincenal)
    if (info.status === "vencido") return "vencido"
    if (info.status === "proximo" && info.daysUntil === 0) return "hoy"
    return null
  }, [diasPago, isQuincenal, enabled])
}

/**
 * Las tres respuestas posibles:
 *  - "Sí, ya la pagué" → se siembra un pago marcador (no toca la billetera).
 *  - "No, está vencida" → queda vencida (ninguna de las dos marcas).
 *  - "Es nueva, inicia el próximo periodo" → no pagada ni vencida; su primer
 *    cobro real es el próximo periodo (activoDesdePeriodo en el backend).
 */
export function DueQuestion({ kind, yaPago, nueva, onChange, isEdit }: {
  kind: DueQuestionKind
  yaPago: boolean
  nueva: boolean
  onChange: (v: { yaPago: boolean; nueva: boolean }) => void
  isEdit?: boolean
}) {
  return (
    <div className="rounded-2xl border-2 border-amber-400/30 bg-amber-500/5 p-3 space-y-2">
      <p className="text-xs font-bold">
        {kind === "hoy"
          ? "Esta cuota vence hoy. ¿Ya pagaste?"
          : isEdit
            ? "Con este día de pago, la cuota de este periodo ya venció. ¿Ya la pagaste?"
            : "El día de pago de este periodo ya pasó. ¿Ya pagaste esta cuota?"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ yaPago: true, nueva: false })}
          className={cn("h-9 rounded-xl text-xs font-bold border-2 transition-colors",
            yaPago ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
          )}
        >
          {kind === "hoy" ? "Sí, ya pagué" : "Sí, ya la pagué"}
        </button>
        <button
          type="button"
          onClick={() => onChange({ yaPago: false, nueva: false })}
          className={cn("h-9 rounded-xl text-xs font-bold border-2 transition-colors",
            (!yaPago && !nueva) ? "bg-red-500 text-white border-red-500" : "border-muted text-muted-foreground hover:border-red-400/40"
          )}
        >
          {kind === "hoy" ? "No, vence hoy" : "No, está vencida"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onChange({ yaPago: false, nueva: true })}
        className={cn("w-full h-9 rounded-xl text-xs font-bold border-2 transition-colors",
          nueva ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle" : "border-muted text-muted-foreground hover:border-cyclon-periwinkle/40"
        )}
      >
        {isEdit ? "Todavía no me la cobran (inicia el próximo periodo)" : "Es una obligación nueva (inicia el próximo periodo)"}
      </button>
      {yaPago && (
        <p className="text-[9px] text-muted-foreground">
          Queda como pagada este periodo sin descontar de tu billetera (la pagaste por fuera de Kiri).
        </p>
      )}
    </div>
  )
}
