/**
 * Service Worker — Kiri Finance Push Notifications
 *
 * Maneja:
 * 1. Push events del backend (web-push) → muestra notificación nativa del sistema
 * 2. Notification clicks → abre la app en la URL relevante
 * 3. Funciona con app cerrada, en background, y con pantalla bloqueada
 *
 * Las notificaciones aparecen en:
 * - Barra de estado del celular (Android/iOS PWA)
 * - Centro de notificaciones de Windows/Mac
 * - Con sonido y vibración del sistema
 */

// ─── Push Event: cuando el backend envía una notificación ─────────────────────

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || "Kiri Finance 🌱"
  const options = {
    body: data.body || "Tienes una nueva notificación",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    vibrate: [200, 100, 200, 100, 200], // Patrón de vibración notorio
    tag: data.tag || "kiri-notification",
    renotify: true, // Vibrar/sonar incluso si hay una notificación con el mismo tag
    requireInteraction: false, // Se auto-cierra en Android, persiste en Desktop
    data: { url: data.url || "/dashboard" },
    actions: data.actions || [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Cerrar" },
    ],
    // Timestamp para que el SO sepa cuándo se generó
    timestamp: Date.now(),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ─── Notification Click: usuario toca la notificación ─────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/dashboard"

  // Si el usuario toca "Cerrar", no hacer nada
  if (event.action === "dismiss") return

  // Abrir o enfocar la ventana de la app
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Si la app ya está abierta, navegar a la URL y enfocar
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Si no está abierta, abrir nueva ventana
      return clients.openWindow(url)
    })
  )
})

// ─── Notification Close: usuario descarta la notificación ─────────────────────

self.addEventListener("notificationclose", (event) => {
  // Analytics futuro: tracking de notificaciones descartadas
})

// ─── Activación: limpiar caches antiguos si hay ───────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})
