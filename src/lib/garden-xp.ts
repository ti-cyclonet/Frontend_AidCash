/**
 * XP total del jardín — misma fórmula usada en /jardin y /misiones, en un solo
 * lugar para que nunca queden desincronizadas.
 */
// Antes 250 por día de racha y 100 por insignia: con una semana seguida ya se
// subían dos niveles. Ahora subir cuesta constancia de semanas/meses.
export const XP_PER_STREAK = 40
export const XP_PER_BADGE = 50

/**
 * `xpFromRacha`: 40 por cada día de racha, ACUMULADOS en el servidor — perder
 * la racha ya no baja el árbol de nivel (antes era streakActual * 40).
 * `xpFromJardin`: lo cosechado en el minijuego del árbol (frutos, sacudida, riego, toques).
 */
export function calculateGardenXP(xpFromRacha: number, badgeCount: number, xpFromMissions: number, xpFromWatering = 0, xpFromJardin = 0): number {
  return xpFromRacha + badgeCount * XP_PER_BADGE + xpFromMissions + xpFromWatering + xpFromJardin
}

/**
 * XP dentro del nivel actual: arranca en 0 al subir y se llena hasta lo que
 * cuesta el siguiente nivel (en vez de mostrar el acumulado 4.500 / 8.350).
 */
export function progresoNivel(xpTotal: number, xpNivelActual: number, xpNivelSiguiente: number | null) {
  if (xpNivelSiguiente === null) return { xp: xpTotal - xpNivelActual, meta: 0, pct: 100, faltan: 0 }
  const meta = xpNivelSiguiente - xpNivelActual
  const xp = Math.max(0, Math.min(meta, xpTotal - xpNivelActual))
  return { xp, meta, pct: meta > 0 ? Math.round((xp / meta) * 100) : 100, faltan: meta - xp }
}
