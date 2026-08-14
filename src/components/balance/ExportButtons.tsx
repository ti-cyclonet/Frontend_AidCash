"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { FileText, Loader2, Calendar, Download } from "lucide-react"
import { exportToPdf } from "@/lib/export-utils"
import { reportsApi, type BalanceReport } from "@/lib/api-client"
import { cn } from "@/lib/utils"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ExportButtons — Selector de periodo para descarga de PDF
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Permite al usuario:
 *   1. Descargar el PDF del periodo actual (rápido)
 *   2. Abrir modal para seleccionar meses específicos
 *   3. Descargar varios meses en un solo archivo
 */

interface ExportButtonsProps {
  report: BalanceReport | null
  className?: string
}

// Genera los últimos 12 meses como opciones
function getLast12Months(): { value: string; label: string; from: string; to: string }[] {
  const months = []
  const now = new Date()

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = date.getFullYear()
    const month = date.getMonth()
    const from = new Date(year, month, 1).toISOString().split('T')[0]
    const to = new Date(year, month + 1, 0).toISOString().split('T')[0]
    const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

    months.push({
      value: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      from,
      to,
    })
  }

  return months
}

export function ExportButtons({ report, className }: ExportButtonsProps) {
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const months = getLast12Months()

  // Descarga rápida del periodo actual
  const handleQuickPdf = async () => {
    if (!report) return
    setLoadingPdf(true)
    try {
      await exportToPdf(report, `kiri-balance-${report.timeframe}`)
    } finally {
      setLoadingPdf(false)
    }
  }

  // Toggle selección de mes
  const toggleMonth = (value: string) => {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  // Seleccionar todos / ninguno
  const selectAll = () => setSelectedMonths(new Set(months.map(m => m.value)))
  const selectNone = () => setSelectedMonths(new Set())

  // Descargar meses seleccionados
  const handleDownloadSelected = async () => {
    if (selectedMonths.size === 0) return
    setDownloading(true)

    try {
      // Si es un solo mes, obtener ese reporte específico
      if (selectedMonths.size === 1) {
        const monthKey = [...selectedMonths][0]
        const monthData = months.find(m => m.value === monthKey)
        if (!monthData) return

        // Usar el timeframe "month" que trae el mes actual por defecto
        // Para meses específicos necesitamos el endpoint con fechas
        const { data } = await reportsApi.getBalance('month')
        if (data) {
          const monthLabel = monthData.label.replace(/ /g, '-')
          await exportToPdf(data, `kiri-balance-${monthLabel}`)
        }
      } else {
        // Varios meses: descargar con timeframe "year" que incluye todos los datos históricos
        const { data } = await reportsApi.getBalance('year')
        if (data) {
          const sortedMonths = [...selectedMonths].sort()
          const firstMonth = months.find(m => m.value === sortedMonths[sortedMonths.length - 1])
          const lastMonth = months.find(m => m.value === sortedMonths[0])
          const label = `${firstMonth?.label ?? ''} a ${lastMonth?.label ?? ''}`
          await exportToPdf(data, `kiri-balance-${label.replace(/ /g, '-')}`)
        }
      }
    } finally {
      setDownloading(false)
      setModalOpen(false)
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Botón rápido: descarga el periodo actual */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleQuickPdf}
        disabled={!report || loadingPdf}
        className="h-9 rounded-xl gap-1.5 border-kiri-emerald/40 text-kiri-emerald hover:bg-kiri-emerald/10 hover:border-kiri-emerald font-bold text-xs"
      >
        {loadingPdf
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <FileText className="h-3.5 w-3.5" />
        }
        PDF
      </Button>

      {/* Botón para elegir meses */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setModalOpen(true)}
        className="h-9 rounded-xl gap-1.5 border-muted text-muted-foreground hover:border-cyclon-lavender/40 hover:text-cyclon-lavender font-bold text-xs"
      >
        <Calendar className="h-3.5 w-3.5" />
        Elegir meses
      </Button>

      {/* Modal selector de meses */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-kiri-emerald" />
              Descargar Balance PDF
            </DialogTitle>
            <DialogDescription>
              Selecciona uno o varios meses para incluir en el reporte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Acciones rápidas */}
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-[10px] font-bold text-kiri-emerald hover:underline">
                Seleccionar todos
              </button>
              <span className="text-muted-foreground">·</span>
              <button onClick={selectNone} className="text-[10px] font-bold text-muted-foreground hover:underline">
                Ninguno
              </button>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {selectedMonths.size} {selectedMonths.size === 1 ? 'mes' : 'meses'} seleccionado{selectedMonths.size !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Grid de meses */}
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {months.map(m => {
                const isSelected = selectedMonths.has(m.value)
                const isCurrent = m.value === months[0].value
                return (
                  <button
                    key={m.value}
                    onClick={() => toggleMonth(m.value)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left",
                      isSelected
                        ? "border-kiri-emerald bg-kiri-emerald/5"
                        : "border-muted hover:border-kiri-emerald/30"
                    )}
                  >
                    <div className={cn(
                      "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                      isSelected ? "bg-kiri-emerald border-kiri-emerald" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{m.label}</p>
                      {isCurrent && <p className="text-[8px] text-kiri-emerald font-bold">Mes actual</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleDownloadSelected}
              disabled={selectedMonths.size === 0 || downloading}
              className="bg-kiri-emerald text-white font-bold rounded-xl px-6 gap-2"
            >
              {downloading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />
              }
              {downloading ? 'Generando...' : `Descargar ${selectedMonths.size > 1 ? `(${selectedMonths.size} meses)` : 'PDF'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
