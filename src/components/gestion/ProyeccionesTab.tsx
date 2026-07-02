"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Sparkles, TrendingUp, Wallet, Plus, Trash2, Repeat, Clock, Zap, Pencil, ReceiptText, PiggyBank, ShieldCheck, Banknote } from "lucide-react"
import { ExtraIncome, ExtraIncomeTemporality } from "@/lib/types"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useAppContext, IncomeFrequency } from "@/lib/app-context"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { cn } from "@/lib/utils"

const TEMPORALITY_OPTIONS: { value: ExtraIncomeTemporality; label: string; icon: React.ReactNode }[] = [
  { value: "una_vez", label: "Una sola vez", icon: <Zap className="h-4 w-4" /> },
  { value: "definido", label: "Tiempo definido", icon: <Clock className="h-4 w-4" /> },
  { value: "indefinido", label: "Indefinido", icon: <Repeat className="h-4 w-4" /> },
]
const emptyExtraForm = { nombre: "", monto: "", temporalidad: "una_vez" as ExtraIncomeTemporality, meses: "" }

export function ProyeccionesTab() {
  const [aiExplanation, setAiExplanation] = useState("")
  const [loadingAi, setLoadingAi] = useState(false)
  const { debts, fixedExpenses, extraIncomes, totalExtraIncome, totalImpulseThisPeriod, addExtraIncome, updateExtraIncome, removeExtraIncome } = useFinanceData()
  const { formatAmount, income, setIncome, incomeFrequency, setIncomeFrequency } = useAppContext()
  const { allocation, periodData } = usePeriodBudget()

  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false)
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null)
  const [extraForm, setExtraForm] = useState(emptyExtraForm)
  const [savingExtra, setSavingExtra] = useState(false)

  // ═══ Distribución DINÁMICA: viene del hook usePeriodBudget ═══
  // allocation ya refleja el periodo actual y se recalcula al pagar obligaciones.
  // effectiveIncome y totalObligations son los del periodo (no totales mensuales).

  // ═══ PRESENTACIÓN: toggle de frecuencia ya está incorporado en el cálculo ═══
  // El ingreso mostrado es el efectivo del periodo (ya dividido si es quincenal).
  const displayIncome = periodData.effectiveIncome

  const handleGetAiInsight = async () => {
    if (!allocation) return
    setLoadingAi(true); setAiExplanation("")
    try {
      const res = await fetch('/api/ai/budget-insight', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingresoTotal: periodData.effectiveIncome, pctObligacionesOriginal: 50, pctLibreOriginal: 30, pctAhorroOriginal: 20,
          pctObligacionesAjustado: Math.round(allocation.obligationsPct),
          pctLibreAjustado: Math.round(allocation.freeInvestmentPct),
          pctAhorroAjustado: Math.round(allocation.savingsPct),
          totalObligaciones: periodData.totalObligations,
          detalleDeudas: debts.map(d => ({ nombre: d.nombre, monto: d.cuotaPeriodo, diasPago: d.diasPago ?? '1' })),
          detalleGastosFijos: fixedExpenses.map(f => ({ nombre: f.nombre, monto: f.monto, fechaCorte: f.fechaCorte })),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAiExplanation(data.explicacion ?? data.error ?? 'Sin respuesta.')
    } catch { setAiExplanation('No se pudo conectar con la IA.') }
    finally { setLoadingAi(false) }
  }

  const openAddExtra = () => { setEditingExtraId(null); setExtraForm(emptyExtraForm); setIsExtraModalOpen(true) }
  const openEditExtra = (e: ExtraIncome) => { setEditingExtraId(e.id); setExtraForm({ nombre: e.nombre, monto: String(e.monto), temporalidad: e.temporalidad, meses: String(e.mesesRestantes ?? "") }); setIsExtraModalOpen(true) }
  const handleSaveExtra = async () => {
    if (!extraForm.nombre || !extraForm.monto) return
    setSavingExtra(true)
    const data = { nombre: extraForm.nombre, monto: Number(extraForm.monto), temporalidad: extraForm.temporalidad, mesesRestantes: extraForm.temporalidad === "definido" ? Number(extraForm.meses) || null : null }
    if (editingExtraId) await updateExtraIncome(editingExtraId, data)
    else await addExtraIncome(data)
    setSavingExtra(false); setIsExtraModalOpen(false)
  }
  const temporalityBadge = (t: ExtraIncomeTemporality, meses: number | null) => {
    if (t === "una_vez") return { label: "Una vez", color: "bg-cyclon-pink/20 text-cyclon-pink" }
    if (t === "indefinido") return { label: "Indefinido", color: "bg-cyclon-mint/20 text-cyclon-periwinkle" }
    return { label: `${meses ?? "?"} meses`, color: "bg-cyclon-sky/30 text-cyclon-periwinkle" }
  }

  return (
    <div className="space-y-6">
      {/* Ingreso Fijo Base (destacado arriba de frecuencia) */}
      <Card className="border-none shadow-sm bg-card overflow-hidden">
        <CardHeader className="bg-cyclon-lavender/5 pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4 text-cyclon-lavender" /> Ingreso Fijo Base
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 px-5 pb-5 space-y-4">
          {/* Cuadro destacado con monto por periodo */}
          {income > 0 && (
            <div className="bg-cyclon-lavender/5 border border-cyclon-lavender/20 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Tu ingreso fijo por periodo</p>
              <p className="text-3xl font-black text-cyclon-lavender mt-1">{formatAmount(displayIncome)}</p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {incomeFrequency === "quincenal" ? "Quincenal (de $" + formatAmount(income) + " al mes)" : "Mensual"}
              </p>
            </div>
          )}
          {/* Toggle frecuencia */}
          <div className="grid grid-cols-2 gap-2">
            {(["quincenal", "mensual"] as IncomeFrequency[]).map(f => (
              <button key={f} onClick={() => setIncomeFrequency(f)} className={cn(
                "h-9 rounded-xl text-sm font-bold border-2 transition-colors capitalize",
                incomeFrequency === f ? "bg-cyclon-lavender text-white border-cyclon-lavender" : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
              )}>{f}</button>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Sueldo base mensual (total del mes)
            </Label>
            <MoneyInput value={String(income || "")} onChange={v => setIncome(Number(v))} className="h-16 text-3xl font-bold bg-muted/30 border-none rounded-2xl" placeholder="0" />
          </div>
        </CardContent>
      </Card>

      {/* Ingresos Extra */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Ingresos Extra</h2>
          <Button size="sm" onClick={openAddExtra} className="h-8 rounded-xl bg-cyclon-lavender/10 text-cyclon-lavender hover:bg-cyclon-lavender/20 border-none font-bold gap-1 px-3">
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
        {extraIncomes.length === 0 ? (
          <button onClick={openAddExtra} className="w-full border-2 border-dashed border-muted rounded-2xl p-4 text-sm text-muted-foreground hover:border-cyclon-lavender/40 hover:text-cyclon-lavender transition-colors flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> Agregar ingreso extra
          </button>
        ) : (
          <div className="space-y-2">
            {extraIncomes.map(e => { const badge = temporalityBadge(e.temporalidad, e.mesesRestantes); return (
              <Card key={e.id} className="border-none shadow-sm bg-card"><CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-bold text-sm truncate">{e.nombre}</span><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", badge.color)}>{badge.label}</span></div>
                  <span className="text-lg font-black text-cyclon-lavender">{formatAmount(e.monto)}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEditExtra(e)} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-cyclon-lavender"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => removeExtraIncome(e.id)} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </CardContent></Card>
            )})}
          </div>
        )}
        {totalExtraIncome > 0 && (
          <Card className="border-none bg-cyclon-lavender/5 rounded-2xl"><CardContent className="p-4 flex justify-between items-center">
            <div><p className="text-xs text-muted-foreground">Fijo</p><p className="font-bold">{formatAmount(income)}</p></div>
            <span className="text-muted-foreground text-lg font-black">+</span>
            <div><p className="text-xs text-muted-foreground">Extra</p><p className="font-bold text-cyclon-lavender">{formatAmount(totalExtraIncome)}</p></div>
            <span className="text-muted-foreground text-lg font-black">=</span>
            <div className="text-right"><p className="text-xs text-muted-foreground">Total periodo</p><p className="font-black text-lg text-cyclon-lavender">{formatAmount(periodData.effectiveIncome)}</p></div>
          </CardContent></Card>
        )}
      </div>

      {/* Distribución Inteligente */}
      {allocation && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-cyclon-periwinkle" /> Distribución Inteligente</h2>
          {allocation.isOverloaded && (
            <Card className="border-none bg-destructive/10 rounded-2xl"><CardContent className="p-4 flex gap-3 items-start">
              <div className="h-8 w-8 bg-destructive/20 rounded-xl flex items-center justify-center shrink-0 text-destructive"><ReceiptText className="h-4 w-4" /></div>
              <div><p className="font-bold text-destructive text-sm">Tus obligaciones superan tu ingreso</p><p className="text-xs text-muted-foreground mt-0.5">Revisa tus deudas y gastos fijos.</p></div>
            </CardContent></Card>
          )}
          <div className="grid gap-3">
            <AllocBlock label="Obligaciones" sublabel="Deudas + Gastos Fijos" pct={allocation.obligationsPct} amount={Math.round(allocation.obligationsAmount)} color="bg-cyclon-periwinkle" icon={<ReceiptText className="h-4 w-4" />} alert={allocation.isTight} formatAmount={formatAmount} />
            <AllocBlock label="Ahorro" sublabel="Págate a ti mismo" pct={allocation.savingsPct} amount={Math.round(allocation.savingsAmount)} color="bg-cyclon-mint" icon={<PiggyBank className="h-4 w-4" />} formatAmount={formatAmount} />
            <AllocBlock label="Gastos Libres" sublabel="Blindado — día a día" pct={allocation.dailyFreePct} amount={Math.round(allocation.dailyFreeAmount)} color="bg-cyclon-sky" icon={<ShieldCheck className="h-4 w-4" />} formatAmount={formatAmount} />
            <AllocBlock label="Endeudamiento" sublabel="Capacidad para nuevas deudas" pct={allocation.debtCapacityPct} amount={Math.round(allocation.debtCapacityAmount)} color="bg-cyclon-lavender" icon={<Banknote className="h-4 w-4" />} formatAmount={formatAmount} />
          </div>
          {/* AI Insight */}
          <Card className="border-none bg-gradient-to-br from-cyclon-lavender/5 to-cyclon-pink/5 rounded-2xl"><CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-cyclon-lavender flex items-center gap-2"><Sparkles className="h-4 w-4" /> Kiri Insight</h3>
              <Button onClick={handleGetAiInsight} disabled={loadingAi} size="sm" className="bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white rounded-full px-4 text-xs font-bold gap-1.5">
                {loadingAi ? <><div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />Analizando</> : aiExplanation ? "Actualizar" : "Analizar con IA"}
              </Button>
            </div>
            {loadingAi && <div className="space-y-2 animate-pulse"><div className="h-3 bg-cyclon-lavender/10 rounded-full w-full" /><div className="h-3 bg-cyclon-lavender/10 rounded-full w-[80%]" /><div className="h-3 bg-cyclon-lavender/10 rounded-full w-[60%]" /></div>}
            {!loadingAi && aiExplanation && <div className="bg-card/50 rounded-xl p-4 border border-cyclon-lavender/10"><p className="text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap">{aiExplanation}</p></div>}
            {!loadingAi && !aiExplanation && <p className="text-xs text-muted-foreground">Analiza tu distribución con IA.</p>}
          </CardContent></Card>
        </div>
      )}

      {/* Modal Extra Income */}
      <Dialog open={isExtraModalOpen} onOpenChange={v => !v && setIsExtraModalOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingExtraId ? "Editar Ingreso Extra" : "Agregar Ingreso Extra"}</DialogTitle><DialogDescription>Freelance, bono, venta, etc.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Descripción</Label><Input placeholder="Ej: Proyecto freelance" value={extraForm.nombre} onChange={e => setExtraForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Monto</Label><MoneyInput value={extraForm.monto} onChange={v => setExtraForm(f => ({ ...f, monto: v }))} className="h-12 text-xl font-bold" placeholder="0" /></div>
            <div className="space-y-2"><Label>Frecuencia</Label>
              <div className="grid grid-cols-3 gap-2">
                {TEMPORALITY_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setExtraForm(f => ({ ...f, temporalidad: opt.value }))} className={cn("flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-colors text-center", extraForm.temporalidad === opt.value ? "border-cyclon-lavender bg-cyclon-lavender/5 text-cyclon-lavender" : "border-muted text-muted-foreground")}>
                    {opt.icon}<span className="text-[10px] font-bold leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {extraForm.temporalidad === "definido" && (<div className="space-y-2"><Label>¿Cuántos meses?</Label><Input type="number" placeholder="3" value={extraForm.meses} onChange={e => setExtraForm(f => ({ ...f, meses: e.target.value }))} /></div>)}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsExtraModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveExtra} disabled={savingExtra || !extraForm.nombre || !extraForm.monto} className="bg-cyclon-lavender text-white font-bold rounded-xl px-8">{savingExtra ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Bloque de distribución reutilizable
function AllocBlock({ label, sublabel, pct, amount, color, icon, alert, formatAmount }: {
  label: string; sublabel: string; pct: number; amount: number; color: string; icon: React.ReactNode; alert?: boolean; formatAmount: (n: number) => string
}) {
  return (
    <Card className={cn("border-none shadow-sm bg-card", alert && "ring-1 ring-yellow-400/50")}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0", color)}>{icon}</div>
        <div className="flex-1 space-y-1">
          <div className="flex justify-between items-center">
            <div><span className="text-sm font-bold">{label}</span><p className="text-[10px] text-muted-foreground">{sublabel}</p></div>
            <span className="text-sm font-bold">{formatAmount(amount)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={Math.min(pct, 100)} className="h-1.5 flex-1" indicatorClassName={color} />
            <span className="text-[10px] font-bold text-muted-foreground w-8">{Math.round(pct)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
