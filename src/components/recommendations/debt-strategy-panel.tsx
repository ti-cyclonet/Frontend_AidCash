"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Snowflake, Flame, CalendarCheck, Trophy, ChevronDown, ChevronUp, CheckCircle2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { DebtStrategy } from "@/lib/recommendations"
import { useAppContext } from "@/lib/app-context"

interface Props {
  snowball: DebtStrategy
  avalanche: DebtStrategy
  avalancheWins: boolean
}

export function DebtStrategyPanel({ snowball, avalanche, avalancheWins }: Props) {
  const { formatAmount } = useAppContext()
  const [detailStrategy, setDetailStrategy] = useState<DebtStrategy | null>(null)
  const [expanded, setExpanded] = useState(false)

  // El más rápido termina en menos periodos
  const faster = avalancheWins ? avalanche : snowball
  const slower = avalancheWins ? snowball : avalanche
  const diferenciasMeses = Math.abs(snowball.mesesTotal - avalanche.mesesTotal)

  // Barra comparativa: el más largo = 100%
  const maxPeriodos = Math.max(snowball.periodosTotal, avalanche.periodosTotal, 1)
  const snowballPct = Math.round((snowball.periodosTotal / maxPeriodos) * 100)
  const avalanchePct = Math.round((avalanche.periodosTotal / maxPeriodos) * 100)

  return (
    <>
      <div className="space-y-3">
        {/* ── Header ── */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between"
        >
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Estrategias para salir de deudas
          </h2>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </button>

        {/* ── Resumen compacto — siempre visible ── */}
        <div className="grid grid-cols-2 gap-3">
          <StrategyCard
            strategy={snowball}
            isFaster={!avalancheWins}
            icon={<Snowflake className="h-4 w-4" />}
            color="text-cyclon-sky"
            bgColor="bg-cyclon-sky/10"
            barColor="bg-cyclon-sky"
            pct={snowballPct}
            onDetail={() => setDetailStrategy(snowball)}
            formatAmount={formatAmount}
          />
          <StrategyCard
            strategy={avalanche}
            isFaster={avalancheWins}
            icon={<Flame className="h-4 w-4" />}
            color="text-cyclon-pink"
            bgColor="bg-cyclon-pink/10"
            barColor="bg-cyclon-pink"
            pct={avalanchePct}
            onDetail={() => setDetailStrategy(avalanche)}
            formatAmount={formatAmount}
          />
        </div>

        {/* ── Veredicto ── */}
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-3 flex items-start gap-3">
            <div className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
              avalancheWins ? "bg-cyclon-pink/10 text-cyclon-pink" : "bg-cyclon-sky/10 text-cyclon-sky"
            )}>
              {avalancheWins ? <Flame className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold">
                {faster.nombre} te libera antes
                {diferenciasMeses > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {" "}({diferenciasMeses} {diferenciasMeses === 1 ? 'mes' : 'meses'} antes que {slower.nombre})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {faster.nombre === 'Bola de Nieve'
                  ? 'Las victorias rápidas con deudas pequeñas mantienen la motivación.'
                  : 'Atacar la deuda con mayor carga relativa reduce el tiempo total.'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Detalle expandible: línea de tiempo ── */}
        {expanded && (
          <div className="space-y-3 pt-1">
            <TimelineSection strategy={snowball} color="text-cyclon-sky" dotColor="bg-cyclon-sky" formatAmount={formatAmount} />
            <TimelineSection strategy={avalanche} color="text-cyclon-pink" dotColor="bg-cyclon-pink" formatAmount={formatAmount} />
          </div>
        )}
      </div>

      {/* ── Modal de detalle ── */}
      <Dialog open={!!detailStrategy} onOpenChange={v => !v && setDetailStrategy(null)}>
        <DialogContent >
          {detailStrategy && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailStrategy.nombre === 'Bola de Nieve'
                    ? <Snowflake className="h-5 w-5 text-cyclon-sky" />
                    : <Flame className="h-5 w-5 text-cyclon-pink" />
                  }
                  {detailStrategy.nombre}
                </DialogTitle>
                <DialogDescription>{detailStrategy.descripcion}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* KPIs */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Meses',   value: String(detailStrategy.mesesTotal) },
                    { label: 'Libre en', value: detailStrategy.fechaLibre },
                    { label: 'Total pagado', value: formatAmount(detailStrategy.totalPagado) },
                  ].map(kpi => (
                    <Card key={kpi.label} className="border-none bg-muted/40 rounded-2xl shadow-none">
                      <CardContent className="p-3 text-center">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{kpi.label}</p>
                        <p className="text-sm font-black mt-0.5 leading-tight">{kpi.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Orden de liquidación */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Orden de liquidación
                  </p>
                  {detailStrategy.pasos.map((paso, i) => (
                    <div key={paso.debtId} className="flex items-start gap-3">
                      <div className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5",
                        detailStrategy.nombre === 'Bola de Nieve'
                          ? "bg-cyclon-sky/20 text-cyclon-sky"
                          : "bg-cyclon-pink/20 text-cyclon-pink"
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{paso.nombre}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Liquidada en periodo {paso.liquidaEnPeriodo}
                          {" · "}libera <span className="font-bold text-cyclon-periwinkle">{formatAmount(paso.cuotaLiberada)}/periodo</span>
                        </p>
                      </div>
                      <CheckCircle2 className={cn(
                        "h-4 w-4 shrink-0 mt-1",
                        detailStrategy.nombre === 'Bola de Nieve' ? "text-cyclon-sky" : "text-cyclon-pink"
                      )} />
                    </div>
                  ))}
                </div>

                {/* Consejo */}
                <Card className="border-none bg-cyclon-lavender/5 rounded-2xl">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      💡 {detailStrategy.nombre === 'Bola de Nieve'
                        ? 'Cada deuda que liquidas libera su cuota para atacar la siguiente más rápido. El efecto se acelera con el tiempo.'
                        : 'Al atacar la deuda con mayor carga relativa, reduces más rápido el total de lo que debes, aunque tarde un poco más en ver la primera victoria.'
                      }
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Tarjeta de estrategia (compacta) ─────────────────────────────────────────

function StrategyCard({ strategy, isFaster, icon, color, bgColor, barColor, pct, onDetail, formatAmount }: {
  strategy: DebtStrategy
  isFaster: boolean
  icon: React.ReactNode
  color: string
  bgColor: string
  barColor: string
  pct: number
  onDetail: () => void
  formatAmount: (n: number) => string
}) {
  return (
    <button onClick={onDetail} className="text-left w-full">
      <Card className={cn(
        "border-2 rounded-2xl shadow-none transition-all hover:scale-[1.02] active:scale-95",
        isFaster ? "border-cyclon-lavender/40 bg-cyclon-lavender/5" : "border-border bg-card"
      )}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", bgColor, color)}>
              {icon}
            </div>
            {isFaster && (
              <span className="text-[9px] font-black bg-cyclon-lavender/20 text-cyclon-lavender px-1.5 py-0.5 rounded-full">
                MÁS RÁPIDO
              </span>
            )}
          </div>

          {/* Nombre */}
          <div>
            <p className="font-bold text-xs">{strategy.nombre}</p>
            <p className={cn("text-xl font-black mt-0.5", color)}>
              {strategy.mesesTotal}
              <span className="text-xs font-medium text-muted-foreground ml-1">meses</span>
            </p>
          </div>

          {/* Fecha libre */}
          <div className="flex items-center gap-1">
            <CalendarCheck className="h-3 w-3 text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground capitalize">{strategy.fechaLibre}</p>
          </div>

          {/* Barra de tiempo */}
          <Progress value={pct} className="h-1.5" indicatorClassName={barColor} />

          {/* Ver detalle */}
          <div className={cn("flex items-center gap-1 text-[10px] font-bold", color)}>
            Ver orden <ArrowRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

// ─── Línea de tiempo expandida ────────────────────────────────────────────────

function TimelineSection({ strategy, color, dotColor, formatAmount }: {
  strategy: DebtStrategy
  color: string
  dotColor: string
  formatAmount: (n: number) => string
}) {
  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <p className={cn("font-bold text-sm", color)}>{strategy.nombre}</p>
          <span className="text-xs text-muted-foreground">· libre en {strategy.fechaLibre}</span>
        </div>
        <div className="space-y-2 pl-2 border-l-2 border-dashed border-border ml-1">
          {strategy.pasos.map((paso, i) => (
            <div key={paso.debtId} className="flex items-start gap-3 relative">
              <div className={cn(
                "h-4 w-4 rounded-full border-2 border-background flex items-center justify-center shrink-0 -ml-[9px]",
                dotColor
              )} />
              <div className="pb-2">
                <p className="text-xs font-bold">{paso.nombre}</p>
                <p className="text-[10px] text-muted-foreground">
                  Periodo {paso.liquidaEnPeriodo} · libera {formatAmount(paso.cuotaLiberada)}/periodo
                  {i < strategy.pasos.length - 1 && " → rueda a la siguiente"}
                </p>
              </div>
            </div>
          ))}
          {/* Meta final */}
          <div className="flex items-start gap-3 relative">
            <div className={cn("h-4 w-4 rounded-full flex items-center justify-center shrink-0 -ml-[9px]", dotColor)}>
              <CheckCircle2 className="h-3 w-3 text-white" />
            </div>
            <p className="text-xs font-bold capitalize">{strategy.fechaLibre} — ¡Libre de deudas!</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
