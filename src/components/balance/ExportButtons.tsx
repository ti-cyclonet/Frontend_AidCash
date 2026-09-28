"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { FileText, Loader2, Download, Lock } from "lucide-react"
import { usePlan } from "@/lib/plan-context"
import { exportToPdf } from "@/lib/export-utils"
import { reportsApi } from "@/lib/api-client"
import { cn } from "@/lib/utils"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ExportButtons — Selector de periodo para descarga de PDF
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * El botón "PDF" abre SIEMPRE el selector de meses y solo descarga después
 * de elegir uno o varios (antes descargaba de una vez el periodo en pantalla
 * y el selector estaba en un botón aparte). Varios meses van en un solo archivo.
 *
 * Las gráficas del PDF se dibujan con los datos reales del reporte (ver
 * export-utils.ts) en vez de capturar con html2canvas los gráficos ya
 * renderizados en pantalla — así funcionan igual para el periodo actual que
 * para cualquier mes pasado elegido en "Elegir meses", donde nunca hay nada
 * en pantalla que capturar.
 */

interface ExportButtonsProps {
  className?: string
}

/** "AAAA-MM-DD" con la fecha LOCAL (toISOString la pasa a UTC y puede correr un día). */
function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Genera los últimos meses como opciones (hasta 12, o lo que guarde el plan si es menos)
function getLastMonths(n = 12): { value: string; label: string; from: string; to: string }[] {
  const months = []
  const now = new Date()

  for (let i = 0; i < n; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = date.getFullYear()
    const month = date.getMonth()
    const from = ymdLocal(new Date(year, month, 1))
    const to = ymdLocal(new Date(year, month + 1, 0))
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

export function ExportButtons({ className }: ExportButtonsProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  // Los reportes PDF son de KIRI PLUS en adelante
  const { hasFeature, limite } = usePlan()
  const puedePdf = hasFeature("advancedReports")

  const months = getLastMonths(Math.max(1, Math.min(12, limite("mesesHistorial") ?? 12)))

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

  // Descargar meses seleccionados — antes esto SIEMPRE traía el mes/año
  // calendario ACTUAL sin importar qué mes(es) se hubieran marcado (nunca se
  // le mandaban al backend los `from`/`to` que este mismo componente ya
  // calculaba en getLast12Months). Ahora sí se piden con timeframe=custom.
  const handleDownloadSelected = async () => {
    if (selectedMonths.size === 0) return
    setDownloading(true)

    try {
      const sortedMonths = [...selectedMonths].sort()
      const earliest = months.find(m => m.value === sortedMonths[0])
      const latest = months.find(m => m.value === sortedMonths[sortedMonths.length - 1])
      if (!earliest || !latest) return

      // El rango real cubre desde el primer día del mes más antiguo elegido
      // hasta el último día del más reciente — funciona igual para uno o
      // varios meses, incluso si no son consecutivos.
      const { data } = await reportsApi.getBalance('custom', { from: earliest.from, to: latest.to })
      if (data) {
        const label = selectedMonths.size === 1
          ? latest.label.replace(/ /g, '-')
          : `${earliest.label.replace(/ /g, '-')}-a-${latest.label.replace(/ /g, '-')}`
        await exportToPdf(data, `kiri-balance-${label}`)
      }
    } finally {
      setDownloading(false)
      setModalOpen(false)
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Abre el selector de meses; la descarga ocurre desde el modal */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => puedePdf
          ? setModalOpen(true)
          : window.dispatchEvent(new CustomEvent("kiri:limite", { detail: {
              codigo: "FUNCION", mensaje: "Descargar tu balance en PDF es parte de KIRI PLUS.", mejora: { plan: "KIRI PLUS" },
            } }))}
        className="h-9 rounded-xl gap-1.5 border-kiri-emerald/40 text-kiri-emerald hover:bg-kiri-emerald/10 hover:border-kiri-emerald font-bold text-xs"
      >
        {puedePdf ? <FileText className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        PDF
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
