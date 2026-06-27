import { BudgetAllocation } from './types';

/**
 * Distribución inteligente Kiri
 *
 * Prioridad del embudo:
 *   1. Obligaciones (deudas + gastos fijos) — siempre primero, monto real
 *   2. Ahorro — mínimo 10%, ideal 20%, se reduce si hay presión
 *   3. Gasto Libre (blindado) — mínimo vital para el día a día, nunca cero
 *   4. Capacidad de Endeudamiento — el remanente real disponible
 *
 * Estados:
 *   - Normal   : obligaciones ≤ 60% del ingreso
 *   - Ajustado : obligaciones entre 60% y 85%
 *   - Crítico  : obligaciones > 85% (isOverloaded)
 */
export function calculateBudgetAllocation(
  totalIncome: number,
  totalObligations: number
): BudgetAllocation {

  if (totalIncome <= 0) {
    return zeroAllocation(totalIncome)
  }

  const obligationsPct = (totalObligations / totalIncome) * 100
  const isOverloaded = obligationsPct >= 100
  const isTight = obligationsPct >= 70

  if (isOverloaded) {
    // Ingreso no cubre obligaciones — estado crítico
    return {
      obligationsAmount: totalObligations,
      obligationsPct,
      savingsAmount: 0,
      savingsPct: 0,
      freeInvestmentAmount: 0,
      freeInvestmentPct: 0,
      dailyFreeAmount: 0,
      dailyFreePct: 0,
      debtCapacityAmount: 0,
      debtCapacityPct: 0,
      totalIncome,
      isOverloaded: true,
      isTight: true,
    }
  }

  const remaining = totalIncome - totalObligations
  const remainingPct = 100 - obligationsPct

  // ── Bloque 2: Ahorro ──────────────────────────────────────────────────────
  // Ideal 20%, mínimo 5% si hay presión, 0 solo en crítico
  let savingsPct: number
  if (remainingPct >= 40) {
    savingsPct = 20                          // holgado: ahorro completo
  } else if (remainingPct >= 25) {
    savingsPct = 15                          // ajustado: ahorro reducido
  } else if (remainingPct >= 15) {
    savingsPct = 10                          // presionado: ahorro mínimo
  } else {
    savingsPct = 5                           // crítico suave: ahorro simbólico
  }
  const savingsAmount = (savingsPct / 100) * totalIncome

  // ── Bloque 3: Libre Inversión ─────────────────────────────────────────────
  const freeInvestmentAmount = remaining - savingsAmount
  const freeInvestmentPct = (freeInvestmentAmount / totalIncome) * 100

  // ── Bloque 3a: Gasto Libre (blindado) ────────────────────────────────────
  // Mínimo vital: 15% del ingreso total, nunca menos de eso
  // Si el remanente libre no alcanza el 15%, todo va a gasto libre (debtCapacity = 0)
  const minDailyFreePct = 15
  const minDailyFreeAmount = (minDailyFreePct / 100) * totalIncome

  let dailyFreeAmount: number
  let debtCapacityAmount: number

  if (freeInvestmentAmount <= minDailyFreeAmount) {
    // Todo el remanente es gasto libre, no hay capacidad de endeudamiento
    dailyFreeAmount = freeInvestmentAmount
    debtCapacityAmount = 0
  } else {
    dailyFreeAmount = minDailyFreeAmount
    debtCapacityAmount = freeInvestmentAmount - minDailyFreeAmount
  }

  const dailyFreePct = (dailyFreeAmount / totalIncome) * 100
  const debtCapacityPct = (debtCapacityAmount / totalIncome) * 100

  return {
    obligationsAmount: totalObligations,
    obligationsPct,
    savingsAmount,
    savingsPct,
    freeInvestmentAmount,
    freeInvestmentPct,
    dailyFreeAmount,
    dailyFreePct,
    debtCapacityAmount,
    debtCapacityPct,
    totalIncome,
    isOverloaded: false,
    isTight,
  }
}

function zeroAllocation(totalIncome: number): BudgetAllocation {
  return {
    obligationsAmount: 0, obligationsPct: 0,
    savingsAmount: 0, savingsPct: 0,
    freeInvestmentAmount: 0, freeInvestmentPct: 0,
    dailyFreeAmount: 0, dailyFreePct: 0,
    debtCapacityAmount: 0, debtCapacityPct: 0,
    totalIncome,
    isOverloaded: false,
    isTight: false,
  }
}
