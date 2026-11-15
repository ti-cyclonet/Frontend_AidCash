"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Sparkles, Crown, Lock, Check, Bot, TrendingUp, History, Users, HeartHandshake, ScanLine } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { planApi, type LimitePlanEvento } from "@/lib/api-client"
import { usePlan } from "@/lib/plan-context"
import { tr } from "@/lib/i18n"
import { PLUS_ANUAL_MES } from "@/components/plan/OfertaPlan"

/** Lo que trae el plan al que se sube: el aviso vende lo que gana, no lo que le falta. */
const BENEFICIOS = {
  PLUS: [
    { i: TrendingUp, t: tr("Proyecciones a 24 meses y el día en que quedas libre de deudas") },
    { i: History, t: tr("Historial de 2 años y reportes en PDF") },
    { i: Bot, t: tr("Kiri Coach: 150 mensajes, 100 dictados y 30 escaneos al mes") },
    { i: Users, t: tr("Préstamos y ahorros compartidos con tus amigos") },
  ],
  PRO: [
    { i: HeartHandshake, t: tr("Presupuesto del hogar en pareja (basta con que uno lo tenga)") },
    { i: Bot, t: tr("Kiri Coach: 500 mensajes, 300 dictados y 100 escaneos al mes") },
    { i: ScanLine, t: tr("Escáner que separa tus recibos por productos") },
    { i: History, t: tr("Todo tu historial, sin límite") },
  ],
}

/**
 * Aviso global cuando el backend dice que el plan no alcanza: límite de
 * cantidad (403 LIMITE), función de otro plan (403 FUNCION) o cuota mensual
 * de IA agotada (429 CUOTA_IA). Lo dispara api() con el evento 'kiri:limite'.
 * Muestra lo que trae el plan siguiente y cuenta cuándo se vio y se tocó.
 */
export function LimitePlanDialog() {
  const router = useRouter()
  const pathname = usePathname()
  const { tier } = usePlan()
  const [aviso, setAviso] = useState<LimitePlanEvento | null>(null)
  const origen = useRef("limite")

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<LimitePlanEvento>).detail
      origen.current = `limite:${d.codigo === "CUOTA_IA" ? "ia" : d.codigo === "FUNCION" ? "funcion" : "cantidad"}`
      planApi.evento("oferta_vista", origen.current)
      setAviso(d)
    }
    window.addEventListener("kiri:limite", h)
    return () => window.removeEventListener("kiri:limite", h)
  }, [])

  if (!aviso) return null
  const destino = aviso.mejora?.plan
  const esPro = !!destino?.includes("PRO") || (tier === "PLUS" && !destino)
  const titulo = aviso.codigo === "CUOTA_IA"
    ? tr("Kiri Coach te respondió todo este mes")
    : aviso.codigo === "FUNCION"
      ? tr("Esto es de {0}", [destino ?? tr("otro plan")])
      : tr("Tu plan se te quedó pequeño")
  const beneficios = BENEFICIOS[esPro ? "PRO" : "PLUS"]
  const ir = () => {
    planApi.evento("oferta_click", origen.current)
    setAviso(null)
    window.dispatchEvent(new Event("kiri:ir-mi-plan"))
    router.push(`/mi-plan?origen=${encodeURIComponent(origen.current)}#planes`)
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) setAviso(null) }}>
      <DialogContent className="max-w-sm rounded-3xl z-[80]">
        <DialogHeader className="items-center text-center">
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${esPro ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10"}`}>
            {aviso.codigo === "FUNCION"
              ? <Lock className={`w-7 h-7 ${esPro ? "text-amber-600" : "text-primary"}`} />
              : esPro ? <Crown className="w-7 h-7 text-amber-600" /> : <Sparkles className="w-7 h-7 text-primary" />}
          </motion.div>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {aviso.mensaje}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 rounded-2xl bg-muted/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Con {0} tienes", [esPro ? "KIRI PRO" : "KIRI PLUS"])}</p>
          {beneficios.map((b, i) => (
            <motion.div key={b.t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .08 * i }} className="flex items-start gap-2 text-xs">
              <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${esPro ? "text-amber-600" : "text-kiri-emerald"}`} />{b.t}
            </motion.div>
          ))}
        </div>
        <div className="flex flex-col gap-2 pt-1">
          {pathname !== "/mi-plan" && (
            <Button className={`gap-2 rounded-xl ${esPro ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`} onClick={ir}>
              {esPro ? <Crown className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {destino ? tr("Quiero {0}", [destino]) : esPro ? tr("Quiero KIRI PRO") : tr("Quiero KIRI PLUS")}
            </Button>
          )}
          {!esPro && <p className="text-center text-[11px] text-muted-foreground">{tr("En el plan anual te sale a {0} al mes", [PLUS_ANUAL_MES])}</p>}
          <Button variant="ghost" className="rounded-xl" onClick={() => setAviso(null)}>{tr("Ahora no")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
