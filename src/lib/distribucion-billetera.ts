/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Distribución del saldo real en bolsillos (Ahorro / Obligaciones / Gasto libre)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Es el cálculo que muestran las tarjetas de Billetera: del saldo disponible
 * se apartan primero las obligaciones pendientes del periodo, luego un % de
 * ahorro según qué tan holgado quede, y el resto es gasto libre (libre +
 * capacidad de endeudamiento). Antes vivía solo dentro de BilleteraTab y otras
 * pantallas ("Me deben", Presupuesto) usaban los bolsillos guardados en la
 * base de datos — por eso el "gasto libre" salía con números distintos en
 * cada lado. Ahora todas usan esta misma función.
 */

/** Monto del periodo de una deuda (cuotaPeriodo) o gasto fijo (monto, /2 si es quincenal). */
export function getDisplayAmount(item: { frecuenciaPago?: string; frecuencia?: string; cuotaPeriodo?: number; monto?: number }): number {
  const freq = item.frecuenciaPago || item.frecuencia || "mensual"
  if (item.cuotaPeriodo != null) return item.cuotaPeriodo // deuda: ya es el monto por periodo
  const rawAmount = item.monto ?? 0
  if (freq === "quincenal") return Math.round(rawAmount / 2)
  return rawAmount
}

export interface DistribucionReal {
  obligationsPct: number
  savingsPct: number
  freePct: number
  debtCapPct: number
  obligationsAmount: number
  savingsAmount: number
  freeAmount: number
  debtCapAmount: number
  isOverloaded: boolean
  isTight: boolean
}

export function calcularDistribucionReal(realIncome: number, realObligations: number): DistribucionReal {
  // Sin saldo real → todo en 0, solo obligaciones muestra lo pendiente
  if (realIncome <= 0) return { obligationsPct: 0, savingsPct: 0, freePct: 0, debtCapPct: 0, obligationsAmount: realObligations, savingsAmount: 0, freeAmount: 0, debtCapAmount: 0, isOverloaded: realObligations > 0, isTight: false }

  const obligPct = Math.min(100, (realObligations / realIncome) * 100)
  const isOverloaded = realObligations >= realIncome
  const isTight = obligPct >= 70
  const remanente = Math.max(0, realIncome - realObligations)

  if (isOverloaded) {
    return { obligationsPct: obligPct, savingsPct: 0, freePct: 0, debtCapPct: 0, obligationsAmount: realObligations, savingsAmount: 0, freeAmount: 0, debtCapAmount: 0, isOverloaded: true, isTight: true }
  }

  // Escala de ahorro según salud
  const remanentePct = (remanente / realIncome) * 100
  const targetSavPct = remanentePct >= 40 ? 20 : remanentePct >= 25 ? 15 : remanentePct >= 15 ? 10 : 5
  const savingsAmount = Math.min((targetSavPct / 100) * realIncome, remanente)
  const savingsPct = (savingsAmount / realIncome) * 100

  const afterSavings = remanente - savingsAmount
  const maxFree = (15 / 100) * realIncome
  const freeAmount = Math.min(afterSavings, maxFree)
  const freePct = (freeAmount / realIncome) * 100
  const debtCapAmount = afterSavings - freeAmount
  const debtCapPct = (debtCapAmount / realIncome) * 100

  return { obligationsPct: obligPct, savingsPct, freePct, debtCapPct, obligationsAmount: realObligations, savingsAmount, freeAmount, debtCapAmount, isOverloaded, isTight }
}
