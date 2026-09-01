"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Droplet, Flame } from "lucide-react"
import { UserAvatar } from "@/components/social/UserAvatar"
import type { FriendGardenEntry } from "@/lib/types"

interface NeighborGardensProps {
  friends: FriendGardenEntry[]
  friendsWhoWateredYouToday: number
  onWater: (connectionId: string) => Promise<boolean>
}

/**
 * "Jardines vecinos" — visitar y regar el jardín de un amigo, un gesto social,
 * nunca dinero. Solo racha y salud del jardín se muestran acá (regla de diseño
 * intencional, ver connections.routes.ts GET /friends-garden).
 */
export function NeighborGardens({ friends, friendsWhoWateredYouToday, onWater }: NeighborGardensProps) {
  const [watering, setWatering] = useState<string | null>(null)

  if (friends.length === 0) return null

  const handleWater = async (connectionId: string) => {
    setWatering(connectionId)
    await onWater(connectionId)
    setWatering(null)
  }

  return (
    <>
      {friendsWhoWateredYouToday > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-2 text-center text-xs text-emerald-700 dark:text-emerald-300">
          💧 {friendsWhoWateredYouToday} {friendsWhoWateredYouToday === 1 ? "amigo regó" : "amigos regaron"} tu jardín hoy
        </div>
      )}

      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold">Jardines vecinos</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">Visita y riega el jardín de un amigo — un gesto, no dinero.</p>

          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {friends.map((f) => {
              const filter = `saturate(${0.5 + (f.health / 100) * 0.8}) brightness(${0.85 + (f.health / 100) * 0.25})`
              return (
                <div key={f.connectionId} className="min-w-[104px] bg-muted/40 border border-border rounded-2xl p-3 text-center shrink-0">
                  <div style={{ filter }} className="inline-block">
                    <UserAvatar nombre={f.peer.nombre} avatarUrl={f.peer.avatarUrl} className="h-12 w-12 mx-auto" />
                  </div>
                  <p className="text-[11px] font-bold mt-2 truncate">{f.peer.nombre}</p>
                  <p className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5 mb-2">
                    <Flame className="h-2.5 w-2.5 text-orange-500" /> {f.streak} días de racha
                  </p>
                  <Button
                    size="sm"
                    variant={f.wateredByMeToday ? "outline" : "default"}
                    disabled={f.wateredByMeToday || watering === f.connectionId}
                    onClick={() => handleWater(f.connectionId)}
                    className="h-7 w-full gap-1 rounded-lg text-[10px] font-bold px-2 bg-emerald-500 hover:bg-emerald-600 text-white disabled:bg-transparent"
                  >
                    <Droplet className="h-3 w-3" /> {f.wateredByMeToday ? "Regado" : watering === f.connectionId ? "..." : "Regar"}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
