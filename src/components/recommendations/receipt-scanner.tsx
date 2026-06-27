"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Camera, Upload, ScanLine, CheckCircle2,
  AlertTriangle, Crown, Loader2, Receipt,
  Store, Calendar, DollarSign, Tag, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useCelebration } from "@/hooks/use-celebration"
import type { ReceiptScannerOutput } from "@/ai/flows/receipt-scanner-flow"

type ScanState = 'idle' | 'scanning' | 'result' | 'error'

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  gasto_fijo:  { label: 'Gasto Fijo',  color: 'bg-cyclon-sky/10 text-cyclon-sky',        icon: <Receipt className="h-3.5 w-3.5" /> },
  gasto_libre: { label: 'Gasto Libre', color: 'bg-cyclon-mint/20 text-cyclon-periwinkle', icon: <Tag className="h-3.5 w-3.5" /> },
  deuda:       { label: 'Deuda',        color: 'bg-cyclon-pink/10 text-cyclon-pink',       icon: <DollarSign className="h-3.5 w-3.5" /> },
  ahorro:      { label: 'Ahorro',       color: 'bg-cyclon-lavender/10 text-cyclon-lavender', icon: <DollarSign className="h-3.5 w-3.5" /> },
  otro:        { label: 'Otro',         color: 'bg-muted text-muted-foreground',           icon: <Tag className="h-3.5 w-3.5" /> },
}

export function ReceiptScanner() {
  const { formatAmount } = useAppContext()
  const { addFixedExpense, addDebt } = useFinanceData()
  const { fireSmallConfetti } = useCelebration()

  const [open, setOpen] = useState(false)
  const [state, setState] = useState<ScanState>('idle')
  const [result, setResult] = useState<ReceiptScannerOutput | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // ── Procesar imagen seleccionada ──────────────────────────────────────────
  const processImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes.')
      setState('error')
      return
    }

    // Mostrar preview
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    // Convertir a base64
    setState('scanning')
    setError(null)

    const base64 = await fileToBase64(file)
    const mimeType = file.type

    try {
      const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const data: ReceiptScannerOutput = await res.json()
      setResult(data)
      setState('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al escanear el recibo.')
      setState('error')
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processImage(file)
    // Reset input para permitir seleccionar el mismo archivo otra vez
    e.target.value = ''
  }

  // ── Guardar resultado en Supabase ─────────────────────────────────────────
  const handleSave = async () => {
    if (!result) return
    setSaving(true)

    try {
      if (result.categoria === 'gasto_fijo') {
        await addFixedExpense({
          nombre: result.establecimiento,
          monto: result.montoTotal,
          fechaCorte: result.fecha,
        })
      } else if (result.categoria === 'deuda') {
        await addDebt({
          nombre: result.establecimiento,
          montoTotal: result.montoTotal,
          cuotaPeriodo: result.montoTotal,
          fechaVencimiento: result.fecha,
        })
      } else {
        // gasto_libre, ahorro, otro → guardar como gasto fijo genérico
        await addFixedExpense({
          nombre: `${result.establecimiento} (${result.fecha})`,
          monto: result.montoTotal,
          fechaCorte: result.fecha,
        })
      }

      fireSmallConfetti()
      handleClose()
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    setOpen(false)
    setState('idle')
    setResult(null)
    setPreview(null)
    setError(null)
  }

  const handleRetry = () => {
    setState('idle')
    setResult(null)
    setPreview(null)
    setError(null)
  }

  return (
    <>
      {/* ── CTA Card ── */}
      <button onClick={() => setOpen(true)} className="w-full text-left">
        <Card className="border-2 border-dashed border-cyclon-periwinkle/30 bg-gradient-to-r from-cyclon-sky/5 to-cyclon-periwinkle/5 rounded-3xl hover:border-cyclon-periwinkle/60 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 bg-cyclon-periwinkle/20 rounded-2xl flex items-center justify-center text-cyclon-periwinkle shrink-0 relative">
              <ScanLine className="h-6 w-6" />
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-cyclon-periwinkle rounded-full flex items-center justify-center">
                <Crown className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm text-cyclon-periwinkle">Escanear Recibo</p>
                <span className="text-[8px] font-black bg-gradient-to-r from-cyclon-periwinkle to-cyclon-sky text-white px-2 py-0.5 rounded-full uppercase">
                  Premium
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toma foto a tu factura y Gemini extrae el gasto automáticamente
              </p>
            </div>
          </CardContent>
        </Card>
      </button>

      {/* ── Dialog del escáner ── */}
      <Dialog open={open} onOpenChange={v => !v && handleClose()}>
        <DialogContent >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-cyclon-periwinkle" />
              Escáner de Recibos
            </DialogTitle>
            <DialogDescription>
              Sube o toma una foto de tu recibo. La IA extraerá los datos automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── Estado: Idle — opciones de subida ── */}
            {state === 'idle' && (
              <div className="space-y-3">
                {/* Preview de imagen si hay */}
                {preview && (
                  <div className="relative rounded-2xl overflow-hidden border border-border">
                    <img src={preview} alt="Preview" className="w-full max-h-48 object-cover" />
                    <button
                      onClick={() => setPreview(null)}
                      className="absolute top-2 right-2 h-7 w-7 bg-black/50 rounded-full flex items-center justify-center text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Tomar foto */}
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-cyclon-periwinkle/30 hover:border-cyclon-periwinkle/60 hover:bg-cyclon-periwinkle/5 transition-colors"
                  >
                    <div className="h-12 w-12 bg-cyclon-periwinkle/10 rounded-2xl flex items-center justify-center text-cyclon-periwinkle">
                      <Camera className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-bold text-cyclon-periwinkle">Tomar Foto</span>
                  </button>

                  {/* Subir archivo */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-muted hover:border-cyclon-lavender/40 hover:bg-muted/30 transition-colors"
                  >
                    <div className="h-12 w-12 bg-muted/50 rounded-2xl flex items-center justify-center text-muted-foreground">
                      <Upload className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">Subir Imagen</span>
                  </button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  Formatos: JPG, PNG, WebP. Máximo 10MB.
                </p>

                {/* Inputs ocultos */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* ── Estado: Scanning ── */}
            {state === 'scanning' && (
              <div className="flex flex-col items-center gap-4 py-8">
                {preview && (
                  <div className="relative rounded-2xl overflow-hidden border border-border w-full max-h-32">
                    <img src={preview} alt="Scanning" className="w-full max-h-32 object-cover opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-16 w-16 bg-white/90 rounded-2xl flex items-center justify-center shadow-xl">
                        <Loader2 className="h-8 w-8 text-cyclon-periwinkle animate-spin" />
                      </div>
                    </div>
                    {/* Línea de escaneo animada */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-cyclon-periwinkle animate-scan-line" />
                  </div>
                )}
                <div className="text-center space-y-1">
                  <p className="font-bold text-sm">Analizando recibo...</p>
                  <p className="text-xs text-muted-foreground">Gemini está leyendo los datos</p>
                </div>
              </div>
            )}

            {/* ── Estado: Result ── */}
            {state === 'result' && result && (
              <div className="space-y-4">
                {/* Confianza */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold",
                  result.confianza === 'alta'  ? "bg-cyclon-mint/20 text-cyclon-periwinkle" :
                  result.confianza === 'media' ? "bg-yellow-50 text-yellow-700" :
                  "bg-cyclon-pink/10 text-cyclon-pink"
                )}>
                  {result.confianza === 'alta' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  Confianza {result.confianza}
                </div>

                {/* Datos extraídos */}
                <Card className="border-none bg-card shadow-sm rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <DataRow icon={<Store className="h-4 w-4" />} label="Establecimiento" value={result.establecimiento} />
                    <DataRow icon={<Calendar className="h-4 w-4" />} label="Fecha" value={result.fecha} />
                    <DataRow
                      icon={<DollarSign className="h-4 w-4" />}
                      label="Monto Total"
                      value={formatAmount(result.montoTotal)}
                      highlight
                    />
                    <div className="border-t border-dashed border-border pt-3">
                      <div className="flex items-center gap-2">
                        {CATEGORY_LABELS[result.categoria]?.icon}
                        <span className="text-xs text-muted-foreground">Categoría sugerida:</span>
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-full",
                          CATEGORY_LABELS[result.categoria]?.color
                        )}>
                          {CATEGORY_LABELS[result.categoria]?.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 pl-6">{result.categoriaRazon}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Ítems individuales (si hay) */}
                {result.items && result.items.length > 0 && (
                  <Card className="border-none bg-muted/30 rounded-2xl">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Ítems detectados
                      </p>
                      {result.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate flex-1">{item.descripcion}</span>
                          <span className="font-bold shrink-0 ml-2">{formatAmount(item.monto)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ── Estado: Error ── */}
            {state === 'error' && (
              <Card className="border border-destructive/20 bg-destructive/5 rounded-2xl">
                <CardContent className="p-4 flex gap-3 items-start">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-bold text-sm text-destructive">No se pudo leer el recibo</p>
                    <p className="text-xs text-muted-foreground">{error}</p>
                    <Button size="sm" variant="outline" onClick={handleRetry} className="rounded-xl">
                      Intentar de nuevo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Footer ── */}
          {state === 'result' && result && (
            <DialogFooter className="gap-2 pt-3 border-t border-border">
              <Button variant="ghost" onClick={handleRetry}>Escanear otro</Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-6 gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? "Guardando..." : "Guardar gasto"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DataRow({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: string; highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-sm", highlight ? "font-black text-cyclon-periwinkle" : "font-bold")}>
          {value}
        </p>
      </div>
    </div>
  )
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data:image/xxx;base64, prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
