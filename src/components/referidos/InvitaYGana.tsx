"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Check, ChevronDown, Gift, Link2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InviteLinkModal, WhatsAppIcon, mensajeInvitacion } from "@/components/social/InviteLinkPanel"
import { inviteLinksApi, urlInvitacion } from "@/lib/api-client"
import type { ResumenReferidos } from "@/lib/plan-context"
import { cn } from "@/lib/utils"
import { tr } from "@/lib/i18n"

/**
 * "Invita y gana": premios en dos momentos (cuando tu amigo empieza a usar
 * Kiri y cuando se suscribe) y niveles sin tope. Las reglas y los conteos
 * vienen del backend (lib/referidos.ts) en GET /plan → referidos.
 */

/** Enlace de invitación (Amigo) listo para abrir WhatsApp sin esperar. */
export function useEnlaceInvitacion() {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vigente = true
    inviteLinksApi.get("FRIEND").then(({ data }) => { if (vigente && data?.code) setUrl(urlInvitacion(data.code)) }).catch(() => {})
    return () => { vigente = false }
  }, [])
  const whatsapp = (texto = mensajeInvitacion()) => {
    if (!url) return
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`, "_blank", "noopener")
  }
  return { url, whatsapp }
}

/** "Te falta 1 amigo para: 1 mes gratis de tu plan" (armado aquí para que se traduzca). */
export function textoFalta(r: ResumenReferidos): string {
  const s = r.siguiente
  if (!s) return tr("Ya ganaste todos los niveles: cada amigo nuevo te sigue dando su bono y tu mes gratis.")
  const premio = tr(s.titulo)
  if (s.faltanAmigos > 0) return s.faltanAmigos === 1 ? tr("Te falta 1 amigo para: {0}", [premio]) : tr("Te faltan {0} amigos para: {1}", [s.faltanAmigos, premio])
  return s.faltanPagados === 1 ? tr("Te falta 1 amigo con plan pago para: {0}", [premio]) : tr("Te faltan {0} amigos con plan pago para: {1}", [s.faltanPagados, premio])
}

/** Progreso hacia el siguiente premio (0-1), contando desde el nivel anterior. */
function progreso(r: ResumenReferidos): number {
  if (!r.siguiente) return 1
  const anterior = [...r.niveles].reverse().find(n => n.logrado)?.amigos ?? 0
  const tramo = r.siguiente.amigos - anterior
  return tramo > 0 ? Math.min(1, Math.max(0, (r.activos - anterior) / tramo)) : 1
}

function Paso({ n, titulo, texto }: { n: number; titulo: string; texto: string }) {
  return (
    <li className="relative rounded-xl bg-card border border-border p-3 pl-11">
      <span className="absolute left-3 top-3 h-6 w-6 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center">{n}</span>
      <p className="font-bold text-sm">{titulo}</p>
      <p className="text-xs text-muted-foreground">{texto}</p>
    </li>
  )
}

export function InvitaYGana({ referidos: r }: { referidos: ResumenReferidos }) {
  const { url, whatsapp } = useEnlaceInvitacion()
  const [modal, setModal] = useState(false)
  const [verPremios, setVerPremios] = useState(false)
  const b = r.reglas.bonoActivacion
  const bono = tr("+{0} mensajes, +{1} dictados y +{2} escaneos", [b.coach, b.dictado, b.escaneo])
  const pct = progreso(r)

  return (
    <section id="invita" className="scroll-mt-20 rounded-2xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-400/10 via-card to-kiri-emerald/5 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-amber-600" />
          <div>
            <h2 className="text-lg font-bold leading-tight">{tr("Invita y gana")}</h2>
            <p className="text-[11px] text-muted-foreground">{tr("Sin tope: cada amigo que use Kiri suma.")}</p>
          </div>
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        <Paso n={1} titulo={tr("Llega con tu enlace")} texto={tr("Tu amigo tiene {0} días de KIRI PLUS gratis y {1}% en su primer mes ({2}% en PRO).", [r.reglas.pruebaAmigoDias, r.descuentoAmigo.PLUS, r.descuentoAmigo.PRO])} />
        <Paso n={2} titulo={tr("Empieza a usar Kiri")} texto={tr("Con sus primeros {0} movimientos, los dos ganan {1} de Kiri Coach.", [r.reglas.activacion.movimientos, bono])} />
        <Paso n={3} titulo={tr("Se suscribe")} texto={tr("Tú ganas 1 mes gratis de tu plan (si ya pagas, en tu próxima factura).")} />
      </ol>

      {/* Conteo */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: r.invitados, l: tr("Invitados") },
          { v: r.activos, l: tr("Usan Kiri") },
          { v: r.pagados, l: tr("Con plan") },
        ].map(x => (
          <div key={x.l} className="rounded-xl bg-card border border-border py-2">
            <p className="text-xl font-black tabular-nums">{x.v}</p>
            <p className="text-[10px] text-muted-foreground">{x.l}</p>
          </div>
        ))}
      </div>

      {/* Siguiente premio */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold gap-2">
          <span className="truncate">{r.siguiente ? <>{r.siguiente.icono} {tr("Próximo premio: {0}", [r.siguiente.titulo])}</> : tr("🏆 ¡Ganaste todos los niveles!")}</span>
          {r.siguiente && <span className="tabular-nums shrink-0">{r.activos} / {r.siguiente.amigos}</span>}
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-kiri-emerald" initial={{ width: 0 }} animate={{ width: `${Math.round(pct * 100)}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
        </div>
        <p className="text-[11px] text-muted-foreground">{textoFalta(r)}</p>
      </div>

      {/* Niveles */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {r.niveles.map(n => (
          <div key={n.clave} className={cn("snap-start shrink-0 w-36 rounded-xl border p-2.5 space-y-1",
            n.logrado ? "border-kiri-emerald/50 bg-kiri-emerald/10" : r.siguiente?.clave === n.clave ? "border-amber-400/60 bg-amber-400/10" : "border-border bg-card opacity-80")}>
            <div className="flex items-center justify-between">
              <span className="text-lg">{n.icono}</span>
              {n.logrado ? <span className="h-5 w-5 rounded-full bg-kiri-emerald text-white flex items-center justify-center"><Check className="h-3 w-3" /></span>
                : <span className="text-[10px] font-black text-muted-foreground flex items-center gap-0.5"><Users className="h-3 w-3" />{n.amigos}</span>}
            </div>
            <p className="text-[10.5px] font-bold leading-snug">{tr(n.titulo)}</p>
            <p className="text-[9.5px] text-muted-foreground">
              {n.amigos === 1 ? tr("1 amigo") : tr("{0} amigos", [n.amigos])}{n.pagados > 0 && tr(" · {0} con plan", [n.pagados])}
            </p>
          </div>
        ))}
      </div>

      {/* Premios ganados */}
      {r.premios.length > 0 && (
        <div>
          <button type="button" onClick={() => setVerPremios(v => !v)} className="text-xs font-bold flex items-center gap-1 text-kiri-emerald">
            {tr("Tus premios ({0})", [r.premios.length])} <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", verPremios && "rotate-180")} />
          </button>
          {verPremios && (
            <ul className="mt-2 space-y-1.5">
              {r.premios.map(p => (
                <li key={p.clave} className="flex items-start gap-2 text-xs rounded-lg bg-card border border-border px-3 py-2">
                  <Gift className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="flex-1 min-w-0">{tr(p.premio)}{p.amigo && <span className="text-muted-foreground">{" "}{tr("· por {0}", [p.amigo])}</span>}</span>
                  {p.pendiente && <span className="text-[10px] font-bold text-amber-600 shrink-0">{tr("En camino")}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => whatsapp()} disabled={!url} className="gap-1.5 bg-[#25D366] hover:bg-[#1ebe5b] text-white">
          <WhatsAppIcon className="h-4 w-4" />{" "}{tr("Invitar por WhatsApp")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setModal(true)} className="gap-1.5"><Link2 className="h-4 w-4" />{" "}{tr("Más formas de invitar")}</Button>
        <Button asChild size="sm" variant="ghost"><Link href="/misiones">{tr("Ver misiones")}</Link></Button>
      </div>
      <InviteLinkModal open={modal} onClose={() => setModal(false)} />
    </section>
  )
}

/** Versión compacta para el jardín: barra hacia el siguiente premio + WhatsApp. */
export function InvitaWidget({ referidos: r }: { referidos: ResumenReferidos }) {
  const { url, whatsapp } = useEnlaceInvitacion()
  const pct = progreso(r)
  return (
    <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-400/10 via-card to-kiri-emerald/10 p-4 space-y-2.5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-400/20 flex items-center justify-center text-xl shrink-0">{r.siguiente?.icono ?? "🏆"}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">{tr("Invita y gana")}{" "}<span className="text-muted-foreground font-medium text-xs">{tr("· {0} {1}", [r.activos, r.activos === 1 ? tr("amigo usa Kiri") : tr("amigos usan Kiri")])}</span></p>
          <p className="text-[11px] text-muted-foreground leading-snug">{textoFalta(r)}</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-kiri-emerald" initial={{ width: 0 }} animate={{ width: `${Math.max(4, Math.round(pct * 100))}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => whatsapp()} disabled={!url} className="flex-1 gap-1.5 bg-[#25D366] hover:bg-[#1ebe5b] text-white h-9">
          <WhatsAppIcon className="h-4 w-4" />{" "}{tr("Invitar")}
        </Button>
        <Button asChild size="sm" variant="outline" className="h-9"><Link href="/mi-plan#invita">{tr("Premios")}</Link></Button>
      </div>
    </div>
  )
}
