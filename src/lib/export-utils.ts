/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Utilidades de Exportación (PDF)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Genera un PDF profesional con el Balance General del usuario.
 * Incluye:
 *   - Encabezado con logo y datos del periodo
 *   - KPIs principales
 *   - Gráficas nativas (dibujadas con los datos reales, no capturas de
 *     pantalla) — funcionan igual para el mes actual o cualquier mes pasado
 *   - Resumen de deudas (total, pagado, intereses)
 *   - Resumen de ahorros (bolsillos + progreso)
 *   - Registro de consumos (gastos hormiga) por categoría
 *   - Comparación vs mes anterior
 *   - Tabla de transacciones detallada
 *   - Resumen final del mes
 */

import type { BalanceReport } from '@/lib/api-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return String(iso) }
}

/** Todos los montos que vienen del backend pasan por acá — nunca un `as
 * number` a secas. Los campos Decimal de Prisma se serializan como STRING en
 * JSON; un `as number` es solo una promesa de TypeScript, no una conversión
 * real, así que sumarlos con `+` termina concatenando texto ("11300000" +
 * "4520000" → "114520000...") en vez de sumar. Esto ya se corrigió en el
 * backend para /reports/balance, pero esta función queda como resguardo. */
function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return typeof n === 'number' && !isNaN(n) ? n : 0
}

function fmtMoney(n: number): string {
  return `$${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num(n))}`
}

/** Versión compacta para ejes/etiquetas de gráficas donde el espacio es poco. */
function fmtCompact(n: number): string {
  const v = num(n)
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `$${Math.round(v / 1000)}K`
  return fmtMoney(v)
}

function fmtPct(n: number): string {
  const v = num(n)
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

/** Etiqueta legible del periodo real del reporte (report.from/report.to) —
 * nunca la fecha de hoy, que es solo cuándo se GENERÓ el PDF, no de qué mes
 * son los datos. */
function formatPeriodLabel(fromIso: string, toIso: string): string {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  // "all" empieza en el año 2000 — tratarlo como histórico, no como un rango real.
  if (from.getFullYear() <= 2000) return 'Todo el historial'

  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()
  if (sameMonth) return from.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const sameYear = from.getFullYear() === to.getFullYear()
  const fromLabel = from.toLocaleDateString('es-ES', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' })
  const toLabel = to.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return `${fromLabel} – ${toLabel}`
}

/** Une deudas/gastos fijos/hormiga/ingresos/ahorro en una sola lista, ordenada
 * por fecha desc — mismo criterio que el historial unificado de la app. */
function buildMovements(report: BalanceReport): { fecha: string; nombre: string; monto: number }[] {
  const rows: { fecha: string; nombre: string; monto: number }[] = []
  for (const p of (report.debtPayments ?? [])) {
    rows.push({ fecha: p.createdAt as string, nombre: (p.debtName as string) ?? 'Deuda', monto: -num(p.montoPagado) })
  }
  // Ledger real (fixedExpensePayments), acotado por el rango pedido — antes
  // usaba fixedExpenses.pagadoEstePeriodo, que siempre refleja el periodo
  // ACTUAL sin importar qué mes se esté exportando.
  for (const p of (report.fixedExpensePayments ?? [])) {
    rows.push({ fecha: p.createdAt as string, nombre: p.nombre as string, monto: -num(p.montoPagado) })
  }
  for (const e of report.impulseExpenses) {
    rows.push({ fecha: e.createdAt as string, nombre: e.nombre as string, monto: -num(e.monto) })
  }
  for (const r of (report.incomeRecords ?? [])) {
    rows.push({ fecha: r.createdAt as string, nombre: (r.tipo as string) === 'salario' ? 'Sueldo' : 'Ingreso extra', monto: num(r.monto) })
  }
  for (const sv of report.savingsHistory.filter(e => (e.tipo as string) === 'ahorro')) {
    rows.push({ fecha: sv.createdAt as string, nombre: `Ahorro — ${sv.periodo as string}`, monto: -num(sv.monto) })
  }
  // Retirar de un bolsillo devuelve dinero al saldo disponible — signo
  // positivo, como un ingreso (antes no dejaba ningún rastro en el PDF).
  for (const sv of report.savingsHistory.filter(e => (e.tipo as string) === 'retiro')) {
    rows.push({ fecha: sv.createdAt as string, nombre: `Retiro de ahorro — ${sv.periodo as string}`, monto: num(sv.monto) })
  }
  return rows.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}

// ─── Export PDF ───────────────────────────────────────────────────────────────

export async function exportToPdf(report: BalanceReport, filename = 'kiri-balance'): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const s = report.summary
  const pageWidth = 210
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  // Colores del brand
  const GREEN = [16, 185, 129] as [number, number, number]
  const DARK_GREEN = [10, 31, 20] as [number, number, number]
  const LIGHT_BG = [248, 250, 248] as [number, number, number]
  const RED = [239, 68, 68] as [number, number, number]
  const PURPLE = [99, 102, 241] as [number, number, number]
  const GRAY_LINE = [229, 231, 235] as [number, number, number]

  // Deuda + compromisos VIGENTES ahora mismo — a diferencia de s.totalDebts
  // (que es cuánto se ABONÓ a deudas dentro del periodo elegido, útil para
  // "cuánto gasté" pero engañoso en una tarjeta que dice "Obligaciones": un
  // mes sin abonos mostraba $0 aunque el usuario tuviera deudas activas por
  // millones, con la tabla de deudas justo debajo mostrándolas.
  const activeDebts = report.debts.filter(d => (d.estado as string) === 'activa')
  const totalDeudaActual = activeDebts.reduce((a, d) => a + num(d.saldoRestante), 0)
  const totalMontoOriginal = activeDebts.reduce((a, d) => a + num(d.montoTotal), 0)
  const totalFixedMensual = report.fixedExpenses.reduce((a, f) => a + num(f.monto), 0)
  const totalObligacionesActuales = totalDeudaActual + totalFixedMensual

  /** Título de sección con línea de acento — reemplaza los `doc.text` sueltos
   * repetidos para que cada bloque del reporte se vea igual. */
  const sectionTitle = (label: string, atY: number): number => {
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2])
    doc.rect(margin, atY - 3.2, 2.2, 4.2, 'F')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(label, margin + 5, atY)
    return atY + 5
  }

  const emptyState = (label: string, atY: number): number => {
    doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2])
    doc.roundedRect(margin, atY, contentWidth, 12, 2, 2, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(140, 140, 150)
    doc.text(label, margin + 4, atY + 7.5)
    return atY + 18
  }

  // ── Gráfica de evolución (barras ingresos vs egresos) dibujada con los
  // datos reales de monthlySeries — a diferencia de una captura de pantalla
  // (html2canvas), esto funciona igual para el mes actual que para cualquier
  // mes pasado exportado desde "Elegir meses", donde nunca hay nada en
  // pantalla para capturar.
  const drawEvolutionChart = (series: BalanceReport['monthlySeries'], atX: number, atY: number, w: number, h: number): number => {
    if (!series || series.length === 0) return emptyState('Sin datos suficientes para graficar.', atY)

    const maxVal = Math.max(1, ...series.flatMap(m => [m.ingresos, m.egresos]))
    const chartH = h
    const axisY = atY + chartH
    const n = series.length
    const groupW = w / n
    const barW = Math.min(6, groupW * 0.32)

    doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2])
    doc.line(atX, axisY, atX + w, axisY)

    // Línea guía + etiqueta del valor máximo, para dar escala a las barras.
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 160, 170)
    doc.text(fmtCompact(maxVal), atX, atY - 1)
    doc.setLineDashPattern([0.8, 0.8], 0)
    doc.setDrawColor(240, 240, 242)
    doc.line(atX, atY, atX + w, atY)
    doc.setLineDashPattern([], 0)

    series.forEach((m, i) => {
      const cx = atX + i * groupW + groupW / 2
      const hIn = Math.max(0, (m.ingresos / maxVal) * chartH)
      const hEg = Math.max(0, (m.egresos / maxVal) * chartH)
      doc.setFillColor(GREEN[0], GREEN[1], GREEN[2])
      doc.roundedRect(cx - barW - 0.6, axisY - hIn, barW, hIn, 0.6, 0.6, 'F')
      doc.setFillColor(RED[0], RED[1], RED[2])
      doc.roundedRect(cx + 0.6, axisY - hEg, barW, hEg, 0.6, 0.6, 'F')

      doc.setFontSize(6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 120, 130)
      const label = m.month.length > 6 ? m.month.slice(0, 6) : m.month
      doc.text(label, cx, axisY + 4, { align: 'center' })
    })

    // Leyenda
    const legendY = axisY + 9
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2])
    doc.rect(atX, legendY - 2.2, 2.6, 2.6, 'F')
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 90)
    doc.text('Ingresos', atX + 4, legendY)
    doc.setFillColor(RED[0], RED[1], RED[2])
    doc.rect(atX + 24, legendY - 2.2, 2.6, 2.6, 'F')
    doc.text('Egresos', atX + 28, legendY)

    return legendY + 6
  }

  // ── Gráfica de distribución por categoría (barras horizontales) — más
  // legible en un PDF que una dona, y no necesita ninguna librería de charts.
  const drawCategoryChart = (categories: BalanceReport['categoryDistribution'], atX: number, atY: number, w: number): number => {
    if (!categories || categories.length === 0) {
      return emptyState('Sin gastos registrados en este periodo para distribuir por categoría.', atY)
    }
    const total = categories.reduce((a, c) => a + num(c.value), 0) || 1
    const labelW = 32
    const valueW = 24
    const barMaxW = w - labelW - valueW - 4
    let rowY = atY

    categories.forEach(c => {
      const pct = num(c.value) / total
      const [r, g, b] = hexToRgb(c.color)

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 70)
      doc.text(c.name, atX, rowY + 3.6)

      doc.setFillColor(243, 244, 246)
      doc.roundedRect(atX + labelW, rowY, barMaxW, 4.4, 1, 1, 'F')
      doc.setFillColor(r, g, b)
      doc.roundedRect(atX + labelW, rowY, Math.max(2, barMaxW * pct), 4.4, 1, 1, 'F')

      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(40, 40, 50)
      doc.text(fmtCompact(c.value), atX + labelW + barMaxW + 3, rowY + 3.6)

      rowY += 7.5
    })

    return rowY + 4
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — Portada clara: KPIs + gráficos + movimientos recientes
  // ══════════════════════════════════════════════════════════════════════════

  const now = new Date()
  // El periodo del reporte es el de report.from/report.to, NUNCA la fecha de
  // hoy — antes la portada siempre decía el mes actual aunque se hubiera
  // exportado un mes pasado, o "Todo"/"Año", donde eso ni siquiera aplica.
  const periodLabel = formatPeriodLabel(report.from, report.to)

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, 297, 'F')

  // Franja superior de marca
  doc.setFillColor(DARK_GREEN[0], DARK_GREEN[1], DARK_GREEN[2])
  doc.rect(0, 0, pageWidth, 3, 'F')

  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2])
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('KIRI FINANCE', margin, 16)

  doc.setTextColor(20, 20, 20)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(`Balance · ${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}`, margin, 26)

  doc.setTextColor(120, 120, 120)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Reporte generado el ${now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, 32)

  let y = 42

  // ── 3 KPIs principales ──
  const coverKpis = [
    { label: 'Total recibido', value: s.totalIngreso, color: [17, 24, 39] as [number, number, number] },
    { label: 'Total gastado', value: s.totalEgreso, color: RED },
    { label: 'Ahorro del periodo', value: s.totalSaved, color: GREEN },
  ]
  const kpiWidth = (contentWidth - 6 * 2) / 3
  coverKpis.forEach((k, i) => {
    const x = margin + i * (kpiWidth + 6)
    doc.setFillColor(243, 244, 246)
    doc.roundedRect(x, y, kpiWidth, 18, 2.5, 2.5, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(k.label, x + 4, y + 7)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(k.color[0], k.color[1], k.color[2])
    doc.text(fmtMoney(k.value), x + 4, y + 14)
  })
  y += 26

  // ── Evolución del balance (gráfica real de ingresos vs egresos) ──
  y = sectionTitle('Evolución del balance', y)
  y = drawEvolutionChart(report.monthlySeries, margin, y + 4, contentWidth, 38) + 2

  // ── Distribución de gastos (gráfica real por categoría) ──
  y = sectionTitle('Distribución de gastos', y)
  y = drawCategoryChart(report.categoryDistribution, margin, y + 3, contentWidth) + 2

  // ── Movimientos del periodo (lista limpia, los 6 más recientes) ──
  y = sectionTitle('Movimientos del periodo', y)

  const recentMovements = buildMovements(report).slice(0, 6)
  if (recentMovements.length > 0) {
    doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2])
    doc.roundedRect(margin, y, contentWidth, recentMovements.length * 8, 2, 2, 'S')
    recentMovements.forEach((m, i) => {
      const rowY = y + i * 8
      if (i % 2 === 1) {
        doc.setFillColor(249, 250, 251)
        doc.rect(margin, rowY, contentWidth, 8, 'F')
      }
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(55, 65, 81)
      doc.text(`${fmtDate(m.fecha)} · ${m.nombre}`, margin + 4, rowY + 5.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(m.monto >= 0 ? GREEN[0] : RED[0], m.monto >= 0 ? GREEN[1] : RED[1], m.monto >= 0 ? GREEN[2] : RED[2])
      doc.text(`${m.monto >= 0 ? '+' : '-'}${fmtMoney(Math.abs(m.monto))}`, pageWidth - margin - 4, rowY + 5.5, { align: 'right' })
    })
    y += recentMovements.length * 8 + 8
  } else {
    y = emptyState('Sin movimientos en este periodo.', y)
  }

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(160, 160, 180)
  doc.text('El detalle completo de deudas, ahorros y transacciones sigue en las páginas siguientes →', margin, 275)

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINAS SIGUIENTES — mismo detalle exhaustivo que ya existía
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage()
  y = 20

  const balanceNeto = s.cashBalance
  const metrics = [
    { label: 'Saldo Neto', value: fmtMoney(balanceNeto), color: GREEN },
    { label: 'Ingresos del mes', value: fmtMoney(s.totalIngreso), color: GREEN },
    { label: 'Gastos del mes', value: fmtMoney(s.totalEgreso), color: RED },
    { label: 'Obligaciones', value: fmtMoney(totalObligacionesActuales), color: PURPLE },
    { label: 'Ahorros', value: fmtMoney(s.totalSaved), color: GREEN },
  ]

  const cardWidth = (pageWidth - margin * 2 - 4 * 3) / 5 // 5 cards con 3mm gap
  metrics.forEach((m, i) => {
    const x = margin + i * (cardWidth + 3)
    doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2])
    doc.roundedRect(x, y, cardWidth, 20, 2, 2, 'F')

    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 140)
    doc.text(m.label, x + 3, y + 6)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(m.color[0], m.color[1], m.color[2])
    doc.text(m.value, x + 3, y + 14)
  })

  y += 26

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMEN DE DEUDAS
  // ══════════════════════════════════════════════════════════════════════════

  y = sectionTitle('Resumen de deudas', y) + 1

  // Tabla de deudas
  const debtRows = activeDebts.map(d => [
    d.nombre as string,
    (d.acreedor as string) || '—',
    fmtMoney(num(d.montoTotal)),
    fmtMoney(num(d.saldoRestante)),
    d.tasaInteres ? `${num(d.tasaInteres).toFixed(2)}% M.V.` : '—',
    fmtMoney(num(d.cuotaPeriodo)),
  ])

  if (debtRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Obligación', 'Acreedor', 'Saldo total', 'Saldo restante', 'Interés', 'Cuota']],
      body: debtRows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: DARK_GREEN, textColor: 255, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 250, 248] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 28 },
        2: { cellWidth: 26, halign: 'right' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 24, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    })

    y = (doc as any).lastAutoTable.finalY + 4
  } else {
    y = emptyState('No hay deudas activas. ¡Felicidades!', y)
  }

  // Resumen de intereses — usa totalDeudaActual/totalMontoOriginal (ya
  // convertidos con num()) calculados arriba, en vez de volver a sumar los
  // campos crudos acá — esto es justo lo que antes producía "Saldo restante
  // $1.130.000.045.200.002.130.000" y "-42641511113962172% Pagado": sumar
  // con `+` un campo Decimal que llegaba como string concatenaba texto en
  // vez de sumar números, y ese número gigante sin sentido se colaba tanto
  // en el total como en el porcentaje calculado a partir de él.
  const pctPagado = totalMontoOriginal > 0
    ? Math.round(((totalMontoOriginal - totalDeudaActual) / totalMontoOriginal) * 100)
    : 0

  // Cards de intereses — "Interés evitado" es un cálculo real (motor de
  // amortización comparando el plan original vs el proyectado desde el saldo
  // actual), no una estimación — ver summary.interesEvitado en el backend.
  const interestCards = [
    { label: 'Total de deudas', value: fmtMoney(totalMontoOriginal) },
    { label: 'Saldo restante', value: fmtMoney(totalDeudaActual) },
    { label: `${pctPagado}% Pagado`, value: '' },
    { label: 'Interés evitado', value: fmtMoney(s.interesEvitado) },
    { label: 'Capital abonado este periodo', value: fmtMoney(s.totalCapitalAbonado) },
  ]

  const icWidth = (pageWidth - margin * 2 - 4 * 2) / 3
  const drawInterestCard = (c: { label: string; value: string }, x: number, rowY: number) => {
    doc.setFillColor(245, 250, 248)
    doc.roundedRect(x, rowY, icWidth, 12, 1.5, 1.5, 'F')
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 120)
    doc.text(c.label, x + 3, rowY + 5)
    if (c.value) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(40, 40, 60)
      doc.text(c.value, x + 3, rowY + 10)
    }
  }
  interestCards.slice(0, 3).forEach((c, i) => drawInterestCard(c, margin + i * (icWidth + 2), y))
  y += 14
  interestCards.slice(3, 5).forEach((c, i) => drawInterestCard(c, margin + i * (icWidth + 2), y))
  y += 18

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMEN DE AHORROS
  // ══════════════════════════════════════════════════════════════════════════

  if (y > 250) { doc.addPage(); y = 20 }

  y = sectionTitle('Resumen de ahorros', y) + 1

  const savingsRows = report.savingsHistory
    .filter(e => (e.tipo as string) === 'ahorro')
    .map(e => [
      e.periodo as string,
      fmtMoney(num(e.monto)),
      fmtDate(e.createdAt as string),
    ])

  if (savingsRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Periodo', 'Monto ahorrado', 'Fecha']],
      body: savingsRows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 255, 250] },
      margin: { left: margin, right: margin },
      tableWidth: 120,
    })
    y = (doc as any).lastAutoTable.finalY + 6
  } else {
    y = emptyState('Sin registros de ahorro en este periodo.', y)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REGISTRO DE CONSUMOS (gastos hormiga) — por categoría
  // ══════════════════════════════════════════════════════════════════════════

  if (y > 235) { doc.addPage(); y = 20 }

  y = sectionTitle('Registro de consumos', y) + 1
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(140, 140, 150)
  doc.text('Gastos hormiga registrados en el periodo, el tipo de compra que más se siente al final del mes.', margin, y)
  y += 5

  if (report.impulseExpenses.length > 0) {
    const totalHormiga = report.impulseExpenses.reduce((a, e) => a + num(e.monto), 0)
    const porCategoria = new Map<string, number>()
    for (const e of report.impulseExpenses) {
      const cat = (e.categoria as string) || 'otro'
      porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + num(e.monto))
    }

    // Mini resumen: total + categoría más frecuente, antes de la tabla.
    const topCategoria = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0]
    doc.setFillColor(255, 247, 237)
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 83, 9)
    doc.text(`Total en gastos hormiga: ${fmtMoney(totalHormiga)}`, margin + 4, y + 6.5)
    if (topCategoria) {
      doc.setFont('helvetica', 'normal')
      doc.text(`Categoría más frecuente: ${topCategoria[0]}`, margin + contentWidth / 2, y + 6.5)
    }
    y += 14

    const consumoRows = report.impulseExpenses
      .slice()
      .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
      .slice(0, 20)
      .map(e => [
        fmtDate(e.createdAt as string),
        e.nombre as string,
        (e.categoria as string) || 'otro',
        fmtMoney(num(e.monto)),
      ])

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Consumo', 'Categoría', 'Monto']],
      body: consumoRows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [255, 179, 198], textColor: [90, 30, 45], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 248, 250] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 70 },
        2: { cellWidth: 34 },
        3: { cellWidth: 28, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  } else {
    y = emptyState('Sin gastos hormiga registrados en este periodo. ¡Buen control!', y)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPARACIÓN VS MES ANTERIOR
  // ══════════════════════════════════════════════════════════════════════════

  // Verificar si hay más de un mes de data
  if (report.monthlySeries && report.monthlySeries.length >= 2) {
    const current = report.monthlySeries[report.monthlySeries.length - 1]
    const previous = report.monthlySeries[report.monthlySeries.length - 2]

    if (y > 240) { doc.addPage(); y = 20 }

    y = sectionTitle('Comparación vs mes anterior', y) + 1

    const compData = [
      { label: 'Ingresos', current: current.ingresos, previous: previous.ingresos },
      { label: 'Egresos', current: current.egresos, previous: previous.egresos },
      { label: 'Balance', current: current.ingresos - current.egresos, previous: previous.ingresos - previous.egresos },
    ]

    autoTable(doc, {
      startY: y,
      head: [['Concepto', 'Mes actual', 'Mes anterior', 'Variación']],
      body: compData.map(c => {
        const variation = previous.ingresos > 0 || previous.egresos > 0
          ? ((c.current - c.previous) / Math.max(Math.abs(c.previous), 1)) * 100
          : 0
        return [
          c.label,
          fmtMoney(c.current),
          fmtMoney(c.previous),
          fmtPct(variation),
        ]
      }),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: PURPLE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 255] },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 35, halign: 'right' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 30, halign: 'center' },
      },
      margin: { left: margin, right: margin },
      tableWidth: 140,
    })

    y = (doc as any).lastAutoTable.finalY + 6
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TABLA DE TRANSACCIONES
  // ══════════════════════════════════════════════════════════════════════════

  if (y > 230) { doc.addPage(); y = 20 }

  y = sectionTitle('Detalle de transacciones', y) + 1

  const txRows: string[][] = []

  // Income records
  for (const r of (report.incomeRecords ?? [])) {
    txRows.push([
      fmtDate(r.createdAt as string),
      (r.tipo as string) === 'salario' ? 'Sueldo' : 'Ingreso Extra',
      (r.tipo as string) === 'salario' ? 'Salario registrado' : 'Ingreso extra',
      `+${fmtMoney(num(r.monto))}`,
    ])
  }

  // Debt payments
  for (const p of (report.debtPayments ?? [])) {
    txRows.push([
      fmtDate(p.createdAt as string),
      'Pago deuda',
      `${p.debtName ?? 'Deuda'} (Capital: ${fmtMoney(num(p.abonoCapital))}, Interés: ${fmtMoney(num(p.pagoInteres))})`,
      `-${fmtMoney(num(p.montoPagado))}`,
    ])
  }

  // Fixed expenses paid — ledger real (fixedExpensePayments), acotado por el
  // rango pedido, no fixedExpenses.pagadoEstePeriodo (siempre el mes actual).
  for (const p of (report.fixedExpensePayments ?? [])) {
    txRows.push([
      fmtDate(p.createdAt as string),
      'Gasto fijo',
      p.nombre as string,
      `-${fmtMoney(num(p.montoPagado))}`,
    ])
  }

  // Impulse expenses (top 15)
  for (const e of report.impulseExpenses.slice(0, 15)) {
    txRows.push([
      fmtDate(e.createdAt as string),
      'Gasto hormiga',
      `${e.nombre as string} (${e.categoria as string})`,
      `-${fmtMoney(num(e.monto))}`,
    ])
  }

  // Ordenar por fecha
  txRows.sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())

  if (txRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Tipo', 'Descripción', 'Monto']],
      body: txRows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: DARK_GREEN, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 248] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 24 },
        2: { cellWidth: 90 },
        3: { cellWidth: 28, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    })

    y = (doc as any).lastAutoTable.finalY + 6
  } else {
    y = emptyState('Sin transacciones registradas en este periodo.', y)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMEN FINAL DEL MES
  // ══════════════════════════════════════════════════════════════════════════

  if (y > 255) { doc.addPage(); y = 20 }

  // Banner verde
  doc.setFillColor(245, 255, 250)
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2])
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 3, 3, 'FD')

  // Ícono dibujado (barras) en vez de un emoji — las fuentes estándar de
  // jsPDF (Helvetica/Times/Courier) no tienen glyphs para emoji Unicode: al
  // pedirle que dibuje "📊" el resultado es texto ilegible tipo "Ø=ÜÊ", y
  // además desalinea el espaciado de TODO el texto que sigue en esa misma
  // línea (visible en el PDF exportado como "T u   s a l d o   n e t o...").
  const iconX = margin + 5
  const iconY = y + 7
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2])
  doc.rect(iconX, iconY - 3, 1.4, 3, 'F')
  doc.rect(iconX + 2, iconY - 5, 1.4, 5, 'F')
  doc.rect(iconX + 4, iconY - 2, 1.4, 2, 'F')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_GREEN[0], DARK_GREEN[1], DARK_GREEN[2])
  doc.text('Resumen del mes', iconX + 8, y + 7)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 100, 80)

  const balanceChange = s.totalIngreso - s.totalEgreso
  const balanceMsg = balanceChange >= 0
    ? `Tu saldo neto aumentó ${fmtMoney(balanceChange)}. ¡Vas por buen camino!`
    : `Tu saldo neto disminuyó ${fmtMoney(Math.abs(balanceChange))}. Revisa tus gastos para el próximo mes.`
  doc.text(balanceMsg, margin + 5, y + 13)

  // Mini stats en el banner
  const statsY = y + 17
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2])
  doc.text(`Ahorrado: ${fmtMoney(s.totalSaved)}`, margin + 5, statsY)

  doc.setTextColor(RED[0], RED[1], RED[2])
  doc.text(`Interés pagado: ${fmtMoney(s.totalInteresPagado)}`, margin + 55, statsY)

  doc.setTextColor(PURPLE[0], PURPLE[1], PURPLE[2])
  doc.text(`Capital abonado: ${fmtMoney(s.totalCapitalAbonado)}`, margin + 110, statsY)

  // ── Pie de página en todas las páginas ──
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 180)
    doc.text('Este reporte fue generado automáticamente por Kiri Finance.', pageWidth / 2, 286, { align: 'center' })
    doc.text('Cuida tu dinero, cultiva tu tranquilidad.', pageWidth / 2, 290, { align: 'center' })
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, 290, { align: 'right' })
  }

  doc.save(`${filename}.pdf`)
}

// ─── Export Excel (deprecated — mantenido para compatibilidad) ─────────────────

export async function exportToExcel(report: BalanceReport, filename = 'kiri-balance'): Promise<void> {
  // Redirigir a PDF
  await exportToPdf(report, filename)
}
