import { Debt, FixedExpense, IncomeFrequency } from './types'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PeriodManager Frontend — "El Reloj"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Lógica de periodos y filtrado de obligaciones para el frontend.
 * Espejo de la versión backend en Backend_AidCash/src/lib/period-filter.ts.
 *
 * Exporta funciones PURAS que determinan qué obligaciones están pendientes
 * en el periodo actual y calcula el ingreso efectivo del periodo.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Quincena = 1 | 2

export interface PeriodInfo {
  /** Ingreso efectivo del periodo (mensual = total, quincenal = total/2 + extras) */
  effectiveIncome: number
  /** Deudas pendientes que corresponden al periodo actual */
  periodDebts: Debt[]
  /** Gastos fijos pendientes que corresponden al periodo actual */
  periodFixed: FixedExpense[]
  /** Suma monetaria de todas las obligaciones pendientes del periodo */
  totalObligations: number
  /** Quincena actual (null si es mensual) */
  quincena: Quincena | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determina en qué quincena estamos.
 *   - Q1: días 1 al 15
 *   - Q2: días 16 al último día del mes
 */
export function getCurrentQuincena(): Quincena {
  const day = new Date().getDate()
  return day <= 15 ? 1 : 2
}

/**
 * Extrae el día del mes de un string de fecha (YYYY-MM-DD o solo el número).
 */
function getDayOfMonth(dateStr: string): number {
  if (!dateStr) return 1
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-')
    return parseInt(parts[parts.length - 1], 10) || 1
  }
  return parseInt(dateStr, 10) || 1
}

/**
 * Parsea los días de pago de una obligación.
 * Acepta "15", "5,20", "1, 15", etc.
 */
function parseDays(value: string | undefined | null): number[] {
  if (!value) return []
  return value.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 1 && d <= 31)
}

// ─── Filtros de periodo ───────────────────────────────────────────────────────

/**
 * Filtra obligaciones según la quincena actual.
 * 
 * Lógica de frecuencia de pago:
 *   - Si la obligación tiene frecuencia 'quincenal', se INCLUYE SIEMPRE
 *     (se paga cada quincena, no importa Q1 o Q2).
 *   - Si la obligación tiene frecuencia 'mensual' (o no especificada):
 *     - Q1: solo incluye items cuyo día de pago está entre 1 y 15
 *     - Q2: solo incluye items cuyo día de pago es >= 16
 *   - Items sin día definido: se incluyen siempre (conservador)
 *   - Items con pagadoEstePeriodo === false y día de un periodo anterior:
 *     se incluyen como VENCIDOS ACUMULADOS
 */
export function filterByCurrentQuincena<T extends { diasPago?: string; fechaCorte?: string; pagadoEstePeriodo?: boolean; frecuenciaPago?: string; frecuencia?: string }>(
  items: T[],
  quincena?: Quincena
): T[] {
  const q = quincena ?? getCurrentQuincena()
  return items.filter(item => {
    // ═══ REGLA: Obligaciones con frecuencia QUINCENAL siempre se incluyen ═══
    // Se pagan cada quincena, así que aparecen en Q1 y Q2.
    const itemFrequency = ('frecuenciaPago' in item ? item.frecuenciaPago : item.frecuencia) as string | undefined
    if (itemFrequency === 'quincenal') return true

    // Para frecuencia mensual (o no definida): filtrar por día de pago
    let days: number[] = []

    if ('diasPago' in item && item.diasPago) {
      days = parseDays(item.diasPago as string)
    } else if ('fechaCorte' in item && item.fechaCorte) {
      const day = getDayOfMonth(item.fechaCorte as string)
      days = [day]
    }

    // Sin día definido → incluir siempre
    if (days.length === 0) return true

    // Verificar si el día de pago pertenece a la quincena actual
    const belongsToQ = days.some(day => q === 1 ? (day >= 1 && day <= 15) : (day >= 16))

    if (belongsToQ) return true

    // ═══ VENCIDO ACUMULADO ═══
    // Solo aplica a obligaciones de un periodo ANTERIOR que ya pasó.
    // Si estamos en Q2 (día 16+) y la obligación es del día 1-15, era de Q1 (ya pasó) → vencida.
    // Si estamos en Q1 (día 1-15) y la obligación es del día 16+, es del FUTURO (Q2) → NO incluir.
    if ('pagadoEstePeriodo' in item && item.pagadoEstePeriodo === false) {
      const isFromPreviousPeriod = days.some(day => q === 2 ? (day >= 1 && day <= 15) : false)
      // Solo en Q2 se pueden acumular vencidos de Q1.
      // En Q1 NUNCA se acumulan del Q2 anterior porque eso sería del mes pasado
      // (y el backend ya lo manejó en la transición de periodo).
      if (isFromPreviousPeriod) return true
    }

    return false
  })
}

/**
 * Excluye obligaciones ya pagadas.
 */
export function filterPendingOnly<T extends { pagadoEstePeriodo: boolean }>(items: T[]): T[] {
  return items.filter(item => !item.pagadoEstePeriodo)
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Calcula los datos del periodo actual: ingreso efectivo y obligaciones pendientes.
 *
 * Esta es la función que alimenta a calculateBudgetAllocation() con datos DINÁMICOS.
 * Cada vez que una obligación se marca como pagada, totalObligations BAJA,
 * lo que provoca un recálculo de la distribución presupuestal en tiempo real.
 *
 * @param income - Ingreso base mensual del usuario
 * @param extraIncome - Suma de ingresos extra
 * @param debts - Todas las deudas activas del usuario
 * @param fixedExpenses - Todos los gastos fijos del usuario
 * @param frequency - Frecuencia del ingreso ('mensual' | 'quincenal')
 *
 * @returns PeriodInfo con ingreso efectivo y obligaciones filtradas
 *
 * @example
 * // Usuario quincenal, día 10 del mes:
 * // Solo verá obligaciones con vencimiento en días 1-15 + vencidas acumuladas
 * const period = getPeriodData(10000, 500, debts, fixed, 'quincenal')
 * // period.effectiveIncome = 5500 (10000/2 + 500)
 * // period.totalObligations = solo las pendientes de Q1 + vencidas
 *
 * // Luego se pasa a la distribución:
 * const allocation = calculateBudgetAllocation(period.effectiveIncome, period.totalObligations)
 */
export function getPeriodData(
  income: number,
  extraIncome: number,
  debts: Debt[],
  fixedExpenses: FixedExpense[],
  frequency: IncomeFrequency
): PeriodInfo {
  if (frequency === 'mensual') {
    // Mensual: todas las obligaciones PENDIENTES del mes completo
    const pendingDebts = filterPendingOnly(debts.filter(d => d.estado !== 'saldada'))
    const pendingFixed = filterPendingOnly(fixedExpenses)
    const totalObligations = pendingDebts.reduce((acc, d) => acc + d.cuotaPeriodo, 0) +
                             pendingFixed.reduce((acc, f) => acc + f.monto, 0)
    return {
      effectiveIncome: income + extraIncome,
      periodDebts: pendingDebts,
      periodFixed: pendingFixed,
      totalObligations,
      quincena: null,
    }
  }

  // Quincenal: filtrar por quincena actual + solo pendientes
  const quincena = getCurrentQuincena()
  const activeDebts = debts.filter(d => d.estado !== 'saldada')
  const periodDebts = filterPendingOnly(filterByCurrentQuincena(activeDebts, quincena))
  const periodFixed = filterPendingOnly(filterByCurrentQuincena(fixedExpenses, quincena))
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
