"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Sparkles, TrendingUp, Wallet, ArrowRight, Plus, Trash2, Repeat, Clock, Zap, Pencil, ChevronDown } from "lucide-react"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { getPeriodData } from "@/lib/period-filter"
import { BudgetAllocation, ExtraIncome, ExtraIncomeTemporality } from "@/lib/types"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useAppContext, IncomeFrequency } from "@/lib/app-context"
import { ReceiptText, PiggyBank, ShieldCheck, Banknote } from "lucide-react"
import { cn } from "@/lib/utils"
import { RegisterPaymentModal } from "@/components/gestion/RegisterPaymentModal"
import { CurrentBudgetDisplay } from "@/components/gestion/CurrentBudgetDisplay"
import { userApi } from "@/lib/api-client"

const TEMPORALITY_OPTIONS: { value: ExtraIncomeTemporality; label: string; icon: React.ReactNode }[] = [
  { value: "una_vez",    label: "Una sola vez",        icon: <Zap className="h-4 w-4" /> },
  { value: "definido",   label: "Tiempo definido",     icon: <Clock className="h-4 w-4" /> },
  { value: "indefinido", label: "Indefinido",           icon: <Repeat className="h-4 w-4" /> },
]

const emptyExtraForm = { nombre: "", monto: "", temporalidad: "una_vez" as ExtraIncomeTemporality, meses: "" }

export default function GestionPage() {
  const [allocation, setAllocation] = useState<BudgetAllocation | null>(null)
  const [libreInvOpen, setLibreInvOpen] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<string>("")
  const [loadingAi, setLoadingAi] = useState(false)
  const { debts, fixedExpenses, extraIncomes, totalExtraIncome, totalImpulseThisPeriod, addExtraIncome, updateExtraIncome, removeExtraIncome } = useFinanceData()
  const { user, formatAmount, income, setIncome, incomeFrequency, setIncomeFrequency } = useAppContext()

  // ── Saldo Real (cashBalance) ───────────────────────────────────────────────
  const [cashBalance, setCashBalance] = useState(0)
  const [isResetting, setIsResetting] = useState(false)

  // Cargar cashBalance desde el backend al montar
  useEffect(() => {
    userApi.getDashboardSummary().then(({ data }) => {
      if (data?.user) {
        setCashBalance(Number((data.user as Record<string, unknown>).cashBalance ?? 0))
      }
    })
  }, [])

  const handleBalanceRegistered = (newBalance: number) => {
    setCashBalance(newBalance)
  }

  const handleResetBalance = async () => {
    setIsResetting(true)
    const { data } = await userApi.updateBalance(0, "reset")
    if (data) setCashBalance(data.cashBalance)
    setIsResetting(false)
  }

  // Extra income modal
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false)
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null)
  const [extraForm, setExtraForm] = useState(emptyExtraForm)
  const [savingExtra, setSavingExtra] = useState(false)

  // ── Ingreso efectivo para distribución — usa cashBalance si existe, sino ingreso configurado ──
  const ingresoEfectivo = cashBalance > 0 ? cashBalance : income
  const totalIncome = ingresoEfectivo + (cashBalance > 0 ? 0 : totalExtraIncome)
  const { effectiveIncome, totalObligations: totalRequired } =
    getPeriodData(cashBalance > 0 ? cashBalance : income, cashBalance > 0 ? 0 : totalExtraIncome, debts, fixedExpenses, incomeFrequency)

  useEffect(() => {
    if (effectiveIncome > 0) {
      setAllocation(calculateBudgetAllocation(effectiveIncome, totalRequired))
    } else {
      setAllocation(null)
    }
  }, [effectiveIncome, totalRequired])

  const handleGetAiInsight = async () => {
    if (!allocation) return
    setLoadingAi(true)
    setAiExplanation("") // Limpia para mostrar skeleton
    try {
      const body = {
        ingresoTotal:            effectiveIncome,
        pctObligacionesOriginal: 50,
        pctLibreOriginal:        30,
        pctAhorroOriginal:       20,
        pctObligacionesAjustado: Math.round(allocation.obligationsPct),
        pctLibreAjustado:        Math.round(allocation.freeInvestmentPct),
        pctAhorroAjustado:       Math.round(allocation.savingsPct),
        totalObligaciones:       totalRequired,
        detalleDeudas:      debts.map(d => ({
          nombre:           d.nombre,
          monto:            d.cuotaPeriodo,
          fechaVencimiento: d.fechaVencimiento,
        })),
        detalleGastosFijos: fixedExpenses.map(f => ({
          nombre:     f.nombre,
          monto:      f.monto,
          fechaCorte: f.fechaCorte,
        })),
        contextoMetasFinancieras: [
          allocation.isOverloaded ? 'Estado: SOBRECARGADO - obligaciones superan ingreso.' : '',
          allocation.isTight ? 'Estado: AJUSTADO - poco margen para imprevistos.' : '',
          totalImpulseThisPeriod > 0 ? `Gastos hormiga este periodo: $${totalImpulseThisPeriod} de $${Math.round(allocation.dailyFreeAmount)} disponibles.` : '',
          totalImpulseThisPeriod > allocation.dailyFreeAmount ? '⚠ ALERTA: Gastos hormiga exceden presupuesto blindado.' : '',
        ].filter(Boolean).join(' ') || undefined,
      }

      const res = await fetch('/api/ai/budget-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAiExplanation(data.explicacion ?? data.error ?? 'Sin respuesta.')
    } catch (error) {
      console.error('[AI insight]', error)
      setAiExplanation('No se pudo conectar con el análisis de IA. Intenta de nuevo.')
    } finally {
      setLoadingAi(false)
    }
  }

  const openAddExtra = () => {
    setEditingExtraId(null)
    setExtraForm(emptyExtraForm)
    setIsExtraModalOpen(true)
  }

  const openEditExtra = (e: ExtraIncome) => {
    setEditingExtraId(e.id)
    setExtraForm({
      nombre: e.nombre,
      monto: String(e.monto),
      temporalidad: e.temporalidad,
      meses: String(e.mesesRestantes ?? ""),
    })
    setIsExtraModalOpen(true)
  }

  const handleSaveExtra = async () => {
    if (!extraForm.nombre || !extraForm.monto) return
    setSavingExtra(true)
    const data = {
      nombre: extraForm.nombre,
      monto: Number(extraForm.monto),
      temporalidad: extraForm.temporalidad,
      mesesRestantes: extraForm.temporalidad === "definido" ? Number(extraForm.meses) || null : null,
    }
    if (editingExtraId) {
      await updateExtraIncome(editingExtraId, data)
    } else {
      await addExtraIncome(data)
    }
    setSavingExtra(false)
    setIsExtraModalOpen(false)
  }

  const temporalityBadge = (t: ExtraIncomeTemporality, meses: number | null) => {
    if (t === "una_vez") return { label: "Una vez", color: "bg-cyclon-pink/20 text-cyclon-pink" }
    if (t === "indefinido") return { label: "Indefinido", color: "bg-cyclon-mint/20 text-cyclon-periwinkle" }
    return { label: `${meses ?? "?"} meses`, color: "bg-cyclon-sky/30 text-cyclon-periwinkle" }
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-cyclon-lavender">Hola, {user.nombre.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm">Gestiona tus ingresos de este periodo.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CurrentBudgetDisplay
            cashBalance={cashBalance}
            formatAmount={formatAmount}
            onReset={handleResetBalance}
            isResetting={isResetting}
          />
          <RegisterPaymentModal onSuccess={handleBalanceRegistered} />
        </div>
      </header>

      {/* ── Ingreso Fijo ── */}
      <Card className="border-none shadow-sm bg-card overflow-hidden">
        <CardHeader className="bg-cyclon-lavender/5 pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4 text-cyclon-lavender" />
            Ingreso Fijo
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 px-5 pb-5 space-y-4">
          {/* Toggle frecuencia */}
          <div className="grid grid-cols-2 gap-2">
            {(["quincenal", "mensual"] as IncomeFrequency[]).map(f => (
              <button
                key={f}
                onClick={() => setIncomeFrequency(f)}
                className={cn(
                  "h-9 rounded-xl text-sm font-bold border-2 transition-colors capitalize",
                  incomeFrequency === f
                    ? "bg-cyclon-lavender text-white border-cyclon-lavender"
                    : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Input sueldo base */}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Sueldo base {incomeFrequency === "quincenal" ? "mensual" : "mensual"}
            </Label>
            <MoneyInput
              value={String(income || "")}
              onChange={v => setIncome(Number(v))}
              className="h-16 text-3xl font-bold bg-muted/30 border-none rounded-2xl focus-visible:ring-cyclon-lavender"
              placeholder="0"
            />
          </div>

          {/* Split visual para quincenal */}
          {incomeFrequency === "quincenal" && income > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2].map(q => (
                <div key={q} className="bg-cyclon-lavender/5 rounded-2xl p-3 text-center border border-cyclon-lavender/15">
                  <p className="text-[10px] text-muted-foreground font-medium">Quincena {q}</p>
                  <p className="text-lg font-black text-cyclon-lavender mt-0.5">
                    {formatAmount(Math.round(income / 2))}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {q === 1 ? "1–15 del mes" : "16–fin del mes"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ingresos Extra ── */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Ingresos Extra</h2>
          <Button size="sm" onClick={openAddExtra} className="h-8 rounded-xl bg-cyclon-lavender/10 text-cyclon-lavender hover:bg-cyclon-lavender/20 border-none font-bold gap-1 px-3">
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>

        {extraIncomes.length === 0 ? (
          <button
            onClick={openAddExtra}
            className="w-full border-2 border-dashed border-muted rounded-2xl p-4 text-sm text-muted-foreground hover:border-cyclon-lavender/40 hover:text-cyclon-lavender transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" /> Agregar ingreso extra (freelance, bono, etc.)
          </button>
        ) : (
          <div className="space-y-2">
            {extraIncomes.map(e => {
              const badge = temporalityBadge(e.temporalidad, e.mesesRestantes)
              return (
                <Card key={e.id} className="border-none shadow-sm bg-card">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{e.nombre}</span>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", badge.color)}>
                          {badge.label}
                        </span>
                      </div>
                      <span className="text-lg font-black text-cyclon-lavender">{formatAmount(e.monto)}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditExtra(e)} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-cyclon-lavender hover:bg-cyclon-lavender/10 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeExtraIncome(e.id)} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {totalExtraIncome > 0 && (
          <Card className="border-none bg-cyclon-lavender/5 rounded-2xl">
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Ingreso fijo</p>
                <p className="font-bold">{formatAmount(income)}</p>
              </div>
              <div className="text-muted-foreground text-lg font-black">+</div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Ingresos extra</p>
                <p className="font-bold text-cyclon-lavender">{formatAmount(totalExtraIncome)}</p>
              </div>
              <div className="text-muted-foreground text-lg font-black">=</div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium">Total</p>
                <p className="font-black text-lg text-cyclon-lavender">{formatAmount(totalIncome)}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Distribución Inteligente ── */}
      {allocation && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyclon-periwinkle" />
              Distribución Inteligente
            </h2>
            <div className="flex items-center gap-2">
              {cashBalance > 0 && (
                <span className="text-[10px] font-bold bg-cyclon-lavender/20 text-cyclon-lavender px-2 py-1 rounded-full">
                  Basado en saldo real
                </span>
              )}
              {allocation.isTight && !allocation.isOverloaded && !cashBalance && (
                <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Presupuesto ajustado</span>
              )}
            </div>
          </div>

          {allocation.isOverloaded && (
            <Card className="border-none bg-destructive/10 rounded-2xl">
              <CardContent className="p-4 flex gap-3 items-start">
                <div className="h-8 w-8 bg-destructive/20 rounded-xl flex items-center justify-center shrink-0 text-destructive">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-destructive text-sm">Tus obligaciones superan tu ingreso</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Revisa tus deudas y gastos fijos.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3">
            <AllocationBlock
              label="Deudas y Gastos Fijos"
              sublabel="Obligaciones ineludibles"
              pct={allocation.obligationsPct}
              amount={allocation.obligationsAmount}
              color="bg-cyclon-periwinkle"
              barColor="bg-cyclon-periwinkle"
              icon={<ReceiptText className="h-4 w-4" />}
              alert={allocation.isTight}
            />
            <AllocationBlock
              label="Ahorro"
              sublabel="Págate a ti mismo primero"
              pct={allocation.savingsPct}
              amount={allocation.savingsAmount}
              color="bg-cyclon-mint"
              barColor="bg-cyclon-mint"
              icon={<PiggyBank className="h-4 w-4" />}
            />

            {/* Bloque 3: Libre Inversión — Acordeón */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="p-4 space-y-0">
                {/* Cabecera clicable del acordeón */}
                <button
                  onClick={() => setLibreInvOpen(v => !v)}
                  className="w-full flex items-center gap-3 group"
                  aria-expanded={libreInvOpen}
                >
                  <div className="h-10 w-10 rounded-xl bg-cyclon-sky flex items-center justify-center text-white shrink-0 shadow-sm">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">Libre Inversión</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{formatAmount(allocation.freeInvestmentAmount)}</span>
                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-300",
                          libreInvOpen && "rotate-180"
                        )} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <Progress value={allocation.freeInvestmentPct} className="h-1.5 flex-1" indicatorClassName="bg-cyclon-sky" />
                      <span className="text-[10px] font-bold text-muted-foreground w-8">{Math.round(allocation.freeInvestmentPct)}%</span>
                    </div>
                    {!libreInvOpen && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Toca para ver Gastos Libres y Capacidad de Endeudamiento
                      </p>
                    )}
                  </div>
                </button>

                {/* Contenido expandible */}
                <div className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  libreInvOpen ? "max-h-96 opacity-100 pt-3" : "max-h-0 opacity-0"
                )}>
                  <div className="border-t border-dashed border-border mx-1 mb-3" />

                  {/* Gastos Libres */}
                  <div className="flex items-center gap-3 pl-2 mb-3">
                    <div className="h-8 w-8 rounded-xl bg-cyclon-mint/20 flex items-center justify-center text-cyclon-periwinkle shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xs font-bold">Gastos Libres</span>
                          <span className="ml-1.5 text-[9px] font-bold bg-cyclon-mint/30 text-cyclon-periwinkle px-1.5 py-0.5 rounded-full">BLINDADO</span>
                        </div>
                        <span className="text-xs font-bold">{formatAmount(allocation.dailyFreeAmount)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Comida, transporte, día a día</p>
                      <Progress value={allocation.dailyFreePct} className="h-1 mt-1" indicatorClassName="bg-cyclon-mint" />
                    </div>
                  </div>

                  {/* Capacidad de Endeudamiento */}
                  <div className="flex items-center gap-3 pl-2">
                    <div className="h-8 w-8 rounded-xl bg-cyclon-lavender/10 flex items-center justify-center text-cyclon-lavender shrink-0">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold">Capacidad de Endeudamiento</span>
                        <span className="text-xs font-bold">{formatAmount(allocation.debtCapacityAmount)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Margen real para nuevas obligaciones</p>
                      <Progress value={allocation.debtCapacityPct} className="h-1 mt-1" indicatorClassName="bg-cyclon-lavender" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none bg-gradient-to-br from-cyclon-lavender/5 to-cyclon-pink/5 p-0 rounded-2xl overflow-hidden">
            <CardContent className="p-5 space-y-3">
              {/* Header */}
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-cyclon-lavender flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Kiri Insight
                </h3>
                <Button
                  onClick={handleGetAiInsight}
                  disabled={loadingAi}
                  size="sm"
                  className="bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white rounded-full px-4 shrink-0 shadow-lg shadow-cyclon-lavender/20 text-xs font-bold gap-1.5"
                >
                  {loadingAi ? (
                    <>
                      <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Analizando
                    </>
                  ) : aiExplanation ? "Actualizar" : "Analizar con IA"}
                </Button>
              </div>

              {/* Skeleton Loader */}
              {loadingAi && (
                <div className="space-y-2.5 animate-pulse">
                  <div className="h-3 bg-cyclon-lavender/10 rounded-full w-full" />
                  <div className="h-3 bg-cyclon-lavender/10 rounded-full w-[90%]" />
                  <div className="h-3 bg-cyclon-lavender/10 rounded-full w-[75%]" />
                  <div className="h-3 bg-cyclon-lavender/10 rounded-full w-[60%]" />
                </div>
              )}

              {/* Resultado de la IA */}
              {!loadingAi && aiExplanation && (
                <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-cyclon-lavender/10">
                  <p className="text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap">
                    {aiExplanation}
                  </p>
                </div>
              )}

              {/* Estado vacío */}
              {!loadingAi && !aiExplanation && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Analiza tu distribución actual con inteligencia artificial. Kiri te explicará por qué se ajustó tu presupuesto y qué puedes hacer para mejorar.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Modal Ingreso Extra (Add / Edit) ── */}
      <Dialog open={isExtraModalOpen} onOpenChange={v => !v && setIsExtraModalOpen(false)}>
        <DialogContent >
          <DialogHeader>
            <DialogTitle>{editingExtraId ? "Editar Ingreso Extra" : "Agregar Ingreso Extra"}</DialogTitle>
            <DialogDescription>Freelance, bono, venta, etc.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input placeholder="Ej: Proyecto freelance" value={extraForm.nombre} onChange={e => setExtraForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <MoneyInput
                value={extraForm.monto}
                onChange={v => setExtraForm(f => ({ ...f, monto: v }))}
                className="h-12 text-xl font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>¿Con qué frecuencia lo recibes?</Label>
              <div className="grid grid-cols-3 gap-2">
                {TEMPORALITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setExtraForm(f => ({ ...f, temporalidad: opt.value }))}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-colors text-center",
                      extraForm.temporalidad === opt.value
                        ? "border-cyclon-lavender bg-cyclon-lavender/5 text-cyclon-lavender"
                        : "border-muted text-muted-foreground hover:border-cyclon-lavender/30"
                    )}
                  >
                    {opt.icon}
                    <span className="text-[10px] font-bold leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {extraForm.temporalidad === "definido" && (
              <div className="space-y-2">
                <Label>¿Por cuántos meses?</Label>
                <Input type="number" placeholder="Ej: 3" value={extraForm.meses} onChange={e => setExtraForm(f => ({ ...f, meses: e.target.value }))} className="h-11 rounded-xl" />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsExtraModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveExtra}
              disabled={savingExtra || !extraForm.nombre || !extraForm.monto || (extraForm.temporalidad === "definido" && !extraForm.meses)}
              className="bg-cyclon-lavender text-white font-bold rounded-xl px-8"
            >
              {savingExtra ? "Guardando..." : editingExtraId ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AllocationBlock({ label, sublabel, pct, amount, color, barColor, icon, alert }: {
  label: string; sublabel: string; pct: number; amount: number
  color: string; barColor: string; icon: React.ReactNode; alert?: boolean
}) {
  const { formatAmount } = useAppContext()
  return (
    <Card className={cn("border-none shadow-sm overflow-hidden bg-card", alert && "ring-1 ring-yellow-400/50")}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm", color)}>
          {icon}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm font-bold">{label}</span>
              <p className="text-[10px] text-muted-foreground">{sublabel}</p>
            </div>
            <span className="text-sm font-bold">{formatAmount(amount)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={Math.min(pct, 100)} className="h-1.5 flex-1" indicatorClassName={barColor} />
            <span className="text-[10px] font-bold text-muted-foreground w-8">{Math.round(pct)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
