/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Simulaciones de ahorro — las mismas cuentas para el simulador de Ahorro y
 * para las tarjetas que arma Kiri Coach en el chat
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Dos preguntas:
 *   1. "Si ahorro X cada quincena/mes durante N meses, ¿cuánto tendré?"
 *   2. "Quiero comprar algo de $P para tal fecha: ¿cuánto debo ahorrar?"
 *
 * El aporte va al ritmo de cobro del usuario (quincenal = 2 por mes). Si se
 * pone un rendimiento anual (E.A., como una cuenta de ahorro o un CDT), se
 * capitaliza en cada aporte con la tasa equivalente del periodo.
 */
import { tr, localeFecha } from "@/lib/i18n"

export type Frecuencia = "mensual" | "quincenal"

export const periodosPorMes = (f: Frecuencia) => f === "quincenal" ? 2 : 1

/** Tasa del periodo equivalente a una tasa efectiva anual (%). */
export function tasaPeriodo(tasaAnual: number, f: Frecuencia): number {
  if (!(tasaAnual > 0)) return 0
  return Math.pow(1 + tasaAnual / 100, 1 / (12 * periodosPorMes(f))) - 1
}

/** Fecha de hoy + n meses (mismo día, o el último del mes si no existe). */
export function sumarMeses(n: number, desde = new Date()): Date {
  const d = new Date(desde.getFullYear(), desde.getMonth() + n, 1)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(desde.getDate(), ultimo))
  return d
}

export const fechaISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const fechaLegible = (d: Date) => d.toLocaleDateString(localeFecha(), { day: "numeric", month: "long", year: "numeric" })
export const mesLegible = (d: Date) => d.toLocaleDateString(localeFecha(), { month: "short", year: "2-digit" })

/** Aportes que caben entre hoy y la fecha (quincenal ≈ cada 15 días). 0 si ya pasó. */
export function periodosHasta(fecha: Date, f: Frecuencia, hoy = new Date()): number {
  const dias = (fecha.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86_400_000
  if (dias < 1) return 0
  return Math.max(1, Math.floor(dias / (f === "quincenal" ? 365.25 / 24 : 365.25 / 12)))
}

export interface PuntoSerie { etiqueta: string; total: number; aportado: number }

export interface ProyeccionAhorro {
  final: number
  /** Lo que ya tenía + todos los aportes */
  aportado: number
  rendimiento: number
  periodos: number
  fechaFin: Date
  serie: PuntoSerie[]
}

/** Pregunta 1: aportando `aporte` cada periodo durante `meses`, ¿cuánto se junta? */
export function proyectarAhorro(p: { inicial: number; aporte: number; meses: number; tasaAnual: number; frecuencia: Frecuencia; periodos?: number }): ProyeccionAhorro {
  const porMes = periodosPorMes(p.frecuencia)
  const r = tasaPeriodo(p.tasaAnual, p.frecuencia)
  const periodos = Math.max(0, p.periodos ?? Math.round(p.meses * porMes))
  let total = Math.max(0, p.inicial)
  let aportado = total
  // Un punto por mes (máx. ~24 barras: se agrupan los meses si es muy largo)
  const paso = Math.max(1, Math.ceil(periodos / porMes / 24))
  const serie: PuntoSerie[] = [{ etiqueta: tr("Hoy"), total: Math.round(total), aportado: Math.round(aportado) }]
  for (let i = 1; i <= periodos; i++) {
    total = total * (1 + r) + p.aporte
    aportado += p.aporte
    const mes = i / porMes
    if ((Number.isInteger(mes) && mes % paso === 0) || i === periodos) {
      serie.push({ etiqueta: mesLegible(sumarMeses(Math.ceil(mes))), total: Math.round(total), aportado: Math.round(aportado) })
    }
  }
  const final = Math.round(total)
  return { final, aportado: Math.round(aportado), rendimiento: Math.max(0, final - Math.round(aportado)), periodos, fechaFin: sumarMeses(Math.ceil(periodos / porMes)), serie }
}

export interface PlanMeta {
  /** Aporte por periodo para llegar a la meta en la fecha */
  aporte: number
  aporteMes: number
  periodos: number
  /** Ya lo tiene (lo ahorrado alcanza) */
  alcanzada: boolean
  /** La fecha ya pasó o es hoy */
  fechaInvalida: boolean
  faltante: number
}

/** Pregunta 2: ¿cuánto hay que ahorrar cada periodo para juntar `meta` en `fecha`? */
export function planParaMeta(p: { meta: number; inicial: number; fecha: Date; tasaAnual: number; frecuencia: Frecuencia }): PlanMeta {
  const periodos = periodosHasta(p.fecha, p.frecuencia)
  const faltante = Math.max(0, p.meta - Math.max(0, p.inicial))
  const base = { periodos, faltante, alcanzada: faltante <= 0, fechaInvalida: periodos <= 0 }
  if (base.alcanzada || base.fechaInvalida) return { ...base, aporte: 0, aporteMes: 0 }
  const r = tasaPeriodo(p.tasaAnual, p.frecuencia)
  const crece = Math.pow(1 + r, periodos)
  const falta = p.meta - Math.max(0, p.inicial) * crece
  const aporte = falta <= 0 ? 0 : Math.ceil(r > 0 ? falta * r / (crece - 1) : falta / periodos)
  return { ...base, alcanzada: falta <= 0, aporte, aporteMes: aporte * periodosPorMes(p.frecuencia) }
}

/** Con `aporte` por periodo, ¿cuándo se llega a la meta? (null si nunca o > 50 años) */
export function fechaParaMeta(p: { meta: number; inicial: number; aporte: number; tasaAnual: number; frecuencia: Frecuencia }): Date | null {
  if (p.inicial >= p.meta) return new Date()
  if (!(p.aporte > 0)) return null
  const r = tasaPeriodo(p.tasaAnual, p.frecuencia)
  let total = Math.max(0, p.inicial)
  const porMes = periodosPorMes(p.frecuencia)
  for (let i = 1; i <= 600 * porMes; i++) {
    total = total * (1 + r) + p.aporte
    if (total >= p.meta) return sumarMeses(Math.ceil(i / porMes))
  }
  return null
}

/** Qué tan bien le queda un aporte frente a lo que Kiri le sugiere ahorrar. */
export type Viabilidad = "holgado" | "justo" | "libre" | "no_alcanza"
export function viabilidad(aporte: number, ahorroSugerido: number, gastoLibre: number): Viabilidad {
  if (aporte <= ahorroSugerido * 0.8) return "holgado"
  if (aporte <= ahorroSugerido) return "justo"
  if (aporte <= ahorroSugerido + gastoLibre) return "libre"
  return "no_alcanza"
}

/** Serie para la meta: cómo crece lo ahorrado mes a mes hasta la fecha. */
export function serieMeta(p: { meta: number; inicial: number; aporte: number; periodos: number; tasaAnual: number; frecuencia: Frecuencia }): PuntoSerie[] {
  return proyectarAhorro({ ...p, meses: 0 }).serie
}
