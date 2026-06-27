"use client"

import { useState, useEffect, useCallback } from "react"
import { gamificationApi } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { IncomeFrequency } from "@/lib/types"

// ─── Definición de Insignias ──────────────────────────────────────────────────

export interface BadgeDefinition {
  id: string
  nombre: string
  getDescripcion: (freq: IncomeFrequency) => string
  icono: string
  getCondicion: (freq: IncomeFrequency) => string
  minStreak: number
}

const periodoLabel = (freq: IncomeFrequency, n: number) =>
  freq === 'quincenal'
    ? `${n} quincena${n > 1 ? 's' : ''}`
    : `${n} ${n === 1 ? 'mes' : 'meses'}`

export const BADGES: BadgeDefinition[] = [
  {
    id: 'primer_periodo',
    nombre: '¡Primer Periodo!',
    getDescripcion: (f) => `Cumpliste tu presupuesto ${periodoLabel(f, 1)} entero.`,
    icono: '🌱',
    getCondicion: (f) => `1 ${f === 'quincenal' ? 'quincena' : 'mes'} en racha`,
    minStreak: 1,
  },
  {
    id: 'dos_periodos',
    nombre: 'Constancia',
    getDescripcion: (f) => `${periodoLabel(f, 2)} seguidos dentro del presupuesto.`,
    icono: '🌿',
    getCondicion: (f) => `${periodoLabel(f, 2)} en racha`,
    minStreak: 2,
  },
  {
    id: 'tres_periodos',
    nombre: 'Hábito Formado',
    getDescripcion: (f) => `${periodoLabel(f, 3)} consecutivos con tus finanzas en orden.`,
    icono: '🌻',
    getCondicion: (f) => `${periodoLabel(f, 3)} en racha`,
    minStreak: 3,
  },
  {
    id: 'cuatro_periodos',
    nombre: 'Disciplina Real',
    getDescripcion: (f) => f === 'quincenal'
      ? '2 meses (4 quincenas) cumpliendo tu plan financiero.'
      : '4 meses completos sin romper la racha.',
    icono: '🌳',
    getCondicion: (f) => `${periodoLabel(f, 4)} en racha`,
    minStreak: 4,
  },
  {
    id: 'seis_periodos',
    nombre: 'Disciplina de Acero',
    getDescripcion: (f) => f === 'quincenal'
      ? '3 meses (6 quincenas) consecutivos.'
      : '6 meses sin fallar. Tu jardín florece.',
    icono: '🏆',
    getCondicion: (f) => `${periodoLabel(f, 6)} en racha`,
    minStreak: 6,
  },
  {
    id: 'doce_periodos',
    nombre: 'Leyenda Financiera',
    getDescripcion: (f) => f === 'quincenal'
      ? '6 meses (12 quincenas). Tu jardín está en plena floración.'
      : 'Un año completo. Eres un ejemplo.',
    icono: '👑',
    getCondicion: (f) => `${periodoLabel(f, 12)} en racha`,
    minStreak: 12,
  },
  {
    id: 'fin_semana_sin_gastos',
    nombre: 'Fin de Semana Zen',
    getDescripcion: () => 'Un fin de semana sin gastos hormiga.',
    icono: '🧘',
    getCondicion: () => 'Registrar un fin de semana sin gastos extra',
    minStreak: 0,
  },
  {
    id: 'ahorro_completo',
    nombre: 'Autopagarme Primero',
    getDescripcion: () => 'Registraste el ahorro sugerido completo.',
    icono: '💰',
    getCondicion: () => 'Ahorrar el monto sugerido del periodo',
    minStreak: 0,
  },
]

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface StreakData {
  streakActual: number
  streakMejor: number
  ultimoCheck: string | null
  badgesDesbloqueados: string[]
  loading: boolean
}

export function useStreaks(incomeFrequency: IncomeFrequency = 'mensual') {
  const { user: authUser } = useAuth()
  const userId = authUser?.id ?? null

  const [data, setData] = useState<StreakData>({
    streakActual: 0,
    streakMejor: 0,
    ultimoCheck: null,
    badgesDesbloqueados: [],
    loading: true,
  })

  const periodDays = incomeFrequency === 'quincenal' ? 15 : 30

  const fetchStreaks = useCallback(async () => {
    if (!userId) { setData(prev => ({ ...prev, loading: false })); return }

    try {
      const { data: result } = await gamificationApi.getStatus()

      if (result) {
        setData({
          streakActual: result.streak.actual,
          streakMejor: result.streak.mejor,
          ultimoCheck: result.streak.ultimoCheck,
          badgesDesbloqueados: (result.badges ?? []).map((b: Record<string, unknown>) => b.badgeId as string),
          loading: false,
        })
      } else {
        setData(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setData(prev => ({ ...prev, loading: false }))
    }
  }, [userId])

  useEffect(() => { fetchStreaks() }, [fetchStreaks])

  // ── Verifica si la racha debe reiniciarse por inactividad ─────────────────
  useEffect(() => {
    if (data.loading || !data.ultimoCheck || data.streakActual === 0) return

    const lastCheck = new Date(data.ultimoCheck)
    const now = new Date()
    const daysSince = Math.floor((now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSince > periodDays * 2) {
      breakStreak()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loading, data.ultimoCheck, periodDays])

  // ── Incrementar racha ─────────────────────────────────────────────────────
  const incrementStreak = useCallback(async () => {
    if (!userId) return
    const newStreak = data.streakActual + 1
    const newBest = Math.max(newStreak, data.streakMejor)

    await gamificationApi.updateStreak(newStreak, newBest)

    // Desbloquear badges por racha
    const newBadges: string[] = []
    for (const badge of BADGES) {
      if (badge.minStreak > 0 && newStreak >= badge.minStreak) {
        if (!data.badgesDesbloqueados.includes(badge.id)) {
          newBadges.push(badge.id)
          await gamificationApi.unlockBadge(badge.id)
        }
      }
    }

    const today = new Date().toISOString().split('T')[0]
    setData(prev => ({
      ...prev,
      streakActual: newStreak,
      streakMejor: newBest,
      ultimoCheck: today,
      badgesDesbloqueados: [...prev.badgesDesbloqueados, ...newBadges],
    }))

    return { newStreak, newBadges }
  }, [userId, data])

  // ── Romper racha ──────────────────────────────────────────────────────────
  const breakStreak = useCallback(async () => {
    if (!userId) return
    await gamificationApi.updateStreak(0)
    const today = new Date().toISOString().split('T')[0]
    setData(prev => ({ ...prev, streakActual: 0, ultimoCheck: today }))
  }, [userId])

  // ── Desbloquear badge manual ──────────────────────────────────────────────
  const unlockBadge = useCallback(async (badgeId: string) => {
    if (!userId) return
    if (data.badgesDesbloqueados.includes(badgeId)) return
    await gamificationApi.unlockBadge(badgeId)
    setData(prev => ({
      ...prev,
      badgesDesbloqueados: [...prev.badgesDesbloqueados, badgeId],
    }))
  }, [userId, data.badgesDesbloqueados])

  return {
    ...data,
    periodDays,
    incomeFrequency,
    incrementStreak,
    breakStreak,
    unlockBadge,
    refetch: fetchStreaks,
  }
}
