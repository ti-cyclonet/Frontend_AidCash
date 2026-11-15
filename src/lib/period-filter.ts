import { Debt, FixedExpense, IncomeFrequency } from './types'
import { pendienteEnPeriodo, prestamoEnPeriodo, type PrestamoParaPeriodo } from './obligaciones-pendientes'
import { localeFecha, tr } from "@/lib/i18n"

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
  /** Suma monetaria de todas las obligaciones pendientes del periodo (incluye préstamos de Social que vencen) */
  totalObligations: number
  /** Lo que falta pagar de cada deuda / gasto fijo en el periodo (por id) */
  pendientePorId: Record<string, number>
  /** Préstamos de Social que vencen en el periodo y lo que falta de ellos */
  prestamosDelPeriodo: { prestamo: PrestamoParaPeriodo; monto: number }[]
  totalPrestamos: number
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
  const startMonth = start.toLocaleString(localeFecha(), { month: 'long' })
  const endMonth = lastInclusive.toLocaleString(localeFecha(), { month: 'long' })
  if (startMonth === endMonth) return tr("{0} - {1} de {2}", [start.getDate(), lastInclusive.getDate(), startMonth])
  return tr("{0} de {1} - {2} de {3}", [start.getDate(), startMonth, lastInclusive.getDate(), endMonth])
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
 * ¿Esta obligación mensual está genuinamente vencida ahora mismo? (unpaid +
 * su día ya pasó este mes). Las obligaciones quincenales nunca se marcan así
 * — se pagan cada quincena, no tienen "vencido" en este sentido. Útil para la
 * UI (ej. mostrar una etiqueta "Vencido" en vez de "Pendiente").
 */
export function isGenuinelyOverdue<T extends { diasPago?: string; fechaCorte?: string; pagadoEstePeriodo?: boolean; pendienteProximoPeriodo?: boolean; frecuenciaPago?: string; frecuencia?: string }>(
  item: T,
  now: Date = new Date()
): boolean {
  const itemFrequency = ('frecuenciaPago' in item ? item.frecuenciaPago : item.frecuencia) as string | undefined
  if (itemFrequency === 'quincenal') return false
  if (!('pagadoEstePeriodo' in item) || item.pagadoEstePeriodo !== false) return false
  if (item.pendienteProximoPeriodo) return false
  return isOverdueThisMonth(itemDays(item), now)
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
  diasCobro: string = '',
  /** Lo que entra en ESTA quincena si no es la mitad del mes (quincenas distintas) */
  ingresoPeriodo?: number,
  /** Préstamos de Social donde el usuario debe (activos) */
  prestamos: PrestamoParaPeriodo[] = [],
): PeriodInfo {
  // Todo lo que vence dentro del periodo (y lo vencido sin pagar) cuenta
  // COMPLETO, buscado por su fecha real — ver lib/obligaciones-pendientes.ts.
  // Antes las mensuales de un usuario quincenal se contaban por la mitad y lo
  // que vencía el mes siguiente (periodo 29 nov – 14 dic) no sumaba: la
  // Billetera mostraba menos obligaciones y más "disponible" del real.
  const now = new Date()
  const rango = getPeriodDateRange(frequency, diasCobro, now)
  const pendientePorId: Record<string, number> = {}
  const conPendiente = <T extends Debt | FixedExpense>(items: T[]) => items.filter(item => {
    const monto = pendienteEnPeriodo(item, rango, now).monto
    if (monto <= 0) return false
    pendientePorId[item.id] = monto
    return true
  })
  const periodDebts = conPendiente(debts.filter(d => d.estado !== 'saldada'))
  const periodFixed = conPendiente(fixedExpenses)
  const prestamosDelPeriodo = prestamos
    .map(prestamo => ({ prestamo, monto: prestamoEnPeriodo(prestamo, rango) }))
    .filter(p => p.monto > 0)
  const totalPrestamos = prestamosDelPeriodo.reduce((a, p) => a + p.monto, 0)
  const totalObligations = Object.values(pendientePorId).reduce((a, m) => a + m, 0) + totalPrestamos

  if (frequency === 'mensual') {
    return { effectiveIncome: income + extraIncome, periodDebts, periodFixed, totalObligations, pendientePorId, prestamosDelPeriodo, totalPrestamos, quincena: null }
  }
  return {
    effectiveIncome: Math.round((ingresoPeriodo ?? income / 2) + extraIncome),
    periodDebts,
    periodFixed,
    totalObligations,
    pendientePorId,
    prestamosDelPeriodo,
    totalPrestamos,
    quincena: getCurrentPeriodDateRange(diasCobro, now).quincena,
  }
}

/**
 * Los dos periodos quincenales que "pertenecen" a un mes, según los días de
 * cobro del usuario (misma frontera que getCurrentPeriodDateRange): Periodo 1
 * = [d1, d2) y Periodo 2 = [d2, d1 del mes siguiente). Sin días configurados:
 * 1–15 y 16–fin de mes. Rangos [start, end).
 */
export function getQuincenasDelMes(diasCobro: string, year: number, month: number): { periodo: 1 | 2; start: Date; end: Date }[] {
  const [d1, d2] = paydayBoundary(diasCobro) ?? [1, 16]
  return [
    { periodo: 1, start: new Date(year, month, d1), end: new Date(year, month, d2) },
    { periodo: 2, start: new Date(year, month, d2), end: new Date(year, month + 1, d1) },
  ]
}
