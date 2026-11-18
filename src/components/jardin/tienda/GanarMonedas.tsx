"use client"

/**
 * "Cómo ganar monedas" de la tienda del jardín. Las monedas no se compran: solo
 * se ganan con buenos hábitos (ahorrar, estar al día, no gastarse la semana).
 * Cada forma de ganar es una tarjetita animada con su progreso de hoy o del
 * periodo, para que se vea qué falta y no sea un texto plano.
 */
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { CalendarCheck, CalendarDays, Check, Coins, Gem, HeartHandshake, PartyPopper, PiggyBank } from "lucide-react"
import type { EstadoTienda } from "@/lib/api-client"
import { tr } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface Forma {
  icono: LucideIcon
  tono: string
  titulo: string
  detalle: string
  premio: string
  /** null = sin progreso que mostrar */
  progreso?: { hechos: number; total: number } | null
  hecho?: boolean
}

export function GanarMonedas({ abonos }: { abonos: EstadoTienda["abonos"] }) {
  const formas: Forma[] = [
    {
      icono: PiggyBank, tono: "from-emerald-400 to-emerald-600",
      titulo: tr("Ahorra"), detalle: tr("Cada ahorro que registras, hasta {0} al día", [abonos.ahorro.maxDia]),
      premio: `+${abonos.ahorro.monedas}`, progreso: { hechos: Math.min(abonos.ahorro.hoy, abonos.ahorro.maxDia), total: abonos.ahorro.maxDia },
    },
    {
      icono: CalendarCheck, tono: "from-sky-400 to-blue-600",
      titulo: tr("Ponte al día"), detalle: tr("Paga todas las obligaciones de tu periodo"),
      premio: `+${abonos.obligaciones.monedas}`, hecho: abonos.obligaciones.ganadasEstePeriodo,
    },
    {
      icono: CalendarDays, tono: "from-amber-400 to-orange-500",
      titulo: tr("Cumple tu semana"), detalle: tr("No te pases de lo que puedes gastar en la semana"),
      premio: "+5",
    },
    {
      icono: PartyPopper, tono: "from-rose-400 to-pink-600",
      titulo: tr("Salda una deuda"), detalle: tr("Págala por completo y llega un cofre común"),
      premio: `+${abonos.deuda.monedas}`,
    },
    {
      icono: Gem, tono: "from-violet-400 to-indigo-600",
      titulo: tr("Sube de nivel"), detalle: tr("Tu árbol crece y te da un cofre raro"),
      premio: tr("Cofre"),
    },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-50 via-background to-emerald-50 p-3 dark:from-amber-500/10 dark:via-background dark:to-emerald-500/10">
      {/* monedas que flotan detrás del título */}
      {[0, 1, 2].map(i => (
        <motion.span key={i} aria-hidden className="pointer-events-none absolute text-amber-400/40"
          style={{ right: 14 + i * 26, top: 8 + (i % 2) * 10 }}
          animate={{ y: [0, -6, 0], rotate: [0, i % 2 ? -18 : 18, 0] }}
          transition={{ duration: 2.4 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}>
          <Coins className="h-5 w-5" />
        </motion.span>
      ))}

      <p className="flex items-center gap-1.5 text-sm font-extrabold">
        <motion.span animate={{ rotateY: [0, 360] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.6 }} className="inline-flex">
          <Coins className="h-4 w-4 text-amber-500" />
        </motion.span>
        {tr("Cómo ganar monedas")}
      </p>

      <div className="mt-2.5 space-y-1.5">
        {formas.map((f, i) => {
          const Icono = f.icono
          const listo = f.hecho || (f.progreso && f.progreso.hechos >= f.progreso.total)
          return (
            <motion.div key={f.titulo}
              initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 * i, type: "spring", stiffness: 320, damping: 24 }}
              whileHover={{ scale: 1.015 }}
              className={cn("flex items-center gap-2.5 rounded-xl border bg-card/80 p-2 shadow-sm backdrop-blur-sm",
                listo ? "border-emerald-500/40" : "border-border/70")}>
              <motion.span
                whileHover={{ rotate: [0, -10, 10, 0] }}
                className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-inner", f.tono)}>
                <Icono className="h-[18px] w-[18px]" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[12px] font-bold leading-tight">
                  {f.titulo}
                  {listo && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300"><Check className="h-2.5 w-2.5" />{f.hecho ? tr("Este periodo") : tr("Hoy")}</span>}
                </p>
                <p className="text-[10.5px] leading-snug text-muted-foreground">{f.detalle}</p>
                {f.progreso && (
                  <div className="mt-1 flex gap-1">
                    {Array.from({ length: f.progreso.total }, (_, k) => (
                      <motion.span key={k} className={cn("h-1.5 flex-1 rounded-full", k < f.progreso!.hechos ? "bg-emerald-500" : "bg-muted")}
                        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.2 + 0.06 * i + k * 0.08 }} style={{ originX: 0 }} />
                    ))}
                  </div>
                )}
              </div>
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15 + 0.06 * i, type: "spring", stiffness: 420, damping: 14 }}
                className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
                {f.premio}<Coins className="h-3 w-3" />
              </motion.span>
            </motion.div>
          )
        })}
      </div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-emerald-500/10 p-2 text-[11px] leading-snug text-emerald-800 dark:text-emerald-200">
        <HeartHandshake className="mt-px h-3.5 w-3.5 shrink-0" />
        {tr("Las monedas solo se ganan usando Kiri: premian tus buenos hábitos, como ahorrar, estar al día y evitar los gastos hormiga. Regar, sacudir y cosechar le dan XP a tu árbol.")}
      </motion.p>
    </div>
  )
}
