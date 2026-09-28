"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Coins, Plus, Check, XCircle, Loader2, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownLeft, Clock, AlertCircle, CalendarClock, History,
} from "lucide-react"
import { MoneyInput } from "@/components/ui/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { loansApi, userApi } from "@/lib/api-client"
import { useSocket, SOCKET_EVENTS } from "@/lib/socket-context"
import { useToast } from "@/hooks/use-toast"
import { useAppContext } from "@/lib/app-context"
import type { Loan, Connection } from "@/lib/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" de hoy + n días (local). */
function enDias(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function finDeMes(): string {
  const d = new Date()
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")}`
}
function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short" })
}

/** Mismo lenguaje que "Me deben": cuándo toca pagar y si ya está atrasado. */
function estadoFecha(loan: Loan): { label: string; className: string } | null {
  if (!loan.fechaCompromiso || loan.diasParaCompromiso == null || loan.status === "PAID" || loan.status === "REJECTED") return null
  const d = loan.diasParaCompromiso
  if (d < 0) return { label: `Vencido ${-d} día${d === -1 ? "" : "s"}`, className: "text-red-500 bg-red-500/10" }
  if (d === 0) return { label: "Se paga hoy", className: "text-amber-600 bg-amber-500/10" }
  if (d <= 3) return { label: `Vence en ${d} día${d === 1 ? "" : "s"}`, className: "text-amber-600 bg-amber-500/10" }
  return { label: `Paga el ${fmtFecha(loan.fechaCompromiso)}`, className: "text-muted-foreground bg-muted/40" }
}

/** Atajos de fecha + selector (solicitud y cambio de fecha). */
function SelectorFecha({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const atajos = [
    { label: "En 1 semana", v: enDias(7) },
    { label: "En 15 días", v: enDias(15) },
    { label: "Fin de mes", v: finDeMes() },
    { label: "En 1 mes", v: enDias(30) },
  ]
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {atajos.map(a => (
          <button key={a.label} type="button" onClick={() => onChange(a.v)}
            className={cn("h-9 rounded-xl text-xs font-bold border-2 transition-colors",
              value === a.v ? "border-cyclon-lavender bg-cyclon-lavender/10 text-cyclon-lavender" : "border-muted text-muted-foreground hover:border-cyclon-lavender/40")}>
            {a.label}
          </button>
        ))}
      </div>
      <Input type="date" min={enDias(0)} value={value} onChange={e => onChange(e.target.value)} className="h-10 rounded-xl" />
    </div>
  )
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL:              "Esperando aprobación",
  PENDING_BORROWER_CONFIRMATION: "Con interés propuesto",
  ACTIVE:                        "Activo",
  REJECTED:                      "Rechazado",
  PAID:                          "Pagado",
}

const STATUS_COLOR: Record<string, string> = {
  PENDING_APPROVAL:              "text-yellow-600 bg-yellow-100",
  PENDING_BORROWER_CONFIRMATION: "text-cyclon-lavender bg-cyclon-lavender/10",
  ACTIVE:                        "text-kiri-emerald bg-kiri-mint/30",
  REJECTED:                      "text-destructive bg-destructive/10",
  PAID:                          "text-muted-foreground bg-muted",
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
  const [selectedInterest, setSelectedInterest] = useState<number | null>(null)
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [cancelLoanId, setCancelLoanId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelCustom, setCancelCustom] = useState("")

  // ── Modales ────────────────────────────────────────────────────────────────
  const [requestOpen, setRequestOpen]   = useState(false)
  const [paymentOpen, setPaymentOpen]   = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)

  // ── Formularios ────────────────────────────────────────────────────────────
  const [reqForm, setReqForm] = useState({ lenderId: "", amount: "", descripcion: "", fechaCompromiso: enDias(15) })

  // Préstamo que ya existía (no mueve plata)
  const [existenteOpen, setExistenteOpen] = useState(false)
  const formExistenteVacio = { otroId: "", rol: "yo_preste" as "yo_preste" | "me_prestaron", monto: "", pendiente: "", abonado: false, descripcion: "", fechaCompromiso: "" }
  const [exForm, setExForm] = useState(formExistenteVacio)
  const [registrando, setRegistrando] = useState(false)
  const exMonto = Number(exForm.monto) || 0
  const exPendiente = exForm.abonado ? (Number(exForm.pendiente) || 0) : exMonto
  const exValido = !!exForm.otroId && exMonto > 0 && exPendiente > 0 && exPendiente <= exMonto
  const exOtro = acceptedConnections.map(c => (c.requesterId === myId ? c.addressee : c.requester)).find(p => p?.id === exForm.otroId)
  const handleExistente = async () => {
    if (!exValido) return
    setRegistrando(true)
    const { error } = await loansApi.existente({
      otroId: exForm.otroId, rol: exForm.rol, monto: exMonto, pendiente: exPendiente,
      descripcion: exForm.descripcion.trim() || undefined, fechaCompromiso: exForm.fechaCompromiso || null,
    })
    setRegistrando(false)
    if (error) { toast({ title: error, variant: "destructive" }); return }
    toast({ title: "Préstamo registrado", description: `${exOtro?.nombre.split(" ")[0] ?? "La otra persona"} tiene que confirmarlo. No se movió plata de ninguna billetera.` })
    setExistenteOpen(false)
    setExForm(formExistenteVacio)
    load()
  }

  // Cambiar la fecha de pago de un préstamo
  const [fechaLoan, setFechaLoan] = useState<Loan | null>(null)
  const [fechaValue, setFechaValue] = useState("")
  const [guardandoFecha, setGuardandoFecha] = useState(false)
  const guardarFecha = async () => {
    if (!fechaLoan) return
    setGuardandoFecha(true)
    const { error } = await loansApi.cambiarFecha(fechaLoan.id, fechaValue || null)
    setGuardandoFecha(false)
    if (error) { toast({ title: error, variant: "destructive" }); return }
    toast({ title: "Fecha actualizada", description: "Le avisamos a la otra persona." })
    setFechaLoan(null)
    load()
  }
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
      fechaCompromiso: reqForm.fechaCompromiso || null,
    })
    setRequesting(false)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Solicitud enviada — el prestamista recibirá una notificación" })
      setRequestOpen(false)
      setReqForm({ lenderId: "", amount: "", descripcion: "", fechaCompromiso: enDias(15) })
      load()
    }
  }

  // ── Aprobar / rechazar préstamo ────────────────────────────────────────────
  const handleApprove = async (loanId: string, tasaInteres?: number) => {
    setActionId(loanId)
    const { error } = await loansApi.approve(loanId, tasaInteres ?? 0)
    setActionId(null)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Préstamo aprobado ✓" })
      load()
    }
  }

  // ── Borrower responde a la contraoferta con interés ────────────────────────
  const handleBorrowerConfirm = async (loanId: string, accept: boolean) => {
    setActionId(loanId)
    const { error } = await loansApi.borrowerConfirm(loanId, accept)
    setActionId(null)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      const loan = loans.find(l => l.id === loanId)
      toast({ title: accept ? (loan?.sinDesembolso ? "Préstamo confirmado — ya llevan juntos el control" : "Préstamo aceptado — ya tienes el dinero disponible") : (loan?.sinDesembolso ? "Le avisamos que no es así" : "Oferta rechazada") })
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
      {/* ── Solicitar nuevo préstamo / registrar uno que ya existía ── */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => setRequestOpen(true)}
          disabled={acceptedConnections.length === 0}
          className="h-12 rounded-2xl bg-cyclon-lavender/10 text-cyclon-lavender hover:bg-cyclon-lavender/20 font-bold border-0 gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" /> Solicitar préstamo
        </Button>
        <Button
          onClick={() => { setExForm(formExistenteVacio); setExistenteOpen(true) }}
          disabled={acceptedConnections.length === 0}
          className="h-12 rounded-2xl bg-muted/50 text-foreground hover:bg-muted font-bold border-0 gap-2 text-xs"
          variant="outline"
        >
          <History className="h-4 w-4" /> Ya nos prestamos antes
        </Button>
      </div>

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
                      {isBorrower && loan.status === "PENDING_BORROWER_CONFIRMATION" && (
                        <AlertCircle className="h-3.5 w-3.5 text-cyclon-lavender shrink-0" />
                      )}
                    </div>
                    {loan.descripcion && (
                      <p className="text-xs text-muted-foreground truncate">{loan.descripcion}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-lg", STATUS_COLOR[loan.status])}>
                        {loan.sinDesembolso && (loan.status === "PENDING_APPROVAL" || loan.status === "PENDING_BORROWER_CONFIRMATION") ? "Por confirmar" : STATUS_LABEL[loan.status]}
                      </span>
                      {loan.sinDesembolso && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-muted text-muted-foreground" title="Préstamo que ya existía: no movió plata de ninguna billetera">Previo</span>
                      )}
                      {(() => {
                        const est = estadoFecha(loan)
                        return est ? <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-lg", est.className)}>{est.label}</span> : null
                      })()}
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
                      {/* Préstamo que ya existía: la otra persona lo registró, aquí se confirma */}
                      {loan.sinDesembolso && loan.creadoPorId !== myId && ((isLender && loan.status === "PENDING_APPROVAL") || (isBorrower && loan.status === "PENDING_BORROWER_CONFIRMATION")) && (
                        <div className="w-full space-y-2">
                          <div className="bg-muted/40 border border-border rounded-2xl p-3 space-y-1">
                            <p className="text-xs font-bold">
                              {peer?.nombre.split(" ")[0]} registró que {isLender ? `le prestaste ${formatAmount(loan.amount)}` : `te prestó ${formatAmount(loan.amount)}`}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Es un préstamo que ya tenían: {loan.remainingAmount < loan.amount ? `ya se abonaron ${formatAmount(loan.amount - loan.remainingAmount)} y faltan ${formatAmount(loan.remainingAmount)}` : `falta todo (${formatAmount(loan.remainingAmount)})`}. Confirmarlo no mueve plata de ninguna billetera; desde aquí los abonos quedan registrados para los dos.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" disabled={actionId === loan.id}
                              onClick={() => isLender ? handleApprove(loan.id, 0) : handleBorrowerConfirm(loan.id, true)}
                              className="h-8 px-4 rounded-xl bg-kiri-emerald text-white font-bold text-xs gap-1">
                              {actionId === loan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Sí, es correcto
                            </Button>
                            <Button size="sm" variant="ghost" disabled={actionId === loan.id}
                              onClick={() => isLender ? handleRejectLoan(loan.id) : handleBorrowerConfirm(loan.id, false)}
                              className="h-8 px-4 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 font-bold text-xs gap-1">
                              <XCircle className="h-3 w-3" /> No es así
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Quien lo registró: esperando la confirmación del otro */}
                      {loan.sinDesembolso && loan.creadoPorId === myId && (loan.status === "PENDING_APPROVAL" || loan.status === "PENDING_BORROWER_CONFIRMATION") && (
                        <div className="w-full flex items-center justify-between gap-2 bg-muted/40 rounded-2xl px-3 py-2">
                          <p className="text-[11px] text-muted-foreground">Esperando que {peer?.nombre.split(" ")[0]} lo confirme.</p>
                          <Button size="sm" variant="ghost" disabled={actionId === loan.id}
                            onClick={async () => {
                              setActionId(loan.id)
                              const { error } = await loansApi.cancel(loan.id)
                              setActionId(null)
                              if (error) toast({ title: error, variant: "destructive" })
                              else { toast({ title: "Registro retirado" }); load() }
                            }}
                            className="h-7 px-3 rounded-xl text-destructive hover:bg-destructive/10 text-[10px] font-bold">
                            Retirar
                          </Button>
                        </div>
                      )}

                      {isLender && loan.status === "PENDING_APPROVAL" && !loan.sinDesembolso && (
                        <>
                          <div className="w-full space-y-2">
                            {/* Selector de interés */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] text-muted-foreground">Interés:</span>
                              {[0, 5, 10, 15, 20].map(pct => (
                                <button
                                  key={pct}
                                  onClick={() => setSelectedInterest(prev => prev === pct && selectedLoanId === loan.id ? null : pct)}
                                  onClickCapture={() => setSelectedLoanId(loan.id)}
                                  className={cn(
                                    "h-7 px-2.5 rounded-lg text-[9px] font-bold border transition-colors",
                                    selectedInterest === pct && selectedLoanId === loan.id
                                      ? "border-kiri-emerald bg-kiri-emerald/10 text-kiri-emerald"
                                      : "border-muted text-muted-foreground hover:border-kiri-emerald/30"
                                  )}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                            {/* Preview del monto con interés */}
                            {selectedInterest !== null && selectedLoanId === loan.id && (
                              <p className="text-[9px] text-kiri-emerald pl-1">
                                Recibirás: {formatAmount(Number(loan.amount) + Math.round(Number(loan.amount) * (selectedInterest / 100)))}
                                {selectedInterest > 0 && ` (+${formatAmount(Math.round(Number(loan.amount) * (selectedInterest / 100)))} interés)`}
                              </p>
                            )}
                            {/* Botones de acción */}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={actionId === loan.id || selectedInterest === null || selectedLoanId !== loan.id}
                                onClick={() => handleApprove(loan.id, selectedInterest ?? 0)}
                                className="h-8 px-4 rounded-xl bg-kiri-emerald text-white font-bold text-xs gap-1 disabled:opacity-40"
                              >
                                {actionId === loan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Aprobar ({selectedInterest ?? 0}%)
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
                            </div>
                          </div>
                        </>
                      )}

                      {/* Lender: acciones para préstamo ACTIVO (recordar + cancelar) */}
                      {isLender && loan.status === "ACTIVE" && (
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              toast({ title: "Recordatorio enviado", description: `Se notificó a ${loan.borrower?.nombre ?? 'el deudor'}` })
                              // Push notification via socket
                              import('@/lib/api-client').then(({ api }) => {
                                api('/loans/payment', { method: 'POST', body: { loanId: loan.id, monto: 0.01, nota: '__REMINDER__' } }).catch(() => {})
                              })
                            }}
                            className="h-8 px-3 rounded-xl text-xs font-bold gap-1 border-amber-500/30 text-amber-500"
                          >
                            📢 Recordar pago
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setCancelLoanId(loan.id) }}
                            className="h-8 px-3 rounded-xl text-xs font-bold gap-1 text-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="h-3 w-3" /> Cancelar préstamo
                          </Button>
                        </div>
                      )}

                      {/* Borrower: cancelar solicitud pendiente */}
                      {isBorrower && loan.status === "PENDING_APPROVAL" && !loan.sinDesembolso && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actionId === loan.id}
                          onClick={async () => {
                            setActionId(loan.id)
                            const { error } = await loansApi.cancel(loan.id)
                            setActionId(null)
                            if (error) toast({ title: error, variant: "destructive" })
                            else { toast({ title: "Solicitud cancelada" }); load() }
                          }}
                          className="h-8 px-4 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 font-bold text-xs gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          Cancelar solicitud
                        </Button>
                      )}

                      {/* Borrower: responder a la contraoferta de interés del prestamista —
                          antes esta pantalla no existía en ningún lado: el préstamo quedaba
                          en PENDING_BORROWER_CONFIRMATION para siempre, con el backend listo
                          para aceptar/rechazar pero sin ningún botón que lo llamara. */}
                      {isBorrower && loan.status === "PENDING_BORROWER_CONFIRMATION" && !loan.sinDesembolso && (
                        <div className="w-full space-y-2">
                          <div className="bg-cyclon-lavender/5 border border-cyclon-lavender/20 rounded-2xl p-3 space-y-1">
                            <p className="text-xs font-bold text-cyclon-lavender">
                              {peer?.nombre} quiere prestarte con {loan.tasaInteres ?? 0}% de interés
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Pediste {formatAmount(loan.montoOriginal ?? loan.amount)} — con ese interés
                              tendrías que devolver {formatAmount(loan.amount)}
                              {loan.tasaInteres ? ` (+${formatAmount(loan.amount - (loan.montoOriginal ?? loan.amount))} de interés)` : ""}.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={actionId === loan.id}
                              onClick={() => handleBorrowerConfirm(loan.id, true)}
                              className="h-8 px-4 rounded-xl bg-kiri-emerald text-white font-bold text-xs gap-1"
                            >
                              {actionId === loan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Aceptar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actionId === loan.id}
                              onClick={() => handleBorrowerConfirm(loan.id, false)}
                              className="h-8 px-4 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 font-bold text-xs gap-1"
                            >
                              <XCircle className="h-3 w-3" />
                              Me parece mucho, rechazar
                            </Button>
                          </div>
                        </div>
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
                    {loan.status !== "PAID" && loan.status !== "REJECTED" && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">
                          {loan.fechaCompromiso
                            ? `${isBorrower ? "Pagas" : "Te paga"} el ${fmtFecha(loan.fechaCompromiso)} · pendiente ${formatAmount(loan.remainingAmount)}`
                            : loan.dueDate
                              ? `Vence: ${loan.dueDate}`
                              : `Sin fecha de pago · pendiente ${formatAmount(loan.remainingAmount)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setFechaLoan(loan); setFechaValue(loan.fechaCompromiso ?? "") }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-cyclon-lavender hover:underline shrink-0"
                        >
                          <CalendarClock className="h-3 w-3" /> {loan.fechaCompromiso ? "Cambiar fecha" : "Poner fecha"}
                        </button>
                      </div>
                    )}

                    {/* Eliminar préstamo pagado */}
                    {loan.status === "PAID" && (
                      <p className="text-[9px] text-muted-foreground text-center pt-1">
                        Este préstamo se eliminará automáticamente en 3 días.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      {/* ════ Modal Cambiar fecha de pago ════ */}
      <Dialog open={!!fechaLoan} onOpenChange={v => { if (!v) setFechaLoan(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-cyclon-lavender" /> Fecha de pago
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <SelectorFecha value={fechaValue} onChange={setFechaValue} />
            <p className="text-[10px] text-muted-foreground">La otra persona recibe un aviso con la nueva fecha.</p>
          </div>
          <DialogFooter className="gap-2">
            {fechaLoan?.fechaCompromiso && (
              <Button variant="ghost" onClick={() => setFechaValue("")} className="rounded-xl text-xs">Quitar fecha</Button>
            )}
            <Button onClick={guardarFecha} disabled={guardandoFecha} className="rounded-xl bg-cyclon-lavender text-white font-bold px-6">
              {guardandoFecha ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <MoneyInput
                value={reqForm.amount}
                onChange={v => setReqForm(f => ({ ...f, amount: v }))}
                className="h-11 rounded-2xl font-bold"
                placeholder="0"
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
              <Label className="text-xs font-bold">¿Cuándo lo pagarás?</Label>
              <SelectorFecha value={reqForm.fechaCompromiso} onChange={v => setReqForm(f => ({ ...f, fechaCompromiso: v }))} />
              <p className="text-[10px] text-muted-foreground">A los dos les avisamos un día antes, el día del pago y si se atrasa.</p>
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

      {/* ════ Modal Préstamo que ya existía ════ */}
      <Dialog open={existenteOpen} onOpenChange={setExistenteOpen}>
        <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-cyclon-lavender" /> Préstamo que ya tenían
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Para una plata que se prestó antes (aunque ya se haya gastado). <strong className="text-foreground">No se mueve plata de ninguna billetera</strong>: solo queda el registro para que los dos lleven el control de los abonos.
          </p>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">¿Con quién?</Label>
              <Select value={exForm.otroId} onValueChange={v => setExForm(f => ({ ...f, otroId: v }))}>
                <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="Elige a la persona" /></SelectTrigger>
                <SelectContent>
                  {acceptedConnections.map(conn => {
                    const p = conn.requesterId === myId ? conn.addressee! : conn.requester!
                    return <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([["yo_preste", "Yo le presté", ArrowDownLeft], ["me_prestaron", "Me prestó", ArrowUpRight]] as const).map(([v, label, Icono]) => (
                <button key={v} type="button" onClick={() => setExForm(f => ({ ...f, rol: v }))}
                  className={cn("h-11 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1.5 transition-colors",
                    exForm.rol === v ? "border-cyclon-lavender bg-cyclon-lavender/10 text-cyclon-lavender" : "border-muted text-muted-foreground")}>
                  <Icono className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">¿Cuánto se prestó?</Label>
              <MoneyInput value={exForm.monto} onChange={v => setExForm(f => ({ ...f, monto: v }))} className="h-11 rounded-2xl font-bold" placeholder="0" />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={exForm.abonado} onChange={e => setExForm(f => ({ ...f, abonado: e.target.checked }))} className="accent-kiri-emerald h-4 w-4" />
              Ya se ha abonado una parte
            </label>
            {exForm.abonado && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">¿Cuánto falta por pagar hoy?</Label>
                <MoneyInput value={exForm.pendiente} onChange={v => setExForm(f => ({ ...f, pendiente: v }))} className="h-11 rounded-2xl font-bold" placeholder="0" />
                {exMonto > 0 && exPendiente > exMonto && <p className="text-xs text-destructive font-bold">No puede ser más de lo que se prestó.</p>}
                {exMonto > 0 && exPendiente > 0 && exPendiente <= exMonto && <p className="text-[10px] text-muted-foreground">Ya se abonaron {formatAmount(exMonto - exPendiente)}.</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción (opcional)</Label>
              <Input placeholder="Ej: Lo del arreglo del carro" value={exForm.descripcion} onChange={e => setExForm(f => ({ ...f, descripcion: e.target.value }))} className="h-11 rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">¿Cuándo se paga? (opcional)</Label>
              <SelectorFecha value={exForm.fechaCompromiso} onChange={v => setExForm(f => ({ ...f, fechaCompromiso: v }))} />
            </div>
            {exOtro && <p className="text-[10px] text-muted-foreground">Le llegará un aviso a {exOtro.nombre.split(" ")[0]} para que lo confirme.</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setExistenteOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button disabled={!exValido || registrando} onClick={handleExistente} className="rounded-xl bg-cyclon-lavender text-white font-bold px-6">
              {registrando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
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

      {/* ════ Modal Cancelar préstamo ════ */}
      <Dialog open={!!cancelLoanId} onOpenChange={v => { if (!v) { setCancelLoanId(null); setCancelReason(""); setCancelCustom("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar préstamo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">¿Por qué cancelas este préstamo?</p>
            {["Ya me pagó todo", "Se arrepintió y me devolvió la plata", "Me arrepentí", "Aprobé por error"].map(reason => (
              <button key={reason} onClick={() => setCancelReason(reason)}
                className={cn("w-full text-left p-3 rounded-xl border-2 text-xs font-bold transition-colors",
                  cancelReason === reason ? "border-kiri-emerald bg-kiri-emerald/5 text-kiri-emerald" : "border-muted text-muted-foreground")}>
                {reason}
              </button>
            ))}
            <button onClick={() => setCancelReason("otro")}
              className={cn("w-full text-left p-3 rounded-xl border-2 text-xs font-bold transition-colors",
                cancelReason === "otro" ? "border-kiri-emerald bg-kiri-emerald/5 text-kiri-emerald" : "border-muted text-muted-foreground")}>
              Otro motivo
            </button>
            {cancelReason === "otro" && (
              <Input value={cancelCustom} onChange={e => setCancelCustom(e.target.value)} placeholder="Describe el motivo..." className="rounded-xl" />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCancelLoanId(null)}>Volver</Button>
            <Button
              disabled={!cancelReason || (cancelReason === "otro" && !cancelCustom)}
              onClick={async () => {
                if (!cancelLoanId) return
                setActionId(cancelLoanId)
                // Cancelar préstamo y devolver plata al lender
                const { error } = await loansApi.reject(cancelLoanId)
                setActionId(null)
                if (!error) {
                  toast({ title: "Préstamo cancelado", description: cancelReason === "otro" ? cancelCustom : cancelReason })
                  // Devolver al wallet del lender
                  const loan = loans.find(l => l.id === cancelLoanId)
                  if (loan) await userApi.walletIncome(Number(loan.amount), 'extra')
                }
                setCancelLoanId(null); setCancelReason(""); setCancelCustom("")
                load()
              }}
              className="bg-destructive text-white font-bold rounded-xl"
            >
              Confirmar cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
