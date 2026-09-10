"use client"

import { useState, useMemo, useEffect } from "react"
import { HandCoins, Plus, Loader2, Landmark, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { debtsApi } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { useAppContext } from "@/lib/app-context"
import type { Connection, SharedDebt } from "@/lib/types"

// ─── Props ────────────────────────────────────────────────────────────────────

interface SocialDebtsTabProps {
  myId: string
  acceptedConnections: Connection[]
}

// ─── Componente principal ─────────────────────────────────────────────────────
//
// Deudas compartidas — solo entre pareja/familia (nunca amigos). La deuda
// sigue siendo 100% de quien la crea (mismos pagos/undo-pay de siempre); el
// reparto acá es puramente informativo, para que ambos sepan cuánto le
// corresponde a cada uno.

export function SocialDebtsTab({ myId, acceptedConnections }: SocialDebtsTabProps) {
  const { toast } = useToast()
  const { formatAmount } = useAppContext()

  const [debts, setDebts] = useState<SharedDebt[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const eligibleConnections = useMemo(
    () => acceptedConnections.filter(c => c.role === "PARTNER" || c.role === "FAMILY"),
    [acceptedConnections]
  )

  const load = async () => {
    setLoading(true)
    const { data, error } = await debtsApi.listShared()
    if (error || !data) {
      toast({ title: "Error al cargar deudas compartidas", variant: "destructive" })
    } else {
      setDebts(data.debts)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-cyclon-lavender" />
        <p className="text-sm">Cargando deudas compartidas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={() => setCreateOpen(true)}
        disabled={eligibleConnections.length === 0}
        className="w-full h-12 rounded-2xl bg-cyclon-lavender/10 text-cyclon-lavender hover:bg-cyclon-lavender/20 font-bold border-0 gap-2"
        variant="outline"
      >
        <Plus className="h-4 w-4" /> Nueva deuda compartida
      </Button>

      {eligibleConnections.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Necesitas una conexión de pareja o familia para compartir una deuda.
        </p>
      )}

      {debts.length === 0 ? (
        <Card className="border-none bg-muted/30 rounded-3xl">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <HandCoins className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Sin deudas compartidas</p>
            <p className="text-xs opacity-70">Se reparten entre los dos desde que se crean</p>
          </CardContent>
        </Card>
      ) : (
        debts.map(d => (
          <Card key={d.id} className="border-none bg-card rounded-3xl shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">{d.nombre}</p>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-cyclon-lavender/10 text-cyclon-lavender">
                  {d.connectionRole === "PARTNER" ? "Pareja" : "Familia"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartida con {d.isOwner ? d.peerName : d.ownerName}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold">{formatAmount(d.montoTotal)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {d.tipoDeuda === "TARJETA_CREDITO" ? "Bancaria" : "Simple"}
                  {d.tasaInteres ? ` · ${d.tasaInteres}% mensual` : ""}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] bg-muted/30 rounded-xl px-3 py-2">
                <span>{d.isOwner ? "Tú" : d.ownerName}: <b>{formatAmount(d.ownerShare)}</b></span>
                <span>{d.isOwner ? d.peerName : "Tú"}: <b>{formatAmount(d.peerShare)}</b></span>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <NewSharedDebtModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        connections={eligibleConnections}
        myId={myId}
        onCreated={() => { setCreateOpen(false); load() }}
      />
    </div>
  )
}

// ─── Modal: Nueva deuda compartida ─────────────────────────────────────────────

function NewSharedDebtModal({ open, onClose, connections, myId, onCreated }: {
  open: boolean
  onClose: () => void
  connections: Connection[]
  myId: string
  onCreated: () => void
}) {
  const { toast } = useToast()
  const { formatAmount } = useAppContext()

  const [connectionId, setConnectionId] = useState("")
  const [nombre, setNombre] = useState("")
  const [montoTotal, setMontoTotal] = useState("")
  const [tipoDeuda, setTipoDeuda] = useState<"PRESTAMO" | "TARJETA_CREDITO">("PRESTAMO")
  const [tasaInteres, setTasaInteres] = useState("")
  // % del monto total que le corresponde a "Tú" — los dos inputs numéricos
  // siempre se derivan de esto para garantizar que sumen el total exacto.
  const [pctA, setPctA] = useState(50)
  const [creating, setCreating] = useState(false)

  const total = Number(montoTotal) || 0
  const montoA = Math.round(total * (pctA / 100))
  const montoB = total - montoA

  // Preseleccionar si solo hay una conexión válida; resetear el form al abrir
  useEffect(() => {
    if (!open) return
    setConnectionId(connections.length === 1 ? connections[0].id : "")
    setNombre("")
    setMontoTotal("")
    setTipoDeuda("PRESTAMO")
    setTasaInteres("")
    setPctA(50)
  }, [open, connections])

  const peer = connections.find(c => c.id === connectionId)
  const peerUser = peer ? (peer.requesterId === myId ? peer.addressee : peer.requester) : undefined
  const peerLabel = peerUser ? `${peerUser.nombre} · ${peer!.role === "PARTNER" ? "Pareja" : "Familia"}` : ""

  const handleMontoAChange = (value: string) => {
    const n = Math.max(0, Math.min(total, Number(value) || 0))
    setPctA(total > 0 ? (n / total) * 100 : 50)
  }
  const handleMontoBChange = (value: string) => {
    const n = Math.max(0, Math.min(total, Number(value) || 0))
    setPctA(total > 0 ? ((total - n) / total) * 100 : 50)
  }

  const canSubmit = !!connectionId && !!nombre.trim() && total > 0 && !creating

  const handleSubmit = async () => {
    if (!canSubmit) return
    setCreating(true)
    const { error } = await debtsApi.create({
      nombre: nombre.trim(),
      montoTotal: total,
      cuotaPeriodo: total, // sin cuota/frecuencia definidas en este form simplificado — se paga como un solo abono desde Obligaciones
      // Día de hoy, no el día 1 fijo del default del backend — si no, una
      // deuda recién creada podía nacer marcada "vencida" con solo pasar el
      // día 1 del mes.
      diasPago: String(new Date().getDate()),
      tipoDeuda,
      tasaInteres: tipoDeuda === "TARJETA_CREDITO" && tasaInteres ? Number(tasaInteres) : undefined,
      esCompartida: true,
      connectionId,
      montoParticipanteA: montoA,
      montoParticipanteB: montoB,
    })
    setCreating(false)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Deuda compartida creada ✓" })
      onCreated()
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-cyclon-lavender" /> Nueva deuda compartida
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Se reparte entre los dos desde el momento en que la creas.</p>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Compartir con</Label>
            <Select value={connectionId} onValueChange={setConnectionId}>
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue placeholder="Selecciona pareja o familiar">{peerLabel || undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {connections.map(conn => {
                  const p = conn.requesterId === myId ? conn.addressee! : conn.requester!
                  return (
                    <SelectItem key={conn.id} value={conn.id}>
                      {p.nombre} · {conn.role === "PARTNER" ? "Pareja" : "Familia"}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Descripción</Label>
            <Input placeholder="Ej: Tarjeta Bancolombia" value={nombre} onChange={e => setNombre(e.target.value)} className="h-11 rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Monto total</Label>
            <MoneyInput value={montoTotal} onChange={setMontoTotal} className="h-11 rounded-xl" placeholder="0" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Tipo de deuda</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipoDeuda("PRESTAMO")}
                className={cn("h-10 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1.5 transition-colors",
                  tipoDeuda === "PRESTAMO" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40")}>
                <Landmark className="h-3.5 w-3.5" /> Simple
              </button>
              <button type="button" onClick={() => setTipoDeuda("TARJETA_CREDITO")}
                className={cn("h-10 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1.5 transition-colors",
                  tipoDeuda === "TARJETA_CREDITO" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40")}>
                <CreditCard className="h-3.5 w-3.5" /> Bancaria
              </button>
            </div>
          </div>

          {tipoDeuda === "TARJETA_CREDITO" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Tasa de interés mensual (%)</Label>
              <Input type="number" step="0.01" placeholder="Ej: 2.5" value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} className="h-11 rounded-xl" />
            </div>
          )}

          <Card className="border-none bg-muted/30 rounded-2xl">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">¿Cuánto paga cada uno?</Label>
                <button type="button" onClick={() => setPctA(50)} className="text-[10px] font-bold text-cyclon-lavender flex items-center gap-1">
                  Dividir 50/50
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={pctA}
                onChange={e => setPctA(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-kiri-emerald"
                style={{ background: `linear-gradient(to right, #10b981 ${pctA}%, #a855f7 ${pctA}%)` }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-kiri-emerald font-bold">Tú</Label>
                  <Input type="number" value={total > 0 ? montoA : ""} onChange={e => handleMontoAChange(e.target.value)} className="h-9 rounded-lg text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-cyclon-lavender font-bold">{peerUser?.nombre ?? "La otra persona"}</Label>
                  <Input type="number" value={total > 0 ? montoB : ""} onChange={e => handleMontoBChange(e.target.value)} className="h-9 rounded-lg text-sm" placeholder="0" />
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground text-center">
                Entre los dos: {formatAmount(montoA + montoB)} de {formatAmount(total)}
              </p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit} className="rounded-xl bg-cyclon-lavender text-white font-bold px-6">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear deuda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
