"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { requestNotificationPermission, subscribeToPush } from "@/lib/notifications"
import { api } from "@/lib/api-client"

/**
 * Componente invisible que:
 * 1. Solicita permiso de notificaciones al montar (después del login)
 * 2. Registra el service worker de push
 * 3. Envía la suscripción al backend para push notifications
 *
 * Montar dentro del layout del dashboard (solo para usuarios autenticados).
 */
export function NotificationInitializer() {
  const { user } = useAuth()
  const initialized = useRef(false)

  useEffect(() => {
    if (!user || initialized.current) return
    initialized.current = true

    // Solicitar permisos después de 2 segundos (no ser invasivo al abrir la app)
    const timer = setTimeout(async () => {
      const permission = await requestNotificationPermission()
      if (permission !== 'granted') return

      // Suscribir a push notifications
      const subscription = await subscribeToPush()
      if (subscription) {
        // Enviar suscripción al backend
        await api('/users/push-subscription', {
          method: 'POST',
          body: { subscription: subscription.toJSON() },
        })
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [user])

  return null // Componente invisible
}
