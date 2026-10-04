"use client"

import { CreditCard, ShoppingBag, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { tr } from "@/lib/i18n"
import { usoCupoTras } from "@/lib/debt-utils"
import type { Debt } from "@/lib/types"

/**
 * Una tarjeta o crédito de compras como opción para pagar algo con ella: muestra
 * cuánto cupo le queda y, si se le carga `monto`, avisa ANTES de confirmar si
 * queda cerca del límite o por encima (solo aviso: el banco pudo subir el cupo).
 * Antes había cinco copias de este botón en Obligaciones, cada una mostrando
 * solo "Saldo · Cuota" y sin ninguna noción de cupo.
 */
interface Props {
  tc: Debt
  selected: boolean
  onSelect: () => void
  formatAmount: (n: number) => string
  /** Lo que se le cargaría (0 o undefined = solo mostrar el disponible) */
  monto?: number
}

export function TarjetaOpcion({ tc, selected, onSelect, formatAmount, monto = 0 }: Props) {
  const Icono = tc.tipoDeuda === "CREDITO_COMPRAS" ? ShoppingBag : CreditCard
  const tras = monto > 0 ? usoCupoTras(tc, monto) : null
  const usoActual = tc.cupoUsoPct ?? null
  const excede = tras ? tras.disponible < 0 : false
  const alto = tras ? !excede && tras.pct >= 80 : false

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full p-3 rounded-xl border text-left transition-all duration-200 active:scale-[0.99]",
        selected ? "border-amber-500 bg-amber-500/10 shadow-sm" : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
          <Icono className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{tc.nombre}</p>
          <p className="text-[10px] text-muted-foreground">
            {tc.cupoDisponible != null
              ? tr("Disponible {0} de {1}", [formatAmount(Math.max(0, tc.cupoDisponible)), formatAmount(tc.cupoTotal ?? 0)])
              : tc.saldoRestante > 0 ? tr("Debes {0} · sin cupo registrado", [formatAmount(tc.saldoRestante)]) : tr("Al día · sin cupo registrado")}
          </p>
        </div>
        <span className="text-[10px] font-bold text-amber-500 shrink-0">{selected ? "✓" : tr("Seleccionar")}</span>
      </div>

      {tc.cupoTotal != null && tc.cupoTotal > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden flex">
          <div className="h-full bg-amber-500/80 transition-all duration-500" style={{ width: `${Math.min(100, usoActual ?? 0)}%` }} />
          {tras && (
            <div
              className={cn("h-full transition-all duration-500", excede ? "bg-red-500" : "bg-amber-300")}
              style={{ width: `${Math.max(0, Math.min(100, tras.pct) - Math.min(100, usoActual ?? 0))}%` }}
            />
          )}
        </div>
      )}

      {(excede || alto) && tras && (
        <p className={cn("mt-1.5 text-[10px] font-medium flex items-start gap-1", excede ? "text-red-500" : "text-amber-600")}>
          <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
          {excede
            ? tr("Te pasarías del cupo por {0}. Puedes registrarlo igual (si tu banco te subió el cupo, actualízalo).", [formatAmount(-tras.disponible)])
            : tr("Quedarías en el {0}% del cupo: te quedarían {1}.", [tras.pct, formatAmount(tras.disponible)])}
        </p>
      )}
    </button>
  )
}
