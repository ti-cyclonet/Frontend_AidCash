"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HandCoins, MessageCircle, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Undo2, Copy, PiggyBank, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useToast } from "@/hooks/use-toast"
import { externalLoansApi, savingsPocketsApi, inviteLinksApi, urlInvitacion, type ExternalLoan, type ExternalLoansResumen } from "@/lib/api-client"
import { useGastoLibre } from "@/hooks/use-gasto-libre"
import { tr, localeFecha } from "@/lib/i18n"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * "Me deben" — plata prestada a personas que NO usan Kiri
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Los préstamos de Social exigen que las dos personas tengan cuenta. Acá el
 * usuario lleva su propio registro: a quién le prestó, cuánto le deben, cuándo
 * le prometieron pagar y los abonos que le van haciendo. Para cobrar, un toque
 * abre WhatsApp con el mensaje ya redactado (la otra persona no necesita Kiri).
 */

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Las fechas llegan como DATE (medianoche UTC) — se leen en UTC para no correr un día. */
function fmtFecha(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).toLocaleDateString(localeFecha(), { day: "numeric", month: "short" })
}
const aInputDate = (iso: string | null) => (iso ? iso.slice(0, 10) : "")

/** Número para wa.me: solo dígitos; un celular colombiano de 10 dígitos recibe el 57. */
function numeroWhatsApp(tel: string | null): string {
  const d = (tel ?? "").replace(/\D/g, "")
  if (d.length === 10 && d.startsWith("3")) return `57${d}`
  return d
}

function mensajeCobro(l: ExternalLoan, formatAmount: (n: number) => string): string {
  const nombre = l.persona.split(" ")[0]
  const base = tr("Hola {0} 👋, te escribo por los {1} que te presté", [nombre, formatAmount(l.saldoPendiente)])
  if (l.fechaCompromiso && (l.diasParaCompromiso ?? 0) < 0) return tr("{0} y que quedamos en saldar el {1}. ¿Cuándo me los puedes pasar? ¡Gracias!", [base, fmtFecha(l.fechaCompromiso)])
  if (l.fechaCompromiso && l.diasParaCompromiso === 0) return tr("{0}. Te recuerdo que quedamos en que hoy me los pasabas. ¡Gracias!", [base])
  if (l.fechaCompromiso) return tr("{0}. Te recuerdo que quedamos para el {1}. ¡Gracias!", [base, fmtFecha(l.fechaCompromiso)])
  return tr("{0}. ¿Cuándo crees que me los puedas pasar? ¡Gracias!", [base])
}

function estadoFecha(l: ExternalLoan): { label: string; className: string } | null {
  if (l.estado === "pagado") return { label: tr("Pagado ✓"), className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" }
  if (l.estado === "perdonado") return { label: tr("Perdonado"), className: "bg-muted text-muted-foreground" }
  const d = l.diasParaCompromiso
  if (d === null) return { label: tr("Sin fecha"), className: "bg-muted text-muted-foreground" }
  if (d < 0) return { label: tr("Vencido ({0}d)", [-d]), className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" }
  if (d === 0) return { label: tr("Paga hoy"), className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" }
  return { label: tr("Paga en {0}d", [d]), className: "bg-muted text-muted-foreground" }
}

type FormState = { persona: string; telefono: string; monto: string; fechaPrestamo: string; fechaCompromiso: string; nota: string; salioDeBilletera: boolean }
const emptyForm = (): FormState => ({ persona: "", telefono: "", monto: "", fechaPrestamo: hoyISO(), fechaCompromiso: "", nota: "", salioDeBilletera: true })

export function MeDebenTab() {
  const { formatAmount } = useAppContext()
  const { toast } = useToast()
  const [loans, setLoans] = useState<ExternalLoan[]>([])
  const [resumen, setResumen] = useState<ExternalLoansResumen | null>(null)
  // Lo que se puede prestar: el gasto libre (libre + capacidad de
  // endeudamiento, igual que en Billetera) y, si no alcanza, todo el
  // disponible de la billetera.
  // El gasto libre sale del MISMO cálculo que la tarjeta de Billetera (antes
  // venía de los bolsillos guardados y no coincidía con lo que el usuario ve).
  const [disponibleServidor, setDisponible] = useState<{ gastoLibre: number; total: number }>({ gastoLibre: 0, total: 0 })
  const billetera = useGastoLibre()
  const disponible = billetera.loaded
    ? { gastoLibre: Math.min(billetera.gastoLibre, Math.max(0, billetera.total)), total: Math.max(0, billetera.total) }
    : disponibleServidor
  const [loading, setLoading] = useState(true)
  const [showCerrados, setShowCerrados] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data } = await externalLoansApi.list()
    if (data) { setLoans(data.loans); setResumen(data.resumen); setDisponible(data.disponible) }
    setLoading(false)
  }, [])
  useEffect(() => {
    refresh()
    // El disponible cambia también desde otras pantallas (gastos, pagos…).
    window.addEventListener("kiri:wallet-updated", refresh)
    return () => window.removeEventListener("kiri:wallet-updated", refresh)
  }, [refresh])

  const walletChanged = () => window.dispatchEvent(new Event("kiri:wallet-updated"))

  // ── Disponible insuficiente para prestar ───────────────────────────────────
  // Si lo que se va a prestar supera TODO el disponible de la billetera, se
  // ofrece sacar la diferencia de un bolsillo de ahorro (vuelve al disponible)
  // y luego registrar el préstamo — o cancelar. `reintentar` es la operación
  // original (crear o "le presté más") que se repite tras retirar del ahorro.
  const [insuficiente, setInsuficiente] = useState<{ monto: number; falta: number; reintentar: () => Promise<void> } | null>(null)
  const [pockets, setPockets] = useState<{ id: string; nombre: string; montoActual: number }[]>([])
  const [retirando, setRetirando] = useState(false)
  const abrirInsuficiente = async (monto: number, reintentar: () => Promise<void>) => {
    const falta = Math.max(0, Math.round((monto - disponible.total) * 100) / 100)
    setInsuficiente({ monto, falta, reintentar })
    const { data } = await savingsPocketsApi.list()
    setPockets((data?.pockets ?? []).map(p => ({ id: p.id, nombre: p.nombre, montoActual: Number(p.montoActual) })))
  }
  const sacarDeAhorro = async (pocketId: string) => {
    if (!insuficiente) return
    setRetirando(true)
    const { error } = await savingsPocketsApi.withdraw(pocketId, insuficiente.falta)
    if (error) {
      setRetirando(false)
      toast({ title: tr("No se pudo retirar del ahorro"), description: error, variant: "destructive" })
      return
    }
    walletChanged()
    const { data } = await externalLoansApi.list()
    if (data) setDisponible(data.disponible)
    await insuficiente.reintentar()
    setRetirando(false)
    setInsuficiente(null)
  }

  // ── Crear / editar ──────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ExternalLoan | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormOpen(true) }
  const openEdit = (l: ExternalLoan) => {
    setEditing(l)
    setForm({ persona: l.persona, telefono: l.telefono ?? "", monto: String(l.montoPrestado), fechaPrestamo: aInputDate(l.fechaPrestamo), fechaCompromiso: aInputDate(l.fechaCompromiso), nota: l.nota ?? "", salioDeBilletera: l.montoDesdeBilletera > 0 })
    setFormOpen(true)
  }
  const saveForm = async (omitirChequeo = false) => {
    if (!form.persona.trim() || (!editing && Number(form.monto) <= 0)) return
    if (!editing && form.salioDeBilletera && !omitirChequeo && Number(form.monto) > disponible.total) {
      abrirInsuficiente(Number(form.monto), () => saveForm(true))
      return
    }
    setSaving(true)
    const { error } = editing
      ? await externalLoansApi.update(editing.id, { persona: form.persona, telefono: form.telefono || null, fechaCompromiso: form.fechaCompromiso || null, nota: form.nota || null })
      : await externalLoansApi.create({ persona: form.persona, telefono: form.telefono || null, monto: Number(form.monto), fechaPrestamo: form.fechaPrestamo || undefined, fechaCompromiso: form.fechaCompromiso || null, nota: form.nota || null, salioDeBilletera: form.salioDeBilletera })
    setSaving(false)
    if (error) { toast({ title: tr("No se pudo guardar"), description: error, variant: "destructive" }); return }
    setFormOpen(false)
    if (!editing && form.salioDeBilletera) walletChanged()
    refresh()
  }

  // ── Abono / prestar más ─────────────────────────────────────────────────────
  const [montoTarget, setMontoTarget] = useState<{ loan: ExternalLoan; tipo: "abono" | "ampliar" } | null>(null)
  const [montoValue, setMontoValue] = useState("")
  const [montoBilletera, setMontoBilletera] = useState(true)
  const [montoNota, setMontoNota] = useState("")
  const openMonto = (loan: ExternalLoan, tipo: "abono" | "ampliar") => {
    setMontoTarget({ loan, tipo }); setMontoValue(tipo === "abono" ? String(loan.saldoPendiente) : ""); setMontoBilletera(true); setMontoNota("")
  }
  const saveMonto = async (omitirChequeo = false) => {
    if (!montoTarget || Number(montoValue) <= 0) return
    if (montoTarget.tipo === "ampliar" && montoBilletera && !omitirChequeo && Number(montoValue) > disponible.total) {
      abrirInsuficiente(Number(montoValue), () => saveMonto(true))
      return
    }
    setSaving(true)
    const { loan, tipo } = montoTarget
    const res = tipo === "abono"
      ? await externalLoansApi.abono(loan.id, { monto: Number(montoValue), entraABilletera: montoBilletera, nota: montoNota || null })
      : await externalLoansApi.ampliar(loan.id, { monto: Number(montoValue), salioDeBilletera: montoBilletera, nota: montoNota || null })
    setSaving(false)
    if (res.error) { toast({ title: tr("No se pudo guardar"), description: res.error, variant: "destructive" }); return }
    if (tipo === "abono" && (res.data as { saldado?: boolean })?.saldado) toast({ title: tr("🎉 {0} terminó de pagarte", [loan.persona]), description: tr("Recuperaste {0}.", [formatAmount(loan.montoPrestado)]) })
    setMontoTarget(null)
    if (montoBilletera) walletChanged()
    refresh()
  }

  const accion = async (fn: () => Promise<{ error: string | null }>, afectaBilletera = false) => {
    const { error } = await fn()
    if (error) { toast({ title: tr("No se pudo completar"), description: error, variant: "destructive" }); return }
    if (afectaBilletera) walletChanged()
    refresh()
  }

  const [confirm, setConfirm] = useState<{ loan: ExternalLoan; tipo: "perdonar" | "eliminar" } | null>(null)

  // El recordatorio también invita a Kiri: quien te debe recibe tu enlace (con
  // 14 días de PLUS gratis). Se pide antes para que WhatsApp abra al instante.
  const [enlace, setEnlace] = useState<string | null>(null)
  useEffect(() => {
    inviteLinksApi.get("FRIEND").then(({ data }) => { if (data?.code) setEnlace(urlInvitacion(data.code)) }).catch(() => {})
  }, [])
  const mensajeConInvitacion = (l: ExternalLoan) => mensajeCobro(l, formatAmount)
    + (enlace ? `\n\n${tr("P.D.: yo llevo mis cuentas en Kiri 🌱 Si quieres organizar tu plata, entra con mi enlace y tienes 14 días de KIRI PLUS gratis:")} ${enlace}` : "")

  const recordar = (l: ExternalLoan) => {
    const url = `https://wa.me/${numeroWhatsApp(l.telefono)}?text=${encodeURIComponent(mensajeConInvitacion(l))}`
    window.open(url, "_blank", "noopener,noreferrer")
  }
  const copiarMensaje = async (l: ExternalLoan) => {
    try {
      await navigator.clipboard.writeText(mensajeConInvitacion(l))
      toast({ title: tr("Mensaje copiado"), description: tr("Pégalo en el chat que prefieras.") })
    } catch { /* sin permiso de portapapeles */ }
  }

  const activos = loans.filter(l => l.estado === "activo")
  const cerrados = loans.filter(l => l.estado !== "activo")

  const renderLoan = (l: ExternalLoan) => {
    const est = estadoFecha(l)
    const pct = l.montoPrestado > 0 ? Math.round((l.montoRecuperado / l.montoPrestado) * 100) : 0
    const abierto = expanded === l.id
    return (
      <Card key={l.id} className={cn("border-none shadow-sm", l.vencido && "ring-1 ring-red-500/40", l.estado !== "activo" && "opacity-70")}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 font-black">
                {l.persona.trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm truncate">{l.persona}</h3>
                  {est && <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", est.className)}>{est.label}</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">{tr("Le prestaste el {0}{1}", [fmtFecha(l.fechaPrestamo), l.fechaCompromiso && l.estado === "activo" && tr(" · prometió pagar el {0}", [fmtFecha(l.fechaCompromiso)])])}</p>
                {l.nota && <p className="text-[10px] text-muted-foreground italic truncate">&ldquo;{l.nota}&rdquo;</p>}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openEdit(l)} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted" aria-label={tr("Editar")}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setConfirm({ loan: l, tipo: "eliminar" })} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10" aria-label={tr("Eliminar")}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">{l.estado === "perdonado" ? tr("No recuperado") : tr("Te debe")}</p>
              <p className="text-xl font-black">{formatAmount(l.saldoPendiente)}</p>
            </div>
            <p className="text-[10px] text-muted-foreground text-right">{tr("de")}{" "}{formatAmount(l.montoPrestado)}{" "}{tr("prestados")}{l.montoRecuperado > 0 && <><br /><span className="text-kiri-emerald font-bold">{tr("Recuperado {0}", [formatAmount(l.montoRecuperado)])}</span></>}
            </p>
          </div>
          <Progress value={pct} className="h-1.5" indicatorClassName="bg-kiri-emerald" />

          {l.estado === "activo" && (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => openMonto(l, "abono")} size="sm" className="rounded-xl h-9 font-bold text-xs bg-kiri-emerald/10 text-kiri-emerald hover:bg-kiri-emerald/20 border-none">{tr("Me abonó")}</Button>
              <Button onClick={() => recordar(l)} size="sm" className="rounded-xl h-9 font-bold text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-none gap-1">
                <MessageCircle className="h-3.5 w-3.5" />{" "}{tr("Recordarle")}</Button>
            </div>
          )}

          <button onClick={() => setExpanded(abierto ? null : l.id)} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground">
            {abierto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} {abierto ? tr("Menos") : tr("Más opciones{0}", [l.payments.length ? tr(" · {0} abono{1}", [l.payments.length, l.payments.length > 1 ? "s" : ""]) : ""])}
          </button>

          {abierto && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex flex-wrap gap-2">
                {l.estado !== "perdonado" && (
                  <Button variant="outline" size="sm" className="rounded-xl text-[10px] h-8" onClick={() => openMonto(l, "ampliar")}>
                    <Plus className="h-3 w-3" />{" "}{tr("Le presté más")}</Button>
                )}
                {l.estado === "activo" && (
                  <>
                    <Button variant="outline" size="sm" className="rounded-xl text-[10px] h-8" onClick={() => copiarMensaje(l)}>
                      <Copy className="h-3 w-3" />{" "}{tr("Copiar mensaje")}</Button>
                    <Button variant="outline" size="sm" className="rounded-xl text-[10px] h-8 text-muted-foreground" onClick={() => setConfirm({ loan: l, tipo: "perdonar" })}>{tr("Darla por perdida")}</Button>
                  </>
                )}
                {l.estado === "perdonado" && (
                  <Button variant="outline" size="sm" className="rounded-xl text-[10px] h-8" onClick={() => accion(() => externalLoansApi.reabrir(l.id))}>{tr("Volver a cobrar")}</Button>
                )}
              </div>
              {l.payments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase text-muted-foreground">{tr("Abonos recibidos")}</p>
                  {l.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-[11px] bg-muted/20 rounded-lg px-3 py-1.5">
                      <span>
                        {new Date(p.createdAt).toLocaleDateString(localeFecha(), { day: "numeric", month: "short" })} · <strong>{formatAmount(p.monto)}</strong>
                        {!p.entraABilletera && <span className="text-muted-foreground">{" "}{tr("· fuera de Kiri")}</span>}
                        {p.nota && <span className="text-muted-foreground"> · {p.nota}</span>}
                      </span>
                      <button onClick={() => accion(() => externalLoansApi.deshacerAbono(l.id, p.id), p.entraABilletera)} className="text-muted-foreground hover:text-foreground" aria-label={tr("Deshacer abono")}>
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Disponible para prestar (y, abajo, lo que ya te deben) */}
      <Card className="border-none bg-gradient-to-br from-amber-500/10 to-amber-500/5 shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0"><HandCoins className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">{tr("Disponible para prestar")}</p>
                <p className="text-xl font-black">{formatAmount(disponible.gastoLibre > 0 ? disponible.gastoLibre : disponible.total)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {disponible.gastoLibre > 0
                    ? (disponible.total > disponible.gastoLibre ? tr("Tu gasto libre · hasta {0} con todo tu disponible", [formatAmount(disponible.total)]) : tr("Tu gasto libre"))
                    : disponible.total > 0
                      ? tr("Tu gasto libre está en $0 — puedes usar tu disponible")
                      : <span className="text-red-500 font-bold">{tr("No tienes disponible en tu billetera")}</span>}
                </p>
              </div>
            </div>
            <Button onClick={openCreate} size="sm" className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1 shrink-0">
              <Plus className="h-4 w-4" />{" "}{tr("Presté plata")}</Button>
          </div>
          {(resumen?.porCobrar ?? 0) > 0 && (
            <div className="flex items-center justify-between text-[11px] bg-background/60 rounded-xl px-3 py-2">
              <span className="text-muted-foreground">{tr("Te deben")}{" "}<strong className="text-foreground">{formatAmount(resumen!.porCobrar)}</strong>
                {" · "}{resumen!.personas}{" "}{tr("persona")}{resumen!.personas > 1 ? "s" : ""}
              </span>
              {resumen!.vencidos > 0 && <span className="text-red-500 font-bold">{resumen!.vencidos}{" "}{tr("vencido")}{resumen!.vencidos > 1 ? "s" : ""}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground px-1">{tr("Para personas que no usan Kiri. Si la otra persona también tiene Kiri, usa Préstamos en Social y cada abono se confirma entre los dos.")}</p>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">{tr("Cargando...")}</p>
      ) : activos.length === 0 && cerrados.length === 0 ? (
        <button onClick={openCreate} className="w-full border-2 border-dashed border-muted rounded-2xl p-6 text-sm text-muted-foreground hover:border-amber-500/40 hover:text-amber-600 transition-colors flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" />{" "}{tr("Registra la plata que prestaste")}</button>
      ) : (
        <>
          {activos.map(renderLoan)}
          {cerrados.length > 0 && (
            <div className="space-y-2">
              <button onClick={() => setShowCerrados(v => !v)} className="w-full flex items-center justify-between px-1 text-xs font-bold text-muted-foreground hover:text-foreground">
                <span>{tr("Pagados y perdonados ({0})", [cerrados.length])}</span>
                {showCerrados ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showCerrados && cerrados.map(renderLoan)}
            </div>
          )}
        </>
      )}

      {/* Crear / editar */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v && !saving) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? tr("Editar préstamo a {0}", [editing.persona]) : tr("Presté plata")}</DialogTitle>
            <DialogDescription>{editing ? tr("Contacto, fecha prometida o nota. Para cambiar el monto usa “Le presté más” o registra un abono.") : tr("Lleva el control aunque la otra persona no use Kiri.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("¿A quién?")}</Label>
              <Input value={form.persona} onChange={e => setForm(f => ({ ...f, persona: e.target.value }))} placeholder={tr("Ej: Carlos, mi primo")} className="h-10 rounded-xl" autoFocus />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{tr("¿Cuánto?")}</Label>
                <MoneyInput value={form.monto} onChange={v => setForm(f => ({ ...f, monto: v }))} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Celular")}{" "}<span className="font-normal text-muted-foreground">{tr("(opcional, para recordarle por WhatsApp)")}</span></Label>
              <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="300 123 4567" inputMode="tel" className="h-10 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {!editing && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{tr("Le presté el")}</Label>
                  <Input type="date" value={form.fechaPrestamo} max={hoyISO()} onChange={e => setForm(f => ({ ...f, fechaPrestamo: e.target.value }))} className="h-10 rounded-xl" />
                </div>
              )}
              <div className={cn("space-y-1.5", editing && "col-span-2")}>
                <Label className="text-xs font-bold">{tr("Prometió pagar el")}{" "}<span className="font-normal text-muted-foreground">{tr("(opcional)")}</span></Label>
                <Input type="date" value={form.fechaCompromiso} onChange={e => setForm(f => ({ ...f, fechaCompromiso: e.target.value }))} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Nota")}{" "}<span className="font-normal text-muted-foreground">{tr("(opcional)")}</span></Label>
              <Input value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} placeholder={tr("Ej: para el arriendo")} className="h-10 rounded-xl" />
            </div>
            {!editing && (
              <BilleteraToggle
                value={form.salioDeBilletera}
                onChange={v => setForm(f => ({ ...f, salioDeBilletera: v }))}
                si={tr("Salió de mi billetera en Kiri")}
                no={tr("Es un préstamo viejo, solo quiero registrarlo")}
              />
            )}
            {!editing && form.salioDeBilletera && <AvisoDisponible monto={Number(form.monto)} disponible={disponible} formatAmount={formatAmount} />}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={saving} onClick={() => setFormOpen(false)}>{tr("Cancelar")}</Button>
            <Button onClick={() => saveForm()} disabled={saving || !form.persona.trim() || (!editing && Number(form.monto) <= 0)} className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl px-6">
              {saving ? "Guardando..." : editing ? tr("Guardar") : tr("Registrar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Abono / prestar más */}
      <Dialog open={!!montoTarget} onOpenChange={v => { if (!v && !saving) setMontoTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{montoTarget?.tipo === "abono" ? tr("{0} te abonó", [montoTarget.loan.persona]) : tr("Le presté más a {0}", [montoTarget?.loan.persona])}</DialogTitle>
            <DialogDescription>
              {montoTarget?.tipo === "abono" ? tr("Te debe {0}.", [formatAmount(montoTarget.loan.saldoPendiente)]) : tr("Se suma a lo que ya te debe.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <MoneyInput value={montoValue} onChange={setMontoValue} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
            {montoTarget?.tipo === "abono" && Number(montoValue) > montoTarget.loan.saldoPendiente && (
              <p className="text-[10px] text-red-500 font-bold">{tr("Es más de lo que te debe.")}</p>
            )}
            <Input value={montoNota} onChange={e => setMontoNota(e.target.value)} placeholder={tr("Nota (opcional)")} className="h-10 rounded-xl" />
            {montoTarget?.tipo === "ampliar" && montoBilletera && <AvisoDisponible monto={Number(montoValue)} disponible={disponible} formatAmount={formatAmount} />}
            {montoTarget && (
              <BilleteraToggle
                value={montoBilletera}
                onChange={setMontoBilletera}
                si={montoTarget.tipo === "abono" ? tr("Entró a mi billetera en Kiri") : tr("Salió de mi billetera en Kiri")}
                no={montoTarget.tipo === "abono" ? tr("Lo recibí por fuera (no sumar a mi disponible)") : tr("No salió de Kiri")}
              />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={saving} onClick={() => setMontoTarget(null)}>{tr("Cancelar")}</Button>
            <Button
              onClick={() => saveMonto()}
              disabled={saving || Number(montoValue) <= 0 || (montoTarget?.tipo === "abono" && Number(montoValue) > montoTarget.loan.saldoPendiente)}
              className="bg-kiri-emerald text-white font-bold rounded-xl px-6"
            >
              {saving ? "Guardando..." : tr("Registrar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disponible insuficiente */}
      <Dialog open={!!insuficiente} onOpenChange={v => { if (!v && !retirando) setInsuficiente(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-5 w-5" />{" "}{tr("No tienes disponible suficiente")}</DialogTitle>
            <DialogDescription>{tr("Quieres prestar {0} y en tu billetera tienes {1}. Te faltan", [formatAmount(insuficiente?.monto ?? 0), formatAmount(disponible.total)])}{" "}<strong>{formatAmount(insuficiente?.falta ?? 0)}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {pockets.filter(p => p.montoActual >= (insuficiente?.falta ?? 0)).map(p => (
              <button key={p.id} disabled={retirando} onClick={() => sacarDeAhorro(p.id)}
                className="w-full text-left p-3 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500 transition-colors disabled:opacity-50">
                <p className="font-bold text-sm flex items-center gap-2"><PiggyBank className="h-4 w-4 text-emerald-500" />{" "}{tr("Sacar {0} de “{1}”", [formatAmount(insuficiente?.falta ?? 0), p.nombre])}</p>
                <p className="text-[11px] text-muted-foreground pl-6">{tr("Tiene {0}. Se pasa a tu disponible y se registra el préstamo.", [formatAmount(p.montoActual)])}</p>
              </button>
            ))}
            {pockets.length > 0 && pockets.every(p => p.montoActual < (insuficiente?.falta ?? 0)) && (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">{tr("Ninguno de tus ahorros alcanza para cubrir la diferencia.")}</p>
            )}
            {pockets.length === 0 && (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">{tr("No tienes ahorros de los que sacar. Puedes prestar un monto menor.")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={retirando} onClick={() => setInsuficiente(null)} className="w-full">{retirando ? "Procesando..." : tr("Cancelar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmaciones */}
      <Dialog open={!!confirm} onOpenChange={v => { if (!v) setConfirm(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.tipo === "perdonar" ? tr("¿Dar la plata por perdida?") : tr("¿Eliminar este registro?")}</DialogTitle>
            <DialogDescription>
              {confirm?.tipo === "perdonar"
                ? tr("Los {0} que te debe {1} dejan de contar como \"por cobrar\". Queda en el historial y puedes volver a cobrarlos después.", [formatAmount(confirm.loan.saldoPendiente), confirm.loan.persona])
                : tr("Se borra como si nunca hubiera pasado: lo que salió de tu billetera por este préstamo vuelve, y los abonos que entraron se descuentan.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>{tr("Cancelar")}</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirm) return
                const { loan, tipo } = confirm
                setConfirm(null)
                if (tipo === "perdonar") await accion(() => externalLoansApi.perdonar(loan.id))
                else await accion(() => externalLoansApi.delete(loan.id), true)
              }}
            >
              {confirm?.tipo === "perdonar" ? tr("Dar por perdida") : tr("Eliminar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Cuánto sale del gasto libre y cuánto del resto del disponible, antes de confirmar. */
function AvisoDisponible({ monto, disponible, formatAmount }: { monto: number; disponible: { gastoLibre: number; total: number }; formatAmount: (n: number) => string }) {
  if (!monto || monto <= 0) return null
  if (monto > disponible.total) {
    return <p className="text-[10px] text-red-500 font-bold">{tr("Supera tu disponible ({0}). Al registrar te ofrecemos sacar la diferencia de tu ahorro.", [formatAmount(disponible.total)])}</p>
  }
  if (monto > disponible.gastoLibre) {
    const delLibre = Math.max(0, disponible.gastoLibre)
    return (
      <p className="text-[10px] text-amber-600 font-bold">
        {delLibre > 0 ? tr("{0} saldrán de tu gasto libre y {1} del resto de tu disponible.", [formatAmount(delLibre), formatAmount(monto - delLibre)]) : tr("Tu gasto libre está en $0: saldrá del resto de tu disponible ({0}).", [formatAmount(disponible.total)])}
      </p>
    )
  }
  return <p className="text-[10px] text-muted-foreground">{tr("Sale de tu gasto libre ({0} disponibles).", [formatAmount(disponible.gastoLibre)])}</p>
}

function BilleteraToggle({ value, onChange, si, no }: { value: boolean; onChange: (v: boolean) => void; si: string; no: string }) {
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {[{ v: true, label: si }, { v: false, label: no }].map(opt => (
        <button key={String(opt.v)} type="button" onClick={() => onChange(opt.v)}
          className={cn("text-left text-[11px] font-bold px-3 py-2 rounded-xl border-2 transition-colors",
            value === opt.v ? "border-kiri-emerald bg-kiri-emerald/5 text-foreground" : "border-muted text-muted-foreground hover:border-kiri-emerald/30")}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
