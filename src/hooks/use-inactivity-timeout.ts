"use client"

import { useEffect, useRef, useCallback } from "react"

export type InactivityTimeout = "2" | "5" | "10" | "never"

const EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const

/**
 * Hook que monitorea la inactividad del usuario y ejecuta un callback
 * (cerrar sesión) cuando se supera el tiempo configurado.
 *
 * Si el timeout es "never", no hace nada (sesión permanente).
 */
export function useInactivityTimeout(
  timeoutMinutes: InactivityTimeout,
  onTimeout: () => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTimeoutRef = useRef(onTimeout)

  onTimeoutRef.current = onTimeout

  const resetTimer = useCallback(() => {
    if (timeoutMinutes === "never") return

    if (timerRef.current) clearTimeout(timerRef.current)

    const ms = Number(timeoutMinutes) * 60 * 1000
    timerRef.current = setTimeout(() => {
      onTimeoutRef.current()
    }, ms)
  }, [timeoutMinutes])

  useEffect(() => {
    if (timeoutMinutes === "never") {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      return
    }

    const handleActivity = () => resetTimer()

    EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    resetTimer()

    return () => {
      EVENTS.forEach(event => document.removeEventListener(event, handleActivity))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [timeoutMinutes, resetTimer])
}
