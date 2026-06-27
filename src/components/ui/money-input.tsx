"use client"

import { useCallback, useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { useAppContext, Currency } from "@/lib/app-context"
import { cn } from "@/lib/utils"

/**
 * Separador de miles según la moneda.
 * - COP, EUR: punto (1.000.000)
 * - USD, MXN: coma (1,000,000)
 */
function getThousandsSeparator(currency: Currency): string {
  return currency === "COP" || currency === "EUR" ? "." : ","
}

/** Remueve todo lo que no sea dígito */
function stripNonDigits(str: string): string {
  return str.replace(/\D/g, "")
}

/** Formatea un número con separador de miles */
function formatWithSeparator(value: string, separator: string): string {
  const digits = stripNonDigits(value)
  if (!digits) return ""
  // Agrega separadores de miles de derecha a izquierda
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}

interface MoneyInputProps {
  /** Valor numérico (sin formato). Controlado externamente. */
  value: string
  /** Callback con el valor numérico limpio (sin separadores) */
  onChange: (numericValue: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  /** Si true, muestra el símbolo $ a la izquierda */
  showCurrency?: boolean
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
  className,
  autoFocus,
  showCurrency = true,
}: MoneyInputProps) {
  const { currency } = useAppContext()
  const separator = getThousandsSeparator(currency)

  // El display formateado se deriva del valor numérico
  const [display, setDisplay] = useState(() => formatWithSeparator(value, separator))

  // Sincronizar display cuando el valor externo cambia
  useEffect(() => {
    setDisplay(formatWithSeparator(value, separator))
  }, [value, separator])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const digits = stripNonDigits(raw)

    // Actualiza el display formateado
    setDisplay(formatWithSeparator(digits, separator))

    // Propaga el valor numérico limpio hacia arriba
    onChange(digits)
  }, [separator, onChange])

  if (showCurrency) {
    return (
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">$</span>
        <Input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn("pl-10", className)}
        />
      </div>
    )
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={className}
    />
  )
}
