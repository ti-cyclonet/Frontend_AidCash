import { getCurrentQuincena } from "@/lib/period-filter"
import type { IncomeFrequency } from "@/lib/types"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Cómo recibe su plata cada usuario (espejo de Backend_AidCash/src/lib/ingresos.ts)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *   1. Sueldo fijo igual — mensual, o quincenal con las dos quincenas iguales.
 *   2. Sueldo fijo que cambia por quincena — ej. $1.000.000 la del día 15 y
 *      $750.000 la del 30 (quincena1 = la del primer día de pago del mes).
 *   3. Ingresos variables — sin sueldo fijo (independiente, ventas,
 *      comisiones). Puede dejar una estimación mensual o no; sin ella, Kiri
 *      planea con su promedio real de los últimos meses.
 *
 * `ingresoBase` siempre es MENSUAL.
 */

export type TipoIngreso = "fijo" | "variable"

export interface PerfilIngreso {
  tipo: TipoIngreso
  frecuencia: IncomeFrequency
  /** Lo guardado: sueldo del mes (fijo) o estimación mensual (variable, 0 = no sabe) */
  ingresoBase: number
  /** Solo quincenal con montos distintos (null = iguales) */
  quincena1: number | null
  quincena2: number | null
  /** Promedio mensual real registrado (solo variable) */
  promedio: number
  diasCobro: string
}

/** Ingreso MENSUAL con el que Kiri planea. */
export function ingresoMensual(p: PerfilIngreso): number {
  if (p.tipo === "variable") return p.ingresoBase > 0 ? p.ingresoBase : p.promedio
  if (p.frecuencia === "quincenal" && (p.quincena1 ?? 0) > 0 && (p.quincena2 ?? 0) > 0) return p.quincena1! + p.quincena2!
  return p.ingresoBase
}

/** Las dos quincenas son distintas (caso 2). */
export const quincenasDistintas = (p: PerfilIngreso) =>
  p.tipo === "fijo" && p.frecuencia === "quincenal" && (p.quincena1 ?? 0) > 0 && (p.quincena2 ?? 0) > 0 && p.quincena1 !== p.quincena2

/** Lo que recibe en la 1.ª o 2.ª quincena (o el mes, si es mensual o variable). */
export function ingresoDeQuincena(p: PerfilIngreso, quincena: 1 | 2): number {
  if (p.tipo === "variable" || p.frecuencia !== "quincenal") return ingresoMensual(p)
  if ((p.quincena1 ?? 0) > 0 && (p.quincena2 ?? 0) > 0) return quincena === 1 ? p.quincena1! : p.quincena2!
  return Math.round(p.ingresoBase / 2)
}

/** Lo que le entra en el periodo EN CURSO (quincena actual o mes). */
export function ingresoDelPeriodo(p: PerfilIngreso, now: Date = new Date()): number {
  if (p.tipo === "variable" || p.frecuencia !== "quincenal") return ingresoMensual(p)
  return ingresoDeQuincena(p, getCurrentQuincena(p.diasCobro, now))
}

/** Días de pago ordenados, para nombrar cada quincena ("la del 15", "la del 30"). */
export function diasDeQuincenas(diasCobro: string): [number, number] {
  const d = diasCobro.split(",").map(x => parseInt(x.trim(), 10)).filter(x => x >= 1 && x <= 31).sort((a, b) => a - b)
  return [d[0] ?? 15, d[1] ?? 30]
}
