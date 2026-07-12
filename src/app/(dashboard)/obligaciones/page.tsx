"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Plus, CheckCircle2, Pencil, Trash2,
  AlertTriangle, Coffee, ShoppingBag, Eye, EyeOff, Wallet as WalletIcon, PiggyBank, CircleDollarSign,
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
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { useMemo } from "react"
import { DebtSimulator } from "@/components/recommendations/debt-simulator"
import { analyzeFinances } from "@/lib/recommendations"
import { userApi, WalletState } from "@/lib/api-client"
import { useBudgetCategories, detectBudgetCategory } from "@/hooks/use-budget-categories"
import Link from "next/link"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Tab = "gastos_fijos" | "deudas" | "gastos_hormiga"
type ItemType = "deuda" | "gasto_fijo"
type EditScope = "este_mes" | "permanente"

interface DebtForm {
  nombre: string
  montoTotal: string
  cuotaPeriodo: string
  diasPago: string
  diaCorte: string
  frecuencia: "mensual" | "quincenal"
  tipoPago: "unica" | "varias"
  fechaFinalProyectada: string
  numCuotas: string
}
interface FixedForm { nombre: string; monto: string; frecuencia: "mensual" | "quincenal"; diasPago: string }

const emptyDebtForm: DebtForm = {
  nombre: "", montoTotal: "", cuotaPeriodo: "", diasPago: "",
  diaCorte: "", frecuencia: "mensual", tipoPago: "unica",
  fechaFinalProyectada: "", numCuotas: "",
}
const emptyFixedForm: FixedForm = { nombre: "", monto: "", frecuencia: "mensual", diasPago: "" }

const CATEGORIES: { value: ImpulseCategory; label: string; emoji: string }[] = [
  { value: "cafe",       label: "Café",       emoji: "☕" },
  { value: "comida",     label: "Comida",     emoji: "🍔" },
  { value: "transporte", label: "Transporte", emoji: "🚕" },
  { value: "antojo",     label: "Antojo",     emoji: "🍫" },
  { value: "salida",     label: "Salida",     emoji: "🎉" },
  { value: "otro",       label: "Otro",       emoji: "💸" },
]

export default function ObligacionesPage() {
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("obligaciones")
  const {
    debts, fixedExpenses, loading,
    addDebt, updateDebt, deleteDebt,
    addFixedExpense, updateFixedExpense, deleteFixedExpense,
    markPaid, undoPayDebt, markFixedPaid, undoPayFixed,
    impulseExpenses, impulseThisPeriod, totalImpulseThisPeriod,
    addImpulseExpense, removeImpulseExpense,
    extraIncomes,
  } = useFinanceData()
  const { formatAmount, income, incomeFrequency } = useAppContext()

  // Categorías del presupuesto del usuario (para el modal de gastos hormiga)
  const { budgetCategories } = useBudgetCategories()

  // ── Tab activa ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("gastos_fijos")

  // ── Filtro de estado (Todas / Pendientes / Pagadas) ────────────────────────
  const [statusFilter, setStatusFilter] = useState<"todas" | "pendientes" | "pagadas">("todas")

  // ── Items ocultos (ojo) ────────────────────────────────────────────────────
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())
  const toggleItemHidden = (id: string) => setHiddenItems(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // ── Asignación de presupuesto — distribución dinámica del periodo actual ──
  const { allocation, periodData } = usePeriodBudget()
  const dailyFreeAmount = allocation?.dailyFreeAmount ?? 0

  // IDs de obligaciones que son PRIORIDAD del periodo actual (para resaltar en amarillo)
  const periodPriorityIds = useMemo(() => {
    const ids = new Set<string>()
    periodData.periodDebts.forEach(d => ids.add(d.id))
    periodData.periodFixed.forEach(f => ids.add(f.id))
    return ids
  }, [periodData.periodDebts, periodData.periodFixed])

  // Estrategias de deuda
  const recommendations = useMemo(
    () => allocation ? analyzeFinances(allocation, debts, incomeFrequency) : null,
    [allocation, debts, incomeFrequency]
  )

  // ── Pay modal (deudas) ─────────────────────────────────────────────────────
  const [payDebt, setPayDebt] = useState<Debt | null>(null)
  const [isPartialMode, setIsPartialMode] = useState(false)
  const [partialAmount, setPartialAmount] = useState("")

  // ── Pay modal (gastos fijos) ───────────────────────────────────────────────
  const [payFixed, setPayFixed] = useState<FixedExpense | null>(null)
  const [isFixedPartialMode, setIsFixedPartialMode] = useState(false)
  const [fixedPartialAmount, setFixedPartialAmount] = useState("")

  // ── Saldo insuficiente modal ───────────────────────────────────────────────
  const [insufficientOpen, setInsufficientOpen] = useState(false)
  const [insufficientTarget, setInsufficientTarget] = useState<{ type: "debt" | "fixed"; id: string; nombre: string; monto: number } | null>(null)
  const [quickIncomeOpen, setQuickIncomeOpen] = useState(false)
  const [quickIncomeMonto, setQuickIncomeMonto] = useState("")
  const [savingsSourceOpen, setSavingsSourceOpen] = useState(false)
  const [savingsPockets, setSavingsPockets] = useState<{ id: string; nombre: string; acumulado: number }[]>([])
  const [fondoEmergencia, setFondoEmergencia] = useState(0)

  // ── Wallet state ───────────────────────────────────────────────────────────
  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  useEffect(() => {
    userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) })
    // Cargar bolsillos de ahorro y fondo de emergencia
    try {
      const raw = localStorage.getItem("kiri_saving_pockets")
      if (raw) setSavingsPockets(JSON.parse(raw))
    } catch {}
    import("@/lib/api-client").then(({ emergencyFundApi }) => {
      emergencyFundApi.get().then(({ data }) => { if (data?.fondoActual != null) setFondoEmergencia(data.fondoActual) })
    })
  }, [])

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
  const openPay = (debt: Debt) => {
    // Interceptar si no hay saldo suficiente
    if (wallet.cashBalance < debt.cuotaPeriodo) {
      setInsufficientTarget({ type: "debt", id: debt.id, nombre: debt.nombre, monto: debt.cuotaPeriodo })
      setInsufficientOpen(true)
      return
    }
    setPayDebt(debt); setIsPartialMode(false); setPartialAmount("")
  }

  const confirmFullPay = async () => {
    if (!payDebt) return
    await markPaid(payDebt.id)
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setPayDebt(null)
  }

  const confirmPartialPay = async () => {
    if (!payDebt || !partialAmount) return
    const amt = Number(partialAmount)
    await markPaid(payDebt.id, amt)
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setPayDebt(null)
  }

  // ── Handlers Pay Fixed ────────────────────────────────────────────────────
  const openPayFixed = (fe: FixedExpense) => {
    if (wallet.cashBalance < fe.monto) {
      setInsufficientTarget({ type: "fixed", id: fe.id, nombre: fe.nombre, monto: fe.monto })
      setInsufficientOpen(true)
      return
    }
    setPayFixed(fe); setIsFixedPartialMode(false); setFixedPartialAmount("")
  }

  const confirmFullPayFixed = async () => {
    if (!payFixed) return
    await markFixedPaid(payFixed.id)
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setPayFixed(null)
  }

  const confirmPartialPayFixed = async () => {
    if (!payFixed || !fixedPartialAmount) return
    await markFixedPaid(payFixed.id, Number(fixedPartialAmount))
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setPayFixed(null)
  }

  // ── Handlers Saldo Insuficiente ───────────────────────────────────────────
  const handleInsufficientPartial = async () => {
    if (!insufficientTarget) return
    const amt = wallet.cashBalance
    if (insufficientTarget.type === "debt") {
      await markPaid(insufficientTarget.id, amt)
    } else {
      await markFixedPaid(insufficientTarget.id, amt)
    }
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setInsufficientOpen(false); setInsufficientTarget(null)
  }

  const handleInsufficientFromSavings = async () => {
    // Abrir selector de fuente (bolsillos de ahorro o fondo de emergencia)
    setSavingsSourceOpen(true)
  }

  const handleWithdrawFromPocket = async (pocketId: string) => {
    if (!insufficientTarget) return
    const needed = insufficientTarget.monto - wallet.cashBalance
    const pocket = savingsPockets.find(p => p.id === pocketId)
    if (!pocket || pocket.acumulado < needed) return

    // Retirar del bolsillo local
    const updated = savingsPockets.map(p => p.id === pocketId ? { ...p, acumulado: p.acumulado - needed } : p)
    setSavingsPockets(updated)
    localStorage.setItem("kiri_saving_pockets", JSON.stringify(updated))

    // Retirar del wallet → suma a cashBalance
    await userApi.walletWithdraw(needed, 'ahorro')

    // Ahora pagar la obligación
    if (insufficientTarget.type === "debt") {
      await markPaid(insufficientTarget.id)
    } else {
      await markFixedPaid(insufficientTarget.id)
    }
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setSavingsSourceOpen(false); setInsufficientOpen(false); setInsufficientTarget(null)
  }

  const handleWithdrawFromEmergency = async () => {
    if (!insufficientTarget) return
    const needed = insufficientTarget.monto - wallet.cashBalance
    if (fondoEmergencia < needed) return

    // Retirar del fondo de emergencia
    const { emergencyFundApi } = await import("@/lib/api-client")
    const { data: fundData } = await emergencyFundApi.transaction(needed, "retiro")
    if (fundData) setFondoEmergencia(fundData.fondoActual)

    // Sumar al cashBalance
    await userApi.walletWithdraw(needed, 'ahorro')

    // Pagar la obligación
    if (insufficientTarget.type === "debt") {
      await markPaid(insufficientTarget.id)
    } else {
      await markFixedPaid(insufficientTarget.id)
    }
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setSavingsSourceOpen(false); setInsufficientOpen(false); setInsufficientTarget(null)
  }

  const handleQuickIncome = async () => {
    const amt = Number(quickIncomeMonto)
    if (amt <= 0) return
    await userApi.walletIncome(amt, 'extra')
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setQuickIncomeOpen(false); setQuickIncomeMonto("")
    setInsufficientOpen(false); setInsufficientTarget(null)
  }

  // ── Handlers Add ──────────────────────────────────────────────────────────
  const handleAdd = async () => {
    setSaving(true)
    if (addType === "deuda") {
      if (!addDebtForm.nombre || !addDebtForm.montoTotal || !addDebtForm.diasPago) { setSaving(false); return }
      // Si varias cuotas y se usó calculadora, la cuota ya está en addDebtForm.cuotaPeriodo
      const cuota = addDebtForm.cuotaPeriodo ? Number(addDebtForm.cuotaPeriodo) : 0
      await addDebt({
        nombre: addDebtForm.nombre,
        montoTotal: Number(addDebtForm.montoTotal),
        cuotaPeriodo: cuota,
        diasPago: addDebtForm.diasPago,
      })
      setAddDebtForm(emptyDebtForm)
    } else {
      if (!addFixedForm.nombre || !addFixedForm.monto || !addFixedForm.diasPago) { setSaving(false); return }
      await addFixedExpense({ nombre: addFixedForm.nombre, monto: Number(addFixedForm.monto), fechaCorte: addFixedForm.diasPago, frecuencia: addFixedForm.frecuencia })
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
      diasPago: debt.diasPago ?? '1',
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
    const patch: Partial<Pick<Debt, "nombre" | "montoTotal" | "cuotaPeriodo" | "diasPago">> = {
      nombre: editDebtForm.nombre,
      montoTotal: Number(editDebtForm.montoTotal),
      diasPago: editDebtForm.diasPago,
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
    setEditFixedForm({ nombre: fe.nombre, monto: String(fe.monto), frecuencia: (fe.frecuencia as "mensual" | "quincenal") ?? "mensual", diasPago: fe.fechaCorte })
  }

  const handleEditFixed = async () => {
    if (!editFixed) return
    setSavingFixed(true)
    await updateFixedExpense(editFixed.id, {
      nombre: editFixedForm.nombre,
      monto: Number(editFixedForm.monto),
      fechaCorte: editFixedForm.diasPago,
      frecuencia: editFixedForm.frecuencia,
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
  const [insufficientImpulseOpen, setInsufficientImpulseOpen] = useState(false)
  const [pendingImpulse, setPendingImpulse] = useState<{ nombre: string; monto: number; categoria: ImpulseCategory } | null>(null)

  const handleAddImpulse = async () => {
    if (!impulseNombre || !impulseMonto || Number(impulseMonto) <= 0) return
    const monto = Number(impulseMonto)

    // Verificar si excede el presupuesto blindado ANTES de registrar
    const newTotal = totalImpulseThisPeriod + monto
    if (dailyFreeAmount > 0 && newTotal > dailyFreeAmount) {
      // Bloquear — mostrar modal de opciones
      setPendingImpulse({ nombre: impulseNombre, monto, categoria: impulseCategoria })
      setImpulseModalOpen(false)
      setInsufficientImpulseOpen(true)
      return
    }

    // Si hay presupuesto suficiente, registrar normalmente
    setSavingImpulse(true)
    const result = await addImpulseExpense({ nombre: impulseNombre, monto, categoria: impulseCategoria })
    setSavingImpulse(false)
    if (result) {
      setLastAddedImpulseId(result.id)
      setImpulseModalOpen(false)
    }
    setImpulseNombre("")
    setImpulseMonto("")
    setImpulseCategoria("cafe")
  }

  // Opciones del modal de insuficiencia para impulse
  const handleImpulseForceRegister = async () => {
    // Registrar de todas formas (usar más del presupuesto asignado)
    if (!pendingImpulse) return
    setSavingImpulse(true)
    await addImpulseExpense(pendingImpulse)
    setSavingImpulse(false)
    setInsufficientImpulseOpen(false)
    setPendingImpulse(null)
    setImpulseNombre("")
    setImpulseMonto("")
    setImpulseCategoria("cafe")
  }

  const handleImpulseUseSavings = async () => {
    // Usar ahorro para cubrir y registrar
    if (!pendingImpulse) return
    setSavingImpulse(true)
    await addImpulseExpense(pendingImpulse)
    setSavingImpulse(false)
    setInsufficientImpulseOpen(false)
    setPendingImpulse(null)
    setImpulseNombre("")
    setImpulseMonto("")
    setImpulseCategoria("cafe")
  }

  const handleImpulseCancel = () => {
    setInsufficientImpulseOpen(false)
    setPendingImpulse(null)
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
    <>
      {showTutorial && <TutorialSlider module="obligaciones" onClose={dismissTutorial} />}
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
          debtCapacity={wallet.cashBalance > 0 ? Math.max(0, (() => {
            const obligTotal = periodData.periodDebts.reduce((a, d) => a + d.cuotaPeriodo, 0) + periodData.periodFixed.reduce((a, f) => a + f.monto, 0)
            const rem = Math.max(0, wallet.cashBalance - obligTotal)
            const remPct = wallet.cashBalance > 0 ? (rem / wallet.cashBalance) * 100 : 0
            const savPct = remPct >= 40 ? 20 : remPct >= 25 ? 15 : remPct >= 15 ? 10 : 5
            const savAmt = Math.min((savPct / 100) * wallet.cashBalance, rem)
            const afterSav = rem - savAmt
            const maxFree = (15 / 100) * wallet.cashBalance
            return afterSav - Math.min(afterSav, maxFree)
          })()) : 0}
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
          {/* Filtros */}
          <div className="flex gap-2">
            {(["todas", "pendientes", "pagadas"] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
                statusFilter === f ? "bg-cyclon-periwinkle text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                {f === "todas" ? "Todas" : f === "pendientes" ? "Pendientes" : "Pagadas"}
              </button>
            ))}
          </div>

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
              {[...fixedExpenses]
                .filter(fe => statusFilter === "todas" ? true : statusFilter === "pendientes" ? !fe.pagadoEstePeriodo : fe.pagadoEstePeriodo)
                .sort((a, b) => {
                  if (a.pagadoEstePeriodo !== b.pagadoEstePeriodo) return a.pagadoEstePeriodo ? 1 : -1
                  return 0
                }).map(fe => (
                <FixedCard
                  key={fe.id}
                  item={fe}
                  formatAmount={formatAmount}
                  onEdit={() => openEditFixed(fe)}
                  onDelete={() => setDeleteTarget({ type: "fixed", id: fe.id, nombre: fe.nombre })}
                  onTogglePaid={async () => {
                    if (fe.pagadoEstePeriodo) {
                      const walletData = await undoPayFixed(fe.id)
                      if (walletData) setWallet(walletData)
                    } else {
                      openPayFixed(fe)
                    }
                  }}
                  hidden={hiddenItems.has(fe.id)}
                  onToggleHidden={() => toggleItemHidden(fe.id)}
                  isPeriodPriority={periodPriorityIds.has(fe.id)}
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
          {/* Filtros */}
          <div className="flex gap-2">
            {(["todas", "pendientes", "pagadas"] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
                statusFilter === f ? "bg-cyclon-periwinkle text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                {f === "todas" ? "Todas" : f === "pendientes" ? "Pendientes" : "Pagadas"}
              </button>
            ))}
          </div>

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
              {[...debts]
                .filter(d => statusFilter === "todas" ? true : statusFilter === "pendientes" ? !d.pagadoEstePeriodo : d.pagadoEstePeriodo)
                .sort((a, b) => {
                  if (a.pagadoEstePeriodo !== b.pagadoEstePeriodo) return a.pagadoEstePeriodo ? 1 : -1
                  return 0
                }).map(debt => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  formatAmount={formatAmount}
                  onPay={() => openPay(debt)}
                  onUndoPay={async () => { const w = await undoPayDebt(debt.id); if (w) setWallet(w) }}
                  onEdit={() => openEditDebt(debt)}
                  onDelete={() => setDeleteTarget({ type: "debt", id: debt.id, nombre: debt.nombre })}
                  hidden={hiddenItems.has(debt.id)}
                  onToggleHidden={() => toggleItemHidden(debt.id)}
                  isPeriodPriority={periodPriorityIds.has(debt.id)}
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
              Pagar ({formatAmount(payDebt?.cuotaPeriodo ?? 0)})
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

      {/* Pay Fixed Modal */}
      <Dialog open={!!payFixed} onOpenChange={v => !v && setPayFixed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Ya pagaste?</DialogTitle>
            <DialogDescription>Gasto fijo: <strong>{payFixed?.nombre}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-3 flex flex-col gap-3">
            <Button onClick={confirmFullPayFixed} className="bg-cyclon-mint text-cyclon-periwinkle hover:bg-cyclon-mint/80 h-14 text-base font-bold rounded-2xl gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Pagar ({formatAmount(payFixed?.monto ?? 0)})
            </Button>
            <Button variant="outline" onClick={() => setIsFixedPartialMode(v => !v)} className="h-12 font-medium rounded-2xl border-dashed border-2 text-sm">
              ¿Pagaste otro valor?
            </Button>
            <div className={cn("overflow-hidden transition-all duration-300", isFixedPartialMode ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Monto real pagado</Label>
                  <MoneyInput value={fixedPartialAmount} onChange={v => setFixedPartialAmount(v)} className="h-12 text-xl font-bold rounded-xl" placeholder="0" autoFocus={isFixedPartialMode} />
                  <p className="text-[10px] text-muted-foreground">Si pagaste más o menos del valor esperado ({formatAmount(payFixed?.monto ?? 0)}), registra el monto real aquí.</p>
                </div>
                <Button onClick={confirmPartialPayFixed} disabled={!fixedPartialAmount || Number(fixedPartialAmount) <= 0} className="w-full bg-cyclon-periwinkle text-white font-bold h-11 rounded-xl">
                  Confirmar pago
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Saldo Insuficiente Modal */}
      <Dialog open={insufficientOpen} onOpenChange={v => { if (!v) { setInsufficientOpen(false); setInsufficientTarget(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" /> Saldo insuficiente
            </DialogTitle>
            <DialogDescription>
              Tu sueldo disponible actual ({formatAmount(wallet.cashBalance)}) no es suficiente para cubrir esta cuota de <strong>{formatAmount(insufficientTarget?.monto ?? 0)}</strong> de <strong>{insufficientTarget?.nombre}</strong>. ¿Cómo te gustaría proceder?
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 flex flex-col gap-2.5">
            {/* Opción 1: Abono parcial */}
            <button onClick={handleInsufficientPartial}
              disabled={wallet.cashBalance <= 0}
              className={cn("w-full text-left p-4 rounded-2xl border-2 border-cyclon-sky/40 bg-cyclon-sky/5 hover:border-cyclon-sky transition-colors space-y-0.5", wallet.cashBalance <= 0 && "opacity-40 cursor-not-allowed hover:border-cyclon-sky/40")}>
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-cyclon-sky" />
                <p className="font-bold text-sm">Abono parcial</p>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {wallet.cashBalance > 0 ? `Abonar mis ${formatAmount(wallet.cashBalance)} disponibles` : "No tienes saldo disponible"}
              </p>
            </button>

            {/* Opción 2: Usar ahorros (solo si hay fondos) */}
            {(savingsPockets.reduce((a, p) => a + p.acumulado, 0) + fondoEmergencia) > 0 && (
              <button onClick={handleInsufficientFromSavings}
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/10 hover:border-emerald-400 transition-colors space-y-0.5">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-emerald-600" />
                  <p className="font-bold text-sm">Usar Ahorros</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Completar usando mis ahorros ({formatAmount(savingsPockets.reduce((a, p) => a + p.acumulado, 0) + fondoEmergencia)} disponibles)
                </p>
              </button>
            )}

            {/* Opción 3: Registrar ingreso rápido */}
            <button onClick={() => { setQuickIncomeOpen(true) }} className="w-full text-left p-4 rounded-2xl border-2 border-cyclon-lavender/40 bg-cyclon-lavender/5 hover:border-cyclon-lavender transition-colors space-y-0.5">
              <div className="flex items-center gap-2">
                <WalletIcon className="h-4 w-4 text-cyclon-lavender" />
                <p className="font-bold text-sm">Registrar nuevo ingreso</p>
              </div>
              <p className="text-xs text-muted-foreground pl-6">Agregar dinero extra para cubrir la cuota</p>
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setInsufficientOpen(false); setInsufficientTarget(null) }}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Income Modal (dentro del flujo de saldo insuficiente) */}
      <Dialog open={quickIncomeOpen} onOpenChange={v => { if (!v) setQuickIncomeOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><WalletIcon className="h-5 w-5 text-cyclon-lavender" /> Agregar dinero extra</DialogTitle>
            <DialogDescription>Inyecta liquidez a tu sueldo real para cubrir la cuota.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monto</Label>
              <MoneyInput value={quickIncomeMonto} onChange={setQuickIncomeMonto} className="h-14 text-2xl font-bold bg-muted/30 border-none rounded-2xl" placeholder="0" autoFocus />
              {insufficientTarget && (
                <p className="text-[10px] text-muted-foreground">
                  Te faltan al menos {formatAmount(Math.max(0, (insufficientTarget.monto) - wallet.cashBalance))} para cubrir la cuota
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setQuickIncomeOpen(false)}>Cancelar</Button>
            <Button onClick={handleQuickIncome} disabled={!quickIncomeMonto || Number(quickIncomeMonto) <= 0}
              className="bg-cyclon-lavender text-white font-bold rounded-xl px-6">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Savings Source Selector (elegir de dónde sacar) */}
      <Dialog open={savingsSourceOpen} onOpenChange={v => { if (!v) setSavingsSourceOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5 text-emerald-600" /> ¿De dónde sacar?</DialogTitle>
            <DialogDescription>
              Necesitas {formatAmount(Math.max(0, (insufficientTarget?.monto ?? 0) - wallet.cashBalance))} adicionales. Elige de dónde tomar los fondos.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2.5 max-h-[300px] overflow-y-auto">
            {/* Fondo de emergencia */}
            {fondoEmergencia > 0 && (
              <button onClick={handleWithdrawFromEmergency}
                disabled={fondoEmergencia < ((insufficientTarget?.monto ?? 0) - wallet.cashBalance)}
                className="w-full text-left p-4 rounded-2xl border-2 border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/10 hover:border-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛡️</span>
                    <div>
                      <p className="font-bold text-sm">Fondo de Emergencia</p>
                      <p className="text-[10px] text-muted-foreground">Disponible: {formatAmount(fondoEmergencia)}</p>
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* Bolsillos de ahorro */}
            {savingsPockets.filter(p => p.acumulado > 0).map(pocket => (
              <button key={pocket.id} onClick={() => handleWithdrawFromPocket(pocket.id)}
                disabled={pocket.acumulado < ((insufficientTarget?.monto ?? 0) - wallet.cashBalance)}
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/10 hover:border-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🐷</span>
                    <div>
                      <p className="font-bold text-sm">{pocket.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">Disponible: {formatAmount(pocket.acumulado)}</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {savingsPockets.filter(p => p.acumulado > 0).length === 0 && fondoEmergencia === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No tienes fondos de ahorro disponibles.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSavingsSourceOpen(false)}>Cancelar</Button>
          </DialogFooter>
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
              <FixedFormFields form={addFixedForm} onChange={setAddFixedForm} />
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
            <FixedFormFields form={editFixedForm} onChange={setEditFixedForm} />
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
                onChange={e => {
                  setImpulseNombre(e.target.value)
                  // Auto-detectar categoría del presupuesto
                  const detected = detectBudgetCategory(e.target.value, budgetCategories)
                  if (detected) {
                    // Mapear a ImpulseCategory más cercana
                    const lower = detected.toLowerCase()
                    if (lower.includes("alimenta") || lower.includes("comida")) setImpulseCategoria("comida")
                    else if (lower.includes("transport")) setImpulseCategoria("transporte")
                    else if (lower.includes("ocio") || lower.includes("salida")) setImpulseCategoria("salida")
                    else if (lower.includes("cafe") || lower.includes("café")) setImpulseCategoria("cafe")
                    else if (lower.includes("antojo") || lower.includes("compra")) setImpulseCategoria("antojo")
                    else setImpulseCategoria("otro")
                  }
                }}
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
              {/* Categorías del presupuesto del usuario */}
              {budgetCategories.length > 0 && (
                <>
                  <p className="text-[9px] text-muted-foreground mb-1">De tu presupuesto:</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {budgetCategories.map(bc => {
                      // Determinar qué ImpulseCategory mapea
                      const lower = bc.name.toLowerCase()
                      const mapped: ImpulseCategory = lower.includes("alimenta") || lower.includes("comida") ? "comida"
                        : lower.includes("transport") ? "transporte"
                        : lower.includes("ocio") || lower.includes("salida") ? "salida"
                        : lower.includes("cafe") || lower.includes("café") ? "cafe"
                        : lower.includes("antojo") || lower.includes("compra") ? "antojo"
                        : "otro"
                      const isSelected = impulseCategoria === mapped
                      return (
                        <button
                          key={bc.id}
                          onClick={() => setImpulseCategoria(mapped)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-colors",
                            isSelected
                              ? "border-cyclon-pink bg-cyclon-pink/5 text-cyclon-pink"
                              : "border-muted text-muted-foreground hover:border-cyclon-pink/30"
                          )}
                        >
                          <div className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: bc.color }}>
                            {bc.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[9px] font-bold truncate max-w-full">{bc.name}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[9px] text-muted-foreground mb-1">Generales:</p>
                </>
              )}
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

      {/* Gasto Hormiga — Modal de presupuesto insuficiente */}
      <Dialog open={insufficientImpulseOpen} onOpenChange={v => !v && handleImpulseCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-5 w-5" /> Presupuesto insuficiente</DialogTitle>
            <DialogDescription>
              Tu gasto libre disponible ({formatAmount(Math.max(0, dailyFreeAmount - totalImpulseThisPeriod))}) no alcanza para cubrir este gasto de <strong>{formatAmount(pendingImpulse?.monto ?? 0)}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Card className="border-none bg-red-500/5 rounded-2xl">
              <CardContent className="p-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Disponible en gasto libre</p>
                <p className="text-lg font-black">{formatAmount(Math.max(0, dailyFreeAmount - totalImpulseThisPeriod))}</p>
                <p className="text-xs text-red-500 font-bold">
                  Necesitas: {formatAmount(pendingImpulse?.monto ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-2 pt-2">
            {/* Opción 1: Usar más del presupuesto (si tiene cashBalance) */}
            {wallet.cashBalance > 0 && (
              <button
                onClick={handleImpulseForceRegister}
                className="w-full text-left p-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 hover:border-amber-500 transition-colors space-y-0.5"
              >
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-amber-500" />
                  <p className="font-bold text-sm">Usar más del presupuesto asignado</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Registrar de todas formas. Excederás tu gasto libre blindado.
                </p>
              </button>
            )}

            {/* Opción 2: Usar ahorro */}
            {(wallet.ahorro > 0 || fondoEmergencia > 0) && (
              <button
                onClick={handleImpulseUseSavings}
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500 transition-colors space-y-0.5"
              >
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-emerald-500" />
                  <p className="font-bold text-sm">Usar ahorro</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Cubrir con tu ahorro disponible ({formatAmount(wallet.ahorro + fondoEmergencia)}).
                </p>
              </button>
            )}

            {/* Opción 3: Registrar como nueva deuda */}
            <Link href="/obligaciones" onClick={() => { setInsufficientImpulseOpen(false); setActiveTab("deudas") }}>
              <button className="w-full text-left p-4 rounded-2xl border-2 border-cyclon-lavender/40 bg-cyclon-lavender/5 hover:border-cyclon-lavender transition-colors space-y-0.5">
                <div className="flex items-center gap-2">
                  <WalletIcon className="h-4 w-4 text-cyclon-lavender" />
                  <p className="font-bold text-sm">Registrar como nueva deuda</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Si pediste prestado para cubrir este gasto, regístralo como obligación.
                </p>
              </button>
            </Link>

            {/* Cancelar */}
            <Button variant="ghost" onClick={handleImpulseCancel} className="w-full text-muted-foreground mt-1">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gasto Hormiga Warning (legacy — por si pasa sin interceptar) */}
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
    </>
  )
}

// ─── Helper: próxima fecha de pago inteligente ────────────────────────────────
function getNextPaymentInfo(diasPago: string, pagadoEstePeriodo: boolean): {
  nextDate: string; daysUntil: number
  status: 'pagado' | 'proximo' | 'pendiente' | 'vencido'
  statusLabel: string; statusColor: string; cardRing: string
} {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const days = diasPago.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 1 && d <= 31)
  if (days.length === 0) days.push(1)

  if (pagadoEstePeriodo) {
    const nextDate = new Date(currentYear, currentMonth + 1, days[0])
    const label = nextDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    return { nextDate: label, daysUntil: 999, status: 'pagado', statusLabel: 'Pagado ✓', statusColor: 'text-emerald-600', cardRing: '' }
  }

  let closest: Date | null = null
  for (const day of days) {
    const thisMonth = new Date(currentYear, currentMonth, day)
    if (thisMonth >= today && (!closest || thisMonth < closest)) closest = thisMonth
  }
  if (!closest) closest = new Date(currentYear, currentMonth + 1, days[0])

  const diffMs = closest.getTime() - today.getTime()
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const label = closest.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

  if (daysUntil < 0) return { nextDate: label, daysUntil, status: 'vencido', statusLabel: `Vencido (${Math.abs(daysUntil)}d)`, statusColor: 'text-red-500', cardRing: 'ring-1 ring-red-500/40' }
  if (daysUntil <= 3) return { nextDate: label, daysUntil, status: 'proximo', statusLabel: daysUntil === 0 ? 'Vence hoy' : `Vence en ${daysUntil}d`, statusColor: 'text-amber-600', cardRing: 'ring-1 ring-amber-400/40' }
  return { nextDate: label, daysUntil, status: 'pendiente', statusLabel: 'Pendiente', statusColor: 'text-muted-foreground', cardRing: '' }
}

// ─── DebtCard ──────────────────────────────────────────────────────────────────
function DebtCard({ debt, formatAmount, onPay, onUndoPay, onEdit, onDelete, hidden, onToggleHidden, isPeriodPriority }: {
  debt: Debt; formatAmount: (n: number) => string
  onPay: () => void; onUndoPay: () => void; onEdit: () => void; onDelete: () => void
  hidden: boolean; onToggleHidden: () => void; isPeriodPriority?: boolean
}) {
  const cuotasRestantes = debt.cuotaPeriodo > 0 ? Math.ceil(debt.saldoRestante / debt.cuotaPeriodo) : 0
  const progreso = debt.montoTotal > 0 ? Math.round(((debt.montoTotal - debt.saldoRestante) / debt.montoTotal) * 100) : 0
  const payInfo = getNextPaymentInfo(debt.diasPago, debt.pagadoEstePeriodo)

  // Yellow highlight for period priority (pending in current period)
  const priorityRing = isPeriodPriority && !debt.pagadoEstePeriodo ? "ring-2 ring-amber-400/60 bg-amber-500/5" : ""

  return (
    <Card className={cn("border-none shadow-sm transition-all bg-card", payInfo.cardRing, priorityRing, debt.estado === 'saldada' && "opacity-40")}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm truncate">{hidden ? "••••••" : debt.nombre}</h3>
              <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0",
                payInfo.status === 'pagado' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                payInfo.status === 'vencido' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                payInfo.status === 'proximo' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              )}>{payInfo.statusLabel}</span>
            </div>
            {!hidden && debt.acreedor && <p className="text-[10px] text-muted-foreground truncate">{debt.acreedor}</p>}
            {!hidden && (
              <p className={cn("text-[10px] font-medium mt-0.5", payInfo.statusColor)}>
                {payInfo.status === 'pagado' ? `Próximo: ${payInfo.nextDate}` : payInfo.nextDate}
                {" · "}{debt.frecuenciaPago === 'quincenal' ? 'Quincenal' : 'Mensual'}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={onToggleHidden} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors">
              {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onEdit} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-cyclon-lavender hover:bg-cyclon-lavender/10 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Montos */}
        {!hidden ? (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">Saldo restante</p>
              <p className="text-xl font-black">{formatAmount(debt.saldoRestante)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">
                {debt.pagadoEstePeriodo && debt.montoPagadoEstePeriodo ? "Pagado" : "Cuota"}
              </p>
              <p className="text-sm font-bold">
                {debt.pagadoEstePeriodo && debt.montoPagadoEstePeriodo
                  ? formatAmount(debt.montoPagadoEstePeriodo)
                  : formatAmount(debt.cuotaPeriodo)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xl font-black text-muted-foreground">••••••</p>
        )}

        {/* Barra de progreso + cuotas restantes */}
        {!hidden && (
          <div className="space-y-1.5">
            <Progress value={progreso} className="h-1.5" indicatorClassName="bg-cyclon-periwinkle" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">{progreso}% pagado</span>
              <span className="text-[10px] font-bold bg-cyclon-periwinkle/10 text-cyclon-periwinkle px-2 py-0.5 rounded-full">
                {cuotasRestantes} cuotas restantes
              </span>
            </div>
          </div>
        )}

        {/* Botón de pagar */}
        {!debt.pagadoEstePeriodo && debt.estado === 'activa' && (
          <Button onClick={onPay} size="sm" className="w-full bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">
            Registrar pago de cuota
          </Button>
        )}
        {debt.pagadoEstePeriodo && (
          <Button onClick={onUndoPay} size="sm" variant="ghost" className="w-full rounded-xl h-9 text-xs text-muted-foreground">
            Deshacer pago
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ─── FixedCard ─────────────────────────────────────────────────────────────────
function FixedCard({ item, formatAmount, onEdit, onDelete, onTogglePaid, hidden, onToggleHidden, isPeriodPriority }: {
  item: FixedExpense; formatAmount: (n: number) => string
  onEdit: () => void; onDelete: () => void; onTogglePaid: () => void
  hidden: boolean; onToggleHidden: () => void; isPeriodPriority?: boolean
}) {
  const payInfo = getNextPaymentInfo(item.fechaCorte, item.pagadoEstePeriodo)

  // Yellow highlight for period priority
  const priorityRing = isPeriodPriority && !item.pagadoEstePeriodo ? "ring-2 ring-amber-400/60 bg-amber-500/5" : ""

  return (
    <Card className={cn("border-none shadow-sm transition-all bg-card", payInfo.cardRing, priorityRing)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm truncate">{hidden ? "••••••" : item.nombre}</h3>
              <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0",
                payInfo.status === 'pagado' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                payInfo.status === 'vencido' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                payInfo.status === 'proximo' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                "bg-muted text-muted-foreground"
              )}>{payInfo.statusLabel}</span>
            </div>
            {!hidden && (
              <p className={cn("text-[10px] font-medium mt-0.5", payInfo.statusColor)}>
                {payInfo.status === 'pagado' ? `Próximo: ${payInfo.nextDate}` : payInfo.nextDate}
                {" · "}{item.frecuencia === 'quincenal' ? 'Quincenal' : 'Mensual'}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={onToggleHidden} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors">
              {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onEdit} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-cyclon-lavender hover:bg-cyclon-lavender/10 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {!hidden ? <p className="text-xl font-black">{formatAmount(item.monto)}</p> : <p className="text-xl font-black text-muted-foreground">••••••</p>}
        {!item.pagadoEstePeriodo
          ? <Button onClick={onTogglePaid} size="sm" className="w-full bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">Registrar pago</Button>
          : <Button onClick={onTogglePaid} size="sm" variant="ghost" className="w-full rounded-xl h-9 text-xs text-muted-foreground">Deshacer pago</Button>
        }
      </CardContent>
    </Card>
  )
}

// ─── DebtFormFields — formulario inteligente de deuda ────────────────────────
function DebtFormFields({
  form,
  onChange,
  isEdit = false,
}: {
  form: DebtForm
  onChange: (f: DebtForm) => void
  isEdit?: boolean
}) {
  const set = (patch: Partial<DebtForm>) => onChange({ ...form, ...patch })

  // Cálculo reactivo: cuotas restantes
  const cuotasEstimadas = (() => {
    const total = Number(form.montoTotal)
    const cuota = Number(form.cuotaPeriodo)
    if (!total || !cuota || cuota <= 0) return null
    return Math.ceil(total / cuota)
  })()

  return (
    <div className="space-y-4">
      {/* Acreedor */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Acreedor</Label>
        <Input placeholder="Ej: Banco Falabella" value={form.nombre} onChange={e => set({ nombre: e.target.value })} className="h-11 rounded-xl" />
      </div>

      {/* Monto total de la deuda */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Monto total de la deuda</Label>
        <MoneyInput value={form.montoTotal} onChange={v => set({ montoTotal: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
      </div>

      {/* Cuota por periodo */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Cuota por periodo</Label>
        <MoneyInput value={form.cuotaPeriodo} onChange={v => set({ cuotaPeriodo: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
      </div>

      {/* Frecuencia de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Frecuencia de pago</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["mensual", "quincenal"] as const).map(f => (
            <button key={f} type="button" onClick={() => set({ frecuencia: f })} className={cn(
              "h-10 rounded-xl text-sm font-bold border-2 transition-colors capitalize",
              form.frecuencia === f ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle" : "border-muted text-muted-foreground hover:border-cyclon-periwinkle/40"
            )}>{f}</button>
          ))}
        </div>
      </div>

      {/* Días de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">
          {form.frecuencia === "quincenal" ? "Días de pago (quincenal)" : "Día de pago"}
        </Label>
        {form.frecuencia === "quincenal" ? (
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={15} placeholder="15"
              value={form.diasPago.split(',')[0] || ''}
              onChange={e => {
                const d2 = form.diasPago.split(',')[1] || '30'
                set({ diasPago: `${e.target.value},${d2}` })
              }}
              className="h-11 rounded-xl w-20 text-center font-bold" />
            <span className="text-muted-foreground font-bold">y</span>
            <Input type="number" min={16} max={31} placeholder="30"
              value={form.diasPago.split(',')[1] || ''}
              onChange={e => {
                const d1 = form.diasPago.split(',')[0] || '15'
                set({ diasPago: `${d1},${e.target.value}` })
              }}
              className="h-11 rounded-xl w-20 text-center font-bold" />
          </div>
        ) : (
          <Input type="number" min={1} max={31} placeholder="Ej: 15"
            value={form.diasPago}
            onChange={e => set({ diasPago: e.target.value })}
            className="h-11 rounded-xl w-24 text-center font-bold text-lg" />
        )}
        <p className="text-[9px] text-muted-foreground">
          {form.frecuencia === "quincenal" ? "Ej: 1 y 15 ó 15 y 30" : "Día del mes en que se paga"}
        </p>
      </div>

      {/* Cálculo reactivo */}
      {cuotasEstimadas && cuotasEstimadas > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-3 flex items-center gap-3">
          <span className="text-lg">✅</span>
          <div>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
              Pagarás esta deuda en aproximadamente {cuotasEstimadas} cuotas
            </p>
            <p className="text-[10px] text-muted-foreground">
              Cálculo: {form.montoTotal ? `$${Number(form.montoTotal).toLocaleString()}` : '?'} / {form.cuotaPeriodo ? `$${Number(form.cuotaPeriodo).toLocaleString()}` : '?'} = {cuotasEstimadas}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FixedFormFields — formulario de gasto fijo ─────────────────────────────
function FixedFormFields({
  form,
  onChange,
}: {
  form: FixedForm
  onChange: (f: FixedForm) => void
}) {
  const set = (patch: Partial<FixedForm>) => onChange({ ...form, ...patch })

  return (
    <div className="space-y-4">
      {/* Nombre */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Nombre</Label>
        <Input placeholder="Ej: Netflix, Arriendo, Luz" value={form.nombre} onChange={e => set({ nombre: e.target.value })} className="h-11 rounded-xl" />
      </div>

      {/* Monto */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Monto</Label>
        <MoneyInput value={form.monto} onChange={v => set({ monto: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
      </div>

      {/* Frecuencia de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Frecuencia de pago</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["mensual", "quincenal"] as const).map(f => (
            <button key={f} type="button" onClick={() => set({ frecuencia: f })} className={cn(
              "h-10 rounded-xl text-sm font-bold border-2 transition-colors capitalize",
              form.frecuencia === f ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle" : "border-muted text-muted-foreground hover:border-cyclon-periwinkle/40"
            )}>{f}</button>
          ))}
        </div>
      </div>

      {/* Días de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">
          {form.frecuencia === "quincenal" ? "Días de pago (quincenal)" : "Día de pago"}
        </Label>
        {form.frecuencia === "quincenal" ? (
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={15} placeholder="15"
              value={form.diasPago.split(',')[0] || ''}
              onChange={e => {
                const d2 = form.diasPago.split(',')[1] || '30'
                set({ diasPago: `${e.target.value},${d2}` })
              }}
              className="h-11 rounded-xl w-20 text-center font-bold" />
            <span className="text-muted-foreground font-bold">y</span>
            <Input type="number" min={16} max={31} placeholder="30"
              value={form.diasPago.split(',')[1] || ''}
              onChange={e => {
                const d1 = form.diasPago.split(',')[0] || '15'
                set({ diasPago: `${d1},${e.target.value}` })
              }}
              className="h-11 rounded-xl w-20 text-center font-bold" />
          </div>
        ) : (
          <Input type="number" min={1} max={31} placeholder="Ej: 15"
            value={form.diasPago}
            onChange={e => set({ diasPago: e.target.value })}
            className="h-11 rounded-xl w-24 text-center font-bold text-lg" />
        )}
        <p className="text-[9px] text-muted-foreground">
          {form.frecuencia === "quincenal" ? "Ej: 1 y 15 ó 15 y 30" : "Día del mes en que se cobra"}
        </p>
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
