"use client"

import { useState, useEffect, useCallback } from "react"
import { PiggyBank, Plus, ArrowDownToLine, Calculator, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { sharedPocketsApi } from "@/lib/api-client"
import { useSocket, SOCKET_EVENTS } from "@/lib/socket-context"
import { useToast } from "@/hooks/use-toast"
import { useAppContext } from "@/lib/app-context"
import type { SharedPocket, Connection } from "@/lib/types"
import { tr } from "@/lib/i18n"

// ─── Helper ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

function getPeerFromPocket(pocket: SharedPocket, myId: string) {
  // New format uses members array
  const members = (pocket as any).members as { id: string; nombre: string; correo: string; role: string }[] | undefined
  if (members) {
    const peer = members.find(m => m.id !== myId)
    return peer ? { id: peer.id, nombre: peer.nombre, correo: peer.correo } : undefined
  }
  // Fallback for old format
  return (pocket as any).userAId === myId ? (pocket as any).userB : (pocket as any).userA
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SharedPocketsTabProps {
  myId: string
  acceptedConnections: Connection[]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function SharedPocketsTab({ myId, acceptedConnections }: SharedPocketsTabProps) {
  const { toast } = useToast()
  const { formatAmount } = useAppContext()
  const { socket } = useSocket()

  const [pockets, setPockets] = useState<SharedPocket[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Aprobar / rechazar retiros pendientes (antes no había ningún botón: los
  // retiros pedidos quedaban esperando para siempre)
  const [aprobandoId, setAprobandoId] = useState<string | null>(null)
  const responderRetiro = async (pocketId: string, depositId: string, aprobar: boolean) => {
    setAprobandoId(depositId)
    const { error } = aprobar ? await sharedPocketsApi.approveDeposit(pocketId, depositId) : await sharedPocketsApi.rejectDeposit(pocketId, depositId)
    setAprobandoId(null)
    if (error) { toast({ title: error, variant: "destructive" }); return }
    toast({ title: aprobar ? tr("Retiro aprobado — la plata volvió a su billetera") : tr("Retiro rechazado") })
    load()
  }

  // ── Modales ────────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)

  // ── Formularios ────────────────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({ partnerId: "", nombre: "", meta: "", yaTienen: false, montoInicial: "" })
  const [creating, setCreating]     = useState(false)

  const [depositForm, setDepositForm] = useState({ pocketId: "", monto: "", nota: "", yaAhorrado: false })
  const esRetiro = depositForm.nota.startsWith("[RETIRO]")
  const [depositing, setDepositing]   = useState(false)

  const [calcForm, setCalcForm]   = useState({ partnerId: "", gasto: "" })
  const [calcResult, setCalcResult] = useState<{
    userA: { nombre: string; monto: number; pct: number; id: string }
    userB: { nombre: string; monto: number; pct: number; id: string }
    gasto: number
  } | null>(null)
  const [calculating, setCalculating] = useState(false)

  // ── Cargar ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await sharedPocketsApi.list()
    if (error || !data) {
      toast({ title: tr("Error al cargar bolsillos"), variant: "destructive" })
    } else {
      setPockets(data.pockets as unknown as SharedPocket[])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  // ── Socket: recarga al recibir depósito ────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const refresh = () => load()
    socket.on(SOCKET_EVENTS.SHARED_DEPOSIT, refresh)
    return () => { socket.off(SOCKET_EVENTS.SHARED_DEPOSIT, refresh) }
  }, [socket, load])

  // ── Crear bolsillo ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createForm.partnerId || !createForm.nombre.trim()) return
    setCreating(true)
    const { error } = await sharedPocketsApi.create(
      [createForm.partnerId],
      createForm.nombre.trim(),
      createForm.meta ? Number(createForm.meta) : undefined,
      createForm.yaTienen && Number(createForm.montoInicial) > 0 ? Number(createForm.montoInicial) : undefined,
    )
    setCreating(false)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: tr("Ahorro compartido creado ✓") })
      setCreateOpen(false)
      setCreateForm({ partnerId: "", nombre: "", meta: "", yaTienen: false, montoInicial: "" })
      load()
    }
  }

  // ── Depositar ──────────────────────────────────────────────────────────────
  const handleDeposit = async () => {
    if (!depositForm.pocketId || !depositForm.monto || Number(depositForm.monto) <= 0) return
    setDepositing(true)
    const { error, data } = await sharedPocketsApi.deposit(
      depositForm.pocketId,
      Number(depositForm.monto),
      depositForm.nota.replace(/^\[RETIRO\]\s*/, "") || undefined,
      // "Retirar" abre este mismo formulario con la marca [RETIRO] — antes se
      // mandaba siempre como aporte, así que retirar en realidad depositaba.
      esRetiro ? "retiro" : "aporte",
      !esRetiro && depositForm.yaAhorrado,
    )
    setDepositing(false)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      const needsApproval = (data as any)?.requiresApproval
      toast({
        title: esRetiro ? tr("Retiro de {0} solicitado", [formatAmount(Number(depositForm.monto))]) : tr("Aporte de {0} registrado", [formatAmount(Number(depositForm.monto))]),
        description: needsApproval ? tr("Esperando aprobación del otro miembro") : depositForm.yaAhorrado ? tr("Sumado al bolsillo sin tocar tu billetera") : tr("Aplicado exitosamente"),
      })
      setDepositOpen(false)
      setDepositForm({ pocketId: "", monto: "", nota: "", yaAhorrado: false })
      load()
    }
  }

  // ── Calculadora proporcional ───────────────────────────────────────────────
  const handleCalc = async () => {
    if (!calcForm.partnerId || !calcForm.gasto || Number(calcForm.gasto) <= 0) return
    setCalculating(true)
    const { data, error } = await sharedPocketsApi.splitCalculator(calcForm.partnerId, Number(calcForm.gasto))
    setCalculating(false)
    if (error || !data) {
      toast({ title: error ?? tr("Error al calcular"), variant: "destructive" })
    } else {
      setCalcResult({
        userA: { ...(data.userA as { nombre: string; monto: number; pct: number; id: string }) },
        userB: { ...(data.userB as { nombre: string; monto: number; pct: number; id: string }) },
        gasto: data.gasto,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-cyclon-lavender" />
        <p className="text-sm">{tr("Cargando bolsillos...")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Acciones rápidas ── */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-12 rounded-2xl flex flex-col gap-0.5 bg-cyclon-lavender/10 text-cyclon-lavender hover:bg-cyclon-lavender/20 border-0"
          variant="outline"
          disabled={acceptedConnections.length === 0}
        >
          <Plus className="h-4 w-4" />
          <span className="text-[10px] font-bold">{tr("Crear")}</span>
        </Button>
        <Button
          onClick={() => setDepositOpen(true)}
          className="h-12 rounded-2xl flex flex-col gap-0.5 bg-kiri-emerald/10 text-kiri-emerald hover:bg-kiri-emerald/20 border-0"
          variant="outline"
          disabled={pockets.length === 0}
        >
          <ArrowDownToLine className="h-4 w-4" />
          <span className="text-[10px] font-bold">{tr("Depositar")}</span>
        </Button>
        <Button
          onClick={() => { setCalcResult(null); setCalcOpen(true) }}
          className="h-12 rounded-2xl flex flex-col gap-0.5 bg-cyclon-sky/10 text-cyclon-sky hover:bg-cyclon-sky/20 border-0"
          variant="outline"
          disabled={acceptedConnections.length === 0}
        >
          <Calculator className="h-4 w-4" />
          <span className="text-[10px] font-bold">{tr("Dividir")}</span>
        </Button>
      </div>

      {acceptedConnections.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">{tr("Necesitas al menos una conexión activa para crear bolsillos.")}</p>
      )}

      {/* ── Lista de bolsillos ── */}
      {pockets.length === 0 ? (
        <Card className="border-none bg-muted/30 rounded-3xl">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <PiggyBank className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">{tr("Sin bolsillos compartidos")}</p>
            <p className="text-xs opacity-70">{tr("Crea uno con un contacto conectado")}</p>
          </CardContent>
        </Card>
      ) : (
        pockets.map(pocket => {
          const peer = getPeerFromPocket(pocket, myId)
          const progress = pocket.meta > 0 ? Math.min((pocket.balance / pocket.meta) * 100, 100) : 0
          const isExpanded = expandedId === pocket.id

          return (
            <Card key={pocket.id} className="border-none bg-card rounded-3xl shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {/* Header del bolsillo */}
                <button
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : pocket.id)}
                >
                  <div className="h-12 w-12 bg-cyclon-lavender/10 rounded-2xl flex items-center justify-center shrink-0">
                    <PiggyBank className="h-6 w-6 text-cyclon-lavender" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{pocket.nombre}</p>
                    {peer && (
                      <p className="text-xs text-muted-foreground">{tr("Con {0}", [peer.nombre])}</p>
                    )}
                    <div className="mt-1.5 space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span>{formatAmount(pocket.balance)}</span>
                        {pocket.meta > 0 && <span className="text-muted-foreground">{tr("meta:")}{" "}{formatAmount(pocket.meta)}</span>}
                      </div>
                      {pocket.meta > 0 && (
                        <Progress value={progress} className="h-1.5 bg-muted" indicatorClassName="bg-cyclon-lavender" />
                      )}
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                </button>

                {/* Acciones cuando está expandido */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-4 py-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setDepositForm({ pocketId: pocket.id, monto: "", nota: "", yaAhorrado: false }); setDepositOpen(true) }}
                        className="rounded-xl bg-kiri-emerald/10 text-kiri-emerald hover:bg-kiri-emerald/20 border-none font-bold text-xs h-9 gap-1"
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" />{" "}{tr("Abonar")}</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); setDepositForm({ pocketId: pocket.id, monto: "", nota: "[RETIRO]", yaAhorrado: false }); setDepositOpen(true) }}
                        className="rounded-xl font-bold text-xs h-9 gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />{" "}{tr("Retirar")}</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async (e) => {
                          e.stopPropagation()
                          const { data, error } = await sharedPocketsApi.remove(pocket.id)
                          if (error) toast({ title: error, variant: "destructive" })
                          else toast({ title: data?.message ?? tr("Solicitud enviada") })
                          load()
                        }}
                        className="rounded-xl font-bold text-xs h-9 gap-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />{" "}{tr("Eliminar")}</Button>
                    </div>
                  </div>
                )}

                {/* Depósitos recientes */}
                {isExpanded && pocket.deposits && pocket.deposits.length > 0 && (
                  <div className="border-t border-border/50 px-4 pb-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-3 mb-2">{tr("Últimos movimientos")}</p>
                    <ul className="space-y-2">
                      {pocket.deposits.filter(dep => !dep.nota?.includes("DELETE_REQUEST")).map(dep => {
                        const nota0 = dep.nota ?? ""
                        const previo = nota0.includes("PREVIO")
                        const retiro = Number(dep.monto) < 0 || nota0.includes("RETIRO")
                        const pendiente = nota0.includes("RETIRO_PENDIENTE")
                        const nota = nota0.replace(/^\[[A-Z_]+\]\s*/, "").trim()
                        const mio = dep.userId === myId
                        const quien = mio ? tr("Tú") : (peer?.nombre ?? "Pareja")
                        const verbo = retiro ? (pendiente ? tr("pidió retirar") : tr("retiró")) : previo ? tr("registró") : tr("depositó")
                        return (
                          <li key={dep.id} className="text-xs space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarFallback className="text-[9px] font-bold bg-muted">
                                  {mio ? tr("Yo") : initials(peer?.nombre ?? "?")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-muted-foreground flex-1 min-w-0">
                                {quien} {mio && !retiro && !previo ? "depositaste" : mio && previo ? "registraste" : mio && retiro ? (pendiente ? "pediste retirar" : "retiraste") : verbo}
                                {previo && <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted">{tr("ya ahorrado")}</span>}
                                {pendiente && <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">{tr("por aprobar")}</span>}
                                {nota && ` · "${nota}"`}
                              </span>
                              <span className={cn("font-bold shrink-0", retiro ? "text-cyclon-pink" : "text-kiri-emerald")}>
                                {retiro ? "−" : "+"}{formatAmount(Math.abs(Number(dep.monto)))}
                              </span>
                            </div>
                            {/* Retiro pendiente: lo aprueba o rechaza OTRO miembro */}
                            {pendiente && !mio && (
                              <div className="flex gap-2 pl-8">
                                <Button size="sm" disabled={aprobandoId === dep.id} onClick={() => responderRetiro(pocket.id, dep.id, true)}
                                  className="h-7 px-3 rounded-xl bg-kiri-emerald text-white font-bold text-[10px]">
                                  {aprobandoId === dep.id ? <Loader2 className="h-3 w-3 animate-spin" /> : tr("Aprobar retiro")}
                                </Button>
                                <Button size="sm" variant="ghost" disabled={aprobandoId === dep.id} onClick={() => responderRetiro(pocket.id, dep.id, false)}
                                  className="h-7 px-3 rounded-xl text-destructive hover:bg-destructive/10 font-bold text-[10px]">{tr("Rechazar")}</Button>
                              </div>
                            )}
                            {pendiente && mio && <p className="pl-8 text-[10px] text-muted-foreground">{tr("Esperando que {0} lo apruebe.", [peer?.nombre?.split(" ")[0] ?? tr("la otra persona")])}</p>}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      {/* ════ Modal Crear Bolsillo ════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-cyclon-lavender" />{" "}{tr("Nuevo bolsillo compartido")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Pareja / amigo")}</Label>
              <Select value={createForm.partnerId} onValueChange={v => setCreateForm(f => ({ ...f, partnerId: v }))}>
                <SelectTrigger className="h-11 rounded-2xl">
                  <SelectValue placeholder={tr("Selecciona un contacto")} />
                </SelectTrigger>
                <SelectContent>
                  {acceptedConnections.map(conn => {
                    const peer = conn.requesterId === myId ? conn.addressee! : conn.requester!
                    return (
                      <SelectItem key={peer.id} value={peer.id}>
                        {peer.nombre}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Nombre del bolsillo")}</Label>
              <Input
                placeholder={tr("Ej: Viaje a México, Renta, Emergencias...")}
                value={createForm.nombre}
                onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Meta de ahorro (opcional)")}</Label>
              <MoneyInput value={createForm.meta} onChange={v => setCreateForm(f => ({ ...f, meta: v }))} className="h-11 rounded-2xl" placeholder="0" />
            </div>
            {/* Ahorro que ya tenían antes de Kiri */}
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={createForm.yaTienen} onChange={e => setCreateForm(f => ({ ...f, yaTienen: e.target.checked }))} className="accent-kiri-emerald h-4 w-4 mt-0.5" />
              <span>{tr("Ya tenemos algo ahorrado para esto")}{" "}<span className="block text-[10px] text-muted-foreground">{tr("Se suma al bolsillo sin descontarlo de tu billetera.")}</span></span>
            </label>
            {createForm.yaTienen && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{tr("¿Cuánto tienen ahorrado?")}</Label>
                <MoneyInput value={createForm.montoInicial} onChange={v => setCreateForm(f => ({ ...f, montoInicial: v }))} className="h-11 rounded-2xl font-bold" placeholder="0" />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="rounded-xl">{tr("Cancelar")}</Button>
            <Button
              disabled={!createForm.partnerId || !createForm.nombre.trim() || creating}
              onClick={handleCreate}
              className="rounded-xl bg-cyclon-lavender text-white font-bold px-6"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Crear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Modal Depositar ════ */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-kiri-emerald" /> {esRetiro ? tr("Retirar del bolsillo") : tr("Depositar en bolsillo")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Bolsillo")}</Label>
              <Select value={depositForm.pocketId} onValueChange={v => setDepositForm(f => ({ ...f, pocketId: v }))}>
                <SelectTrigger className="h-11 rounded-2xl">
                  <SelectValue placeholder={tr("Selecciona un bolsillo")} />
                </SelectTrigger>
                <SelectContent>
                  {pockets.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} · {formatAmount(p.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Monto")}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={depositForm.monto}
                onChange={e => setDepositForm(f => ({ ...f, monto: e.target.value }))}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Nota (opcional)")}</Label>
              <Input
                placeholder={esRetiro ? tr("Ej: Para el pasaje") : tr("Ej: Quincena de marzo")}
                value={depositForm.nota.replace(/^\[RETIRO\]\s*/, "")}
                onChange={e => setDepositForm(f => ({ ...f, nota: (esRetiro ? "[RETIRO] " : "") + e.target.value }))}
                className="h-11 rounded-2xl"
              />
            </div>
            {!depositForm.nota.startsWith("[RETIRO]") && (
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={depositForm.yaAhorrado} onChange={e => setDepositForm(f => ({ ...f, yaAhorrado: e.target.checked }))} className="accent-kiri-emerald h-4 w-4 mt-0.5" />
                <span>{tr("Esta plata ya la tenía ahorrada")}{" "}<span className="block text-[10px] text-muted-foreground">{tr("Se suma al bolsillo sin descontarla de tu billetera (ej. lo que ya tenían guardado antes de Kiri).")}</span></span>
              </label>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDepositOpen(false)} className="rounded-xl">{tr("Cancelar")}</Button>
            <Button
              disabled={!depositForm.pocketId || !depositForm.monto || Number(depositForm.monto) <= 0 || depositing}
              onClick={handleDeposit}
              className="rounded-xl bg-kiri-emerald text-white font-bold px-6"
            >
              {depositing ? <Loader2 className="h-4 w-4 animate-spin" /> : esRetiro ? tr("Pedir retiro") : tr("Depositar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Modal Calculadora proporcional ════ */}
      <Dialog open={calcOpen} onOpenChange={v => { setCalcOpen(v); if (!v) setCalcResult(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-cyclon-sky" />{" "}{tr("División proporcional")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-xs text-muted-foreground">{tr("Calcula cuánto debe pagar cada uno según sus ingresos registrados en Kiri.")}</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Con quién calcular")}</Label>
              <Select value={calcForm.partnerId} onValueChange={v => { setCalcForm(f => ({ ...f, partnerId: v })); setCalcResult(null) }}>
                <SelectTrigger className="h-11 rounded-2xl">
                  <SelectValue placeholder={tr("Selecciona un contacto")} />
                </SelectTrigger>
                <SelectContent>
                  {acceptedConnections.map(conn => {
                    const peer = conn.requesterId === myId ? conn.addressee! : conn.requester!
                    return (
                      <SelectItem key={peer.id} value={peer.id}>
                        {peer.nombre}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Gasto total a dividir")}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={calcForm.gasto}
                onChange={e => { setCalcForm(f => ({ ...f, gasto: e.target.value })); setCalcResult(null) }}
                className="h-11 rounded-2xl"
              />
            </div>

            {calcResult && (
              <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-center text-muted-foreground">{tr("Gasto total: {0}", [formatAmount(calcResult.gasto)])}</p>
                {[calcResult.userA, calcResult.userB].map((u, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className={cn("text-[9px] font-bold", i === 0 ? "bg-cyclon-lavender/10 text-cyclon-lavender" : "bg-cyclon-sky/10 text-cyclon-sky")}>
                          {initials(u.nombre ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-semibold">{u.nombre ?? tr("Tú")}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm">{formatAmount(u.monto)}</p>
                      <p className="text-[10px] text-muted-foreground">{u.pct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCalcOpen(false)} className="rounded-xl">{tr("Cerrar")}</Button>
            <Button
              disabled={!calcForm.partnerId || !calcForm.gasto || Number(calcForm.gasto) <= 0 || calculating}
              onClick={handleCalc}
              className="rounded-xl bg-cyclon-sky text-white font-bold px-6"
            >
              {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Calcular")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
