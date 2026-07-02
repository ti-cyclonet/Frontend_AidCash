"use client"

import { useMemo } from "react"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { getPeriodData, PeriodInfo } from "@/lib/period-filter"
import { BudgetAllocation } from "@/lib/types"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * usePeriodBudget — La conexión entre "El Reloj" y "El Cerebro"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Hook centralizado que:
 *   1. Obtiene el periodo actual según la frecuencia del usuario
 *   2. Filtra obligaciones pendientes del periodo (via PeriodManager)
 *   3. Calcula la distribución presupuestal dinámica (via calculateBudgetAllocation)
 *
 * REACTIVIDAD EN TIEMPO REAL:
 *   Cuando el usuario marca una obligación como pagada:
 *     → `debts` o `fixedExpenses` cambian en useFinanceData (estado local)
 *     → `periodData.totalObligations` se recalcula (useMemo)
 *     → `allocation` se recalcula con el nuevo monto pendiente
 *     → El % de Obligaciones BAJA automáticamente en el gráfico
 *     → Ahorro y Gasto Libre SUBEN proporcionalmente
 *
 * EJEMPLO DE FLUJO:
 *   Inicio de quincena:
 *     ingreso = $500, obligaciones pendientes = $250 → Obligaciones 50%
 *   Usuario paga una deuda de $100:
 *     ingreso = $500, obligaciones pendientes = $150 → Obligaciones 30%
 *   El gráfico se actualiza SIN recargar la página.
 *
 * USO:
 *   const { allocation, periodData } = usePeriodBudget()
 *   // allocation.obligationsPct → porcentaje dinámico actual
 *   // periodData.effectiveIncome → ingreso del periodo
 *   // periodData.totalObligations → obligaciones pendientes del periodo
 */

export interface PeriodBudgetResult {
  /** Distribución presupuestal calculada dinámicamente, null si no hay ingreso */
  allocation: BudgetAllocation | null
  /** Datos del periodo: ingreso efectivo, obligaciones filtradas, quincena */
  periodData: PeriodInfo
  /** Ingreso efectivo del periodo (shortcut) */
  effectiveIncome: number
  /** Total de obligaciones pendientes del periodo (shortcut) */
  pendingObligations: number
  /** Frecuencia actual del usuario */
  frequency: 'mensual' | 'quincenal'
}

export function usePeriodBudget(): PeriodBudgetResult {
  const { income, incomeFrequency } = useAppContext()
  const { debts, fixedExpenses, extraIncomes } = useFinanceData()

  const totalExtraIncome = useMemo(
    () => extraIncomes.reduce((acc, e) => acc + e.monto, 0),
    [extraIncomes]
  )

  // ═══ PASO 1: PeriodManager filtra obligaciones del periodo actual ═══
  // Esto se recalcula cada vez que cambian debts, fixedExpenses, o la frecuencia.
  // Cuando markPaid() actualiza el estado local de una deuda (pagadoEstePeriodo = true),
  // filterPendingOnly la excluye → totalObligations baja → allocation se recalcula.
  const periodData = useMemo(
    () => getPeriodData(income, totalExtraIncome, debts, fixedExpenses, incomeFrequency),
    [income, totalExtraIncome, debts, fixedExpenses, incomeFrequency]
  )

  // ═══ PASO 2: "El Cerebro" calcula la distribución con datos dinámicos ═══
  // ingresoDelPeriodo = effectiveIncome (ya ajustado por frecuencia)
  // obligacionesPendientesDelPeriodo = solo las que NO están pagadas en el periodo
  const allocation = useMemo(
    () => periodData.effectiveIncome > 0
      ? calculateBudgetAllocation(periodData.effectiveIncome, periodData.totalObligations)
      : null,
    [periodData.effectiveIncome, periodData.totalObligations]
  )

  return {
    allocation,
    periodData,
    effectiveIncome: periodData.effectiveIncome,
    pendingObligations: periodData.totalObligations,
    frequency: incomeFrequency,
  }
}
