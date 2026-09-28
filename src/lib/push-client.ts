import { api } from "@/lib/api-client"
import { subscribeToPush } from "@/lib/notifications"

/**
 * Notificaciones del celular (barra de estado).
 *
 * Antes la app pedía el permiso sola a los 2 segundos de entrar, sin que la
 * persona tocara nada: Chrome silencia esas solicitudes y en iPhone ni
 * siquiera se muestran, así que casi nadie quedaba suscrito y los avisos de
 * pagos, misiones o Social nunca llegaban al teléfono. Ahora se piden con un
 * botón (gesto del usuario) y, si ya había permiso, la suscripción se renueva
 * sola en cada inicio de sesión.
 */

export type EstadoPush = "activas" | "sin-activar" | "bloqueadas" | "no-soportado" | "instalar-ios"

export function esIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function instaladaComoApp(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function estadoPush(): EstadoPush {
  if (typeof window === "undefined") return "no-soportado"
  // En iPhone/iPad las notificaciones web solo funcionan con Kiri instalada
  // en la pantalla de inicio (Safari → Compartir → Agregar a inicio).
  if (esIOS() && !instaladaComoApp()) return "instalar-ios"
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "no-soportado"
  if (Notification.permission === "granted") return "activas"
  if (Notification.permission === "denied") return "bloqueadas"
  return "sin-activar"
}

/** Suscribe este dispositivo y lo registra en el backend. */
export async function registrarDispositivo(): Promise<boolean> {
  const sub = await subscribeToPush()
  if (!sub) return false
  const { error } = await api("/users/push-subscription", { method: "POST", body: { subscription: sub.toJSON() } })
  return !error
}

/** Pide permiso (debe llamarse desde un toque del usuario) y suscribe. */
export async function activarNotificaciones(): Promise<EstadoPush> {
  const estado = estadoPush()
  if (estado === "no-soportado" || estado === "instalar-ios" || estado === "bloqueadas") return estado
  const permiso = await Notification.requestPermission()
  if (permiso !== "granted") return permiso === "denied" ? "bloqueadas" : "sin-activar"
  await registrarDispositivo()
  return "activas"
}

export async function enviarPrueba(): Promise<number> {
  const { data } = await api<{ dispositivos: number }>("/users/push-test", { method: "POST" })
  return data?.dispositivos ?? 0
}
