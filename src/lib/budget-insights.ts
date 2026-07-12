import { ImpulseExpense } from './types'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Budget Insights Engine — "El Analizador de Presupuesto"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Analiza los gastos por categoría y genera:
 *   1. Alertas cuando se excede un presupuesto
 *   2. Celebraciones cuando se completa un periodo sin exceder
 *   3. Recomendaciones contextuales tipo "Consejo Kiri"
 *   4. Patrones de gasto detectados
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightType = 'alert' | 'celebration' | 'recommendation' | 'pattern'
export type InsightSeverity = 'info' | 'warning' | 'success' | 'critical'

export interface BudgetInsight {
  id: string
  type: InsightType
  severity: InsightSeverity
  category: string
  title: string
  message: string
  /** Monto sugerido de reducción o ahorro potencial */
  savingsAmount?: number
  /** Porcentaje de uso del presupuesto */
  usagePct?: number
}

export interface CategoryAnalysis {
  name: string
  budget: number
  spent: number
  pct: number
  isOver: boolean
  remaining: number
  /** Promedio diario de gasto */
  dailyAvg: number
  /** Días que quedan del periodo */
  daysLeft: number
  /** Gasto proyectado al final del periodo si continúa igual */
  projectedSpend: number
  /** Tendencia: creciendo, estable, bajando */
  trend: 'rising' | 'stable' | 'declining'
}

interface BudgetCategory {
  id: string
  name: string
  budget: number
  spent: number
  color: string
  icon: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SUGGESTIONS_KEYS: Record<string, string[]> = {
  "Alimentacion": ["comida", "mercado", "supermercado", "restaurante", "hamburguesa", "almuerzo", "cena", "cafeteria", "snack", "desayuno", "pizza", "pollo", "arroz"],
  "Transporte": ["gasolina", "uber", "taxi", "bus", "peaje", "parqueadero", "metro", "moto", "lavada", "mantenimiento"],
  "Ocio": ["netflix", "spotify", "cine", "juego", "bar", "fiesta", "salida", "discoteca", "cerveza", "trago"],
  "Compras": ["ropa", "zapatos", "accesorios", "electronica", "amazon", "tienda", "online"],
  "Viajes": ["vuelo", "hotel", "vacaciones", "paseo", "hospedaje"],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInPeriod(frequency: 'mensual' | 'quincenal'): number {
  return frequency === 'quincenal' ? 15 : 30
}

function getDaysElapsed(frequency: 'mensual' | 'quincenal'): number {
  const now = new Date()
  const dayOfMonth = now.getDate()

  if (frequency === 'quincenal') {
    return dayOfMonth <= 15 ? dayOfMonth : dayOfMonth - 15
  }
  return dayOfMonth
}

function getExpenseTrend(expenses: ImpulseExpense[], categoryKeys: string[]): 'rising' | 'stable' | 'declining' {
  if (expenses.length < 3) return 'stable'

  // Dividir en dos mitades temporales
  const sorted = [...expenses].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const mid = Math.floor(sorted.length / 2)
  const firstHalf = sorted.slice(0, mid)
  const secondHalf = sorted.slice(mid)

  const avgFirst = firstHalf.reduce((a, e) => a + e.monto, 0) / Math.max(firstHalf.length, 1)
  const avgSecond = secondHalf.reduce((a, e) => a + e.monto, 0) / Math.max(secondHalf.length, 1)

  const diff = ((avgSecond - avgFirst) / Math.max(avgFirst, 1)) * 100
  if (diff > 15) return 'rising'
  if (diff < -15) return 'declining'
  return 'stable'
}

// ─── Main Analysis ────────────────────────────────────────────────────────────

export function analyzeBudgetCategories(
  categories: BudgetCategory[],
  impulseExpenses: ImpulseExpense[],
  frequency: 'mensual' | 'quincenal',
  freeAmount: number,
): { insights: BudgetInsight[]; analyses: CategoryAnalysis[] } {
  const insights: BudgetInsight[] = []
  const analyses: CategoryAnalysis[] = []

  const daysInPeriod = getDaysInPeriod(frequency)
  const daysElapsed = getDaysElapsed(frequency)
  const daysLeft = Math.max(1, daysInPeriod - daysElapsed)

  for (const cat of categories) {
    // Match expenses to this category (same logic as PresupuestoTab)
    const catKeys = SUGGESTIONS_KEYS[cat.name] ?? []
    const allKeys = [...catKeys, cat.name.toLowerCase()]

    const matched = impulseExpenses.filter(e => {
      const expName = e.nombre.toLowerCase()
      return allKeys.some(k => expName.includes(k)) || expName.includes(cat.name.toLowerCase())
    })

    const spent = matched.reduce((a, e) => a + e.monto, 0)
    const pct = cat.budget > 0 ? Math.round((spent / cat.budget) * 100) : 0
    const isOver = spent > cat.budget
    const remaining = Math.max(0, cat.budget - spent)
    const dailyAvg = daysElapsed > 0 ? spent / daysElapsed : 0
    const projectedSpend = dailyAvg * daysInPeriod
    const trend = getExpenseTrend(matched, allKeys)

    analyses.push({
      name: cat.name,
      budget: cat.budget,
      spent,
      pct,
      isOver,
      remaining,
      dailyAvg,
      daysLeft,
      projectedSpend,
      trend,
    })

    // ═══ ALERTAS: Presupuesto excedido ═══
    if (isOver) {
      const excess = spent - cat.budget
      insights.push({
        id: `alert-over-${cat.id}`,
        type: 'alert',
        severity: 'critical',
        category: cat.name,
        title: `Excediste tu presupuesto de ${cat.name}`,
        message: `Llevas ${formatMoney(spent)} gastados de los ${formatMoney(cat.budget)} asignados. Te pasaste por ${formatMoney(excess)}.`,
        usagePct: pct,
      })
    }
    // Alerta preventiva: va a excederse si sigue así
    else if (!isOver && projectedSpend > cat.budget && pct >= 60) {
      const reduction = Math.round(dailyAvg * 0.3) // Sugerir reducir 30%
      const weekSavings = reduction * 7
      const monthSavings = reduction * daysLeft

      insights.push({
        id: `alert-projected-${cat.id}`,
        type: 'recommendation',
        severity: 'warning',
        category: cat.name,
        title: `Consejo Kiri`,
        message: `Si reduces ${cat.name.toLowerCase()} esta semana en ${formatMoney(weekSavings)}, podrías ahorrar ${formatMoney(monthSavings)} al final del ${frequency === 'quincenal' ? 'periodo' : 'mes'}.`,
        savingsAmount: monthSavings,
        usagePct: pct,
      })
    }
    // ═══ CELEBRACIÓN: Categoría bajo control ═══
    else if (pct <= 50 && daysElapsed >= Math.floor(daysInPeriod * 0.7) && cat.budget > 0) {
      insights.push({
        id: `celebration-${cat.id}`,
        type: 'celebration',
        severity: 'success',
        category: cat.name,
        title: `¡Excelente control en ${cat.name}!`,
        message: `Llevas ${Math.round((daysElapsed / daysInPeriod) * 100)}% del periodo y solo has usado ${pct}% de tu presupuesto. ¡Sigue así!`,
        usagePct: pct,
      })
    }
    // ═══ PATRÓN: Gasto en aumento ═══
    else if (trend === 'rising' && pct >= 70) {
      insights.push({
        id: `pattern-rising-${cat.id}`,
        type: 'pattern',
        severity: 'warning',
        category: cat.name,
        title: `Tu gasto en ${cat.name} está creciendo`,
        message: `Detectamos que tus gastos en ${cat.name.toLowerCase()} están aumentando. A este ritmo gastarás ${formatMoney(projectedSpend)} al final del periodo.`,
        usagePct: pct,
      })
    }
  }

  // ═══ INSIGHT GLOBAL: Categorías sin gasto ═══
  const zeroCats = analyses.filter(a => a.spent === 0 && a.budget > 0 && daysElapsed >= 5)
  if (zeroCats.length > 0 && daysElapsed >= Math.floor(daysInPeriod * 0.5)) {
    for (const zc of zeroCats) {
      insights.push({
        id: `celebration-zero-${zc.name}`,
        type: 'celebration',
        severity: 'success',
        category: zc.name,
        title: `¡${zc.name} sin gastos este periodo!`,
        message: `No has gastado nada en ${zc.name.toLowerCase()} este periodo. Ese dinero está disponible para ahorro o redistribuir.`,
        savingsAmount: zc.budget,
        usagePct: 0,
      })
    }
  }

  // ═══ RECOMENDACIÓN: Redistribución ═══
  const overCats = analyses.filter(a => a.isOver)
  const underCats = analyses.filter(a => a.pct < 40 && a.budget > 0 && a.remaining > 0)
  if (overCats.length > 0 && underCats.length > 0) {
    const totalExcess = overCats.reduce((a, c) => a + (c.spent - c.budget), 0)
    const totalUnused = underCats.reduce((a, c) => a + c.remaining, 0)
    if (totalUnused >= totalExcess * 0.5) {
      insights.push({
        id: 'reco-redistribute',
        type: 'recommendation',
        severity: 'info',
        category: 'General',
        title: 'Redistribuye tu presupuesto',
        message: `Tienes ${formatMoney(totalUnused)} sin usar en ${underCats.map(c => c.name).join(', ')} que podrían cubrir el exceso de ${overCats.map(c => c.name).join(', ')}.`,
        savingsAmount: Math.min(totalExcess, totalUnused),
      })
    }
  }

  // Ordenar: alertas primero, luego recomendaciones, luego celebraciones
  const priority: Record<InsightType, number> = { alert: 0, recommendation: 1, pattern: 2, celebration: 3 }
  insights.sort((a, b) => priority[a.type] - priority[b.type])

  return { insights, analyses }
}

// ─── Helpers locales ──────────────────────────────────────────────────────────

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')}`
}

// ─── Insight específico por categoría (siempre genera uno) ────────────────────

/**
 * Genera un insight contextual SIEMPRE para una categoría dada.
 * Si el motor de análisis ya generó uno, lo devuelve.
 * Si no, genera uno genérico basado en el estado actual.
 */
export function getCategoryInsight(
  categoryName: string,
  budget: number,
  spent: number,
  frequency: 'mensual' | 'quincenal',
): BudgetInsight {
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
  const daysInPeriod = getDaysInPeriod(frequency)
  const daysElapsed = getDaysElapsed(frequency)
  const daysLeft = Math.max(1, daysInPeriod - daysElapsed)
  const periodPct = Math.round((daysElapsed / daysInPeriod) * 100)
  const dailyAvg = daysElapsed > 0 ? spent / daysElapsed : 0
  const projectedSpend = dailyAvg * daysInPeriod
  const remaining = Math.max(0, budget - spent)

  // 🔴 Excedido
  if (spent > budget) {
    const excess = spent - budget
    return {
      id: `cat-insight-${categoryName}`,
      type: 'alert',
      severity: 'critical',
      category: categoryName,
      title: 'Presupuesto excedido',
      message: `Te pasaste por ${formatMoney(excess)} en ${categoryName.toLowerCase()}. Considera ajustar el límite o reducir el gasto el resto del periodo.`,
      usagePct: pct,
    }
  }

  // 🔴 Casi al límite (>90%)
  if (pct >= 90) {
    return {
      id: `cat-insight-${categoryName}`,
      type: 'alert',
      severity: 'critical',
      category: categoryName,
      title: 'Casi al límite',
      message: `Solo te quedan ${formatMoney(remaining)} de tu presupuesto de ${categoryName.toLowerCase()}. Tendrás que ser cuidadoso los próximos ${daysLeft} días.`,
      usagePct: pct,
    }
  }

  // 🟡 Ritmo acelerado — va a excederse
  if (pct >= 60 && projectedSpend > budget) {
    const reduction = Math.round(dailyAvg * 0.3)
    const weekSavings = reduction * 7
    return {
      id: `cat-insight-${categoryName}`,
      type: 'recommendation',
      severity: 'warning',
      category: categoryName,
      title: 'Consejo Kiri',
      message: `Si reduces ${categoryName.toLowerCase()} esta semana en ${formatMoney(weekSavings)}, podrías terminar el periodo dentro del presupuesto.`,
      savingsAmount: weekSavings,
      usagePct: pct,
    }
  }

  // 🟡 Preventivo (50-70%) y va a mitad del periodo
  if (pct >= 50 && pct < 70 && periodPct < 60) {
    return {
      id: `cat-insight-${categoryName}`,
      type: 'pattern',
      severity: 'warning',
      category: categoryName,
      title: 'Gasto moderado',
      message: `Llevas ${pct}% gastado con solo ${periodPct}% del periodo transcurrido. Mantén el ritmo controlado para no excederte.`,
      usagePct: pct,
    }
  }

  // 🟢 Sin gastar nada y ya pasó un buen rato
  if (spent === 0 && periodPct >= 40) {
    return {
      id: `cat-insight-${categoryName}`,
      type: 'celebration',
      severity: 'success',
      category: categoryName,
      title: '¡Excelente disciplina!',
      message: `Llevas ${periodPct}% del periodo sin gastar en ${categoryName.toLowerCase()}. Ese dinero está disponible para ahorro.`,
      savingsAmount: budget,
      usagePct: 0,
    }
  }

  // 🟢 Buen control (<50% gastado y avanzó bastante el periodo)
  if (pct <= 50 && periodPct >= 50) {
    return {
      id: `cat-insight-${categoryName}`,
      type: 'celebration',
      severity: 'success',
      category: categoryName,
      title: '¡Buen control!',
      message: `Llevas ${periodPct}% del periodo y solo has usado ${pct}% de tu presupuesto en ${categoryName.toLowerCase()}. ¡Sigue así!`,
      usagePct: pct,
    }
  }

  // 🟢 Default — todo normal
  const dailyBudget = remaining / daysLeft
  return {
    id: `cat-insight-${categoryName}`,
    type: 'recommendation',
    severity: 'info',
    category: categoryName,
    title: 'Consejo Kiri',
    message: `Puedes gastar hasta ${formatMoney(dailyBudget)} diarios en ${categoryName.toLowerCase()} para mantenerte dentro del presupuesto.`,
    usagePct: pct,
  }
}
