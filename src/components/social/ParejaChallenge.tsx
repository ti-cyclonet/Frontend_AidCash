"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Heart } from "lucide-react"
import { useRouter } from "next/navigation"
import { connectionsApi } from "@/lib/api-client"
import { useAppContext } from "@/lib/app-context"
import type { Connection, ConnectionSharedPocket } from "@/lib/types"

interface ParejaChallengeProps {
  connection: Connection
  myId: string
}

/**
 * "Reto en pareja" — único lugar de todo Social donde SÍ se muestran montos de
 * dinero (regla de diseño: acá ya hay consentimiento mutuo vía SharedPocket).
 */
export function ParejaChallenge({ connection, myId }: ParejaChallengeProps) {
  const router = useRouter()
  const { formatAmount } = useAppContext()
  const [pocket, setPocket] = useState<ConnectionSharedPocket | null>(null)
  const partnerName = (connection.requesterId === myId ? connection.addressee : connection.requester)?.nombre ?? "tu pareja"

  useEffect(() => {
    connectionsApi.getShared(connection.id).then(({ data }) => {
      if (data?.pockets?.length) {
        // El más reciente entre ambos — normalmente hay uno solo, la meta de pareja
        setPocket(data.pockets[0])
      }
    })
  }, [connection.id])

  if (!pocket) return null

  const peerId = connection.requesterId === myId ? connection.addresseeId : connection.requesterId
  const you = pocket.contributions[myId] ?? 0
  const partner = pocket.contributions[peerId] ?? 0
  const total = you + partner
  const pct = pocket.meta > 0 ? Math.min(100, Math.round((total / pocket.meta) * 100)) : 0
  const youPct = pocket.meta > 0 ? Math.min(100, (you / pocket.meta) * 100) : 0
  const partnerPct = pocket.meta > 0 ? Math.min(100, (partner / pocket.meta) * 100) : 0

  return (
    <Card className="border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm font-bold">Reto en pareja con {partnerName}</span>
        </div>
        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">{pocket.nombre}</p>

        <div className="h-2.5 rounded-full bg-purple-500/15 overflow-hidden flex">
          <div className="h-full bg-emerald-500" style={{ width: `${youPct}%` }} />
          <div className="h-full bg-purple-500" style={{ width: `${partnerPct}%` }} />
        </div>

        <div className="flex justify-between text-[11px]">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tú: {formatAmount(you)}</span>
          <span className="text-purple-600 dark:text-purple-400 font-semibold">{partnerName}: {formatAmount(partner)}</span>
        </div>

        <div className="flex justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/50">
          <span>{pct}% de {formatAmount(pocket.meta)}</span>
          {pocket.deadline && <span>{pocket.deadline}</span>}
        </div>

        <Button
          onClick={() => router.push("/social?tab=pockets")}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl"
        >
          Aportar a la meta
        </Button>
      </CardContent>
    </Card>
  )
}
