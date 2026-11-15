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

/** Ahorro sugerido del periodo sobre un saldo: 5/10/15/20 % según lo que deje libre de obligaciones. */
function ahorroSugerido(saldo: number, obligaciones: number): number {
  if (saldo <= 0 || obligaciones >= saldo) return 0
  const remanentePct = ((saldo - obligaciones) / saldo) * 100
  const pct = remanentePct >= 40 ? 20 : remanentePct >= 25 ? 15 : remanentePct >= 15 ? 10 : 5
  return Math.min((pct / 100) * saldo, saldo - obligaciones)
}

/**
 * `yaAhorrado` = lo ahorrado en el periodo de cobro (GET /users/wallet →
 * ahorradoPeriodo). La meta de ahorro se calcula sobre el saldo de ANTES de
 * ahorrar y se descuenta lo ya hecho: si no, al ahorrar lo sugerido el saldo
 * baja y se volvía a pedir un % del saldo nuevo. Con la meta cumplida el
 * bolsillo de ahorro queda en 0 y todo lo demás va a gasto libre. Misma regla
 * que el plan semanal (Backend lib/plan-semanal.ts → disponibleParaGastar).
 */
export function calcularDistribucionReal(realIncome: number, realObligations: number, yaAhorrado = 0): DistribucionReal {
  // Sin saldo real → todo en 0, solo obligaciones muestra lo pendiente
  if (realIncome <= 0) return { obligationsPct: 0, savingsPct: 0, freePct: 0, debtCapPct: 0, obligationsAmount: realObligations, savingsAmount: 0, freeAmount: 0, debtCapAmount: 0, isOverloaded: realObligations > 0, isTight: false }

  const obligPct = Math.min(100, (realObligations / realIncome) * 100)
  const isOverloaded = realObligations >= realIncome
  const isTight = obligPct >= 70
  const remanente = Math.max(0, realIncome - realObligations)

  if (isOverloaded) {
    return { obligationsPct: obligPct, savingsPct: 0, freePct: 0, debtCapPct: 0, obligationsAmount: realObligations, savingsAmount: 0, freeAmount: 0, debtCapAmount: 0, isOverloaded: true, isTight: true }
  }

  // Lo que FALTA ahorrar del periodo
  const ahorrado = Math.max(0, yaAhorrado)
  const metaAhorro = ahorroSugerido(realIncome + ahorrado, realObligations)
  const savingsAmount = Math.min(Math.max(0, metaAhorro - ahorrado), remanente)
  const savingsPct = (savingsAmount / realIncome) * 100

  const afterSavings = remanente - savingsAmount
  const maxFree = (15 / 100) * realIncome
  const freeAmount = Math.min(afterSavings, maxFree)
  const freePct = (freeAmount / realIncome) * 100
  const debtCapAmount = afterSavings - freeAmount
  const debtCapPct = (debtCapAmount / realIncome) * 100

  return { obligationsPct: obligPct, savingsPct, freePct, debtCapPct, obligationsAmount: realObligations, savingsAmount, freeAmount, debtCapAmount, isOverloaded, isTight }
}
