"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { CreditCard, ShoppingBag, Landmark, ChevronDown, ArrowLeft, Percent, Bell } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { BudgetCategorySelector } from "@/components/obligaciones/BudgetCategorySelector"
import { DueQuestion, useDueQuestion } from "@/components/obligaciones/DueQuestion"
import { tr } from "@/lib/i18n"
import { useAppContext } from "@/lib/app-context"
import type { DebtType } from "@/lib/types"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DebtRegistrationForm — "¿Qué quieres registrar?"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Primero se elige el tipo y después aparecen SOLO sus campos:
 *   💳 Tarjeta de crédito  — cupo, ocupado, pago mensual, tasa (opcional)
 *   🛍️ Crédito de compras  — Addi, Sistecrédito, Brilla… (mismos campos)
 *   🏦 Préstamo            — cuánto debes, cuota, día de pago, tasa (opcional)
 *
 * Antes había dos modos ("Simple" / "Bancaria") que pedían banco, monto
 * inicial y otros datos que no hacían falta, y si era tarjeta se ADIVINABA por
 * el nombre: una "Nu" o "Falabella" quedaba como préstamo y, al pagarla
 * completa, desaparecía.
 */

export interface DebtFormData {
  nombre: string
  montoTotal: number
  saldoActual?: number
  cuotaPeriodo: number
  /** Cupo total de una tarjeta o crédito de compras */
  cupoTotal?: number | null
  tasaInteres?: number
  bankEntityId?: string | null
  acreedor: string
  diasPago: string
  frecuenciaPago?: string
  tipoDeuda?: DebtType
  yaPagoEstePeriodo?: boolean
  nuevaProximoPeriodo?: boolean
  budgetCategoryId?: string | null
}

interface Props {
  onSubmit: (data: DebtFormData) => void | Promise<void>
  loading?: boolean
}

type Tipo = "TARJETA_CREDITO" | "CREDITO_COMPRAS" | "PRESTAMO"

const TIPOS: { tipo: Tipo; icon: typeof CreditCard; titulo: string; sub: string; color: string }[] = [
  { tipo: "TARJETA_CREDITO", icon: CreditCard, titulo: "Tarjeta de crédito", sub: "Nu, Bancolombia, Falabella, RappiCard…", color: "from-amber-500/15 to-orange-500/5 text-amber-600" },
  { tipo: "CREDITO_COMPRAS", icon: ShoppingBag, titulo: "Crédito de compras", sub: "Addi, Sistecrédito, Brilla, cupos de almacén", color: "from-violet-500/15 to-fuchsia-500/5 text-violet-600" },
  { tipo: "PRESTAMO", icon: Landmark, titulo: "Préstamo", sub: "Libre inversión, carro, moto, un amigo…", color: "from-emerald-500/15 to-teal-500/5 text-emerald-600" },
]

const SUGERENCIAS: Record<Tipo, string[]> = {
  TARJETA_CREDITO: ["Nu", "Bancolombia", "Davivienda", "BBVA", "Falabella", "RappiCard", "Lulo"],
  CREDITO_COMPRAS: ["Addi", "Sistecrédito", "Brilla", "Banco W"],
  PRESTAMO: [],
}

/** Tasa efectiva anual (E.A., como sale en el extracto) → mensual equivalente */
const eaAMensual = (ea: number) => (Math.pow(1 + ea / 100, 1 / 12) - 1) * 100

export function DebtRegistrationForm({ onSubmit, loading }: Props) {
  const { formatAmount } = useAppContext()
  const [tipo, setTipo] = useState<Tipo | null>(null)
  const esLinea = tipo === "TARJETA_CREDITO" || tipo === "CREDITO_COMPRAS"

  const [nombre, setNombre] = useState("")
  // Línea de crédito
  const [cupo, setCupo] = useState("")
  const [ocupado, setOcupado] = useState("")
  // Préstamo
  const [debeHoy, setDebeHoy] = useState("")
  const [montoOriginal, setMontoOriginal] = useState("")
  // Comunes
  const [cuota, setCuota] = useState("")
  const [tasa, setTasa] = useState("")
  const [tasaEnAnual, setTasaEnAnual] = useState(false)
  const [frecuenciaPago, setFrecuenciaPago] = useState<"mensual" | "quincenal">("mensual")
  const [diasPago, setDiasPago] = useState("")
  const [masOpciones, setMasOpciones] = useState(false)
  const [yaPagoEstePeriodo, setYaPagoEstePeriodo] = useState(false)
  const [nuevaProximoPeriodo, setNuevaProximoPeriodo] = useState(false)
  const [budgetCategoryId, setBudgetCategoryId] = useState("")

  // Una tarjeta sin día de pago es "fin de mes" (no sale vencida a mitad de mes)
  const dueQuestion = useDueQuestion(diasPago, frecuenciaPago === "quincenal")
  useEffect(() => {
    if (!dueQuestion) { setYaPagoEstePeriodo(false); setNuevaProximoPeriodo(false) }
  }, [dueQuestion])

  const tasaMensual = useMemo(() => {
    const t = Number(tasa.replace(",", "."))
    if (!(t > 0)) return undefined
    return Math.round((tasaEnAnual ? eaAMensual(t) : t) * 100) / 100
  }, [tasa, tasaEnAnual])

  // ─── Vista previa en vivo ──────────────────────────────────────────────────
  const cupoN = Number(cupo) || 0
  const ocupadoN = Number(ocupado) || 0
  const disponible = cupoN - ocupadoN
  const usoPct = cupoN > 0 ? Math.round((ocupadoN / cupoN) * 100) : 0

  const saldoPrestamo = Number(debeHoy) || 0
  const cuotaN = Number(cuota) || 0
  const amortizacion = useMemo(() => {
    if (esLinea || !tasaMensual || !saldoPrestamo || !cuotaN) return []
    const t = (frecuenciaPago === "quincenal" ? tasaMensual / 2 : tasaMensual) / 100
    if (cuotaN <= saldoPrestamo * t) return []
    const data: { mes: string; interes: number; capital: number; saldo: number }[] = []
    let resto = saldoPrestamo
    const max = frecuenciaPago === "quincenal" ? 96 : 48
    for (let i = 1; i <= max && resto > 0; i++) {
      const interes = Math.round(resto * t)
      const capital = Math.min(Math.round(cuotaN - interes), resto)
      resto = Math.max(0, resto - capital)
      data.push({ mes: `${frecuenciaPago === "quincenal" ? "Q" : "M"}${i}`, interes, capital, saldo: resto })
    }
    return data
  }, [esLinea, tasaMensual, saldoPrestamo, cuotaN, frecuenciaPago])
  const cuotaNoAlcanza = !esLinea && !!tasaMensual && saldoPrestamo > 0 && cuotaN > 0 && cuotaN <= saldoPrestamo * (frecuenciaPago === "quincenal" ? tasaMensual / 2 : tasaMensual) / 100

  // ─── Validación y envío ────────────────────────────────────────────────────
  const diasValidos = frecuenciaPago === "quincenal"
    ? diasPago.split(",").filter(d => d.trim() !== "").length === 2
    : true
  const canSubmit = !!tipo && !!nombre.trim() && (esLinea
    ? cupoN > 0 && (ocupadoN === 0 || cuotaN > 0)
    : saldoPrestamo > 0 && cuotaN > 0 && !!diasPago && diasValidos)

  const handleSubmit = () => {
    if (!tipo || !canSubmit) return
    if (esLinea) {
      onSubmit({
        nombre: nombre.trim(),
        tipoDeuda: tipo,
        cupoTotal: cupoN,
        montoTotal: ocupadoN,
        saldoActual: ocupadoN,
        cuotaPeriodo: cuotaN,
        tasaInteres: tasaMensual,
        acreedor: "",
        // Sin día: fin de mes (Kiri ajusta el 31 al último día de cada mes)
        diasPago: diasPago || "31",
        frecuenciaPago: "mensual",
        yaPagoEstePeriodo: dueQuestion ? yaPagoEstePeriodo : undefined,
        nuevaProximoPeriodo: dueQuestion ? nuevaProximoPeriodo : undefined,
        budgetCategoryId: budgetCategoryId || null,
      })
      return
    }
    const original = Math.max(Number(montoOriginal) || 0, saldoPrestamo)
    onSubmit({
      nombre: nombre.trim(),
      tipoDeuda: "PRESTAMO",
      montoTotal: original,
      saldoActual: saldoPrestamo !== original ? saldoPrestamo : undefined,
      cuotaPeriodo: cuotaN,
      tasaInteres: tasaMensual,
      acreedor: "",
      diasPago,
      frecuenciaPago,
      yaPagoEstePeriodo: dueQuestion ? yaPagoEstePeriodo : undefined,
      nuevaProximoPeriodo: dueQuestion ? nuevaProximoPeriodo : undefined,
      budgetCategoryId: budgetCategoryId || null,
    })
  }

  // ─── Paso 1: elegir el tipo ────────────────────────────────────────────────
  if (!tipo) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold">{tr("¿Qué quieres registrar?")}</p>
        {TIPOS.map((t, i) => (
          <motion.button
            key={t.tipo}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 380, damping: 28 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setTipo(t.tipo); if (t.tipo !== "PRESTAMO") setFrecuenciaPago("mensual") }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-kiri-emerald/40 hover:shadow-md transition-shadow text-left"
          >
            <span className={cn("h-12 w-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0", t.color)}>
              <t.icon className="h-6 w-6" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-sm">{tr(t.titulo)}</span>
              <span className="block text-[11px] text-muted-foreground">{tr(t.sub)}</span>
            </span>
          </motion.button>
        ))}
        <p className="text-[10px] text-muted-foreground text-center pt-1">
          {tr("Las tarjetas y créditos de compras tienen cupo y nunca se terminan: aunque las dejes en $0 siguen disponibles.")}
        </p>
      </div>
    )
  }

  const tipoInfo = TIPOS.find(t => t.tipo === tipo)!

  // ─── Paso 2: datos del tipo elegido ────────────────────────────────────────
  return (
    <motion.div key={tipo} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 340, damping: 30 }} className="space-y-4">
      <button type="button" onClick={() => setTipo(null)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className={cn("h-6 w-6 rounded-lg bg-gradient-to-br flex items-center justify-center", tipoInfo.color)}><tipoInfo.icon className="h-3.5 w-3.5" /></span>
        <span className="font-bold text-foreground">{tr(tipoInfo.titulo)}</span>
        <span>· {tr("cambiar")}</span>
      </button>

      {/* Nombre + atajos */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{esLinea ? tr("Nombre") : tr("Nombre de la deuda")}</Label>
        <Input
          placeholder={tipo === "PRESTAMO" ? tr("Ej: Préstamo Juan, Crédito carro...") : tipo === "CREDITO_COMPRAS" ? tr("Ej: Addi") : tr("Ej: Nu")}
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          className="h-11 rounded-xl"
          autoFocus
        />
        {SUGERENCIAS[tipo].length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {SUGERENCIAS[tipo].map(s => (
              <button key={s} type="button" onClick={() => setNombre(s)}
                className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all active:scale-95",
                  nombre === s ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-border text-muted-foreground hover:border-kiri-emerald/50 hover:text-foreground")}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {esLinea ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Cupo total")}</Label>
              <MoneyInput value={cupo} onChange={setCupo} className="h-11 rounded-xl" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("¿Cuánto tienes ocupado hoy?")}</Label>
              <MoneyInput value={ocupado} onChange={setOcupado} className="h-11 rounded-xl" placeholder="0" />
            </div>
          </div>

          {/* Vista previa del cupo */}
          <AnimatePresence>
            {cupoN > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-2xl bg-muted/30 p-3 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">{tr("Disponible")}</span>
                    <span className={cn("text-lg font-black", disponible < 0 ? "text-red-500" : "text-kiri-emerald")}>{formatAmount(disponible)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", usoPct >= 100 ? "bg-red-500" : usoPct >= 80 ? "bg-amber-500" : "bg-kiri-emerald")}
                      initial={false}
                      animate={{ width: `${Math.min(100, usoPct)}%` }}
                      transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {usoPct >= 100
                      ? tr("Estás por encima del cupo.")
                      : tr("Usas el {0}% de tu cupo{1}", [usoPct, usoPct > 30 ? tr(" · lo ideal es mantenerlo por debajo del 30%") : ""])}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("¿Cuánto pagas al mes?")}</Label>
            <MoneyInput value={cuota} onChange={setCuota} className="h-11 rounded-xl" placeholder="0" />
            <p className="text-[10px] text-muted-foreground">{ocupadoN === 0 ? tr("Si no le debes nada, déjalo en 0.") : tr("Lo que sueles pagarle cada mes. Las compras nuevas a cuotas se suman solas desde el mes siguiente.")}</p>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("¿Cuánto debes hoy?")}</Label>
              <MoneyInput value={debeHoy} onChange={setDebeHoy} className="h-11 rounded-xl" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{frecuenciaPago === "quincenal" ? tr("Cuota por quincena") : tr("Cuota mensual")}</Label>
              <MoneyInput value={cuota} onChange={setCuota} className="h-11 rounded-xl" placeholder="0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("¿Cada cuánto pagas?")}</Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl relative">
              {(["mensual", "quincenal"] as const).map(f => (
                <button key={f} type="button"
                  onClick={() => {
                    setFrecuenciaPago(f)
                    if (f === "mensual") setDiasPago(d => d.split(",")[0] ?? "")
                    else setDiasPago(d => {
                      if (d.includes(",")) return d
                      const n = parseInt(d, 10)
                      if (isNaN(n)) return "15,30"
                      return n <= 15 ? `${n},${Math.min(n + 15, 31)}` : `${Math.max(n - 15, 1)},${n}`
                    })
                  }}
                  className={cn("relative h-9 rounded-lg text-xs font-bold transition-colors z-10", frecuenciaPago === f ? "text-white" : "text-muted-foreground hover:text-foreground")}>
                  {frecuenciaPago === f && <motion.span layoutId="frec-pill" className="absolute inset-0 rounded-lg bg-kiri-emerald -z-10" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                  {f === "mensual" ? tr("Mensual") : tr("Quincenal")}
                </button>
              ))}
            </div>
          </div>

          <DiasPagoInput frecuencia={frecuenciaPago} value={diasPago} onChange={setDiasPago} />
        </>
      )}

      {/* Tasa (opcional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold flex items-center gap-1"><Percent className="h-3 w-3" />{tr("Tasa de interés")} <span className="font-normal text-muted-foreground">({tr("opcional")})</span></Label>
          <div className="flex text-[10px] font-bold rounded-lg bg-muted/40 p-0.5">
            {[false, true].map(anual => (
              <button key={String(anual)} type="button" onClick={() => setTasaEnAnual(anual)}
                className={cn("px-2 py-1 rounded-md transition-colors", tasaEnAnual === anual ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
                {anual ? tr("% anual (E.A.)") : tr("% mensual")}
              </button>
            ))}
          </div>
        </div>
        <Input inputMode="decimal" value={tasa} onChange={e => setTasa(e.target.value.replace(/[^\d.,]/g, ""))} className="h-10 rounded-xl" placeholder={tasaEnAnual ? tr("Ej: 28,5") : tr("Ej: 2,1")} />
        <p className="text-[10px] text-muted-foreground">
          {tasaEnAnual && tasaMensual
            ? tr("Equivale a {0}% mensual.", [tasaMensual.toLocaleString("es-CO")])
            : esLinea ? tr("Si no la sabes, déjala vacía: Kiri la descubre cuando pagas y le dices cuánto dice tu banco que debes.") : tr("Sale en tu extracto o en la app del banco.")}
        </p>
      </div>

      {/* Préstamo: resumen de amortización */}
      {!esLinea && cuotaNoAlcanza && (
        <p className="text-[11px] text-red-500 font-medium">{tr("Con esa tasa, la cuota no alcanza ni para los intereses: la deuda nunca bajaría.")}</p>
      )}
      {!esLinea && amortizacion.length > 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-muted/20 p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[9px] text-muted-foreground">{tr("Interés 1ª cuota")}</p><p className="text-xs font-bold text-red-500">{formatAmount(amortizacion[0].interes)}</p></div>
            <div><p className="text-[9px] text-muted-foreground">{tr("A capital")}</p><p className="text-xs font-bold text-kiri-emerald">{formatAmount(amortizacion[0].capital)}</p></div>
            <div><p className="text-[9px] text-muted-foreground">{tr("Terminas en")}</p><p className="text-xs font-bold">{tr("≈ {0} meses", [frecuenciaPago === "quincenal" ? Math.ceil(amortizacion.length / 2) : amortizacion.length])}</p></div>
          </div>
          <div className="h-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={amortizacion} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 8 }} interval={Math.max(0, Math.floor(amortizacion.length / 8))} />
                <YAxis tick={{ fontSize: 8 }} tickFormatter={v => tr("${0}k", [(v / 1000).toFixed(0)])} width={38} />
                <Tooltip formatter={(v: number, n: string) => [formatAmount(v), n === "interes" ? tr("Interés") : tr("Capital")]} />
                <Bar dataKey="interes" stackId="a" fill="#ef4444" fillOpacity={0.7} />
                <Bar dataKey="capital" stackId="a" fill="#10b981" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Más opciones */}
      <div className="rounded-2xl border border-border/60">
        <button type="button" onClick={() => setMasOpciones(v => !v)} className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold">
          <span>{tr("Más opciones")}</span>
          <motion.span animate={{ rotate: masOpciones ? 180 : 0 }}><ChevronDown className="h-4 w-4 text-muted-foreground" /></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {masOpciones && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-3">
                {esLinea ? (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold flex items-center gap-1"><Bell className="h-3 w-3" />{tr("Recordarme pagar el día")}</Label>
                    <Input type="number" min="1" max="31" value={diasPago} onChange={e => setDiasPago(e.target.value)} className="h-10 rounded-xl" placeholder={tr("Fin de mes")} />
                    <p className="text-[10px] text-muted-foreground">{tr("Opcional. Si lo dejas vacío, Kiri lo toma como fin de mes.")}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold">{tr("¿Cuánto te prestaron al inicio?")}</Label>
                    <MoneyInput value={montoOriginal} onChange={setMontoOriginal} className="h-10 rounded-xl" placeholder="0" />
                    <p className="text-[10px] text-muted-foreground">{tr("Opcional: para mostrarte cuánto llevas pagado.")}</p>
                  </div>
                )}
                <BudgetCategorySelector value={budgetCategoryId} onChange={v => setBudgetCategoryId(v ?? "")} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {dueQuestion && (
        <DueQuestion
          kind={dueQuestion}
          yaPago={yaPagoEstePeriodo}
          nueva={nuevaProximoPeriodo}
          onChange={v => { setYaPagoEstePeriodo(v.yaPago); setNuevaProximoPeriodo(v.nueva) }}
        />
      )}

      <Button onClick={handleSubmit} disabled={!canSubmit || loading} className="w-full h-12 rounded-xl bg-kiri-emerald text-white font-bold transition-transform active:scale-[0.99]">
        {loading ? tr("Guardando...") : tipo === "PRESTAMO" ? tr("Registrar préstamo") : tipo === "CREDITO_COMPRAS" ? tr("Registrar crédito") : tr("Registrar tarjeta")}
      </Button>
    </motion.div>
  )
}

function DiasPagoInput({ frecuencia, value, onChange }: { frecuencia: "mensual" | "quincenal"; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold">{frecuencia === "quincenal" ? tr("Días de pago (quincenal)") : tr("Día de pago")}</Label>
      {frecuencia === "quincenal" ? (
        <div className="flex items-center gap-2">
          <Input type="number" min="1" max="31" placeholder="15" value={value.split(",")[0] ?? ""}
            onChange={e => onChange(`${e.target.value},${value.split(",")[1] ?? ""}`)} className="h-11 rounded-xl w-20 text-center font-bold" />
          <span className="text-muted-foreground font-bold">{tr("y")}</span>
          <Input type="number" min="1" max="31" placeholder="30" value={value.split(",")[1] ?? ""}
            onChange={e => onChange(`${value.split(",")[0] ?? ""},${e.target.value}`)} className="h-11 rounded-xl w-20 text-center font-bold" />
        </div>
      ) : (
        <Input type="number" min="1" max="31" value={value} onChange={e => onChange(e.target.value)} className="h-11 rounded-xl" placeholder={tr("Ej: 15")} />
      )}
    </div>
  )
}
