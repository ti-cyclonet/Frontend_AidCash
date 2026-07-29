"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Building2, Search, Plus, CheckCircle2, Loader2, Percent, Info, CreditCard, Landmark,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DebtRegistrationForm — Formulario de registro de deuda
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Dos modos:
 *   1. "normal" — Deuda simple: nombre, monto total, cuota, día de pago
 *   2. "banco"  — Deuda bancaria: búsqueda de banco, tasa de interés,
 *                  monto inicial (opcional), saldo actual (opcional)
 */

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
}

interface Props {
  onSubmit: (data: DebtFormData) => void | Promise<void>
  loading?: boolean
}

type DebtMode = "normal" | "banco"

export function DebtRegistrationForm({ onSubmit, loading }: Props) {
  const [mode, setMode] = useState<DebtMode | null>(null)

  // Shared fields
  const [nombre, setNombre] = useState("")
  const [montoTotal, setMontoTotal] = useState("")
  const [cuotaPeriodo, setCuotaPeriodo] = useState("")
  const [diasPago, setDiasPago] = useState("")
  const [frecuenciaPago, setFrecuenciaPago] = useState<"mensual" | "quincenal">("mensual")
  const [yaPagando, setYaPagando] = useState(false)
  const [saldoActualNormal, setSaldoActualNormal] = useState("")

  // Banco mode fields
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

  // Cargar bancos al entrar en modo banco
  useEffect(() => {
    if (mode === "banco") {
      api<{ banks: BankOption[] }>('/banks').then(({ data }) => {
        if (data) setBanks(data.banks)
      })
    }
  }, [mode])

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

  // Submit
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
      })
    }
  }

  const canSubmit = mode === "normal"
    ? !!nombre && !!montoTotal && !!cuotaPeriodo && !!diasPago
    : !!nombre && (!!montoTotal || !!montoInicial) && !!cuotaPeriodo && !!diasPago

  // ── Si no se ha seleccionado modo, ir directo a normal (banco desactivado temporalmente) ──
  if (!mode) {
    // Auto-seleccionar modo normal
    setMode("normal")
    return null
  }

  // ── Formulario según modo ──
  return (
    <div className="space-y-4">
      {/* Nombre */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Nombre de la deuda</Label>
        <Input
          placeholder="Ej: Préstamo Juan, Cuota moto, Tarjeta Visa..."
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
                          <p className="text-[8px] text-muted-foreground">{bank.tasaInteresPromedio}% mensual{bank.esVerificado && " · ✓"}</p>
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
                      <span className="text-[10px] font-bold text-kiri-emerald">Agregar "{searchQuery}"</span>
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
          <MoneyInput
            value={montoTotal}
            onChange={v => setMontoTotal(v)}
            className="h-11 rounded-xl"
            placeholder="0"
          />
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
          {/* Resumen: lo que llevas pagado */}
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

      {/* Cuota */}
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

      {/* Preview amortización (solo banco con tasa) */}
      {mode === "banco" && Number(tasaInteres) > 0 && Number(cuotaPeriodo) > 0 && (Number(saldoActual) > 0 || Number(montoTotal) > 0) && (
        <Card className="border-none bg-muted/20 rounded-xl">
          <CardContent className="p-3 space-y-1">
            <p className="text-[8px] font-bold text-muted-foreground uppercase">Preview primera cuota</p>
            {(() => {
              const saldo = Number(saldoActual) || Number(montoInicial) || Number(montoTotal)
              const tasa = Number(tasaInteres) / 100
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

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={!canSubmit || loading} className="w-full h-12 rounded-xl bg-kiri-emerald text-white font-bold">
        {loading ? "Guardando..." : "Registrar deuda"}
      </Button>
    </div>
  )
}
