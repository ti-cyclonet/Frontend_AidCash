"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OdometerAmount — número que rueda dígito por dígito, como un contador de
 * suscriptores en vivo (o el odómetro de un carro), en vez de simplemente
 * saltar al nuevo valor o hacer un conteo lineal.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cada dígito vive en su propia "rueda" vertical (una franja de 0-9 repetida
 * 3 veces para poder rodar hacia adelante o atrás sin quedarse sin pista) que
 * se desplaza con `translateY`. Al subir el monto, cada rueda gira HACIA
 * ADELANTE pasando por los dígitos intermedios; al bajar, gira hacia atrás.
 * Las columnas más a la izquierda arrancan un poco después que las de la
 * derecha (stagger), dando el efecto de cascada. Si el monto cruza a un
 * dígito más (ej. $999.000 → $1.000.000) aparece una columna nueva con una
 * pequeña animación de entrada; si baja de un dígito, la columna sobrante
 * desaparece al terminar la animación.
 *
 * El símbolo de moneda, separador de miles y sufijo NO se hardcodean: se
 * extraen de `formatAmount(valor)` (la misma función que usa el resto de la
 * app, ya resuelta según la moneda/locale configurados) — así el odómetro
 * funciona igual sin importar qué moneda esté activa. Solo los DÍGITOS se
 * animan; el resto del string se renderiza tal cual.
 */

interface OdometerAmountProps {
  value: number
  /** Misma función que usa el resto de la app — define moneda, separador de
   * miles y decimales. El odómetro nunca reformatea por su cuenta. */
  formatAmount: (n: number) => string
  className?: string
  /** Duración del giro de cada dígito, en ms. */
  duration?: number
  /** Retraso extra entre columnas adyacentes, en ms — la cascada. */
  stagger?: number
}

interface ColumnHandle {
  digit: number
  pos: number
  trackEl: HTMLDivElement | null
}

const ROWS = 3 // 0-9 repetido 3 veces: suficiente pista para rodar en cualquier dirección sin "teletransportarse"

function numDigits(v: number): number {
  const n = Math.round(Math.abs(v))
  return n <= 0 ? 1 : Math.floor(Math.log10(n)) + 1
}
function digitAt(v: number, place: number): number {
  const n = Math.round(Math.abs(v))
  return Math.floor(n / place) % 10
}
function placesFor(d: number): number[] {
  const arr: number[] = []
  for (let i = d - 1; i >= 0; i--) arr.push(Math.pow(10, i))
  return arr
}

/** Separa el string ya formateado en prefijo/sufijo/separador de miles,
 * reutilizando la función de formato real en vez de asumir "$" y ",". */
function parseFormat(formatted: string): { prefix: string; suffix: string; groupSep: string } {
  let firstDigitIdx = -1
  let lastDigitIdx = -1
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= "0" && formatted[i] <= "9") {
      if (firstDigitIdx === -1) firstDigitIdx = i
      lastDigitIdx = i
    }
  }
  if (firstDigitIdx === -1) return { prefix: formatted, suffix: "", groupSep: "," }
  const prefix = formatted.slice(0, firstDigitIdx)
  const suffix = formatted.slice(lastDigitIdx + 1)
  const digitsPart = formatted.slice(firstDigitIdx, lastDigitIdx + 1)
  const sepMatch = digitsPart.match(/[^0-9]/)
  return { prefix, suffix, groupSep: sepMatch ? sepMatch[0] : "," }
}

export function OdometerAmount({ value, formatAmount, className, duration = 1500, stagger = 65 }: OdometerAmountProps) {
  const safeValue = Number.isFinite(value) ? value : 0
  const negative = safeValue < 0

  const { prefix, suffix, groupSep } = useMemo(
    () => parseFormat(formatAmount(Math.abs(safeValue))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formatAmount],
  )

  const [places, setPlaces] = useState<number[]>(() => placesFor(numDigits(safeValue)))
  const columnsRef = useRef<Map<number, ColumnHandle>>(new Map())
  const prevRef = useRef(safeValue)
  // El estado de la billetera arranca en 0 mientras se hace el fetch inicial
  // y recién después salta al valor real — sin este guard, ESE salto (nada
  // que ver con un movimiento del usuario) rodaba el odómetro entero cada
  // vez que se entraba o refrescaba la página. Se absorbe en silencio el
  // primer cambio detectado desde que el componente existe (la carga inicial
  // de datos); cualquier cambio posterior sí es un movimiento real y anima.
  const skipNextAnimationRef = useRef(true)

  const getColumn = (place: number, digitIfNew: number): ColumnHandle => {
    let col = columnsRef.current.get(place)
    if (!col) {
      col = { digit: digitIfNew, pos: 10 + digitIfNew, trackEl: null }
      columnsRef.current.set(place, col)
    }
    return col
  }
  // Garantiza un handle por cada columna renderizada — incluso las que
  // `setPlaces` acaba de agregar, antes de que el efecto de abajo corra.
  places.forEach(place => getColumn(place, digitAt(safeValue, place)))

  useEffect(() => {
    const to = safeValue
    const from = prevRef.current
    if (to === from) return

    const newD = numDigits(to)
    const D = Math.max(newD, places.length)
    const targetPlaces = placesFor(D)

    if (skipNextAnimationRef.current) {
      skipNextAnimationRef.current = false
      prevRef.current = to
      if (targetPlaces.length !== places.length) setPlaces(targetPlaces)
      // Las columnas que ya existían (places viejos que siguen en
      // targetPlaces) también se asientan directo en su dígito final, sin
      // transición — las nuevas (si el conteo de dígitos creció) se crean
      // ya en su posición correcta en el próximo render, vía el `forEach`
      // de arriba, que usa `safeValue` actual.
      targetPlaces.forEach(place => {
        const col = columnsRef.current.get(place)
        if (!col) return
        const d = digitAt(to, place)
        col.digit = d
        col.pos = 10 + d
        if (col.trackEl) {
          col.trackEl.style.transition = "none"
          col.trackEl.style.transform = `translateY(-${col.pos}em)`
        }
      })
      return
    }

    const direction = to > from ? 1 : -1

    targetPlaces.forEach(place => getColumn(place, 0))
    if (targetPlaces.length !== places.length) setPlaces(targetPlaces)

    const raf = requestAnimationFrame(() => {
      let maxDelay = 0
      targetPlaces.forEach((place, i) => {
        const col = columnsRef.current.get(place)
        if (!col?.trackEl) return
        const toDigit = digitAt(to, place)
        const fromDigit = col.digit
        const step = direction > 0
          ? (toDigit - fromDigit + 10) % 10
          : -(((fromDigit - toDigit) + 10) % 10)
        const targetPos = col.pos + step
        const delay = (targetPlaces.length - 1 - i) * stagger

        col.trackEl.style.transition = `transform ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`
        col.trackEl.style.transform = `translateY(-${targetPos}em)`
        col.pos = targetPos
        col.digit = toDigit
        maxDelay = Math.max(maxDelay, delay)
      })

      window.setTimeout(() => {
        // Normalizar cada rueda a una posición base equivalente (mismo
        // dígito, offset chico) para que la pista no crezca sin límite.
        targetPlaces.forEach(place => {
          const col = columnsRef.current.get(place)
          if (!col?.trackEl) return
          const basePos = 10 + col.digit
          col.trackEl.style.transition = "none"
          col.trackEl.style.transform = `translateY(-${basePos}em)`
          col.pos = basePos
        })
        if (newD < D) {
          const keep = new Set(placesFor(newD))
          Array.from(columnsRef.current.keys()).forEach(place => {
            if (!keep.has(place)) columnsRef.current.delete(place)
          })
          setPlaces(placesFor(newD))
        }
      }, duration + maxDelay + 80)
    })

    prevRef.current = to
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeValue, duration, stagger])

  return (
    <span
      className={cn("inline-flex items-baseline tabular-nums", className)}
      aria-label={formatAmount(safeValue)}
      role="text"
    >
      {negative && <span>-</span>}
      {prefix && <span>{prefix}</span>}
      {places.map((place, i) => {
        const col = columnsRef.current.get(place)!
        const showSep = i > 0 && (places.length - i) % 3 === 0
        return (
          <span key={place} className="inline-flex items-baseline">
            {showSep && <span aria-hidden="true">{groupSep}</span>}
            <span className="inline-block overflow-hidden" style={{ height: "1em", lineHeight: "1em" }} aria-hidden="true">
              <div
                ref={el => { col.trackEl = el }}
                className="flex flex-col"
                style={{ transform: `translateY(-${col.pos}em)` }}
              >
                {Array.from({ length: ROWS * 10 }, (_, n) => (
                  <span key={n} className="block text-center" style={{ height: "1em", lineHeight: "1em" }}>
                    {n % 10}
                  </span>
                ))}
              </div>
            </span>
          </span>
        )
      })}
      {suffix && <span>{suffix}</span>}
    </span>
  )
}
