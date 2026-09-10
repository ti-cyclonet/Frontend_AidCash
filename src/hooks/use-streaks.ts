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

// streakActual es una racha de DÍAS consecutivos con alguna acción financiera
// real (ver recordDailyStreak en el backend) — igual que ya la trata la
// misión semanal "Racha perfecta" (tope en 7) y como siempre la etiquetó la
// UI de Jardín/Misiones ("X días"). Estos tramos antes hablaban de "meses"/
// "quincenas" — una racha de días real los habría desbloqueado en cuestión
// de días, contradiciendo su propia descripción. Se alinean con los mismos
// hitos de 7/30/100 días que ya usa la pantalla de Misiones.
export const BADGES: BadgeDefinition[] = [
  {
    id: 'primer_periodo',
    nombre: 'Primer Paso',
    getDescripcion: () => 'Usaste Kiri hoy — tu racha empezó.',
    icono: '🌱',
    getCondicion: () => '1 día en racha',
    minStreak: 1,
  },
  {
    id: 'dos_periodos',
    nombre: 'Vas Bien',
    getDescripcion: () => '3 días seguidos usando Kiri.',
    icono: '🌿',
    getCondicion: () => '3 días en racha',
    minStreak: 3,
  },
  {
    id: 'tres_periodos',
    nombre: 'Racha de una Semana',
    getDescripcion: () => '7 días consecutivos con tus finanzas en orden.',
    icono: '🌻',
    getCondicion: () => '7 días en racha',
    minStreak: 7,
  },
  {
    id: 'cuatro_periodos',
    nombre: 'Hábito Formado',
    getDescripcion: () => '14 días sin romper la racha.',
    icono: '🌳',
    getCondicion: () => '14 días en racha',
    minStreak: 14,
  },
  {
    id: 'seis_periodos',
    nombre: 'Disciplina de Acero',
    getDescripcion: () => '30 días seguidos. Tu jardín florece.',
    icono: '🏆',
    getCondicion: () => '30 días en racha',
    minStreak: 30,
  },
  {
    id: 'doce_periodos',
    nombre: 'Leyenda Financiera',
    getDescripcion: () => '100 días. Eres un ejemplo.',
    icono: '👑',
    getCondicion: () => '100 días en racha',
    minStreak: 100,
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
  xpFromMissions: number
  xpFromWatering: number
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
    xpFromMissions: 0,
    xpFromWatering: 0,
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
          xpFromMissions: result.xpFromMissions ?? 0,
          xpFromWatering: result.xpFromWatering ?? 0,
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
  // streakActual es una racha de DÍAS: si falta más de un día completo desde
  // el último check-in (ni hoy ni ayer), ya está rota — mostrarla en 0 antes
  // de que el usuario haga alguna acción nueva, en vez de seguir enseñando un
  // número que ya no es cierto. (Antes toleraba hasta 60 días de inactividad,
  // heredado de cuando esto se pensaba como una racha de PERIODOS de pago.)
  useEffect(() => {
    if (data.loading || !data.ultimoCheck || data.streakActual === 0) return

    const lastCheck = new Date(data.ultimoCheck)
    const now = new Date()
    const daysSince = Math.floor((now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSince > 1) {
      breakStreak()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loading, data.ultimoCheck])

  // ── Romper racha ──────────────────────────────────────────────────────────
  // OJO: no toca `ultimoCheck` — ni aquí ni en el backend (ver PATCH
  // /gamification/streak). Si lo estampara como "hoy", una acción real que el
  // usuario haga más tarde el mismo día no incrementaría la racha (el backend
  // la vería como "ya contada hoy") en vez de arrancar una racha nueva en 1.
  const breakStreak = useCallback(async () => {
    if (!userId) return
    await gamificationApi.updateStreak(0)
    setData(prev => ({ ...prev, streakActual: 0 }))
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
    breakStreak,
    unlockBadge,
    refetch: fetchStreaks,
  }
}
