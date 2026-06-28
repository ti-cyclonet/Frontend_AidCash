"use client"

import { useMemo } from "react"
import { Debt, FixedExpense } from "@/lib/types"

export interface ObligationsMetrics {
  totalDeudasActivas: number
  pagoMensualComprometido: number
  totalGastosFijosMensuales: number
  totalDeudaViva: number
}

/**
 * Hook que calcula métricas derivadas de obligaciones.
 * - Total de deudas activas (cantidad)
 * - Pago mensual comprometido (suma cuotas + gastos fijos mensualizados)
 * - Total de gastos fijos mensuales
 * - Total de deuda viva (suma montoTotal)
 */
export function useObligationsMetrics(debts: Debt[], fixedExpenses: FixedExpense[]): ObligationsMetrics {
  return useMemo(() => {
    const activeDebts = debts.filter(d => d.estado === 'activa')
    const totalDeudasActivas = activeDebts.length
    const totalDeudaViva = activeDebts.reduce((a, d) => a + d.montoTotal, 0)

    const totalCuotas = activeDebts.reduce((a, d) => a + d.cuotaPeriodo, 0)

    // Mensualizar gastos fijos según su frecuencia
    const totalGastosFijosMensuales = fixedExpenses.reduce((a, f) => {
      switch (f.frecuencia) {
        case 'semanal': return a + (f.monto * 4)
        case 'quincenal': return a + (f.monto * 2)
        case 'anual': return a + (f.monto / 12)
        default: return a + f.monto // mensual
      }
    }, 0)

    const pagoMensualComprometido = totalCuotas + totalGastosFijosMensuales

    return { totalDeudasActivas, pagoMensualComprometido, totalGastosFijosMensuales, totalDeudaViva }
  }, [debts, fixedExpenses])
}

/**
 * Calcula cuotas restantes y fecha estimada de pago.
 */
export function calculateDebtProjection(montoTotal: number, cuotaPeriodo: number, tasaInteres?: number | null): {
  cuotasRestantes: number
  fechaEstimada: string
  mesesParaPagar: number
} {
  if (cuotaPeriodo <= 0 || montoTotal <= 0) {
    return { cuotasRestantes: 0, fechaEstimada: '', mesesParaPagar: 0 }
  }

  let meses: number

  if (tasaInteres && tasaInteres > 0) {
    // Fórmula de amortización: n = -ln(1 - (PV * r / PMT)) / ln(1 + r)
    const r = tasaInteres / 100 / 12 // tasa mensual
    const numerador = Math.log(1 - (montoTotal * r / cuotaPeriodo))
    if (numerador >= 0) {
      // La cuota no cubre ni los intereses
      meses = 999
    } else {
      meses = Math.ceil(-numerador / Math.log(1 + r))
    }
  } else {
    // Sin interés: simple división
    meses = Math.ceil(montoTotal / cuotaPeriodo)
  }

  const fecha = new Date()
  fecha.setMonth(fecha.getMonth() + meses)
  const fechaEstimada = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  return { cuotasRestantes: meses, fechaEstimada, mesesParaPagar: meses }
}
