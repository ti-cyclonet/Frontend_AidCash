"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { ArrowLeft, Calendar, History, Search, Trash2, X, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { impulseApi, reportsApi, userApi, planSemanalApi, type BalanceReport, type Movement, type MovementType, type SemanaPlanGuardada } from "@/lib/api-client"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useToast } from "@/hooks/use-toast"
import { buildMovements } from "@/lib/balance-movements"
import { getCurrentQuincena, getPeriodDateRange, getQuincenasDelMes } from "@/lib/period-filter"
import { ExportButtons } from "@/components/balance/ExportButtons"
import { MovementList, MOVEMENT_FILTERS, esEntrada } from "@/components/balance/MovementList"
import { SemanasDelPeriodo, partirEnSemanas, enSemana } from "@/components/balance/SemanasDelPeriodo"
import { usePlan } from "@/lib/plan-context"
import { tr, localeFecha } from "@/lib/i18n"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Historial de movimientos — módulo propio (antes era una sección de Balance)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Por defecto muestra SOLO el periodo de ingreso actual (la quincena o el mes
 * en curso): cuando empieza el siguiente, lo anterior deja de verse aquí. Los
 * periodos pasados se consultan con "Elegir mes" — para un usuario quincenal,
 * ese mes trae dos botones, Periodo 1 y Periodo 2, y se ve uno a la vez. El
 * periodo se parte en las semanas del plan semanal (2 o 4): cada una muestra
 * lo gastado y su sello, y al tocarla la lista queda solo con esa semana.
 * "PDF" abre el selector de meses y descarga solo después de elegir.
 */

type Vista = { tipo: "actual" } | { tipo: "mes"; year: number; month: number }

const DIA = 86_400_000
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fmtDia = (d: Date) => d.toLocaleDateString(localeFecha(), { day: "numeric", month: "short" })
const nombreMes = (year: number, month: number) => {
  const s = new Date(year, month, 1).toLocaleDateString(localeFecha(), { month: "long", year: "numeric" })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
/** Rango [start, end) → "15 sept – 29 sept" (end es exclusivo). */
const fmtRango = (start: Date, end: Date) => `${fmtDia(start)} – ${fmtDia(new Date(end.getTime() - DIA))}`

/** Últimos meses para elegir: 12, o 24 si el plan guarda 24 meses o más. */
function ultimosMeses(mesesPlan: number) {
  const now = new Date()
  return Array.from({ length: mesesPlan >= 24 ? 24 : 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: nombreMes(d.getFullYear(), d.getMonth()), actual: i === 0, bloqueado: i >= mesesPlan }
  })
}

function totales(movs: Movement[]) {
  // Lo que no movió la billetera (ej. "Préstamo registrado" sin sacar plata) no suma
  const reales = movs.filter(m => !m.noMueveBilletera)
  const entradas = reales.filter(esEntrada).reduce((s, m) => s + m.monto, 0)
  const salidas = reales.filter(m => !esEntrada(m)).reduce((s, m) => s + m.monto, 0)
  return { entradas, salidas }
}

export default function HistorialPage() {
  const { formatAmount, incomeFrequency, diasCobro } = useAppContext()
  const quincenal = incomeFrequency === "quincenal"

  const [vista, setVista] = useState<Vista>({ tipo: "actual" })
  const [report, setReport] = useState<BalanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<"todos" | MovementType>("todos")
  const [busqueda, setBusqueda] = useState("")
  const [mesModalOpen, setMesModalOpen] = useState(false)
  // Cuántos meses de historial ve según el plan (FREE 3, PLUS 24, PRO sin límite)
  const { limite } = usePlan()
  const mesesPlan = limite("mesesHistorial") ?? 999999
  const { refetch } = useFinanceData()
  const { toast } = useToast()

  // ── Eliminar un gasto: se revierte TODO como si no se hubiera registrado ──
  // (plata de vuelta al gasto libre o a la tarjeta con que se pagó, deja de
  // contar en su categoría y en gastos hormiga, y sale de este historial).
  const [aEliminar, setAEliminar] = useState<Movement | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const esIngreso = aEliminar?.tipo === "ingresos"
  const confirmarEliminar = async () => {
    if (!aEliminar) return
    // Ingreso: la billetera pierde exactamente lo que ese ingreso le sumó
    if (aEliminar.tipo === "ingresos") {
      setEliminando(true)
      const { data, error } = await userApi.deleteIncome(aEliminar.id)
      setEliminando(false)
      if (error || !data) {
        toast({ title: tr("No se pudo eliminar"), description: error ?? tr("Intenta de nuevo."), variant: "destructive" })
        return
      }
      toast({ title: tr("Eliminaste el ingreso de {0}", [formatAmount(data.monto)]), description: tr("Tu billetera quedó como si nunca lo hubieras registrado.") })
      setAEliminar(null)
      setRecarga(n => n + 1)
      window.dispatchEvent(new Event("kiri:wallet-updated"))
      refetch()
      return
    }
    setEliminando(true)
    const { data, error } = await impulseApi.delete(aEliminar.id)
    setEliminando(false)
    if (error || !data) {
      toast({ title: tr("No se pudo eliminar"), description: error ?? tr("Intenta de nuevo."), variant: "destructive" })
      return
    }
    toast({
      title: tr("Eliminaste \"{0}\"", [aEliminar.nombre]),
      description: data.reversion.tipo === "tarjeta"
        ? tr("Se revirtieron {0} de tu tarjeta{1}.", [formatAmount(data.reversion.monto), data.reversion.tarjetaNombre ? ` ${data.reversion.tarjetaNombre}` : ""])
        : tr("Volvieron {0} a tu gasto libre.", [formatAmount(data.reversion.monto)]),
    })
    setAEliminar(null)
    setRecarga(n => n + 1)
    window.dispatchEvent(new Event("kiri:wallet-updated"))
    refetch()
  }

  // Periodos de lo que se está viendo: uno (periodo actual o un mes mensual) o
  // dos (un mes de un usuario quincenal: Periodo 1 y Periodo 2).
  const periodos = useMemo(() => {
    if (vista.tipo === "actual") return [{ periodo: 1, ...getPeriodDateRange(incomeFrequency, diasCobro) }]
    if (quincenal) return getQuincenasDelMes(diasCobro, vista.year, vista.month)
    return [{ periodo: 1, start: new Date(vista.year, vista.month, 1), end: new Date(vista.year, vista.month + 1, 1) }]
  }, [vista, incomeFrequency, diasCobro, quincenal])
  // Rango [start, end) que se pide al servidor (todo lo que se está viendo)
  const rango = useMemo(() => ({ start: periodos[0].start, end: periodos[periodos.length - 1].end }), [periodos])

  // Periodo elegido (por defecto, el que contiene hoy) y semana elegida
  const [periodoSel, setPeriodoSel] = useState(0)
  const [semanaSel, setSemanaSel] = useState<number | null>(null)
  useEffect(() => {
    const hoy = new Date()
    const i = periodos.findIndex(p => hoy >= p.start && hoy < p.end)
    setPeriodoSel(i >= 0 ? i : 0)
    setSemanaSel(null)
  }, [periodos])
  const periodo = periodos[Math.min(periodoSel, periodos.length - 1)]
  const semanas = useMemo(() => partirEnSemanas(periodo.start, periodo.end, quincenal ? 2 : 4), [periodo, quincenal])

  // Semanas guardadas del plan (meta y sello) en lo que se está viendo
  const [planSemanas, setPlanSemanas] = useState<SemanaPlanGuardada[]>([])
  useEffect(() => {
    let vigente = true
    planSemanalApi.semanas(ymd(rango.start), ymd(new Date(rango.end.getTime() - DIA))).then(({ data }) => { if (vigente) setPlanSemanas(data?.semanas ?? []) })
    return () => { vigente = false }
  }, [rango, recarga])

  useEffect(() => {
    let vigente = true
    setLoading(true)
    reportsApi.getBalance("custom", { from: ymd(rango.start), to: ymd(new Date(rango.end.getTime() - DIA)) }).then(({ data }) => {
      if (!vigente) return
      setReport(data ?? null)
      setLoading(false)
    })
    return () => { vigente = false }
  }, [rango, recarga])

  // Todo lo del periodo elegido (sin filtros): para los totales y las semanas
  const delPeriodo = useMemo(() => buildMovements(report).filter(m => {
    const f = new Date(m.fecha)
    return f >= periodo.start && f < periodo.end
  }), [report, periodo])

  const movimientos = useMemo(() => {
    let res = delPeriodo
    const semana = semanaSel !== null ? semanas.find(s => s.indice === semanaSel) : null
    if (semana) res = res.filter(m => enSemana(m, semana))
    if (filtro !== "todos") res = res.filter(m => m.tipo === filtro)
    if (busqueda) {
      const q = busqueda.toLowerCase()
      res = res.filter(m => m.nombre.toLowerCase().includes(q) || m.tipoLabel.toLowerCase().includes(q) || (m.acreedor ?? "").toLowerCase().includes(q) || (m.categoriaNombre ?? "").toLowerCase().includes(q) || (m.tarjetaNombre ?? "").toLowerCase().includes(q))
    }
    return res
  }, [delPeriodo, semanas, semanaSel, filtro, busqueda])

  const titulo = vista.tipo === "actual"
    ? (quincenal ? tr("Quincena actual · Periodo {0}", [getCurrentQuincena(diasCobro)]) : tr("Mes actual"))
    : nombreMes(vista.year, vista.month)
  const total = totales(delPeriodo)
  const semanaElegida = semanaSel !== null ? semanas.find(s => s.indice === semanaSel) : null
  const totalLista = totales(movimientos)

  return (
    <>
      <div className="space-y-5 pb-10">
        {/* Encabezado */}
        <header className="space-y-3">
          <Link href="/balance" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />{" "}{tr("Balance")}</Link>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <History className="h-6 w-6" />{" "}{tr("Historial")}</h1>
              <p className="text-muted-foreground text-sm">{tr("Todo lo que entró y salió de tu plata.")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMesModalOpen(true)}
                className="h-9 rounded-xl gap-1.5 border-muted text-muted-foreground hover:border-cyclon-lavender/40 hover:text-cyclon-lavender font-bold text-xs"
              >
                <Calendar className="h-3.5 w-3.5" />{" "}{tr("Elegir mes")}</Button>
              <ExportButtons />
            </div>
          </div>
        </header>

        {/* Qué se está viendo */}
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black">{titulo}</p>
                <p className="text-[11px] text-muted-foreground">{fmtRango(periodo.start, periodo.end)}</p>
              </div>
              {vista.tipo === "mes" && (
                <button onClick={() => setVista({ tipo: "actual" })} className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-kiri-emerald bg-kiri-emerald/10 hover:bg-kiri-emerald/20 rounded-lg px-2.5 py-1.5">
                  <X className="h-3 w-3" />{" "}{tr("Volver al periodo actual")}</button>
              )}
            </div>
            {/* Mes de un usuario quincenal: se ve un periodo a la vez */}
            {periodos.length > 1 && (
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/50 p-1">
                {periodos.map((p, i) => (
                  <button key={p.periodo} onClick={() => { setPeriodoSel(i); setSemanaSel(null) }}
                    className="relative rounded-xl px-3 py-2 text-left">
                    {periodoSel === i && (
                      <motion.span layoutId="periodo-elegido" className="absolute inset-0 rounded-xl bg-kiri-emerald shadow-sm"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                    )}
                    <span className={cn("relative block text-xs font-black transition-colors", periodoSel === i ? "text-white" : "text-foreground/70")}>{tr("Periodo {0}", [p.periodo])}</span>
                    <span className={cn("relative block text-[9px] transition-colors", periodoSel === i ? "text-white/70" : "text-muted-foreground")}>{fmtRango(p.start, p.end)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-500/5 px-3 py-2">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">{tr("Entró")}</p>
                <p className="text-sm font-black text-emerald-500">+{formatAmount(total.entradas)}</p>
              </div>
              <div className="rounded-xl bg-red-500/5 px-3 py-2">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">{tr("Salió")}</p>
                <p className="text-sm font-black text-red-500">-{formatAmount(total.salidas)}</p>
              </div>
            </div>
            {vista.tipo === "actual" && (
              <p className="text-[10px] text-muted-foreground">{tr("Aquí ves solo tu {0} en curso; cuando empiece el siguiente periodo, este se guarda y lo consultas con “Elegir mes”.", [quincenal ? tr("quincena") : tr("mes")])}</p>
            )}
          </CardContent>
        </Card>

        {/* Semanas del periodo (las mismas del plan semanal) */}
        {!loading && (
          <AnimatePresence mode="wait">
            <motion.div key={ymd(periodo.start)} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              <SemanasDelPeriodo semanas={semanas} movimientos={delPeriodo} plan={planSemanas} seleccion={semanaSel} onSeleccion={setSemanaSel} formatAmount={formatAmount} />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Búsqueda y filtros */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tr("Buscar por nombre, acreedor, tipo...")}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="h-11 rounded-xl pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {MOVEMENT_FILTERS.map(f => (
            <button key={f.value} onClick={() => setFiltro(f.value)} className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold shrink-0 border-2 transition-colors",
              filtro === f.value ? "bg-cyclon-lavender text-white border-cyclon-lavender" : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
            )}>{f.label}</button>
          ))}
        </div>

        {/* Movimientos */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-muted/20 animate-pulse" />)}
          </div>
        ) : (
          <section className="space-y-2">
            {semanaElegida && (
              <div className="flex items-end justify-between px-1">
                <div>
                  <h2 className="text-sm font-black">{tr("Semana {0}", [semanaElegida.indice])}</h2>
                  <p className="text-[10px] text-muted-foreground">{fmtRango(semanaElegida.start, semanaElegida.end)}</p>
                </div>
                <p className="text-[10px] font-bold">
                  <span className="text-emerald-500">+{formatAmount(totalLista.entradas)}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-red-500">-{formatAmount(totalLista.salidas)}</span>
                </p>
              </div>
            )}
            <MovementList
              movements={movimientos}
              formatAmount={formatAmount}
              onEliminar={setAEliminar}
              vacio={semanaElegida ? tr("Sin movimientos en la semana {0}.", [semanaElegida.indice]) : periodos.length > 1 ? tr("Sin movimientos en el periodo {0}.", [periodo.periodo]) : tr("No hay movimientos que mostrar.")}
            />
          </section>
        )}

        {/* Confirmar eliminación de un gasto */}
        <Dialog open={!!aEliminar} onOpenChange={v => { if (!v && !eliminando) setAEliminar(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500"><Trash2 className="h-5 w-5" /> {esIngreso ? tr("¿Eliminar este ingreso?") : tr("¿Eliminar este gasto?")}</DialogTitle>
              <DialogDescription>
                <strong>{aEliminar?.nombre}</strong>{" "}{tr("por {0}. Todo queda como si no lo hubieras registrado:", [formatAmount(aEliminar?.monto ?? 0)])}</DialogDescription>
            </DialogHeader>
            {esIngreso ? (
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
                <li>{tr("Se descuentan {0} de tu disponible y de los bolsillos de tu billetera a los que fue.", [formatAmount(aEliminar?.monto ?? 0)])}</li>
                <li>{aEliminar?.esAvance ? tr("Se revierte la deuda que dejó en tu tarjeta (monto + comisión).") : tr("Deja de contar en tus ingresos del Balance.")}</li>
                <li>{tr("Los pagos que ya hiciste con esa plata siguen registrados (se ven aparte en el historial).")}</li>
                <li>{tr("Desaparece de este historial. No se puede deshacer.")}</li>
              </ul>
            ) : (
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>{aEliminar?.tarjetaNombre ? tr("Se revierte de tu tarjeta {0}.", [aEliminar.tarjetaNombre]) : tr("Vuelven {0} a tu gasto libre.", [formatAmount(aEliminar?.monto ?? 0)])}</li>
              <li>{tr("Deja de contar en su categoría de presupuesto y en gastos hormiga.")}</li>
              <li>{tr("Desaparece de este historial. No se puede deshacer.")}</li>
            </ul>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" disabled={eliminando} onClick={() => setAEliminar(null)}>{tr("Cancelar")}</Button>
              <Button variant="destructive" disabled={eliminando} onClick={confirmarEliminar}>{eliminando ? "Eliminando..." : tr("Eliminar gasto")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Elegir mes para VER (no descargar) */}
        <Dialog open={mesModalOpen} onOpenChange={setMesModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-cyclon-lavender" />{" "}{tr("Ver otro mes")}</DialogTitle>
              <DialogDescription>
                {quincenal ? tr("Verás los gastos, ingresos y préstamos de ese mes separados en Periodo 1 y Periodo 2.") : tr("Verás los gastos, ingresos y préstamos de ese mes.")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto py-1">
              {ultimosMeses(mesesPlan).map(m => {
                const activo = vista.tipo === "mes" && vista.year === m.year && vista.month === m.month
                return (
                  <button
                    key={`${m.year}-${m.month}`}
                    onClick={() => {
                      setMesModalOpen(false)
                      if (m.bloqueado) {
                        window.dispatchEvent(new CustomEvent("kiri:limite", { detail: {
                          codigo: "FUNCION", mejora: { plan: tr("KIRI PLUS") },
                          mensaje: tr("En tu plan ves los últimos {0} meses de historial. Con KIRI PLUS ves 24 meses y con KIRI PRO todo tu historial.", [mesesPlan]),
                        } }))
                        return
                      }
                      setVista({ tipo: "mes", year: m.year, month: m.month })
                    }}
                    className={cn("p-3 rounded-xl border-2 text-left transition-colors",
                      m.bloqueado ? "border-muted/60 opacity-60" : activo ? "border-cyclon-lavender bg-cyclon-lavender/5" : "border-muted hover:border-cyclon-lavender/40")}
                  >
                    <p className="text-xs font-bold flex items-center gap-1">{m.bloqueado && <Lock className="h-3 w-3" />}{m.label}</p>
                    {m.actual && <p className="text-[8px] text-kiri-emerald font-bold">{tr("Mes actual")}</p>}
                  </button>
                )
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
