/**
 * XP total del jardín — misma fórmula usada en /jardin y /misiones, en un solo
 * lugar para que nunca queden desincronizadas.
 */
export const XP_PER_STREAK = 250
export const XP_PER_BADGE = 100

export function calculateGardenXP(streakActual: number, badgeCount: number, xpFromMissions: number): number {
  return streakActual * XP_PER_STREAK + badgeCount * XP_PER_BADGE + xpFromMissions
}
