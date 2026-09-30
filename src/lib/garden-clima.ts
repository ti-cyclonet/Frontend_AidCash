import { getNextPaymentInfo, formatPeriodo } from "@/lib/payment-schedule"
import type { Debt, FixedExpense } from "@/lib/types"
import { tr } from "@/lib/i18n"

/**
 * Clima del jardín según las obligaciones — misma lógica de fechas que
 * Obligaciones (getNextPaymentInfo + atrasos del backend), para que el árbol
 * y esa pantalla nunca se contradigan.
 */
export interface ObligacionClima {
  key: string
  tipo: "deuda" | "fijo"
  nombre: string
  monto: number
  etiqueta: string
  /** Para ordenar: días hasta el pago (negativo = días de atraso). */
  orden: number
}

const PROXIMAS_DIAS = 7

export function calcularClima(debts: Debt[], fixedExpenses: FixedExpense[]) {
  const vencidas: ObligacionClima[] = []
  const proximas: ObligacionClima[] = []

  const revisar = (
    key: string, tipo: "deuda" | "fijo", nombre: string, dias: string, pagado: boolean,
    quincenal: boolean, pendienteProximo: boolean | undefined, restante: number,
    atrasos: { periodo: string; falta: number }[] | undefined,
  ) => {
    for (const a of atrasos ?? []) {
      if (a.falta <= 0) continue
      vencidas.push({ key: `${key}-${a.periodo}`, tipo, nombre, monto: a.falta, etiqueta: tr("Cuota de {0} sin pagar", [formatPeriodo(a.periodo)]), orden: -999 })
    }
    const info = getNextPaymentInfo(dias, pagado, quincenal, pendienteProximo)
    if (info.status === "vencido" && restante > 0) {
      vencidas.push({ key, tipo, nombre, monto: restante, etiqueta: tr("{0} · era el {1}", [info.statusLabel, info.nextDate]), orden: info.daysUntil })
    } else if ((info.status === "proximo" || info.status === "pendiente") && info.daysUntil <= PROXIMAS_DIAS && restante > 0) {
      proximas.push({
        key, tipo, nombre, monto: restante,
        etiqueta: info.daysUntil === 0 ? tr("Vence hoy") : tr("Vence en {0} día{1} · {2}", [info.daysUntil, info.daysUntil === 1 ? "" : "s", info.nextDate]),
        orden: info.daysUntil,
      })
    }
  }

  for (const d of debts) {
    if (d.estado !== "activa") continue
    revisar(`d-${d.id}`, "deuda", d.nombre, d.diasPago, d.pagadoEstePeriodo, d.frecuenciaPago === "quincenal",
      d.pendienteProximoPeriodo, Math.max(0, d.cuotaPeriodo - (d.montoPagadoEstePeriodo ?? 0)), d.atrasos)
  }
  for (const f of fixedExpenses) {
    const porPeriodo = f.frecuencia === "quincenal" ? Math.round(f.monto / 2) : f.monto
    revisar(`f-${f.id}`, "fijo", f.nombre, f.fechaCorte, f.pagadoEstePeriodo, f.frecuencia === "quincenal",
      f.pendienteProximoPeriodo, Math.max(0, porPeriodo - (f.montoPagadoEstePeriodo ?? 0)), f.atrasos)
  }

  vencidas.sort((a, b) => a.orden - b.orden)
  proximas.sort((a, b) => a.orden - b.orden)
  return {
    vencidas,
    proximas,
    totalVencido: vencidas.reduce((s, v) => s + v.monto, 0),
  }
}
