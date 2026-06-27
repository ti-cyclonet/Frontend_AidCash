import { BudgetAllocation, Debt, IncomeFrequency } from './types'

// ─── Tipos de alertas ─────────────────────────────────────────────────────────

export type AlertLevel = 'info' | 'warning' | 'critical'

export interface FinancialAlert {
  id: string
  level: AlertLevel
  title: string
  message: string
}

export interface SnowballDebt {
  debt: Debt
  periodsToFinish: number
  reason: string
}

// ─── Estrategias de deuda ─────────────────────────────────────────────────────

export interface DebtStrategyStep {
  debtId:   string
  nombre:   string
  /** Periodo (0-indexed) en el que se liquida esta deuda */
  liquidaEnPeriodo: number
  /** Cuota que se destinaba a esta deuda, que "rueda" a la siguiente */
  cuotaLiberada: number
}

export interface DebtStrategy {
  /** Nombre del método */
  nombre: 'Bola de Nieve' | 'Avalancha'
  /** Descripción breve */
  descripcion: string
  /** Periodos totales hasta quedar libre de deudas */
  periodosTotal: number
  /** Meses totales (normalizado independiente de la frecuencia) */
  mesesTotal: number
  /** Fecha estimada de liberación (ej: "marzo 2027") */
  fechaLibre: string
  /** Interés total pagado estimado (si hay tasa, si no 0) */
  totalPagado: number
  /** Orden de liquidación con detalle */
  pasos: DebtStrategyStep[]
  /** Cuántos periodos antes termina vs el otro método (negativo = más tarde) */
  diferenciaPeriodos?: number
}

export interface RecommendationResult {
  alerts: FinancialAlert[]
  snowballDebts: SnowballDebt[]
  suggestPauseSavings: boolean
  savingsToRedirect: number
  /** Comparativa de estrategias (solo si hay deudas activas con cuota > 0) */
  strategies: {
    snowball: DebtStrategy
    avalanche: DebtStrategy
    /** true si Avalancha termina antes o igual que Bola de Nieve */
    avalancheWins: boolean
  } | null
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function periodoAMeses(periodos: number, frecuencia: IncomeFrequency): number {
  return frecuencia === 'quincenal' ? Math.ceil(periodos / 2) : periodos
}

function fechaDesdeHoy(meses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + meses)
  return `${MESES_ES[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Motor de simulación de estrategia ───────────────────────────────────────

/**
 * Simula la liquidación de deudas con el método indicado.
 *
 * Lógica:
 *  - Cada periodo se paga la cuota mínima de todas las deudas.
 *  - El "extra" (cuota de deudas ya liquidadas) se acumula y se aplica
 *    íntegramente a la deuda objetivo (efecto bola de nieve/avalancha).
 *  - No se asume tasa de interés porque los datos no la incluyen.
 *    El `totalPagado` refleja la suma de todas las cuotas efectivamente pagadas.
 */
function simularEstrategia(
  deudas: Debt[],
  frecuencia: IncomeFrequency,
  ordenar: (a: Debt, b: Debt) => number,
  nombre: 'Bola de Nieve' | 'Avalancha',
  descripcion: string
): DebtStrategy {
  // Clona con saldos mutables
  const estado = deudas
    .filter(d => d.cuotaPeriodo > 0 && d.montoTotal > 0)
    .map(d => ({ ...d, saldo: d.montoTotal }))

  if (estado.length === 0) {
    return {
      nombre, descripcion,
      periodosTotal: 0, mesesTotal: 0,
      fechaLibre: fechaDesdeHoy(0),
      totalPagado: 0, pasos: [],
    }
  }

  const pasos: DebtStrategyStep[] = []
  let periodo = 0
  let totalPagado = 0
  let extraAcumulado = 0

  // Ordena para definir cuál es la deuda "objetivo" en cada momento
  const cola = [...estado].sort(ordenar)

  while (cola.some(d => d.saldo > 0) && periodo < 600) {
    periodo++

    // Primero paga mínimos de todas
    for (const d of cola) {
      if (d.saldo <= 0) continue
      const pago = Math.min(d.cuotaPeriodo, d.saldo)
      d.saldo -= pago
      totalPagado += pago
    }

    // Aplica el extra a la primera deuda activa de la cola (objetivo)
    const objetivo = cola.find(d => d.saldo > 0)
    if (objetivo && extraAcumulado > 0) {
      const abonoExtra = Math.min(extraAcumulado, objetivo.saldo)
      objetivo.saldo -= abonoExtra
      totalPagado += abonoExtra
      extraAcumulado -= abonoExtra
    }

    // Detecta deudas recién liquidadas y acumula su cuota como extra
    for (const d of cola) {
      if (d.saldo <= 0 && !pasos.find(p => p.debtId === d.id)) {
        pasos.push({
          debtId: d.id,
          nombre: d.nombre,
          liquidaEnPeriodo: periodo,
          cuotaLiberada: d.cuotaPeriodo,
        })
        extraAcumulado += d.cuotaPeriodo
      }
    }
  }

  const meses = periodoAMeses(periodo, frecuencia)
  return {
    nombre, descripcion,
    periodosTotal: periodo,
    mesesTotal: meses,
    fechaLibre: fechaDesdeHoy(meses),
    totalPagado: Math.round(totalPagado),
    pasos,
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

export function analyzeFinances(
  allocation: BudgetAllocation,
  debts: Debt[],
  frecuencia: IncomeFrequency = 'mensual'
): RecommendationResult {
  const alerts: FinancialAlert[] = []
  const activeDebts = debts.filter(d => d.estado === 'activa')

  // ── Alerta 1: Sin capacidad de endeudamiento ──────────────────────────────
  if (allocation.debtCapacityAmount <= 0 && !allocation.isOverloaded) {
    alerts.push({
      id: 'no_debt_capacity',
      level: 'warning',
      title: 'Tu margen está al límite',
      message: 'Ahora mismo todo tu flujo libre va al día a día. No te preocupes, es temporal. Al liquidar una deuda pequeña, recuperarás capacidad para nuevas metas.',
    })
  }

  // ── Alerta 2: Sobrecarga crítica ──────────────────────────────────────────
  if (allocation.isOverloaded) {
    alerts.push({
      id: 'overloaded',
      level: 'critical',
      title: 'Un desvío en la ruta — ajustemos juntos',
      message: `Tus compromisos actuales superan tu ingreso en un ${Math.abs(Math.round(allocation.obligationsPct - 100))}%. Es un momento para replantear prioridades. Vamos a buscar qué deudas atacar primero para liberar oxígeno.`,
    })
  }

  // ── Alerta 3: Presupuesto ajustado ────────────────────────────────────────
  if (allocation.isTight && !allocation.isOverloaded) {
    alerts.push({
      id: 'tight_budget',
      level: 'warning',
      title: 'Navegando con poco margen',
      message: `El ${Math.round(allocation.obligationsPct)}% de tu ingreso va a obligaciones. Estás en control, pero con poco colchón para imprevistos. Cada deuda que liquides te devuelve libertad.`,
    })
  }

  // ── Alerta positiva cuando todo está en orden ─────────────────────────────
  if (!allocation.isOverloaded && !allocation.isTight && allocation.debtCapacityAmount > 0) {
    alerts.push({
      id: 'all_good',
      level: 'info',
      title: 'Vas por buen camino 🌟',
      message: 'Tu presupuesto está equilibrado. Tienes margen para ahorrar, para el día a día, y para metas nuevas. ¡Sigue así!',
    })
  }

  // ── Bola de nieve clásica (sugerencias rápidas) ───────────────────────────
  const snowballDebts: SnowballDebt[] = []
  const shouldSnowball = allocation.isOverloaded || allocation.isTight || allocation.debtCapacityAmount <= 0

  if (shouldSnowball && activeDebts.length > 0) {
    const sorted = [...activeDebts]
      .filter(d => d.cuotaPeriodo > 0)
      .sort((a, b) => a.montoTotal - b.montoTotal)
      .slice(0, 3)

    for (const debt of sorted) {
      const periods = Math.ceil(debt.montoTotal / debt.cuotaPeriodo)
      snowballDebts.push({
        debt,
        periodsToFinish: periods,
        reason: periods <= 3
          ? `¡Solo ${periods} cuota${periods > 1 ? 's' : ''} para liquidarla!`
          : `Menor saldo — libera flujo en ${periods} periodos`,
      })
    }
  }

  // ── Sugerir pausar ahorro ─────────────────────────────────────────────────
  const suggestPauseSavings = allocation.isOverloaded || (allocation.isTight && allocation.debtCapacityAmount <= 0)
  const savingsToRedirect = suggestPauseSavings ? allocation.savingsAmount : 0

  // ── Estrategias completas ─────────────────────────────────────────────────
  // Solo se muestran si hay al menos 2 deudas (con 1 sola, ambas estrategias
  // producen el mismo resultado y no tiene sentido compararlas).
  const deudaSímulables = activeDebts.filter(d => d.cuotaPeriodo > 0 && d.montoTotal > 0)
  let strategies: RecommendationResult['strategies'] = null

  if (deudaSímulables.length >= 2) {
    const snowball = simularEstrategia(
      deudaSímulables, frecuencia,
      // BOLA DE NIEVE: menor saldo total primero → victorias rápidas
      (a, b) => a.montoTotal - b.montoTotal,
      'Bola de Nieve',
      'Liquida la deuda de menor saldo primero para ganar victorias rápidas y motivación.'
    )

    const avalanche = simularEstrategia(
      deudaSímulables, frecuencia,
      // AVALANCHA: mayor saldo total primero → reduce el monto global más rápido
      // (con cuotas iguales, la deuda más grande tarda más, así que atacarla
      //  primero con los extras reduce el tiempo total)
      (a, b) => b.montoTotal - a.montoTotal,
      'Avalancha',
      'Ataca la deuda más grande primero para reducir el total adeudado más rápido.'
    )

    // Añade diferencia entre métodos
    snowball.diferenciaPeriodos = snowball.periodosTotal - avalanche.periodosTotal
    avalanche.diferenciaPeriodos = avalanche.periodosTotal - snowball.periodosTotal

    strategies = {
      snowball,
      avalanche,
      avalancheWins: avalanche.periodosTotal <= snowball.periodosTotal,
    }
  }

  return { alerts, snowballDebts, suggestPauseSavings, savingsToRedirect, strategies }
}

// ─── Simulador de endeudamiento ───────────────────────────────────────────────

export interface DebtSimulation {
  canAfford: boolean
  monthsToPayOff: number | null
  suggestedQuota: number
  remainingCapacity: number
  usagePct: number
  message: string
}

export interface DebtSimulationOption {
  label: string
  description: string
  quota: number
  months: number
  remainingCapacity: number
  usagePct: number
  recommended: boolean
  canAfford: boolean
}

export function simulateDebtOptions(
  purchaseAmount: number,
  debtCapacity: number,
  incomeFrequency: IncomeFrequency
): { canAffordAny: boolean; options: DebtSimulationOption[] } {
  if (debtCapacity <= 0) return { canAffordAny: false, options: [] }

  const toMonths = (periods: number) =>
    incomeFrequency === 'quincenal' ? Math.ceil(periods / 2) : periods

  const buildOption = (
    label: string, description: string, quotaPct: number, recommended: boolean
  ): DebtSimulationOption => {
    const quota = Math.round(debtCapacity * quotaPct)
    const periods = quota > 0 ? Math.ceil(purchaseAmount / quota) : 9999
    const months = toMonths(periods)
    const remainingCapacity = Math.round(debtCapacity - quota)
    return { label, description, quota, months, remainingCapacity, usagePct: quotaPct * 100, recommended, canAfford: months <= 48 }
  }

  return {
    canAffordAny: true,
    options: [
      buildOption('Conservadora', 'Usas el 25% — guardas margen para otras compras', 0.25, false),
      buildOption('Moderada',     'Usas el 50% — equilibrio entre plazo y libertad',  0.50, true),
      buildOption('Total',        'Usas el 100% — pagas más rápido, sin margen extra', 1.0, false),
    ],
  }
}

export function simulateDebt(
  purchaseAmount: number,
  debtCapacity: number,
  incomeFrequency: IncomeFrequency
): DebtSimulation {
  if (debtCapacity <= 0) {
    return { canAfford: false, monthsToPayOff: null, suggestedQuota: 0, remainingCapacity: 0, usagePct: 0, message: 'Actualmente no tienes capacidad de endeudamiento disponible.' }
  }
  const periods = Math.ceil(purchaseAmount / debtCapacity)
  const months = incomeFrequency === 'quincenal' ? Math.ceil(periods / 2) : periods
  const canAfford = months <= 36
  return {
    canAfford, monthsToPayOff: months, suggestedQuota: debtCapacity,
    remainingCapacity: 0, usagePct: 100,
    message: canAfford
      ? `Podrías pagarlo en ${months} ${months === 1 ? 'mes' : 'meses'}.`
      : `Con tu capacidad actual tardarías más de 3 años.`,
  }
}

// ─── Fondo de Emergencia ──────────────────────────────────────────────────────

export interface EmergencyFundAnalysis {
  /** Meta mínima: 3 meses de gastos fijos */
  metaMinima: number
  /** Meta ideal: 6 meses de gastos fijos */
  metaIdeal: number
  /** Meses estimados para alcanzar la meta mínima guardando el ahorro sugerido */
  mesesParaMinima: number
  /** Meses estimados para alcanzar la meta ideal */
  mesesParaIdeal: number
  /** Porcentaje alcanzado de la meta mínima */
  pctMinima: number
  /** Porcentaje alcanzado de la meta ideal */
  pctIdeal: number
  /** Fecha estimada para meta mínima */
  fechaMinima: string
  /** Fecha estimada para meta ideal */
  fechaIdeal: string
}

export function analyzeEmergencyFund(
  totalGastosFijos: number,
  fondoActual: number,
  aporteMensual: number
): EmergencyFundAnalysis {
  const metaMinima = totalGastosFijos * 3
  const metaIdeal  = totalGastosFijos * 6

  const faltaMinima = Math.max(0, metaMinima - fondoActual)
  const faltaIdeal  = Math.max(0, metaIdeal  - fondoActual)

  const mesesParaMinima = aporteMensual > 0 ? Math.ceil(faltaMinima / aporteMensual) : 999
  const mesesParaIdeal  = aporteMensual > 0 ? Math.ceil(faltaIdeal  / aporteMensual) : 999

  return {
    metaMinima:      Math.round(metaMinima),
    metaIdeal:       Math.round(metaIdeal),
    mesesParaMinima,
    mesesParaIdeal,
    pctMinima: metaMinima > 0 ? Math.min(100, Math.round((fondoActual / metaMinima) * 100)) : 0,
    pctIdeal:  metaIdeal  > 0 ? Math.min(100, Math.round((fondoActual / metaIdeal)  * 100)) : 0,
    fechaMinima: fechaDesdeHoy(mesesParaMinima),
    fechaIdeal:  fechaDesdeHoy(mesesParaIdeal),
  }
}
