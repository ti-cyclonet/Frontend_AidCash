/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Utilidades de Exportación (PDF)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Genera un PDF profesional con el Balance General del usuario.
 * Incluye:
 *   - Encabezado con logo y datos del periodo
 *   - 5 tarjetas métricas principales
 *   - Resumen de deudas (total, pagado, intereses)
 *   - Resumen de ahorros (bolsillos + progreso)
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

function fmtMoney(n: number): string {
  return `$${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

// ─── Export PDF ───────────────────────────────────────────────────────────────

export async function exportToPdf(report: BalanceReport, filename = 'kiri-balance'): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const s = report.summary
  const pageWidth = 210
  const margin = 14

  // Colores del brand
  const GREEN = [16, 185, 129] as [number, number, number]
  const DARK_GREEN = [10, 31, 20] as [number, number, number]
  const LIGHT_BG = [248, 250, 248] as [number, number, number]
  const RED = [239, 68, 68] as [number, number, number]
  const PURPLE = [99, 102, 241] as [number, number, number]

  // ══════════════════════════════════════════════════════════════════════════
  // ENCABEZADO
  // ══════════════════════════════════════════════════════════════════════════

  doc.setFillColor(DARK_GREEN[0], DARK_GREEN[1], DARK_GREEN[2])
  doc.rect(0, 0, pageWidth, 32, 'F')

  // Logo texto
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2])
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('🌱 Kiri Finance', margin, 12)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 220, 200)
  doc.text('Tu dinero, tu futuro, tu equilibrio.', margin, 17)

  // Título central
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Balance General', pageWidth / 2, 12, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Resumen completo de tu salud financiera', pageWidth / 2, 18, { align: 'center' })

  // Info derecha
  doc.setFontSize(7)
  doc.setTextColor(180, 220, 200)
  const now = new Date()
  doc.text(`Fecha: ${now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - margin, 10, { align: 'right' })
  doc.text(`Periodo: ${fmtDate(report.from)} — ${fmtDate(report.to)}`, pageWidth - margin, 15, { align: 'right' })
  doc.text(`Hora: ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 20, { align: 'right' })

  let y = 38

  // ══════════════════════════════════════════════════════════════════════════
  // 5 TARJETAS MÉTRICAS
  // ══════════════════════════════════════════════════════════════════════════

  const balanceNeto = s.cashBalance
  const metrics = [
    { label: 'Saldo Neto', value: fmtMoney(balanceNeto), color: GREEN },
    { label: 'Ingresos del mes', value: fmtMoney(s.totalIngreso), color: GREEN },
    { label: 'Gastos del mes', value: fmtMoney(s.totalEgreso), color: RED },
    { label: 'Obligaciones', value: fmtMoney(s.totalDebts + s.totalFixed), color: PURPLE },
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

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Resumen de deudas', margin, y)
  y += 5

  // Tabla de deudas
  const debtRows = report.debts
    .filter(d => (d.estado as string) === 'activa')
    .map(d => [
      d.nombre as string,
      d.acreedor as string || '—',
      fmtMoney(d.montoTotal as number),
      fmtMoney(d.saldoRestante as number),
      d.tasaInteres ? `${Number(d.tasaInteres).toFixed(2)}% M.V.` : '—',
      fmtMoney(d.cuotaPeriodo as number),
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
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text('No hay deudas activas. ¡Felicidades!', margin, y + 4)
    y += 10
  }

  // Resumen de intereses
  const totalDeuda = report.debts.filter(d => (d.estado as string) === 'activa').reduce((a, d) => a + (d.saldoRestante as number), 0)
  const totalInteresEstimado = report.debts
    .filter(d => (d.estado as string) === 'activa' && d.tasaInteres)
    .reduce((a, d) => a + ((d.saldoRestante as number) * (Number(d.tasaInteres) / 100)), 0)
  const interesAhorrado = s.totalCapitalAbonado > 0 ? Math.round(s.totalCapitalAbonado * 0.03) : 0
  const pctPagado = report.debts.length > 0
    ? Math.round(((report.debts.reduce((a, d) => a + (d.montoTotal as number), 0) - totalDeuda) / Math.max(1, report.debts.reduce((a, d) => a + (d.montoTotal as number), 0))) * 100)
    : 0

  // Cards de intereses
  const interestCards = [
    { label: 'Total de deudas', value: fmtMoney(report.debts.reduce((a, d) => a + (d.montoTotal as number), 0)) },
    { label: 'Saldo restante', value: fmtMoney(totalDeuda) },
    { label: `${pctPagado}% Pagado`, value: '' },
    { label: 'Interés mensual estimado', value: fmtMoney(Math.round(totalInteresEstimado)) },
    { label: 'Capital abonado este periodo', value: fmtMoney(s.totalCapitalAbonado) },
  ]

  const icWidth = (pageWidth - margin * 2 - 4 * 2) / 3
  interestCards.slice(0, 3).forEach((c, i) => {
    const x = margin + i * (icWidth + 2)
    doc.setFillColor(245, 250, 248)
    doc.roundedRect(x, y, icWidth, 12, 1.5, 1.5, 'F')
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 120)
    doc.text(c.label, x + 3, y + 5)
    if (c.value) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(40, 40, 60)
      doc.text(c.value, x + 3, y + 10)
    }
  })
  y += 16

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMEN DE AHORROS
  // ══════════════════════════════════════════════════════════════════════════

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Resumen de ahorros', margin, y)
  y += 5

  const savingsRows = report.savingsHistory
    .filter(e => (e.tipo as string) === 'ahorro')
    .map(e => [
      e.periodo as string,
      fmtMoney(e.monto as number),
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
    y = (doc as any).lastAutoTable.finalY + 4
  } else {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text('Sin registros de ahorro en este periodo.', margin, y + 4)
    y += 10
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPARACIÓN VS MES ANTERIOR
  // ══════════════════════════════════════════════════════════════════════════

  // Verificar si hay más de un mes de data
  if (report.monthlySeries && report.monthlySeries.length >= 2) {
    const current = report.monthlySeries[report.monthlySeries.length - 1]
    const previous = report.monthlySeries[report.monthlySeries.length - 2]

    if (y > 240) { doc.addPage(); y = 20 }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text('Comparación vs mes anterior', margin, y)
    y += 6

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

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Detalle de transacciones', margin, y)
  y += 4

  const txRows: string[][] = []

  // Income records
  for (const r of (report.incomeRecords ?? [])) {
    txRows.push([
      fmtDate(r.createdAt as string),
      (r.tipo as string) === 'salario' ? 'Sueldo' : 'Ingreso Extra',
      (r.tipo as string) === 'salario' ? 'Salario registrado' : 'Ingreso extra',
      `+${fmtMoney(r.monto as number)}`,
    ])
  }

  // Debt payments
  for (const p of (report.debtPayments ?? [])) {
    txRows.push([
      fmtDate(p.createdAt as string),
      'Pago deuda',
      `${p.debtName ?? 'Deuda'} (Capital: ${fmtMoney(p.abonoCapital as number)}, Interés: ${fmtMoney(p.pagoInteres as number)})`,
      `-${fmtMoney(p.montoPagado as number)}`,
    ])
  }

  // Fixed expenses paid
  for (const f of report.fixedExpenses.filter(f => f.pagadoEstePeriodo as boolean)) {
    txRows.push([
      fmtDate(f.updatedAt as string),
      'Gasto fijo',
      f.nombre as string,
      `-${fmtMoney((f as any).montoPagadoEstePeriodo ?? (f.monto as number))}`,
    ])
  }

  // Impulse expenses (top 15)
  for (const e of report.impulseExpenses.slice(0, 15)) {
    txRows.push([
      fmtDate(e.createdAt as string),
      'Gasto hormiga',
      `${e.nombre as string} (${e.categoria as string})`,
      `-${fmtMoney(e.monto as number)}`,
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
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMEN FINAL DEL MES
  // ══════════════════════════════════════════════════════════════════════════

  if (y > 255) { doc.addPage(); y = 20 }

  // Banner verde
  doc.setFillColor(245, 255, 250)
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2])
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 3, 3, 'FD')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_GREEN[0], DARK_GREEN[1], DARK_GREEN[2])
  doc.text('📊 Resumen del mes', margin + 5, y + 7)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 100, 80)

  const balanceChange = s.totalIngreso - s.totalEgreso
  const balanceMsg = balanceChange >= 0
    ? `Tu saldo neto aumentó ${fmtMoney(balanceChange)}. ¡Vas por buen camino! 💚`
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
