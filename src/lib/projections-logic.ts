/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Proyecciones Financieras — Kiri Finance
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Compara dos futuros, mes a mes, con los datos REALES del usuario:
 *
 * - Ruta actual: sigue igual que hoy — paga la cuota de cada deuda y ahorra lo
 *   mismo que viene ahorrando (su promedio real de los últimos meses).
 * - Ruta Kiri: además pone un aporte extra al mes (lo elige el usuario; Kiri
 *   sugiere uno que le cabe en su flujo libre) y usa la cuota de cada deuda que
 *   termina para atacar la siguiente (Avalancha si hay tasas, Bola de Nieve si
 *   no). Cuando ya no hay deudas, todo va a ahorro.
 *
 * Antes: el ingreso quincenal se tomaba como mensual Y se dividía por 2 (se
 * proyectaba con la cuarta parte del ingreso real), la tasa MENSUAL se dividía
 * por 12, la ruta actual suponía un 5% de ahorro inventado, la ruta Kiri un 20%
 * aunque no le alcanzara la plata, y los hitos del fondo de emergencia salían
 * siempre en el mes 4 y el 6. Nada de eso sale ya de supuestos: todo sale de
 * los datos o de lo que el usuario elige en la pantalla.
 */

export interface DebtInput {
  id: string
  nombre: string
  saldo: number
  /** Cuota del MES (una quincenal ya viene ×2) */
  cuotaMensual: number
  /** Tasa MENSUAL en % (así la guarda Kiri: 1.85 = 1,85% mes vencido) */
  tasaMensual?: number | null
}

export interface ProjectionInput {
  /** Ingreso del mes: sueldo (×2 si es quincenal) + ingresos extra recurrentes */
  ingresoMensual: number
  gastosFijosMensual: number
  /** Promedio real de gastos variables (lo registrado como gasto) por mes */
  gastoVariableMensual: number
  /** Promedio real de lo que viene ahorrando por mes */
  ahorroMensualActual: number
  ahorroInicial: number
  deudas: DebtInput[]
  /** Aporte extra mensual de la ruta Kiri */
  aporteExtra: number
  meses: number
  now?: Date
}

export interface ProjectionMonth {
  mes: number
  mesLabel: string
  ahorroActual: number
  deudaActual: number
  patrimonioActual: number
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

export interface RutaResumen {
  ahorro: number
  deuda: number
  patrimonio: number
  /** Meses hasta quedar sin deudas (null = no termina en 50 años con esos pagos; 0 = sin deudas) */
  mesesLibreDeuda: number | null
  /** Intereses pagados hasta terminar todas las deudas */
  interesesTotales: number
}

export interface ProjectionResult {
  months: ProjectionMonth[]
  hitos: ProjectionHito[]
  actualFinal: RutaResumen
  kiriFinal: RutaResumen
  /** Obligaciones del mes (gastos fijos + cuotas): base del fondo de emergencia */
  obligacionesMensual: number
  /** Lo que queda al mes después de fijos, cuotas, gasto variable y ahorro actual */
  flujoLibre: number
  aporteSugerido: number
  interesesAhorrados: number
  mesesMenosDeuda: number
  mejoraPatrimonio: number
  /** Fecha estimada sin deudas en cada ruta (null si no hay deudas o no termina) */
  fechaLibreActual: Date | null
  fechaLibreKiri: Date | null
  estrategia: "avalancha" | "bola_de_nieve" | null
  /** Meses de obligaciones que cubren los ahorros al final de la ruta Kiri */
  colchonFinalKiri: number
}

const HORIZONTE_MAX = 600 // 50 años: para fechas libres de deuda más allá de la gráfica

const r0 = (n: number) => Math.round(n)

/** Monto de una frecuencia llevado a mes. */
export function aMensual(monto: number, frecuencia: string | null | undefined): number {
  switch (frecuencia) {
    case "quincenal": return monto * 2
    case "semanal": return (monto * 52) / 12
    case "anual": return monto / 12
    default: return monto
  }
}

/**
 * Promedio mensual de movimientos reales en una ventana (por defecto 90 días).
 * Si el usuario lleva menos tiempo (no hay nada más viejo que la ventana), se
 * promedia desde el inicio del mes de su primer movimiento (mínimo 30 días),
 * para no inflar el promedio de quien apenas empieza.
 */
export function promedioMensual(movs: { monto: number; fecha: string | Date }[], now: Date = new Date(), dias = 90): number {
  const desde = now.getTime() - dias * 86400000
  const enVentana = movs.filter(m => {
    const t = new Date(m.fecha).getTime()
    return t >= desde && t <= now.getTime()
  })
  if (enVentana.length === 0) return 0
  const hayMasViejos = movs.some(m => new Date(m.fecha).getTime() < desde)
  const primero = new Date(Math.min(...enVentana.map(m => new Date(m.fecha).getTime())))
  const inicio = new Date(primero.getFullYear(), primero.getMonth(), 1).getTime()
  const diasCubiertos = hayMasViejos ? dias : Math.max(30, Math.min(dias, (now.getTime() - inicio) / 86400000))
  const total = enVentana.reduce((a, m) => a + m.monto, 0)
  return (total / diasCubiertos) * 30
}

/** Aporte extra sugerido: la mitad de lo que le queda libre, redondeado a $10.000. */
export function aporteSugerido(flujoLibre: number): number {
  if (flujoLibre <= 0) return 0
  return Math.max(0, Math.floor((flujoLibre * 0.5) / 10000) * 10000)
}

interface EstadoDeuda { id: string; nombre: string; saldo: number; cuota: number; tasa: number; pagadaEn: number | null }

/** Un mes de deudas. Devuelve interés pagado y la plata que sobró del extra. */
function pagarMes(deudas: EstadoDeuda[], mes: number, extra: number, orden: EstadoDeuda[]): { interes: number; sobrante: number } {
  let interes = 0
  // 1. Interés y cuota mínima de cada una
  for (const d of deudas) {
    if (d.saldo <= 0) continue
    const i = d.saldo * (d.tasa / 100)
    interes += i
    const pago = Math.min(d.cuota, d.saldo + i)
    d.saldo = Math.max(0, d.saldo + i - pago)
    // Lo que sobra de la cuota del último mes también es plata libre
    if (pago < d.cuota) extra += d.cuota - pago
    if (d.saldo <= 0.5 && d.pagadaEn === null) { d.saldo = 0; d.pagadaEn = mes }
  }
  // 2. El extra a la deuda objetivo (y si la termina, a la siguiente)
  for (const d of orden) {
    if (extra <= 0) break
    if (d.saldo <= 0) continue
    const abono = Math.min(extra, d.saldo)
    d.saldo -= abono
    extra -= abono
    if (d.saldo <= 0.5 && d.pagadaEn === null) { d.saldo = 0; d.pagadaEn = mes }
  }
  return { interes, sobrante: extra }
}

function etiquetaMes(now: Date, m: number, larga = false): string {
  const f = new Date(now.getFullYear(), now.getMonth() + m, 1)
  return f.toLocaleDateString("es-CO", larga ? { month: "long", year: "numeric" } : { month: "short", year: "2-digit" })
}

export function calculateProjections(input: ProjectionInput): ProjectionResult {
  const now = input.now ?? new Date()
  const meses = Math.max(1, input.meses)
  const deudasIn = input.deudas.filter(d => d.saldo > 0)
  const cuotasMes = deudasIn.reduce((a, d) => a + d.cuotaMensual, 0)
  const obligacionesMensual = input.gastosFijosMensual + cuotasMes
  const flujoLibre = input.ingresoMensual - input.gastosFijosMensual - cuotasMes - input.gastoVariableMensual - input.ahorroMensualActual
  const extraKiri = Math.max(0, input.aporteExtra)

  const conTasa = deudasIn.some(d => (d.tasaMensual ?? 0) > 0)
  const estrategia = deudasIn.length === 0 ? null : conTasa ? "avalancha" : "bola_de_nieve"

  const nuevas = (): EstadoDeuda[] => deudasIn.map(d => ({ id: d.id, nombre: d.nombre, saldo: d.saldo, cuota: d.cuotaMensual, tasa: d.tasaMensual ?? 0, pagadaEn: null }))
  const actual = nuevas()
  const kiri = nuevas()
  // Avalancha: primero la tasa más alta (desempate: saldo menor). Bola de nieve: saldo menor.
  const ordenKiri = [...kiri].sort((a, b) => estrategia === "avalancha" ? (b.tasa - a.tasa) || (a.saldo - b.saldo) : a.saldo - b.saldo)

  let ahorroA = input.ahorroInicial
  let ahorroK = input.ahorroInicial
  let interesA = 0
  let interesK = 0
  let libreA: number | null = deudasIn.length === 0 ? 0 : null
  let libreK: number | null = deudasIn.length === 0 ? 0 : null
  const months: ProjectionMonth[] = []
  const hitos: ProjectionHito[] = []
  const hitoFondo = { uno: input.ahorroInicial >= obligacionesMensual && obligacionesMensual > 0, tres: input.ahorroInicial >= obligacionesMensual * 3 && obligacionesMensual > 0 }
  let patrimonioPositivo = input.ahorroInicial - deudasIn.reduce((a, d) => a + d.saldo, 0) >= 0

  for (let m = 1; m <= HORIZONTE_MAX; m++) {
    const quedanA = actual.some(d => d.saldo > 0)
    const quedanK = kiri.some(d => d.saldo > 0)
    if (m > meses && !quedanA && !quedanK) break

    // ── Ruta actual: cuotas + el mismo ahorro de siempre. Las cuotas que se
    // liberan NO se reasignan (sin plan, esa plata se suele gastar).
    if (quedanA) {
      const { interes } = pagarMes(actual, m, 0, [])
      interesA += interes
      if (libreA === null && !actual.some(d => d.saldo > 0)) libreA = m
    }
    ahorroA += input.ahorroMensualActual

    // ── Ruta Kiri: extra + cuotas liberadas van a la deuda objetivo; sin
    // deudas, todo (ahorro actual + extra + cuotas que ya no se pagan) a ahorro.
    if (quedanK) {
      const liberadas = kiri.filter(d => d.saldo <= 0).reduce((a, d) => a + d.cuota, 0)
      const { interes, sobrante } = pagarMes(kiri, m, extraKiri + liberadas, ordenKiri)
      interesK += interes
      ahorroK += input.ahorroMensualActual + sobrante
      for (const d of kiri) {
        if (d.pagadaEn === m && m <= meses) {
          hitos.push({ mes: m, mesLabel: etiquetaMes(now, m, true), titulo: `Terminas de pagar ${d.nombre}`, descripcion: `Su cuota de ${fmt(d.cuota)} pasa a la siguiente deuda.`, tipo: "deuda" })
        }
      }
      if (libreK === null && !kiri.some(d => d.saldo > 0)) {
        libreK = m
        if (m <= meses) hitos.push({ mes: m, mesLabel: etiquetaMes(now, m, true), titulo: "¡Libre de deudas! 🎉", descripcion: "Desde aquí todo lo que pagabas en cuotas va a tu ahorro.", tipo: "meta" })
      }
    } else {
      ahorroK += input.ahorroMensualActual + extraKiri + cuotasMes
    }

    if (m > meses) continue

    const deudaA = actual.reduce((a, d) => a + d.saldo, 0)
    const deudaK = kiri.reduce((a, d) => a + d.saldo, 0)
    months.push({
      mes: m,
      mesLabel: etiquetaMes(now, m),
      ahorroActual: r0(ahorroA), deudaActual: r0(-deudaA), patrimonioActual: r0(ahorroA - deudaA),
      ahorroKiri: r0(ahorroK), deudaKiri: r0(-deudaK), patrimonioKiri: r0(ahorroK - deudaK),
    })

    // Hitos de ahorro (ruta Kiri), solo si pasan de verdad en este mes
    if (obligacionesMensual > 0 && !hitoFondo.uno && ahorroK >= obligacionesMensual) {
      hitoFondo.uno = true
      hitos.push({ mes: m, mesLabel: etiquetaMes(now, m, true), titulo: "Colchón de 1 mes", descripcion: `Tus ahorros ya cubren un mes de obligaciones (${fmt(obligacionesMensual)}).`, tipo: "emergencia" })
    }
    if (obligacionesMensual > 0 && !hitoFondo.tres && ahorroK >= obligacionesMensual * 3) {
      hitoFondo.tres = true
      hitos.push({ mes: m, mesLabel: etiquetaMes(now, m, true), titulo: "Fondo de emergencia completo 🛡️", descripcion: `3 meses de obligaciones cubiertos (${fmt(obligacionesMensual * 3)}).`, tipo: "emergencia" })
    }
    if (!patrimonioPositivo && ahorroK - deudaK >= 0) {
      patrimonioPositivo = true
      hitos.push({ mes: m, mesLabel: etiquetaMes(now, m, true), titulo: "Patrimonio en positivo", descripcion: "Lo que tienes ahorrado ya supera lo que debes.", tipo: "ahorro" })
    }
  }
  hitos.sort((a, b) => a.mes - b.mes)

  const last = months[months.length - 1]
  const actualFinal: RutaResumen = { ahorro: last.ahorroActual, deuda: Math.abs(last.deudaActual), patrimonio: last.patrimonioActual, mesesLibreDeuda: libreA, interesesTotales: r0(interesA) }
  const kiriFinal: RutaResumen = { ahorro: last.ahorroKiri, deuda: Math.abs(last.deudaKiri), patrimonio: last.patrimonioKiri, mesesLibreDeuda: libreK, interesesTotales: r0(interesK) }
  const fecha = (m: number | null) => m && m > 0 ? new Date(now.getFullYear(), now.getMonth() + m, 1) : null

  return {
    months, hitos, actualFinal, kiriFinal,
    obligacionesMensual: r0(obligacionesMensual),
    flujoLibre: r0(flujoLibre),
    aporteSugerido: aporteSugerido(flujoLibre),
    interesesAhorrados: Math.max(0, r0(interesA - interesK)),
    mesesMenosDeuda: libreA !== null && libreK !== null ? Math.max(0, libreA - libreK) : libreA === null && libreK !== null ? -1 : 0,
    mejoraPatrimonio: r0(kiriFinal.patrimonio - actualFinal.patrimonio),
    fechaLibreActual: fecha(libreA),
    fechaLibreKiri: fecha(libreK),
    estrategia,
    colchonFinalKiri: obligacionesMensual > 0 ? Math.round((kiriFinal.ahorro / obligacionesMensual) * 10) / 10 : 0,
  }
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CO")}`
}
