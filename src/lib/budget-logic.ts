import { BudgetAllocation } from './types';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Distribución Inteligente Kiri — "El Cerebro"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Función PURA de cálculo presupuestal. Recibe los datos DINÁMICOS del periodo
 * actual y devuelve la distribución ("foto viva").
 *
 * IMPORTANTE: Los llamadores deben pasarle:
 *   - ingresoDelPeriodo: ingreso efectivo del periodo actual
 *     (quincenal = ingreso/2 + extras, mensual = ingreso total + extras)
 *   - obligacionesPendientesDelPeriodo: suma de cuotas/montos de obligaciones
 *     que AÚN NO se han pagado en el periodo (output de PeriodManager)
 *
 * Reglas del Embudo:
 *   1. Bloque Obligaciones = obligaciones pendientes (monto exacto)
 *      Porcentaje = (obligacionesPendientes / ingreso) * 100
 *      → A medida que el usuario paga, este % BAJA automáticamente.
 *
 *   2. Remanente = ingreso - obligaciones pendientes
 *      → Crece conforme se pagan obligaciones.
 *
 *   3. Remanente se distribuye con prioridad:
 *      a) Ahorro — escala según salud financiera del periodo
 *      b) Gasto Libre — tope 15% del ingreso del periodo
 *      c) Capacidad de Endeudamiento — el residual
 *
 * Estados:
 *   - Normal    : obligaciones < 60%
 *   - Ajustado  : 60% - 99%
 *   - Crítico   : >= 100% (isOverloaded)
 */
export function calculateBudgetAllocation(
  ingresoDelPeriodo: number,
  obligacionesPendientesDelPeriodo: number
): BudgetAllocation {

  if (ingresoDelPeriodo <= 0) {
    return zeroAllocation(ingresoDelPeriodo)
  }

  // ── Bloque 1: Obligaciones — porcentaje DINÁMICO ──────────────────────────
  // Baja automáticamente cada vez que el usuario paga una obligación.
  const obligationsPct = (obligacionesPendientesDelPeriodo / ingresoDelPeriodo) * 100
  const remanente = Math.max(0, ingresoDelPeriodo - obligacionesPendientesDelPeriodo)
  const isOverloaded = obligacionesPendientesDelPeriodo >= ingresoDelPeriodo
  const isTight = obligationsPct >= 70

  // ── Estado Crítico: no hay remanente para distribuir ───────────────────────
  if (isOverloaded) {
    return {
      obligationsAmount: obligacionesPendientesDelPeriodo,
      obligationsPct,
      savingsAmount: 0,
      savingsPct: 0,
      freeInvestmentAmount: 0,
      freeInvestmentPct: 0,
      dailyFreeAmount: 0,
      dailyFreePct: 0,
      debtCapacityAmount: 0,
      debtCapacityPct: 0,
      totalIncome: ingresoDelPeriodo,
      isOverloaded: true,
      isTight: true,
    }
  }

  // ── Bloque 2: Ahorro — escala según salud financiera ──────────────────────
  // Cuanto más remanente hay (porque se pagaron obligaciones), más ahorro.
  const remanentePct = (remanente / ingresoDelPeriodo) * 100

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
  const targetSavingsAmount = (targetSavingsPct / 100) * ingresoDelPeriodo
  const savingsAmount = Math.min(targetSavingsAmount, remanente)
  const savingsPct = (savingsAmount / ingresoDelPeriodo) * 100

  // ── Bloque 3: Libre Inversión (tras obligaciones + ahorro) ────────────────
  const afterSavings = remanente - savingsAmount
  const freeInvestmentAmount = afterSavings
  const freeInvestmentPct = (freeInvestmentAmount / ingresoDelPeriodo) * 100

  // ── Bloque 3a: Gasto Libre (blindado) ─────────────────────────────────────
  // Tope: 15% del ingreso del periodo.
  const maxDailyFreeAmount = (15 / 100) * ingresoDelPeriodo
  let dailyFreeAmount: number
  let debtCapacityAmount: number

  if (afterSavings <= maxDailyFreeAmount) {
    dailyFreeAmount = afterSavings
    debtCapacityAmount = 0
  } else {
    dailyFreeAmount = maxDailyFreeAmount
    debtCapacityAmount = afterSavings - maxDailyFreeAmount
  }

  const dailyFreePct = (dailyFreeAmount / ingresoDelPeriodo) * 100
  const debtCapacityPct = (debtCapacityAmount / ingresoDelPeriodo) * 100

  return {
    obligationsAmount: obligacionesPendientesDelPeriodo,
    obligationsPct,
    savingsAmount,
    savingsPct,
    freeInvestmentAmount,
    freeInvestmentPct,
    dailyFreeAmount,
    dailyFreePct,
    debtCapacityAmount,
    debtCapacityPct,
    totalIncome: ingresoDelPeriodo,
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
