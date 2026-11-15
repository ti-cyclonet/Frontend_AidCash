/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Cuánto toca pagar en un periodo — por FECHA REAL de cada cuota
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Fuente única para Billetera ("Balance obligaciones" y la distribución),
 * Obligaciones ("Este periodo") y el gasto libre. Antes había dos cálculos:
 *   - Billetera solo buscaba la próxima fecha DENTRO DEL MES en curso: en un
 *     periodo que cruza de mes (29 nov – 14 dic) lo que vence el 1 o el 5 de
 *     diciembre no sumaba, y las mensuales se contaban por la mitad.
 *   - Obligaciones sí veía esas fechas, pero miraba si estaba pagado el mes
 *     actual: con noviembre pagado, la cuota de diciembre salía "pagada".
 *
 * Ahora cada fecha de pago que cae en el periodo se busca en SU periodo de
 * pago (el mismo texto con que el backend etiqueta los pagos: "2026-11",
 * "2026-11-Q2"): si es el periodo actual, cuenta lo que falta de esa cuota; si
 * es el siguiente, lo que falta después del adelanto. Además suma lo vencido
 * sin pagar y los atrasos de periodos cerrados. La cuota va completa.
 */
import { getDisplayAmount } from "@/lib/distribucion-billetera"

export interface ObligacionParaPeriodo {
  pagadoEstePeriodo: boolean
  pendienteProximoPeriodo?: boolean
  montoPagadoEstePeriodo?: number | null
  montoAtrasado?: number
  diasPago?: string
  fechaCorte?: string
  frecuenciaPago?: string
  frecuencia?: string
  cuotaPeriodo?: number
  cuotaBase?: number
  monto?: number
  periodoActual?: string
  periodoSiguiente?: string
  montoAdelantado?: number | null
  proximaCuotaCubierta?: boolean
  activoDesdePeriodo?: string | null
}

export interface PendienteEnPeriodo {
  /** Lo que falta pagar en el periodo (cuotas del periodo + vencidas + atrasos) */
  monto: number
  /** Tiene una cuota en el periodo (pagada o no), una vencida o atrasos: se lista en "Este periodo" */
  enPeriodo: boolean
  /** Hay algo vencido sin pagar */
  vencida: boolean
  /** Fecha de la cuota pendiente más próxima dentro del periodo */
  fecha: Date | null
}

type Rango = { start: Date; end: Date }

const pad = (n: number) => String(n).padStart(2, "0")
const ym = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

function fechaDelDia(year: number, month: number, day: number): Date {
  const ultimo = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, ultimo))
}

export function diasDeLaObligacion(item: Pick<ObligacionParaPeriodo, "diasPago" | "fechaCorte">): number[] {
  const raw = item.diasPago ?? (item.fechaCorte ? String(item.fechaCorte).split("-").pop() : "") ?? ""
  return [...new Set(raw.split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 1 && d <= 31))].sort((a, b) => a - b)
}

/** Periodo de pago de una fecha — misma regla que el backend (lib/period.ts getPeriodo / getPeriodoQuincenal). */
function etiqueta(frecuencia: string, dias: number[], fecha: Date): string {
  if (frecuencia !== "quincenal") return ym(fecha)
  const day = fecha.getDate()
  if (dias.length < 2) return `${ym(fecha)}-${day <= 15 ? "Q1" : "Q2"}`
  const [d1, d2] = dias
  if (day >= d1 && day < d2) return `${ym(fecha)}-Q1`
  if (day >= d2) return `${ym(fecha)}-Q2`
  return `${ym(new Date(fecha.getFullYear(), fecha.getMonth() - 1, 1))}-Q2`
}

export function pendienteEnPeriodo(item: ObligacionParaPeriodo, rango: Rango, now: Date = new Date()): PendienteEnPeriodo {
  const frecuencia = item.frecuenciaPago ?? item.frecuencia ?? "mensual"
  const dias = diasDeLaObligacion(item)
  const atrasos = Math.max(0, item.montoAtrasado ?? 0)
  const hoy = inicioDelDia(now)

  // Cuota del periodo actual (getDisplayAmount: cuota de la deuda o monto del fijo, /2 si es quincenal)
  const cuotaActual = getDisplayAmount(item)
  const pendActual = item.pendienteProximoPeriodo || item.pagadoEstePeriodo
    ? 0 : Math.max(0, cuotaActual - (item.montoPagadoEstePeriodo ?? 0))
  // Cuota del periodo siguiente (sin el ajuste "solo este periodo") menos lo adelantado
  const cuotaSiguiente = item.cuotaBase ?? cuotaActual
  const empiezaDespues = !!item.activoDesdePeriodo && !!item.periodoSiguiente && item.activoDesdePeriodo > item.periodoSiguiente
  const pendSiguiente = item.proximaCuotaCubierta || empiezaDespues
    ? 0 : Math.max(0, cuotaSiguiente - (item.montoAdelantado ?? 0))

  // Frecuencias raras (semanal, anual) o sin día: lo de siempre, conservador
  if ((frecuencia !== "mensual" && frecuencia !== "quincenal") || dias.length === 0) {
    const monto = pendActual + atrasos
    return { monto, enPeriodo: true, vencida: atrasos > 0, fecha: null }
  }

  const actual = item.periodoActual ?? etiqueta(frecuencia, dias, now)
  const ocurrencias = [-1, 0, 1, 2].flatMap(m => dias.map(d => fechaDelDia(now.getFullYear(), now.getMonth() + m, d)))
    .map(fecha => ({ fecha, periodo: etiqueta(frecuencia, dias, fecha) }))
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
  const dentro = (f: Date) => f >= rango.start && f < rango.end

  let monto = atrasos
  let enPeriodo = atrasos > 0
  let vencida = atrasos > 0
  let fecha: Date | null = null
  const anotar = (f: Date) => { if (!fecha || f < fecha) fecha = f }

  // Cuota del periodo actual: cuenta si vence antes de que termine el periodo
  // (dentro de él, o ya vencida sin pagar). Si vence después, es del siguiente periodo.
  // (una obligación que empieza el próximo periodo no tiene cuota en el actual)
  const fechaActual = item.pendienteProximoPeriodo ? undefined : ocurrencias.find(o => o.periodo === actual)?.fecha
  if (fechaActual) {
    if (dentro(fechaActual)) enPeriodo = true
    if (pendActual > 0 && fechaActual < rango.end) {
      monto += pendActual
      enPeriodo = true
      if (fechaActual < hoy) vencida = true
      anotar(fechaActual)
    }
  } else if (pendActual > 0) {
    // Sin fecha para su periodo actual (p. ej. quincenal con un solo día): conservador
    monto += pendActual
    enPeriodo = true
  }

  // Cuota del periodo siguiente si su fecha ya cae dentro de este periodo
  // (el periodo del usuario cruza de mes o de quincena)
  if (item.periodoSiguiente) {
    const fechaSig = ocurrencias.find(o => o.periodo === item.periodoSiguiente)?.fecha
    if (fechaSig && dentro(fechaSig)) {
      enPeriodo = true
      if (pendSiguiente > 0) { monto += pendSiguiente; anotar(fechaSig) }
    }
  }

  return { monto: Math.round(monto), enPeriodo, vencida, fecha }
}

// ─── Préstamos de Social donde el usuario debe ────────────────────────────────

export interface PrestamoParaPeriodo {
  remainingAmount: number | string
  fechaCompromiso?: string | null
  dueDate?: string | null
}

/** Fecha en que se paga el préstamo ("YYYY-MM-DD"), si la tiene. */
export function fechaDelPrestamo(p: PrestamoParaPeriodo): Date | null {
  const raw = p.fechaCompromiso ?? (p.dueDate && /^\d{4}-\d{2}-\d{2}/.test(p.dueDate) ? p.dueDate.slice(0, 10) : null)
  if (!raw) return null
  const [y, m, d] = raw.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Un préstamo de Social cuenta en las obligaciones del periodo solo si su
 * fecha de pago cae antes de que termine el periodo (dentro de él o ya
 * vencida). Uno que se paga en enero no aparece en noviembre ni en diciembre.
 * Sin fecha acordada no cuenta.
 */
export function prestamoEnPeriodo(p: PrestamoParaPeriodo, rango: Rango): number {
  const f = fechaDelPrestamo(p)
  if (!f || f >= rango.end) return 0
  return Math.max(0, Math.round(Number(p.remainingAmount) || 0))
}
