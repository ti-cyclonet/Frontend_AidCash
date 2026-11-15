"use client"

/**
 * Oferta de plan en un BUEN momento (no cuando chocas con un límite): semana
 * lograda, racha, proyecciones con tus propios datos, cierre de mes, prueba
 * que termina… Se muestra solo a quien le sirve (plan menor al ofrecido),
 * cuenta cuándo se vio y cuándo la tocaron (medición, POST /plan/evento) y
 * lleva a Mi plan con su origen, para saber qué momento vende.
 */
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Crown, Sparkles, X } from "lucide-react"
import { usePlan } from "@/lib/plan-context"
import { planApi } from "@/lib/api-client"
import { tr } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const ORDEN = { FREE: 0, PLUS: 1, PRO: 2 } as const
const vistas = new Set<string>()

/** Precio por mes del plan anual de PLUS ($139.000 / 12). */
export const PLUS_ANUAL_MES = "$11.583"

export function irAPlanes(router: ReturnType<typeof useRouter>, origen: string) {
  planApi.evento("oferta_click", origen)
  router.push(`/mi-plan?origen=${encodeURIComponent(origen)}#planes`)
}

export function OfertaPlan({
  origen, plan = "PLUS", icono, titulo, texto, cta, cerrable = false, compacta = false, className, children,
}: {
  /** Dónde se muestra (medición): proyecciones, semana_lograda, historial_cierre… */
  origen: string
  plan?: "PLUS" | "PRO"
  icono?: LucideIcon
  titulo: string
  texto?: string
  cta?: string
  /** Se puede cerrar por 7 días */
  cerrable?: boolean
  compacta?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const router = useRouter()
  const { plan: datos, tier, loading } = usePlan()
  const clave = `kiri_oferta_cerrada_${origen}`
  const [cerrada, setCerrada] = useState(() => {
    if (!cerrable || typeof window === "undefined") return false
    try { return Number(localStorage.getItem(clave) ?? 0) > Date.now() } catch { return false }
  })
  // Quien ya tiene el plan (pago, prueba o ganado) no ve la oferta
  const aplica = !loading && !!datos && ORDEN[tier] < ORDEN[plan]
  const visible = aplica && !cerrada

  useEffect(() => {
    if (!visible || vistas.has(origen)) return
    vistas.add(origen)
    planApi.evento("oferta_vista", origen)
  }, [visible, origen])

  if (!visible) return null
  const Icono = icono ?? (plan === "PRO" ? Crown : Sparkles)
  const pro = plan === "PRO"
  const cerrar = () => {
    setCerrada(true)
    try { localStorage.setItem(clave, String(Date.now() + 7 * 86400000)) } catch { /* sin storage */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn("relative overflow-hidden rounded-2xl border p-3.5",
        pro ? "border-amber-400/50 bg-gradient-to-br from-amber-50 via-background to-amber-100/60 dark:from-amber-500/10 dark:via-background dark:to-amber-500/5"
          : "border-kiri-emerald/30 bg-gradient-to-br from-emerald-50 via-background to-sky-50 dark:from-emerald-500/10 dark:via-background dark:to-sky-500/5",
        className)}>
      {/* brillo que cruza la tarjeta cada tanto */}
      <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10"
        animate={{ x: ["0%", "420%"] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 4.5, ease: "easeInOut" }} />
      {cerrable && (
        <button type="button" onClick={cerrar} aria-label={tr("Cerrar")} className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className={cn("relative flex gap-3", compacta ? "items-center" : "items-start")}>
        <motion.span animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 3 }}
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-inner",
            pro ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-emerald-400 to-teal-600")}>
          <Icono className="h-5 w-5" />
        </motion.span>
        <div className="min-w-0 flex-1 pr-4">
          <p className="text-sm font-extrabold leading-snug">{titulo}</p>
          {texto && !compacta && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{texto}</p>}
        </div>
      </div>
      {children && <div className="relative mt-3">{children}</div>}
      <button type="button" onClick={() => irAPlanes(router, origen)}
        className={cn("relative mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold text-white transition-transform active:scale-[.98]",
          pro ? "bg-amber-500 hover:bg-amber-400" : "bg-kiri-emerald hover:bg-kiri-emerald/90")}>
        {cta ?? (pro ? tr("Ver KIRI PRO") : tr("Quiero KIRI PLUS"))}<ArrowRight className="h-3.5 w-3.5" />
      </button>
      {!pro && !compacta && <p className="relative mt-1.5 text-center text-[10px] text-muted-foreground">{tr("En el plan anual te sale a {0} al mes", [PLUS_ANUAL_MES])}</p>}
    </motion.div>
  )
}
