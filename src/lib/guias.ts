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

/**
 * Versión del contenido de cada guía. Al agregar algo importante a un módulo
 * se sube su versión y la guía vuelve a salir UNA vez (también a quien ya la
 * había visto) para mostrar lo nuevo. Se guarda como "social@2".
 */
const VERSION_GUIA: Record<string, number> = {
  social: 3, // + registrar préstamos, ahorros y deudas que ya existían
  gestion: 2, // nuevas Proyecciones: día sin deudas, aporte extra en vivo, logros reales
  "registro-rapido": 2, // cuota mensual de IA por plan
}
const conVersion = (id: string) => (VERSION_GUIA[id] ?? 1) > 1 ? `${id}@${VERSION_GUIA[id]}` : id

const clave = (userId: string, id: string) =>
  id === "welcome" ? `kiri_welcome_seen_${userId}` : `kiri_tutorial_seen_${userId}_${id}`
const claveTodas = (userId: string) => `kiri_guias_todas_${userId}`

export function guiaVista(id: string): boolean {
  if (typeof window === "undefined") return true
  const userId = getUserId()
  if (!userId) return true
  const idv = conVersion(id)
  try {
    // "Todas vistas" solo cubre la primera versión de cada guía
    if (idv === id && localStorage.getItem(claveTodas(userId)) === "1") return true
    return !!localStorage.getItem(clave(userId, idv))
  } catch {
    return true
  }
}

export function marcarGuiaVista(id: string) {
  const userId = getUserId()
  if (!userId) return
  const idv = conVersion(id)
  try { localStorage.setItem(clave(userId, idv), "true") } catch { /* sin storage */ }
  api("/users/guias", { method: "POST", body: { guia: idv } }).catch(() => {})
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
