"use client"

import { useEffect, useRef } from "react"
import { useAppContext } from "@/lib/app-context"
import { useSocket, SOCKET_EVENTS } from "@/lib/socket-context"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { getCurrentQuincena } from "@/lib/period-filter"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * useSmartAlerts — Sistema de Alertas Inteligentes de Kiri
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Genera alertas locales basadas en:
 *   1. Proximidad de pago (días 12-14 y 27-29): avisa que se acerca fin de periodo
 *   2. Recordatorio de registro de ingreso: si no has registrado sueldo este periodo
 *
 * Las alertas se inyectan al sistema de notificaciones existente (campana)
 * y al hacer clic llevan al usuario a la Billetera para registrar su ingreso.
 *
 * Detección de Flujo:
 *   Si frecuencia = quincenal:
 *     - Registro días 1-15 → "Ingreso asignado a Quincena 1"
 *     - Registro días 16-31 → "Ingreso asignado a Quincena 2"
 *   Se maneja en getIncomeQuincenaLabel() exportada para uso en BilleteraTab.
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Key de localStorage para controlar que solo se muestra una vez por periodo */
const ALERT_SHOWN_KEY = "kiri_alert_shown_period"

// ─── Detección de flujo ───────────────────────────────────────────────────────

/**
 * Determina a qué quincena se asigna un ingreso registrado hoy.
 * Útil para mostrar al usuario: "Ingreso asignado a Quincena 1" / "Quincena 2".
 *
 * @param frequency - Frecuencia del usuario
 * @param registrationDate - Fecha en que se registra (default: hoy)
 * @returns Label descriptivo o null si es mensual
 */
export function getIncomeQuincenaLabel(
  frequency: 'mensual' | 'quincenal',
  registrationDate: Date = new Date()
): string | null {
  if (frequency === 'mensual') return null

  const day = registrationDate.getDate()
  const month = registrationDate.toLocaleString('es', { month: 'long' })

  if (day <= 15) {
    return `Ingreso asignado a Quincena 1 (1-15 de ${month})`
  }
  return `Ingreso asignado a Quincena 2 (16-fin de ${month})`
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useSmartAlerts() {
  const { income, incomeFrequency, diasCobro, onboardingDone } = useAppContext()
  const { addNotification } = useSocket()
  const { sendNotification, permission, requestPermission } = usePushNotifications()
  const alertFiredRef = useRef(false)

  // Auto-request push permission on first load (after onboarding)
  useEffect(() => {
    if (!onboardingDone || permission !== "default") return
    // Request permission after a small delay (UX: not immediately on load)
    const timer = setTimeout(() => { requestPermission() }, 3000)
    return () => clearTimeout(timer)
  }, [onboardingDone, permission, requestPermission])

  useEffect(() => {
    // No disparar alertas si no completó onboarding o no tiene ingreso configurado
    if (!onboardingDone || income <= 0) return
    // No disparar más de una vez por sesión/render
    if (alertFiredRef.current) return

    const today = new Date()
    const day = today.getDate()
    const month = today.getMonth()
    const year = today.getFullYear()

    // Generar un ID de periodo para no repetir alertas
    const quincena = getCurrentQuincena()
    const periodKey = incomeFrequency === 'quincenal'
      ? `${year}-${month}-Q${quincena}`
      : `${year}-${month}`

    // Verificar si ya se mostró la alerta para este periodo
    const shownPeriod = localStorage.getItem(ALERT_SHOWN_KEY)
    if (shownPeriod === periodKey) return

    // ── Calcular días de proximidad basándose en diasCobro configurable ──
    const payDays = diasCobro.split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d)).sort((a, b) => a - b)
    
    let shouldAlert = false
    let alertMessage = ""

    if (incomeFrequency === 'quincenal' && payDays.length >= 2) {
      const [d1, d2] = payDays
      // Proximidad al fin del periodo 1 (3 días antes de d2)
      if (day >= d1 && day < d2 && (d2 - day) <= 3) {
        shouldAlert = true
        alertMessage = `Se acerca el fin del periodo (día ${d2}). ¿Ya recibiste tu sueldo?`
      }
      // Proximidad al fin del periodo 2 (3 días antes de d1 del siguiente mes)
      const lastDay = new Date(year, month + 1, 0).getDate()
      if (day >= d2 && (lastDay - day) <= 3) {
        shouldAlert = true
        alertMessage = `Se acerca el fin del periodo y tu fecha de pago (día ${d1}). ¿Ya recibiste tu sueldo?`
      }
    } else {
      // Mensual: alertar 3 días antes del día de cobro
      const payDay = payDays[0] || 1
      const lastDay = new Date(year, month + 1, 0).getDate()
      const daysUntilPay = payDay > day ? payDay - day : lastDay - day + payDay
      if (daysUntilPay <= 3 && daysUntilPay > 0) {
        shouldAlert = true
        alertMessage = `Se acerca tu fecha de pago (día ${payDay}). ¿Ya recibiste tu sueldo?`
      }
    }

    if (shouldAlert) {
      // In-app notification (campana)
      addNotification(SOCKET_EVENTS.ALERT_PAYMENT_PROXIMITY, {
        message: alertMessage,
        action: "register_income",
        route: "/gestion?tab=billetera",
      })

      // Native push notification (pantalla de inicio con sonido)
      sendNotification({
        title: "Kiri Finance",
        body: alertMessage,
        tag: `proximity-${periodKey}`,
        url: "/gestion?tab=billetera",
      })

      // Marcar como mostrada para este periodo
      localStorage.setItem(ALERT_SHOWN_KEY, periodKey)
      alertFiredRef.current = true
    }
  }, [income, incomeFrequency, diasCobro, onboardingDone, addNotification, sendNotification])
}
