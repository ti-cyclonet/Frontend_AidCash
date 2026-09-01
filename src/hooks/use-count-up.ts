"use client"

import { useEffect, useState } from "react"

/**
 * Anima un número desde 0 hasta `target` con easing (ease-out cúbico).
 * Se reinicia cada vez que `target` cambia (ej. al cambiar de periodo).
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let raf: number
    let start: number | undefined
    const step = (ts: number) => {
      if (start === undefined) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setValue(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
