/**
 * Service Worker — Kiri Finance Push Notifications
 * Handles incoming push events and displays native OS notifications.
 */

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || "Kiri Finance"
  const options = {
    body: data.body || "Tienes una nueva notificación",
    icon: "/garden/brote.png",
    badge: "/garden/brote.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "kiri-notification",
    data: { url: data.url || "/gestion?tab=billetera" },
    actions: data.actions || [
      { action: "open", title: "Ver" },
      { action: "dismiss", title: "Descartar" },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/gestion?tab=billetera"

  if (event.action === "dismiss") return

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
