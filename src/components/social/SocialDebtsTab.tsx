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
import { tr } from "@/lib/i18n"

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
      toast({ title: tr("Error al cargar deudas compartidas"), variant: "destructive" })
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
        <p className="text-sm">{tr("Cargando deudas compartidas...")}</p>
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
        <Plus className="h-4 w-4" />{" "}{tr("Nueva deuda compartida")}</Button>

      {eligibleConnections.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">{tr("Necesitas una conexión de pareja o familia para compartir una deuda.")}</p>
      )}

      {debts.length === 0 ? (
        <Card className="border-none bg-muted/30 rounded-3xl">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <HandCoins className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">{tr("Sin deudas compartidas")}</p>
            <p className="text-xs opacity-70">{tr("Se reparten entre los dos desde que se crean")}</p>
          </CardContent>
        </Card>
      ) : (
        debts.map(d => (
          <Card key={d.id} className="border-none bg-card rounded-3xl shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">{d.nombre}</p>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-cyclon-lavender/10 text-cyclon-lavender">
                  {d.connectionRole === "PARTNER" ? tr("Pareja") : tr("Familia")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{tr("Compartida con {0}", [d.isOwner ? d.peerName : d.ownerName])}</p>
              {(() => {
                const pagado = Math.max(0, d.montoTotal - (d.saldoRestante ?? d.montoTotal))
                const pct = d.montoTotal > 0 ? Math.min(100, Math.round((pagado / d.montoTotal) * 100)) : 0
                return (
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span>{tr("Faltan")}{" "}<b>{formatAmount(d.saldoRestante ?? d.montoTotal)}</b></span>
                      <span className="text-muted-foreground">{tr("{0}% pagado", [pct])}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden"><div className="h-full rounded-full bg-cyclon-lavender" style={{ width: `${pct}%` }} /></div>
                    {d.cuotaPeriodo > 0 && d.cuotaPeriodo < d.montoTotal && (
                      <p className="text-[10px] text-muted-foreground">{tr("Cuota de {0}{1}{2}", [formatAmount(d.cuotaPeriodo), d.frecuenciaPago === "quincenal" ? tr(" por quincena") : tr(" al mes"), d.diasPago ? tr(" · día {0}", [d.diasPago]) : ""])}</p>
                    )}
                  </div>
                )
              })()}
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold">{formatAmount(d.montoTotal)} <span className="text-[10px] font-normal text-muted-foreground">{tr("en total")}</span></span>
                <span className="text-[10px] text-muted-foreground">
                  {d.tipoDeuda === "TARJETA_CREDITO" ? tr("Bancaria") : tr("Simple")}
                  {d.tasaInteres ? tr(" · {0}% mensual", [d.tasaInteres]) : ""}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] bg-muted/30 rounded-xl px-3 py-2">
                <span>{d.isOwner ? tr("Tú") : d.ownerName}: <b>{formatAmount(d.ownerShare)}</b></span>
                <span>{d.isOwner ? d.peerName : tr("Tú")}: <b>{formatAmount(d.peerShare)}</b></span>
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
  const [cuota, setCuota] = useState("")
  const [diaPago, setDiaPago] = useState(String(new Date().getDate()))
  // Deuda que ya venían pagando antes de Kiri
  const [antigua, setAntigua] = useState(false)
  const [saldo, setSaldo] = useState("")
  const [yaPagoCuota, setYaPagoCuota] = useState(false)
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
    setCuota("")
    setDiaPago(String(new Date().getDate()))
    setAntigua(false)
    setSaldo("")
    setYaPagoCuota(false)
    setPctA(50)
  }, [open, connections])

  const peer = connections.find(c => c.id === connectionId)
  const peerUser = peer ? (peer.requesterId === myId ? peer.addressee : peer.requester) : undefined
  const peerLabel = peerUser ? `${peerUser.nombre} · ${peer!.role === "PARTNER" ? tr("Pareja") : tr("Familia")}` : ""

  const handleMontoAChange = (value: string) => {
    const n = Math.max(0, Math.min(total, Number(value) || 0))
    setPctA(total > 0 ? (n / total) * 100 : 50)
  }
  const handleMontoBChange = (value: string) => {
    const n = Math.max(0, Math.min(total, Number(value) || 0))
    setPctA(total > 0 ? ((total - n) / total) * 100 : 50)
  }

  const saldoNum = antigua ? Number(saldo) || 0 : total
  const saldoValido = !antigua || (saldoNum > 0 && saldoNum <= total)
  const canSubmit = !!connectionId && !!nombre.trim() && total > 0 && saldoValido && !creating

  const handleSubmit = async () => {
    if (!canSubmit) return
    setCreating(true)
    const { error } = await debtsApi.create({
      nombre: nombre.trim(),
      montoTotal: total,
      // Deuda antigua: se registra con lo que falta hoy, así el avance es real
      saldoRestante: saldoNum,
      // Sin cuota → se paga de una sola vez (como antes)
      cuotaPeriodo: Math.min(Number(cuota) || saldoNum, saldoNum),
      // Día de hoy por defecto, no el día 1 fijo del backend — si no, una
      // deuda recién creada podía nacer marcada "vencida" con solo pasar el
      // día 1 del mes.
      diasPago: String(Math.min(31, Math.max(1, Number(diaPago) || new Date().getDate()))),
      ...(antigua && yaPagoCuota ? { yaPagoEstePeriodo: true } : {}),
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
      toast({ title: tr("Deuda compartida creada ✓") })
      onCreated()
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-cyclon-lavender" />{" "}{tr("Nueva deuda compartida")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">{tr("Se reparte entre los dos desde el momento en que la creas.")}</p>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Compartir con")}</Label>
            <Select value={connectionId} onValueChange={setConnectionId}>
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue placeholder={tr("Selecciona pareja o familiar")}>{peerLabel || undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {connections.map(conn => {
                  const p = conn.requesterId === myId ? conn.addressee! : conn.requester!
                  return (
                    <SelectItem key={conn.id} value={conn.id}>
                      {p.nombre} · {conn.role === "PARTNER" ? tr("Pareja") : tr("Familia")}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Descripción")}</Label>
            <Input placeholder={tr("Ej: Tarjeta Bancolombia")} value={nombre} onChange={e => setNombre(e.target.value)} className="h-11 rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Monto total de la deuda")}</Label>
            <MoneyInput value={montoTotal} onChange={setMontoTotal} className="h-11 rounded-xl" placeholder="0" />
          </div>

          {/* Deuda que ya venían pagando */}
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={antigua} onChange={e => setAntigua(e.target.checked)} className="accent-kiri-emerald h-4 w-4 mt-0.5" />
            <span>{tr("Es una deuda que ya venían pagando")}{" "}<span className="block text-[10px] text-muted-foreground">{tr("Regístrala con lo que falta hoy para que los dos vean el avance real.")}</span></span>
          </label>
          {antigua && (
            <div className="space-y-2 rounded-2xl bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{tr("¿Cuánto falta por pagar hoy?")}</Label>
                <MoneyInput value={saldo} onChange={setSaldo} className="h-11 rounded-xl" placeholder="0" />
                {total > 0 && saldoNum > total && <p className="text-xs text-destructive font-bold">{tr("No puede ser más que el monto total.")}</p>}
                {total > 0 && saldoNum > 0 && saldoNum <= total && <p className="text-[10px] text-muted-foreground">{tr("Ya pagaron {0}.", [formatAmount(total - saldoNum)])}</p>}
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={yaPagoCuota} onChange={e => setYaPagoCuota(e.target.checked)} className="accent-kiri-emerald h-4 w-4" />{tr("Ya pagamos la cuota de este mes")}</label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Cuota (opcional)")}</Label>
              <MoneyInput value={cuota} onChange={setCuota} className="h-11 rounded-xl" placeholder={tr("De una vez")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Día de pago")}</Label>
              <Input inputMode="numeric" value={diaPago} onChange={e => setDiaPago(e.target.value.replace(/\D/g, "").slice(0, 2))} className="h-11 rounded-xl" placeholder="15" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Tipo de deuda")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipoDeuda("PRESTAMO")}
                className={cn("h-10 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1.5 transition-colors",
                  tipoDeuda === "PRESTAMO" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40")}>
                <Landmark className="h-3.5 w-3.5" />{" "}{tr("Simple")}</button>
              <button type="button" onClick={() => setTipoDeuda("TARJETA_CREDITO")}
                className={cn("h-10 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1.5 transition-colors",
                  tipoDeuda === "TARJETA_CREDITO" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40")}>
                <CreditCard className="h-3.5 w-3.5" />{" "}{tr("Bancaria")}</button>
            </div>
          </div>

          {tipoDeuda === "TARJETA_CREDITO" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Tasa de interés mensual (%)")}</Label>
              <Input type="number" step="0.01" placeholder={tr("Ej: 2.5")} value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} className="h-11 rounded-xl" />
            </div>
          )}

          <Card className="border-none bg-muted/30 rounded-2xl">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">{tr("¿Cuánto paga cada uno?")}</Label>
                <button type="button" onClick={() => setPctA(50)} className="text-[10px] font-bold text-cyclon-lavender flex items-center gap-1">{tr("Dividir 50/50")}</button>
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
                  <Label className="text-[10px] text-kiri-emerald font-bold">{tr("Tú")}</Label>
                  <Input type="number" value={total > 0 ? montoA : ""} onChange={e => handleMontoAChange(e.target.value)} className="h-9 rounded-lg text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-cyclon-lavender font-bold">{peerUser?.nombre ?? tr("La otra persona")}</Label>
                  <Input type="number" value={total > 0 ? montoB : ""} onChange={e => handleMontoBChange(e.target.value)} className="h-9 rounded-lg text-sm" placeholder="0" />
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground text-center">{tr("Entre los dos: {0} de {1}", [formatAmount(montoA + montoB), formatAmount(total)])}</p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">{tr("Cancelar")}</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit} className="rounded-xl bg-cyclon-lavender text-white font-bold px-6">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Crear deuda")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
