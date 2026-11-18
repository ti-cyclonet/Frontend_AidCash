/**
 * "Este periodo" en Obligaciones: qué gastos fijos y deudas toca pagar en el
 * periodo actual (quincena o mes), cuánto falta y en qué orden mostrarlos
 * (primero lo que vence antes).
 */
import { getDisplayAmount } from "@/lib/distribucion-billetera"
import { isGenuinelyOverdue } from "@/lib/period-filter"
import { pendienteEnPeriodo, type ObligacionParaPeriodo } from "@/lib/obligaciones-pendientes"

interface ItemObligacion {
  pagadoEstePeriodo: boolean
  pendienteProximoPeriodo?: boolean
  montoPagadoEstePeriodo?: number | null
  montoAtrasado?: number
  diasPago?: string
  fechaCorte?: string
  frecuenciaPago?: string
  frecuencia?: string
  cuotaPeriodo?: number
  monto?: number
}

function diasDelItem(item: ItemObligacion): number[] {
  const raw = item.diasPago ?? (item.fechaCorte ? String(item.fechaCorte).split("-").pop() : "") ?? ""
  return raw.split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 1 && d <= 31)
}

function fechaDelDia(year: number, month: number, day: number): Date {
  const ultimo = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, ultimo))
}

const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * Días hasta su próximo vencimiento (0 = hoy, negativo = vencida). Sin día de
 * pago → Infinity (al final).
 */
export function diasParaVencer(item: ItemObligacion, now: Date = new Date()): number {
  const dias = diasDelItem(item)
  if (dias.length === 0) return Number.POSITIVE_INFINITY
  const hoy = inicioDelDia(now)
  if (!item.pagadoEstePeriodo && isGenuinelyOverdue(item, now)) {
    const ultimo = fechaDelDia(now.getFullYear(), now.getMonth(), Math.max(...dias))
    return Math.round((ultimo.getTime() - hoy.getTime()) / 86_400_000)
  }
  const candidatos = [0, 1].flatMap(m => dias.map(d => fechaDelDia(now.getFullYear(), now.getMonth() + m, d)))
    .filter(f => f >= hoy)
  const proxima = candidatos.sort((a, b) => a.getTime() - b.getTime())[0]
  return proxima ? Math.round((proxima.getTime() - hoy.getTime()) / 86_400_000) : Number.POSITIVE_INFINITY
}

/**
 * ¿Le toca pagarse en el periodo [start, end)? Si alguna de sus fechas de pago
 * cae en el rango (aunque sea del mes siguiente), si está vencida o tiene
 * atrasos. Misma regla que Billetera (lib/obligaciones-pendientes.ts).
 */
export function esDelPeriodo(item: ObligacionParaPeriodo, rango: { start: Date; end: Date }, now: Date = new Date()): boolean {
  return pendienteEnPeriodo(item, rango, now).enPeriodo
}

/**
 * Cuánto falta por pagar de esta obligación en el periodo: cada cuota que
 * vence en el rango buscada en SU periodo de pago (la del mes siguiente no se
 * da por pagada porque se pagó la de este mes), más lo vencido y los atrasos.
 */
export function pendienteDelPeriodo(item: ObligacionParaPeriodo, rango: { start: Date; end: Date }, now: Date = new Date()): number {
  return pendienteEnPeriodo(item, rango, now).monto
}

/** Lo que ya se pagó de esta obligación en el periodo. */
export function pagadoDelPeriodo(item: ItemObligacion): number {
  if (item.montoPagadoEstePeriodo != null) return item.montoPagadoEstePeriodo
  return item.pagadoEstePeriodo ? getDisplayAmount(item) : 0
}

/**
 * Orden de la lista: pendientes primero; entre ellas, las del periodo (las
 * amarillas) y luego por cuál vence antes; las pagadas al final.
 */
export function ordenarObligaciones<T extends ItemObligacion & { id: string }>(items: T[], prioridad: Set<string>, now: Date = new Date()): T[] {
  return [...items].sort((a, b) => {
    if (a.pagadoEstePeriodo !== b.pagadoEstePeriodo) return a.pagadoEstePeriodo ? 1 : -1
    const pa = prioridad.has(a.id), pb = prioridad.has(b.id)
    if (pa !== pb) return pa ? -1 : 1
    const da = diasParaVencer(a, now), db = diasParaVencer(b, now)
    return da === db ? 0 : da - db
  })
}
