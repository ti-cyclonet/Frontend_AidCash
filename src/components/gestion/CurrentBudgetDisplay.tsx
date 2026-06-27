"use client"

import { Wallet, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface CurrentBudgetDisplayProps {
  cashBalance: number
  formatAmount: (n: number) => string
  /** Callback para resetear el saldo a 0 */
  onReset?: () => void
  isResetting?: boolean
}

export function CurrentBudgetDisplay({
  cashBalance,
  formatAmount,
  onReset,
  isResetting = false,
}: CurrentBudgetDisplayProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      {/* Etiqueta */}
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
        <Wallet className="h-3 w-3" />
        Saldo disponible
      </p>

      {/* Monto */}
      <div
        className={cn(
          "min-w-[120px] text-right px-4 py-2 rounded-2xl transition-colors",
          cashBalance > 0
            ? "bg-cyclon-lavender/10"
            : "bg-muted/50"
        )}
      >
        <p
          className={cn(
            "text-xl font-black leading-none",
            cashBalance > 0 ? "text-cyclon-lavender" : "text-muted-foreground"
          )}
        >
          {cashBalance > 0 ? formatAmount(cashBalance) : "—"}
        </p>
      </div>

      {/* Botón de reset — solo visible si hay saldo */}
      {cashBalance > 0 && onReset && (
        <button
          onClick={onReset}
          disabled={isResetting}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-0.5"
          aria-label="Reiniciar saldo"
        >
          <RefreshCw className={cn("h-2.5 w-2.5", isResetting && "animate-spin")} />
          Reiniciar saldo
        </button>
      )}
    </div>
  )
}
