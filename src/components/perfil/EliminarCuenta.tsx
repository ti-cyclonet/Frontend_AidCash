"use client"

/**
 * Eliminar la cuenta de Kiri (lo exigen App Store y Google Play). Pide escribir
 * ELIMINAR para confirmar: borra todos los datos de Kiri y cierra la sesión. El
 * usuario de Cyclonet sigue existiendo para las otras apps del ecosistema.
 */
import { useState } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { userApi } from "@/lib/api-client"
import { tr } from "@/lib/i18n"

export function EliminarCuenta({ onEliminada }: { onEliminada: () => void | Promise<void> }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState("")
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const palabra = tr("ELIMINAR")
  const listo = texto.trim().toUpperCase() === palabra.toUpperCase()

  const cerrar = (v: boolean) => { if (cargando) return; setAbierto(v); if (!v) { setTexto(""); setError(null) } }
  async function eliminar() {
    if (!listo) return
    setCargando(true); setError(null)
    const { data, error: e } = await userApi.eliminarCuenta()
    setCargando(false)
    if (!data?.ok) { setError(e ?? tr("No se pudo eliminar la cuenta. Intenta de nuevo.")); return }
    try { localStorage.clear() } catch { /* sin storage */ }
    await onEliminada()
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-red-500 hover:underline">
        <Trash2 className="h-3.5 w-3.5" />{tr("Eliminar mi cuenta")}
      </button>
      <Dialog open={abierto} onOpenChange={cerrar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-5 w-5" />{tr("Eliminar mi cuenta")}</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">{tr("Se borran para siempre todos tus datos de Kiri: movimientos, obligaciones, ahorros, presupuesto, tu árbol, tus monedas y lo que compraste en la tienda.")}</span>
              <span className="block">{tr("Lo que compartes con otras personas (bolsillos compartidos y préstamos entre amigos) también se elimina para ellas.")}</span>
              <span className="block">{tr("Tu usuario de Cyclonet sigue existiendo para las otras apps. Si tienes un plan pago, cancélalo antes desde donde lo compraste.")}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{tr("Escribe {0} para confirmar", [palabra])}</p>
            <Input value={texto} onChange={e => setTexto(e.target.value)} placeholder={palabra} autoComplete="off" autoCapitalize="characters" />
            {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-500 dark:bg-red-950/30">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => cerrar(false)} disabled={cargando}>{tr("Cancelar")}</Button>
            <Button variant="destructive" onClick={eliminar} disabled={!listo || cargando} className="font-bold">
              {cargando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{tr("Eliminar para siempre")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
