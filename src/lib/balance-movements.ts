import type { BalanceReport, Movement } from "@/lib/api-client"

/**
 * Lista unificada de movimientos (pagos de deudas y gastos fijos, gastos
 * variables, ingresos, ahorro y préstamos "Me deben") a partir del reporte de
 * Balance, del más reciente al más antiguo. Compartida por Balance y la
 * página de Historial para que ambas muestren exactamente lo mismo.
 */
export function buildMovements(report: BalanceReport | null): Movement[] {
  if (!report) return []
  const movements: Movement[] = []

  for (const p of (report.debtPayments ?? [])) {
    movements.push({
      id: (p.id as string) ?? `dp-${Math.random()}`,
      fecha: p.createdAt as string,
      nombre: (p.debtName as string) ?? 'Deuda',
      tipo: "deudas",
      tipoLabel: "Pago de deuda",
      monto: p.montoPagado as number,
      estado: 'pagado',
      abonoCapital: p.abonoCapital as number,
      pagoInteres: p.pagoInteres as number,
      saldoAnterior: p.saldoAnterior as number,
      saldoPosterior: p.saldoPosterior as number,
      tasaInteres: p.tasaAplicada ? `${Number(p.tasaAplicada).toFixed(2)}% M.V.` : undefined,
      acreedor: p.acreedor as string | undefined,
      tarjetaNombre: p.tarjetaNombre as string | null | undefined,
    })
  }

  // Ledger real de pagos (fixedExpensePayments), acotado por el rango
  // pedido — antes esto se reconstruía desde fixedExpenses.pagadoEstePeriodo,
  // que SIEMPRE refleja el periodo actual sin importar qué rango se esté
  // viendo, así que un mes pasado mostraba "$0 en gastos fijos" aunque el
  // total del resumen sí los hubiera sumado.
  for (const p of (report.fixedExpensePayments ?? [])) {
    movements.push({
      id: (p.id as string) ?? `fep-${Math.random()}`,
      fecha: p.createdAt as string,
      nombre: p.nombre as string,
      tipo: "gastos_fijos",
      tipoLabel: "Gasto fijo",
      monto: p.montoPagado as number,
      estado: 'pagado',
      tarjetaNombre: p.tarjetaNombre as string | null | undefined,
    })
  }

  for (const e of report.impulseExpenses) {
    movements.push({
      id: e.id as string,
      fecha: e.createdAt as string,
      nombre: e.nombre as string,
      tipo: "hormiga",
      // La tabla de gastos variables guarda TODO (no solo hormiga) — antes
      // cualquier gasto, hasta un vuelo, salía rotulado "Gasto hormiga".
      tipoLabel: `${e.esHormiga ? 'Gasto hormiga' : 'Gasto variable'} · ${e.categoria as string}`,
      monto: e.monto as number,
      estado: 'pagado',
      tarjetaNombre: e.tarjetaNombre as string | null | undefined,
    })
  }

  for (const r of (report.incomeRecords ?? [])) {
    movements.push({
      id: (r.id as string) ?? `ir-${Math.random()}`,
      fecha: r.createdAt as string,
      nombre: (r.tipo as string) === 'salario' ? 'Sueldo' : 'Ingreso extra',
      tipo: "ingresos",
      tipoLabel: (r.tipo as string) === 'salario' ? 'Salario' : 'Extra',
      monto: r.monto as number,
      estado: 'pagado',
    })
  }

  for (const sv of report.savingsHistory) {
    const tipoSv = sv.tipo as string
    if (tipoSv === 'ahorro') {
      movements.push({
        id: sv.id as string,
        fecha: sv.createdAt as string,
        nombre: `Ahorro — ${sv.periodo as string}`,
        tipo: "ahorros",
        tipoLabel: "Ahorro",
        monto: sv.monto as number,
        estado: 'pagado',
      })
    } else if (tipoSv === 'retiro') {
      // Retirar de un bolsillo devuelve el dinero al saldo disponible —
      // antes esto no dejaba ningún rastro en el historial (el retiro era
      // real, pero invisible en Balance/PDF).
      movements.push({
        id: sv.id as string,
        fecha: sv.createdAt as string,
        nombre: `Retiro de ahorro — ${sv.periodo as string}`,
        tipo: "ahorros",
        tipoLabel: "Retiro de ahorro",
        monto: sv.monto as number,
        estado: 'pagado',
        direccion: 'entrada',
      })
    }
  }

  // "Me deben": prestar y recibir abonos mueven el disponible pero no son
  // gasto ni ingreso — se listan para explicar el movimiento del saldo.
  for (const p of report.prestamosExternos?.prestamos ?? []) {
    movements.push({
      id: `pe-${p.id}`, fecha: p.fecha, nombre: `Préstamo a ${p.persona}`, tipo: "prestamos",
      tipoLabel: p.desdeBilletera ? "Prestaste (salió de tu billetera)" : "Préstamo registrado",
      monto: p.monto, estado: 'pagado', direccion: 'salida',
    })
  }
  for (const a of report.prestamosExternos?.abonos ?? []) {
    movements.push({
      id: `pa-${a.id}`, fecha: a.fecha, nombre: `${a.persona} te devolvió`, tipo: "prestamos",
      tipoLabel: a.entraABilletera ? "Abono recibido" : "Abono recibido (fuera de Kiri)",
      monto: a.monto, estado: 'pagado', direccion: 'entrada',
    })
  }

  return movements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}
