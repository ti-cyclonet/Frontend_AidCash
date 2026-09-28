"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePlan } from "@/lib/plan-context"
import {
  Check, Sparkles, Crown, ExternalLink, FileSignature, LogIn, AlertTriangle,
  Loader2, Eye, EyeOff, CheckCircle2, Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { planApi, type FactonetInfo, type PlanDisponible } from "@/lib/api-client"

/**
 * Mi plan — cambiarse de plan sin salir de Kiri y acceso a FactoNet.
 *
 * Al cambiarse a un plan pago, Authoriza crea el contrato y le da al usuario
 * acceso a FactoNet (la plataforma de facturación de Cyclonet), donde entra con
 * el MISMO correo y contraseña de Kiri para firmar su contrato, ver sus
 * facturas y reportar sus pagos. Cuando FactoNet emite una factura (o vence),
 * Kiri recibe el aviso y al tocarlo se llega a la sección #factonet de aquí.
 */

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value)
const fechaLarga = (f?: string | null) => f ? new Date(`${f}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : null

const EVENTO_FACTURA: Record<string, { titulo: string; tono: "amber" | "red" }> = {
  emitida: { titulo: "Tienes una factura pendiente por pagar", tono: "amber" },
  vence_hoy: { titulo: "Tu factura vence hoy", tono: "amber" },
  aviso_mora: { titulo: "Tu factura está vencida", tono: "red" },
  recargo: { titulo: "Tu factura ya tiene recargo por mora", tono: "red" },
  suspendida: { titulo: "Tu plan está suspendido por falta de pago", tono: "red" },
  pago_rechazado: { titulo: "No pudimos confirmar tu pago", tono: "red" },
}

export default function MiPlanPage() {
  const { plan, loading: planLoading } = usePlan()
  const { toast } = useToast()
  const [planes, setPlanes] = useState<PlanDisponible[] | null>(null)
  const [factonet, setFactonet] = useState<FactonetInfo | null>(null)
  const [elegido, setElegido] = useState<PlanDisponible | null>(null)
  const [password, setPassword] = useState("")
  const [verPassword, setVerPassword] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorCambio, setErrorCambio] = useState<string | null>(null)
  const [listo, setListo] = useState<string | null>(null)
  const [resaltar, setResaltar] = useState(false)
  const factonetRef = useRef<HTMLDivElement>(null)

  const cargarPlanes = useCallback(async () => {
    setPlanes(null)
    const { data } = await planApi.disponibles()
    setPlanes(Array.isArray(data) ? [...data].sort((a, b) => a.displayOrder - b.displayOrder) : [])
    return Array.isArray(data) && data.length > 0
  }, [])
  const cargar = useCallback(() => {
    // Si Authoriza no respondió (p. ej. estaba arrancando), un reintento solo
    cargarPlanes().then(ok => { if (!ok) setTimeout(() => { cargarPlanes() }, 3000) })
    planApi.factonet().then(({ data }) => { if (data) setFactonet(data) })
  }, [cargarPlanes])
  useEffect(() => { cargar() }, [cargar])

  // Desde el aviso de factura (/mi-plan#factonet): llevar a la sección y resaltarla
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#factonet" || !factonet) return
    const t = setTimeout(() => {
      factonetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      setResaltar(true)
      setTimeout(() => setResaltar(false), 2500)
    }, 200)
    return () => clearTimeout(t)
  }, [factonet])

  const planActual = (plan?.planName ?? "").toLowerCase()
  const esActual = (p: PlanDisponible) => {
    const n = (p.displayName || p.name).toLowerCase()
    return !!planActual && (planActual.includes(n) || n.includes(planActual))
  }
  const tienePlanPago = !!plan?.isBillable || /plus|pro/i.test(plan?.planName ?? "")
  const cambioPendiente = factonet?.cambioPlan
  const factura = factonet?.facturaPendiente
  const mostrarFactonet = tienePlanPago || !!cambioPendiente || !!factura

  const abrirFactonet = () => { if (factonet?.url) window.open(factonet.url, "_blank", "noopener") }

  const abrirCambio = (p: PlanDisponible) => {
    setElegido(p); setPassword(""); setAcepta(false); setErrorCambio(null); setVerPassword(false)
  }

  const confirmarCambio = async () => {
    if (!elegido || !password || !acepta) return
    setEnviando(true)
    setErrorCambio(null)
    const nombre = elegido.displayName || elegido.name
    const { data, error } = await planApi.cambiar({ packageId: elegido.packageId, packageName: nombre, password, acceptTerms: true, acceptHabeasData: true })
    setEnviando(false)
    if (error || !data?.success) { setErrorCambio(error ?? "No se pudo cambiar de plan. Intenta de nuevo."); return }
    setElegido(null)
    setListo(nombre)
    toast({ title: `Solicitaste ${nombre}`, description: "Tu contrato quedó listo en FactoNet." })
    cargar()
  }

  if (planLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  const eventoFactura = factura ? EVENTO_FACTURA[factura.evento] ?? EVENTO_FACTURA.emitida : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Mi plan</h1>
        <div className="text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
          {plan?.hasPlan ? <>Tu plan actual: <Badge className="bg-kiri-emerald/15 text-kiri-emerald border-0">{plan.planName}</Badge></> : "No tienes un plan activo"}
        </div>
      </div>

      {/* Factura pendiente (avisada por FactoNet) */}
      {factura && eventoFactura && (
        <div className={cn("rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3",
          eventoFactura.tono === "red" ? "border-red-500/40 bg-red-500/5" : "border-amber-500/40 bg-amber-500/5")}>
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", eventoFactura.tono === "red" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600")}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{eventoFactura.titulo}</p>
            <p className="text-xs text-muted-foreground">
              Factura {factura.codigo} · <strong className="text-foreground">{formatCOP(factura.valor)}</strong>
              {factura.vence && <> · vence el {fechaLarga(factura.vence)}</>}
            </p>
          </div>
          <Button onClick={abrirFactonet} className="gap-2 shrink-0">
            Ver y pagar en FactoNet <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Cambio pedido y pendiente de firma / pago */}
      {(cambioPendiente || listo) && !factura && (
        <div className="rounded-2xl border border-kiri-emerald/30 bg-kiri-emerald/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-kiri-emerald/10 text-kiri-emerald flex items-center justify-center shrink-0">
            <FileSignature className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Solicitaste {listo ?? cambioPendiente?.plan ?? "un nuevo plan"}: tu contrato está listo</p>
            <p className="text-xs text-muted-foreground">Entra a FactoNet con tu mismo correo y contraseña de Kiri para firmarlo. Mientras tanto sigues usando tu plan actual; el nuevo se activa al firmar y pagar la primera factura.</p>
          </div>
          <Button onClick={abrirFactonet} variant="outline" className="gap-2 shrink-0 border-kiri-emerald/40 text-kiri-emerald">
            Firmar en FactoNet <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Planes */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Planes</h2>
        {planes === null ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map(i => <div key={i} className="h-64 rounded-2xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : planes.length === 0 ? (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">No pudimos cargar los planes en este momento.</p>
            <Button variant="outline" size="sm" onClick={() => cargarPlanes()}>Reintentar</Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {planes.map(p => {
              const actual = esActual(p)
              const nombre = p.displayName || p.name
              const pendiente = cambioPendiente?.packageId === p.packageId
              return (
                <div key={p.packageId} className={cn("relative rounded-2xl border-2 p-5 flex flex-col gap-4 bg-card",
                  actual ? "border-kiri-emerald" : p.isHighlighted ? "border-amber-400/60" : "border-border")}>
                  {(actual || p.badge) && (
                    <span className={cn("absolute -top-3 left-5 text-[10px] font-black px-2.5 py-1 rounded-full",
                      actual ? "bg-kiri-emerald text-white" : "bg-amber-400 text-amber-950")}>
                      {actual ? "Tu plan actual" : p.badge}
                    </span>
                  )}
                  <div>
                    <p className="font-bold flex items-center gap-1.5">{p.isHighlighted && <Crown className="h-4 w-4 text-amber-500" />}{nombre}</p>
                    <p className="text-2xl font-black mt-1">{p.price > 0 ? <>{formatCOP(p.price)}<span className="text-xs font-medium text-muted-foreground"> / mes</span></> : "Gratis"}</p>
                    {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {p.features.slice(0, 8).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-kiri-emerald shrink-0 mt-0.5" />{f}</li>
                    ))}
                  </ul>
                  {actual ? (
                    <Button disabled variant="outline" className="w-full gap-2"><CheckCircle2 className="h-4 w-4" /> Es tu plan</Button>
                  ) : pendiente ? (
                    <Button onClick={abrirFactonet} variant="outline" className="w-full gap-2"><Clock className="h-4 w-4" /> Pendiente de firma</Button>
                  ) : p.price === 0 && tienePlanPago ? (
                    <p className="text-[11px] text-muted-foreground text-center">Para volver al plan gratis, escríbenos desde Perfil → Soporte.</p>
                  ) : (
                    <Button onClick={() => abrirCambio(p)} className={cn("w-full gap-2", p.isHighlighted && "bg-amber-500 hover:bg-amber-600 text-white")}>
                      <Sparkles className="h-4 w-4" /> Cambiarme a {nombre}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Acceso a FactoNet */}
      <section id="factonet" ref={factonetRef}
        className={cn("rounded-2xl border-2 p-5 space-y-4 scroll-mt-20 transition-shadow",
          resaltar ? "border-kiri-emerald shadow-[0_0_0_6px_rgba(16,185,129,0.15)]" : "border-border")}>
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-2xl bg-sky-500/10 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/factonet.png" alt="FactoNet" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold">Tu contrato y tus facturas: FactoNet</h2>
            <p className="text-sm text-muted-foreground">
              FactoNet es la plataforma de facturación de Cyclonet. Ahí ves tu contrato, lo firmas, consultas tus facturas y reportas tus pagos.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-muted/40 p-3 flex items-start gap-2 text-sm">
          <LogIn className="h-4 w-4 text-kiri-emerald shrink-0 mt-0.5" />
          <p>
            Inicia sesión con <strong>los mismos datos con los que entras a Kiri</strong>
            {factonet?.correo && <>: tu correo <strong className="break-all">{factonet.correo}</strong> y tu contraseña de Kiri</>}.
          </p>
        </div>

        {mostrarFactonet ? (
          <ol className="grid gap-2 sm:grid-cols-3 text-xs">
            {[
              { n: 1, t: "Entra a FactoNet", d: "Con tu correo y contraseña de Kiri." },
              { n: 2, t: "Contratos", d: "Revisa y firma el contrato de tu plan." },
              { n: 3, t: "Facturas", d: "Mira tu factura, descárgala y reporta tu pago." },
            ].map(p => (
              <li key={p.n} className="rounded-xl border border-border p-3">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-kiri-emerald text-white text-[10px] font-black mr-1.5">{p.n}</span>
                <strong>{p.t}</strong>
                <p className="text-muted-foreground mt-1">{p.d}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">Cuando te cambies a un plan pago, aquí tendrás el acceso a tu contrato y a tus facturas.</p>
        )}

        <Button onClick={abrirFactonet} disabled={!factonet?.url || !mostrarFactonet} className="gap-2">
          Ir a FactoNet <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </section>

      {/* Confirmar cambio de plan */}
      <Dialog open={!!elegido} onOpenChange={v => { if (!v && !enviando) setElegido(null) }}>
        <DialogContent className="sm:max-w-md [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" /> Cambiarme a {elegido?.displayName || elegido?.name}</DialogTitle>
            <DialogDescription>
              {elegido && elegido.price > 0 ? `${formatCOP(elegido.price)} al mes.` : "Sin costo."} Así funciona:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-1.5 text-sm">
            <li className="flex gap-2"><span className="font-black text-kiri-emerald">1.</span> Creamos tu contrato con el nuevo plan.</li>
            <li className="flex gap-2"><span className="font-black text-kiri-emerald">2.</span> Lo firmas en FactoNet, con tu mismo usuario de Kiri.</li>
            <li className="flex gap-2"><span className="font-black text-kiri-emerald">3.</span> Te llega la factura (aquí en Kiri también te avisamos) y, al pagarla, se activa tu plan.</li>
          </ol>
          <p className="text-xs text-muted-foreground">Mientras tanto sigues usando tu plan actual sin perder nada.</p>
          <div className="space-y-1.5">
            <Label htmlFor="pwd-plan" className="text-xs font-bold">Confirma con tu contraseña de Kiri</Label>
            <div className="relative">
              <Input id="pwd-plan" type={verPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" className="pr-10" onKeyDown={e => { if (e.key === "Enter") confirmarCambio() }} />
              <button type="button" onClick={() => setVerPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} className="accent-kiri-emerald h-4 w-4 mt-0.5" />
            <span>Acepto los términos del servicio de Cyclonet y el tratamiento de mis datos personales para la contratación y facturación.</span>
          </label>
          {errorCambio && <p className="text-xs font-bold text-destructive bg-destructive/10 rounded-lg p-2">{errorCambio}</p>}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setElegido(null)} disabled={enviando}>Cancelar</Button>
            <Button onClick={confirmarCambio} disabled={!password || !acepta || enviando} className="gap-2">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
