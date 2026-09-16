/**
 * Próxima fecha de pago inteligente para una obligación (deuda o gasto fijo).
 * Ambos comparten el mismo formato de "días de pago" ("15" o "15,30"), así que
 * una sola función sirve para Debt.diasPago y FixedExpense.fechaCorte.
 */
export interface NextPaymentInfo {
  nextDate: string
  daysUntil: number
  status: 'pagado' | 'proximo' | 'pendiente' | 'vencido'
  statusLabel: string
  statusColor: string
  cardRing: string
}

/** Construye una fecha para el día N de un mes, recortando al último día real
 * si N no existe ese mes (ej. día 31 en septiembre, que solo tiene 30). */
function dateForDay(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDayOfMonth))
}

export function getNextPaymentInfo(diasPago: string, pagadoEstePeriodo: boolean, isQuincenal = false, pendienteProximoPeriodo = false): NextPaymentInfo {
  const today = new Date()
  const todayDay = today.getDate()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const days = diasPago.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 1 && d <= 31)
  if (days.length === 0) days.push(1)

  // Obligación marcada al crearla como "nueva, empieza el próximo periodo"
  // (ver activoDesdePeriodo en el backend) — el día de pago pudo caer antes de
  // hoy en el calendario, pero esta obligación todavía no le aplica a este
  // mes: no es "vencida" ni "pagada", es simplemente "pendiente" con su
  // primer cobro real más adelante. Se revisa ANTES que pagadoEstePeriodo:
  // si el usuario terminó pagando igual este periodo, ese pago real manda.
  if (pendienteProximoPeriodo && !pagadoEstePeriodo) {
    const day = Math.min(...days)
    const label = dateForDay(currentYear, currentMonth + 1, day).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    return { nextDate: label, daysUntil: 999, status: 'pendiente', statusLabel: 'Pendiente', statusColor: 'text-muted-foreground', cardRing: '' }
  }

  if (pagadoEstePeriodo) {
    // Quincenal son DOS cuotas independientes por mes (ej. "10,25") — si ya se
    // pagó la que le tocaba a hoy pero la otra sigue por delante este mismo
    // mes, esa es la próxima. Antes esto siempre saltaba un mes completo (ej.
    // pagar el día 10 hacía que el día 25 del MISMO mes desapareciera y el
    // "próximo cobro" se fuera directo a octubre).
    // Esta rama SOLO aplica a quincenales: uno mensual tiene un único día en
    // `days`, así que "el próximo día > hoy" es SIEMPRE el mismo día que ya se
    // pagó este periodo — sin este guard, una obligación mensual ya pagada
    // volvía a mostrarse como "Pendiente"/"Vence en Xd" en vez de "Pagado ✓".
    const upcomingThisMonth = isQuincenal ? days.filter(d => d > todayDay) : []
    if (upcomingThisMonth.length > 0) {
      const day = Math.min(...upcomingThisMonth)
      const daysUntil = day - todayDay
      const label = dateForDay(currentYear, currentMonth, day).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
      if (daysUntil <= 3) return { nextDate: label, daysUntil, status: 'proximo', statusLabel: daysUntil === 0 ? 'Vence hoy' : `Vence en ${daysUntil}d`, statusColor: 'text-amber-600', cardRing: 'ring-1 ring-amber-400/40' }
      return { nextDate: label, daysUntil, status: 'pendiente', statusLabel: 'Pendiente', statusColor: 'text-muted-foreground', cardRing: '' }
    }
    const nextDate = dateForDay(currentYear, currentMonth + 1, Math.min(...days))
    const label = nextDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    return { nextDate: label, daysUntil: 999, status: 'pagado', statusLabel: 'Pagado ✓', statusColor: 'text-emerald-600', cardRing: '' }
  }

  // Comparación por NÚMERO de día, no por Date con hora — comparar `today` (con
  // hora actual) contra una fecha construida a medianoche descartaba el día de
  // hoy en cuanto pasaba la medianoche, así que "Vence hoy"/"Vencido" nunca se
  // disparaban en la práctica.
  const upcoming = days.filter(d => d >= todayDay)
  if (upcoming.length > 0) {
    const day = Math.min(...upcoming)
    const daysUntil = day - todayDay
    const label = dateForDay(currentYear, currentMonth, day).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    if (daysUntil <= 3) return { nextDate: label, daysUntil, status: 'proximo', statusLabel: daysUntil === 0 ? 'Vence hoy' : `Vence en ${daysUntil}d`, statusColor: 'text-amber-600', cardRing: 'ring-1 ring-amber-400/40' }
    return { nextDate: label, daysUntil, status: 'pendiente', statusLabel: 'Pendiente', statusColor: 'text-muted-foreground', cardRing: '' }
  }

  // Todos los días de este ítem ya pasaron este mes y sigue sin pagar → vencida.
  const mostRecentDay = Math.max(...days)
  const daysUntil = mostRecentDay - todayDay
  const label = dateForDay(currentYear, currentMonth, mostRecentDay).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  return { nextDate: label, daysUntil, status: 'vencido', statusLabel: `Vencido (${Math.abs(daysUntil)}d)`, statusColor: 'text-red-500', cardRing: 'ring-1 ring-red-500/40' }
}
