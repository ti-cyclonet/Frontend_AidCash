"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Plus, CheckCircle2, Calendar, Info, Pencil, Trash2,
  AlertTriangle, Coffee, ShoppingBag, Eye, EyeOff,
} from "lucide-react"
import { Debt, FixedExpense, ImpulseCategory } from "@/lib/types"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useAppContext } from "@/lib/app-context"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { getPeriodData } from "@/lib/period-filter"
import { useMemo } from "react"
import { DebtSimulator } from "@/components/recommendations/debt-simulator"
import { analyzeFinances } from "@/lib/recommendations"
import Link from "next/link"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Tab = "gastos_fijos" | "deudas" | "gastos_hormiga"
type ItemType = "deuda" | "gasto_fijo"
type EditScope = "este_mes" | "permanente"

interface DebtForm {
  nombre: string
  montoTotal: string
  cuotaPeriodo: string
  fechaVencimiento: string
  diaCorte: string
  frecuencia: "mensual" | "quincenal"
  tipoPago: "unica" | "varias"
  fechaFinalProyectada: string
  numCuotas: string
}
interface FixedForm { nombre: string; monto: string; fechaCorte: string }

const emptyDebtForm: DebtForm = {
  nombre: "", montoTotal: "", cuotaPeriodo: "", fechaVencimiento: "",
  diaCorte: "", frecuencia: "mensual", tipoPago: "unica",
  fechaFinalProyectada: "", numCuotas: "",
}
const emptyFixedForm: FixedForm = { nombre: "", monto: "", fechaCorte: "" }

const CATEGORIES: { value: ImpulseCategory; label: string; emoji: string }[] = [
  { value: "cafe",       label: "Café",       emoji: "☕" },
  { value: "comida",     label: "Comida",     emoji: "🍔" },
  { value: "transporte", label: "Transporte", emoji: "🚕" },
  { value: "antojo",     label: "Antojo",     emoji: "🍫" },
  { value: "salida",     label: "Salida",     emoji: "🎉" },
  { value: "otro",       label: "Otro",       emoji: "💸" },
]

export default function ObligacionesPage() {
  const {
    debts, fixedExpenses, loading,
    addDebt, updateDebt, deleteDebt,
    addFixedExpense, updateFixedExpense, deleteFixedExpense,
    markPaid, markFixedPaid,
    impulseExpenses, impulseThisPeriod, totalImpulseThisPeriod,
    addImpulseExpense, removeImpulseExpense,
    extraIncomes,
  } = useFinanceData()
  const { formatAmount, income, incomeFrequency } = useAppContext()

  // ── Tab activa ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("gastos_fijos")

  // ── Items ocultos (ojo) ────────────────────────────────────────────────────
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())
  const toggleItemHidden = (id: string) => setHiddenItems(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // ── Asignación de presupuesto para gastos hormiga ──────────────────────────
  const totalExtraIncome = extraIncomes.reduce((acc, e) => acc + e.monto, 0)
  const { effectiveIncome, totalObligations } = useMemo(
    () => getPeriodData(income, totalExtraIncome, debts, fixedExpenses, incomeFrequency),
    [income, totalExtraIncome, debts, fixedExpenses, incomeFrequency]
  )
  const allocation = useMemo(
    () => effectiveIncome > 0 ? calculateBudgetAllocation(effectiveIncome, totalObligations) : null,
    [effectiveIncome, totalObligations]
  )
  const dailyFreeAmount = allocation?.dailyFreeAmount ?? 0

  // Estrategias de deuda
  const recommendations = useMemo(
    () => allocation ? analyzeFinances(allocation, debts, incomeFrequency) : null,
    [allocation, debts, incomeFrequency]
  )

  // ── Pay modal (deudas) ─────────────────────────────────────────────────────
  const [payDebt, setPayDebt] = useState<Debt | null>(null)
  const [isPartialMode, setIsPartialMode] = useState(false)
  const [partialAmount, setPartialAmount] = useState("")

  // ── Add modal ──────────────────────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addType, setAddType] = useState<ItemType>("deuda")
  const [addDebtForm, setAddDebtForm] = useState<DebtForm>(emptyDebtForm)
  const [addFixedForm, setAddFixedForm] = useState<FixedForm>(emptyFixedForm)
  const [saving, setSaving] = useState(false)

  // ── Edit debt modal ────────────────────────────────────────────────────────
  const [editDebt, setEditDebt] = useState<Debt | null>(null)
  const [editDebtForm, setEditDebtForm] = useState<DebtForm>(emptyDebtForm)
  const [isScopeOpen, setIsScopeOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  // ── Edit fixed modal ───────────────────────────────────────────────────────
  const [editFixed, setEditFixed] = useState<FixedExpense | null>(null)
  const [editFixedForm, setEditFixedForm] = useState<FixedForm>(emptyFixedForm)
  const [savingFixed, setSavingFixed] = useState(false)

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ type: "debt" | "fixed"; id: string; nombre: string } | null>(null)

  // ── Gasto Hormiga modal ────────────────────────────────────────────────────
  const [impulseModalOpen, setImpulseModalOpen] = useState(false)
  const [impulseNombre, setImpulseNombre] = useState("")
  const [impulseMonto, setImpulseMonto] = useState("")
  const [impulseCategoria, setImpulseCategoria] = useState<ImpulseCategory>("cafe")
  const [savingImpulse, setSavingImpulse] = useState(false)
  const [impulseWarningOpen, setImpulseWarningOpen] = useState(false)
  const [lastAddedImpulseId, setLastAddedImpulseId] = useState<string | null>(null)

  // ── Handlers Pay ──────────────────────────────────────────────────────────
  const openPay = (debt: Debt) => { setPayDebt(debt); setIsPartialMode(false); setPartialAmount("") }

  const confirmFullPay = async () => {
    if (!payDebt) return
    await markPaid(payDebt.id, payDebt.montoTotal - payDebt.cuotaPeriodo, true)
    setPayDebt(null)
  }

  const confirmPartialPay = async () => {
    if (!payDebt || !partialAmount) return
    const amt = Number(partialAmount)
    await markPaid(payDebt.id, payDebt.montoTotal - amt, amt >= payDebt.cuotaPeriodo)
    setPayDebt(null)
  }

  // ── Handlers Add ──────────────────────────────────────────────────────────
  const handleAdd = async () => {
    setSaving(true)
    if (addType === "deuda") {
      if (!addDebtForm.nombre || !addDebtForm.montoTotal || !addDebtForm.fechaVencimiento) { setSaving(false); return }
      // Si varias cuotas y se usó calculadora, la cuota ya está en addDebtForm.cuotaPeriodo
      const cuota = addDebtForm.cuotaPeriodo ? Number(addDebtForm.cuotaPeriodo) : 0
      await addDebt({
        nombre: addDebtForm.nombre,
        montoTotal: Number(addDebtForm.montoTotal),
        cuotaPeriodo: cuota,
        fechaVencimiento: addDebtForm.fechaVencimiento,
      })
      setAddDebtForm(emptyDebtForm)
    } else {
      if (!addFixedForm.nombre || !addFixedForm.monto || !addFixedForm.fechaCorte) { setSaving(false); return }
      await addFixedExpense({ nombre: addFixedForm.nombre, monto: Number(addFixedForm.monto), fechaCorte: addFixedForm.fechaCorte })
      setAddFixedForm(emptyFixedForm)
    }
    setSaving(false)
    setIsAddOpen(false)
  }

  // ── Handlers Edit Debt ────────────────────────────────────────────────────
  const openEditDebt = (debt: Debt) => {
    setEditDebt(debt)
    setEditDebtForm({
      nombre: debt.nombre,
      montoTotal: String(debt.montoTotal),
      cuotaPeriodo: String(debt.cuotaPeriodo),
      fechaVencimiento: debt.fechaVencimiento,
      diaCorte: "",
      frecuencia: "mensual",
      tipoPago: "unica",
      fechaFinalProyectada: "",
      numCuotas: "",
    })
  }

  const handleEditDebtSubmit = () => {
    if (!editDebt) return
    const cuotaNew = Number(editDebtForm.cuotaPeriodo)
    if (cuotaNew !== editDebt.cuotaPeriodo) {
      setIsScopeOpen(true)
    } else {
      applyDebtEdit("permanente")
    }
  }

  const applyDebtEdit = async (scope: EditScope) => {
    if (!editDebt) return
    setSavingEdit(true)
    const patch: Partial<Pick<Debt, "nombre" | "montoTotal" | "cuotaPeriodo" | "fechaVencimiento">> = {
      nombre: editDebtForm.nombre,
      montoTotal: Number(editDebtForm.montoTotal),
      fechaVencimiento: editDebtForm.fechaVencimiento,
    }
    if (scope === "permanente") patch.cuotaPeriodo = Number(editDebtForm.cuotaPeriodo)
    await updateDebt(editDebt.id, patch)
    setSavingEdit(false)
    setIsScopeOpen(false)
    setEditDebt(null)
  }

  // ── Handlers Edit Fixed ───────────────────────────────────────────────────
  const openEditFixed = (fe: FixedExpense) => {
    setEditFixed(fe)
    setEditFixedForm({ nombre: fe.nombre, monto: String(fe.monto), fechaCorte: fe.fechaCorte })
  }

  const handleEditFixed = async () => {
    if (!editFixed) return
    setSavingFixed(true)
    await updateFixedExpense(editFixed.id, {
      nombre: editFixedForm.nombre,
      monto: Number(editFixedForm.monto),
      fechaCorte: editFixedForm.fechaCorte,
    })
    setSavingFixed(false)
    setEditFixed(null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === "debt") await deleteDebt(deleteTarget.id)
    else await deleteFixedExpense(deleteTarget.id)
    setDeleteTarget(null)
  }

  // ── Handlers Gastos Hormiga ───────────────────────────────────────────────
  const handleAddImpulse = async () => {
    if (!impulseNombre || !impulseMonto || Number(impulseMonto) <= 0) return
    setSavingImpulse(true)
    const result = await addImpulseExpense({ nombre: impulseNombre, monto: Number(impulseMonto), categoria: impulseCategoria })
    setSavingImpulse(false)
    if (result) {
      setLastAddedImpulseId(result.id)
      const newTotal = totalImpulseThisPeriod + Number(impulseMonto)
      if (newTotal > dailyFreeAmount && dailyFreeAmount > 0) {
        setImpulseModalOpen(false)
        setImpulseWarningOpen(true)
      } else {
        setImpulseModalOpen(false)
      }
    }
    setImpulseNombre("")
    setImpulseMonto("")
    setImpulseCategoria("cafe")
  }

  const handleCancelImpulse = async () => {
    if (lastAddedImpulseId) {
      await removeImpulseExpense(lastAddedImpulseId)
      setLastAddedImpulseId(null)
    }
    setImpulseWarningOpen(false)
  }

  // Estadísticas para gastos hormiga
  const usagePct = dailyFreeAmount > 0
    ? Math.min(100, Math.round((totalImpulseThisPeriod / dailyFreeAmount) * 100))
    : 0
  const remaining = Math.max(0, dailyFreeAmount - totalImpulseThisPeriod)
  const isOver = totalImpulseThisPeriod > dailyFreeAmount


  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-cyclon-periwinkle">Obligaciones</h1>
          <p className="text-muted-foreground text-sm">Gestiona tus compromisos y gastos.</p>
        </div>
        {(activeTab === "gastos_fijos" || activeTab === "deudas") && (
          <Button
            size="icon"
            className="rounded-2xl bg-cyclon-periwinkle shadow-lg shadow-cyclon-periwinkle/30"
            onClick={() => {
              setAddType(activeTab === "deudas" ? "deuda" : "gasto_fijo")
              setIsAddOpen(true)
            }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}
        {activeTab === "gastos_hormiga" && (
          <Button
            size="icon"
            className="rounded-2xl bg-cyclon-pink shadow-lg shadow-cyclon-pink/30"
            onClick={() => {
              setImpulseNombre("")
              setImpulseMonto("")
              setImpulseCategoria("cafe")
              setImpulseModalOpen(true)
            }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}
      </header>

      {/* ── Simulador de Escenarios ── */}
      {allocation && (
        <DebtSimulator
          debtCapacity={allocation.debtCapacityAmount}
          incomeFrequency={incomeFrequency}
        />
      )}

      {/* ── Pestañas ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: "gastos_fijos" as Tab, label: "Gastos Fijos" },
          { key: "deudas" as Tab,       label: "Deudas" },
          { key: "gastos_hormiga" as Tab, label: "Gastos Hormiga" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "h-10 rounded-xl text-xs font-bold border-2 transition-colors",
              activeTab === tab.key
                ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle"
                : "border-muted text-muted-foreground hover:border-cyclon-periwinkle/40"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          TAB: GASTOS FIJOS
      ════════════════════════════════════════════════════════════ */}
      {activeTab === "gastos_fijos" && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
          ) : fixedExpenses.length === 0 ? (
            <button
              onClick={() => { setAddType("gasto_fijo"); setIsAddOpen(true) }}
              className="w-full border-2 border-dashed border-muted rounded-2xl p-6 text-sm text-muted-foreground hover:border-cyclon-periwinkle/40 hover:text-cyclon-periwinkle transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" /> Agregar gasto fijo (Netflix, arriendo, etc.)
            </button>
          ) : (
            <>
              {fixedExpenses.map(fe => (
                <FixedCard
                  key={fe.id}
                  item={fe}
                  formatAmount={formatAmount}
                  onEdit={() => openEditFixed(fe)}
                  onDelete={() => setDeleteTarget({ type: "fixed", id: fe.id, nombre: fe.nombre })}
                  onTogglePaid={() => markFixedPaid(fe.id, !fe.pagadoEstePeriodo)}
                  hidden={hiddenItems.has(fe.id)}
                  onToggleHidden={() => toggleItemHidden(fe.id)}
                />
              ))}
            </>
          )}
          <Link href="/balance" className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-cyclon-lavender/70 hover:text-cyclon-lavender transition-colors pt-1">
            Ver historial completo en Balance →
          </Link>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB: DEUDAS
      ════════════════════════════════════════════════════════════ */}
      {activeTab === "deudas" && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
          ) : debts.length === 0 ? (
            <button
              onClick={() => { setAddType("deuda"); setIsAddOpen(true) }}
              className="w-full border-2 border-dashed border-muted rounded-2xl p-6 text-sm text-muted-foreground hover:border-cyclon-periwinkle/40 hover:text-cyclon-periwinkle transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" /> Agregar deuda (tarjeta, crédito, etc.)
            </button>
          ) : (
            <>
              {debts.map(debt => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  formatAmount={formatAmount}
                  onPay={() => openPay(debt)}
                  onEdit={() => openEditDebt(debt)}
                  onDelete={() => setDeleteTarget({ type: "debt", id: debt.id, nombre: debt.nombre })}
                  hidden={hiddenItems.has(debt.id)}
                  onToggleHidden={() => toggleItemHidden(debt.id)}
                />
              ))}
            </>
          )}
          <Link href="/balance" className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-cyclon-lavender/70 hover:text-cyclon-lavender transition-colors pt-1">
            Ver historial completo en Balance →
          </Link>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB: GASTOS HORMIGA
      ════════════════════════════════════════════════════════════ */}
      {activeTab === "gastos_hormiga" && (
        <div className="space-y-4">
          {/* Barra de progreso */}
          <Card className={cn("border-none shadow-sm rounded-3xl", isOver && "ring-1 ring-red-400/30 bg-red-500/5")}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0",
                    isOver ? "bg-red-500/10 text-red-500" : "bg-cyclon-pink/10 text-cyclon-pink"
                  )}>
                    <Coffee className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Gastos Hormiga</h3>
                    <p className="text-[10px] text-muted-foreground">Café, antojos, día a día</p>
                  </div>
                </div>
                {dailyFreeAmount === 0 && (
                  <p className="text-[10px] text-muted-foreground italic">Configura ingresos en Gestión</p>
                )}
              </div>
              {dailyFreeAmount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className={isOver ? "text-red-500" : "text-muted-foreground"}>
                      Gastado: {formatAmount(totalImpulseThisPeriod)}
                    </span>
                    <span className="text-muted-foreground">Libre: {formatAmount(remaining)}</span>
                  </div>
                  <Progress
                    value={usagePct}
                    className="h-2"
                    indicatorClassName={cn(
                      usagePct >= 100 ? "bg-red-500" : usagePct >= 75 ? "bg-yellow-500" : "bg-cyclon-pink"
                    )}
                  />
                  <p className="text-[9px] text-muted-foreground text-right">
                    de {formatAmount(dailyFreeAmount)} blindado
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial de gastos hormiga */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Historial — {impulseThisPeriod.length > 0 ? `${impulseThisPeriod.length} registros este periodo` : "Sin registros"}
            </p>
            {impulseExpenses.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <div className="h-14 w-14 bg-cyclon-pink/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Coffee className="h-7 w-7 text-cyclon-pink" />
                </div>
                <p className="text-sm text-muted-foreground">Aún no tienes gastos hormiga.</p>
                <p className="text-xs text-muted-foreground">Toca el <strong>+</strong> para registrar uno.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {impulseExpenses.map(item => {
                  const cat = CATEGORIES.find(c => c.value === item.categoria)
                  return (
                    <div key={item.id} className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 shadow-sm">
                      <span className="text-lg">{cat?.emoji ?? "💸"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{item.nombre}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                            : item.periodo}
                          {" · "}{cat?.label ?? "Otro"}
                        </p>
                      </div>
                      <span className="font-black text-sm shrink-0">{formatAmount(item.monto)}</span>
                      <button
                        onClick={() => removeImpulseExpense(item.id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ MODALES ════ */}

      {/* Pay Modal */}
      <Dialog open={!!payDebt} onOpenChange={v => !v && setPayDebt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Ya pagaste?</DialogTitle>
            <DialogDescription>Obligación: <strong>{payDebt?.nombre}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-3 flex flex-col gap-3">
            <Button onClick={confirmFullPay} className="bg-cyclon-mint text-cyclon-periwinkle hover:bg-cyclon-mint/80 h-14 text-base font-bold rounded-2xl gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Pagada ({formatAmount(payDebt?.cuotaPeriodo ?? 0)})
            </Button>
            <Button variant="outline" onClick={() => setIsPartialMode(v => !v)} className="h-12 font-medium rounded-2xl border-dashed border-2 text-sm">
              ¿Pagaste otro valor?
            </Button>
            <div className={cn("overflow-hidden transition-all duration-300", isPartialMode ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Monto abonado</Label>
                  <MoneyInput value={partialAmount} onChange={v => setPartialAmount(v)} className="h-12 text-xl font-bold rounded-xl" placeholder="0" autoFocus={isPartialMode} />
                </div>
                <Button onClick={confirmPartialPay} disabled={!partialAmount || Number(partialAmount) <= 0} className="w-full bg-cyclon-periwinkle text-white font-bold h-11 rounded-xl">
                  Confirmar abono
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar {addType === "deuda" ? "Deuda" : "Gasto Fijo"}</DialogTitle>
            <DialogDescription>Completa los datos del compromiso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              {(["deuda", "gasto_fijo"] as ItemType[]).map(t => (
                <button key={t} onClick={() => setAddType(t)} className={cn("h-12 rounded-2xl font-bold text-sm border-2 transition-colors", addType === t ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle" : "border-muted text-muted-foreground")}>
                  {t === "deuda" ? "Deuda" : "Gasto Fijo"}
                </button>
              ))}
            </div>
            {addType === "deuda" ? (
              <DebtFormFields form={addDebtForm} onChange={setAddDebtForm} />
            ) : (
              <>
                <FieldInput label="Nombre" placeholder="Ej: Netflix" value={addFixedForm.nombre} onChange={v => setAddFixedForm(f => ({ ...f, nombre: v }))} />
                <FieldInput label="Monto mensual" type="number" placeholder="0.00" value={addFixedForm.monto} onChange={v => setAddFixedForm(f => ({ ...f, monto: v }))} />
                <FieldInput label="Fecha de corte" type="date" value={addFixedForm.fechaCorte} onChange={v => setAddFixedForm(f => ({ ...f, fechaCorte: v }))} />
              </>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving} className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-8">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Debt Modal */}
      <Dialog open={!!editDebt && !isScopeOpen} onOpenChange={v => !v && setEditDebt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Deuda</DialogTitle>
            <DialogDescription>Modifica los datos de <strong>{editDebt?.nombre}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <DebtFormFields form={editDebtForm} onChange={setEditDebtForm} isEdit />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditDebt(null)}>Cancelar</Button>
            <Button onClick={handleEditDebtSubmit} disabled={savingEdit} className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-8">
              {savingEdit ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scope Confirmation */}
      <Dialog open={isScopeOpen} onOpenChange={v => !v && setIsScopeOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cómo aplicar el cambio?</DialogTitle>
            <DialogDescription>Cambiaste la cuota de <strong>{formatAmount(editDebt?.cuotaPeriodo ?? 0)}</strong> a <strong>{formatAmount(Number(editDebtForm.cuotaPeriodo))}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-3">
            <button onClick={() => applyDebtEdit("este_mes")} className="w-full text-left p-4 rounded-2xl border-2 border-cyclon-sky/40 bg-cyclon-sky/5 hover:border-cyclon-sky transition-colors space-y-0.5">
              <p className="font-bold text-sm">Solo este mes</p>
              <p className="text-xs text-muted-foreground">La cuota original se restaura el próximo periodo.</p>
            </button>
            <button onClick={() => applyDebtEdit("permanente")} className="w-full text-left p-4 rounded-2xl border-2 border-cyclon-lavender/40 bg-cyclon-lavender/5 hover:border-cyclon-lavender transition-colors space-y-0.5">
              <p className="font-bold text-sm">Cambio permanente</p>
              <p className="text-xs text-muted-foreground">La nueva cuota se usará en todos los periodos futuros.</p>
            </button>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setIsScopeOpen(false)}>Cancelar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Fixed Modal */}
      <Dialog open={!!editFixed} onOpenChange={v => !v && setEditFixed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Gasto Fijo</DialogTitle>
            <DialogDescription>Modifica <strong>{editFixed?.nombre}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FieldInput label="Nombre" value={editFixedForm.nombre} onChange={v => setEditFixedForm(f => ({ ...f, nombre: v }))} />
            <FieldInput label="Monto mensual" type="number" value={editFixedForm.monto} onChange={v => setEditFixedForm(f => ({ ...f, monto: v }))} />
            <FieldInput label="Fecha de corte" type="date" value={editFixedForm.fechaCorte} onChange={v => setEditFixedForm(f => ({ ...f, fechaCorte: v }))} />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditFixed(null)}>Cancelar</Button>
            <Button onClick={handleEditFixed} disabled={savingFixed} className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-8">
              {savingFixed ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Eliminar</DialogTitle>
            <DialogDescription>¿Eliminar <strong>{deleteTarget?.nombre}</strong>? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} className="rounded-xl font-bold px-8">Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gasto Hormiga — Modal de registro */}
      <Dialog open={impulseModalOpen} onOpenChange={v => { if (!v) { setImpulseModalOpen(false); setImpulseNombre(""); setImpulseMonto(""); setImpulseCategoria("cafe") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-cyclon-pink" />
              Gasto hormiga
            </DialogTitle>
            <DialogDescription>¿En qué gastaste?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción</Label>
              <Input
                placeholder="Ej: Café en Starbucks"
                value={impulseNombre}
                onChange={e => setImpulseNombre(e.target.value)}
                className="h-10 rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto</Label>
              <MoneyInput
                value={impulseMonto}
                onChange={v => setImpulseMonto(v)}
                className="h-12 text-lg font-bold rounded-xl"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Categoría</Label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setImpulseCategoria(cat.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-colors",
                      impulseCategoria === cat.value
                        ? "border-cyclon-pink bg-cyclon-pink/5 text-cyclon-pink"
                        : "border-muted text-muted-foreground hover:border-cyclon-pink/30"
                    )}
                  >
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="text-[9px] font-bold">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {dailyFreeAmount > 0 && Number(impulseMonto) > 0 &&
              (totalImpulseThisPeriod + Number(impulseMonto)) > dailyFreeAmount * 0.8 && (
              <div className={cn(
                "flex items-start gap-2 p-2.5 rounded-xl text-xs",
                (totalImpulseThisPeriod + Number(impulseMonto)) > dailyFreeAmount
                  ? "bg-red-500/10 text-red-500"
                  : "bg-yellow-500/10 text-yellow-600"
              )}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {(totalImpulseThisPeriod + Number(impulseMonto)) > dailyFreeAmount
                    ? "Este gasto excede tu presupuesto blindado."
                    : "Estás usando más del 80% de tu gasto libre."}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setImpulseModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAddImpulse}
              disabled={savingImpulse || !impulseNombre || !impulseMonto || Number(impulseMonto) <= 0}
              className="bg-cyclon-pink text-white font-bold rounded-xl px-6"
            >
              {savingImpulse ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gasto Hormiga Warning */}
      <Dialog open={impulseWarningOpen} onOpenChange={v => !v && setImpulseWarningOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-5 w-5" /> Te pasaste del presupuesto</DialogTitle>
            <DialogDescription>Tus gastos hormiga superaron el monto blindado asignado.</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Card className="border-none bg-red-500/5 rounded-2xl">
              <CardContent className="p-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Presupuesto blindado</p>
                <p className="text-lg font-black">{formatAmount(dailyFreeAmount)}</p>
                <p className="text-xs text-red-500 font-bold">
                  Gastaste: {formatAmount(totalImpulseThisPeriod)}
                </p>
              </CardContent>
            </Card>
          </div>
          <DialogFooter className="flex flex-col gap-2 pt-2">
            <Button onClick={() => setImpulseWarningOpen(false)} className="w-full bg-cyclon-periwinkle text-white font-bold rounded-xl h-12">
              Entendido
            </Button>
            <Button variant="ghost" onClick={handleCancelImpulse} className="w-full text-muted-foreground">
              Cancelar (eliminar último gasto)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Helper: días restantes ───────────────────────────────────────────────────
function getDueStatus(dateStr: string) {
  if (!dateStr) return { label: "Sin fecha", days: 999, color: "text-muted-foreground", bgColor: "bg-muted/50" }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + "T00:00:00")
  const diffMs = due.getTime() - today.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (days < 0) return { label: `Vencido (${Math.abs(days)}d)`, days, color: "text-red-500", bgColor: "bg-red-500/10" }
  if (days <= 3) return { label: days === 0 ? "Vence hoy" : `${days}d restantes`, days, color: "text-yellow-600", bgColor: "bg-yellow-500/10" }
  return { label: `${days}d restantes`, days, color: "text-muted-foreground", bgColor: "bg-muted/50" }
}

// ─── DebtCard ──────────────────────────────────────────────────────────────────
function DebtCard({ debt, formatAmount, onPay, onEdit, onDelete, hidden, onToggleHidden }: {
  debt: Debt; formatAmount: (n: number) => string
  onPay: () => void; onEdit: () => void; onDelete: () => void
  hidden: boolean; onToggleHidden: () => void
}) {
  const status = getDueStatus(debt.fechaVencimiento)
  return (
    <Card className={cn(
      "border-none shadow-sm transition-all bg-card",
      debt.pagadoEstePeriodo && "opacity-60",
      !debt.pagadoEstePeriodo && status.days < 0 && "ring-1 ring-red-500/30",
      !debt.pagadoEstePeriodo && status.days >= 0 && status.days <= 3 && "ring-1 ring-yellow-500/30"
    )}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shrink-0", debt.pagadoEstePeriodo ? "bg-cyclon-mint/20 text-cyclon-mint" : "bg-cyclon-pink/20 text-cyclon-pink")}>
          {debt.pagadoEstePeriodo ? <CheckCircle2 className="h-5 w-5" /> : <Info className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-sm truncate">{hidden ? "••••••" : debt.nombre}</h3>
            <Badge variant={debt.pagadoEstePeriodo ? "secondary" : "default"} className={cn("text-[10px] font-bold rounded-lg ml-2 shrink-0", !debt.pagadoEstePeriodo && "bg-cyclon-pink text-white border-none")}>
              {debt.pagadoEstePeriodo ? "PAGADO" : "PENDIENTE"}
            </Badge>
          </div>
          {hidden ? (
            <p className="text-base font-black text-muted-foreground mt-1">••••••</p>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className={cn("text-xs font-medium", debt.pagadoEstePeriodo ? "text-muted-foreground" : status.color)}>
                  {debt.fechaVencimiento}
                </span>
                {!debt.pagadoEstePeriodo && (
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", status.bgColor, status.color)}>
                    {status.label}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex justify-between items-end">
                <div>
                  <span className="text-base font-bold">{formatAmount(debt.cuotaPeriodo)}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">/ cuota</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Total: {formatAmount(debt.montoTotal)}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {!debt.pagadoEstePeriodo && (
            <Button onClick={onPay} size="sm" className="bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-8 px-3 font-bold text-xs">
              Pagar
            </Button>
          )}
          <div className="flex gap-1">
            <button onClick={onToggleHidden} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onEdit} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-cyclon-lavender hover:bg-cyclon-lavender/10 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── FixedCard ─────────────────────────────────────────────────────────────────
function FixedCard({ item, formatAmount, onEdit, onDelete, onTogglePaid, hidden, onToggleHidden }: {
  item: FixedExpense; formatAmount: (n: number) => string
  onEdit: () => void; onDelete: () => void; onTogglePaid: () => void
  hidden: boolean; onToggleHidden: () => void
}) {
  const status = getDueStatus(item.fechaCorte)
  return (
    <Card className={cn(
      "border-none shadow-sm transition-all bg-card",
      item.pagadoEstePeriodo && "opacity-60",
      !item.pagadoEstePeriodo && status.days < 0 && "ring-1 ring-red-500/30",
      !item.pagadoEstePeriodo && status.days >= 0 && status.days <= 3 && "ring-1 ring-yellow-500/30"
    )}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shrink-0", item.pagadoEstePeriodo ? "bg-cyclon-mint/20 text-cyclon-mint" : "bg-cyclon-sky/20 text-cyclon-sky")}>
          {item.pagadoEstePeriodo ? <CheckCircle2 className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-sm truncate">{hidden ? "••••••" : item.nombre}</h3>
            <Badge variant={item.pagadoEstePeriodo ? "secondary" : "default"} className={cn("text-[10px] font-bold rounded-lg ml-2 shrink-0", !item.pagadoEstePeriodo && "bg-cyclon-sky text-white border-none")}>
              {item.pagadoEstePeriodo ? "PAGADO" : "PENDIENTE"}
            </Badge>
          </div>
          {hidden ? (
            <p className="text-base font-black text-muted-foreground mt-1">••••••</p>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className={cn("text-xs font-medium", item.pagadoEstePeriodo ? "text-muted-foreground" : status.color)}>
                  {item.fechaCorte}
                </span>
                {!item.pagadoEstePeriodo && (
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", status.bgColor, status.color)}>
                    {status.label}
                  </span>
                )}
              </div>
              <span className="text-base font-bold mt-1 block">{formatAmount(item.monto)}</span>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {!item.pagadoEstePeriodo
            ? <Button onClick={onTogglePaid} size="sm" className="bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-8 px-3 font-bold text-xs">Pagar</Button>
            : <Button onClick={onTogglePaid} size="sm" variant="ghost" className="rounded-xl h-8 px-3 text-xs text-muted-foreground">Deshacer</Button>
          }
          <div className="flex gap-1">
            <button onClick={onToggleHidden} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onEdit} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-cyclon-lavender hover:bg-cyclon-lavender/10 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── DebtFormFields — formulario enriquecido de deuda ────────────────────────
function DebtFormFields({
  form,
  onChange,
  isEdit = false,
}: {
  form: DebtForm
  onChange: (f: DebtForm) => void
  isEdit?: boolean
}) {
  // ── Calculadora de cuotas ─────────────────────────────────────────────────
  const cuotaSugerida = (() => {
    if (
      form.tipoPago === "varias" &&
      !form.cuotaPeriodo &&
      form.montoTotal &&
      form.fechaFinalProyectada
    ) {
      const hoy = new Date()
      const fin = new Date(form.fechaFinalProyectada + "T00:00:00")
      if (fin <= hoy) return null
      const diffMs = fin.getTime() - hoy.getTime()
      const meses = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30))
      const periodos = form.frecuencia === "quincenal" ? meses * 2 : meses
      if (periodos <= 0) return null
      const cuota = Math.ceil(Number(form.montoTotal) / periodos)
      return { cuota, periodos, meses }
    }
    return null
  })()

  // Fechas de pago sugeridas
  const fechasSugeridas = (() => {
    if (!cuotaSugerida || !form.diaCorte) return []
    const dia = parseInt(form.diaCorte)
    if (isNaN(dia) || dia < 1 || dia > 31) return []
    const fechas: string[] = []
    const hoy = new Date()
    for (let i = 0; i < Math.min(cuotaSugerida.periodos, 4); i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + (form.frecuencia === "quincenal" ? Math.floor(i / 2) : i), dia)
      if (form.frecuencia === "quincenal" && i % 2 === 1) d.setDate(d.getDate() + 15)
      fechas.push(d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }))
    }
    return fechas
  })()

  const set = (patch: Partial<DebtForm>) => onChange({ ...form, ...patch })

  return (
    <div className="space-y-4">
      {/* Nombre */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Nombre</Label>
        <Input placeholder="Ej: TC Visa" value={form.nombre} onChange={e => set({ nombre: e.target.value })} className="h-11 rounded-xl" />
      </div>

      {/* Monto total */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Monto total</Label>
        <MoneyInput value={form.montoTotal} onChange={v => set({ montoTotal: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
      </div>

      {/* Frecuencia */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Frecuencia de pago</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["mensual", "quincenal"] as const).map(f => (
            <button
              key={f}
              onClick={() => set({ frecuencia: f })}
              className={cn(
                "h-10 rounded-xl text-sm font-bold border-2 transition-colors capitalize",
                form.frecuencia === f
                  ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle"
                  : "border-muted text-muted-foreground hover:border-cyclon-periwinkle/40"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tipo de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Tipo de pago</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => set({ tipoPago: "unica" })}
            className={cn(
              "h-10 rounded-xl text-sm font-bold border-2 transition-colors",
              form.tipoPago === "unica"
                ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle"
                : "border-muted text-muted-foreground hover:border-cyclon-periwinkle/40"
            )}
          >
            Cuota única
          </button>
          <button
            onClick={() => set({ tipoPago: "varias" })}
            className={cn(
              "h-10 rounded-xl text-sm font-bold border-2 transition-colors",
              form.tipoPago === "varias"
                ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle"
                : "border-muted text-muted-foreground hover:border-cyclon-periwinkle/40"
            )}
          >
            Varias cuotas
          </button>
        </div>
      </div>

      {/* Día de corte */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Día de corte / pago</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1} max={31}
            placeholder="Ej: 09"
            value={form.diaCorte}
            onChange={e => set({ diaCorte: e.target.value })}
            className="h-11 rounded-xl w-24 text-center font-bold text-lg"
          />
          <span className="text-xs text-muted-foreground">de cada {form.frecuencia === "quincenal" ? "quincena" : "mes"}</span>
        </div>
      </div>

      {/* Cuota — si sabe el valor */}
      {form.tipoPago === "unica" && (
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">Cuota por periodo</Label>
          <MoneyInput value={form.cuotaPeriodo} onChange={v => set({ cuotaPeriodo: v })} className="h-11 rounded-xl font-bold" placeholder="0" />
        </div>
      )}

      {/* Varias cuotas — ¿sabe el valor? */}
      {form.tipoPago === "varias" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">
              Cuota por periodo{" "}
              <span className="text-muted-foreground font-normal">(deja vacío si no sabes)</span>
            </Label>
            <MoneyInput
              value={form.cuotaPeriodo}
              onChange={v => set({ cuotaPeriodo: v, fechaFinalProyectada: v ? "" : form.fechaFinalProyectada })}
              className="h-11 rounded-xl font-bold"
              placeholder="0"
            />
          </div>

          {/* Calculadora: si no sabe la cuota */}
          {!form.cuotaPeriodo && (
            <div className="bg-cyclon-lavender/5 rounded-2xl p-3 space-y-3 border border-cyclon-lavender/20">
              <p className="text-[10px] font-bold text-cyclon-lavender uppercase tracking-wider">
                🔢 Calculadora de cuotas
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Fecha final proyectada</Label>
                <Input
                  type="date"
                  value={form.fechaFinalProyectada}
                  onChange={e => set({ fechaFinalProyectada: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
              {cuotaSugerida && (
                <div className="bg-card rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Cuota sugerida</span>
                    <span className="text-sm font-black text-cyclon-lavender">${cuotaSugerida.cuota.toLocaleString("es-ES")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Total de periodos</span>
                    <span className="text-xs font-bold">{cuotaSugerida.periodos} {form.frecuencia === "quincenal" ? "quincenas" : "meses"}</span>
                  </div>
                  {fechasSugeridas.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Próximas fechas de pago:</p>
                      <div className="flex flex-wrap gap-1">
                        {fechasSugeridas.map(f => (
                          <span key={f} className="text-[9px] font-bold bg-cyclon-lavender/10 text-cyclon-lavender px-2 py-0.5 rounded-full">
                            {f}
                          </span>
                        ))}
                        {cuotaSugerida.periodos > 4 && (
                          <span className="text-[9px] text-muted-foreground px-1">+{cuotaSugerida.periodos - 4} más...</span>
                        )}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => set({ cuotaPeriodo: String(cuotaSugerida.cuota), numCuotas: String(cuotaSugerida.periodos) })}
                    className="w-full h-9 rounded-xl bg-cyclon-lavender text-white text-xs font-bold hover:bg-cyclon-lavender/90 transition-colors"
                  >
                    Usar esta cuota (${cuotaSugerida.cuota.toLocaleString("es-ES")})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fecha de vencimiento */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Fecha de vencimiento</Label>
        <Input
          type="date"
          value={form.fechaVencimiento}
          onChange={e => set({ fechaVencimiento: e.target.value })}
          className="h-11 rounded-xl"
        />
      </div>
    </div>
  )
}

// ─── FieldInput helper ─────────────────────────────────────────────────────────
function FieldInput({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold">{label}</Label>
      <Input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="h-11 rounded-xl" />
    </div>
  )
}
