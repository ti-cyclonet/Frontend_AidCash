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

/**
 * Frontera de quincena real del usuario — los 2 días de pago que configuró en
 * `PaydaySelector` (`diasCobro`, ej. "10,25"). `null` si no configuró (o solo
 * tiene 1 día, o es mensual): en ese caso todo lo de abajo cae al calendario
 * fijo día ≤15, el comportamiento de siempre.
 */
function paydayBoundary(diasCobro: string): [number, number] | null {
  const days = parseDays(diasCobro).sort((a, b) => a - b)
  return days.length >= 2 ? [days[0], days[1]] : null
}

function daysBetween(a: Date, b: Date): number {
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  return Math.round(ms / 86400000)
}

/**
 * Rango de fechas [start, end) del periodo quincenal ACTUAL, según los días de
 * pago reales del usuario. A diferencia de un calendario fijo 1-15/16-fin, esto
 * también resuelve correctamente los primeros días del mes cuando el primer
 * día de pago no es el 1 (ej. días 10 y 25: del 1 al 9 seguimos dentro del
 * periodo que arrancó el 25 del mes anterior, no en uno nuevo).
 */
export function getCurrentPeriodDateRange(diasCobro: string, now: Date = new Date()): { start: Date; end: Date; quincena: Quincena } {
  const [d1, d2] = paydayBoundary(diasCobro) ?? [1, 16]
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()

  if (day >= d1 && day < d2) {
    return { start: new Date(year, month, d1), end: new Date(year, month, d2), quincena: 1 }
  }
  if (day >= d2) {
    return { start: new Date(year, month, d2), end: new Date(year, month + 1, d1), quincena: 2 }
  }
  // day < d1: todavía dentro del periodo que arrancó el d2 del mes anterior.
  return { start: new Date(year, month - 1, d2), end: new Date(year, month, d1), quincena: 2 }
}

/**
 * Determina en qué quincena estamos, según los días de pago reales del
 * usuario (`diasCobro`). Sin días configurados, cae al calendario fijo día
 * ≤15 = Q1 (comportamiento de siempre).
 */
export function getCurrentQuincena(diasCobro: string = '', now: Date = new Date()): Quincena {
  return getCurrentPeriodDateRange(diasCobro, now).quincena
}

/** Rango de fechas [start, end) del periodo actual — mensual o quincenal. */
export function getPeriodDateRange(frequency: IncomeFrequency, diasCobro: string, now: Date = new Date()): { start: Date; end: Date } {
  if (frequency === 'mensual') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) }
  }
  const { start, end } = getCurrentPeriodDateRange(diasCobro, now)
  return { start, end }
}

/** Etiqueta legible del rango, ej. "10 - 24 de agosto" o "25 de julio - 9 de agosto". */
export function getPeriodRangeLabel(frequency: IncomeFrequency, diasCobro: string, now: Date = new Date()): string {
  const { start, end } = getPeriodDateRange(frequency, diasCobro, now)
  const lastInclusive = new Date(end.getTime() - 1)
  const startMonth = start.toLocaleString('es', { month: 'long' })
  const endMonth = lastInclusive.toLocaleString('es', { month: 'long' })
  if (startMonth === endMonth) return `${start.getDate()} - ${lastInclusive.getDate()} de ${startMonth}`
  return `${start.getDate()} de ${startMonth} - ${lastInclusive.getDate()} de ${endMonth}`
}

/** Etiqueta con prefijo "Mensual ·"/"Quincenal ·", para mostrar junto a la frecuencia. */
export function getPeriodLabel(frequency: IncomeFrequency, diasCobro: string = '', now: Date = new Date()): string {
  const prefix = frequency === 'mensual' ? 'Mensual' : 'Quincenal'
  return `${prefix} · ${getPeriodRangeLabel(frequency, diasCobro, now)}`
}

/** Etiqueta del PRÓXIMO periodo (el que empieza justo cuando termina el actual). */
export function getNextPeriodLabel(frequency: IncomeFrequency, diasCobro: string, now: Date = new Date()): string {
  if (frequency === 'mensual') return ''
  const { end } = getPeriodDateRange(frequency, diasCobro, now)
  return getPeriodRangeLabel(frequency, diasCobro, end)
}

/** Días transcurridos y días totales del periodo actual (para "% del periodo"). */
export function getDaysElapsedAndTotal(frequency: IncomeFrequency, diasCobro: string, now: Date = new Date()): { elapsed: number; total: number } {
  const { start, end } = getPeriodDateRange(frequency, diasCobro, now)
  const total = daysBetween(start, end)
  const elapsed = Math.min(daysBetween(start, now) + 1, total)
  return { elapsed, total }
}

// ─── Filtros de periodo ───────────────────────────────────────────────────────

/** Construye una fecha para el día N de un mes, recortando al último día real
 * si N no existe ese mes (ej. día 31 en septiembre, que solo tiene 30). */
function dateForDay(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDayOfMonth))
}

/**
 * Extrae los días de pago propios de un ítem (deuda o gasto fijo).
 */
function itemDays<T extends { diasPago?: string; fechaCorte?: string }>(item: T): number[] {
  if ('diasPago' in item && item.diasPago) return parseDays(item.diasPago as string)
  if ('fechaCorte' in item && item.fechaCorte) return [getDayOfMonth(item.fechaCorte as string)]
  return []
}

/**
 * ¿Ya pasaron TODOS los días de pago de este ítem dentro del MES ACTUAL? Si es
 * así y sigue sin pagar, está genuinamente vencido — esto es 100% verificable
 * sin mirar meses anteriores: para un ítem mensual, "pagadoEstePeriodo" ya
 * significa "¿lo pagué ESTE MES?", así que si su día ya pasó este mes y sigue
 * en false, no hay ambigüedad posible (a diferencia de asumir que "pertenece
 * a la quincena anterior" solo por el número de día, que no distingue un
 * ítem genuinamente vencido de uno que simplemente aún no llega a su fecha).
 */
function isOverdueThisMonth(days: number[], now: Date): boolean {
  return days.length > 0 && days.every(d => d < now.getDate())
}

/**
 * Filtra obligaciones que corresponden al periodo actual, por FECHA REAL.
 *
 * Lógica de frecuencia de pago:
 *   - Si la obligación tiene frecuencia 'quincenal', se INCLUYE SIEMPRE
 *     (se paga cada quincena, sin importar el rango de fechas).
 *   - Si la obligación tiene frecuencia 'mensual' (o no especificada): se
 *     incluye si su PRÓXIMA ocurrencia este mes cae dentro de `periodRange`,
 *     o si ya está genuinamente vencida (ver `isOverdueThisMonth`) — una
 *     vencida se muestra siempre, sin importar qué periodo se esté viendo.
 *   - Items sin día definido: se incluyen siempre (conservador).
 */
export function filterByCurrentQuincena<T extends { diasPago?: string; fechaCorte?: string; pagadoEstePeriodo?: boolean; frecuenciaPago?: string; frecuencia?: string }>(
  items: T[],
  periodRange: { start: Date; end: Date },
  now: Date = new Date()
): T[] {
  return items.filter(item => {
    // ═══ REGLA: Obligaciones con frecuencia QUINCENAL siempre se incluyen ═══
    const itemFrequency = ('frecuenciaPago' in item ? item.frecuenciaPago : item.frecuencia) as string | undefined
    if (itemFrequency === 'quincenal') return true

    const days = itemDays(item)
    if (days.length === 0) return true

    // ¿La próxima ocurrencia de este mes cae dentro del periodo que se está mostrando?
    const upcoming = days.filter(d => d >= now.getDate())
    if (upcoming.length > 0) {
      const nextDate = dateForDay(now.getFullYear(), now.getMonth(), Math.min(...upcoming))
      if (nextDate >= periodRange.start && nextDate < periodRange.end) return true
    }

    // Genuinamente vencida (todos sus días ya pasaron este mes) y sigue sin pagar
    if ('pagadoEstePeriodo' in item && item.pagadoEstePeriodo === false && isOverdueThisMonth(days, now)) {
      return true
    }

    return false
  })
}

/**
 * ¿Esta obligación mensual está genuinamente vencida ahora mismo? (unpaid +
 * su día ya pasó este mes). Las obligaciones quincenales nunca se marcan así
 * — se pagan cada quincena, no tienen "vencido" en este sentido. Útil para la
 * UI (ej. mostrar una etiqueta "Vencido" en vez de "Pendiente").
 */
export function isGenuinelyOverdue<T extends { diasPago?: string; fechaCorte?: string; pagadoEstePeriodo?: boolean; frecuenciaPago?: string; frecuencia?: string }>(
  item: T,
  now: Date = new Date()
): boolean {
  const itemFrequency = ('frecuenciaPago' in item ? item.frecuenciaPago : item.frecuencia) as string | undefined
  if (itemFrequency === 'quincenal') return false
  if (!('pagadoEstePeriodo' in item) || item.pagadoEstePeriodo !== false) return false
  return isOverdueThisMonth(itemDays(item), now)
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
 * @param diasCobro - Días de pago reales del usuario (ej. "10,25"), configurados
 *   en `PaydaySelector` — determina la frontera Q1/Q2. Vacío = calendario fijo día ≤15.
 *
 * @returns PeriodInfo con ingreso efectivo y obligaciones filtradas
 *
 * @example
 * // Usuario quincenal, días de pago 10 y 25, hoy es 12:
 * // Solo verá obligaciones con vencimiento en días 10-24 + vencidas acumuladas
 * const period = getPeriodData(10000, 500, debts, fixed, 'quincenal', '10,25')
 * // period.effectiveIncome = 5500 (10000/2 + 500)
 * // period.totalObligations = solo las pendientes del periodo 10-24 + vencidas
 *
 * // Luego se pasa a la distribución:
 * const allocation = calculateBudgetAllocation(period.effectiveIncome, period.totalObligations)
 */
export function getPeriodData(
  income: number,
  extraIncome: number,
  debts: Debt[],
  fixedExpenses: FixedExpense[],
  frequency: IncomeFrequency,
  diasCobro: string = ''
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

  // Quincenal: filtrar por el rango de fechas real del periodo actual + solo pendientes
  const now = new Date()
  const periodRange = getCurrentPeriodDateRange(diasCobro, now)
  const quincena = periodRange.quincena
  const activeDebts = debts.filter(d => d.estado !== 'saldada')
  const periodDebts = filterPendingOnly(filterByCurrentQuincena(activeDebts, periodRange, now))
  const periodFixed = filterPendingOnly(filterByCurrentQuincena(fixedExpenses, periodRange, now))

  // ═══ CÁLCULO DE OBLIGACIONES CON DIVISIÓN QUINCENAL + VENCIDAS ═══
  // - Deudas con frecuencia 'quincenal': cuota completa (se paga cada quincena)
  // - Deudas con frecuencia 'mensual', dentro de su ventana normal: cuota / 2
  //   (se divide entre las 2 quincenas para suavizar el flujo de caja)
  // - Deudas mensuales genuinamente vencidas (ver isOverdueThisMonth): cuota
  //   completa — ya se debe el mes entero, no tiene sentido seguir partiéndola
  const totalObligations = periodDebts.reduce((acc, d) => {
    const itemFreq = d.frecuenciaPago ?? 'mensual'
    const cuota = d.cuotaPeriodo
    if (itemFreq === 'quincenal') return acc + cuota

    const days = parseDays(d.diasPago)
    if (isOverdueThisMonth(days, now)) return acc + cuota
    return acc + Math.round(cuota / 2)
  }, 0) + periodFixed.reduce((acc, f) => {
    const itemFreq = f.frecuencia ?? 'mensual'
    // Quincenal: se paga la mitad en cada quincena (igual que las deudas) — antes
    // se sumaba el monto completo, contando doble entre Q1 y Q2.
    if (itemFreq === 'quincenal') return acc + Math.round(f.monto / 2)

    const days = parseDays(f.fechaCorte)
    if (isOverdueThisMonth(days, now)) return acc + f.monto
    return acc + Math.round(f.monto / 2)
  }, 0)

  return {
    effectiveIncome: Math.round((income / 2) + extraIncome),
    periodDebts,
    periodFixed,
    totalObligations,
    quincena,
  }
}
