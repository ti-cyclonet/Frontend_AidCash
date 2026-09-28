"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Calendar, History, Search, Trash2, X, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { impulseApi, reportsApi, type BalanceReport, type Movement, type MovementType } from "@/lib/api-client"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useToast } from "@/hooks/use-toast"
import { buildMovements } from "@/lib/balance-movements"
import { getCurrentQuincena, getPeriodDateRange, getQuincenasDelMes } from "@/lib/period-filter"
import { ExportButtons } from "@/components/balance/ExportButtons"
import { MovementList, MOVEMENT_FILTERS, esEntrada } from "@/components/balance/MovementList"
import { FeatureGate } from "@/components/plan/feature-gate"
import { usePlan } from "@/lib/plan-context"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Historial de movimientos — módulo propio (antes era una sección de Balance)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Por defecto muestra SOLO el periodo de ingreso actual (la quincena o el mes
 * en curso): cuando empieza el siguiente, lo anterior deja de verse aquí. Los
 * periodos pasados se consultan con "Elegir mes" — para un usuario quincenal,
 * ese mes se muestra separado en Periodo 1 y Periodo 2. "PDF" abre el
 * selector de meses y descarga solo después de elegir.
 */

type Vista = { tipo: "actual" } | { tipo: "mes"; year: number; month: number }

const DIA = 86_400_000
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fmtDia = (d: Date) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short" })
const nombreMes = (year: number, month: number) => {
  const s = new Date(year, month, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" })
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
  const entradas = movs.filter(esEntrada).reduce((s, m) => s + m.monto, 0)
  const salidas = movs.filter(m => !esEntrada(m)).reduce((s, m) => s + m.monto, 0)
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
  const confirmarEliminar = async () => {
    if (!aEliminar) return
    setEliminando(true)
    const { data, error } = await impulseApi.delete(aEliminar.id)
    setEliminando(false)
    if (error || !data) {
      toast({ title: "No se pudo eliminar", description: error ?? "Intenta de nuevo.", variant: "destructive" })
      return
    }
    toast({
      title: `Eliminaste "${aEliminar.nombre}"`,
      description: data.reversion.tipo === "tarjeta"
        ? `Se revirtieron ${formatAmount(data.reversion.monto)} de tu tarjeta${data.reversion.tarjetaNombre ? ` ${data.reversion.tarjetaNombre}` : ""}.`
        : `Volvieron ${formatAmount(data.reversion.monto)} a tu gasto libre.`,
    })
    setAEliminar(null)
    setRecarga(n => n + 1)
    window.dispatchEvent(new Event("kiri:wallet-updated"))
    refetch()
  }

  // Rango [start, end) de lo que se está viendo.
  const rango = useMemo(() => {
    if (vista.tipo === "actual") return getPeriodDateRange(incomeFrequency, diasCobro)
    if (quincenal) {
      const [q1, q2] = getQuincenasDelMes(diasCobro, vista.year, vista.month)
      return { start: q1.start, end: q2.end }
    }
    return { start: new Date(vista.year, vista.month, 1), end: new Date(vista.year, vista.month + 1, 1) }
  }, [vista, incomeFrequency, diasCobro, quincenal])

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

  const movimientos = useMemo(() => {
    let res = buildMovements(report).filter(m => {
      const f = new Date(m.fecha)
      return f >= rango.start && f < rango.end
    })
    if (filtro !== "todos") res = res.filter(m => m.tipo === filtro)
    if (busqueda) {
      const q = busqueda.toLowerCase()
      res = res.filter(m => m.nombre.toLowerCase().includes(q) || m.tipoLabel.toLowerCase().includes(q) || (m.acreedor ?? "").toLowerCase().includes(q))
    }
    return res
  }, [report, rango, filtro, busqueda])

  // Secciones: un mes pasado de un usuario quincenal se parte en Periodo 1 / 2.
  const secciones = useMemo(() => {
    if (vista.tipo === "mes" && quincenal) {
      return getQuincenasDelMes(diasCobro, vista.year, vista.month).map(q => ({
        key: `p${q.periodo}`,
        titulo: `Periodo ${q.periodo}`,
        subtitulo: fmtRango(q.start, q.end),
        movs: movimientos.filter(m => { const f = new Date(m.fecha); return f >= q.start && f < q.end }),
      }))
    }
    return [{ key: "todo", titulo: "", subtitulo: "", movs: movimientos }]
  }, [vista, quincenal, diasCobro, movimientos])

  const titulo = vista.tipo === "actual"
    ? (quincenal ? `Quincena actual · Periodo ${getCurrentQuincena(diasCobro)}` : "Mes actual")
    : nombreMes(vista.year, vista.month)
  const total = totales(movimientos)

  return (
    <FeatureGate feature="basicReports">
      <div className="space-y-5 pb-10">
        {/* Encabezado */}
        <header className="space-y-3">
          <Link href="/balance" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Balance
          </Link>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <History className="h-6 w-6" /> Historial
              </h1>
              <p className="text-muted-foreground text-sm">Todo lo que entró y salió de tu plata.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMesModalOpen(true)}
                className="h-9 rounded-xl gap-1.5 border-muted text-muted-foreground hover:border-cyclon-lavender/40 hover:text-cyclon-lavender font-bold text-xs"
              >
                <Calendar className="h-3.5 w-3.5" /> Elegir mes
              </Button>
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
                <p className="text-[11px] text-muted-foreground">{fmtRango(rango.start, rango.end)}</p>
              </div>
              {vista.tipo === "mes" && (
                <button onClick={() => setVista({ tipo: "actual" })} className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-kiri-emerald bg-kiri-emerald/10 hover:bg-kiri-emerald/20 rounded-lg px-2.5 py-1.5">
                  <X className="h-3 w-3" /> Volver al periodo actual
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-500/5 px-3 py-2">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">Entró</p>
                <p className="text-sm font-black text-emerald-500">+{formatAmount(total.entradas)}</p>
              </div>
              <div className="rounded-xl bg-red-500/5 px-3 py-2">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">Salió</p>
                <p className="text-sm font-black text-red-500">-{formatAmount(total.salidas)}</p>
              </div>
            </div>
            {vista.tipo === "actual" && (
              <p className="text-[10px] text-muted-foreground">
                Aquí ves solo tu {quincenal ? "quincena" : "mes"} en curso; cuando empiece el siguiente periodo, este se guarda y lo consultas con &ldquo;Elegir mes&rdquo;.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Búsqueda y filtros */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, acreedor, tipo..."
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
          secciones.map(sec => {
            const t = totales(sec.movs)
            return (
              <section key={sec.key} className="space-y-2">
                {sec.titulo && (
                  <div className="flex items-end justify-between px-1 pt-2">
                    <div>
                      <h2 className="text-sm font-black">{sec.titulo}</h2>
                      <p className="text-[10px] text-muted-foreground">{sec.subtitulo}</p>
                    </div>
                    <p className="text-[10px] font-bold">
                      <span className="text-emerald-500">+{formatAmount(t.entradas)}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-red-500">-{formatAmount(t.salidas)}</span>
                    </p>
                  </div>
                )}
                <MovementList
                  movements={sec.movs}
                  formatAmount={formatAmount}
                  onEliminar={setAEliminar}
                  vacio={sec.titulo ? `Sin movimientos en el ${sec.titulo.toLowerCase()}.` : "No hay movimientos que mostrar."}
                />
              </section>
            )
          })
        )}

        {/* Confirmar eliminación de un gasto */}
        <Dialog open={!!aEliminar} onOpenChange={v => { if (!v && !eliminando) setAEliminar(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500"><Trash2 className="h-5 w-5" /> ¿Eliminar este gasto?</DialogTitle>
              <DialogDescription>
                <strong>{aEliminar?.nombre}</strong> por {formatAmount(aEliminar?.monto ?? 0)}. Todo queda como si no lo hubieras registrado:
              </DialogDescription>
            </DialogHeader>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>{aEliminar?.tarjetaNombre ? `Se revierte de tu tarjeta ${aEliminar.tarjetaNombre}.` : `Vuelven ${formatAmount(aEliminar?.monto ?? 0)} a tu gasto libre.`}</li>
              <li>Deja de contar en su categoría de presupuesto y en gastos hormiga.</li>
              <li>Desaparece de este historial. No se puede deshacer.</li>
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" disabled={eliminando} onClick={() => setAEliminar(null)}>Cancelar</Button>
              <Button variant="destructive" disabled={eliminando} onClick={confirmarEliminar}>{eliminando ? "Eliminando..." : "Eliminar gasto"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Elegir mes para VER (no descargar) */}
        <Dialog open={mesModalOpen} onOpenChange={setMesModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-cyclon-lavender" /> Ver otro mes</DialogTitle>
              <DialogDescription>
                {quincenal ? "Verás los gastos, ingresos y préstamos de ese mes separados en Periodo 1 y Periodo 2." : "Verás los gastos, ingresos y préstamos de ese mes."}
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
                          codigo: "FUNCION", mejora: { plan: "KIRI PLUS" },
                          mensaje: `En tu plan ves los últimos ${mesesPlan} meses de historial. Con KIRI PLUS ves 24 meses y con KIRI PRO todo tu historial.`,
                        } }))
                        return
                      }
                      setVista({ tipo: "mes", year: m.year, month: m.month })
                    }}
                    className={cn("p-3 rounded-xl border-2 text-left transition-colors",
                      m.bloqueado ? "border-muted/60 opacity-60" : activo ? "border-cyclon-lavender bg-cyclon-lavender/5" : "border-muted hover:border-cyclon-lavender/40")}
                  >
                    <p className="text-xs font-bold flex items-center gap-1">{m.bloqueado && <Lock className="h-3 w-3" />}{m.label}</p>
                    {m.actual && <p className="text-[8px] text-kiri-emerald font-bold">Mes actual</p>}
                  </button>
                )
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  )
}
