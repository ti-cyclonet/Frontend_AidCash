"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useStreaks, BADGES, BadgeDefinition } from "@/hooks/use-streaks"
import { useAppContext } from "@/lib/app-context"
import { IncomeFrequency } from "@/lib/types"
import { Flame, Droplets, Trophy, Lock } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface Props {
  /** true si el presupuesto del periodo actual se cumple (obligaciones ≤ ingreso) */
  budgetOnTrack: boolean
  /** true si el presupuesto está sobrecargado */
  isOverloaded: boolean
}

/**
 * Jardín de Progreso — metáfora visual gamificada.
 *
 * El jardín tiene 5 estados basados en la racha:
 *   0 semanas: Semilla (terreno seco)
 *   1 semana:  Brote
 *   2-3 semanas: Planta joven
 *   4-7 semanas: Arbusto floreciente
 *   8+ semanas: Árbol completo
 *
 * Si isOverloaded = true, el jardín "pide agua" con efecto visual.
 */
export function ProgressGarden({ budgetOnTrack, isOverloaded }: Props) {
  const { incomeFrequency } = useAppContext()
  const { streakActual, streakMejor, badgesDesbloqueados, loading, periodDays } = useStreaks(incomeFrequency)
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false)

  const periodoNombre = incomeFrequency === 'quincenal' ? 'quincenas' : 'meses'
  const periodoSingular = incomeFrequency === 'quincenal' ? 'quincena' : 'mes'

  if (loading) {
    // Muestra el jardín en estado semilla mientras carga
    return (
      <Card className="border-none rounded-3xl overflow-hidden bg-amber-50/30">
        <CardContent className="p-6 flex items-center gap-5">
          <div className="text-5xl">🌰</div>
          <div className="flex-1 space-y-1">
            <p className="font-bold text-sm">Tu jardín financiero</p>
            <p className="text-[11px] text-muted-foreground">Cargando tu progreso...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Determinar estado del jardín ───────────────────────────────────────────
  const gardenLevel = streakActual >= 12 ? 5
    : streakActual >= 8 ? 4
    : streakActual >= 4 ? 3
    : streakActual >= 2 ? 2
    : streakActual >= 1 ? 1
    : 0

  const gardenConfig = GARDEN_LEVELS[gardenLevel]
  const needsWater = isOverloaded || !budgetOnTrack

  return (
    <div className="space-y-3">
      {/* ── Jardín visual ── */}
      <Card className={cn(
        "border-none rounded-3xl overflow-hidden relative transition-all duration-700",
        needsWater ? "bg-amber-50/50" : gardenConfig.bgClass
      )}>
        {/* Efecto de brillo cuando la racha es alta */}
        {gardenLevel >= 3 && !needsWater && (
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10 animate-pulse" />
        )}

        <CardContent className="p-6 flex items-center gap-5">
          {/* Ícono del jardín */}
          <div className={cn(
            "relative transition-all duration-500",
            needsWater && "grayscale-[60%] opacity-70"
          )}>
            <div className={cn(
              "text-5xl transition-transform duration-700",
              !needsWater && gardenLevel >= 3 && "animate-bounce-slow"
            )}>
              {gardenConfig.emoji}
            </div>
            {/* Partículas animadas para nivel alto */}
            {gardenLevel >= 4 && !needsWater && (
              <div className="absolute -top-1 -right-1">
                <div className="text-xs animate-ping">✨</div>
              </div>
            )}
          </div>

          {/* Texto */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm">{gardenConfig.titulo}</p>
              {needsWater && (
                <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full animate-pulse">
                  <Droplets className="h-3 w-3" /> Necesita agua
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {needsWater ? gardenConfig.mensajeNegativo : gardenConfig.mensajePositivo}
            </p>

            {/* Racha counter */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                <Flame className={cn("h-4 w-4", streakActual > 0 ? "text-orange-500" : "text-muted-foreground/40")} />
                <span className="text-sm font-black">
                  {streakActual}
                  <span className="text-[10px] text-muted-foreground font-medium ml-0.5">
                    {streakActual === 1 ? periodoSingular : periodoNombre}
                  </span>
                </span>
              </div>
              {streakMejor > streakActual && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Trophy className="h-3 w-3" />
                  Mejor: {streakMejor}
                </div>
              )}
            </div>
          </div>

          {/* Nivel visual */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg transition-colors",
              needsWater
                ? "bg-amber-100 text-amber-700"
                : "bg-cyclon-mint/20 text-cyclon-periwinkle"
            )}>
              {gardenLevel}
            </div>
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Nivel</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Insignias ── */}
      <button onClick={() => setBadgeDialogOpen(true)} className="w-full">
        <Card className="border-none bg-card shadow-sm rounded-2xl hover:bg-muted/30 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex -space-x-2">
              {badgesDesbloqueados.slice(0, 5).map(badgeId => {
                const badge = BADGES.find(b => b.id === badgeId)
                return badge ? (
                  <div
                    key={badgeId}
                    className="h-8 w-8 rounded-full bg-cyclon-lavender/10 border-2 border-background flex items-center justify-center text-sm"
                  >
                    {badge.icono}
                  </div>
                ) : null
              })}
              {badgesDesbloqueados.length === 0 && (
                <div className="h-8 w-8 rounded-full bg-muted/50 border-2 border-background flex items-center justify-center">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs">
                {badgesDesbloqueados.length > 0
                  ? `${badgesDesbloqueados.length} insignia${badgesDesbloqueados.length > 1 ? 's' : ''} desbloqueada${badgesDesbloqueados.length > 1 ? 's' : ''}`
                  : 'Sin insignias aún'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {badgesDesbloqueados.length > 0
                  ? 'Toca para ver todas tus insignias'
                  : 'Mantén tu racha para desbloquear'}
              </p>
            </div>
            <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </button>

      {/* ── Modal de insignias ── */}
      <Dialog open={badgeDialogOpen} onOpenChange={setBadgeDialogOpen}>
        <DialogContent >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyclon-lavender" />
              Insignias
            </DialogTitle>
            <DialogDescription>
              Desbloquea insignias cumpliendo tu presupuesto semana a semana.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {BADGES.map(badge => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                unlocked={badgesDesbloqueados.includes(badge.id)}
                freq={incomeFrequency}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tarjeta de insignia ──────────────────────────────────────────────────────

function BadgeCard({ badge, unlocked, freq }: { badge: BadgeDefinition; unlocked: boolean; freq: IncomeFrequency }) {
  return (
    <Card className={cn(
      "border-2 rounded-2xl shadow-none transition-all",
      unlocked
        ? "border-cyclon-lavender/40 bg-cyclon-lavender/5"
        : "border-muted bg-muted/20 opacity-50"
    )}>
      <CardContent className="p-3 flex flex-col items-center text-center gap-2">
        <div className={cn(
          "text-3xl transition-transform",
          unlocked && "animate-bounce-slow"
        )}>
          {unlocked ? badge.icono : '🔒'}
        </div>
        <div>
          <p className="font-bold text-[11px] leading-tight">{badge.nombre}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
            {unlocked ? badge.getDescripcion(freq) : badge.getCondicion(freq)}
          </p>
        </div>
        {unlocked && (
          <span className="text-[8px] font-black text-cyclon-lavender bg-cyclon-lavender/10 px-2 py-0.5 rounded-full uppercase">
            Desbloqueada
          </span>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Configuración de niveles del jardín ──────────────────────────────────────

const GARDEN_LEVELS = [
  {
    emoji: '🌰',
    titulo: 'Semilla plantada',
    bgClass: 'bg-amber-50/30',
    mensajePositivo: 'Tu jardín financiero está empezando. Cumple una semana para ver el primer brote.',
    mensajeNegativo: 'Tu jardín necesita atención. Ajusta tu presupuesto para que pueda crecer.',
  },
  {
    emoji: '🌱',
    titulo: '¡Primer brote!',
    bgClass: 'bg-green-50/40',
    mensajePositivo: '¡Buen inicio! Una semana cumpliendo tu plan. Sigue así para ver crecer tu jardín.',
    mensajeNegativo: 'El brote necesita agua. Revisa tus gastos para mantener la racha.',
  },
  {
    emoji: '🌿',
    titulo: 'Planta joven',
    bgClass: 'bg-green-50/60',
    mensajePositivo: 'Tu disciplina se nota. La planta está echando raíces fuertes.',
    mensajeNegativo: 'La planta se está secando. Vuelve al presupuesto para recuperarla.',
  },
  {
    emoji: '🌻',
    titulo: 'En flor',
    bgClass: 'bg-cyclon-mint/10',
    mensajePositivo: '¡Tu jardín está floreciendo! Un mes de disciplina financiera.',
    mensajeNegativo: 'Las flores necesitan cuidado. No dejes que la racha se rompa.',
  },
  {
    emoji: '🌳',
    titulo: 'Árbol robusto',
    bgClass: 'bg-cyclon-mint/15',
    mensajePositivo: 'Dos meses de constancia. Tu árbol financiero da sombra y frutos.',
    mensajeNegativo: 'Incluso los árboles necesitan agua. Revisa tu situación.',
  },
  {
    emoji: '🏡',
    titulo: 'Jardín completo',
    bgClass: 'bg-gradient-to-br from-cyclon-mint/10 to-cyclon-sky/10',
    mensajePositivo: '¡Leyenda! Tu jardín está en plena floración. Eres un ejemplo de disciplina.',
    mensajeNegativo: 'Tu jardín es hermoso, pero necesita mantenimiento. ¡Cuídalo!',
  },
]
