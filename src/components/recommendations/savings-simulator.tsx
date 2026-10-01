"use client"

import { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as ChartTooltip, ReferenceLine } from "recharts"
import {
  Calculator, CheckCircle2, AlertTriangle, XCircle, PiggyBank, CalendarCheck,
  TrendingUp, Target, ArrowRight, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useToast } from "@/hooks/use-toast"
import { savingsPocketsApi } from "@/lib/api-client"
import type { IncomeFrequency } from "@/lib/types"
import {
  proyectarAhorro, planParaMeta, fechaParaMeta, viabilidad, serieMeta, sumarMeses, fechaISO, fechaLegible,
  type Viabilidad, type PuntoSerie,
} from "@/lib/simulaciones"
import { tr } from "@/lib/i18n"

/** Datos con los que se abre el simulador ya lleno (p. ej. desde Kiri Coach). */
export interface EscenarioAhorro {
  modo: "futuro" | "meta"
  nombre?: string | null
  /** meta: lo que cuesta */
  monto?: number | null
  /** futuro: lo que ahorra cada quincena/mes */
  aporte?: number | null
  meses?: number | null
  /** meta: YYYY-MM-DD */
  fecha?: string | null
  inicial?: number | null
  tasaAnual?: number | null
}

interface Props {
  /** Ahorro sugerido del periodo (la distribución del Dashboard) */
  ahorroSugerido: number
  /** Margen que queda tras el gasto libre (lo que no es ni ahorro ni mínimo vital) */
  margenLibre: number
  incomeFrequency: IncomeFrequency
  forceOpen?: boolean
  onClose?: () => void
  inicial?: EscenarioAhorro | null
}

const MESES_RAPIDOS = [3, 6, 12, 24]

/** Mañana (lo mínimo para una meta con fecha) */
const manana = () => { const d = new Date(); d.setDate(d.getDate() + 1); return fechaISO(d) }

export function SavingsSimulator({ ahorroSugerido, margenLibre, incomeFrequency, forceOpen, onClose, inicial }: Props) {
  const { formatAmount } = useAppContext()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const isOpen = forceOpen ?? open
  const [modo, setModo] = useState<"futuro" | "meta">("futuro")
  const [nombre, setNombre] = useState("")
  const [aporte, setAporte] = useState("")
  const [meses, setMeses] = useState("12")
  const [monto, setMonto] = useState("")
  const [fecha, setFecha] = useState("")
  const [yaTengo, setYaTengo] = useState("")
  const [tasa, setTasa] = useState("")
  const [simulado, setSimulado] = useState(false)
  const [aceptando, setAceptando] = useState(false)
  const [errorAceptar, setErrorAceptar] = useState<string | null>(null)

  // Abierto con datos (Kiri Coach): llenar y simular de una vez
  useEffect(() => {
    if (!inicial || !isOpen) return
    setModo(inicial.modo)
    setNombre(inicial.nombre ?? "")
    setAporte(inicial.aporte ? String(Math.round(inicial.aporte)) : "")
    setMeses(inicial.meses ? String(Math.round(inicial.meses)) : "12")
    setMonto(inicial.monto ? String(Math.round(inicial.monto)) : "")
    setFecha(inicial.fecha ?? "")
    setYaTengo(inicial.inicial ? String(Math.round(inicial.inicial)) : "")
    setTasa(inicial.tasaAnual ? String(inicial.tasaAnual) : "")
    setSimulado(true)
  }, [inicial, isOpen])

  const periodLabel = incomeFrequency === "quincenal" ? tr("quincena") : tr("mes")
  const tasaAnual = Math.min(50, Math.max(0, Number(tasa.replace(",", ".")) || 0))
  const nMeses = Math.min(600, Math.max(0, Math.round(Number(meses) || 0)))
  const puedeSimular = modo === "futuro"
    ? Number(aporte) > 0 && nMeses > 0
    : Number(monto) > 0 && !!fecha

  const limpiar = () => { setSimulado(false); setErrorAceptar(null) }

  const handleClose = () => {
    setOpen(false)
    onClose?.()
    setNombre(""); setAporte(""); setMeses("12"); setMonto(""); setFecha(""); setYaTengo(""); setTasa("")
    setSimulado(false); setErrorAceptar(null)
  }

  const resultado = useMemo(() => {
    if (!simulado || !puedeSimular) return null
    const base = { inicial: Number(yaTengo) || 0, tasaAnual, frecuencia: incomeFrequency }
    if (modo === "futuro") {
      const p = proyectarAhorro({ ...base, aporte: Number(aporte), meses: nMeses })
      return { modo: "futuro" as const, p, via: viabilidad(Number(aporte), ahorroSugerido, margenLibre) }
    }
    const meta = Number(monto)
    const f = new Date(`${fecha}T12:00:00`)
    const plan = planParaMeta({ ...base, meta, fecha: f })
    const conSugerido = ahorroSugerido > 0 ? fechaParaMeta({ ...base, meta, aporte: ahorroSugerido }) : null
    const serie = plan.aporte > 0 ? serieMeta({ ...base, meta, aporte: plan.aporte, periodos: plan.periodos }) : []
    return { modo: "meta" as const, plan, meta, fecha: f, conSugerido, serie, via: viabilidad(plan.aporte, ahorroSugerido, margenLibre) }
  }, [simulado, puedeSimular, modo, yaTengo, tasaAnual, incomeFrequency, aporte, nMeses, monto, fecha, ahorroSugerido, margenLibre])

  // ── Aceptar: se vuelve un bolsillo con esa meta y esa fecha ─────────────────
  const handleAceptar = async () => {
    if (!resultado) return
    const esMeta = resultado.modo === "meta"
    const metaBolsillo = esMeta ? resultado.meta : resultado.p.final
    const fechaLimite = esMeta ? fecha : fechaISO(resultado.p.fechaFin)
    setAceptando(true)
    setErrorAceptar(null)
    const { data, error } = await savingsPocketsApi.create({
      nombre: (nombre.trim() || (esMeta ? tr("Mi compra") : tr("Mi ahorro"))).slice(0, 50),
      meta: metaBolsillo,
      color: "mint",
      icono: esMeta ? "star" : "piggybank",
      tipoMeta: "fecha",
      fechaLimite,
    })
    setAceptando(false)
    if (error || !data?.pocket) { setErrorAceptar(error ?? tr("No se pudo crear el bolsillo. Intenta de nuevo.")); return }
    window.dispatchEvent(new Event("kiri:bolsillos-actualizados"))
    toast({ title: tr("Bolsillo \"{0}\" creado", [data.pocket.nombre]), description: tr("Meta {0} para el {1}.", [formatAmount(metaBolsillo), fechaLegible(new Date(`${fechaLimite}T12:00:00`))]) })
    handleClose()
  }

  return (
    <>
      {!isOpen && (
        <button onClick={() => setOpen(true)} className="w-full text-left">
          <Card className="border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 rounded-3xl hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Calculator className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{tr("Simulador de Ahorro")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tr("¿Cuánto tendré si ahorro X? ¿Cuánto debo guardar para comprar algo?")}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-muted-foreground font-medium">{tr("Sugerido / {0}", [periodLabel])}</p>
                <p className={cn("font-black text-sm", ahorroSugerido > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{formatAmount(ahorroSugerido)}</p>
              </div>
            </CardContent>
          </Card>
        </button>
      )}

      <Dialog open={isOpen} onOpenChange={v => !v && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />{tr("Simulador de Ahorro")}</DialogTitle>
            <DialogDescription>{tr("Juega con cifras antes de decidir: nada se guarda hasta que lo aceptes.")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* ── ¿Qué quieres saber? ── */}
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={tr("Tipo de simulación")}>
              {([
                { v: "futuro", t: tr("¿Cuánto tendré?"), d: tr("Si ahorro una cantidad") },
                { v: "meta", t: tr("Quiero comprar algo"), d: tr("¿Cuánto debo ahorrar?") },
              ] as const).map(o => (
                <button key={o.v} type="button" onClick={() => { setModo(o.v); limpiar() }} aria-pressed={modo === o.v}
                  className={cn("rounded-2xl border-2 p-3 text-left transition-colors",
                    modo === o.v ? "border-emerald-500 bg-emerald-500/10" : "border-border hover:border-emerald-500/40")}>
                  <p className="text-sm font-bold">{o.t}</p>
                  <p className="text-[10px] text-muted-foreground">{o.d}</p>
                </button>
              ))}
            </div>

            {modo === "futuro" ? (
              <>
                <div className="space-y-1.5">
                  <Label>{tr("¿Cuánto ahorrarías cada {0}?", [periodLabel])}</Label>
                  <MoneyInput className="h-14 text-2xl font-bold rounded-xl" value={aporte} onChange={v => { setAporte(v); limpiar() }} autoFocus />
                  {ahorroSugerido > 0 && (
                    <button type="button" onClick={() => { setAporte(String(Math.round(ahorroSugerido))); limpiar() }}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                      {tr("Usar mi ahorro sugerido ({0})", [formatAmount(ahorroSugerido)])}</button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("¿Durante cuántos meses?")}</Label>
                  <div className="flex gap-2 flex-wrap">
                    {MESES_RAPIDOS.map(m => (
                      <button key={m} type="button" onClick={() => { setMeses(String(m)); limpiar() }}
                        className={cn("h-9 px-3 rounded-xl text-xs font-bold border", nMeses === m ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground")}>
                        {m === 12 ? tr("1 año") : m === 24 ? tr("2 años") : tr("{0} meses", [m])}</button>
                    ))}
                    <Input type="number" inputMode="numeric" min={1} max={600} value={meses} onChange={e => { setMeses(e.target.value.slice(0, 3)); limpiar() }}
                      className="h-9 w-20 rounded-xl text-sm" aria-label={tr("Meses")} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>{tr("¿Qué quieres comprar?")}</Label>
                  <Input placeholder={tr("Ej: Celular, viaje, moto...")} value={nombre} maxLength={50} onChange={e => setNombre(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>{tr("¿Cuánto cuesta?")}</Label>
                  <MoneyInput className="h-14 text-2xl font-bold rounded-xl" value={monto} onChange={v => { setMonto(v); limpiar() }} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sim-fecha">{tr("¿Para cuándo lo quieres?")}</Label>
                  <div className="flex gap-2 flex-wrap">
                    {[3, 6, 12].map(m => {
                      const f = fechaISO(sumarMeses(m))
                      return (
                        <button key={m} type="button" onClick={() => { setFecha(f); limpiar() }}
                          className={cn("h-9 px-3 rounded-xl text-xs font-bold border", fecha === f ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground")}>
                          {m === 12 ? tr("En 1 año") : tr("En {0} meses", [m])}</button>
                      )
                    })}
                  </div>
                  <Input id="sim-fecha" type="date" min={manana()} value={fecha} onChange={e => { setFecha(e.target.value); limpiar() }} className="h-11 rounded-xl" />
                </div>
              </>
            )}

            {/* Opcionales: lo que ya tiene y el rendimiento */}
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">{tr("Ya tengo ahorrado")}</Label>
                <MoneyInput className="h-11 rounded-xl" value={yaTengo} onChange={v => { setYaTengo(v); limpiar() }} />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs" htmlFor="sim-tasa">{tr("Rinde al año (%)")}</Label>
                <Input id="sim-tasa" type="number" inputMode="decimal" min={0} max={50} step={0.1} placeholder="0" value={tasa}
                  onChange={e => { setTasa(e.target.value.slice(0, 5)); limpiar() }} className="h-11 rounded-xl" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-2">{tr("Si lo guardas donde genera intereses (cuenta de ahorro, CDT), pon su tasa efectiva anual. Si no, déjalo en 0.")}</p>

            <Card className="border-none bg-muted/40 rounded-2xl">
              <CardContent className="p-3 flex justify-between items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">{tr("Tu ahorro sugerido / {0}", [periodLabel])}</span>
                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{formatAmount(ahorroSugerido)}</span>
              </CardContent>
            </Card>

            <Button onClick={() => setSimulado(true)} disabled={!puedeSimular}
              className="w-full h-12 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">{tr("Simular escenario")}</Button>

            {resultado?.modo === "futuro" && (
              <PanelFuturo p={resultado.p} via={resultado.via} aporte={Number(aporte)} meses={nMeses} ahorroSugerido={ahorroSugerido}
                periodLabel={periodLabel} formatAmount={formatAmount} />
            )}
            {resultado?.modo === "meta" && (
              <PanelMeta r={resultado} nombre={nombre} ahorroSugerido={ahorroSugerido} periodLabel={periodLabel} formatAmount={formatAmount}
                quincenal={incomeFrequency === "quincenal"} />
            )}
          </div>

          {resultado && !(resultado.modo === "meta" && (resultado.plan.fechaInvalida || resultado.plan.alcanzada)) && (
            <div className="pt-3 border-t border-border space-y-2">
              {errorAceptar && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg p-2 text-center">{errorAceptar}</p>}
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={handleClose}>{tr("Cancelar")}</Button>
                <Button onClick={handleAceptar} disabled={aceptando} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-6 gap-2">
                  {aceptando ? tr("Guardando...") : tr("Crear bolsillo con esta meta")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Resultados ───────────────────────────────────────────────────────────────

const TEXTO_VIA: Record<Viabilidad, { t: string; tono: "ok" | "warn" | "bad" }> = {
  holgado: { t: "Te queda cómodo: está dentro de tu ahorro sugerido.", tono: "ok" },
  justo: { t: "Usas casi todo tu ahorro sugerido del periodo.", tono: "ok" },
  libre: { t: "Pasa tu ahorro sugerido: la diferencia saldría de tu margen libre.", tono: "warn" },
  no_alcanza: { t: "Con tus ingresos y obligaciones de hoy no te alcanza ese aporte.", tono: "bad" },
}

function AvisoVia({ via, extra }: { via: Viabilidad; extra?: React.ReactNode }) {
  const v = TEXTO_VIA[via]
  const Icono = v.tono === "ok" ? CheckCircle2 : v.tono === "warn" ? AlertTriangle : XCircle
  return (
    <Card className={cn("border rounded-2xl shadow-none",
      v.tono === "ok" ? "border-emerald-500/20 bg-emerald-500/10" : v.tono === "warn" ? "border-amber-500/30 bg-amber-500/10" : "border-destructive/20 bg-destructive/10")}>
      <CardContent className="p-3 flex gap-2 items-start">
        <Icono className={cn("h-4 w-4 shrink-0 mt-0.5", v.tono === "ok" ? "text-emerald-600" : v.tono === "warn" ? "text-amber-600" : "text-destructive")} />
        <div className="text-xs space-y-1">
          <p className="font-bold">{tr(v.t)}</p>
          {extra}
        </div>
      </CardContent>
    </Card>
  )
}

function Grafico({ serie, meta, formatAmount }: { serie: PuntoSerie[]; meta?: number; formatAmount: (n: number) => string }) {
  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /><span className="text-muted-foreground font-medium">{tr("Ahorrado")}</span></div>
          {serie.some(s => s.total > s.aportado) && (
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-sm bg-amber-400" /><span className="text-muted-foreground font-medium">{tr("Rendimientos")}</span></div>
          )}
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie.map(s => ({ ...s, rinde: Math.max(0, s.total - s.aportado) }))} barCategoryGap="15%">
              <XAxis dataKey="etiqueta" tick={{ fontSize: 9, fill: "#888" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis hide domain={[0, (max: number) => Math.max(max, meta ?? 0)]} />
              <ChartTooltip formatter={(v: number, k: string) => [formatAmount(v), k === "rinde" ? tr("Rendimientos") : tr("Ahorrado")]} contentStyle={{ borderRadius: 12, fontSize: 11 }} />
              {meta ? <ReferenceLine y={meta} stroke="#f59e0b" strokeDasharray="4 3" /> : null}
              <Bar dataKey="aportado" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} maxBarSize={22} />
              <Bar dataKey="rinde" stackId="a" fill="#FBBF24" radius={[6, 6, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className={cn("font-bold text-right", fuerte && "text-emerald-600 dark:text-emerald-400")}>{valor}</span>
    </div>
  )
}

function PanelFuturo({ p, via, aporte, meses, ahorroSugerido, periodLabel, formatAmount }: {
  p: ReturnType<typeof proyectarAhorro>; via: Viabilidad; aporte: number; meses: number; ahorroSugerido: number
  periodLabel: string; formatAmount: (n: number) => string
}) {
  const yaTenia = p.serie[0]?.aportado ?? 0
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{tr("Así crecería tu ahorro")}</p>
      </div>
      <Card className="border-none bg-emerald-500/10 rounded-2xl">
        <CardContent className="p-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground">{tr("El {0} tendrías", [fechaLegible(p.fechaFin)])}</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatAmount(p.final)}</p>
          <p className="text-[11px] text-muted-foreground">{tr("Ahorrando {0} cada {1} durante {2} {3}", [formatAmount(aporte), periodLabel, meses, meses === 1 ? tr("mes") : tr("meses")])}</p>
        </CardContent>
      </Card>
      <Grafico serie={p.serie} formatAmount={formatAmount} />
      <div className="grid grid-cols-3 gap-2">
        <Kpi label={tr("Ya tenías")} valor={formatAmount(yaTenia)} icon={<PiggyBank className="h-3.5 w-3.5" />} />
        <Kpi label={tr("Tus aportes")} valor={formatAmount(p.aportado - yaTenia)} icon={<Target className="h-3.5 w-3.5" />} />
        <Kpi label={tr("Rendimientos")} valor={formatAmount(p.rendimiento)} icon={<Sparkles className="h-3.5 w-3.5" />} />
      </div>
      {ahorroSugerido > 0 && (
        <AvisoVia via={via} extra={<p className="text-muted-foreground">{tr("Tu ahorro sugerido es {0} por {1}; este plan usa el {2}%.", [formatAmount(ahorroSugerido), periodLabel, Math.round(aporte / ahorroSugerido * 100)])}</p>} />
      )}
      <p className="text-[10px] text-muted-foreground text-center italic">{tr("⚡ Esto es solo una simulación. Nada se guarda hasta que pulses \"Crear bolsillo con esta meta\".")}</p>
    </div>
  )
}

function PanelMeta({ r, nombre, ahorroSugerido, periodLabel, formatAmount, quincenal }: {
  r: { plan: ReturnType<typeof planParaMeta>; meta: number; fecha: Date; conSugerido: Date | null; serie: PuntoSerie[]; via: Viabilidad }
  nombre: string; ahorroSugerido: number; periodLabel: string; formatAmount: (n: number) => string; quincenal: boolean
}) {
  const que = nombre.trim() || tr("tu compra")
  if (r.plan.fechaInvalida) {
    return <AvisoVia via="no_alcanza" extra={<p className="text-muted-foreground">{tr("Elige una fecha a partir de mañana.")}</p>} />
  }
  if (r.plan.alcanzada) {
    return (
      <Card className="border border-emerald-500/20 bg-emerald-500/10 rounded-2xl shadow-none">
        <CardContent className="p-4 flex gap-2 items-start">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-bold">{tr("¡Ya tienes lo necesario para {0}!", [que])}</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{tr("Tu plan para {0}", [que])}</p>
      </div>
      <Card className="border-none bg-emerald-500/10 rounded-2xl">
        <CardContent className="p-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground">{tr("Necesitas ahorrar cada {0}", [periodLabel])}</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatAmount(r.plan.aporte)}</p>
          {quincenal && <p className="text-[11px] text-muted-foreground">{tr("({0} al mes)", [formatAmount(r.plan.aporteMes)])}</p>}
        </CardContent>
      </Card>
      <Grafico serie={r.serie} meta={r.meta} formatAmount={formatAmount} />
      <Card className="border-none bg-emerald-500/5 rounded-2xl">
        <CardContent className="p-4 space-y-1 text-xs text-muted-foreground">
          <Fila label={tr("Cuesta")} valor={formatAmount(r.meta)} />
          <Fila label={tr("Te falta")} valor={formatAmount(r.plan.faltante)} />
          <Fila label={tr("Aportes")} valor={`${r.plan.periodos} ${quincenal ? (r.plan.periodos === 1 ? tr("quincena") : tr("quincenas")) : (r.plan.periodos === 1 ? tr("mes") : tr("meses"))}`} />
          <Fila label={tr("Lo tendrías el")} valor={fechaLegible(r.fecha)} fuerte />
        </CardContent>
      </Card>
      {ahorroSugerido > 0 ? (
        <AvisoVia via={r.via} extra={r.via !== "holgado" && r.via !== "justo" && (
          <p className="text-muted-foreground flex items-start gap-1">
            <CalendarCheck className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>{r.conSugerido
              ? tr("Con tu ahorro sugerido ({0} por {1}) lo lograrías el {2}.", [formatAmount(ahorroSugerido), periodLabel, fechaLegible(r.conSugerido)])
              : tr("Con tu ahorro sugerido tardarías demasiado: prueba una fecha más lejana o un valor menor.")}</span>
          </p>
        )} />
      ) : (
        <AvisoVia via="no_alcanza" extra={<p className="text-muted-foreground">{tr("Hoy no te queda ahorro sugerido en el periodo: revisa tus obligaciones o tus ingresos.")}</p>} />
      )}
      <p className="text-[10px] text-muted-foreground text-center italic">{tr("⚡ Esto es solo una simulación. Nada se guarda hasta que pulses \"Crear bolsillo con esta meta\".")}</p>
    </div>
  )
}

function Kpi({ label, valor, icon }: { label: string; valor: string; icon: React.ReactNode }) {
  return (
    <Card className="border-none bg-muted/30 rounded-2xl shadow-none">
      <CardContent className="p-3 space-y-1.5 text-center">
        <div className="mx-auto h-6 w-6 rounded-lg flex items-center justify-center bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">{icon}</div>
        <p className="text-[9px] text-muted-foreground font-bold uppercase leading-tight">{label}</p>
        <p className="text-xs font-black break-words">{valor}</p>
      </CardContent>
    </Card>
  )
}
