/**
 * Utilidades de exportación para Kiri Finance.
 * Genera archivos Excel (XLSX) y PDF desde los datos del Balance.
 *
 * Se importan dinámicamente para no inflar el bundle inicial.
 */

import type { BalanceReport } from '@/lib/api-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

// ─── Tipos para las filas de la tabla unificada ───────────────────────────────

interface TxRow {
  Fecha: string
  Tipo: string
  Descripción: string
  Categoría: string
  Monto: number
  'Monto (fmt)': string
}

function buildRows(report: BalanceReport): TxRow[] {
  const rows: TxRow[] = []

  // Gastos hormiga
  for (const e of report.impulseExpenses) {
    rows.push({
      Fecha: fmtDate(e.createdAt as string),
      Tipo: 'Gasto Hormiga',
      Descripción: e.nombre as string,
      Categoría: e.categoria as string,
      Monto: -(e.monto as number),
      'Monto (fmt)': `-${fmtMoney(e.monto as number)}`,
    })
  }

  // Ahorro
  for (const e of report.savingsHistory) {
    const isAhorro = (e.tipo as string) === 'ahorro'
    rows.push({
      Fecha: fmtDate(e.createdAt as string),
      Tipo: 'Ahorro',
      Descripción: isAhorro ? `Ahorro — ${e.periodo as string}` : `Sin ahorro — ${e.periodo as string}`,
      Categoría: 'Ahorro',
      Monto: isAhorro ? -(e.monto as number) : 0,
      'Monto (fmt)': isAhorro ? `-${fmtMoney(e.monto as number)}` : '—',
    })
  }

  // Ingresos extra
  for (const e of report.extraIncomes) {
    rows.push({
      Fecha: fmtDate(e.createdAt as string),
      Tipo: 'Ingreso Extra',
      Descripción: e.nombre as string,
      Categoría: e.temporalidad as string,
      Monto: e.monto as number,
      'Monto (fmt)': `+${fmtMoney(e.monto as number)}`,
    })
  }

  // Deudas pagadas
  for (const d of report.debts) {
    if (!(d.pagadoEstePeriodo as boolean)) continue
    rows.push({
      Fecha: fmtDate(d.updatedAt as string),
      Tipo: 'Deuda',
      Descripción: d.nombre as string,
      Categoría: 'Deuda',
      Monto: -(d.cuotaPeriodo as number),
      'Monto (fmt)': `-${fmtMoney(d.cuotaPeriodo as number)}`,
    })
  }

  // Gastos fijos pagados
  for (const f of report.fixedExpenses) {
    if (!(f.pagadoEstePeriodo as boolean)) continue
    rows.push({
      Fecha: fmtDate(f.updatedAt as string),
      Tipo: 'Gasto Fijo',
      Descripción: f.nombre as string,
      Categoría: 'Gasto Fijo',
      Monto: -(f.monto as number),
      'Monto (fmt)': `-${fmtMoney(f.monto as number)}`,
    })
  }

  // Orden cronológico descendente
  return rows.sort((a, b) =>
    new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime()
  )
}

// ─── Export Excel ─────────────────────────────────────────────────────────────

export async function exportToExcel(report: BalanceReport, filename = 'kiri-balance'): Promise<void> {
  const XLSX = await import('xlsx')
  const rows = buildRows(report)

  // Hoja 1 — Transacciones
  const wsData = [
    ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto'],
    ...rows.map(r => [r.Fecha, r.Tipo, r.Descripción, r.Categoría, r.Monto]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch: 14 }, { wch: 15 }, { wch: 35 }, { wch: 16 }, { wch: 14 }]

  // Hoja 2 — Resumen
  const s = report.summary
  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['Concepto', 'Valor'],
    ['Periodo', `${fmtDate(report.from)} — ${fmtDate(report.to)}`],
    ['Ingreso base', s.ingresoBase],
    ['Ingresos extra', s.totalExtra],
    ['Total ingresos', s.totalIngreso],
    ['', ''],
    ['Deudas pagadas', s.totalDebts],
    ['Gastos fijos pagados', s.totalFixed],
    ['Gastos hormiga', s.totalImpulse],
    ['Ahorro', s.totalSaved],
    ['Total egresos', s.totalEgreso],
    ['', ''],
    ['Balance neto', s.totalIngreso - s.totalEgreso],
  ])
  wsSummary['!cols'] = [{ wch: 24 }, { wch: 16 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')
  XLSX.utils.book_append_sheet(wb, ws, 'Transacciones')

  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─── Export PDF ───────────────────────────────────────────────────────────────

export async function exportToPdf(report: BalanceReport, filename = 'kiri-balance'): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const s = report.summary
  const PURPLE = [128, 150, 230] as [number, number, number]
  const MINT   = [185, 251, 192] as [number, number, number]

  // ── Encabezado ──
  doc.setFillColor(PURPLE[0], PURPLE[1], PURPLE[2])
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Kiri Finance — Balance', 14, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Periodo: ${fmtDate(report.from)} — ${fmtDate(report.to)}`, 14, 20)
  doc.text(`Generado: ${fmtDate(new Date().toISOString())}`, 14, 25)

  // ── Resumen en tarjetas ──
  doc.setTextColor(40, 40, 40)
  let y = 36

  const drawCard = (label: string, value: string, x: number, cardY: number, highlight = false) => {
    if (highlight) {
      doc.setFillColor(MINT[0], MINT[1], MINT[2])
    } else {
      doc.setFillColor(245, 245, 250)
    }
    doc.roundedRect(x, cardY, 55, 18, 3, 3, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 120)
    doc.text(label, x + 4, cardY + 6)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(highlight ? 20 : 40, highlight ? 80 : 40, highlight ? 40 : 60)
    doc.text(value, x + 4, cardY + 14)
  }

  drawCard('Total Ingresos', `$${fmtMoney(s.totalIngreso)}`, 14, y, true)
  drawCard('Total Egresos', `$${fmtMoney(s.totalEgreso)}`, 76, y)
  drawCard('Balance neto', `$${fmtMoney(s.totalIngreso - s.totalEgreso)}`, 138, y,
    s.totalIngreso >= s.totalEgreso)

  y += 24
  drawCard('Deudas', `$${fmtMoney(s.totalDebts)}`, 14, y)
  drawCard('Gastos Fijos', `$${fmtMoney(s.totalFixed)}`, 76, y)
  drawCard('Gastos Hormiga', `$${fmtMoney(s.totalImpulse)}`, 138, y)

  y += 26

  // ── Distribución por categoría ──
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Distribución de gastos', 14, y)
  y += 5

  const colors: Record<string, [number, number, number]> = {
    'Deudas':         [128, 150, 230],
    'Gastos Fijos':   [162, 210, 255],
    'Gastos Hormiga': [255, 179, 198],
    'Ahorro':         [185, 251, 192],
  }

  report.categoryDistribution.forEach((cat, i) => {
    const col = colors[cat.name] ?? [200, 200, 200] as [number, number, number]
    doc.setFillColor(col[0], col[1], col[2])
    doc.roundedRect(14 + (i % 2) * 95, y + Math.floor(i / 2) * 12, 87, 10, 2, 2, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 60)
    doc.text(`${cat.name}: $${fmtMoney(cat.value)}`, 18 + (i % 2) * 95, y + 6.5 + Math.floor(i / 2) * 12)
  })

  y += Math.ceil(report.categoryDistribution.length / 2) * 12 + 6

  // ── Tabla de transacciones ──
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Detalle de transacciones', 14, y)
  y += 3

  const rows = buildRows(report)

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto']],
    body: rows.map(r => [r.Fecha, r.Tipo, r.Descripción, r.Categoría, r['Monto (fmt)']]),
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: {
      fillColor: PURPLE,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 248, 255] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 24 },
      2: { cellWidth: 70 },
      3: { cellWidth: 28 },
      4: { cellWidth: 26, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  // ── Pie de página ──
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 180)
    doc.text(`Kiri Finance · Página ${i} de ${pageCount}`, 14, 292)
    doc.text('kirifinance.app', 180, 292)
  }

  doc.save(`${filename}.pdf`)
}
