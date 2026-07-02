"use client"

import { useEffect, useState, useCallback } from "react"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * usePushNotifications — Notificaciones Push Nativas (Pantalla de inicio)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Registra el Service Worker y solicita permisos de notificación.
 * Permite enviar notificaciones nativas que aparecen en la pantalla de inicio
 * del celular con sonido y vibración.
 *
 * Funciona en:
 *   - Chrome/Edge (Android y Desktop)
 *   - Firefox (Android y Desktop)
 *   - Safari 16.4+ (iOS con PWA instalada)
 */

export interface PushNotificationOptions {
  title: string
  body: string
  tag?: string
  url?: string
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [supported, setSupported] = useState(false)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const isSupported = "Notification" in window && "serviceWorker" in navigator
    setSupported(isSupported)
    if (isSupported) {
      setPermission(Notification.permission)
    }
  }, [])

  // Register SW on mount
  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.register("/sw-push.js").then((reg) => {
      setSwRegistration(reg)
    }).catch((err) => {
      console.warn("[PushNotifications] SW registration failed:", err)
    })
  }, [supported])

  /**
   * Solicita permiso al usuario para mostrar notificaciones.
   * Retorna true si se concedió, false si fue denegado.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === "granted"
    } catch {
      return false
    }
  }, [supported])

  /**
   * Envía una notificación nativa al dispositivo.
   * Si la app está en primer plano, usa el SW para mostrarla igualmente.
   * Si está en segundo plano o cerrada, aparecerá en la pantalla de inicio.
   */
  const sendNotification = useCallback(async (opts: PushNotificationOptions) => {
    if (!supported || permission !== "granted") return false

    try {
      if (swRegistration) {
        // Use SW to show notification (works even in background)
        await swRegistration.showNotification(opts.title, {
          body: opts.body,
          icon: "/garden/brote.png",
          badge: "/garden/brote.png",
          tag: opts.tag || "kiri-alert",
          data: { url: opts.url || "/gestion?tab=billetera" },
        } as NotificationOptions)
        return true
      } else {
        // Fallback: direct Notification API
        new Notification(opts.title, {
          body: opts.body,
          icon: "/garden/brote.png",
          tag: opts.tag || "kiri-alert",
        })
        return true
      }
    } catch (err) {
      console.warn("[PushNotifications] Failed to send:", err)
      return false
    }
  }, [supported, permission, swRegistration])

  return {
    supported,
    permission,
    requestPermission,
    sendNotification,
  }
}
