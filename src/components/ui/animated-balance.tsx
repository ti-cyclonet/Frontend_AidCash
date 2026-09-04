"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"
import { OdometerAmount } from "@/components/ui/odometer-amount"

interface AnimatedBalanceProps {
  value: number
  formatAmount: (n: number) => string
  label?: string
  showToggle?: boolean
  className?: string
}

/**
 * AnimatedBalance — Badge de saldo con efectos dinámicos
 * - El monto rueda dígito por dígito (OdometerAmount) al cambiar el valor
 * - Brilla verde cuando sube
 * - Brilla rojo cuando baja
 * - Muestra la diferencia brevemente (+$50,000 / -$100,000)
 */
export function AnimatedBalance({ value, formatAmount, label = "Saldo total", showToggle = true, className }: AnimatedBalanceProps) {
  const [hidden, setHidden] = useState(false)
  const [flash, setFlash] = useState<"up" | "down" | null>(null)
  const [diff, setDiff] = useState<number | null>(null)
  const prevValue = useRef(value)
  // El saldo arranca en 0 mientras carga y recién después salta al valor
  // real — sin este guard, ESE salto disparaba el brillo + el globito de
  // diferencia cada vez que se entraba o refrescaba la página, como si
  // fuera un movimiento real. Se absorbe en silencio el primer cambio.
  const skipNextRef = useRef(true)

  useEffect(() => {
    const prev = prevValue.current
    if (prev === value) return
    prevValue.current = value

    if (skipNextRef.current) {
      skipNextRef.current = false
      return
    }

    const direction = value > prev ? "up" : "down"
    setFlash(direction)
    setDiff(value - prev)

    const flashTimeout = setTimeout(() => setFlash(null), 1500)
    const diffTimeout = setTimeout(() => setDiff(null), 2000)

    return () => {
      clearTimeout(flashTimeout)
      clearTimeout(diffTimeout)
    }
  }, [value])

  return (
    <div className={cn(
      "relative bg-card border rounded-xl px-3 py-2 text-center shadow-sm transition-all duration-300",
      flash === "up" && "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-emerald-500/20 shadow-md",
      flash === "down" && "border-red-400 bg-red-50/50 dark:bg-red-950/20 shadow-red-500/20 shadow-md",
      !flash && "border-border/50",
      className,
    )}>
      {/* Label + toggle */}
      <div className="flex items-center justify-center gap-1">
        <p className={cn(
          "text-[9px] font-bold transition-colors duration-300",
          flash === "up" ? "text-emerald-600 dark:text-emerald-400" : flash === "down" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
        )}>{label}</p>
        {showToggle && (
          <button onClick={() => setHidden(v => !v)} className="text-muted-foreground/50 hover:text-muted-foreground">
            {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* Monto animado */}
      {hidden ? (
        <p className="text-sm font-black mt-0.5 text-foreground">••••••</p>
      ) : (
        <OdometerAmount
          value={value}
          formatAmount={formatAmount}
          className={cn(
            "text-sm font-black mt-0.5 transition-colors duration-300",
            flash === "up" && "text-emerald-600 dark:text-emerald-400",
            flash === "down" && "text-red-600 dark:text-red-400",
            !flash && "text-foreground",
          )}
        />
      )}

      {/* Indicador de diferencia */}
      {diff !== null && !hidden && (
        <p className={cn(
          "absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap animate-in fade-in zoom-in-95 duration-200",
          diff > 0 ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300" : "text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-300"
        )}>
          {diff > 0 ? `+${formatAmount(diff)}` : `-${formatAmount(Math.abs(diff))}`}
        </p>
      )}
    </div>
  )
}
