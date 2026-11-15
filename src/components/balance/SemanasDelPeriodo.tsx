"use client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Historial — semanas del periodo
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * El periodo que se está viendo se parte en las mismas semanas del plan
 * semanal (2 si cobra quincenal, 4 si mensual; las primeras se llevan el día
 * que sobre). Cada tarjetita muestra lo gastado esa semana (gastos variables,
 * lo mismo que mide el plan) y, si esa semana tuvo plan, su meta y su sello.
 * Tocar una semana filtra la lista de movimientos a esa semana.
 */
import { motion } from "framer-motion"
import { CheckCircle2, XCircle, Hourglass, CircleDot } from "lucide-react"
import { cn } from "@/lib/utils"
import { tr, localeFecha } from "@/lib/i18n"
import type { Movement, SemanaPlanGuardada } from "@/lib/api-client"

export interface SemanaHistorial {
  indice: number
  start: Date
  end: Date // exclusivo
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const dia = (d: Date) => d.toLocaleDateString(localeFecha(), { day: "numeric", month: "short" })

/** Igual que partirEnSemanas del backend (lib/plan-semanal.ts). */
export function partirEnSemanas(start: Date, end: Date, n: number): SemanaHistorial[] {
  const total = Math.max(n, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  const base = Math.floor(total / n), extra = total % n
  const out: SemanaHistorial[] = []
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  for (let i = 0; i < n; i++) {
    const fin = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + base + (i < extra ? 1 : 0))
    out.push({ indice: i + 1, start: cursor, end: fin })
    cursor = fin
  }
  return out
}

export const enSemana = (m: Movement, s: SemanaHistorial) => { const f = new Date(m.fecha); return f >= s.start && f < s.end }

export function SemanasDelPeriodo({ semanas, movimientos, plan, seleccion, onSeleccion, formatAmount }: {
  semanas: SemanaHistorial[]
  /** Movimientos del periodo, sin filtros de tipo ni búsqueda */
  movimientos: Movement[]
  plan: SemanaPlanGuardada[]
  seleccion: number | null
  onSeleccion: (indice: number | null) => void
  formatAmount: (n: number) => string
}) {
  const hoy = new Date()
  const datos = semanas.map(s => {
    const gastado = movimientos.filter(m => m.tipo === "hormiga" && !m.noMueveBilletera && enSemana(m, s)).reduce((a, m) => a + m.monto, 0)
    const p = plan.find(x => x.inicio === ymd(s.start))
    const futura = s.start > hoy
    const actual = hoy >= s.start && hoy < s.end
    return { s, gastado, p, futura, actual }
  })
  const maximo = Math.max(1, ...datos.map(d => Math.max(d.gastado, d.p?.meta ?? 0)))
  const cuatro = semanas.length > 2

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-black">{tr("Tus semanas")}</p>
        {seleccion !== null ? (
          <button onClick={() => onSeleccion(null)} className="text-[10px] font-bold text-kiri-emerald hover:underline">{tr("Ver todo el periodo")}</button>
        ) : (
          <p className="text-[10px] text-muted-foreground">{tr("Toca una semana para ver sus movimientos")}</p>
        )}
      </div>
      <div className={cn("grid gap-2", cuatro ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        {datos.map(({ s, gastado, p, futura, actual }, i) => {
          const elegida = seleccion === s.indice
          const atenuada = seleccion !== null && !elegida
          const meta = p && p.meta > 0 ? p.meta : null
          const estado = p?.estado === "lograda" || p?.estado === "fallida" ? p.estado : null
          const pasado = meta !== null && gastado > meta
          const ancho = Math.min(100, (gastado / (meta ?? maximo)) * 100)
          return (
            <motion.button
              key={s.indice}
              type="button"
              disabled={futura}
              onClick={() => onSeleccion(elegida ? null : s.indice)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: atenuada ? 0.55 : 1, y: 0, scale: elegida ? 1.02 : 1 }}
              whileTap={futura ? undefined : { scale: 0.97 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
              className={cn(
                "relative text-left rounded-2xl p-3 border-2 transition-colors overflow-hidden",
                elegida ? "border-kiri-emerald bg-kiri-emerald/5" : "border-transparent bg-card shadow-sm hover:border-kiri-emerald/30",
                futura && "bg-muted/30 shadow-none cursor-default",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <p className={cn("text-[11px] font-black", futura && "text-muted-foreground")}>{tr("Semana {0}", [s.indice])}</p>
                {estado === "lograda" && <CheckCircle2 className="h-3.5 w-3.5 text-kiri-spring" />}
                {estado === "fallida" && <XCircle className="h-3.5 w-3.5 text-cyclon-pink" />}
                {!estado && actual && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-kiri-spring opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-kiri-spring" />
                  </span>
                )}
                {futura && <Hourglass className="h-3 w-3 text-muted-foreground" />}
              </div>
              <p className="text-[9px] text-muted-foreground">{s.start.getDate()} – {dia(new Date(s.end.getTime() - 86_400_000))}</p>

              {futura ? (
                <p className="text-[10px] text-muted-foreground mt-2">{tr("Aún no llega")}</p>
              ) : (
                <>
                  <p className={cn("text-sm font-black mt-1.5", pasado ? "text-cyclon-pink" : "text-foreground")}>{formatAmount(gastado)}</p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", pasado ? "bg-cyclon-pink" : estado === "lograda" ? "bg-kiri-spring" : "bg-kiri-emerald/70")}
                      initial={{ width: 0 }} animate={{ width: `${ancho}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1 truncate">
                    {meta !== null ? tr("de {0} planeado", [formatAmount(meta)]) : actual ? tr("En curso") : tr("Gastado")}
                  </p>
                </>
              )}
              {elegida && (
                <motion.span layoutId="semana-elegida" className="absolute right-2 bottom-2 text-kiri-emerald">
                  <CircleDot className="h-3 w-3" />
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
