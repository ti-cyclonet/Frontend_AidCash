"use client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Sistema de Notificaciones
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Maneja:
 *   1. Solicitud de permisos de notificación
 *   2. Reproducción de sonido al recibir eventos
 *   3. Notificaciones nativas del navegador (Web Notifications API)
 *   4. Registro del service worker de push
 *   5. Suscripción a push notifications (web-push)
 */

import { SocketEvent, SOCKET_EVENTS } from "./socket-context"

// ─── Config de sonido ─────────────────────────────────────────────────────────

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

/**
 * Reproduce un sonido de notificación sintetizado (sin archivos externos)
 */
export function playNotificationSound(type: 'default' | 'success' | 'warning' = 'default') {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Configurar según tipo
    if (type === 'success') {
      oscillator.frequency.setValueAtTime(523, ctx.currentTime) // C5
      oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1) // E5
      oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2) // G5
    } else if (type === 'warning') {
      oscillator.frequency.setValueAtTime(440, ctx.currentTime) // A4
      oscillator.frequency.setValueAtTime(349, ctx.currentTime + 0.15) // F4
    } else {
      oscillator.frequency.setValueAtTime(587, ctx.currentTime) // D5
      oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.12) // G5
    }

    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.4)
  } catch {
    // Audio context not available (SSR or restricted)
  }
}

// ─── Permisos de notificación ─────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

export function hasNotificationPermission(): boolean {
  if (typeof window === 'undefined') return false
  return 'Notification' in window && Notification.permission === 'granted'
}

// ─── Mostrar notificación nativa ──────────────────────────────────────────────

interface NotificationOptions {
  title: string
  body: string
  icon?: string
  tag?: string
  url?: string
  sound?: 'default' | 'success' | 'warning'
}

export function showNativeNotification(opts: NotificationOptions) {
  // Reproducir sonido siempre (no requiere permiso de notificación)
  playNotificationSound(opts.sound ?? 'default')

  // Mostrar notificación nativa si hay permiso
  if (!hasNotificationPermission()) return

  // Si la página está enfocada, no mostrar notificación nativa (ya se ve in-app)
  if (document.hasFocus()) return

  try {
    const notification = new Notification(opts.title, {
      body: opts.body,
      icon: opts.icon ?? '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: opts.tag ?? 'kiri-general',
      vibrate: [200, 100, 200],
    })

    notification.onclick = () => {
      window.focus()
      if (opts.url) window.location.href = opts.url
      notification.close()
    }

    // Auto-cerrar después de 6 segundos
    setTimeout(() => notification.close(), 6000)
  } catch {
    // Notifications not supported or service worker required
  }
}

// ─── Mapear eventos socket a notificaciones ───────────────────────────────────

const EVENT_MESSAGES: Record<string, (data: Record<string, unknown>) => NotificationOptions> = {
  [SOCKET_EVENTS.NEW_INVITE]: (data) => ({
    title: '📬 Nueva solicitud social',
    body: `${(data.from as any)?.nombre ?? 'Alguien'} quiere conectarse contigo${data.role ? ` como ${String(data.role).toLowerCase()}` : ''}.`,
    url: '/social',
    tag: 'social-invite',
    sound: 'default',
  }),
  [SOCKET_EVENTS.INVITE_ACCEPTED]: (data) => ({
    title: '✅ Conexión aceptada',
    body: `${(data.by as any)?.nombre ?? 'Tu amigo'} aceptó tu invitación.`,
    url: '/social',
    tag: 'social-accepted',
    sound: 'success',
  }),
  [SOCKET_EVENTS.SHARED_DEPOSIT]: (data) => ({
    title: '💰 Depósito compartido',
    body: `${(data.by as any)?.nombre ?? 'Alguien'} depositó en "${data.pocketName ?? 'bolsillo'}".`,
    url: '/social',
    tag: 'shared-deposit',
    sound: 'success',
  }),
  [SOCKET_EVENTS.LOAN_REQUESTED]: (data) => ({
    title: '🤝 Solicitud de préstamo',
    body: `${(data.borrower as any)?.nombre ?? 'Alguien'} te solicita un préstamo.`,
    url: '/social',
    tag: 'loan-request',
    sound: 'default',
  }),
  [SOCKET_EVENTS.LOAN_APPROVED]: () => ({
    title: '✅ Préstamo aprobado',
    body: 'Tu solicitud de préstamo fue aprobada.',
    url: '/social',
    tag: 'loan-approved',
    sound: 'success',
  }),
  [SOCKET_EVENTS.LOAN_REJECTED]: () => ({
    title: '❌ Préstamo rechazado',
    body: 'Tu solicitud de préstamo fue rechazada.',
    url: '/social',
    tag: 'loan-rejected',
    sound: 'warning',
  }),
  [SOCKET_EVENTS.LOAN_PAYMENT]: (data) => ({
    title: '💸 Abono recibido',
    body: `${(data.borrower as any)?.nombre ?? 'Alguien'} registró un abono a tu préstamo.`,
    url: '/social',
    tag: 'loan-payment',
    sound: 'success',
  }),
  [SOCKET_EVENTS.LOAN_PAYMENT_CONFIRMED]: () => ({
    title: '✅ Pago confirmado',
    body: 'Tu abono fue confirmado por el prestamista.',
    url: '/social',
    tag: 'loan-confirmed',
    sound: 'success',
  }),
  [SOCKET_EVENTS.LOAN_PAYMENT_REJECTED]: () => ({
    title: '⚠️ Pago rechazado',
    body: 'Tu abono fue rechazado. Contacta al prestamista.',
    url: '/social',
    tag: 'loan-pay-rejected',
    sound: 'warning',
  }),
}

/**
 * Procesa un evento socket y genera la notificación correspondiente
 */
export function handleSocketNotification(event: SocketEvent, data: Record<string, unknown>) {
  const messageBuilder = EVENT_MESSAGES[event]
  if (!messageBuilder) {
    // Evento no mapeado — solo reproducir sonido
    playNotificationSound('default')
    return
  }
  const opts = messageBuilder(data)
  showNativeNotification(opts)
}

// ─── Push Subscription (Fase 2) ──────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Registra el service worker de push y suscribe al usuario.
 * Retorna la suscripción para enviar al backend.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VAPID_PUBLIC_KEY no configurada')
      return null
    }

    // Registrar SW de push
    const registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
    await navigator.serviceWorker.ready

    // Verificar si ya está suscrito
    let subscription = await registration.pushManager.getSubscription()
    if (subscription) return subscription

    // Crear nueva suscripción
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    return subscription
  } catch (error) {
    console.error('[Push] Error al suscribirse:', error)
    return null
  }
}
