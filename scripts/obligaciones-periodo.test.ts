/**
 * Pruebas de "cuánto toca pagar en el periodo" (lib/obligaciones-pendientes.ts):
 *   npx tsx scripts/obligaciones-periodo.test.ts
 */
import assert from "node:assert/strict"
import { pendienteEnPeriodo, prestamoEnPeriodo, type ObligacionParaPeriodo } from "../src/lib/obligaciones-pendientes"

const d = (s: string, h = 12) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd, h) }
const rango = (a: string, b: string) => ({ start: d(a, 0), end: d(b, 0) }) // [a, b)
let ok = 0
const t = (nombre: string, fn: () => void) => { fn(); ok++; console.log("  ok", nombre) }

const deuda = (x: Partial<ObligacionParaPeriodo>): ObligacionParaPeriodo => ({
  frecuenciaPago: "mensual", diasPago: "16", cuotaPeriodo: 400_000, cuotaBase: 400_000,
  pagadoEstePeriodo: false, montoPagadoEstePeriodo: null, montoAtrasado: 0,
  periodoActual: "2026-11", periodoSiguiente: "2026-12", montoAdelantado: null, ...x,
})

// Periodo del usuario: 14–28 nov (cobra el 14 y el 29)
const p1 = rango("2026-11-14", "2026-11-29")

t("vence en 2 días dentro del periodo: cuenta COMPLETA (antes la mitad)", () => {
  assert.equal(pendienteEnPeriodo(deuda({}), p1, d("2026-11-14")).monto, 400_000)
})
t("vence después del periodo (día 30): no cuenta", () => {
  assert.equal(pendienteEnPeriodo(deuda({ diasPago: "30" }), p1, d("2026-11-14")).monto, 0)
})
t("vencida el 5 sin pagar: cuenta y queda marcada", () => {
  const r = pendienteEnPeriodo(deuda({ diasPago: "5" }), p1, d("2026-11-14"))
  assert.equal(r.monto, 400_000); assert.equal(r.vencida, true)
})
t("pagada: no cuenta, abono parcial: cuenta lo que falta", () => {
  assert.equal(pendienteEnPeriodo(deuda({ pagadoEstePeriodo: true, montoPagadoEstePeriodo: 400_000 }), p1, d("2026-11-14")).monto, 0)
  assert.equal(pendienteEnPeriodo(deuda({ montoPagadoEstePeriodo: 150_000 }), p1, d("2026-11-14")).monto, 250_000)
})

// Periodo que cruza de mes: 29 nov – 13 dic
const p2 = rango("2026-11-29", "2026-12-14")
t("cruza de mes: la cuota del 5 de diciembre cuenta aunque noviembre esté pagado", () => {
  const r = pendienteEnPeriodo(deuda({ diasPago: "5", pagadoEstePeriodo: true, montoPagadoEstePeriodo: 400_000 }), p2, d("2026-11-29"))
  assert.equal(r.monto, 400_000); assert.equal(r.enPeriodo, true)
})
t("cruza de mes: si ya adelantó la de diciembre, no cuenta", () => {
  const r = pendienteEnPeriodo(deuda({ diasPago: "5", pagadoEstePeriodo: true, montoAdelantado: 400_000, proximaCuotaCubierta: true }), p2, d("2026-11-29"))
  assert.equal(r.monto, 0)
})
t("cruza de mes: noviembre sin pagar (vencida) + diciembre = las dos", () => {
  assert.equal(pendienteEnPeriodo(deuda({ diasPago: "5" }), p2, d("2026-11-29")).monto, 800_000)
})
t("ya en diciembre: cuenta la de diciembre más el atraso de noviembre", () => {
  const r = pendienteEnPeriodo(deuda({ diasPago: "5", periodoActual: "2026-12", periodoSiguiente: "2027-01", montoAtrasado: 400_000 }), p2, d("2026-12-02"))
  assert.equal(r.monto, 800_000)
})
t("gasto fijo mensual que vence el 1 de diciembre (fechaCorte con fecha)", () => {
  const fijo: ObligacionParaPeriodo = { frecuencia: "mensual", fechaCorte: "2026-08-01", monto: 90_000, pagadoEstePeriodo: true, periodoActual: "2026-11", periodoSiguiente: "2026-12" }
  assert.equal(pendienteEnPeriodo(fijo, p2, d("2026-11-29")).monto, 90_000)
})
t("deuda quincenal (15 y 30): la cuota de la quincena que vence en el periodo", () => {
  const q = deuda({ frecuenciaPago: "quincenal", diasPago: "15,30", cuotaPeriodo: 200_000, cuotaBase: 200_000, periodoActual: "2026-11-Q1", periodoSiguiente: "2026-11-Q2" })
  assert.equal(pendienteEnPeriodo(q, p1, d("2026-11-14")).monto, 0 + 200_000) // vence el 15 (Q1)
  const q2 = deuda({ frecuenciaPago: "quincenal", diasPago: "15,30", cuotaPeriodo: 200_000, cuotaBase: 200_000, periodoActual: "2026-11-Q1", periodoSiguiente: "2026-11-Q2", pagadoEstePeriodo: true })
  assert.equal(pendienteEnPeriodo(q2, p2, d("2026-11-29")).monto, 200_000) // la del 30 (Q2) cae en el periodo
})
t("obligación nueva que empieza el próximo periodo: solo cuenta cuando le llega", () => {
  const nueva = deuda({ diasPago: "5", pendienteProximoPeriodo: true, activoDesdePeriodo: "2026-12" })
  assert.equal(pendienteEnPeriodo(nueva, p1, d("2026-11-14")).monto, 0)
  assert.equal(pendienteEnPeriodo(nueva, p2, d("2026-11-29")).monto, 400_000)
  // y no se lista en "Este periodo" por la fecha de su periodo actual (aún no arranca)
  assert.equal(pendienteEnPeriodo(deuda({ diasPago: "20", pendienteProximoPeriodo: true, activoDesdePeriodo: "2026-12" }), p1, d("2026-11-14")).enPeriodo, false)
})

t("préstamo de Social: solo suma cuando su fecha llega al periodo", () => {
  const prestamo = { remainingAmount: 300_000, fechaCompromiso: "2027-01-14" }
  assert.equal(prestamoEnPeriodo(prestamo, rango("2026-11-14", "2026-11-29")), 0)
  assert.equal(prestamoEnPeriodo(prestamo, rango("2026-12-14", "2026-12-29")), 0)
  assert.equal(prestamoEnPeriodo(prestamo, rango("2027-01-14", "2027-01-29")), 300_000)
  assert.equal(prestamoEnPeriodo({ remainingAmount: 300_000, fechaCompromiso: "2026-11-02" }, rango("2026-11-14", "2026-11-29")), 300_000) // vencido
  assert.equal(prestamoEnPeriodo({ remainingAmount: 300_000 }, rango("2026-11-14", "2026-11-29")), 0) // sin fecha
})

console.log(`${ok} pruebas ok`)
