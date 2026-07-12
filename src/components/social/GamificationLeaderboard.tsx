"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Trophy, Flame, Medal, Crown } from "lucide-react"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GamificationLeaderboard — Tabla de clasificación entre amigos
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Muestra un ranking comparando rachas (streaks) e insignias entre conexiones.
 * NO expone valores de dinero — solo hábitos y logros.
 *
 * Props:
 *   - connections: array de usuarios conectados con sus stats de gamificación
 *   - currentUser: datos del usuario actual para posicionarlo en el ranking
 */

export interface LeaderboardEntry {
  id: string
  nombre: string
  streakActual: number
  streakMejor: number
  badgesCount: number
  isCurrentUser?: boolean
}

interface Props {
  entries: LeaderboardEntry[]
}

export function GamificationLeaderboard({ entries }: Props) {
  // Ordenar por streak actual (desc), luego por insignias (desc)
  const sorted = [...entries].sort((a, b) => {
    if (b.streakActual !== a.streakActual) return b.streakActual - a.streakActual
    return b.badgesCount - a.badgesCount
  })

  if (sorted.length === 0) {
    return (
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-6 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Conecta con amigos para ver el ranking.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Ranking de hábitos
          </h3>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            Compite con tus amigos por las mejores rachas financieras.
          </p>
        </div>

        {/* Tabla */}
        <div className="px-5 pb-2">
          {/* Header de columnas */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-medium pb-2 border-b border-border/50">
            <span className="w-6 text-center">#</span>
            <span className="flex-1">Usuario</span>
            <span className="w-16 text-center">Racha</span>
            <span className="w-16 text-center">Mejor</span>
            <span className="w-16 text-center">Insignias</span>
          </div>
        </div>

        {/* Filas */}
        <div className="px-5 pb-5 space-y-1">
          {sorted.map((entry, idx) => {
            const position = idx + 1
            const isTop3 = position <= 3

            return (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-3 py-2 px-2 rounded-xl transition-colors",
                  entry.isCurrentUser && "bg-kiri-emerald/5 ring-1 ring-kiri-emerald/20",
                  !entry.isCurrentUser && "hover:bg-muted/10"
                )}
              >
                {/* Posición */}
                <div className="w-6 flex items-center justify-center shrink-0">
                  {position === 1 ? <Crown className="h-4 w-4 text-amber-500" /> :
                   position === 2 ? <Medal className="h-4 w-4 text-gray-400" /> :
                   position === 3 ? <Medal className="h-4 w-4 text-amber-700" /> :
                   <span className="text-xs font-bold text-muted-foreground">{position}</span>}
                </div>

                {/* Nombre */}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-bold truncate", entry.isCurrentUser && "text-kiri-emerald")}>
                    {entry.nombre} {entry.isCurrentUser && "(Tú)"}
                  </p>
                </div>

                {/* Racha actual */}
                <div className="w-16 text-center">
                  <span className={cn(
                    "text-xs font-bold inline-flex items-center gap-0.5",
                    entry.streakActual >= 7 ? "text-amber-500" : "text-foreground"
                  )}>
                    <Flame className="h-3 w-3" />
                    {entry.streakActual}
                  </span>
                </div>

                {/* Mejor racha */}
                <div className="w-16 text-center">
                  <span className="text-xs text-muted-foreground">{entry.streakMejor}</span>
                </div>

                {/* Insignias */}
                <div className="w-16 text-center">
                  <span className="text-xs font-bold">{entry.badgesCount}</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
