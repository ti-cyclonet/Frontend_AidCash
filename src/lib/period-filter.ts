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
 * Para deudas: usa diasPago (string con días separados por coma).
 * Para gastos fijos: usa fechaCorte.
 */
export function filterByCurrentQuincena<T extends { diasPago?: string; fechaCorte?: string }>(
  items: T[]
): T[] {
  const q = getCurrentQuincena()
  return items.filter(item => {
    let days: number[] = []

    if ('diasPago' in item && item.diasPago) {
      // Debt: diasPago es "15" o "15,30"
      days = (item.diasPago as string).split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d))
    } else if ('fechaCorte' in item && item.fechaCorte) {
      // FixedExpense: fechaCorte es una fecha
      const dateStr = item.fechaCorte as string
      const day = getDayOfMonth(dateStr)
      days = [day]
    }

    if (days.length === 0) return true // Si no hay día definido, incluir siempre

    // Si cualquiera de los días cae en la quincena actual, incluir
    return days.some(day => q === 1 ? day <= 15 : day >= 16)
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

  // Quincenal: dividir ingreso, filtrar obligaciones por quincena actual
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
