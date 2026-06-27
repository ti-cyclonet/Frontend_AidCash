"use client"

import { useCallback } from "react"
import { toast } from "@/hooks/use-toast"

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
      title: "🎉 ¡Deuda saldada!",
      description: "Una obligación menos. Tu flujo libre acaba de crecer. ¡Sigue así!",
    })
  }, [fireConfetti])

  /** Meta de ahorro alcanzada */
  const celebrateSavingsGoal = useCallback(() => {
    fireConfetti()
    toast({
      title: "🏆 ¡Meta de ahorro alcanzada!",
      description: "Lo lograste. Tu disciplina tiene recompensa. Es momento de soñar más grande.",
    })
  }, [fireConfetti])

  /** Ahorro del periodo registrado */
  const celebrateSavingsEntry = useCallback(() => {
    fireSmallConfetti()
    toast({
      title: "💰 ¡Ahorro registrado!",
      description: "Te pagaste a ti mismo primero. Tu yo del futuro te lo agradece.",
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
      1: "¡Primera semana! El viaje de mil pasos empieza con uno.",
      2: "Dos semanas seguidas. La constancia es tu superpoder.",
      3: "Tres semanas. Esto ya es un hábito, no suerte.",
      4: "¡Un mes completo! Tu jardín financiero florece.",
      8: "Dos meses. Eres de acero. 💪",
      12: "Tres meses. Leyenda. Tu disciplina inspira.",
    }
    const msg = messages[weeks] ?? `${weeks} semanas en racha. Imparable.`
    toast({
      title: `🔥 ¡Racha de ${weeks} semana${weeks > 1 ? 's' : ''}!`,
      description: msg,
    })
  }, [fireConfetti, fireSmallConfetti])

  /** Badge desbloqueado */
  const celebrateBadge = useCallback((emoji: string, nombre: string) => {
    fireConfetti()
    toast({
      title: `${emoji} ¡Nueva insignia!`,
      description: `Desbloqueaste "${nombre}". Tu esfuerzo tiene nombre propio.`,
    })
  }, [fireConfetti])

  /** Fondo de emergencia meta mínima alcanzada */
  const celebrateEmergencyFund = useCallback(() => {
    fireConfetti()
    toast({
      title: "🛡️ ¡Fondo de emergencia listo!",
      description: "Ya tienes 3 meses de colchón. Puedes dormir más tranquilo.",
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
