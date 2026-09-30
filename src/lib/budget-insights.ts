import { getDaysElapsedAndTotal } from './period-filter'
import { tr } from "@/lib/i18n"

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

/** Categoría con su gasto YA calculado por el backend (GET /budget-categories/resumen). */
interface BudgetCategory {
  id: string
  name: string
  budget: number
  spent: number
  /** Movimientos del periodo, solo para detectar la tendencia. */
  movimientos?: { monto: number; fecha: string }[]
  /** % de variación contra el periodo anterior (null si el anterior fue $0). */
  variacionPct?: number | null
  gastadoAnterior?: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getExpenseTrend(expenses: { monto: number; fecha: string }[]): 'rising' | 'stable' | 'declining' {
  if (expenses.length < 3) return 'stable'

  // Dividir en dos mitades temporales
  const sorted = [...expenses].sort((a, b) =>
    new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
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
  frequency: 'mensual' | 'quincenal',
  freeAmount: number,
  diasCobro: string = '',
): { insights: BudgetInsight[]; analyses: CategoryAnalysis[] } {
  const insights: BudgetInsight[] = []
  const analyses: CategoryAnalysis[] = []

  const { elapsed: daysElapsed, total: daysInPeriod } = getDaysElapsedAndTotal(frequency, diasCobro)
  const daysLeft = Math.max(1, daysInPeriod - daysElapsed)

  for (const cat of categories) {
    // El gasto viene calculado por el backend (misma cifra que el gráfico y
    // Balance) — antes este motor volvía a adivinar por palabras clave y el
    // "Consejo Kiri" podía citar un monto distinto al que mostraba la pantalla.
    const spent = cat.spent
    const pct = cat.budget > 0 ? Math.round((spent / cat.budget) * 100) : 0
    const isOver = spent > cat.budget
    const remaining = Math.max(0, cat.budget - spent)
    const dailyAvg = daysElapsed > 0 ? spent / daysElapsed : 0
    const projectedSpend = dailyAvg * daysInPeriod
    const trend = getExpenseTrend(cat.movimientos ?? [])

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
        title: tr("Excediste tu presupuesto de {0}", [cat.name]),
        message: tr("Llevas {0} gastados de los {1} asignados. Te pasaste por {2}.", [formatMoney(spent), formatMoney(cat.budget), formatMoney(excess)]),
        usagePct: pct,
      })
    }
    // Alerta preventiva: va a excederse si sigue así
    // Antes: "si reduces X esta semana podrías ahorrar Y" con un 30% fijo
    // inventado y cifras que no cuadraban entre sí. Ahora: a tu ritmo real
    // cuánto te pasarías, y cuánto puedes gastar por día para no pasarte.
    else if (!isOver && projectedSpend > cat.budget && pct >= 60) {
      const exceso = projectedSpend - cat.budget
      const limiteDiario = remaining / Math.max(1, daysLeft)

      insights.push({
        id: `alert-projected-${cat.id}`,
        type: 'recommendation',
        severity: 'warning',
        category: cat.name,
        title: tr("Consejo Kiri"),
        message: tr("A tu ritmo ({0}/día) cerrarías {1} en {2}, {3} por encima del límite. Para no pasarte, gasta máximo {4} por día los próximos {5} días.", [formatMoney(dailyAvg), cat.name.toLowerCase(), formatMoney(projectedSpend), formatMoney(exceso), formatMoney(limiteDiario), daysLeft]),
        savingsAmount: Math.round(exceso),
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
        title: tr("¡Excelente control en {0}!", [cat.name]),
        message: tr("Llevas {0}% del periodo y solo has usado {1}% de tu presupuesto. ¡Sigue así!", [Math.round((daysElapsed / daysInPeriod) * 100), pct]),
        usagePct: pct,
      })
    }
    // ═══ COMPARACIÓN: mucho más que el periodo anterior ═══
    else if (cat.variacionPct != null && cat.variacionPct >= 30 && (cat.gastadoAnterior ?? 0) > 0) {
      insights.push({
        id: `pattern-vs-anterior-${cat.id}`,
        type: 'pattern',
        severity: 'warning',
        category: cat.name,
        title: tr("{0}: {1}% más que el periodo pasado", [cat.name, cat.variacionPct]),
        message: tr("Llevas {0} en {1}; el periodo anterior cerraste en {2}.", [formatMoney(spent), cat.name.toLowerCase(), formatMoney(cat.gastadoAnterior ?? 0)]),
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
        title: tr("Tu gasto en {0} está creciendo", [cat.name]),
        message: tr("Detectamos que tus gastos en {0} están aumentando. A este ritmo gastarás {1} al final del periodo.", [cat.name.toLowerCase(), formatMoney(projectedSpend)]),
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
        title: tr("¡{0} sin gastos este periodo!", [zc.name]),
        message: tr("No has gastado nada en {0} este periodo: tienes los {1} completos. Si no los vas a necesitar, puedes pasarlos a un bolsillo de ahorro.", [zc.name.toLowerCase(), formatMoney(zc.budget)]),
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
        title: tr("Redistribuye tu presupuesto"),
        message: tr("Tienes {0} sin usar en {1} que podrían cubrir el exceso de {2}.", [formatMoney(totalUnused), underCats.map(c => c.name).join(', '), overCats.map(c => c.name).join(', ')]),
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
  diasCobro: string = '',
): BudgetInsight {
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
  const { elapsed: daysElapsed, total: daysInPeriod } = getDaysElapsedAndTotal(frequency, diasCobro)
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
      title: tr("Presupuesto excedido"),
      message: tr("Te pasaste por {0} en {1}. Considera ajustar el límite o reducir el gasto el resto del periodo.", [formatMoney(excess), categoryName.toLowerCase()]),
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
      title: tr("Casi al límite"),
      message: tr("Solo te quedan {0} de tu presupuesto de {1}. Tendrás que ser cuidadoso los próximos {2} días.", [formatMoney(remaining), categoryName.toLowerCase(), daysLeft]),
      usagePct: pct,
    }
  }

  // 🟡 Ritmo acelerado — va a excederse
  if (pct >= 60 && projectedSpend > budget) {
    const exceso = projectedSpend - budget
    const limiteDiario = remaining / daysLeft
    return {
      id: `cat-insight-${categoryName}`,
      type: 'recommendation',
      severity: 'warning',
      category: categoryName,
      title: tr("Consejo Kiri"),
      message: tr("A tu ritmo actual te pasarías por {0}. Para cerrar dentro del presupuesto, gasta máximo {1} por día los próximos {2} días.", [formatMoney(exceso), formatMoney(limiteDiario), daysLeft]),
      savingsAmount: Math.round(exceso),
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
      title: tr("Gasto moderado"),
      message: tr("Llevas {0}% gastado con solo {1}% del periodo transcurrido. Mantén el ritmo controlado para no excederte.", [pct, periodPct]),
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
      title: tr("¡Excelente disciplina!"),
      message: tr("Llevas {0}% del periodo sin gastar en {1}: tienes los {2} completos. Si no los vas a necesitar, pásalos a un bolsillo de ahorro.", [periodPct, categoryName.toLowerCase(), formatMoney(budget)]),
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
      title: tr("¡Buen control!"),
      message: tr("Llevas {0}% del periodo y solo has usado {1}% de tu presupuesto en {2}. ¡Sigue así!", [periodPct, pct, categoryName.toLowerCase()]),
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
    title: tr("Consejo Kiri"),
    message: tr("Puedes gastar hasta {0} diarios en {1} para mantenerte dentro del presupuesto.", [formatMoney(dailyBudget), categoryName.toLowerCase()]),
    usagePct: pct,
  }
}
