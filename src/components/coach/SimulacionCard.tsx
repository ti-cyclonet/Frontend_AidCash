"use client"

import { Calculator, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SimulacionIA } from "@/lib/kiri-acciones"
import type { IncomeFrequency } from "@/lib/types"
import { simulateDebtOptions } from "@/lib/recommendations"
import { proyectarAhorro, planParaMeta, fechaParaMeta, viabilidad, fechaLegible, type Viabilidad } from "@/lib/simulaciones"
import { tr } from "@/lib/i18n"

/**
 * Tarjeta del escenario que Kiri Coach simuló en el chat. Las cifras salen de
 * las mismas funciones que los simuladores de Ahorro y de Obligaciones, con la
 * distribución real del periodo; "Abrir en el simulador" lo abre ya lleno.
 */
interface Props {
  sim: SimulacionIA
  ahorroSugerido: number
  margenLibre: number
  debtCapacity: number
  incomeFrequency: IncomeFrequency
  formatAmount: (n: number) => string
  onAbrir: () => void
}

const TONO_VIA: Record<Viabilidad, "ok" | "warn" | "bad"> = { holgado: "ok", justo: "ok", libre: "warn", no_alcanza: "bad" }
const TEXTO_VIA: Record<Viabilidad, string> = {
  holgado: "Cabe en tu ahorro sugerido.",
  justo: "Usa casi todo tu ahorro sugerido.",
  libre: "Pasa tu ahorro sugerido: saldría de tu margen libre.",
  no_alcanza: "Con tus ingresos y obligaciones de hoy no te alcanza.",
}

function Linea({ tono, children }: { tono: "ok" | "warn" | "bad"; children: React.ReactNode }) {
  const Icono = tono === "ok" ? CheckCircle2 : tono === "warn" ? AlertTriangle : XCircle
  return (
    <p className={cn("flex items-start gap-1.5 text-[11px]", tono === "ok" ? "text-emerald-700 dark:text-emerald-400" : tono === "warn" ? "text-amber-700 dark:text-amber-400" : "text-destructive")}>
      <Icono className="h-3.5 w-3.5 shrink-0 mt-px" /><span>{children}</span>
    </p>
  )
}

export function SimulacionCard({ sim, ahorroSugerido, margenLibre, debtCapacity, incomeFrequency, formatAmount, onAbrir }: Props) {
  const periodo = incomeFrequency === "quincenal" ? tr("quincena") : tr("mes")
  const base = { inicial: sim.inicial ?? 0, tasaAnual: sim.tasaAnual ?? 0, frecuencia: incomeFrequency }
  const esCuotas = sim.tipo === "compra_cuotas"

  let titulo = ""
  let cuerpo: React.ReactNode = null

  if (sim.tipo === "ahorro_futuro" && sim.aporte) {
    const meses = sim.meses ?? 12
    const p = proyectarAhorro({ ...base, aporte: sim.aporte, meses })
    const via = viabilidad(sim.aporte, ahorroSugerido, margenLibre)
    titulo = tr("¿Cuánto tendré?")
    cuerpo = (
      <>
        <p className="text-[11px] text-muted-foreground">{tr("Ahorrando {0} cada {1} durante {2} {3}", [formatAmount(sim.aporte), periodo, meses, meses === 1 ? tr("mes") : tr("meses")])}</p>
        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatAmount(p.final)}</p>
        <p className="text-[11px] text-muted-foreground">{tr("el {0}", [fechaLegible(p.fechaFin)])}{p.rendimiento > 0 && <>{" · "}{tr("{0} en rendimientos", [formatAmount(p.rendimiento)])}</>}</p>
        {ahorroSugerido > 0 && <Linea tono={TONO_VIA[via]}>{tr(TEXTO_VIA[via])}{" "}{tr("(sugerido: {0} por {1})", [formatAmount(ahorroSugerido), periodo])}</Linea>}
      </>
    )
  } else if (sim.tipo === "ahorro_meta" && sim.monto) {
    const que = sim.nombre || tr("tu compra")
    titulo = tr("Ahorrar para {0}", [que])
    if (sim.fecha) {
      const fecha = new Date(`${sim.fecha}T12:00:00`)
      const plan = planParaMeta({ ...base, meta: sim.monto, fecha })
      const via = viabilidad(plan.aporte, ahorroSugerido, margenLibre)
      const conSugerido = ahorroSugerido > 0 ? fechaParaMeta({ ...base, meta: sim.monto, aporte: ahorroSugerido }) : null
      cuerpo = plan.alcanzada ? (
        <Linea tono="ok">{tr("¡Ya tienes lo necesario para {0}!", [que])}</Linea>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">{tr("{0} para el {1}: ahorra cada {2}", [formatAmount(sim.monto), fechaLegible(fecha), periodo])}</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatAmount(plan.aporte)}</p>
          {incomeFrequency === "quincenal" && <p className="text-[11px] text-muted-foreground">{tr("({0} al mes)", [formatAmount(plan.aporteMes)])}</p>}
          {ahorroSugerido > 0
            ? <Linea tono={TONO_VIA[via]}>{tr(TEXTO_VIA[via])}{(via === "libre" || via === "no_alcanza") && conSugerido && <>{" "}{tr("Con tu ahorro sugerido lo tendrías el {0}.", [fechaLegible(conSugerido)])}</>}</Linea>
            : <Linea tono="bad">{tr("Hoy no te queda ahorro sugerido en el periodo.")}</Linea>}
        </>
      )
    } else {
      const conSugerido = ahorroSugerido > 0 ? fechaParaMeta({ ...base, meta: sim.monto, aporte: ahorroSugerido }) : null
      cuerpo = (
        <>
          <p className="text-[11px] text-muted-foreground">{tr("Cuesta {0}", [formatAmount(sim.monto)])}</p>
          {conSugerido
            ? <p className="text-sm font-bold">{tr("Con tu ahorro sugerido ({0} por {1}) lo tendrías el {2}.", [formatAmount(ahorroSugerido), periodo, fechaLegible(conSugerido)])}</p>
            : <Linea tono="bad">{tr("Hoy no te queda ahorro sugerido en el periodo.")}</Linea>}
          <p className="text-[11px] text-muted-foreground">{tr("Elige la fecha en el simulador para ver cuánto ahorrar.")}</p>
        </>
      )
    }
  } else if (esCuotas && sim.monto) {
    const { canAffordAny, options } = simulateDebtOptions(sim.monto, debtCapacity, incomeFrequency)
    titulo = tr("Comprar {0} a cuotas", [sim.nombre || tr("a cuotas")])
    cuerpo = !canAffordAny ? (
      <Linea tono="bad">{tr("No tienes margen de endeudamiento. Liquida deudas o aumenta ingresos primero.")}</Linea>
    ) : (
      <>
        <p className="text-[11px] text-muted-foreground">{tr("{0} con tu capacidad de {1} por {2}", [formatAmount(sim.monto), formatAmount(debtCapacity), periodo])}</p>
        <ul className="space-y-1">
          {options.map(o => (
            <li key={o.label} className={cn("flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-[11px]", o.recommended ? "bg-cyclon-lavender/10 font-bold" : "bg-muted/40")}>
              <span className="flex items-center gap-1 min-w-0 truncate">{o.recommended && <Star className="h-3 w-3 text-cyclon-lavender shrink-0" />}{tr(o.label)}</span>
              <span className="tabular-nums shrink-0">{o.canAfford ? tr("{0}/{1} · {2} m", [formatAmount(o.quota), periodo, o.months]) : tr("más de 4 años")}</span>
            </li>
          ))}
        </ul>
      </>
    )
  }

  if (!cuerpo) return null
  return (
    <div className={cn("rounded-2xl border-2 p-3 space-y-1.5 bg-card", esCuotas ? "border-cyclon-lavender/40" : "border-emerald-500/40")}>
      <p className={cn("text-xs font-bold flex items-center gap-1.5", esCuotas ? "text-cyclon-lavender" : "text-emerald-600 dark:text-emerald-400")}>
        <Calculator className="h-3.5 w-3.5" />{titulo}
      </p>
      {cuerpo}
      <button onClick={onAbrir} className={cn("flex items-center gap-1 text-[11px] font-bold hover:underline pt-0.5", esCuotas ? "text-cyclon-lavender" : "text-emerald-600 dark:text-emerald-400")}>
        {tr("Abrir en el simulador")} <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  )
}
