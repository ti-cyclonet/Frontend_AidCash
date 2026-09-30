"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Building2, Search, Plus, CheckCircle2, Loader2, Percent,
  CreditCard, Landmark,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { looksLikeCreditCardName } from "@/lib/debt-utils"
import { BudgetCategorySelector } from "@/components/obligaciones/BudgetCategorySelector"
import { DueQuestion, useDueQuestion } from "@/components/obligaciones/DueQuestion"
import { tr } from "@/lib/i18n"
import { useAppContext } from "@/lib/app-context"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DebtRegistrationForm — Formulario de registro de deuda
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Dos modos con toggle visual en la parte superior:
 *   1. "normal" — Deuda Simple: nombre, monto total, cuota, día de pago.
 *      Ideal para préstamos personales, fiado, cuotas informales.
 *   2. "banco"  — Deuda Bancaria: búsqueda de banco, tasa de interés,
 *      monto inicial, saldo actual, gráfico de amortización.
 *      Ideal para tarjetas de crédito, créditos de libre inversión, hipotecas.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BankOption {
  id: string
  nombre: string
  tasaInteresPromedio: number
  esVerificado: boolean
}

export interface DebtFormData {
  nombre: string
  montoTotal: number
  saldoActual?: number
  cuotaPeriodo: number
  tasaInteres?: number
  bankEntityId?: string | null
  acreedor: string
  diasPago: string
  frecuenciaPago?: string
  tipoDeuda?: 'PRESTAMO' | 'TARJETA_CREDITO'
  /** El usuario confirmó que la cuota del periodo actual ya la pagó (por fuera
   * de Kiri) — evita que la deuda nazca marcada "vencida" cuando el día de
   * pago ingresado ya pasó este periodo. */
  yaPagoEstePeriodo?: boolean
  /** La deuda es NUEVA y su primer cobro real es el próximo periodo — no
   * pagada, no vencida. Mutuamente excluyente con yaPagoEstePeriodo. */
  nuevaProximoPeriodo?: boolean
  budgetCategoryId?: string | null
}

interface Props {
  onSubmit: (data: DebtFormData) => void | Promise<void>
  loading?: boolean
}

type DebtMode = "normal" | "banco"

// ─── Componente principal ─────────────────────────────────────────────────────

export function DebtRegistrationForm({ onSubmit, loading }: Props) {
  // Montos con la moneda del usuario (antes: toLocaleString con el idioma del teléfono)
  const { formatAmount } = useAppContext()
  // Inicializar directamente con "normal" — sin estado null
  const [mode, setMode] = useState<DebtMode>("normal")

  // Campos compartidos
  const [nombre, setNombre] = useState("")
  const [montoTotal, setMontoTotal] = useState("")
  const [cuotaPeriodo, setCuotaPeriodo] = useState("")
  const [diasPago, setDiasPago] = useState("")
  const [frecuenciaPago, setFrecuenciaPago] = useState<"mensual" | "quincenal">("mensual")
  const [yaPagando, setYaPagando] = useState(false)
  const [saldoActualNormal, setSaldoActualNormal] = useState("")
  const [yaPagoEstePeriodo, setYaPagoEstePeriodo] = useState(false)
  const [nuevaProximoPeriodo, setNuevaProximoPeriodo] = useState(false)
  const [budgetCategoryId, setBudgetCategoryId] = useState<string>("")

  // Campos exclusivos del modo banco
  const [banks, setBanks] = useState<BankOption[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [savingBank, setSavingBank] = useState(false)
  const [tasaInteres, setTasaInteres] = useState("")
  const [montoInicial, setMontoInicial] = useState("")
  const [saldoActual, setSaldoActual] = useState("")
  const [newBankName, setNewBankName] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // El día de pago ingresado ya pasó este periodo (o es HOY) — sin aclarar si
  // esa cuota está paga, la deuda nacería marcada "vencida" con una fecha que
  // en realidad ya se resolvió. Ahora también considera los DOS días de una
  // deuda quincenal (antes solo miraba un día, como si fuera mensual).
  const dueQuestion = useDueQuestion(diasPago, frecuenciaPago === "quincenal")

  // Si el usuario cambia el día a uno que ya no aplica, no dejar una
  // respuesta "ya pagué" colgada de un día distinto.
  useEffect(() => {
    if (!dueQuestion) { setYaPagoEstePeriodo(false); setNuevaProximoPeriodo(false) }
  }, [dueQuestion])

  // Cargar bancos al entrar en modo banco
  useEffect(() => {
    if (mode === "banco") {
      api<{ banks: BankOption[] }>('/banks').then(({ data }) => {
        if (data) setBanks(data.banks)
      })
    }
  }, [mode])

  // ─── Lógica de bancos ───────────────────────────────────────────────────────

  const filteredBanks = banks.filter(b =>
    b.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const hasExactMatch = banks.some(b =>
    b.nombre.toLowerCase() === searchQuery.toLowerCase()
  )

  const selectBank = (bank: BankOption) => {
    setSelectedBank(bank)
    setSearchQuery(bank.nombre)
    setTasaInteres(String(bank.tasaInteresPromedio))
    setShowDropdown(false)
    setIsAddingNew(false)
  }

  const handleAddNewBank = async () => {
    if (!newBankName || !tasaInteres) return
    setSavingBank(true)
    const { data } = await api<{ bank: BankOption; isNew: boolean }>('/banks', {
      method: 'POST',
      body: { nombre: newBankName, tasaInteresPromedio: Number(tasaInteres) },
    })
    if (data) {
      setSelectedBank(data.bank)
      setSearchQuery(data.bank.nombre)
      setBanks(prev => [...prev, data.bank])
      setIsAddingNew(false)
    }
    setSavingBank(false)
  }

  const startAddNew = () => {
    setIsAddingNew(true)
    setSelectedBank(null)
    setNewBankName(searchQuery)
    setShowDropdown(false)
  }

  // ─── Gráfico de amortización (modo banco) ──────────────────────────────────

  // La tasa que devuelve el banco/usuario es mensual — si la deuda se paga
  // quincenal, cada cuota cae cada medio mes, así que el interés de cada
  // periodo es la mitad del mensual (misma simplificación que usa el resto
  // de la app para repartir montos quincenales, ver getMontoPorPeriodo).
  const periodLabel = frecuenciaPago === "quincenal" ? "Q" : "M"
  const amortizationData = useMemo(() => {
    const saldo = Number(saldoActual) || Number(montoInicial) || Number(montoTotal)
    const tasaMensual = Number(tasaInteres) / 100
    const tasa = frecuenciaPago === "quincenal" ? tasaMensual / 2 : tasaMensual
    const cuota = Number(cuotaPeriodo)

    if (!saldo || !tasa || !cuota || cuota <= saldo * tasa) return []

    const data = []
    let remaining = saldo
    // 24 meses de proyección — el doble de periodos si es quincenal, porque
    // cada quincena es medio mes.
    const maxPeriods = Math.min(
      frecuenciaPago === "quincenal" ? 48 : 24,
      Math.ceil(saldo / (cuota - saldo * tasa)) + 2
    )

    for (let i = 1; i <= maxPeriods && remaining > 0; i++) {
      const interes = Math.round(remaining * tasa)
      const capital = Math.min(Math.round(cuota - interes), remaining)
      remaining = Math.max(0, remaining - capital)

      data.push({
        mes: `${periodLabel}${i}`,
        interes,
        capital,
        saldo: remaining,
      })

      if (remaining <= 0) break
    }

    return data
  }, [saldoActual, montoInicial, montoTotal, tasaInteres, cuotaPeriodo, frecuenciaPago, periodLabel])

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (mode === "normal") {
      onSubmit({
        nombre,
        montoTotal: Number(montoTotal),
        saldoActual: yaPagando && saldoActualNormal ? Number(saldoActualNormal) : undefined,
        cuotaPeriodo: Number(cuotaPeriodo),
        diasPago: diasPago || "1",
        frecuenciaPago,
        acreedor: "",
        yaPagoEstePeriodo: dueQuestion ? yaPagoEstePeriodo : undefined,
        nuevaProximoPeriodo: dueQuestion ? nuevaProximoPeriodo : undefined,
        budgetCategoryId: budgetCategoryId || null,
      })
    } else {
      const mInicial = Number(montoInicial) || Number(montoTotal)
      const sActual = Number(saldoActual) || mInicial
      onSubmit({
        nombre,
        montoTotal: mInicial,
        saldoActual: sActual !== mInicial ? sActual : undefined,
        cuotaPeriodo: Number(cuotaPeriodo),
        tasaInteres: Number(tasaInteres) || undefined,
        bankEntityId: selectedBank?.id ?? null,
        acreedor: (selectedBank?.nombre ?? searchQuery) || "",
        diasPago: diasPago || "1",
        frecuenciaPago,
        tipoDeuda: looksLikeCreditCardName(nombre) ? 'TARJETA_CREDITO' : 'PRESTAMO',
        yaPagoEstePeriodo: dueQuestion ? yaPagoEstePeriodo : undefined,
        nuevaProximoPeriodo: dueQuestion ? nuevaProximoPeriodo : undefined,
        budgetCategoryId: budgetCategoryId || null,
      })
    }
  }

  // Quincenal necesita sus DOS días de cobro — antes el formulario solo pedía
  // uno, y la deuda quedaba "quincenal" con un único día: la frontera entre
  // quincenas caía en el calendario fijo (día 15) y no en sus cobros reales.
  const diasValidos = frecuenciaPago === "quincenal"
    ? diasPago.split(",").filter(d => d.trim() !== "").length === 2
    : !!diasPago
  const canSubmit = mode === "normal"
    ? !!nombre && !!montoTotal && !!cuotaPeriodo && diasValidos
    : !!nombre && (!!montoTotal || !!montoInicial) && !!cuotaPeriodo && diasValidos

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ═══ Toggle de modo: Deuda Simple / Deuda Bancaria ═══ */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-2xl">
        <button
          type="button"
          onClick={() => setMode("normal")}
          className={cn(
            "flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-bold transition-all",
            mode === "normal"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Landmark className="h-4 w-4" />{tr("Deuda Simple")}</button>
        <button
          type="button"
          onClick={() => setMode("banco")}
          className={cn(
            "flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-bold transition-all",
            mode === "banco"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CreditCard className="h-4 w-4" />{tr("Deuda Bancaria")}</button>
      </div>

      {/* Subtítulo descriptivo */}
      <p className="text-[10px] text-muted-foreground text-center -mt-2">
        {mode === "normal"
          ? tr("Préstamos personales, fiado, cuotas entre amigos.")
          : tr("Tarjetas de crédito, créditos de libre inversión, hipotecas.")}
      </p>

      {/* Nombre */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{tr("Nombre de la deuda")}</Label>
        <Input
          placeholder={mode === "normal" ? tr("Ej: Préstamo Juan, Cuota moto...") : tr("Ej: Visa Bancolombia, Crédito Davivienda...")}
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          className="h-11 rounded-xl"
          autoFocus
        />
      </div>

      {/* ═══ Modo Banco: búsqueda de banco + tasa ═══ */}
      {mode === "banco" && (
        <>
          {/* Búsqueda de banco */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Banco o entidad financiera")}</Label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tr("Buscar banco...")}
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); setSelectedBank(null); setIsAddingNew(false) }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => { setTimeout(() => setShowDropdown(false), 150) }}
                  className="h-11 rounded-xl pl-10"
                />
                {selectedBank && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-kiri-emerald" />}
              </div>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-50 max-h-[180px] overflow-y-auto">
                  {filteredBanks.length > 0 ? filteredBanks.map(bank => (
                    <button key={bank.id} onClick={() => selectBank(bank)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors text-left">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-bold">{bank.nombre}</p>
                          <p className="text-[8px] text-muted-foreground">{tr("{0}% mensual{1}", [bank.tasaInteresPromedio, bank.esVerificado && tr(" · ✓ Verificado")])}</p>
                        </div>
                      </div>
                    </button>
                  )) : (
                    <p className="text-[10px] text-muted-foreground text-center py-3">
                      {banks.length === 0 ? tr("Cargando bancos...") : tr("Sin resultados")}
                    </p>
                  )}
                  {!hasExactMatch && searchQuery.length >= 2 && (
                    <button onClick={startAddNew}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-kiri-emerald/5 transition-colors text-left border-t border-border">
                      <Plus className="h-3.5 w-3.5 text-kiri-emerald" />
                      <span className="text-[10px] font-bold text-kiri-emerald">{tr("Agregar “{0}”", [searchQuery])}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Agregar banco nuevo */}
          {isAddingNew && (
            <Card className="border-kiri-emerald/20 bg-kiri-emerald/5 rounded-xl">
              <CardContent className="p-3 space-y-2">
                <p className="text-[10px] font-bold text-kiri-emerald">{tr("Nuevo banco")}</p>
                <Input value={newBankName} onChange={e => setNewBankName(e.target.value)} className="h-9 rounded-lg text-sm" placeholder={tr("Nombre del banco")} />
                <Input type="number" step="0.01" value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} className="h-9 rounded-lg text-sm" placeholder={tr("Tasa mensual (%)")} />
                <Button size="sm" onClick={handleAddNewBank} disabled={!newBankName || !tasaInteres || savingBank} className="w-full rounded-lg bg-kiri-emerald text-white font-bold text-xs h-8">
                  {savingBank ? <Loader2 className="h-3 w-3 animate-spin" /> : tr("Guardar banco")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tasa de interés */}
          {!isAddingNew && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1"><Percent className="h-3 w-3" />{" "}{tr("Tasa de interés mensual")}</Label>
              <Input type="number" step="0.01" value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} className="h-10 rounded-xl" placeholder={tr("Ej: 1.85 (opcional)")} />
              {selectedBank && <p className="text-[8px] text-kiri-emerald">{tr("Sugerida por {0}", [selectedBank.nombre])}</p>}
            </div>
          )}

          {/* Toggle avanzado: monto inicial vs saldo actual */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? tr("▾ Ocultar opciones avanzadas") : tr("▸ ¿Ya venías pagando esta deuda?")}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold">{tr("Monto prestado inicial")}</Label>
                <MoneyInput value={montoInicial} onChange={v => { setMontoInicial(v); if (!montoTotal) setMontoTotal(v) }} className="h-10 rounded-xl" placeholder="0" />
                <p className="text-[7px] text-muted-foreground">{tr("Lo que te prestaron")}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold">{tr("Saldo actual")}</Label>
                <MoneyInput value={saldoActual} onChange={v => setSaldoActual(v)} className="h-10 rounded-xl" placeholder="0" />
                <p className="text-[7px] text-muted-foreground">{tr("Lo que debes hoy")}</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ Campos comunes ═══ */}

      {/* Monto total (solo para deuda normal, o banco sin avanzado) */}
      {(mode === "normal" || (!showAdvanced && mode === "banco")) && (
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">{mode === "normal" ? tr("Monto total de la deuda") : tr("Monto del préstamo")}</Label>
          <MoneyInput value={montoTotal} onChange={v => setMontoTotal(v)} className="h-11 rounded-xl" placeholder="0" />
        </div>
      )}

      {/* ¿Ya venías pagando? (solo modo normal) */}
      {mode === "normal" && (
        <>
          <button
            onClick={() => setYaPagando(!yaPagando)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {yaPagando ? tr("▾ Ocultar saldo actual") : tr("▸ ¿Ya venías pagando esta deuda?")}
          </button>
          {yaPagando && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold">{tr("¿Cuánto debes actualmente?")}</Label>
              <MoneyInput value={saldoActualNormal} onChange={v => setSaldoActualNormal(v)} className="h-10 rounded-xl" placeholder="0" />
              <p className="text-[7px] text-muted-foreground">{tr("Si ya has pagado algunas cuotas, ingresa lo que debes hoy.")}</p>
            </div>
          )}
          {/* Resumen visual de progreso */}
          {yaPagando && Number(montoTotal) > 0 && Number(saldoActualNormal) > 0 && Number(saldoActualNormal) < Number(montoTotal) && (
            <Card className="border-none bg-emerald-500/5 rounded-xl">
              <CardContent className="p-3 space-y-1">
                <p className="text-[8px] font-bold text-emerald-400 uppercase">{tr("Resumen")}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[7px] text-muted-foreground">{tr("Monto total")}</p>
                    <p className="text-[11px] font-bold">{formatAmount(Number(montoTotal))}</p>
                  </div>
                  <div>
                    <p className="text-[7px] text-muted-foreground">{tr("Ya pagaste")}</p>
                    <p className="text-[11px] font-bold text-emerald-400">{formatAmount(Number(montoTotal) - Number(saldoActualNormal))}</p>
                  </div>
                  <div>
                    <p className="text-[7px] text-muted-foreground">{tr("Te falta")}</p>
                    <p className="text-[11px] font-bold text-amber-400">{formatAmount(Number(saldoActualNormal))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Cuota por periodo */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{tr("Cuota por periodo")}</Label>
        <MoneyInput value={cuotaPeriodo} onChange={v => setCuotaPeriodo(v)} className="h-11 rounded-xl" placeholder="0" />
      </div>

      {/* Frecuencia de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{tr("Frecuencia de pago")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setFrecuenciaPago("mensual"); setDiasPago(d => d.split(",")[0] ?? "") }}
            className={cn("h-10 rounded-xl text-sm font-bold border-2 transition-colors",
              frecuenciaPago === "mensual" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
            )}
          >{tr("Mensual")}</button>
          <button
            type="button"
            onClick={() => {
              setFrecuenciaPago("quincenal")
              setDiasPago(d => {
                if (d.includes(",")) return d
                const n = parseInt(d, 10)
                if (isNaN(n)) return "15,30"
                return n <= 15 ? `${n},${Math.min(n + 15, 31)}` : `${Math.max(n - 15, 1)},${n}`
              })
            }}
            className={cn("h-10 rounded-xl text-sm font-bold border-2 transition-colors",
              frecuenciaPago === "quincenal" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
            )}
          >{tr("Quincenal")}</button>
        </div>
      </div>

      {/* Día(s) de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{frecuenciaPago === "quincenal" ? tr("Días de pago (quincenal)") : tr("Día de pago")}</Label>
        {frecuenciaPago === "quincenal" ? (
          <div className="flex items-center gap-2">
            <Input type="number" min="1" max="31" placeholder="15"
              value={diasPago.split(",")[0] ?? ""}
              onChange={e => setDiasPago(`${e.target.value},${diasPago.split(",")[1] ?? ""}`)}
              className="h-11 rounded-xl w-20 text-center font-bold" />
            <span className="text-muted-foreground font-bold">y</span>
            <Input type="number" min="1" max="31" placeholder="30"
              value={diasPago.split(",")[1] ?? ""}
              onChange={e => setDiasPago(`${diasPago.split(",")[0] ?? ""},${e.target.value}`)}
              className="h-11 rounded-xl w-20 text-center font-bold" />
          </div>
        ) : (
          <Input type="number" min="1" max="31" value={diasPago} onChange={e => setDiasPago(e.target.value)} className="h-11 rounded-xl" placeholder={tr("Ej: 15")} />
        )}
        <p className="text-[8px] text-muted-foreground">
          {frecuenciaPago === "quincenal" ? tr("Los dos días del mes en que te cobran (ej. 15 y 30)") : tr("Día del mes en que debes pagar (1-31)")}
        </p>
      </div>

      <BudgetCategorySelector value={budgetCategoryId} onChange={v => setBudgetCategoryId(v ?? "")} />

      {/* Si el día de pago ingresado ya pasó este mes (o es hoy), preguntar si
          esa cuota ya está paga — si no se pregunta, la deuda nace marcada
          "vencida" con una fecha que en realidad ya se resolvió. */}
      {dueQuestion && (
        <DueQuestion
          kind={dueQuestion}
          yaPago={yaPagoEstePeriodo}
          nueva={nuevaProximoPeriodo}
          onChange={v => { setYaPagoEstePeriodo(v.yaPago); setNuevaProximoPeriodo(v.nueva) }}
        />
      )}

      {/* ═══ Preview primera cuota (modo banco con tasa) ═══ */}
      {mode === "banco" && Number(tasaInteres) > 0 && Number(cuotaPeriodo) > 0 && (Number(saldoActual) > 0 || Number(montoTotal) > 0) && (
        <Card className="border-none bg-muted/20 rounded-xl">
          <CardContent className="p-3 space-y-1">
            <p className="text-[8px] font-bold text-muted-foreground uppercase">{tr("Preview primera cuota")}</p>
            {(() => {
              const saldo = Number(saldoActual) || Number(montoInicial) || Number(montoTotal)
              const tasaMensual = Number(tasaInteres) / 100
              const tasa = frecuenciaPago === "quincenal" ? tasaMensual / 2 : tasaMensual
              const cuota = Number(cuotaPeriodo)
              const interes = Math.round(saldo * tasa)
              const capital = Math.max(0, cuota - interes)
              return (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[7px] text-muted-foreground">{tr("Interés")}</p><p className="text-[11px] font-bold text-red-500">{formatAmount(interes)}</p></div>
                  <div><p className="text-[7px] text-muted-foreground">{tr("A capital")}</p><p className="text-[11px] font-bold text-kiri-emerald">{formatAmount(capital)}</p></div>
                  <div><p className="text-[7px] text-muted-foreground">{tr("Nuevo saldo")}</p><p className="text-[11px] font-bold">{formatAmount(Math.max(0, saldo - capital))}</p></div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* ═══ Gráfico de Amortización (modo banco con tasa y datos suficientes) ═══ */}
      {mode === "banco" && amortizationData.length > 2 && (
        <Card className="border-none bg-muted/10 rounded-xl overflow-hidden">
          <CardContent className="p-3 space-y-2">
            <p className="text-[8px] font-bold text-muted-foreground uppercase">{tr("Proyección de amortización")}</p>
            <p className="text-[9px] text-muted-foreground">{tr("Así se distribuirá tu cuota {0} (interés ↓ · capital ↑)", [frecuenciaPago === "quincenal" ? tr("quincena a quincena") : tr("mes a mes")])}</p>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={amortizationData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 8 }} interval={Math.max(0, Math.floor(amortizationData.length / 8))} />
                  <YAxis tick={{ fontSize: 8 }} tickFormatter={v => tr("${0}k", [(v / 1000).toFixed(0)])} width={40} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-card border border-border rounded-lg px-2 py-1.5 shadow-lg text-[9px] space-y-0.5">
                          <p className="font-bold">{payload[0]?.payload?.mes}</p>
                          <p className="text-red-500">{tr("Interés: {0}", [formatAmount(Number(payload[0]?.value ?? 0))])}</p>
                          <p className="text-emerald-500">{tr("Capital: {0}", [formatAmount(Number(payload[1]?.value ?? 0))])}</p>
                          <p className="text-muted-foreground">{tr("Saldo: {0}", [formatAmount(Number(payload[0]?.payload?.saldo ?? 0))])}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="interes" stackId="a" radius={[0, 0, 0, 0]} name="Interés">
                    {amortizationData.map((_, i) => (
                      <Cell key={i} fill="#ef4444" fillOpacity={0.7} />
                    ))}
                  </Bar>
                  <Bar dataKey="capital" stackId="a" radius={[4, 4, 0, 0]} name="Capital">
                    {amortizationData.map((_, i) => (
                      <Cell key={i} fill="#10b981" fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 text-[8px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500/70" />{" "}{tr("Interés (baja)")}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/80" />{" "}{tr("Capital (sube)")}</span>
            </div>
            {amortizationData.length > 0 && (
              <p className="text-[9px] text-center text-kiri-emerald font-bold">{tr("≈ {0} meses para liquidar", [frecuenciaPago === "quincenal" ? Math.ceil(amortizationData.length / 2) : amortizationData.length])}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={!canSubmit || loading} className="w-full h-12 rounded-xl bg-kiri-emerald text-white font-bold">
        {loading ? "Guardando..." : tr("Registrar deuda")}
      </Button>
    </div>
  )
}
