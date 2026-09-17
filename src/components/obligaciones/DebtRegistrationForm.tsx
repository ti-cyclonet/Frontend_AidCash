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
import { getNextPaymentInfo } from "@/lib/payment-schedule"
import { BudgetCategorySelector } from "@/components/obligaciones/BudgetCategorySelector"

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

  // El día de pago ingresado ya pasó este mes (o es HOY) — sin aclarar si esa
  // cuota está paga, la deuda nacería marcada "vencida" con una fecha que en
  // realidad ya se resolvió (ver getNextPaymentInfo, misma lógica que ya usa
  // el listado de obligaciones para decidir "vencido" vs "vence hoy").
  const dueQuestion = useMemo(() => {
    const day = parseInt(diasPago, 10)
    if (isNaN(day) || day < 1 || day > 31) return null
    const info = getNextPaymentInfo(diasPago, false)
    if (info.status === "vencido") return "vencido" as const
    if (info.status === "proximo" && info.daysUntil === 0) return "hoy" as const
    return null
  }, [diasPago])

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

  const canSubmit = mode === "normal"
    ? !!nombre && !!montoTotal && !!cuotaPeriodo && !!diasPago
    : !!nombre && (!!montoTotal || !!montoInicial) && !!cuotaPeriodo && !!diasPago

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
          <Landmark className="h-4 w-4" />
          Deuda Simple
        </button>
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
          <CreditCard className="h-4 w-4" />
          Deuda Bancaria
        </button>
      </div>

      {/* Subtítulo descriptivo */}
      <p className="text-[10px] text-muted-foreground text-center -mt-2">
        {mode === "normal"
          ? "Préstamos personales, fiado, cuotas entre amigos."
          : "Tarjetas de crédito, créditos de libre inversión, hipotecas."}
      </p>

      {/* Nombre */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Nombre de la deuda</Label>
        <Input
          placeholder={mode === "normal" ? "Ej: Préstamo Juan, Cuota moto..." : "Ej: Visa Bancolombia, Crédito Davivienda..."}
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
            <Label className="text-xs font-bold">Banco o entidad financiera</Label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar banco..."
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
                          <p className="text-[8px] text-muted-foreground">{bank.tasaInteresPromedio}% mensual{bank.esVerificado && " · ✓ Verificado"}</p>
                        </div>
                      </div>
                    </button>
                  )) : (
                    <p className="text-[10px] text-muted-foreground text-center py-3">
                      {banks.length === 0 ? "Cargando bancos..." : "Sin resultados"}
                    </p>
                  )}
                  {!hasExactMatch && searchQuery.length >= 2 && (
                    <button onClick={startAddNew}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-kiri-emerald/5 transition-colors text-left border-t border-border">
                      <Plus className="h-3.5 w-3.5 text-kiri-emerald" />
                      <span className="text-[10px] font-bold text-kiri-emerald">Agregar &ldquo;{searchQuery}&rdquo;</span>
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
                <p className="text-[10px] font-bold text-kiri-emerald">Nuevo banco</p>
                <Input value={newBankName} onChange={e => setNewBankName(e.target.value)} className="h-9 rounded-lg text-sm" placeholder="Nombre del banco" />
                <Input type="number" step="0.01" value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} className="h-9 rounded-lg text-sm" placeholder="Tasa mensual (%)" />
                <Button size="sm" onClick={handleAddNewBank} disabled={!newBankName || !tasaInteres || savingBank} className="w-full rounded-lg bg-kiri-emerald text-white font-bold text-xs h-8">
                  {savingBank ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar banco"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tasa de interés */}
          {!isAddingNew && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1"><Percent className="h-3 w-3" /> Tasa de interés mensual</Label>
              <Input type="number" step="0.01" value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} className="h-10 rounded-xl" placeholder="Ej: 1.85 (opcional)" />
              {selectedBank && <p className="text-[8px] text-kiri-emerald">Sugerida por {selectedBank.nombre}</p>}
            </div>
          )}

          {/* Toggle avanzado: monto inicial vs saldo actual */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? "▾ Ocultar opciones avanzadas" : "▸ ¿Ya venías pagando esta deuda?"}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold">Monto prestado inicial</Label>
                <MoneyInput value={montoInicial} onChange={v => { setMontoInicial(v); if (!montoTotal) setMontoTotal(v) }} className="h-10 rounded-xl" placeholder="0" />
                <p className="text-[7px] text-muted-foreground">Lo que te prestaron</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold">Saldo actual</Label>
                <MoneyInput value={saldoActual} onChange={v => setSaldoActual(v)} className="h-10 rounded-xl" placeholder="0" />
                <p className="text-[7px] text-muted-foreground">Lo que debes hoy</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ Campos comunes ═══ */}

      {/* Monto total (solo para deuda normal, o banco sin avanzado) */}
      {(mode === "normal" || (!showAdvanced && mode === "banco")) && (
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">{mode === "normal" ? "Monto total de la deuda" : "Monto del préstamo"}</Label>
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
            {yaPagando ? "▾ Ocultar saldo actual" : "▸ ¿Ya venías pagando esta deuda?"}
          </button>
          {yaPagando && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold">¿Cuánto debes actualmente?</Label>
              <MoneyInput value={saldoActualNormal} onChange={v => setSaldoActualNormal(v)} className="h-10 rounded-xl" placeholder="0" />
              <p className="text-[7px] text-muted-foreground">Si ya has pagado algunas cuotas, ingresa lo que debes hoy.</p>
            </div>
          )}
          {/* Resumen visual de progreso */}
          {yaPagando && Number(montoTotal) > 0 && Number(saldoActualNormal) > 0 && Number(saldoActualNormal) < Number(montoTotal) && (
            <Card className="border-none bg-emerald-500/5 rounded-xl">
              <CardContent className="p-3 space-y-1">
                <p className="text-[8px] font-bold text-emerald-400 uppercase">Resumen</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[7px] text-muted-foreground">Monto total</p>
                    <p className="text-[11px] font-bold">${Number(montoTotal).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[7px] text-muted-foreground">Ya pagaste</p>
                    <p className="text-[11px] font-bold text-emerald-400">${(Number(montoTotal) - Number(saldoActualNormal)).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[7px] text-muted-foreground">Te falta</p>
                    <p className="text-[11px] font-bold text-amber-400">${Number(saldoActualNormal).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Cuota por periodo */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Cuota por periodo</Label>
        <MoneyInput value={cuotaPeriodo} onChange={v => setCuotaPeriodo(v)} className="h-11 rounded-xl" placeholder="0" />
      </div>

      {/* Frecuencia de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Frecuencia de pago</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFrecuenciaPago("mensual")}
            className={cn("h-10 rounded-xl text-sm font-bold border-2 transition-colors",
              frecuenciaPago === "mensual" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
            )}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setFrecuenciaPago("quincenal")}
            className={cn("h-10 rounded-xl text-sm font-bold border-2 transition-colors",
              frecuenciaPago === "quincenal" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
            )}
          >
            Quincenal
          </button>
        </div>
      </div>

      {/* Día de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Día de pago</Label>
        <Input type="number" min="1" max="31" value={diasPago} onChange={e => setDiasPago(e.target.value)} className="h-11 rounded-xl" placeholder="Ej: 15" />
        <p className="text-[8px] text-muted-foreground">Día del mes en que debes pagar (1-31)</p>
      </div>

      <BudgetCategorySelector value={budgetCategoryId} onChange={v => setBudgetCategoryId(v ?? "")} />

      {/* Si el día de pago ingresado ya pasó este mes (o es hoy), preguntar si
          esa cuota ya está paga — si no se pregunta, la deuda nace marcada
          "vencida" con una fecha que en realidad ya se resolvió. */}
      {dueQuestion && (
        <div className="rounded-2xl border-2 border-amber-400/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-bold">
            {dueQuestion === "hoy"
              ? "Esta cuota vence hoy. ¿Ya pagaste?"
              : `El día ${diasPago} de este mes ya pasó. ¿Ya pagaste la cuota de este periodo?`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setYaPagoEstePeriodo(true); setNuevaProximoPeriodo(false) }}
              className={cn("h-9 rounded-xl text-xs font-bold border-2 transition-colors",
                yaPagoEstePeriodo ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
              )}
            >
              {dueQuestion === "hoy" ? "Sí, ya pagué" : "Sí, ya la pagué"}
            </button>
            <button
              type="button"
              onClick={() => { setYaPagoEstePeriodo(false); setNuevaProximoPeriodo(false) }}
              className={cn("h-9 rounded-xl text-xs font-bold border-2 transition-colors",
                (!yaPagoEstePeriodo && !nuevaProximoPeriodo) ? "bg-red-500 text-white border-red-500" : "border-muted text-muted-foreground hover:border-red-400/40"
              )}
            >
              {dueQuestion === "hoy" ? "No, vence hoy" : "No, está vencida"}
            </button>
          </div>
          {/* 3ra opción — deuda genuinamente NUEVA (ej. un préstamo que arranca
              el mes que viene): no está pagada, pero tampoco vencida porque
              nunca debió cobrarse este periodo. No genera ningún movimiento y
              corre la próxima fecha de pago al mismo día del mes siguiente. */}
          <button
            type="button"
            onClick={() => { setYaPagoEstePeriodo(false); setNuevaProximoPeriodo(true) }}
            className={cn("w-full h-9 rounded-xl text-xs font-bold border-2 transition-colors",
              nuevaProximoPeriodo ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle" : "border-muted text-muted-foreground hover:border-cyclon-periwinkle/40"
            )}
          >
            Es una obligación nueva (inicia el próximo mes)
          </button>
        </div>
      )}

      {/* ═══ Preview primera cuota (modo banco con tasa) ═══ */}
      {mode === "banco" && Number(tasaInteres) > 0 && Number(cuotaPeriodo) > 0 && (Number(saldoActual) > 0 || Number(montoTotal) > 0) && (
        <Card className="border-none bg-muted/20 rounded-xl">
          <CardContent className="p-3 space-y-1">
            <p className="text-[8px] font-bold text-muted-foreground uppercase">Preview primera cuota</p>
            {(() => {
              const saldo = Number(saldoActual) || Number(montoInicial) || Number(montoTotal)
              const tasaMensual = Number(tasaInteres) / 100
              const tasa = frecuenciaPago === "quincenal" ? tasaMensual / 2 : tasaMensual
              const cuota = Number(cuotaPeriodo)
              const interes = Math.round(saldo * tasa)
              const capital = Math.max(0, cuota - interes)
              return (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[7px] text-muted-foreground">Interés</p><p className="text-[11px] font-bold text-red-500">${interes.toLocaleString()}</p></div>
                  <div><p className="text-[7px] text-muted-foreground">A capital</p><p className="text-[11px] font-bold text-kiri-emerald">${capital.toLocaleString()}</p></div>
                  <div><p className="text-[7px] text-muted-foreground">Nuevo saldo</p><p className="text-[11px] font-bold">${Math.max(0, saldo - capital).toLocaleString()}</p></div>
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
            <p className="text-[8px] font-bold text-muted-foreground uppercase">Proyección de amortización</p>
            <p className="text-[9px] text-muted-foreground">
              Así se distribuirá tu cuota {frecuenciaPago === "quincenal" ? "quincena a quincena" : "mes a mes"} (interés ↓ · capital ↑)
            </p>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={amortizationData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 8 }} interval={Math.max(0, Math.floor(amortizationData.length / 8))} />
                  <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-card border border-border rounded-lg px-2 py-1.5 shadow-lg text-[9px] space-y-0.5">
                          <p className="font-bold">{payload[0]?.payload?.mes}</p>
                          <p className="text-red-500">Interés: ${Number(payload[0]?.value ?? 0).toLocaleString()}</p>
                          <p className="text-emerald-500">Capital: ${Number(payload[1]?.value ?? 0).toLocaleString()}</p>
                          <p className="text-muted-foreground">Saldo: ${Number(payload[0]?.payload?.saldo ?? 0).toLocaleString()}</p>
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
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500/70" /> Interés (baja)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/80" /> Capital (sube)</span>
            </div>
            {amortizationData.length > 0 && (
              <p className="text-[9px] text-center text-kiri-emerald font-bold">
                ≈ {frecuenciaPago === "quincenal" ? Math.ceil(amortizationData.length / 2) : amortizationData.length} meses para liquidar
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={!canSubmit || loading} className="w-full h-12 rounded-xl bg-kiri-emerald text-white font-bold">
        {loading ? "Guardando..." : "Registrar deuda"}
      </Button>
    </div>
  )
}
