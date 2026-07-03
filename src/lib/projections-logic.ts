/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Proyecciones Financieras — Kiri Finance
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Simula el futuro financiero del usuario a 6 meses comparando:
 * - Ruta actual (sin cambios): sigue pagando cuotas mínimas
 * - Ruta Kiri (plan optimizado): usa estrategia Bola de Nieve + ahorro agresivo
 */

export interface DebtInput {
  id: string
  nombre: string
  saldoRestante: number
  cuotaPeriodo: number
  tasaInteres?: number | null
}

export interface ProjectionMonth {
  mes: string
  mesLabel: string
  // Ruta actual
  ahorroActual: number
  deudaActual: number
  patrimonioActual: number
  // Ruta Kiri (optimizada)
  ahorroKiri: number
  deudaKiri: number
  patrimonioKiri: number
}

export interface ProjectionHito {
  mes: number
  mesLabel: string
  titulo: string
  descripcion: string
  tipo: "deuda" | "ahorro" | "emergencia" | "meta"
}

export interface ProjectionResult {
  months: ProjectionMonth[]
  hitos: ProjectionHito[]
  // Comparación final
  actualFinal: { ahorro: number; deuda: number; patrimonio: number }
  kiriFinal: { ahorro: number; deuda: number; patrimonio: number }
  // Métricas
  interesesAhorrados: number
  mesesMenosDeuda: number
  mejoraPatrimonio: number
  probabilidadExito: number
}

/**
 * Calcula las proyecciones a 6 meses.
 */
export function calculateProjections(
  ingresoMensual: number,
  debts: DebtInput[],
  ahorroActual: number,
  gastosFijosMensual: number,
  frecuencia: "mensual" | "quincenal",
  mesesProyeccion: number = 6,
): ProjectionResult {
  const MESES = mesesProyeccion
  const now = new Date()

  // Ingreso efectivo por periodo
  const ingresoPeriodo = frecuencia === "quincenal" ? ingresoMensual / 2 : ingresoMensual
  const periodsPerMonth = frecuencia === "quincenal" ? 2 : 1

  // ═══ RUTA ACTUAL: pago mínimo, ahorro bajo (5% del remanente) ═══
  const actualDebts = debts.map(d => ({ ...d, saldo: d.saldoRestante }))
  const totalCuotasActual = actualDebts.reduce((a, d) => a + d.cuotaPeriodo, 0) * periodsPerMonth
  const remanenteActual = Math.max(0, ingresoMensual - gastosFijosMensual - totalCuotasActual)
  const ahorroMensualActual = remanenteActual * 0.05 // Solo 5% de ahorro

  // ═══ RUTA KIRI: Bola de Nieve + ahorro agresivo (20% del ingreso) ═══
  const kiriDebts = debts.map(d => ({ ...d, saldo: d.saldoRestante })).sort((a, b) => a.saldoRestante - b.saldoRestante)
  const ahorroMensualKiri = ingresoMensual * 0.20 // 20% del ingreso
  const extraParaDeuda = remanenteActual * 0.50 // 50% del remanente extra va a deuda

  const months: ProjectionMonth[] = []
  let acumAhorroActual = ahorroActual
  let acumAhorroKiri = ahorroActual
  let totalInteresesActual = 0
  let totalInteresesKiri = 0
  const hitos: ProjectionHito[] = []

  for (let m = 1; m <= MESES; m++) {
    const fecha = new Date(now.getFullYear(), now.getMonth() + m, 1)
    const mesLabel = fecha.toLocaleDateString("es-ES", { month: "short", year: "numeric" })
    const mesNombre = `Mes ${m} - ${fecha.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`

    // ── Ruta Actual ──
    for (const d of actualDebts) {
      if (d.saldo <= 0) continue
      const interes = (d.tasaInteres || 0) / 100 / 12 * d.saldo
      totalInteresesActual += interes
      const pagoReal = Math.min(d.cuotaPeriodo * periodsPerMonth, d.saldo + interes)
      d.saldo = Math.max(0, d.saldo + interes - pagoReal)
    }
    acumAhorroActual += ahorroMensualActual

    // ── Ruta Kiri (Bola de Nieve) ──
    let extraDisponible = extraParaDeuda
    for (const d of kiriDebts) {
      if (d.saldo <= 0) continue
      const interes = (d.tasaInteres || 0) / 100 / 12 * d.saldo
      totalInteresesKiri += interes
      let pago = d.cuotaPeriodo * periodsPerMonth + extraDisponible
      pago = Math.min(pago, d.saldo + interes)
      d.saldo = Math.max(0, d.saldo + interes - pago)
      extraDisponible = Math.max(0, extraDisponible - (pago - d.cuotaPeriodo * periodsPerMonth))

      // Detectar hito: deuda liquidada
      if (d.saldo <= 0 && !hitos.find(h => h.titulo.includes(d.nombre))) {
        hitos.push({
          mes: m, mesLabel: mesNombre,
          titulo: `Terminas de pagar ${d.nombre}`,
          descripcion: "¡Te liberas de intereses altos!",
          tipo: "deuda",
        })
      }
    }
    acumAhorroKiri += ahorroMensualKiri

    // Hitos de ahorro
    if (m === 4 && !hitos.find(h => h.tipo === "emergencia")) {
      hitos.push({ mes: m, mesLabel: mesNombre, titulo: "Fondo de emergencia al 50%", descripcion: "Vas por buen camino.", tipo: "emergencia" })
    }
    if (m === 6 && !hitos.find(h => h.tipo === "meta")) {
      hitos.push({ mes: m, mesLabel: mesNombre, titulo: "Fondo de emergencia completo ✅", descripcion: "Alcanzas el mínimo ideal de 3 meses de gastos.", tipo: "meta" })
    }

    const deudaActualTotal = actualDebts.reduce((a, d) => a + d.saldo, 0)
    const deudaKiriTotal = kiriDebts.reduce((a, d) => a + d.saldo, 0)

    months.push({
      mes: `Mes ${m}`,
      mesLabel,
      ahorroActual: Math.round(acumAhorroActual),
      deudaActual: Math.round(-deudaActualTotal),
      patrimonioActual: Math.round(acumAhorroActual - deudaActualTotal),
      ahorroKiri: Math.round(acumAhorroKiri),
      deudaKiri: Math.round(-deudaKiriTotal),
      patrimonioKiri: Math.round(acumAhorroKiri - deudaKiriTotal),
    })
  }

  const last = months[months.length - 1]
  const actualFinal = { ahorro: last?.ahorroActual ?? 0, deuda: Math.abs(last?.deudaActual ?? 0), patrimonio: last?.patrimonioActual ?? 0 }
  const kiriFinal = { ahorro: last?.ahorroKiri ?? 0, deuda: Math.abs(last?.deudaKiri ?? 0), patrimonio: last?.patrimonioKiri ?? 0 }

  const interesesAhorrados = Math.round(totalInteresesActual - totalInteresesKiri)
  const mejoraPatrimonio = kiriFinal.patrimonio - actualFinal.patrimonio

  // Estimar meses menos de deuda
  const deudaTotalInicial = debts.reduce((a, d) => a + d.saldoRestante, 0)
  const cuotasTotales = debts.reduce((a, d) => a + d.cuotaPeriodo, 0) * periodsPerMonth
  const mesesActual = cuotasTotales > 0 ? Math.ceil(deudaTotalInicial / cuotasTotales) : 0
  const mesesKiri = (cuotasTotales + extraParaDeuda) > 0 ? Math.ceil(deudaTotalInicial / (cuotasTotales + extraParaDeuda)) : 0
  const mesesMenosDeuda = Math.max(0, mesesActual - mesesKiri)

  // Probabilidad de éxito basada en el plan
  const probabilidadExito = Math.min(98, 70 + (ahorroMensualKiri > 0 ? 15 : 0) + (debts.length < 5 ? 10 : 5) + (ingresoMensual > gastosFijosMensual * 1.5 ? 5 : 0))

  return { months, hitos, actualFinal, kiriFinal, interesesAhorrados, mesesMenosDeuda, mejoraPatrimonio, probabilidadExito }
}
