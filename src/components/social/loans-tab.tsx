"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Coins, Plus, Check, XCircle, Loader2, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownLeft, Clock, AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { loansApi } from "@/lib/api-client"
import { useSocket, SOCKET_EVENTS } from "@/lib/socket-context"
import { useToast } from "@/hooks/use-toast"
import { useAppContext } from "@/lib/app-context"
import type { Loan, Connection } from "@/lib/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Esperando aprobación",
  ACTIVE:           "Activo",
  REJECTED:         "Rechazado",
  PAID:             "Pagado",
}

const STATUS_COLOR: Record<string, string> = {
  PENDING_APPROVAL: "text-yellow-600 bg-yellow-100",
  ACTIVE:           "text-kiri-emerald bg-kiri-mint/30",
  REJECTED:         "text-destructive bg-destructive/10",
  PAID:             "text-muted-foreground bg-muted",
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING_CONFIRMATION: "Pendiente",
  CONFIRMED:            "Confirmado",
  REJECTED:             "Rechazado",
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LoansTabProps {
  myId: string
  acceptedConnections: Connection[]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function LoansTab({ myId, acceptedConnections }: LoansTabProps) {
  const { toast } = useToast()
  const { formatAmount } = useAppContext()
  const { socket } = useSocket()

  const [loans, setLoans]           = useState<Loan[]>([])
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionId, setActionId]     = useState<string | null>(null)

  // ── Modales ────────────────────────────────────────────────────────────────
  const [requestOpen, setRequestOpen]   = useState(false)
  const [paymentOpen, setPaymentOpen]   = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)

  // ── Formularios ────────────────────────────────────────────────────────────
  const [reqForm, setReqForm] = useState({ lenderId: "", amount: "", descripcion: "", dueDate: "" })
  const [requesting, setRequesting] = useState(false)

  const [payForm, setPayForm] = useState({ monto: "", nota: "" })
  const [paying, setPaying]   = useState(false)

  // ── Cargar ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await loansApi.list()
    if (error || !data) {
      toast({ title: "Error al cargar préstamos", variant: "destructive" })
    } else {
      setLoans(data.loans as unknown as Loan[])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  // ── Socket: recargar al recibir eventos de préstamos ───────────────────────
  useEffect(() => {
    if (!socket) return
    const refresh = () => load()
    socket.on(SOCKET_EVENTS.LOAN_REQUESTED,          refresh)
    socket.on(SOCKET_EVENTS.LOAN_APPROVED,           refresh)
    socket.on(SOCKET_EVENTS.LOAN_REJECTED,           refresh)
    socket.on(SOCKET_EVENTS.LOAN_PAYMENT,            refresh)
    socket.on(SOCKET_EVENTS.LOAN_PAYMENT_CONFIRMED,  refresh)
    socket.on(SOCKET_EVENTS.LOAN_PAYMENT_REJECTED,   refresh)
    return () => {
      socket.off(SOCKET_EVENTS.LOAN_REQUESTED,          refresh)
      socket.off(SOCKET_EVENTS.LOAN_APPROVED,           refresh)
      socket.off(SOCKET_EVENTS.LOAN_REJECTED,           refresh)
      socket.off(SOCKET_EVENTS.LOAN_PAYMENT,            refresh)
      socket.off(SOCKET_EVENTS.LOAN_PAYMENT_CONFIRMED,  refresh)
      socket.off(SOCKET_EVENTS.LOAN_PAYMENT_REJECTED,   refresh)
    }
  }, [socket, load])

  // ── Solicitar préstamo ─────────────────────────────────────────────────────
  const handleRequest = async () => {
    if (!reqForm.lenderId || !reqForm.amount || Number(reqForm.amount) <= 0) return
    setRequesting(true)
    const { error } = await loansApi.request({
      lenderId:    reqForm.lenderId,
      amount:      Number(reqForm.amount),
      descripcion: reqForm.descripcion || undefined,
      dueDate:     reqForm.dueDate || undefined,
    })
    setRequesting(false)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Solicitud enviada — el prestamista recibirá una notificación" })
      setRequestOpen(false)
      setReqForm({ lenderId: "", amount: "", descripcion: "", dueDate: "" })
      load()
    }
  }

  // ── Aprobar / rechazar préstamo ────────────────────────────────────────────
  const handleApprove = async (loanId: string) => {
    setActionId(loanId)
    const { error } = await loansApi.approve(loanId)
    setActionId(null)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Préstamo aprobado ✓" })
      load()
    }
  }

  const handleRejectLoan = async (loanId: string) => {
    setActionId(loanId)
    const { error } = await loansApi.reject(loanId)
    setActionId(null)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Préstamo rechazado" })
      load()
    }
  }

  // ── Registrar abono ────────────────────────────────────────────────────────
  const openPayment = (loan: Loan) => {
    setSelectedLoan(loan)
    setPayForm({ monto: "", nota: "" })
    setPaymentOpen(true)
  }

  const handlePayment = async () => {
    if (!selectedLoan || !payForm.monto || Number(payForm.monto) <= 0) return
    setPaying(true)
    const { error } = await loansApi.payment(selectedLoan.id, Number(payForm.monto), payForm.nota || undefined)
    setPaying(false)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Abono registrado — el prestamista debe confirmarlo" })
      setPaymentOpen(false)
      setSelectedLoan(null)
      load()
    }
  }

  // ── Confirmar / rechazar pago ──────────────────────────────────────────────
  const handleConfirmPayment = async (paymentId: string) => {
    setActionId(paymentId)
    const { error } = await loansApi.confirmPayment(paymentId)
    setActionId(null)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Pago confirmado ✓" })
      load()
    }
  }

  const handleRejectPayment = async (paymentId: string) => {
    setActionId(paymentId)
    const { error } = await loansApi.rejectPayment(paymentId)
    setActionId(null)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Pago rechazado" })
      load()
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-cyclon-lavender" />
        <p className="text-sm">Cargando préstamos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Solicitar nuevo préstamo ── */}
      <Button
        onClick={() => setRequestOpen(true)}
        disabled={acceptedConnections.length === 0}
        className="w-full h-12 rounded-2xl bg-cyclon-lavender/10 text-cyclon-lavender hover:bg-cyclon-lavender/20 font-bold border-0 gap-2"
        variant="outline"
      >
        <Plus className="h-4 w-4" /> Solicitar préstamo
      </Button>

      {acceptedConnections.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Necesitas al menos una conexión activa para solicitar préstamos.
        </p>
      )}

      {/* ── Lista de préstamos ── */}
      {loans.length === 0 ? (
        <Card className="border-none bg-muted/30 rounded-3xl">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Coins className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Sin préstamos registrados</p>
            <p className="text-xs opacity-70">Solicita o recibe préstamos de tus contactos</p>
          </CardContent>
        </Card>
      ) : (
        loans.map(loan => {
          const isBorrower = loan.borrowerId === myId
          const isLender   = loan.lenderId === myId
          const peer       = isBorrower ? loan.lender : loan.borrower
          const paid        = loan.amount > 0 ? ((loan.amount - loan.remainingAmount) / loan.amount) * 100 : 0
          const isExpanded  = expandedId === loan.id
          const pendingPayments = (loan.payments ?? []).filter(p => p.status === "PENDING_CONFIRMATION")

          return (
            <Card key={loan.id} className={cn("border-none bg-card rounded-3xl shadow-sm overflow-hidden", loan.status === "PAID" && "opacity-60")}>
              <CardContent className="p-0">
                {/* Header */}
                <button
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : loan.id)}
                >
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0",
                    isBorrower ? "bg-cyclon-pink/10" : "bg-cyclon-sky/10"
                  )}>
                    {isBorrower
                      ? <ArrowUpRight className="h-6 w-6 text-cyclon-pink" />
                      : <ArrowDownLeft className="h-6 w-6 text-cyclon-sky" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate">
                        {isBorrower ? `Le debo a ${peer?.nombre}` : `Me debe ${peer?.nombre}`}
                      </p>
                      {pendingPayments.length > 0 && (
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                      )}
                    </div>
                    {loan.descripcion && (
                      <p className="text-xs text-muted-foreground truncate">{loan.descripcion}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-lg", STATUS_COLOR[loan.status])}>
                        {STATUS_LABEL[loan.status]}
                      </span>
                      <span className="text-xs font-bold">{formatAmount(loan.remainingAmount)}</span>
                      {loan.status === "ACTIVE" && loan.amount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          de {formatAmount(loan.amount)}
                        </span>
                      )}
                    </div>
                    {loan.status === "ACTIVE" && (
                      <Progress value={paid} className="h-1 mt-1.5 bg-muted" indicatorClassName={cn(isBorrower ? "bg-cyclon-pink" : "bg-cyclon-sky")} />
                    )}
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                </button>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-4 pb-4 space-y-3">

                    {/* Acciones según rol y estado */}
                    <div className="pt-3 flex gap-2 flex-wrap">
                      {/* Lender: aprobar / rechazar solicitud pendiente */}
                      {isLender && loan.status === "PENDING_APPROVAL" && (
                        <>
                          <Button
                            size="sm"
                            disabled={actionId === loan.id}
                            onClick={() => handleApprove(loan.id)}
                            className="h-8 px-4 rounded-xl bg-kiri-emerald text-white font-bold text-xs gap-1"
                          >
                            {actionId === loan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={actionId === loan.id}
                            onClick={() => handleRejectLoan(loan.id)}
                            className="h-8 px-4 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 font-bold text-xs gap-1"
                          >
                            <XCircle className="h-3 w-3" />
                            Rechazar
                          </Button>
                        </>
                      )}

                      {/* Borrower: registrar abono si está ACTIVE */}
                      {isBorrower && loan.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          onClick={() => openPayment(loan)}
                          className="h-8 px-4 rounded-xl bg-cyclon-lavender text-white font-bold text-xs gap-1"
                        >
                          <Coins className="h-3 w-3" />
                          Registrar abono
                        </Button>
                      )}
                    </div>

                    {/* Historial de pagos */}
                    {(loan.payments ?? []).length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          Historial de abonos
                        </p>
                        <ul className="space-y-2">
                          {(loan.payments ?? []).map(p => (
                            <li key={p.id} className="bg-muted/30 rounded-2xl p-3">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm">{formatAmount(p.monto)}</span>
                                <span className={cn(
                                  "text-[9px] font-black px-2 py-0.5 rounded-lg",
                                  p.status === "CONFIRMED"            ? "text-kiri-emerald bg-kiri-mint/30" :
                                  p.status === "REJECTED"             ? "text-destructive bg-destructive/10" :
                                  "text-yellow-600 bg-yellow-100"
                                )}>
                                  {PAYMENT_STATUS_LABEL[p.status]}
                                </span>
                              </div>
                              {p.nota && <p className="text-xs text-muted-foreground mt-0.5">{p.nota}</p>}

                              {/* Lender confirma / rechaza abono PENDING */}
                              {isLender && p.status === "PENDING_CONFIRMATION" && (
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    size="sm"
                                    disabled={actionId === p.id}
                                    onClick={() => handleConfirmPayment(p.id)}
                                    className="h-7 px-3 rounded-xl bg-kiri-emerald text-white font-bold text-[10px] gap-1"
                                  >
                                    {actionId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Confirmar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={actionId === p.id}
                                    onClick={() => handleRejectPayment(p.id)}
                                    className="h-7 px-3 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 font-bold text-[10px] gap-1"
                                  >
                                    <XCircle className="h-3 w-3" />
                                    Rechazar
                                  </Button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Info extra */}
                    {(loan.dueDate || loan.status === "ACTIVE") && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {loan.dueDate
                          ? `Vence: ${loan.dueDate}`
                          : `Pendiente: ${formatAmount(loan.remainingAmount)}`
                        }
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      {/* ════ Modal Solicitar préstamo ════ */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-cyclon-lavender" /> Solicitar préstamo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Prestamista</Label>
              <Select value={reqForm.lenderId} onValueChange={v => setReqForm(f => ({ ...f, lenderId: v }))}>
                <SelectTrigger className="h-11 rounded-2xl">
                  <SelectValue placeholder="¿A quién le solicitas?" />
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
              <Label className="text-xs font-bold">Monto</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={reqForm.amount}
                onChange={e => setReqForm(f => ({ ...f, amount: e.target.value }))}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción (opcional)</Label>
              <Input
                placeholder="Ej: Para emergencia médica"
                value={reqForm.descripcion}
                onChange={e => setReqForm(f => ({ ...f, descripcion: e.target.value }))}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Fecha límite (opcional)</Label>
              <Input
                type="date"
                value={reqForm.dueDate}
                onChange={e => setReqForm(f => ({ ...f, dueDate: e.target.value }))}
                className="h-11 rounded-2xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRequestOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button
              disabled={!reqForm.lenderId || !reqForm.amount || Number(reqForm.amount) <= 0 || requesting}
              onClick={handleRequest}
              className="rounded-xl bg-cyclon-lavender text-white font-bold px-6"
            >
              {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Modal Registrar abono ════ */}
      <Dialog open={paymentOpen} onOpenChange={v => { setPaymentOpen(v); if (!v) setSelectedLoan(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-kiri-emerald" /> Registrar abono
            </DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4 py-1">
              <div className="bg-muted/50 rounded-2xl p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Préstamo con {selectedLoan.lender?.nombre}</p>
                <p className="font-bold">
                  Pendiente: <span className="text-cyclon-pink">{formatAmount(selectedLoan.remainingAmount)}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Monto del abono</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={payForm.monto}
                  max={selectedLoan.remainingAmount}
                  onChange={e => setPayForm(f => ({ ...f, monto: e.target.value }))}
                  className="h-11 rounded-2xl"
                />
                {payForm.monto && Number(payForm.monto) > selectedLoan.remainingAmount && (
                  <p className="text-xs text-destructive font-bold">El monto supera el saldo pendiente.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Nota (opcional)</Label>
                <Input
                  placeholder="Ej: Transferencia del 15"
                  value={payForm.nota}
                  onChange={e => setPayForm(f => ({ ...f, nota: e.target.value }))}
                  className="h-11 rounded-2xl"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPaymentOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button
              disabled={
                !payForm.monto ||
                Number(payForm.monto) <= 0 ||
                (!!selectedLoan && Number(payForm.monto) > selectedLoan.remainingAmount) ||
                paying
              }
              onClick={handlePayment}
              className="rounded-xl bg-kiri-emerald text-white font-bold px-6"
            >
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar abono"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
