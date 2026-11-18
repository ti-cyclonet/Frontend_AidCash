"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePlan } from "@/lib/plan-context"
import {
  Check, Sparkles, Crown, ExternalLink, FileSignature, LogIn, AlertTriangle,
  Loader2, CheckCircle2, Clock, Gift, Gauge, Infinity as InfinityIcon, TrendingUp, History, Bot,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { planApi, type FactonetInfo, type PlanDisponible, type UsoPlan } from "@/lib/api-client"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"
import { InvitaYGana } from "@/components/referidos/InvitaYGana"
import { tr, localeFecha } from "@/lib/i18n"
import { comprarEnTienda, comprasDisponibles, esNativo, PRODUCTOS, restaurarCompras } from "@/lib/nativo"

/* Plan de Authoriza → producto de suscripción en las tiendas (mismo criterio que tierDe) */
const tierTienda = (p: PlanDisponible): "PLUS" | "PRO" | null => { const t = `${p.name} ${p.displayName ?? ""}`; return /pro|cyclon/i.test(t) ? "PRO" : /plus/i.test(t) ? "PLUS" : null }
const idUsuario = () => { try { return localStorage.getItem("kiri_user_id") ?? "" } catch { return "" } }

/**
 * Mi plan — cambiarse de plan sin salir de Kiri y acceso a FactoNet.
 *
 * Orden: avisos (factura por pagar, contrato por firmar, descuento de
 * invitado), Invita y gana, FactoNet y Tu uso este mes. Los planes se ven en
 * "Cambiar de plan" (o llegando con /mi-plan#planes desde un límite).
 *
 * Al cambiarse a un plan pago, Authoriza crea el contrato y le da al usuario
 * acceso a FactoNet (la plataforma de facturación de Cyclonet), donde entra con
 * el MISMO correo y contraseña de Kiri para firmar su contrato, ver sus
 * facturas y reportar sus pagos. Cuando FactoNet emite una factura (o vence),
 * Kiri recibe el aviso y al tocarlo se llega a la sección #factonet de aquí.
 */

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value)
const fechaLarga = (f?: string | null) => f ? new Date(`${f}T12:00:00`).toLocaleDateString(localeFecha(), { day: "numeric", month: "long", year: "numeric" }) : null

/** FREE / PLUS / PRO a partir del nombre del paquete (CYCLON+ cuenta como PRO). */
const tierDe = (nombre: string) => /pro|cyclon/i.test(nombre) ? "PRO" : /plus/i.test(nombre) ? "PLUS" : "FREE"

/** Orden y nombre corto de lo que se muestra en "Tu uso este mes". */
const USO_VISIBLE: { v: string; nombre: string; mensual?: boolean }[] = [
  { v: "iaMensajesMes", nombre: tr("Mensajes con Kiri Coach"), mensual: true },
  { v: "iaDictadosMes", nombre: tr("Dictados por voz"), mensual: true },
  { v: "iaEscaneosMes", nombre: tr("Escaneos de recibos"), mensual: true },
  { v: "nCategorias", nombre: tr("Categorías") },
  { v: "nBolsillos", nombre: tr("Bolsillos") },
  { v: "nDeudas", nombre: tr("Deudas") },
  { v: "nGastosFijos", nombre: tr("Gastos fijos") },
  { v: "nMeDeben", nombre: tr("Me deben") },
  { v: "nIngresosExtra", nombre: tr("Ingresos extra") },
  { v: "nConexiones", nombre: tr("Conexiones") },
  { v: "nBolsillosCompartidos", nombre: tr("Bolsillos compartidos") },
]

const EVENTO_FACTURA: Record<string, { titulo: string; tono: "amber" | "red" }> = {
  emitida: { titulo: tr("Tienes una factura pendiente por pagar"), tono: "amber" },
  vence_hoy: { titulo: tr("Tu factura vence hoy"), tono: "amber" },
  aviso_mora: { titulo: tr("Tu factura está vencida"), tono: "red" },
  recargo: { titulo: tr("Tu factura ya tiene recargo por mora"), tono: "red" },
  suspendida: { titulo: tr("Tu plan está suspendido por falta de pago"), tono: "red" },
  pago_rechazado: { titulo: tr("No pudimos confirmar tu pago"), tono: "red" },
}

export default function MiPlanPage() {
  const { plan, loading: planLoading, refreshPlan } = usePlan()
  const { toast } = useToast()
  const [planes, setPlanes] = useState<PlanDisponible[] | null>(null)
  const [factonet, setFactonet] = useState<FactonetInfo | null>(null)
  const [elegido, setElegido] = useState<PlanDisponible | null>(null)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  /* En la app nativa los planes se compran con la tienda (App Store / Google Play): nada de enlaces de pago externos */
  const [nativo, setNativo] = useState(false)
  useEffect(() => { setNativo(esNativo()) }, [])
  const suscribirConTienda = async (p: PlanDisponible) => {
    const tier = tierTienda(p)
    if (!tier) return
    setEnviando(true)
    const r = await comprarEnTienda(idUsuario(), PRODUCTOS.planes[tier])
    setEnviando(false)
    if (r === "ok") {
      toast({ title: tr("¡Listo! Activamos {0}", [p.displayName || p.name]), description: tr("Tu plan se activa en unos segundos.") })
      window.setTimeout(() => window.location.reload(), 3500)
    } else if (r === "error") toast({ title: tr("No se pudo completar la compra en la tienda"), variant: "destructive" })
  }
  const restaurar = async () => {
    const ok = await restaurarCompras(idUsuario())
    toast({ title: ok ? tr("Revisamos tus compras") : tr("No se pudieron restaurar las compras"), description: ok ? tr("Si tenías una suscripción, se activa en unos segundos.") : undefined })
    if (ok) window.setTimeout(() => window.location.reload(), 3500)
  }
  const [errorCambio, setErrorCambio] = useState<string | null>(null)
  const [listo, setListo] = useState<string | null>(null)
  const [resaltar, setResaltar] = useState(false)
  const [ciclo, setCiclo] = useState<"monthly" | "annual">("monthly")
  // De qué oferta llegó (proyecciones, semana_lograda…): viaja con el cambio de plan (medición)
  const [origenOferta, setOrigenOferta] = useState<string | null>(null)
  useEffect(() => { try { setOrigenOferta(new URLSearchParams(window.location.search).get("origen")) } catch { /* nada */ } }, [])
  const [uso, setUso] = useState<UsoPlan | null>(null)
  const [verPlanes, setVerPlanes] = useState(false)
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("mi-plan")
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
    planApi.uso().then(({ data }) => { if (data) setUso(data) })
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

  // Desde un aviso de invitados (/mi-plan#invita): llevar a Invita y gana
  const hayReferidos = !!plan?.referidos?.niveles
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#invita" || !hayReferidos) return
    const t = setTimeout(() => document.getElementById("invita")?.scrollIntoView({ behavior: "smooth", block: "start" }), 250)
    return () => clearTimeout(t)
  }, [hayReferidos])

  // Desde un límite o una función bloqueada (/mi-plan#planes): abrir los planes
  useEffect(() => {
    const abrirSiPide = () => { if (window.location.hash === "#planes") setVerPlanes(true) }
    abrirSiPide()
    window.addEventListener("hashchange", abrirSiPide)
    return () => window.removeEventListener("hashchange", abrirSiPide)
  }, [])
  const cerrarPlanes = (v: boolean) => {
    setVerPlanes(v)
    if (!v && window.location.hash === "#planes") history.replaceState(null, "", window.location.pathname)
  }

  const tierActual = plan?.tier ?? tierDe(plan?.planName ?? "")
  // Con un plan prestado (prueba de invitado o meses ganados invitando), el
  // plan que se paga es otro (FREE, o el contrato que tenga): se puede
  // "quedarse" con el prestado comprándolo.
  // (también si Authoriza no respondió: el plan llega "sin_conexion" pero los
  // días ganados viven en Kiri y traen su fecha de fin)
  const esPrestado = plan?.fuente === "prueba" || (plan?.fuente === "sin_conexion" && !!plan.pruebaHasta)
  // Llegó invitado: 50% en el primer mes de PLUS / 30% en PRO (solo mensual)
  const descuentoDe = (p: PlanDisponible) => {
    const t = tierDe(p.displayName || p.name)
    return plan?.descuentoInvitado && ciclo === "monthly" && (t === "PLUS" || t === "PRO") ? plan.descuentoInvitado[t] : 0
  }
  const referidos = plan?.referidos
  const primerMes = plan?.primerMesInvitado
  const tierPagado = esPrestado ? (plan?.tierContrato ?? "FREE") : tierActual
  const esActual = (p: PlanDisponible) => tierDe(p.displayName || p.name) === tierPagado
  const loEstaProbando = (p: PlanDisponible) => esPrestado && tierDe(p.displayName || p.name) === tierActual
  const tienePlanPago = !!plan?.isBillable || (!esPrestado && tierActual !== "FREE" && plan?.fuente !== "acceso")
  const diasPrueba = esPrestado && plan?.pruebaHasta
    ? Math.max(0, Math.ceil((new Date(plan.pruebaHasta).getTime() - Date.now()) / 86_400_000))
    : null
  const hayAnual = !!planes?.some(p => (p.annualPrice ?? 0) > 0)
  const precioDe = (p: PlanDisponible) => ciclo === "annual" && (p.annualPrice ?? 0) > 0 ? p.annualPrice! : p.price
  const ahorroAnual = (p: PlanDisponible) => p.price > 0 && (p.annualPrice ?? 0) > 0 ? Math.round((1 - p.annualPrice! / (p.price * 12)) * 100) : 0
  const cambioPendiente = factonet?.cambioPlan
  const factura = factonet?.facturaPendiente
  const mostrarFactonet = tienePlanPago || !!cambioPendiente || !!factura

  const abrirFactonet = () => { if (factonet?.url) window.open(factonet.url, "_blank", "noopener") }
  // Directo al pago de la factura (FactoNet la abre al entrar; con PSE, tarjeta o Nequi si está el pago en línea)
  const pagarFactura = () => { const u = factonet?.urlPagar || factonet?.url; if (u) window.open(u, "_blank", "noopener") }

  const abrirCambio = (p: PlanDisponible) => {
    cerrarPlanes(false)
    setElegido(p); setAcepta(false); setErrorCambio(null)
  }

  const confirmarCambio = async () => {
    if (!elegido || !acepta) return
    setEnviando(true)
    setErrorCambio(null)
    const nombre = elegido.displayName || elegido.name
    const anual = ciclo === "annual" && (elegido.annualPrice ?? 0) > 0
    const { data, error } = await planApi.cambiar({ packageId: elegido.packageId, packageName: nombre, acceptTerms: true, acceptHabeasData: true, billingCycle: anual ? "annual" : "monthly", origen: origenOferta ?? "mi_plan" })
    setEnviando(false)
    if (error || !data?.success) { setErrorCambio(error ?? tr("No se pudo cambiar de plan. Intenta de nuevo.")); return }
    setElegido(null)
    setListo(nombre)
    toast({ title: tr("¡Ya tienes {0}!", [nombre]), description: tr("Tu plan quedó activo. La factura te llega al correo y la pagas en FactoNet.") })
    cargar(); refreshPlan()
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
      {showTutorial && <TutorialSlider module="mi-plan" onClose={dismissTutorial} />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{tr("Mi plan")}</h1>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">{tr("Tu plan actual:")}{" "}<Badge className={cn("border-0", tierActual === "PRO" ? "bg-amber-400/20 text-amber-700 dark:text-amber-300" : "bg-kiri-emerald/15 text-kiri-emerald")}>{plan?.planName ?? tr("KIRI FREE")}</Badge>
          </div>
        </div>
        <Button onClick={() => setVerPlanes(true)} className={cn("gap-2 shrink-0 w-full sm:w-auto", !tienePlanPago && "bg-amber-500 hover:bg-amber-600 text-white")}>
          <Crown className="h-4 w-4" />{" "}{tr("Cambiar de plan")}
        </Button>
      </div>

      {/* Prueba de KIRI PLUS (bienvenida o por llegar invitado): días que quedan y "quedarme" */}
      {plan?.pruebaPlus?.activa && diasPrueba !== null && (
        <div className="relative overflow-hidden rounded-2xl border border-kiri-emerald/30 bg-gradient-to-br from-emerald-50 via-background to-sky-50 p-4 dark:from-emerald-500/10 dark:via-background dark:to-sky-500/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative h-14 w-14 shrink-0">
              <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-kiri-emerald/15" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-kiri-emerald" strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray={`${Math.min(1, diasPrueba / 14) * 97.4} 97.4`} />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center leading-none"><b className="text-base font-black">{diasPrueba}</b><span className="text-[8px] font-bold text-muted-foreground">{diasPrueba === 1 ? tr("día") : tr("días")}</span></span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">{diasPrueba <= 1 ? tr("Tu prueba de KIRI PLUS termina hoy") : tr("Estás probando KIRI PLUS: te quedan {0} días", [diasPrueba])}</p>
              <p className="text-xs text-muted-foreground">{tr("Usa tus proyecciones, el historial de 2 años y Kiri Coach con 150 mensajes. Al terminar vuelves a KIRI FREE sin perder nada.")}</p>
            </div>
            <Button onClick={() => setVerPlanes(true)} className="shrink-0 gap-1.5 bg-kiri-emerald text-white hover:bg-kiri-emerald/90"><Sparkles className="h-4 w-4" />{tr("Quedarme con PLUS")}</Button>
          </div>
        </div>
      )}

      {/* Terminó la prueba hace poco: lo que tenía, para que quiera volver */}
      {plan?.pruebaPlus?.recienTerminada && !cambioPendiente && !listo && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4">
          <p className="text-sm font-black">{tr("Terminó tu prueba de KIRI PLUS")}</p>
          <p className="text-xs text-muted-foreground">{tr("Todo lo que registraste sigue aquí. Esto es lo que tenías y puedes recuperar:")}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { i: TrendingUp, t: tr("Tus proyecciones"), d: tr("El día en que quedas libre de deudas") },
              { i: History, t: tr("Historial de 2 años"), d: tr("En FREE solo ves el mes actual") },
              { i: Bot, t: tr("Kiri Coach con 150 mensajes"), d: tr("En FREE son 5 al mes") },
            ].map(x => (
              <div key={x.t} className="flex items-start gap-2 rounded-xl bg-background/70 p-2.5">
                <x.i className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div><p className="text-xs font-bold">{x.t}</p><p className="text-[11px] text-muted-foreground">{x.d}</p></div>
              </div>
            ))}
          </div>
          <Button onClick={() => { planApi.evento("oferta_click", "prueba_terminada"); setOrigenOferta("prueba_terminada"); setVerPlanes(true) }} className="mt-3 w-full gap-1.5 bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"><Crown className="h-4 w-4" />{tr("Volver a KIRI PLUS")}</Button>
          <p className="mt-1 text-[11px] text-muted-foreground">{tr("En el plan anual te sale a {0} al mes", ["$11.583"])}</p>
        </div>
      )}

      {/* Plan prestado: meses ganados invitando (la prueba tiene su propio aviso arriba) */}
      {diasPrueba !== null && !plan?.pruebaPlus?.activa && (
        <div className="rounded-2xl border border-kiri-emerald/30 bg-kiri-emerald/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-kiri-emerald/10 text-kiri-emerald flex items-center justify-center shrink-0"><Gift className="h-5 w-5" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">
              {diasPrueba <= 1 ? tr("Tus días gratis de {0} terminan hoy", [plan?.planName]) : tr("Tienes {0} gratis: te quedan {1} días", [plan?.planName, diasPrueba])}
            </p>
            <p className="text-xs text-muted-foreground">{tr("Por llegar invitado o por invitar amigos. Al terminar vuelves a {0} sin perder nada de lo que registraste.", [plan?.tierContrato ? `KIRI ${plan.tierContrato}` : tr("KIRI FREE")])}</p>
          </div>
        </div>
      )}

      {/* Llegó invitado: descuento del primer mes */}
      {/* (desaparece al suscribirse; durante el mes con descuento se recuerda abajo) */}
      {plan?.descuentoInvitado && !tienePlanPago && !cambioPendiente && !listo && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-amber-400/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0"><Gift className="h-5 w-5" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{tr("Llegaste invitado: {0}% en tu primer mes de KIRI PLUS o {1}% en KIRI PRO", [plan.descuentoInvitado.PLUS, plan.descuentoInvitado.PRO])}</p>
            <p className="text-xs text-muted-foreground">{tr("Aplica pagando mensual; se descuenta en tu primera factura.")}</p>
          </div>
          <Button size="sm" onClick={() => setVerPlanes(true)} className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white">{tr("Ver planes")}</Button>
        </div>
      )}
      {primerMes && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-amber-400/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0"><Gift className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="font-bold text-sm">{tr("Tu primer mes tuvo {0}% de descuento por venir invitado", [primerMes.pct])}</p>
            <p className="text-xs text-muted-foreground">{tr("Desde tu próxima factura pagas el precio normal de tu plan.")}</p>
          </div>
        </div>
      )}

      {/* Factura pendiente (avisada por FactoNet) */}
      {factura && eventoFactura && (
        <div className={cn("rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3",
          eventoFactura.tono === "red" ? "border-red-500/40 bg-red-500/5" : "border-amber-500/40 bg-amber-500/5")}>
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", eventoFactura.tono === "red" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600")}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{eventoFactura.titulo}</p>
            <p className="text-xs text-muted-foreground">{tr("Factura {0} ·", [factura.codigo])}{" "}<strong className="text-foreground">{formatCOP(factura.valor)}</strong>
              {factura.vence && <>{" "}{tr("· vence el {0}", [fechaLarga(factura.vence)])}</>}
            </p>
          </div>
          {!nativo && <Button onClick={pagarFactura} className="gap-2 shrink-0">{tr("Pagar factura")}{" "}<ExternalLink className="h-3.5 w-3.5" />
          </Button>}
        </div>
      )}

      {/* Cambio pedido y pendiente de firma / pago */}
      {(cambioPendiente || listo) && !factura && (
        <div className="rounded-2xl border border-kiri-emerald/30 bg-kiri-emerald/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-kiri-emerald/10 text-kiri-emerald flex items-center justify-center shrink-0">
            <FileSignature className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{tr("Solicitaste {0}: tu contrato está listo", [listo ?? cambioPendiente?.plan ?? tr("un nuevo plan")])}</p>
            {/* Planes pedidos desde Kiri: aceptar Términos + datos fue la firma del cliente */}
            <p className="text-xs text-muted-foreground">{listo || cambioPendiente?.firmado
              ? tr("Ya lo firmaste al aceptar los Términos y la autorización de datos. Falta la firma del administrador de CycloNet; mientras tanto sigues usando tu plan actual y el nuevo se activa cuando él firme y pagues la primera factura.")
              : tr("Entra a FactoNet con tu mismo correo y contraseña de Kiri para firmarlo. Mientras tanto sigues usando tu plan actual; el nuevo se activa al firmar y pagar la primera factura.")}</p>
            {(cambioPendiente?.descuentoPrimerMes ?? 0) > 0 && (
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mt-1">{tr("Tu primera factura trae {0}% de descuento por venir invitado.", [cambioPendiente!.descuentoPrimerMes])}</p>
            )}
          </div>
          {!nativo && <Button onClick={abrirFactonet} variant="outline" className="gap-2 shrink-0 border-kiri-emerald/40 text-kiri-emerald">{listo || cambioPendiente?.firmado ? tr("Ver en FactoNet") : tr("Firmar en FactoNet")}{" "}<ExternalLink className="h-3.5 w-3.5" />
          </Button>}
        </div>
      )}

      {/* Planes: se abren con "Cambiar de plan" */}
      <Dialog open={verPlanes} onOpenChange={cerrarPlanes}>
        <DialogContent className="max-w-[388px] sm:max-w-2xl lg:max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-500" />{" "}{tr("Cambiar de plan")}</DialogTitle>
            <DialogDescription>{tr("Mira lo que trae cada plan. Al elegir uno se activa al instante; la factura te llega después y la pagas en FactoNet.")}</DialogDescription>
          </DialogHeader>
      <section className="space-y-3">
        {hayAnual && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-bold">{tr("Forma de pago")}</p>
            <div className="inline-flex rounded-full bg-muted p-1 text-xs font-bold" role="group" aria-label={tr("Forma de pago")}>
              {(["monthly", "annual"] as const).map(c => (
                <button key={c} type="button" onClick={() => setCiclo(c)} aria-pressed={ciclo === c}
                  className={cn("px-3 py-1.5 rounded-full transition-colors", ciclo === c ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
                  {c === "monthly" ? tr("Mensual") : <>{tr("Anual")}{" "}<span className="text-kiri-emerald">{tr("· ahorra")}</span></>}
                </button>
              ))}
            </div>
        </div>
        )}
        {planes === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map(i => <div key={i} className="h-64 rounded-2xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : planes.length === 0 ? (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">{tr("No pudimos cargar los planes en este momento.")}</p>
            <Button variant="outline" size="sm" onClick={() => cargarPlanes()}>{tr("Reintentar")}</Button>
          </div>
        ) : (
          <div className="grid gap-x-4 gap-y-6 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {planes.map(p => {
              const actual = esActual(p)
              const nombre = p.displayName || p.name
              const pendiente = cambioPendiente?.packageId === p.packageId
              const probando = loEstaProbando(p)
              const esPro = tierDe(nombre) === "PRO"
              const anual = ciclo === "annual" && (p.annualPrice ?? 0) > 0
              return (
                <div key={p.packageId} className={cn("relative rounded-2xl border-2 p-5 flex flex-col gap-4 bg-card",
                  actual || probando ? "border-kiri-emerald" : p.isHighlighted ? "border-amber-400/60" : esPro ? "border-amber-500/40" : "border-border")}>
                  {(actual || probando || p.badge) && (
                    <span className={cn("absolute -top-3 left-5 text-[10px] font-black px-2.5 py-1 rounded-full",
                      actual || probando ? "bg-kiri-emerald text-white" : "bg-amber-400 text-amber-950")}>
                      {actual ? tr("Tu plan actual") : probando ? tr("Lo tienes gratis") : p.badge}
                    </span>
                  )}
                  <div>
                    <p className="font-bold flex items-center gap-1.5">{(p.isHighlighted || esPro) && <Crown className="h-4 w-4 text-amber-500" />}{nombre}</p>
                    {/* Cada plan con su promesa: para empezar, para ti, para los dos */}
                    <p className={cn("text-[11px] font-extrabold uppercase tracking-wider", esPro ? "text-amber-600" : tierDe(nombre) === "PLUS" ? "text-kiri-emerald" : "text-muted-foreground")}>
                      {esPro ? tr("Para los dos · la plata del hogar") : tierDe(nombre) === "PLUS" ? tr("Para ti · planea tu futuro") : tr("Para empezar · organiza tu quincena")}
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {p.price > 0
                        ? <>{formatCOP(precioDe(p))}<span className="text-xs font-medium text-muted-foreground"> / {anual ? tr("año") : "mes"}</span></>
                        : tr("Gratis")}
                    </p>
                    {anual && (
                      <p className="text-[11px] text-kiri-emerald font-bold">{tr("Equivale a {0} al mes · más de 2 meses gratis", [formatCOP(Math.round(p.annualPrice! / 12))])}</p>
                    )}
                    {!anual && p.price > 0 && (p.annualPrice ?? 0) > 0 && (
                      <button type="button" onClick={() => setCiclo("annual")} className="text-[11px] font-bold text-kiri-emerald underline-offset-2 hover:underline">
                        {tr("o {0} al mes pagando el año", [formatCOP(Math.round(p.annualPrice! / 12))])}
                      </button>
                    )}
                    {descuentoDe(p) > 0 && !actual && (
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-400/15 rounded-lg px-2 py-1 mt-1 inline-block">
                        {tr("Tu primer mes: {0} ({1}% por venir invitado)", [formatCOP(Math.round(p.price * (1 - descuentoDe(p) / 100))), descuentoDe(p)])}
                      </p>
                    )}
                    {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {p.features.slice(0, 12).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-kiri-emerald shrink-0 mt-0.5" />{f}</li>
                    ))}
                  </ul>
                  {actual ? (
                    <Button disabled variant="outline" className="w-full gap-2"><CheckCircle2 className="h-4 w-4" />{" "}{tr("Es tu plan")}</Button>
                  ) : pendiente ? (
                    <Button onClick={abrirFactonet} variant="outline" className="w-full gap-2"><Clock className="h-4 w-4" />{" "}{tr("Pendiente de firma")}</Button>
                  ) : p.price === 0 && tienePlanPago ? (
                    <p className="text-[11px] text-muted-foreground text-center">{tr("Para volver al plan gratis, escríbenos desde Perfil → Soporte.")}</p>
                  ) : nativo ? (
                    comprasDisponibles() && tierTienda(p) ? (
                      <Button onClick={() => suscribirConTienda(p)} disabled={enviando} className={cn("w-full gap-2", p.isHighlighted && "bg-amber-500 hover:bg-amber-600 text-white")}>
                        <Sparkles className="h-4 w-4" /> {tr("Suscribirme a {0}", [nombre])}
                      </Button>
                    ) : (
                      <Button disabled variant="outline" className="w-full">{tr("Muy pronto en la app")}</Button>
                    )
                  ) : (
                    <Button onClick={() => abrirCambio(p)} className={cn("w-full gap-2", p.isHighlighted && "bg-amber-500 hover:bg-amber-600 text-white")}>
                      <Sparkles className="h-4 w-4" /> {probando ? tr("Quedarme con {0}", [nombre]) : tr("Cambiarme a {0}", [nombre])}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
        </DialogContent>
      </Dialog>

      {/* Invita y gana: premios cuando tu amigo usa Kiri y cuando se suscribe, niveles sin tope */}
      {referidos?.niveles && <InvitaYGana referidos={referidos} />}

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
            <h2 className="text-lg font-bold">{tr("Tu contrato y tus facturas: FactoNet")}</h2>
            <p className="text-sm text-muted-foreground">{tr("FactoNet es la plataforma de facturación de Cyclonet. Ahí ves tu contrato, lo firmas, consultas tus facturas y reportas tus pagos.")}</p>
          </div>
        </div>

        <div className="rounded-xl bg-muted/40 p-3 flex items-start gap-2 text-sm">
          <LogIn className="h-4 w-4 text-kiri-emerald shrink-0 mt-0.5" />
          <p>{tr("Inicia sesión con")}{" "}<strong>{tr("los mismos datos con los que entras a Kiri")}</strong>
            {factonet?.correo && <>{tr(": tu correo")}{" "}<strong className="break-all">{factonet.correo}</strong>{" "}{tr("y tu contraseña de Kiri")}</>}.
          </p>
        </div>

        {mostrarFactonet ? (
          <ol className="grid gap-2 sm:grid-cols-3 text-xs">
            {[
              { n: 1, t: tr("Entra a FactoNet"), d: tr("Con tu correo y contraseña de Kiri.") },
              { n: 2, t: tr("Contratos"), d: tr("Revisa y firma el contrato de tu plan.") },
              { n: 3, t: tr("Facturas"), d: tr("Mira tu factura, descárgala y reporta tu pago.") },
            ].map(p => (
              <li key={p.n} className="rounded-xl border border-border p-3">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-kiri-emerald text-white text-[10px] font-black mr-1.5">{p.n}</span>
                <strong>{p.t}</strong>
                <p className="text-muted-foreground mt-1">{p.d}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">{tr("Cuando te cambies a un plan pago, aquí tendrás el acceso a tu contrato y a tus facturas.")}</p>
        )}

        {nativo ? (
          <Button onClick={restaurar} variant="outline" className="gap-2">{tr("Restaurar compras")}</Button>
        ) : (
          <Button onClick={abrirFactonet} disabled={!factonet?.url || !mostrarFactonet} className="gap-2">{tr("Ir a FactoNet")}{" "}<ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
      </section>

      {/* Tu uso este mes */}
      {uso && uso.variables.length > 0 && (
        <section className="rounded-2xl border-2 border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-kiri-emerald" />
            <h2 className="text-lg font-bold">{tr("Tu uso este mes")}</h2>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">{tr("La IA (coach, dictado y escáner) se renueva el día 1 de cada mes; lo demás es lo que tienes creado hoy.")}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {USO_VISIBLE.map(({ v, nombre, mensual }) => {
              const x = uso.variables.find(u => u.variableName === v)
              if (!x || (x.maxValue <= 0 && !x.ilimitado)) return null
              const lleno = !x.ilimitado && x.currentCount >= x.maxValue
              return (
                <li key={v} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate">{nombre}{mensual && <span className="text-[10px] text-muted-foreground">{" "}{tr("· al mes")}</span>}
                      {(x.extra ?? 0) > 0 && <span className="text-[10px] font-bold text-amber-600">{" "}{tr("(+{0} por invitar)", [x.extra])}</span>}</span>
                    <span className={cn("font-bold tabular-nums shrink-0 flex items-center gap-1", lleno && "text-amber-600")}>
                      {x.currentCount} / {x.ilimitado ? <InfinityIcon className="h-4 w-4" aria-label={tr("sin límite")} /> : x.maxValue}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full", x.ilimitado ? "bg-kiri-emerald/40" : lleno ? "bg-amber-500" : x.usagePercentage >= 80 ? "bg-amber-400" : "bg-kiri-emerald")}
                      style={{ width: `${x.ilimitado ? 100 : Math.max(x.usagePercentage, x.currentCount > 0 ? 4 : 0)}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Confirmar cambio de plan */}
      <Dialog open={!!elegido} onOpenChange={v => { if (!v && !enviando) setElegido(null) }}>
        <DialogContent className="sm:max-w-md [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" />{" "}{tr("Cambiarme a {0}", [elegido?.displayName || elegido?.name])}</DialogTitle>
            <DialogDescription>{tr("{0} Así funciona:", [elegido && elegido.price > 0
                ? ciclo === "annual" && (elegido.annualPrice ?? 0) > 0
                  ? tr("{0} al año (un solo pago).", [formatCOP(elegido.annualPrice!)])
                  : descuentoDe(elegido) > 0
                    ? tr("{0} al mes; tu primer mes {1} ({2}% por venir invitado).", [formatCOP(elegido.price), formatCOP(Math.round(elegido.price * (1 - descuentoDe(elegido) / 100))), descuentoDe(elegido)])
                    : tr("{0} al mes.", [formatCOP(elegido.price)])
                : tr("Sin costo.")])}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-1.5 text-sm">
            <li className="flex gap-2"><span className="font-black text-kiri-emerald">1.</span>{" "}{tr("Aceptas los Términos y tu plan se activa al instante, sin contraseña.")}</li>
            <li className="flex gap-2"><span className="font-black text-kiri-emerald">2.</span>{" "}{tr("Esa aceptación es tu firma del contrato (queda en FactoNet).")}</li>
            <li className="flex gap-2"><span className="font-black text-kiri-emerald">3.</span>{" "}{tr("Te llega la factura (aquí en Kiri también te avisamos) y la pagas en FactoNet.")}</li>
          </ol>
          <p className="text-xs text-muted-foreground">{tr("No pierdes nada de lo que ya registraste.")}</p>
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} className="accent-kiri-emerald h-4 w-4 mt-0.5" />
            <span>
              {tr("Acepto los")}{" "}<a href="/legal/terminos" target="_blank" rel="noopener" className="font-bold text-kiri-emerald underline">{tr("Términos y Condiciones")}</a>{" "}
              {tr("de Kiri Finance, incluidas las condiciones del plan pago, y autorizo el")}{" "}
              <a href="/legal/datos" target="_blank" rel="noopener" className="font-bold text-kiri-emerald underline">{tr("tratamiento de mis datos personales")}</a>{" "}
              {tr("para la contratación y facturación.")}
            </span>
          </label>
          {errorCambio && <p className="text-xs font-bold text-destructive bg-destructive/10 rounded-lg p-2">{errorCambio}</p>}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setElegido(null)} disabled={enviando}>{tr("Cancelar")}</Button>
            <Button onClick={confirmarCambio} disabled={!acepta || enviando} className="gap-2 bg-kiri-emerald text-white hover:bg-kiri-emerald/90">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{" "}{tr("Activar {0}", [elegido?.displayName || elegido?.name])}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
