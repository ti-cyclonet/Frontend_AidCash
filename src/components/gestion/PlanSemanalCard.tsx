"use client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Plan semanal — cuánto gastar cada semana para llegar al próximo cobro
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Va en Billetera, debajo de la distribución inteligente. Es un consejo: de lo
 * que queda tras pagar las obligaciones (y apartar el ahorro sugerido) el
 * servidor arma 2 semanas (quincenal) o 4 (mensual). La semana en curso sale
 * más grande; las pasadas se apagan con su sello "Logrado" (+5 monedas) o
 * "Fallido" (con cuánto se pasó). Toda la lógica vive en el backend
 * (lib/plan-semanal.ts); aquí solo se pide y se anima.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  CalendarRange, PiggyBank, ShoppingBag, Sparkles, TrendingUp, Gauge, Landmark,
  Bug, ArrowRightLeft, AlertTriangle, Wallet, Hourglass, Coins, Flame, CalendarX,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { planSemanalApi, PlanSemanal, SemanaPlan, ConsejoPlan } from "@/lib/api-client"
import { tr, localeFecha } from "@/lib/i18n"
import { marcarSemanaDelPlan } from "@/lib/garden-events"

type Fmt = (n: number) => string

const fecha = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d) }
const diaMes = (ymd: string) => fecha(ymd).toLocaleDateString(localeFecha(), { day: "numeric", month: "short" })
const rango = (s: SemanaPlan) => `${fecha(s.inicio).getDate()} – ${diaMes(s.fin)}`

// ─── Tarjeta principal ────────────────────────────────────────────────────────

export function PlanSemanalCard({ obligaciones, saldo, formatAmount }: { obligaciones: number; saldo: number; formatAmount: Fmt }) {
  const [plan, setPlan] = useState<PlanSemanal | null>(null)
  const [cargando, setCargando] = useState(true)
  const vistos = useRef<Set<string>>(new Set())

  const cargar = useCallback(async () => {
    const { data } = await planSemanalApi.get(obligaciones)
    setCargando(false)
    if (!data) return
    setPlan(data)
    // El árbol se entera de las semanas cerradas (una vez por semana y dispositivo)
    for (const s of data.semanas) {
      if (s.estado !== "lograda" && s.estado !== "fallida") continue
      const clave = `${data.periodo.inicio}#${s.indice}`
      if (vistos.current.has(clave)) continue
      vistos.current.add(clave)
      marcarSemanaDelPlan(clave, s.estado === "lograda")
    }
  }, [obligaciones])

  // Recalcular cuando cambia el saldo o las obligaciones (con un respiro para no pedir de más)
  useEffect(() => {
    const t = setTimeout(cargar, 350)
    return () => clearTimeout(t)
  }, [cargar, saldo])

  useEffect(() => {
    const refrescar = () => { cargar() }
    window.addEventListener("kiri:wallet-updated", refrescar)
    window.addEventListener("focus", refrescar)
    return () => { window.removeEventListener("kiri:wallet-updated", refrescar); window.removeEventListener("focus", refrescar) }
  }, [cargar])

  if (cargando && !plan) {
    return <div className="h-64 rounded-3xl bg-muted/40 animate-pulse" />
  }
  if (!plan) return null

  const quincenal = plan.frecuencia === "quincenal"
  const sinSaldo = plan.saldo <= 0
  const actual = plan.semanas.find(s => s.estado === "actual")

  return (
    <Card className="border-none bg-card shadow-sm rounded-3xl overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-kiri-spring/15 flex items-center justify-center text-kiri-emerald dark:text-kiri-spring">
              <CalendarRange className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{quincenal ? tr("Tu plan de la quincena") : tr("Tu plan del mes")}</h3>
              <p className="text-[10px] text-muted-foreground">
                {plan.periodo.diasRestantes <= 1
                  ? tr("Para llegar al {0} sin endeudarte · mañana cobras", [diaMes(plan.periodo.proximoCobro)])
                  : tr("Para llegar al {0} sin endeudarte · {1} días", [diaMes(plan.periodo.proximoCobro), plan.periodo.diasRestantes])}
              </p>
            </div>
          </div>
          {plan.racha > 1 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-300 px-2 py-1 text-[10px] font-bold shrink-0">
              <Flame className="h-3 w-3" />{tr("{0} seguidas", [plan.racha])}
            </motion.div>
          )}
        </div>

        {sinSaldo ? (
          <div className="rounded-2xl bg-muted/40 p-4 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">{tr("Registra tu ingreso y Kiri te arma un plan para cada semana hasta tu próximo cobro.")}</p>
          </div>
        ) : (
          <Resumen plan={plan} formatAmount={formatAmount} />
        )}

        {/* Semanas */}
        {!sinSaldo || plan.semanas.some(s => s.estado === "lograda" || s.estado === "fallida") ? (
          quincenal ? (
            // Quincenal: las 2 lado a lado, la semana en curso más ancha
            <div className={cn("grid gap-2.5", plan.semanaActual === 1 ? "grid-cols-[1.4fr_1fr]" : "grid-cols-[1fr_1.4fr]")}>
              {plan.semanas.map((s, i) => <SemanaAnimada key={`${plan.periodo.inicio}-${s.indice}`} s={s} plan={plan} formatAmount={formatAmount} i={i} />)}
            </div>
          ) : (
            // Mensual: la semana en curso arriba, grande; las otras 3 en fila, en orden
            <div className="space-y-2.5">
              {actual && <SemanaAnimada s={actual} plan={plan} formatAmount={formatAmount} i={0} />}
              <div className="grid grid-cols-3 gap-2">
                {plan.semanas.filter(s => s !== actual).map((s, i) => <SemanaAnimada key={`${plan.periodo.inicio}-${s.indice}`} s={s} plan={plan} formatAmount={formatAmount} i={i + 1} />)}
              </div>
            </div>
          )
        ) : null}

        {actual && !sinSaldo && actual.meta > 0 && (
          <p className="text-[10px] text-muted-foreground text-center">
            {tr("Lo que no gastes en una semana pasa a las siguientes. Al cerrar cada semana sin pasarte ganas 5 monedas.")}
          </p>
        )}

        {/* Consejos */}
        {plan.consejos.length > 0 && !sinSaldo && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />{quincenal ? tr("Consejos para esta quincena") : tr("Consejos para este mes")}
            </p>
            {plan.consejos.map((c, i) => <Consejo key={i} c={c} formatAmount={formatAmount} i={i} />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Resumen: "si pagas tus obligaciones te quedan X" ─────────────────────────

function Resumen({ plan, formatAmount }: { plan: PlanSemanal; formatAmount: Fmt }) {
  if (plan.obligaciones >= plan.saldo) {
    return (
      <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/30 p-4">
        <p className="text-[11px] text-orange-800/80 dark:text-orange-200/80">{tr("Para cubrir tus obligaciones de este periodo te faltan")}</p>
        <motion.p key={plan.obligaciones - plan.saldo} initial={{ scale: 0.92, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-black text-cyclon-pink origin-left">
          {formatAmount(plan.obligaciones - plan.saldo)}
        </motion.p>
        <p className="text-[10px] text-orange-800/70 dark:text-orange-200/70 mt-1">{tr("Por ahora no queda plata libre para gastar: cualquier gasto extra sería deuda.")}</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-gradient-to-br from-kiri-cream/70 to-kiri-mint/40 dark:from-kiri-forest/50 dark:to-kiri-emerald/30 p-4">
      <p className="text-[11px] text-kiri-forest/80 dark:text-kiri-mint/80">
        {plan.obligaciones > 0 ? tr("Si pagas tus obligaciones de este periodo te quedan") : tr("No tienes obligaciones pendientes. Te quedan")}
      </p>
      <motion.p key={plan.remanente} initial={{ scale: 0.92, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }}
        className="text-2xl font-black text-kiri-forest dark:text-kiri-cream origin-left">
        {formatAmount(plan.remanente)}
      </motion.p>
      <div className="flex flex-wrap gap-2 mt-2">
        {plan.ahorro > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 dark:bg-black/20 px-2.5 py-1 text-[10px] font-semibold text-kiri-emerald dark:text-kiri-mint">
            <PiggyBank className="h-3 w-3" />{tr("{0} para tu ahorro", [formatAmount(plan.ahorro)])}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 dark:bg-black/20 px-2.5 py-1 text-[10px] font-semibold text-kiri-emerald dark:text-kiri-mint">
          <ShoppingBag className="h-3 w-3" />{tr("{0} para gastar", [formatAmount(plan.disponible)])}
        </span>
      </div>
    </div>
  )
}

// ─── Una semana ───────────────────────────────────────────────────────────────

function SemanaAnimada({ s, plan, formatAmount, i }: { s: SemanaPlan; plan: PlanSemanal; formatAmount: Fmt; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i, type: "spring", stiffness: 260, damping: 22 }}>
      <Semana s={s} plan={plan} formatAmount={formatAmount} />
    </motion.div>
  )
}

function Semana({ s, plan, formatAmount }: { s: SemanaPlan; plan: PlanSemanal; formatAmount: Fmt }) {
  if (s.estado === "actual") return <SemanaActual s={s} plan={plan} formatAmount={formatAmount} />

  const cerrada = s.estado === "lograda" || s.estado === "fallida"
  const lograda = s.estado === "lograda"
  const sinPlan = s.estado === "sin_plan" || s.estado === "pasada_sin_plan"

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-3 h-full min-h-[108px] flex flex-col",
      s.estado === "proxima" && "bg-muted/40 border border-dashed border-border",
      cerrada && "bg-muted/60 grayscale-[35%]",
      sinPlan && "bg-muted/30 opacity-70",
    )}>
      <p className={cn("text-[11px] font-bold", cerrada || sinPlan ? "text-muted-foreground" : "text-foreground/80")}>{tr("Semana {0}", [s.indice])}</p>
      <p className="text-[9px] text-muted-foreground">{rango(s)}</p>

      {s.estado === "proxima" && (
        <div className="mt-auto pt-2">
          <p className="text-base font-black text-foreground/70">{formatAmount(s.meta)}</p>
          <p className="text-[9px] text-muted-foreground flex items-center gap-1"><Hourglass className="h-2.5 w-2.5" />{tr("Planeado · se ajusta solo")}</p>
        </div>
      )}

      {cerrada && (
        <div className="mt-auto pt-2 space-y-0.5">
          <p className="text-[9px] text-muted-foreground">{tr("Meta {0}", [formatAmount(s.meta)])}</p>
          <p className={cn("text-sm font-black", lograda ? "text-kiri-emerald dark:text-kiri-spring" : "text-cyclon-pink")}>
            {tr("Gastaste {0}", [formatAmount(s.gastado)])}
          </p>
          {lograda ? (
            <p className="text-[9px] font-semibold text-kiri-emerald dark:text-kiri-spring flex items-center gap-1">
              <Coins className="h-2.5 w-2.5 text-amber-500" />{s.monedas > 0 ? tr("+{0} monedas", [s.monedas]) : tr("¡Excelente!")}
            </p>
          ) : (
            <p className="text-[9px] font-semibold text-cyclon-pink">{tr("Te pasaste {0}", [formatAmount(s.gastado - s.meta)])}</p>
          )}
        </div>
      )}

      {sinPlan && (
        <div className="mt-auto pt-2 flex items-center gap-1.5 text-muted-foreground">
          <CalendarX className="h-3.5 w-3.5" />
          <p className="text-[10px]">{tr("Sin plan esa semana")}</p>
        </div>
      )}

      {cerrada && <Sello lograda={lograda} />}
    </div>
  )
}

/** Cinta diagonal en la esquina: "Logrado" o "Fallido", entra como un sello. */
function Sello({ lograda }: { lograda: boolean }) {
  return (
    <motion.div
      initial={{ scale: 1.8, opacity: 0, rotate: 30 }} animate={{ scale: 1, opacity: 1, rotate: 45 }}
      transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.25 }}
      className={cn(
        "absolute -right-9 top-3.5 w-32 text-center text-[9px] font-black uppercase tracking-widest py-0.5 shadow-sm",
        lograda ? "bg-kiri-spring text-white" : "bg-cyclon-pink text-white",
      )}>
      {lograda ? tr("Logrado") : tr("Fallido")}
    </motion.div>
  )
}

function SemanaActual({ s, plan, formatAmount }: { s: SemanaPlan; plan: PlanSemanal; formatAmount: Fmt }) {
  const queda = Math.max(0, s.meta - s.gastado)
  const pasado = s.gastado > s.meta && s.meta > 0
  const pct = s.meta > 0 ? Math.max(0, Math.min(100, (queda / s.meta) * 100)) : 0
  const tono = pasado ? "from-cyclon-pink to-orange-400" : pct < 25 ? "from-amber-400 to-orange-400" : "from-kiri-spring to-emerald-400"

  return (
    <motion.div
      animate={{ boxShadow: ["0 0 0 0 rgba(82,183,136,0.0)", "0 0 0 6px rgba(82,183,136,0.18)", "0 0 0 0 rgba(82,183,136,0.0)"] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      className="relative h-full rounded-2xl p-3.5 bg-gradient-to-br from-kiri-emerald to-kiri-forest text-white flex flex-col min-h-[132px]">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-xs font-black">{tr("Semana {0}", [s.indice])}</p>
        <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold whitespace-nowrap">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-kiri-mint opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kiri-mint" />
          </span>
          {tr("Estás aquí")}
        </span>
      </div>
      <p className="text-[9px] text-white/60">{rango(s)}</p>

      <div className="mt-auto pt-2">
        {s.meta <= 0 ? (
          <p className="text-[11px] text-white/80">{tr("Esta semana no queda plata libre: cubre primero tus obligaciones.")}</p>
        ) : (
          <>
            <p className="text-[10px] text-white/70">{pasado ? tr("Te pasaste por") : tr("Te quedan")}</p>
            <motion.p key={pasado ? -queda : queda} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className={cn("text-2xl font-black leading-tight", pasado && "text-orange-200")}>
              {formatAmount(pasado ? s.gastado - s.meta : queda)}
            </motion.p>
            <p className="text-[9px] text-white/60">{tr("de {0} · gastado {1}", [formatAmount(s.meta), formatAmount(s.gastado)])}</p>
            {/* Barra que se vacía a medida que gastas */}
            <div className="mt-2 h-2 rounded-full bg-white/15 overflow-hidden">
              <motion.div className={cn("h-full rounded-full bg-gradient-to-r", tono)}
                initial={{ width: "100%" }} animate={{ width: `${pasado ? 100 : pct}%` }} transition={{ duration: 1, ease: "easeOut" }} />
            </div>
            {!pasado && (
              <p className="mt-2 text-[10px] font-semibold text-kiri-mint flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                {plan.diasQuedanSemana > 1
                  ? tr("Hoy puedes gastar {0} · quedan {1} días", [formatAmount(plan.hoyPuedes), plan.diasQuedanSemana])
                  : tr("Último día: puedes gastar {0}", [formatAmount(plan.hoyPuedes)])}
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}

// ─── Consejos ─────────────────────────────────────────────────────────────────

function Consejo({ c, formatAmount, i }: { c: ConsejoPlan; formatAmount: Fmt; i: number }) {
  const { Icono, texto, tono } = textoConsejo(c, formatAmount)
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
      className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-2.5">
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", tono)}>
        <Icono className="h-3.5 w-3.5" />
      </div>
      <p className="text-[11px] leading-snug text-foreground/80 pt-0.5">{texto}</p>
    </motion.div>
  )
}

const VERDE = "bg-kiri-spring/15 text-kiri-emerald dark:text-kiri-spring"
const AMBAR = "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
const CORAL = "bg-orange-100 text-cyclon-pink dark:bg-orange-950/40"
const AZUL = "bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300"

function textoConsejo(c: ConsejoPlan, f: Fmt): { Icono: typeof Sparkles; texto: string; tono: string } {
  switch (c.tipo) {
    case "sobrecargado": return { Icono: AlertTriangle, tono: CORAL, texto: tr("Tus obligaciones superan tu saldo por {0}. Paga primero las que cobran intereses o multas y deja para después lo que no sea esencial.", [f(c.faltante)]) }
    case "pasado_semana": return { Icono: Gauge, tono: CORAL, texto: tr("Esta semana ya te pasaste por {0}. Ajustamos las próximas semanas para que llegues al cobro: intenta solo gastos esenciales.", [f(c.exceso)]) }
    case "ritmo_rapido": return { Icono: Gauge, tono: AMBAR, texto: tr("Vas un poco rápido esta semana. Si te mantienes en {0} al día llegas bien al cierre.", [f(c.hoy)]) }
    case "ritmo_bien": return { Icono: TrendingUp, tono: VERDE, texto: tr("Vas a buen ritmo esta semana. Si sigues así cierras con plata de sobra y ganas tus monedas.") }
    case "deuda_cara": return { Icono: Landmark, tono: AZUL, texto: tr("Lo que te sobre al cerrar la semana, abónalo a {0}: es tu deuda más cara ({1}% al mes). Así sales antes de deudas y pagas menos intereses.", [c.nombre, c.tasa]) }
    case "deuda_pequena": return { Icono: Landmark, tono: AZUL, texto: tr("Lo que te sobre, abónalo a {0} (te faltan {1}). Saldar primero la deuda más pequeña libera una cuota y te da impulso.", [c.nombre, f(c.saldo)]) }
    case "hormiga": return { Icono: Bug, tono: AMBAR, texto: tr("Los gastos hormiga ya suman {0} este periodo. Pon un tope diario a cafés, domicilios y antojos.", [f(c.monto)]) }
    case "sobrante": return { Icono: ArrowRightLeft, tono: VERDE, texto: tr("Si llegas al cobro con plata de sobra, pásala a tu ahorro antes de que se vaya en gastos.") }
    case "sin_saldo": return { Icono: Wallet, tono: AMBAR, texto: tr("Registra tu ingreso para armar tu plan.") }
  }
}
