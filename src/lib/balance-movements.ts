import type { BalanceReport, Movement } from "@/lib/api-client"
import { tr } from "@/lib/i18n"

/**
 * Lista unificada de movimientos (pagos de deudas y gastos fijos, gastos
 * variables, ingresos, ahorro, préstamos "Me deben" y todo lo de Social:
 * préstamos entre usuarios, sus abonos y ahorros compartidos) a partir del reporte de
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
      nombre: (p.debtName as string) ?? tr("Deuda"),
      tipo: "deudas",
      tipoLabel: tr("Pago de deuda"),
      monto: p.montoPagado as number,
      estado: 'pagado',
      abonoCapital: p.abonoCapital as number,
      pagoInteres: p.pagoInteres as number,
      saldoAnterior: p.saldoAnterior as number,
      saldoPosterior: p.saldoPosterior as number,
      tasaInteres: p.tasaAplicada ? tr("{0}% M.V.", [Number(p.tasaAplicada).toFixed(2)]) : undefined,
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
      tipoLabel: tr("Gasto fijo"),
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
      tipoLabel: `${e.esHormiga ? tr("Gasto hormiga") : tr("Gasto variable")} · ${e.categoria as string}`,
      monto: e.monto as number,
      estado: 'pagado',
      tarjetaNombre: e.tarjetaNombre as string | null | undefined,
    })
  }

  for (const r of (report.incomeRecords ?? [])) {
    movements.push({
      id: (r.id as string) ?? `ir-${Math.random()}`,
      fecha: r.createdAt as string,
      nombre: (r.tipo as string) === 'salario' ? tr("Sueldo") : tr("Ingreso extra"),
      tipo: "ingresos",
      tipoLabel: (r.tipo as string) === 'salario' ? tr("Salario") : tr("Extra"),
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
        nombre: tr("Ahorro — {0}", [sv.periodo as string]),
        tipo: "ahorros",
        tipoLabel: tr("Ahorro"),
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
        nombre: tr("Retiro de ahorro — {0}", [sv.periodo as string]),
        tipo: "ahorros",
        tipoLabel: tr("Retiro de ahorro"),
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
      id: `pe-${p.id}`, fecha: p.fecha, nombre: tr("Préstamo a {0}", [p.persona]), tipo: "prestamos",
      tipoLabel: p.desdeBilletera ? tr("Prestaste (salió de tu billetera)") : tr("Préstamo registrado"),
      monto: p.monto, estado: 'pagado', direccion: 'salida',
      noMueveBilletera: !p.desdeBilletera,
    })
  }
  for (const a of report.prestamosExternos?.abonos ?? []) {
    movements.push({
      id: `pa-${a.id}`, fecha: a.fecha, nombre: tr("{0} te devolvió", [a.persona]), tipo: "prestamos",
      tipoLabel: a.entraABilletera ? tr("Abono recibido") : tr("Abono recibido (fuera de Kiri)"),
      monto: a.monto, estado: 'pagado', direccion: 'entrada',
    })
  }

  // Social: préstamos entre usuarios de Kiri y sus abonos (como "Me deben":
  // mueven el disponible pero no son gasto ni ingreso) y ahorros compartidos.
  for (const p of report.social?.prestamos ?? []) {
    const primero = p.conQuien.split(" ")[0]
    movements.push({
      id: `sp-${p.id}`, fecha: p.fecha, tipo: "prestamos", estado: 'pagado',
      nombre: p.rol === 'preste' ? tr("Préstamo a {0}", [primero]) : tr("Préstamo de {0}", [primero]),
      tipoLabel: p.previo
        ? tr("Social · préstamo previo (no movió tu billetera)")
        : p.rol === 'preste' ? tr("Social · prestaste (salió de tu billetera)") : tr("Social · te prestaron (entró a tu billetera)"),
      monto: p.monto,
      direccion: p.previo ? undefined : p.rol === 'preste' ? 'salida' : 'entrada',
      noMueveBilletera: !!p.previo,
    })
  }
  for (const a of report.social?.abonos ?? []) {
    const primero = a.conQuien.split(" ")[0]
    movements.push({
      id: `sa-${a.id}`, fecha: a.fecha, tipo: "prestamos", estado: 'pagado',
      nombre: a.rol === 'recibi' ? tr("{0} te abonó", [primero]) : tr("Abono a {0}", [primero]),
      tipoLabel: a.rol === 'recibi' ? tr("Social · abono recibido") : tr("Social · abono a un préstamo"),
      monto: a.monto, direccion: a.rol === 'recibi' ? 'entrada' : 'salida',
    })
  }
  for (const s of report.social?.ahorros ?? []) {
    movements.push({
      id: `sh-${s.id}`, fecha: s.fecha, tipo: "ahorros", estado: 'pagado',
      nombre: s.tipo === 'retiro' ? tr("Retiro de {0}", [s.bolsillo]) : tr("Aporte a {0}", [s.bolsillo]),
      tipoLabel: s.tipo === 'previo' ? tr("Ahorro compartido · ya ahorrado (no movió tu billetera)") : s.tipo === 'retiro' ? tr("Ahorro compartido · retiro") : tr("Ahorro compartido"),
      monto: s.monto, direccion: s.tipo === 'retiro' ? 'entrada' : undefined,
    })
  }

  return movements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}
