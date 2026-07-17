"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"

interface AnimatedBalanceProps {
  value: number
  formatAmount: (n: number) => string
  label?: string
  showToggle?: boolean
  className?: string
}

/**
 * AnimatedBalance — Badge de saldo con efectos dinámicos
 * - Efecto de conteo al cambiar el valor
 * - Brilla verde cuando sube
 * - Brilla rojo cuando baja
 * - Muestra la diferencia brevemente (+$50,000 / -$100,000)
 */
export function AnimatedBalance({ value, formatAmount, label = "Saldo total", showToggle = true, className }: AnimatedBalanceProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [hidden, setHidden] = useState(false)
  const [flash, setFlash] = useState<"up" | "down" | null>(null)
  const [diff, setDiff] = useState<number | null>(null)
  const prevValue = useRef(value)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const prev = prevValue.current
    if (prev === value) return

    // Determinar dirección
    const direction = value > prev ? "up" : "down"
    const difference = value - prev
    setFlash(direction)
    setDiff(difference)

    // Animación de conteo
    const duration = 800 // ms
    const startTime = performance.now()
    const startVal = prev

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + (value - startVal) * eased)
      setDisplayValue(current)

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(animate)

    // Quitar flash después de 1.5s
    const flashTimeout = setTimeout(() => setFlash(null), 1500)
    // Quitar diff después de 2s
    const diffTimeout = setTimeout(() => setDiff(null), 2000)

    prevValue.current = value

    return () => {
      clearTimeout(flashTimeout)
      clearTimeout(diffTimeout)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [value])

  // Sincronizar si el componente se monta con un valor diferente
  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value
      setDisplayValue(value)
    }
  }, [])

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
      <p className={cn(
        "text-sm font-black mt-0.5 transition-colors duration-300",
        flash === "up" && "text-emerald-600 dark:text-emerald-400",
        flash === "down" && "text-red-600 dark:text-red-400",
        !flash && "text-foreground",
      )}>
        {hidden ? "••••••" : formatAmount(displayValue)}
      </p>

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
