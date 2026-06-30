"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip as ChartTooltip, Cell,
} from "recharts"
import {
  Calculator, CheckCircle2, XCircle, Star,
  TrendingDown, Banknote, AlertTriangle, CalendarCheck,
  PiggyBank, ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { simulateDebtOptions, DebtSimulationOption, analyzeFinances } from "@/lib/recommendations"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { useAppContext, IncomeFrequency } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { Debt } from "@/lib/types"

interface Props {
  debtCapacity: number
  incomeFrequency: IncomeFrequency
  forceOpen?: boolean
  onClose?: () => void
}

export function DebtSimulator({ debtCapacity, incomeFrequency, forceOpen, onClose }: Props) {
  const { formatAmount, income } = useAppContext()
  const { debts, fixedExpenses, extraIncomes, addDebt } = useFinanceData()

  const [open, setOpen] = useState(false)
  const isOpen = forceOpen ?? open
  const [productName, setProductName] = useState("")
  const [amount, setAmount] = useState("")
  const [options, setOptions] = useState<DebtSimulationOption[] | null>(null)
  const [canAffordAny, setCanAffordAny] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [accepting, setAccepting] = useState(false)

  const totalExtraIncome = extraIncomes.reduce((acc, e) => acc + e.monto, 0)
  const totalIncome = income + totalExtraIncome
  const totalObligations = debts.reduce((acc, d) => acc + d.cuotaPeriodo, 0) +
                           fixedExpenses.reduce((acc, f) => acc + f.monto, 0)

  const handleSimulate = () => {
    if (!amount || Number(amount) <= 0) return
    const result = simulateDebtOptions(Number(amount), debtCapacity, incomeFrequency)
    setOptions(result.options)
    setCanAffordAny(result.canAffordAny)
    setSelected(null)
  }

  const handleClose = () => {
    setOpen(false)
    onClose?.()
    setProductName("")
    setAmount("")
    setOptions(null)
    setSelected(null)
  }

  // ── Escenario "what-if": calcula el impacto de la opción seleccionada ────
  const scenarioData = useMemo(() => {
    if (selected === null || !options || !options[selected]) return null
    const opt = options[selected]
    if (!opt.canAfford) return null

    // Estado actual
    const currentAllocation = calculateBudgetAllocation(totalIncome, totalObligations)

    // Estado futuro (si se agrega la nueva cuota como obligación)
    const futureObligations = totalObligations + opt.quota
    const futureAllocation = calculateBudgetAllocation(totalIncome, futureObligations)

    // Fecha de libertad financiera actual vs futura
    const currentDebts = debts.filter(d => d.estado === 'activa' && d.cuotaPeriodo > 0)
    const futureDebts: Debt[] = [
      ...currentDebts,
      {
        id: '__scenario__',
        userId: '',
        nombre: productName || 'Nueva compra',
        montoTotal: Number(amount),
        saldoRestante: Number(amount),
        cuotaPeriodo: opt.quota,
        tasaInteres: null,
        acreedor: '',
        frecuenciaPago: 'mensual',
        diasPago: '1',
        pagadoEstePeriodo: false,
        estado: 'activa',
        prioridad: 'media',
      },
    ]

    const currentStrategies = currentDebts.length > 0
      ? analyzeFinances(currentAllocation, currentDebts, incomeFrequency).strategies
      : null

    const futureStrategies = futureDebts.length > 0
      ? analyzeFinances(futureAllocation, futureDebts, incomeFrequency).strategies
      : null

    return {
      currentAllocation,
      futureAllocation,
      currentFreedomMonths: currentStrategies?.snowball.mesesTotal ?? 0,
      futureFreedomMonths: futureStrategies?.snowball.mesesTotal ?? 0,
      currentFreedomDate: currentStrategies?.snowball.fechaLibre ?? 'Ahora',
      futureFreedomDate: futureStrategies?.snowball.fechaLibre ?? '—',
      delayMonths: (futureStrategies?.snowball.mesesTotal ?? 0) - (currentStrategies?.snowball.mesesTotal ?? 0),
      option: opt,
    }
  }, [selected, options, totalIncome, totalObligations, debts, amount, productName, incomeFrequency])

  // ── Aceptar escenario: convierte la simulación en deuda real ──────────────
  const handleAccept = async () => {
    if (!scenarioData || selected === null || !options) return
    const opt = options[selected]
    setAccepting(true)
    await addDebt({
      nombre: productName || 'Nueva compra',
      montoTotal: Number(amount),
      cuotaPeriodo: opt.quota,
      diasPago: new Date(
        Date.now() + opt.months * 30 * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0],
    })
    setAccepting(false)
    handleClose()
  }

  const periodLabel = incomeFrequency === 'quincenal' ? 'quincena' : 'mes'

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full text-left">
        <Card className="border-2 border-dashed border-cyclon-lavender/30 bg-cyclon-lavender/5 rounded-3xl hover:border-cyclon-lavender/60 hover:bg-cyclon-lavender/10 transition-colors">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 bg-cyclon-lavender/20 rounded-2xl flex items-center justify-center text-cyclon-lavender shrink-0">
              <Calculator className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-cyclon-lavender">Simulador de Escenarios</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ¿Qué pasa si me compro X? Visualiza el impacto antes de decidir.
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground font-medium">Capacidad</p>
              <p className={cn("font-black text-sm", debtCapacity > 0 ? "text-cyclon-lavender" : "text-destructive")}>
                {formatAmount(debtCapacity)}
              </p>
            </div>
          </CardContent>
        </Card>
      </button>

      <Dialog open={isOpen} onOpenChange={v => !v && handleClose()}>
        <DialogContent >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-cyclon-lavender" />
              Simulador de Escenarios
            </DialogTitle>
            <DialogDescription>
              Visualiza cómo una nueva compra afecta tu presupuesto antes de comprometerte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* ── Inputs ── */}
            <div className="space-y-1.5">
              <Label>¿Qué quieres comprar?</Label>
              <Input
                placeholder="Ej: Laptop, moto, viaje..."
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label>¿Cuánto cuesta?</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder="0"
                  className="pl-8 h-14 text-2xl font-bold rounded-xl"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setOptions(null); setSelected(null) }}
                  autoFocus
                />
              </div>
            </div>

            {/* Capacidad */}
            <Card className="border-none bg-muted/40 rounded-2xl">
              <CardContent className="p-3 flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Capacidad disponible / {periodLabel}</span>
                <span className={cn("font-black text-sm", debtCapacity > 0 ? "text-cyclon-lavender" : "text-destructive")}>
                  {formatAmount(debtCapacity)}
                </span>
              </CardContent>
            </Card>

            <Button
              onClick={handleSimulate}
              disabled={!amount || Number(amount) <= 0}
              className="w-full h-12 rounded-2xl bg-cyclon-lavender text-white font-bold hover:bg-cyclon-lavender/90"
            >
              Simular escenario
            </Button>

            {/* ── Sin capacidad ── */}
            {options !== null && !canAffordAny && (
              <Card className="border border-destructive/20 bg-destructive/10 rounded-2xl shadow-none">
                <CardContent className="p-4 flex gap-3 items-start">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-destructive">Sin capacidad disponible</p>
                    <p className="text-xs text-muted-foreground">
                      No tienes margen de endeudamiento. Liquida deudas o aumenta ingresos primero.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Opciones de cuota ── */}
            {options && canAffordAny && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Elige tu plan de pago
                </p>
                {options.map((opt, i) => (
                  <OptionCard
                    key={i}
                    option={opt}
                    isSelected={selected === i}
                    onSelect={() => setSelected(i === selected ? null : i)}
                    formatAmount={formatAmount}
                    periodLabel={periodLabel}
                  />
                ))}
              </div>
            )}

            {/* ── Panel de impacto (solo cuando hay opción seleccionada) ── */}
            {scenarioData && (
              <ScenarioImpactPanel
                data={scenarioData}
                formatAmount={formatAmount}
                periodLabel={periodLabel}
                productName={productName}
              />
            )}
          </div>

          {/* ── Footer con botón Aceptar ── */}
          {scenarioData && (
            <DialogFooter className="gap-2 pt-3 border-t border-border">
              <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="bg-cyclon-lavender text-white font-bold rounded-xl px-6 gap-2"
              >
                {accepting ? "Guardando..." : "Aceptar escenario"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Panel de impacto visual ──────────────────────────────────────────────────

interface ScenarioImpactData {
  currentAllocation: ReturnType<typeof calculateBudgetAllocation>
  futureAllocation: ReturnType<typeof calculateBudgetAllocation>
  currentFreedomMonths: number
  futureFreedomMonths: number
  currentFreedomDate: string
  futureFreedomDate: string
  delayMonths: number
  option: DebtSimulationOption
}

function ScenarioImpactPanel({ data, formatAmount, periodLabel, productName }: {
  data: ScenarioImpactData
  formatAmount: (n: number) => string
  periodLabel: string
  productName: string
}) {
  const { currentAllocation: curr, futureAllocation: fut } = data

  // Datos para el gráfico de barras comparativo
  const chartData = [
    {
      name: 'Obligaciones',
      actual: Math.round(curr.obligationsPct),
      futuro: Math.round(fut.obligationsPct),
    },
    {
      name: 'Ahorro',
      actual: Math.round(curr.savingsPct),
      futuro: Math.round(fut.savingsPct),
    },
    {
      name: 'Libre',
      actual: Math.round(curr.freeInvestmentPct),
      futuro: Math.round(fut.freeInvestmentPct),
    },
  ]

  const savingsDiff = fut.savingsAmount - curr.savingsAmount
  const isOverloaded = fut.isOverloaded
  const isTighter = fut.isTight && !curr.isTight

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <TrendingDown className="h-4 w-4 text-cyclon-lavender" />
        <p className="text-sm font-bold text-cyclon-lavender">
          Impacto en tu presupuesto
        </p>
      </div>

      {/* ── Alerta si se sobrecarga ── */}
      {isOverloaded && (
        <Card className="border border-destructive/30 bg-destructive/10 rounded-2xl shadow-none">
          <CardContent className="p-3 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive font-bold">
              ⚠ Esta compra haría que tus obligaciones superen tu ingreso. No es viable.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Gráfico comparativo ── */}
      <Card className="border-none bg-card shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Distribución: Hoy vs con {productName || 'nueva compra'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-cyclon-sky" />
              <span className="text-muted-foreground font-medium">Actual</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-cyclon-lavender" />
              <span className="text-muted-foreground font-medium">Con compra</span>
            </div>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2} barCategoryGap="25%">
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#888' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0, 100]} />
                <ChartTooltip
                  formatter={(v: number) => `${v}%`}
                  contentStyle={{ borderRadius: 12, fontSize: 11 }}
                />
                <Bar dataKey="actual" radius={[6, 6, 0, 0]} maxBarSize={28}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="#A2D2FF" />
                  ))}
                </Bar>
                <Bar dataKey="futuro" radius={[6, 6, 0, 0]} maxBarSize={28}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="#8C7DE6" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── KPIs de impacto ── */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard
          label="Ahorro mensual"
          current={formatAmount(curr.savingsAmount)}
          future={formatAmount(fut.savingsAmount)}
          isNegative={savingsDiff < 0}
          icon={<PiggyBank className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Gasto libre"
          current={formatAmount(curr.dailyFreeAmount)}
          future={formatAmount(fut.dailyFreeAmount)}
          isNegative={fut.dailyFreeAmount < curr.dailyFreeAmount}
          icon={<Banknote className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Libre de deudas"
          current={data.currentFreedomMonths > 0 ? `${data.currentFreedomMonths}m` : "—"}
          future={data.futureFreedomMonths > 0 ? `${data.futureFreedomMonths}m` : "—"}
          isNegative={data.delayMonths > 0}
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
        />
      </div>

      {/* ── Timeline de libertad ── */}
      {data.delayMonths > 0 && (
        <Card className="border-none bg-cyclon-pink/5 rounded-2xl">
          <CardContent className="p-3 flex gap-2 items-start">
            <CalendarCheck className="h-4 w-4 text-cyclon-pink shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Esta compra retrasa tu libertad financiera <strong className="text-cyclon-pink">{data.delayMonths} {data.delayMonths === 1 ? 'mes' : 'meses'}</strong>.
              Sin ella: <span className="capitalize font-bold">{data.currentFreedomDate}</span>.
              Con ella: <span className="capitalize font-bold">{data.futureFreedomDate}</span>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Alerta si queda ajustado ── */}
      {isTighter && !isOverloaded && (
        <Card className="border-none bg-yellow-50 rounded-2xl">
          <CardContent className="p-3 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Tu presupuesto pasaría de <strong>normal</strong> a <strong>ajustado</strong> ({Math.round(fut.obligationsPct)}% en obligaciones). Tendrás menos margen para imprevistos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Resumen de la opción ── */}
      <Card className="border-none bg-cyclon-lavender/5 rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-bold text-cyclon-lavender flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" />
            Resumen del escenario — opción {data.option.label}
          </p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Cuota por {periodLabel}</span>
              <span className="font-bold text-cyclon-lavender">{formatAmount(data.option.quota)}</span>
            </div>
            <div className="flex justify-between">
              <span>Plazo de pago</span>
              <span className="font-bold">{data.option.months} meses</span>
            </div>
            <div className="flex justify-between">
              <span>Capacidad restante</span>
              <span className={cn("font-bold", data.option.remainingCapacity > 0 ? "text-cyclon-mint" : "text-muted-foreground")}>
                {formatAmount(data.option.remainingCapacity)}/{periodLabel}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center italic">
        ⚡ Esto es solo una simulación. Nada se guarda hasta que pulses "Aceptar escenario".
      </p>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, current, future, isNegative, icon }: {
  label: string; current: string; future: string; isNegative: boolean; icon: React.ReactNode
}) {
  return (
    <Card className="border-none bg-muted/30 rounded-2xl shadow-none">
      <CardContent className="p-3 space-y-1.5 text-center">
        <div className={cn("mx-auto h-6 w-6 rounded-lg flex items-center justify-center", isNegative ? "bg-cyclon-pink/20 text-cyclon-pink" : "bg-cyclon-mint/20 text-cyclon-mint")}>
          {icon}
        </div>
        <p className="text-[9px] text-muted-foreground font-bold uppercase leading-tight">{label}</p>
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground line-through">{current}</p>
          <p className={cn("text-xs font-black", isNegative ? "text-cyclon-pink" : "text-cyclon-mint")}>{future}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Option Card (simplificada) ───────────────────────────────────────────────

function OptionCard({ option, isSelected, onSelect, formatAmount, periodLabel }: {
  option: DebtSimulationOption
  isSelected: boolean
  onSelect: () => void
  formatAmount: (n: number) => string
  periodLabel: string
}) {
  const borderColor =
    isSelected ? "border-cyclon-lavender bg-cyclon-lavender/5" :
    option.recommended ? "border-cyclon-periwinkle/40 bg-cyclon-sky/5" :
    "border-border bg-card"

  return (
    <button onClick={onSelect} className="w-full text-left">
      <Card className={cn("border-2 rounded-2xl transition-all shadow-none", borderColor)}>
        <CardContent className="p-4 flex items-center gap-4">
          {/* Selector */}
          <div className={cn(
            "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            isSelected ? "border-cyclon-lavender bg-cyclon-lavender" : "border-muted-foreground/30"
          )}>
            {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{option.label}</span>
              {option.recommended && (
                <span className="flex items-center gap-0.5 text-[9px] font-black bg-cyclon-periwinkle/20 text-cyclon-periwinkle px-1.5 py-0.5 rounded-full">
                  <Star className="h-2.5 w-2.5" /> SUGERIDA
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{option.description}</p>
          </div>

          {/* Métricas clave */}
          <div className="text-right shrink-0">
            <p className="font-black text-sm text-cyclon-lavender">{formatAmount(option.quota)}</p>
            <p className="text-[9px] text-muted-foreground">/{periodLabel} · {option.months}m</p>
          </div>

          {/* Estado */}
          <div className="shrink-0">
            {option.canAfford
              ? <CheckCircle2 className="h-4 w-4 text-cyclon-mint" />
              : <XCircle className="h-4 w-4 text-destructive" />
            }
          </div>
        </CardContent>
      </Card>
    </button>
  )
}
