import { BudgetAllocation } from './types';

/**
 * Distribución inteligente Kiri — "El Embudo"
 *
 * Lógica estricta de prioridad:
 *   1. Obligaciones (deudas + gastos fijos) — siempre primero, monto real
 *   2. Remanente = max(0, Ingreso - Obligaciones)
 *   3. Si Obligaciones >= Ingreso → isOverloaded = true, todo lo demás = 0
 *   4. Ahorro — se calcula sobre el REMANENTE disponible, nunca sobre ingreso total
 *   5. Gasto Libre — del remanente tras ahorro, con un tope del 15% del ingreso total
 *   6. Capacidad de Endeudamiento — lo que quede tras Ahorro y Gasto Libre
 *
 * Los porcentajes SIEMPRE se calculan respecto al ingreso total (para que sumen ~100%),
 * pero los MONTOS se derivan del remanente real disponible.
 *
 * Estados:
 *   - Normal    : obligaciones ≤ 60% del ingreso
 *   - Ajustado  : obligaciones entre 60% y 99%
 *   - Crítico   : obligaciones >= 100% (isOverloaded)
 */
export function calculateBudgetAllocation(
  totalIncome: number,
  totalObligations: number
): BudgetAllocation {

  if (totalIncome <= 0) {
    return zeroAllocation(totalIncome)
  }

  // ── Bloque 1: Obligaciones — siempre primero ──────────────────────────────
  const obligationsPct = (totalObligations / totalIncome) * 100
  const remanente = Math.max(0, totalIncome - totalObligations)
  const isOverloaded = totalObligations >= totalIncome
  const isTight = obligationsPct >= 70

  // ── Estado Crítico: no hay nada que distribuir ─────────────────────────────
  if (isOverloaded) {
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

  // ── Bloque 2: Ahorro — se calcula sobre el remanente real ─────────────────
  // El ahorro NUNCA puede exceder lo que realmente queda disponible.
  // Escala del ahorro basada en qué tan apretado está el presupuesto:
  //   - Remanente >= 40% del ingreso → ahorro ideal (20% del ingreso)
  //   - Remanente >= 25% → ahorro reducido (15% del ingreso)
  //   - Remanente >= 15% → ahorro mínimo (10% del ingreso)
  //   - Remanente < 15%  → ahorro simbólico (5% del ingreso)
  const remanentePct = (remanente / totalIncome) * 100

  let targetSavingsPct: number
  if (remanentePct >= 40) {
    targetSavingsPct = 20
  } else if (remanentePct >= 25) {
    targetSavingsPct = 15
  } else if (remanentePct >= 15) {
    targetSavingsPct = 10
  } else {
    targetSavingsPct = 5
  }

  // El ahorro NO puede superar el remanente real
  const targetSavingsAmount = (targetSavingsPct / 100) * totalIncome
  const savingsAmount = Math.min(targetSavingsAmount, remanente)
  const savingsPct = (savingsAmount / totalIncome) * 100

  // ── Bloque 3: Lo que queda tras ahorro ────────────────────────────────────
  const afterSavings = remanente - savingsAmount
  const freeInvestmentAmount = afterSavings
  const freeInvestmentPct = (freeInvestmentAmount / totalIncome) * 100

  // ── Bloque 3a: Gasto Libre (blindado) ─────────────────────────────────────
  // Tope: 15% del ingreso total, pero SOLO si hay suficiente remanente.
  // Si afterSavings es menor al tope, todo va a gasto libre (debtCapacity = 0).
  const maxDailyFreeAmount = (15 / 100) * totalIncome
  let dailyFreeAmount: number
  let debtCapacityAmount: number

  if (afterSavings <= maxDailyFreeAmount) {
    // No alcanza para cubrir el tope → todo a gasto libre, nada a endeudamiento
    dailyFreeAmount = afterSavings
    debtCapacityAmount = 0
  } else {
    dailyFreeAmount = maxDailyFreeAmount
    debtCapacityAmount = afterSavings - maxDailyFreeAmount
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
