import { Debt, FixedExpense, IncomeFrequency } from './types'

/**
 * Determina en qué quincena estamos actualmente.
 *   - Primera quincena: días 1-15
 *   - Segunda quincena: días 16-fin de mes
 */
export function getCurrentQuincena(): 1 | 2 {
  const day = new Date().getDate()
  return day <= 15 ? 1 : 2
}

/**
 * Extrae el día del mes de una fecha string (YYYY-MM-DD o DD)
 */
function getDayOfMonth(dateStr: string): number {
  if (!dateStr) return 1
  // Si es fecha completa YYYY-MM-DD
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-')
    return parseInt(parts[parts.length - 1], 10) || 1
  }
  return parseInt(dateStr, 10) || 1
}

/**
 * Filtra obligaciones según la quincena actual.
 * Una obligación pertenece a la quincena si su día de vencimiento/corte
 * cae dentro del rango:
 *   - Q1: días 1-15
 *   - Q2: días 16-31
 */
export function filterByCurrentQuincena<T extends { fechaVencimiento?: string; fechaCorte?: string }>(
  items: T[]
): T[] {
  const q = getCurrentQuincena()
  return items.filter(item => {
    const dateStr = (item as { fechaVencimiento?: string }).fechaVencimiento
      || (item as { fechaCorte?: string }).fechaCorte
      || ''
    const day = getDayOfMonth(dateStr)
    return q === 1 ? day <= 15 : day >= 16
  })
}

/**
 * Calcula el ingreso efectivo y las obligaciones del periodo según la frecuencia.
 *
 * - Mensual: ingreso completo + todas las obligaciones
 * - Quincenal: ingreso / 2 + solo las obligaciones de la quincena actual
 */
export function getPeriodData(
  income: number,
  extraIncome: number,
  debts: Debt[],
  fixedExpenses: FixedExpense[],
  frequency: IncomeFrequency
): {
  effectiveIncome: number
  periodDebts: Debt[]
  periodFixed: FixedExpense[]
  totalObligations: number
  quincena: 1 | 2 | null
} {
  if (frequency === 'mensual') {
    const totalObligations = debts.reduce((acc, d) => acc + d.cuotaPeriodo, 0) +
                             fixedExpenses.reduce((acc, f) => acc + f.monto, 0)
    return {
      effectiveIncome: income + extraIncome,
      periodDebts: debts,
      periodFixed: fixedExpenses,
      totalObligations,
      quincena: null,
    }
  }

  // Quincenal: dividir ingreso, filtrar obligaciones
  const quincena = getCurrentQuincena()
  const periodDebts = filterByCurrentQuincena(debts)
  const periodFixed = filterByCurrentQuincena(fixedExpenses)
  const totalObligations = periodDebts.reduce((acc, d) => acc + d.cuotaPeriodo, 0) +
                           periodFixed.reduce((acc, f) => acc + f.monto, 0)

  return {
    effectiveIncome: Math.round((income / 2) + extraIncome),
    periodDebts,
    periodFixed,
    totalObligations,
    quincena,
  }
}
