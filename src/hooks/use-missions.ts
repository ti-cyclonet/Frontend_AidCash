"use client"

import { useState, useEffect, useCallback } from "react"
import { missionsApi } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import type { Mission, RewardResult } from "@/lib/types"

export interface MissionsState {
  daily: Mission[]
  weekly: Mission | null
  onboarding: Mission[]
  /** Misiones de traer gente nueva a Kiri (1, 2 y 3 personas) */
  invitaciones: Mission[]
  referidos: number
  loading: boolean
}

export function useMissions() {
  const { user: authUser } = useAuth()
  const userId = authUser?.id ?? null

  const [data, setData] = useState<MissionsState>({
    daily: [],
    weekly: null,
    onboarding: [],
    invitaciones: [],
    referidos: 0,
    loading: true,
  })

  const fetchMissions = useCallback(async () => {
    if (!userId) { setData(prev => ({ ...prev, loading: false })); return }

    try {
      const { data: result } = await missionsApi.getMissions()
      if (result) {
        setData({
          daily: result.daily, weekly: result.weekly, onboarding: result.onboarding,
          invitaciones: result.invitaciones?.misiones ?? [], referidos: result.invitaciones?.referidos ?? 0,
          loading: false,
        })
      } else {
        setData(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setData(prev => ({ ...prev, loading: false }))
    }
  }, [userId])

  useEffect(() => { fetchMissions() }, [fetchMissions])

  /** Reclama una misión. La recompensa la decide siempre el backend. */
  const claim = useCallback(async (missionKey: string): Promise<RewardResult | null> => {
    const { data: result, error } = await missionsApi.claim(missionKey)
    if (error || !result) return null

    // Marcar como reclamada localmente (optimista) — el progreso real ya se
    // confirmó en el backend antes de dar la recompensa.
    setData(prev => ({
      daily: prev.daily.map(m => m.key === missionKey ? { ...m, claimed: true } : m),
      weekly: prev.weekly?.key === missionKey ? { ...prev.weekly, claimed: true } : prev.weekly,
      onboarding: prev.onboarding.map(m => m.key === missionKey ? { ...m, claimed: true } : m),
      invitaciones: prev.invitaciones.map(m => m.key === missionKey ? { ...m, claimed: true } : m),
      referidos: prev.referidos,
      loading: prev.loading,
    }))

    return result.reward
  }, [])

  return {
    ...data,
    claim,
    refetch: fetchMissions,
  }
}
