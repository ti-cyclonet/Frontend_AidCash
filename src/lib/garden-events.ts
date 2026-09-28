/**
 * Eventos del árbol (Jardín) que nacen en OTRAS pantallas.
 *
 * Antes el Jardín escuchaba "kiri:impulse-registered", pero nadie lo
 * disparaba nunca (la tormenta del gasto hormiga no salía jamás), y la lluvia
 * del ahorro dependía de comparar totales guardados en localStorage — con una
 * obligación por vencer, además, las nubes le ganaban a la lluvia y el ahorro
 * no se celebraba nunca.
 *
 * Ahora quien registra el ahorro / gasto hormiga (la capa de API, así cubre
 * todos los puntos de entrada) deja una marca pendiente y avisa en vivo:
 *   - si el usuario está viendo el árbol, reacciona en el momento;
 *   - si no, lo ve la próxima vez que entre (dentro de las 24 h).
 */

const LLUVIA_KEY = "kiri_garden_pending_rain"
const TORMENTA_KEY = "kiri_garden_pending_storm"
const INGRESO_KEY = "kiri_garden_pending_income"
const VIGENCIA_MS = 24 * 60 * 60 * 1000

export const GARDEN_EVENT_RAIN = "kiri:saving-registered"
export const GARDEN_EVENT_STORM = "kiri:impulse-registered"
export const GARDEN_EVENT_INCOME = "kiri:income-registered"

// Por cuenta: si en el mismo navegador entra otra persona, no hereda la
// lluvia / el rayo / el sol pendientes de la anterior.
function porUsuario(key: string): string {
  try { return `${key}_${localStorage.getItem("kiri_user_id") ?? "anon"}` } catch { return key }
}

function marcar(key: string, detalle: Record<string, unknown>, evento: string) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(porUsuario(key), JSON.stringify({ ...detalle, at: Date.now() })) } catch { /* sin storage */ }
  window.dispatchEvent(new CustomEvent(evento, { detail: detalle }))
}

/** Se registró un aporte de ahorro (bolsillo propio o compartido). */
export function marcarLluviaDeAhorro(monto: number) {
  marcar(LLUVIA_KEY, { monto }, GARDEN_EVENT_RAIN)
}

/** Se registró un gasto hormiga. */
export function marcarTormentaHormiga(nombre: string) {
  marcar(TORMENTA_KEY, { nombre }, GARDEN_EVENT_STORM)
}

/** Se registró un ingreso (sueldo o extra) en la billetera. */
export function marcarSolDeIngreso(monto: number) {
  marcar(INGRESO_KEY, { monto }, GARDEN_EVENT_INCOME)
}

function consumir<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(porUsuario(key))
    if (!raw) return null
    localStorage.removeItem(porUsuario(key))
    const data = JSON.parse(raw) as T & { at: number }
    return Date.now() - data.at <= VIGENCIA_MS ? data : null
  } catch {
    return null
  }
}

/** Lo llama el Jardín al entrar (y al recibir el evento en vivo). */
export const consumirLluviaPendiente = () => consumir<{ monto: number }>(LLUVIA_KEY)
export const consumirTormentaPendiente = () => consumir<{ nombre: string }>(TORMENTA_KEY)
export const consumirIngresoPendiente = () => consumir<{ monto: number }>(INGRESO_KEY)
