"use client"

import { useCallback } from "react"
import { toast } from "@/hooks/use-toast"
import { tr } from "@/lib/i18n"

/**
 * Hook de celebraciones con confeti y toasts empáticos.
 *
 * Usa canvas-confetti para las animaciones. Se importa dinámicamente
 * para no afectar el bundle si nunca se dispara.
 */
export function useCelebration() {
  const fireConfetti = useCallback(async () => {
    const confetti = (await import("canvas-confetti")).default
    // Disparo dual desde ambos lados para un efecto envolvente
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.2, y: 0.7 },
      colors: ['#8C7DE6', '#B9FBC0', '#A2D2FF', '#FFB3C6'],
      zIndex: 9999,
    })
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.8, y: 0.7 },
      colors: ['#8C7DE6', '#B9FBC0', '#A2D2FF', '#FFB3C6'],
      zIndex: 9999,
    })
  }, [])

  const fireSmallConfetti = useCallback(async () => {
    const confetti = (await import("canvas-confetti")).default
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { x: 0.5, y: 0.6 },
      colors: ['#B9FBC0', '#8C7DE6'],
      zIndex: 9999,
      scalar: 0.8,
    })
  }, [])

  // ─── Celebraciones predefinidas ──────────────────────────────────────────

  /** Se saldó una deuda */
  const celebrateDebtPaid = useCallback(() => {
    fireConfetti()
    toast({
      title: tr("🎉 ¡Deuda saldada!"),
      description: tr("Una obligación menos. Tu flujo libre acaba de crecer. ¡Sigue así!"),
    })
  }, [fireConfetti])

  /** Meta de ahorro alcanzada */
  const celebrateSavingsGoal = useCallback(() => {
    fireConfetti()
    toast({
      title: tr("🏆 ¡Meta de ahorro alcanzada!"),
      description: tr("Lo lograste. Tu disciplina tiene recompensa. Es momento de soñar más grande."),
    })
  }, [fireConfetti])

  /** Ahorro del periodo registrado */
  const celebrateSavingsEntry = useCallback(() => {
    fireSmallConfetti()
    toast({
      title: tr("💰 ¡Ahorro registrado!"),
      description: tr("Te pagaste a ti mismo primero. Tu yo del futuro te lo agradece."),
    })
  }, [fireSmallConfetti])

  /** Racha incrementada */
  const celebrateStreak = useCallback((weeks: number) => {
    if (weeks >= 4) {
      fireConfetti()
    } else {
      fireSmallConfetti()
    }
    const messages: Record<number, string> = {
      1: tr("¡Primera semana! El viaje de mil pasos empieza con uno."),
      2: tr("Dos semanas seguidas. La constancia es tu superpoder."),
      3: tr("Tres semanas. Esto ya es un hábito, no suerte."),
      4: tr("¡Un mes completo! Tu jardín financiero florece."),
      8: tr("Dos meses. Eres de acero. 💪"),
      12: tr("Tres meses. Leyenda. Tu disciplina inspira."),
    }
    const msg = messages[weeks] ?? tr("{0} semanas en racha. Imparable.", [weeks])
    toast({
      title: tr("🔥 ¡Racha de {0} semana{1}!", [weeks, weeks > 1 ? 's' : '']),
      description: msg,
    })
  }, [fireConfetti, fireSmallConfetti])

  /** Badge desbloqueado */
  const celebrateBadge = useCallback((emoji: string, nombre: string) => {
    fireConfetti()
    toast({
      title: tr("{0} ¡Nueva insignia!", [emoji]),
      description: tr("Desbloqueaste \"{0}\". Tu esfuerzo tiene nombre propio.", [nombre]),
    })
  }, [fireConfetti])

  /** Fondo de emergencia meta mínima alcanzada */
  const celebrateEmergencyFund = useCallback(() => {
    fireConfetti()
    toast({
      title: tr("🛡️ ¡Fondo de emergencia listo!"),
      description: tr("Ya tienes 3 meses de colchón. Puedes dormir más tranquilo."),
    })
  }, [fireConfetti])

  return {
    fireConfetti,
    fireSmallConfetti,
    celebrateDebtPaid,
    celebrateSavingsGoal,
    celebrateSavingsEntry,
    celebrateStreak,
    celebrateBadge,
    celebrateEmergencyFund,
  }
}
