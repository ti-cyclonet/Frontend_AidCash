"use client"

import { useState, useEffect, useCallback } from "react"
import { connectionsApi } from "@/lib/api-client"
import type { FriendGardenEntry } from "@/lib/types"

export interface FriendsGardenState {
  friends: FriendGardenEntry[]
  friendsWhoWateredYouToday: number
  you: { streak: number; streakMejor: number; badgesCount: number; health: number } | null
  loading: boolean
}

/** Racha entre amigos + jardines vecinos — solo conexiones tipo amigo (nunca pareja/familia). */
export function useFriendsGarden() {
  const [state, setState] = useState<FriendsGardenState>({
    friends: [],
    friendsWhoWateredYouToday: 0,
    you: null,
    loading: true,
  })

  const fetchGarden = useCallback(async () => {
    const { data } = await connectionsApi.getFriendsGarden()
    if (data) {
      setState({
        friends: data.friends,
        friendsWhoWateredYouToday: data.friendsWhoWateredYouToday,
        you: data.you,
        loading: false,
      })
    } else {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => { fetchGarden() }, [fetchGarden])

  /** Riega el jardín de un amigo — el backend rechaza si ya se regó hoy. */
  const water = useCallback(async (connectionId: string): Promise<boolean> => {
    const { error } = await connectionsApi.water(connectionId)
    if (error) return false
    setState(prev => ({
      ...prev,
      friends: prev.friends.map(f => f.connectionId === connectionId ? { ...f, wateredByMeToday: true } : f),
    }))
    return true
  }, [])

  return { ...state, water, refetch: fetchGarden }
}
