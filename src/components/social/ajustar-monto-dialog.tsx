"use client"

/**
 * "Ajustar monto" de Social: subir o bajar lo que se debe en un préstamo o una
 * deuda compartida, o la meta de un ahorro compartido, sin crear otro registro
 * ("me prestó más y es la misma deuda").
 */
import { useEffect, useState } from "react"
import { Loader2, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAppContext } from "@/lib/app-context"
import { cn } from "@/lib/utils"
import { tr } from "@/lib/i18n"

export type TipoAjuste = "aumentar" | "disminuir"

interface Props {
  open: boolean
  onClose: () => void
  titulo: string
  /** Qué valor se ajusta, ej. "Lo que falta", "Meta" */
  etiquetaActual: string
  actual: number
  /** false → solo se puede subir (ej. quien debe no puede bajar su deuda sin abonar) */
  permitirDisminuir?: boolean
  avisoNoDisminuir?: string
  /** Bajar no puede pasar de aquí (lo que falta); sin valor, hasta `actual` */
  maximoDisminuir?: number
  textoAumentar?: string
  textoDisminuir?: string
  /** Casilla opcional (ej. "Esta plata salió de mi saldo en Kiri") según el tipo */
  casilla?: (tipo: TipoAjuste) => string | null
  conNota?: boolean
  onConfirmar: (tipo: TipoAjuste, monto: number, extra: { nota?: string; casilla: boolean }) => Promise<boolean>
}

export function AjustarMontoDialog({
  open, onClose, titulo, etiquetaActual, actual, permitirDisminuir = true, avisoNoDisminuir,
  maximoDisminuir, textoAumentar, textoDisminuir, casilla, conNota, onConfirmar,
}: Props) {
  const { formatAmount } = useAppContext()
  const [tipo, setTipo] = useState<TipoAjuste>("aumentar")
  const [monto, setMonto] = useState("")
  const [nota, setNota] = useState("")
  const [marcada, setMarcada] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) { setTipo("aumentar"); setMonto(""); setNota(""); setMarcada(false) }
  }, [open])

  const valor = Number(monto) || 0
  const tope = maximoDisminuir ?? actual
  const excede = tipo === "disminuir" && valor > tope
  const nuevo = Math.max(0, actual + (tipo === "aumentar" ? valor : -valor))
  const textoCasilla = casilla?.(tipo) ?? null

  const confirmar = async () => {
    if (valor <= 0 || excede) return
    setGuardando(true)
    const ok = await onConfirmar(tipo, valor, { nota: nota.trim() || undefined, casilla: !!textoCasilla && marcada })
    setGuardando(false)
    if (ok) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-black">{titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl bg-muted/40 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{etiquetaActual}</span>
            <span className="text-sm font-black tabular-nums">{formatAmount(actual)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["aumentar", "disminuir"] as const).map(t => {
              const bloqueado = t === "disminuir" && !permitirDisminuir
              return (
                <button
                  key={t}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => setTipo(t)}
                  className={cn(
                    "h-11 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors",
                    tipo === t
                      ? t === "aumentar" ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border text-muted-foreground hover:bg-muted/40",
                    bloqueado && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {t === "aumentar" ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {t === "aumentar" ? (textoAumentar ?? tr("Aumentar")) : (textoDisminuir ?? tr("Disminuir"))}
                </button>
              )
            })}
          </div>
          {!permitirDisminuir && avisoNoDisminuir && <p className="text-[11px] text-muted-foreground -mt-2">{avisoNoDisminuir}</p>}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tipo === "aumentar" ? tr("¿Cuánto le sumas?") : tr("¿Cuánto le restas?")}</Label>
            <MoneyInput value={monto} onChange={setMonto} className="h-11 rounded-2xl font-bold" placeholder="0" />
            {excede && <p className="text-xs text-destructive font-bold">{tr("No puedes bajar más de {0}.", [formatAmount(tope)])}</p>}
          </div>

          {conNota && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Nota (opcional)")}</Label>
              <Input value={nota} onChange={e => setNota(e.target.value)} maxLength={200} className="h-10 rounded-2xl text-sm" placeholder={tr("Ej: me prestó para el mercado")} />
            </div>
          )}

          {textoCasilla && (
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={marcada} onChange={e => setMarcada(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
              <span>{textoCasilla}</span>
            </label>
          )}

          {valor > 0 && !excede && (
            <p className="text-xs text-center">
              {tr("Queda en")}{" "}<b className="tabular-nums">{formatAmount(nuevo)}</b>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={confirmar} disabled={guardando || valor <= 0 || excede} className="w-full h-11 rounded-2xl font-bold">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Guardar cambio")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
