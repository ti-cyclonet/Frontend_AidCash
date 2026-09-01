"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Flame, Lock, Check, Gift, ChevronLeft, Sparkles } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useStreaks } from "@/hooks/use-streaks"
import { useMissions } from "@/hooks/use-missions"
import { calculateGardenXP } from "@/lib/garden-xp"
import type { RewardResult } from "@/lib/types"

// ─── Hitos de racha — solo informativos, se comparan contra streakActual real ──

const MILESTONES = [
  { days: 7, label: "7 días", reward: "Farolito" },
  { days: 30, label: "30 días", reward: "Bonsái" },
  { days: 100, label: "100 días", reward: "Insignia dorada" },
]

export default function MisionesPage() {
  const { incomeFrequency } = useAppContext()
  const { streakActual, badgesDesbloqueados, xpFromMissions, loading: streakLoading, refetch: refetchStreaks } = useStreaks(incomeFrequency)
  const { daily, weekly, loading: missionsLoading, claim } = useMissions()

  const [claiming, setClaiming] = useState<string | null>(null)
  const [reward, setReward] = useState<{ missionKey: string; result: RewardResult } | null>(null)

  const loading = streakLoading || missionsLoading
  const currentXP = calculateGardenXP(streakActual, badgesDesbloqueados.length, xpFromMissions)

  const handleClaim = async (missionKey: string) => {
    setClaiming(missionKey)
    const result = await claim(missionKey)
    setClaiming(null)
    if (result) {
      setReward({ missionKey, result })
      // El XP (o boost) recién ganado vive en el backend — refrescar para que
      // el contador de arriba se actualice en tiempo real.
      refetchStreaks()
    }
  }

  return (
    <div className="space-y-5 pb-8">
      {/* ═══ HEADER ═══ */}
      <header className="flex items-start justify-between gap-2">
        <div>
          <Link href="/jardin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
            <ChevronLeft className="h-3.5 w-3.5" /> Volver al jardín
          </Link>
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            🎯 Misiones
          </p>
          <h1 className="text-xl font-black mt-0.5">Tus misiones de hoy</h1>
          <p className="text-muted-foreground text-xs">
            Completa misiones y reclama el cofre — la recompensa siempre es sorpresa.
          </p>
        </div>
        {/* XP en vivo — sube apenas se reclama una recompensa */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2 shrink-0">
          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <div className="text-right">
            <p className="text-[8px] text-muted-foreground">XP total</p>
            <motion.p
              key={currentXP}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 12 }}
              className="text-sm font-black text-amber-600 dark:text-amber-400"
            >
              {currentXP}
            </motion.p>
          </div>
        </div>
      </header>

      {loading ? (
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Cargando misiones…
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ═══ MISIÓN SEMANAL ═══ */}
          {weekly && (
            <Card className="border border-amber-500/30 bg-amber-500/5 rounded-2xl">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-lg shrink-0">
                    {weekly.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{weekly.title}</p>
                    <p className="text-[11px] text-muted-foreground">{weekly.desc}</p>
                  </div>
                </div>
                <Progress
                  value={(weekly.progress / weekly.target) * 100}
                  className="h-2"
                  indicatorClassName="bg-amber-500"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{weekly.progress}/{weekly.target} días</span>
                  {weekly.claimed ? (
                    <span className="text-[10px] font-bold text-muted-foreground">Reclamada</span>
                  ) : weekly.progress >= weekly.target ? (
                    <Button
                      size="sm"
                      onClick={() => handleClaim(weekly.key)}
                      disabled={claiming === weekly.key}
                      className="h-7 gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold px-3"
                    >
                      <Gift className="h-3 w-3" /> {claiming === weekly.key ? "Abriendo…" : "Reclamar"}
                    </Button>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Recompensa mayor 🏆</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ MISIONES DIARIAS ═══ */}
          <Card className="border-none bg-card shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-1">
              <p className="text-sm font-bold">Misiones de hoy</p>
              <p className="text-[11px] text-muted-foreground mb-3">Se renuevan mañana a medianoche</p>

              <div className="space-y-4">
                {daily.map((m) => {
                  const done = m.progress >= m.target
                  return (
                    <div key={m.key} className="flex items-center gap-3">
                      <div className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0",
                        done ? "bg-emerald-500/15" : "bg-muted"
                      )}>
                        {m.claimed ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold">{m.title}</p>
                        <p className="text-[10px] text-muted-foreground mb-1">{m.desc}</p>
                        <Progress
                          value={(m.progress / m.target) * 100}
                          className="h-1.5"
                          indicatorClassName="bg-emerald-500"
                        />
                      </div>
                      <div className="shrink-0">
                        {m.claimed ? (
                          <span className="text-[10px] text-muted-foreground">Reclamada</span>
                        ) : done ? (
                          <Button
                            size="sm"
                            onClick={() => handleClaim(m.key)}
                            disabled={claiming === m.key}
                            className="h-8 gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold px-3"
                          >
                            <Gift className="h-3.5 w-3.5" /> {claiming === m.key ? "Abriendo…" : "Reclamar"}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{m.progress}/{m.target}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* ═══ HITOS DE RACHA ═══ */}
          <Card className="border-none bg-card shadow-sm rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-bold">Hitos de racha</span>
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 ml-auto">{streakActual} días</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {MILESTONES.map((mi) => {
                  const reached = streakActual >= mi.days
                  return (
                    <div
                      key={mi.days}
                      className={cn(
                        "text-center py-2.5 px-1.5 rounded-xl border",
                        reached
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-muted/40 border-border"
                      )}
                    >
                      {reached ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                      )}
                      <p className="text-[11px] font-bold">{mi.label}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{mi.reward}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══ COFRE SORPRESA ═══ */}
      <Dialog open={!!reward} onOpenChange={(open) => { if (!open) setReward(null) }}>
        <DialogContent className="text-center">
          <DialogTitle className="sr-only">Recompensa reclamada</DialogTitle>
          {reward && (
            <>
              <motion.div
                key="reward-icon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="text-6xl mb-3"
              >
                {reward.result.icon}
              </motion.div>
              <motion.div
                key="reward-text"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <p className="text-lg font-black">{reward.result.label}</p>
                <p className="text-xs text-muted-foreground mb-5">¡Misión completada!</p>
                <Button
                  onClick={() => setReward(null)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl"
                >
                  Genial
                </Button>
              </motion.div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
