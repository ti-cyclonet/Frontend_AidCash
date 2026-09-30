"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  TrendingUp, TrendingDown, Target, ChevronRight, ChevronDown, Calendar, Zap, Shield,
  PiggyBank, AlertTriangle, Sparkles, Flag, MessageCircle, Info, Lock, Bookmark, Trash2, Plus,
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { getUserId, projectionsApi, type EscenarioProyeccion } from "@/lib/api-client"
import { usePlan } from "@/lib/plan-context"
import { Input } from "@/components/ui/input"
import {
  calculateProjections, aMensual, promedioMensual,
  type ProjectionResult, type ProjectionHito,
} from "@/lib/projections-logic"
import Link from "next/link"
import { tr, localeFecha } from "@/lib/i18n"

/**
 * Proyecciones — tu futuro con los datos reales (ver lib/projections-logic.ts).
 *
 * La idea es motivar con algo concreto: la fecha en que quedas libre de
 * deudas, cuánto te ahorras en intereses y qué pasa si pones un poco más al
 * mes. El usuario mueve el "aporte extra" y todo se recalcula en vivo.
 */

const claveAporte = () => `kiri_proyeccion_aporte_${getUserId() ?? "anon"}`
const fechaLarga = (d: Date | null) => d ? d.toLocaleDateString(localeFecha(), { month: "long", year: "numeric" }) : ""
/** Aviso "esto es de otro plan" (lo muestra <LimitePlanDialog>). */
const pedirPlan = (mensaje: string, plan: string) =>
  window.dispatchEvent(new CustomEvent("kiri:limite", { detail: { codigo: "FUNCION", mensaje, mejora: { plan } } }))

const mesesTxt = (n: number) => n === 1 ? tr("1 mes") : n < 24 ? tr("{0} meses", [n]) : tr("{0} años{1}", [Math.floor(n / 12), n % 12 ? tr(" y {0} meses", [n % 12]) : ""])

export function ProyeccionesTab() {
  const { formatAmount, income, incomeFrequency, tipoIngreso, ingresoEstimado } = useAppContext()
  const { debts, fixedExpenses, totalAhorrado, extraIncomes, loading } = useFinanceData()

  const { limite, hasFeature } = usePlan()
  // FREE ve hasta 3 meses; PLUS y PRO hasta 24
  const maxMeses = limite("mesesProyeccion") ?? 24
  const puedeHormiga = maxMeses > 3
  const puedeEscenarios = hasFeature("savedScenarios")
  const [activeRoute, setActiveRoute] = useState<"kiri" | "actual">("kiri")
  const [mesesElegidos, setMeses] = useState(12)
  const meses = Math.min(mesesElegidos, maxMeses)
  const [escenarios, setEscenarios] = useState<EscenarioProyeccion[]>([])
  const [nombreEscenario, setNombreEscenario] = useState("")
  const [guardandoEsc, setGuardandoEsc] = useState(false)
  useEffect(() => {
    if (!puedeEscenarios) return
    projectionsApi.escenarios().then(({ data }) => setEscenarios(data?.escenarios ?? []))
  }, [puedeEscenarios])
  // null = sigue la sugerencia de Kiri; un número = lo que el usuario eligió
  const [aporte, setAporte] = useState<number | null>(null)
  // El slider puede emitir cambios solo (al ajustar su máximo): solo cuenta lo que mueve el usuario
  const tocado = useRef(false)
  const [movs, setMovs] = useState<{ gastos: { monto: number; fecha: string; hormiga: boolean }[]; ahorros: { monto: number; fecha: string }[] } | null>(null)

  // Movimientos de los últimos meses (la lista de gastos del hook solo trae el periodo actual)
  useEffect(() => {
    projectionsApi.movimientos().then(({ data }) => setMovs(data ?? { gastos: [], ahorros: [] }))
  }, [])
  // Lo último que eligió en este navegador
  useEffect(() => {
    try { const v = localStorage.getItem(claveAporte()); if (v !== null && Number.isFinite(Number(v))) setAporte(Number(v)) } catch { /* sin storage */ }
  }, [])
  const [recortarHormiga, setRecortarHormiga] = useState(false)
  const [verDatos, setVerDatos] = useState(false)

  // ── Datos reales del mes ─────────────────────────────────────────────────
  const datos = useMemo(() => {
    const now = new Date()
    // `income` ya es MENSUAL (sueldo del mes; con ingresos variables, su
    // estimación o su promedio real). Antes se duplicaba a quien cobra quincenal.
    const sueldoMensual = income
    const extrasRecurrentes = extraIncomes
      .filter(e => e.temporalidad === "indefinido" || (e.temporalidad === "definido" && (e.mesesRestantes ?? 0) > 0))
      .reduce((a, e) => a + e.monto, 0)
    const activas = debts.filter(d => d.estado !== "saldada" && d.saldoRestante > 0)
    const deudas = activas.map(d => ({
      id: d.id, nombre: d.nombre, saldo: d.saldoRestante,
      cuotaMensual: aMensual(d.cuotaBase ?? d.cuotaPeriodo, d.frecuenciaPago),
      tasaMensual: d.tasaInteres ?? null,
    }))
    const gastosFijosMensual = fixedExpenses.reduce((a, f) => a + aMensual(f.monto, f.frecuencia), 0)
    // Gastos con tarjeta ya vienen excluidos (están en la cuota de la tarjeta)
    const variables = movs?.gastos ?? []
    const hormiga = (movs?.gastos ?? []).filter(g => g.hormiga)
    const ahorros = movs?.ahorros ?? []
    return {
      ingresoMensual: sueldoMensual + extrasRecurrentes,
      sueldoMensual, extrasRecurrentes, deudas, gastosFijosMensual,
      gastoVariableMensual: Math.round(promedioMensual(variables, now)),
      hormigaMensual: Math.round(promedioMensual(hormiga, now)),
      ahorroMensualActual: Math.round(promedioMensual(ahorros, now)),
      sinTasa: activas.filter(d => !d.tasaInteres).length,
    }
  }, [income, incomeFrequency, extraIncomes, debts, fixedExpenses, movs])

  // Base (sin aporte) para saber el flujo libre y la sugerencia. Espera a que
  // carguen obligaciones y movimientos: con datos a medias la sugerencia salía
  // enorme (la mitad del ingreso sin restarle nada).
  const listo = !loading && movs !== null
  const base = useMemo(() => listo && datos.ingresoMensual > 0
    ? calculateProjections({ ...datos, ahorroInicial: totalAhorrado, aporteExtra: 0, meses })
    : null, [listo, datos, totalAhorrado, meses])

  const elegirAporte = (v: number) => {
    setAporte(v)
    try { localStorage.setItem(claveAporte(), String(v)) } catch { /* sin storage */ }
  }

  const aporteElegido = aporte ?? base?.aporteSugerido ?? 0
  const extraHormiga = recortarHormiga && puedeHormiga ? Math.round(datos.hormigaMensual / 2) : 0
  const aporteTotal = aporteElegido + extraHormiga
  const projection = useMemo((): ProjectionResult | null => listo && datos.ingresoMensual > 0
    ? calculateProjections({ ...datos, ahorroInicial: totalAhorrado, aporteExtra: aporteTotal, meses })
    : null, [listo, datos, totalAhorrado, aporteTotal, meses])

  if (!listo) {
    return <div className="space-y-4"><div className="h-28 rounded-2xl bg-muted/30 animate-pulse" /><div className="h-40 rounded-2xl bg-muted/30 animate-pulse" /><div className="h-64 rounded-2xl bg-muted/30 animate-pulse" /></div>
  }
  if (!projection || !base) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <TrendingUp className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground text-center">{tr("Configura tu ingreso y obligaciones")}<br />{tr("para ver tus proyecciones financieras.")}</p>
      </div>
    )
  }

  const hayDeudas = datos.deudas.length > 0
  const flujo = base.flujoLibre
  const maxSlider = Math.max(flujo, base.aporteSugerido, aporte ?? 0, 100000)
  const pasoSlider = maxSlider > 2000000 ? 50000 : 10000
  const libreDespues = flujo - aporteElegido
  const deudaTotal = datos.deudas.reduce((a, d) => a + d.saldo, 0)
  const patrimonioActual = totalAhorrado - deudaTotal
  const now = new Date()
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + meses, 1).toLocaleDateString(localeFecha(), { month: "short", year: "numeric" })
  const objetivo = hayDeudas && projection.estrategia
    ? [...datos.deudas].sort((a, b) => projection.estrategia === "avalancha" ? ((b.tasaMensual ?? 0) - (a.tasaMensual ?? 0)) || (a.saldo - b.saldo) : a.saldo - b.saldo)[0]
    : null

  // ── Recomendaciones con los datos ─────────────────────────────────────
  const metaColchon = projection.obligacionesMensual * 3
  const faltaColchon = Math.max(0, metaColchon - totalAhorrado)
  const recomendaciones: { icon: React.ReactNode; title: string; desc: string; href: string }[] = []
  if (flujo < 0) {
    recomendaciones.push({ icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, title: tr("Tu mes está en rojo"), desc: tr("Entre obligaciones, gastos y ahorro sales {0} por encima de lo que entra. Revisa tus categorías de Presupuesto para encontrar dónde recortar.", [formatAmount(-flujo)]), href: "/gestion?tab=presupuesto" })
  }
  if (hayDeudas) {
    recomendaciones.push(datos.sinTasa > 0
      ? { icon: <Zap className="h-3.5 w-3.5 text-amber-500" />, title: tr("Registra las tasas"), desc: tr("{0} de tus deudas no tiene tasa de interés. Con ella Kiri calcula los intereses reales y cuál conviene pagar primero.", [datos.sinTasa]), href: "/obligaciones" }
      : { icon: <Zap className="h-3.5 w-3.5 text-amber-500" />, title: tr("Ataca primero {0}", [objetivo?.nombre ?? tr("la deuda más cara")]), desc: tr("Es la de {0}. Todo abono extra a esa deuda rinde más; cuando termine, pasa su cuota a la siguiente.", [projection.estrategia === "avalancha" ? tr("tasa más alta") : tr("saldo más pequeño")]), href: "/obligaciones" })
  }
  if (projection.obligacionesMensual > 0) {
    recomendaciones.push(faltaColchon > 0
      ? { icon: <PiggyBank className="h-3.5 w-3.5 text-emerald-500" />, title: tr("Fondo de emergencia"), desc: tr("Tus obligaciones suman {0} al mes; 3 meses son {1}. Te faltan {2}.", [formatAmount(projection.obligacionesMensual), formatAmount(metaColchon), formatAmount(faltaColchon)]), href: "/ahorro" }
      : { icon: <PiggyBank className="h-3.5 w-3.5 text-emerald-500" />, title: tr("Fondo de emergencia completo"), desc: tr("Tus ahorros ya cubren 3 meses de obligaciones. Lo que sigas ahorrando puede ir a tus metas."), href: "/ahorro" })
  }
  recomendaciones.push(datos.hormigaMensual > 0
    ? { icon: <Shield className="h-3.5 w-3.5 text-cyclon-lavender" />, title: tr("Gasto hormiga"), desc: tr("Vas en unos {0} al mes en gastos hormiga. Recortar la mitad son {1} más al mes para tu plan (actívalo arriba y mira el cambio).", [formatAmount(datos.hormigaMensual), formatAmount(Math.round(datos.hormigaMensual / 2))]), href: "/balance" }
    : { icon: <Shield className="h-3.5 w-3.5 text-cyclon-lavender" />, title: tr("Registra tus gastos del día a día"), desc: tr("Sin tus gastos variables la proyección sale más optimista de lo real. Anótalos (por voz es más rápido) y la proyección se ajusta sola."), href: "/obligaciones" })

  const preguntarCoach = () => {
    window.dispatchEvent(new CustomEvent("kiri:coach-ask", {
      detail: { mensaje: hayDeudas ? tr("Explícame mi proyección y cómo puedo salir de deudas más rápido") : tr("Explícame mi proyección y cómo puedo ahorrar más") },
    }))
  }

  return (
    <div className="space-y-5">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2"><TrendingUp className="h-5 w-5" />{" "}{tr("Proyecciones")}</h1>
          <p className="text-xs text-muted-foreground">{tr("Tu futuro con tus datos reales — y lo que cambia si decides poner un poco más.")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-muted/30 rounded-xl p-1">
            {[3, 6, 12, 24].map(m => {
              const bloqueado = m > maxMeses
              return (
                <button key={m}
                  onClick={() => bloqueado ? pedirPlan(tr("Proyectar a {0} meses es parte de KIRI PLUS. En KIRI FREE ves hasta {1} meses.", [m, maxMeses]), tr("KIRI PLUS")) : setMeses(m)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1",
                    meses === m ? "bg-kiri-emerald text-white shadow-sm" : bloqueado ? "text-muted-foreground/60" : "text-muted-foreground hover:text-foreground"
                  )}>{bloqueado && <Lock className="h-2.5 w-2.5" />}{m}{" "}{tr("meses")}</button>
              )
            })}
          </div>
          <span className="text-[10px] text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg flex items-center gap-1">
            <Calendar className="h-3 w-3" />{" "}{tr("hasta")}{" "}{rangeEnd}
          </span>
        </div>
      </div>

      {/* ═══ HERO: la meta concreta ═══ */}
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br from-kiri-emerald/15 via-card to-card">
        <CardContent className="p-5 space-y-2">
          {hayDeudas ? (
            projection.fechaLibreKiri ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-kiri-emerald flex items-center gap-1"><Flag className="h-3 w-3" />{" "}{tr("Tu día sin deudas")}</p>
                <p className="text-2xl font-black leading-tight first-letter:uppercase">{fechaLarga(projection.fechaLibreKiri)}</p>
                <p className="text-sm text-muted-foreground">
                  {projection.mesesMenosDeuda > 0
                    ? <>{tr("Con tu plan Kiri,")}{" "}<strong className="text-foreground">{mesesTxt(projection.mesesMenosDeuda)}{" "}{tr("antes")}</strong>{" "}{tr("que siguiendo igual")}{projection.interesesAhorrados > 0 && <> y <strong className="text-emerald-600 dark:text-emerald-400">{tr("{0} menos en intereses", [formatAmount(projection.interesesAhorrados)])}</strong></>}.</>
                    : projection.mesesMenosDeuda === -1
                      ? <>{tr("Con solo las cuotas de hoy")}{" "}<strong className="text-red-500">{tr("tus deudas no terminarían")}</strong>{tr(": los intereses se comen la cuota. El aporte extra es lo que te saca.")}</>
                      : aporteTotal > 0 ? <>{tr("Siguiendo tus cuotas de hoy. Sube el aporte extra para llegar antes.")}</> : <>{tr("Siguiendo tus cuotas de hoy. Pon un aporte extra abajo y mira cuánto se adelanta.")}</>}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{" "}{tr("Ojo con tus deudas")}</p>
                <p className="text-lg font-black leading-tight">{tr("Con estos pagos tus deudas no terminan")}</p>
                <p className="text-sm text-muted-foreground">{tr("Los intereses crecen más rápido que tus cuotas. Sube el aporte extra o revisa las cuotas en Obligaciones.")}</p>
              </>
            )
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-kiri-emerald flex items-center gap-1"><Sparkles className="h-3 w-3" />{" "}{tr("Sin deudas: todo suma")}</p>
              <p className="text-2xl font-black leading-tight">{formatAmount(projection.kiriFinal.ahorro)}</p>
              <p className="text-sm text-muted-foreground">{tr("ahorrados en {0} meses con tu plan Kiri", [meses])}{projection.mejoraPatrimonio > 0 && <> — <strong className="text-emerald-600 dark:text-emerald-400">{tr("{0} más", [formatAmount(projection.mejoraPatrimonio)])}</strong>{" "}{tr("que siguiendo igual")}</>}.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ TU PLAN: aporte extra ═══ */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-sm">{tr("Tu plan Kiri")}</h3>
              <p className="text-[11px] text-muted-foreground">
                {hayDeudas
                  ? projection.estrategia === "avalancha"
                    ? <>{tr("Aporte extra al mes → a")}{" "}<strong className="text-foreground">{objetivo?.nombre}</strong>{" "}{tr("(la de tasa más alta). Cuando termina, su cuota pasa a la siguiente.")}</>
                    : <>{tr("Aporte extra al mes → a")}{" "}<strong className="text-foreground">{objetivo?.nombre}</strong>{" "}{tr("(la más pequeña). Cuando termina, su cuota pasa a la siguiente.")}</>
                  : tr("Aporte extra al mes que va directo a tu ahorro.")}
              </p>
            </div>
            <p className="text-lg font-black text-kiri-emerald shrink-0">+{formatAmount(aporteElegido)}</p>
          </div>
          <Slider value={[aporteElegido]} min={0} max={maxSlider} step={pasoSlider} onPointerDown={() => { tocado.current = true }} onKeyDown={() => { tocado.current = true }} onValueChange={([v]) => { if (tocado.current) elegirAporte(v) }} aria-label={tr("Aporte extra al mes")} />
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
            {flujo > 0 ? (
              <span className={cn(libreDespues < 0 ? "text-red-500 font-bold" : "text-muted-foreground")}>
                {libreDespues >= 0 ? <>{tr("Te quedan")}{" "}<strong className="text-foreground">{formatAmount(libreDespues)}</strong>{" "}{tr("libres al mes para imprevistos")}</> : <>{tr("Te pasas {0} de lo que te queda libre", [formatAmount(-libreDespues)])}</>}
              </span>
            ) : (
              <span className="text-red-500 font-bold">{tr("Hoy no te queda plata libre al mes: primero hay que recortar gastos.")}</span>
            )}
            {base.aporteSugerido > 0 && aporteElegido !== base.aporteSugerido && (
              <button onClick={() => elegirAporte(base.aporteSugerido)} className="px-2.5 py-1 rounded-lg bg-kiri-emerald/10 text-kiri-emerald font-bold hover:bg-kiri-emerald/20">{tr("Usar sugerido: {0}", [formatAmount(base.aporteSugerido)])}</button>
            )}
          </div>
          {datos.hormigaMensual > 0 && (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2.5 cursor-pointer">
              <span className="text-[11px]">
                <strong>{tr("Recortar la mitad de los gastos hormiga")}</strong>
                <span className="text-muted-foreground">{" "}{tr("· +{0} al mes al plan", [formatAmount(Math.round(datos.hormigaMensual / 2))])}</span>
                {!puedeHormiga && <span className="ml-1 text-[9px] font-black text-kiri-emerald">{tr("PLUS")}</span>}
              </span>
              <Switch checked={recortarHormiga && puedeHormiga}
                onCheckedChange={v => puedeHormiga ? setRecortarHormiga(v) : pedirPlan(tr("Simular el recorte de tus gastos hormiga es parte de KIRI PLUS."), tr("KIRI PLUS"))} />
            </label>
          )}

          {/* Escenarios guardados (KIRI PRO) */}
          <div className="rounded-xl border border-dashed border-border px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold flex items-center gap-1"><Bookmark className="h-3.5 w-3.5 text-amber-500" />{" "}{tr("Mis escenarios")}</p>
              {!puedeEscenarios && <span className="text-[9px] font-black text-amber-600">{tr("PRO")}</span>}
            </div>
            {puedeEscenarios ? (
              <>
                {escenarios.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {escenarios.map(e => (
                      <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-[10px] font-bold pl-2.5 pr-1 py-1">
                        <button onClick={() => { tocado.current = true; elegirAporte(e.aporteExtra); setRecortarHormiga(e.recortarHormiga); setMeses(e.meses) }}
                          title={tr("{0} al mes · {1} meses{2}", [formatAmount(e.aporteExtra), e.meses, e.recortarHormiga ? tr(" · recortando hormiga") : ""])}>
                          {e.nombre}
                        </button>
                        <button onClick={async () => { const { error } = await projectionsApi.borrarEscenario(e.id); if (!error) setEscenarios(p => p.filter(x => x.id !== e.id)) }}
                          className="h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive" aria-label={tr("Borrar {0}", [e.nombre])}>
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <form className="flex gap-2" onSubmit={async ev => {
                  ev.preventDefault()
                  const nombre = nombreEscenario.trim()
                  if (!nombre || guardandoEsc) return
                  setGuardandoEsc(true)
                  const { data } = await projectionsApi.guardarEscenario({ nombre, aporteExtra: aporteElegido, recortarHormiga: recortarHormiga && puedeHormiga, meses })
                  setGuardandoEsc(false)
                  if (data?.escenario) { setEscenarios(p => [data.escenario, ...p]); setNombreEscenario("") }
                }}>
                  <Input value={nombreEscenario} onChange={e => setNombreEscenario(e.target.value)} maxLength={60}
                    placeholder={tr("Ej: Plan agresivo, Con prima…")} className="h-8 text-xs" />
                  <button type="submit" disabled={!nombreEscenario.trim() || guardandoEsc}
                    className="h-8 px-3 rounded-lg bg-amber-500 text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-50 shrink-0">
                    <Plus className="h-3.5 w-3.5" />{" "}{tr("Guardar")}</button>
                </form>
              </>
            ) : (
              <button onClick={() => pedirPlan(tr("Guardar escenarios para compararlos es parte de KIRI PRO."), tr("KIRI PRO"))}
                className="text-[11px] text-muted-foreground text-left hover:text-foreground">{tr("Guarda este plan (aporte, horizonte y recorte) y compáralo con otros.")}{" "}<span className="font-bold text-amber-600">{tr("Disponible en KIRI PRO")}</span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══ GRÁFICA + HITOS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-none bg-card shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setActiveRoute("actual")} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors",
                activeRoute === "actual" ? "bg-red-500/10 text-red-500" : "bg-muted/30 text-muted-foreground")}>
                <TrendingDown className="h-3 w-3" />{" "}{tr("Siguiendo igual")}</button>
              <button onClick={() => setActiveRoute("kiri")} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors",
                activeRoute === "kiri" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/30 text-muted-foreground")}>
                <TrendingUp className="h-3 w-3" />{" "}{tr("Con tu plan Kiri")}</button>
            </div>
            <div className="flex gap-4 mb-3 text-[9px] flex-wrap">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{" "}{tr("Ahorro acumulado")}</span>
              {hayDeudas && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />{" "}{tr("Deuda total")}</span>}
              <span className="flex items-center gap-1 text-muted-foreground">{tr("--- Patrimonio neto")}</span>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projection.months} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ahorroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="deudaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" tickFormatter={v => Math.abs(v) >= 1000000 ? tr("${0}M", [Math.abs(v) >= 10000000 ? Math.round(v / 1000000).toLocaleString(localeFecha()) : (v / 1000000).toFixed(1)]) : tr("${0}k", [Math.round(v / 1000)])} width={56} />
                  <Tooltip content={<ProjectionTooltip formatAmount={formatAmount} />} />
                  <Area type="monotone" dataKey={activeRoute === "kiri" ? "ahorroKiri" : "ahorroActual"} stroke="#10b981" strokeWidth={2} fill="url(#ahorroGrad)" name="Ahorro" />
                  {hayDeudas && <Area type="monotone" dataKey={activeRoute === "kiri" ? "deudaKiri" : "deudaActual"} stroke="#ef4444" strokeWidth={2} fill="url(#deudaGrad)" name="Deuda" />}
                  <Area type="monotone" dataKey={activeRoute === "kiri" ? "patrimonioKiri" : "patrimonioActual"} stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 3" fill="none" name="Patrimonio" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-sm">{tr("Tus próximos logros")}{" "}<span className="text-muted-foreground font-normal">{tr("(plan Kiri)")}</span></h3>
            {projection.hitos.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {hayDeudas || projection.obligacionesMensual > 0
                  ? tr("En este horizonte todavía no hay logros: amplía a más meses o sube el aporte extra.")
                  : tr("Registra tus obligaciones para calcular tu fondo de emergencia.")}
              </p>
            ) : (
              <div className="space-y-3">
                {projection.hitos.slice(0, 6).map((h, i) => <HitoItem key={i} hito={h} />)}
                {projection.hitos.length > 6 && <p className="text-[10px] text-muted-foreground text-center">{tr("y {0} logros más", [projection.hitos.length - 6])}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ COMPARACIÓN ═══ */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-bold text-sm">{tr("Dentro de {0} meses", [meses])}</h3>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <RutaCard titulo={tr("Siguiendo igual")} ruta={projection.actualFinal} hayDeudas={hayDeudas} formatAmount={formatAmount} />
            <span className="text-xs font-black text-muted-foreground">{tr("VS")}</span>
            <RutaCard titulo={tr("Con tu plan Kiri")} ruta={projection.kiriFinal} hayDeudas={hayDeudas} formatAmount={formatAmount} kiri />
          </div>
          <p className="text-[10px] text-muted-foreground">{tr("Patrimonio de hoy:")}{" "}<strong className={patrimonioActual >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>{formatAmount(patrimonioActual)}</strong>{" "}{tr("(ahorros menos deudas).")}</p>
        </CardContent>
      </Card>

      {/* ═══ MÉTRICAS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniMetric label={tr("Intereses que te ahorras")} value={formatAmount(projection.interesesAhorrados)} sub={hayDeudas ? tr("Hasta terminar tus deudas") : tr("No tienes deudas")} color="text-emerald-500" />
        <MiniMetric label={tr("Libre de deudas")}
          value={!hayDeudas ? tr("¡Ya lo estás!") : projection.fechaLibreKiri ? fechaLarga(projection.fechaLibreKiri) : tr("No termina")}
          sub={!hayDeudas ? tr("Sin cuotas pendientes") : projection.mesesMenosDeuda > 0 ? `${mesesTxt(projection.mesesMenosDeuda)} antes` : projection.fechaLibreKiri ? tr("En {0}", [mesesTxt(projection.kiriFinal.mesesLibreDeuda ?? 0)]) : tr("Sube el aporte extra")} />
        <MiniMetric label={tr("Patrimonio extra")} value={`${projection.mejoraPatrimonio >= 0 ? "+" : ""}${formatAmount(projection.mejoraPatrimonio)}`} sub={tr("Con el plan, en {0} meses", [meses])} color={projection.mejoraPatrimonio >= 0 ? "text-emerald-500" : "text-red-500"} />
        <MiniMetric label={tr("Colchón al final")} value={projection.obligacionesMensual > 0 ? tr("{0} meses", [projection.colchonFinalKiri]) : "—"} sub={tr("De obligaciones cubiertas (meta: 3)")} color={projection.colchonFinalKiri >= 3 ? "text-emerald-500" : undefined} />
      </div>

      {/* ═══ RECOMENDACIONES ═══ */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-1.5">{tr("Recomendaciones de Kiri Coach")}{" "}<span>🌱</span></h3>
              <p className="text-[10px] text-muted-foreground">{tr("Salen de tus datos y de esta proyección.")}</p>
            </div>
            <button onClick={preguntarCoach} className="shrink-0 px-3 py-1.5 rounded-xl bg-kiri-emerald/10 text-kiri-emerald text-[11px] font-bold flex items-center gap-1 hover:bg-kiri-emerald/20">
              <MessageCircle className="h-3.5 w-3.5" />{" "}{tr("Pregúntale")}</button>
          </div>
          <div className="space-y-2">
            {recomendaciones.map(r => <RecoCard key={r.title} {...r} />)}
          </div>
        </CardContent>
      </Card>

      {/* ═══ CON QUÉ DATOS SE CALCULA ═══ */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-0">
          <button onClick={() => setVerDatos(v => !v)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-bold">
            <span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-muted-foreground" />{" "}{tr("¿Con qué datos se calcula?")}</span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", verDatos && "rotate-180")} />
          </button>
          {verDatos && (
            <div className="px-4 pb-4 space-y-1.5 text-[11px]">
              <Fila label={tipoIngreso === "variable" ? (ingresoEstimado > 0 ? tr("Ingreso al mes (tu estimación)") : tr("Ingreso al mes (tu promedio real)")) : tr("Ingreso al mes{0}", [incomeFrequency === "quincenal" ? tr(" (2 quincenas)") : ""])} valor={formatAmount(datos.sueldoMensual)} />
              {datos.extrasRecurrentes > 0 && <Fila label={tr("Ingresos extra recurrentes")} valor={`+${formatAmount(datos.extrasRecurrentes)}`} />}
              <Fila label={tr("Gastos fijos al mes")} valor={`-${formatAmount(datos.gastosFijosMensual)}`} />
              <Fila label={tr("Cuotas de deudas al mes")} valor={`-${formatAmount(projection.obligacionesMensual - datos.gastosFijosMensual)}`} />
              <Fila label={tr("Gastos variables (promedio real)")} valor={`-${formatAmount(datos.gastoVariableMensual)}`} />
              <Fila label={tr("Lo que vienes ahorrando (promedio real)")} valor={`-${formatAmount(datos.ahorroMensualActual)}`} />
              <div className="border-t border-border pt-1.5">
                <Fila label={tr("Te queda libre al mes")} valor={formatAmount(flujo)} fuerte color={flujo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"} />
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">{tr("Los promedios salen de tus últimos 3 meses en Kiri. Las tasas de interés son mensuales, como las registras en Obligaciones. Siguiendo igual = pagas tus cuotas y ahorras lo mismo que hasta ahora.")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[9px] text-muted-foreground text-center">{tr("*Estimaciones con tus datos de hoy; se actualizan solas a medida que registras movimientos.")}</p>
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function ProjectionTooltip({ active, payload, label, formatAmount }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string; formatAmount: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg space-y-1">
      {label && <p className="text-[9px] font-bold text-muted-foreground first-letter:uppercase">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[9px] text-muted-foreground">{p.name}:</span>
          <span className="text-[10px] font-black">{formatAmount(Math.abs(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

function RutaCard({ titulo, ruta, hayDeudas, formatAmount, kiri }: { titulo: string; ruta: ProjectionResult["kiriFinal"]; hayDeudas: boolean; formatAmount: (n: number) => string; kiri?: boolean }) {
  return (
    <div className={cn("rounded-xl p-3 space-y-2", kiri ? "bg-kiri-emerald/5 border border-kiri-emerald/20" : "bg-muted/30")}>
      <p className={cn("text-[9px] font-bold", kiri ? "text-kiri-emerald" : "text-muted-foreground")}>{titulo}</p>
      <div className="space-y-1.5">
        <div>
          <p className="text-[8px] text-muted-foreground">{tr("Ahorro acumulado")}</p>
          <p className={cn("text-xs font-black", kiri && "text-emerald-600 dark:text-emerald-400")}>{formatAmount(ruta.ahorro)}</p>
        </div>
        {hayDeudas && (
          <div>
            <p className="text-[8px] text-muted-foreground">{tr("Deuda pendiente")}</p>
            <p className="text-xs font-black text-red-500">{ruta.deuda > 0 ? formatAmount(ruta.deuda) : tr("¡Cero!")}</p>
          </div>
        )}
      </div>
      <div className={cn("pt-1 border-t", kiri ? "border-kiri-emerald/20" : "border-border")}>
        <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", ruta.patrimonio >= 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400")}>{tr("Patrimonio: {0}{1}", [ruta.patrimonio >= 0 ? "+" : "", formatAmount(ruta.patrimonio)])}</span>
      </div>
    </div>
  )
}

function HitoItem({ hito }: { hito: ProjectionHito }) {
  const estilo = {
    deuda: { bg: "bg-amber-500/15", icon: <Target className="h-3 w-3 text-amber-500" /> },
    ahorro: { bg: "bg-emerald-500/15", icon: <PiggyBank className="h-3 w-3 text-emerald-500" /> },
    emergencia: { bg: "bg-blue-500/15", icon: <Shield className="h-3 w-3 text-blue-500" /> },
    meta: { bg: "bg-cyclon-lavender/20", icon: <Flag className="h-3 w-3 text-cyclon-lavender" /> },
  }[hito.tipo]
  return (
    <div className="flex items-start gap-2.5">
      <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5", estilo.bg)}>{estilo.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground first-letter:uppercase">{hito.mesLabel}</p>
        <p className="text-xs font-bold">{hito.titulo}</p>
        <p className="text-[10px] text-muted-foreground">{hito.descripcion}</p>
      </div>
    </div>
  )
}

function RecoCard({ icon, title, desc, href }: { icon: React.ReactNode; title: string; desc: string; href: string }) {
  return (
    <Link href={href}>
      <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer">
        <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold">{title}</p>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
      </div>
    </Link>
  )
}

function MiniMetric({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-3">
        <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-sm font-black mt-0.5 first-letter:uppercase", color)}>{value}</p>
        <p className="text-[8px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

function Fila({ label, valor, fuerte, color }: { label: string; valor: string; fuerte?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn(fuerte ? "font-bold" : "text-muted-foreground")}>{label}</span>
      <span className={cn("font-bold shrink-0", color)}>{valor}</span>
    </div>
  )
}
