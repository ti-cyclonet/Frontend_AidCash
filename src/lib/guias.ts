import { api, getUserId } from "@/lib/api-client"

/**
 * Guías de primera vez (bienvenida + guía de cada módulo).
 *
 * Antes se recordaban solo en el localStorage del navegador: al iniciar
 * sesión en otro dispositivo volvían a salir todas, como si fuera la primera
 * vez. Ahora el servidor guarda cuáles ya se vieron (User.guiasVistas, "*" =
 * todas) y al iniciar sesión se copian al navegador (hidratarGuias), así las
 * guías solo salen al registrarse. Para volver a verlas: Perfil → Guía de Kiri.
 */

const clave = (userId: string, id: string) =>
  id === "welcome" ? `kiri_welcome_seen_${userId}` : `kiri_tutorial_seen_${userId}_${id}`
const claveTodas = (userId: string) => `kiri_guias_todas_${userId}`

export function guiaVista(id: string): boolean {
  if (typeof window === "undefined") return true
  const userId = getUserId()
  if (!userId) return true
  try {
    return localStorage.getItem(claveTodas(userId)) === "1" || !!localStorage.getItem(clave(userId, id))
  } catch {
    return true
  }
}

export function marcarGuiaVista(id: string) {
  const userId = getUserId()
  if (!userId) return
  try { localStorage.setItem(clave(userId, id), "true") } catch { /* sin storage */ }
  api("/users/guias", { method: "POST", body: { guia: id } }).catch(() => {})
}

/** Copia al navegador las guías que el servidor ya tiene como vistas. */
export function hidratarGuias(userId: string | undefined, vistas: unknown) {
  if (!userId || !Array.isArray(vistas)) return
  try {
    for (const id of vistas as string[]) {
      if (id === "*") localStorage.setItem(claveTodas(userId), "1")
      else localStorage.setItem(clave(userId, id), "true")
    }
  } catch { /* sin storage */ }
}
