"use client"

import { useEffect, useRef, useCallback } from "react"

export type InactivityTimeout = "2" | "5" | "10" | "never"

const EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const

/**
 * Hook que monitorea la inactividad del usuario y ejecuta un callback
 * (cerrar sesión) cuando se supera el tiempo configurado.
 *
 * Si el timeout es "never", no hace nada.
 */
export function useInactivityTimeout(
  timeoutMinutes: InactivityTimeout,
  onTimeout: () => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTimeoutRef = useRef(onTimeout)

  // Mantener referencia actualizada del callback
  onTimeoutRef.current = onTimeout

  const resetTimer = useCallback(() => {
    if (timeoutMinutes === "never") return

    // Limpiar timer existente
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Iniciar nuevo timer
    const ms = Number(timeoutMinutes) * 60 * 1000
    timerRef.current = setTimeout(() => {
      onTimeoutRef.current()
    }, ms)
  }, [timeoutMinutes])

  useEffect(() => {
    if (timeoutMinutes === "never") {
      // Limpiar cualquier timer existente
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    // Registrar listeners de actividad
    const handleActivity = () => resetTimer()

    EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Iniciar el timer por primera vez
    resetTimer()

    return () => {
      // Cleanup
      EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [timeoutMinutes, resetTimer])
}
