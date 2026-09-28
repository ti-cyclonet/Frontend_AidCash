/**
 * XP total del jardín — misma fórmula usada en /jardin y /misiones, en un solo
 * lugar para que nunca queden desincronizadas.
 */
// Antes 250 por día de racha y 100 por insignia: con una semana seguida ya se
// subían dos niveles. Ahora subir cuesta constancia de semanas/meses.
export const XP_PER_STREAK = 40
export const XP_PER_BADGE = 50

export function calculateGardenXP(streakActual: number, badgeCount: number, xpFromMissions: number, xpFromWatering = 0): number {
  return streakActual * XP_PER_STREAK + badgeCount * XP_PER_BADGE + xpFromMissions + xpFromWatering
}
