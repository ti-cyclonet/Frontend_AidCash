"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Plus, CheckCircle2, Pencil, Trash2, ReceiptText,
  AlertTriangle, Eye, EyeOff, Wallet as WalletIcon, PiggyBank, CircleDollarSign, Users,
  ChevronDown, ChevronUp, PartyPopper,
} from "lucide-react"
import { Debt, FixedExpense } from "@/lib/types"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { getNextPaymentInfo } from "@/lib/payment-schedule"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useAppContext } from "@/lib/app-context"
import { useBudgetCategories, detectBudgetCategory } from "@/hooks/use-budget-categories"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { useMemo } from "react"
import { DebtSimulator } from "@/components/recommendations/debt-simulator"
import { analyzeFinances } from "@/lib/recommendations"
import { userApi, WalletState, loansApi } from "@/lib/api-client"
import { debtsApi, fixedExpensesApi, impulseApi, budgetCategoriesApi } from "@/lib/api-client"
import { DebtRegistrationForm } from "@/components/obligaciones/DebtRegistrationForm"
import { BudgetCategorySelector } from "@/components/obligaciones/BudgetCategorySelector"
import { getObligationIcon, calculateDebtStrategy } from "@/lib/obligation-icons"
import { isCreditCard } from "@/lib/debt-utils"
import { AnimatedBalance } from "@/components/ui/animated-balance"
import { CelebrationModal } from "@/components/ui/celebration-modal"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import type { Loan } from "@/lib/types"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Tab = "gastos_fijos" | "deudas"
type ItemType = "deuda" | "gasto_fijo"
type EditScope = "este_mes" | "permanente"

interface DebtForm {
  nombre: string
  montoTotal: string
  saldoRestante: string
  cuotaPeriodo: string
  diasPago: string
  diaCorte: string
  frecuencia: "mensual" | "quincenal"
  tipoPago: "unica" | "varias"
  fechaFinalProyectada: string
  numCuotas: string
  budgetCategoryId?: string | null
}
interface FixedForm { nombre: string; monto: string; frecuencia: "mensual" | "quincenal"; diasPago: string; yaPagoEstePeriodo?: boolean; nuevaProximoPeriodo?: boolean; tarjetaVinculadaId?: string | null; budgetCategoryId?: string | null }

const emptyDebtForm: DebtForm = {
  nombre: "", montoTotal: "", saldoRestante: "", cuotaPeriodo: "", diasPago: "",
  diaCorte: "", frecuencia: "mensual", tipoPago: "unica",
  fechaFinalProyectada: "", numCuotas: "",
}
const emptyFixedForm: FixedForm = { nombre: "", monto: "", frecuencia: "mensual", diasPago: "" }

export default function ObligacionesPage() {
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("obligaciones")
  const {
    debts, fixedExpenses, loading,
    addDebt, updateDebt, deleteDebt,
    addFixedExpense, updateFixedExpense, deleteFixedExpense,
    markPaid, undoPayDebt, markFixedPaid, undoPayFixed,
    extraIncomes, addImpulseExpense,
  } = useFinanceData()
  const { formatAmount, income, incomeFrequency } = useAppContext()
  const { user: authUser } = useAuth()
  const { toast } = useToast()

  // ── Celebración al liquidar una deuda por completo ──────────────────────────
  // Antes esto pasaba en silencio: la tarjeta quedaba atenuada y luego
  // desaparecía del todo en el próximo refetch (ver GET /debts, filtra por
  // estado=activa) sin que la app dijera nada de "listo, la terminaste".
  const [celebration, setCelebration] = useState<{ icon: string; title: string; subtitle: string } | null>(null)
  const payAndCelebrate = async (debtId: string, monto?: number) => {
    const result = await markPaid(debtId, monto)
    if (result?.liquidada) {
      setCelebration({
        icon: "🎉",
        title: `¡Terminaste de pagar "${result.nombre}"!`,
        subtitle: "Una deuda menos, un paso más cerca de tu libertad financiera.",
      })
    }
    return result
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const { budgetCategories } = useBudgetCategories()

  // Llegar desde Presupuesto → "Registrar gasto" en una categoría abre este
  // modal directo con esa categoría ya elegida (ver BudgetRadialChart.tsx).
  useEffect(() => {
    if (searchParams.get('registrarGasto') !== '1') return
    const categoria = searchParams.get('categoria')
    if (categoria) setExpCategoria(categoria)
    setExpenseModalOpen(true)
    router.replace('/obligaciones', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── Préstamos sociales (solo ACTIVE donde soy borrower) ────────────────────
  const [socialLoans, setSocialLoans] = useState<Loan[]>([])
  useEffect(() => {
    loansApi.list().then(({ data }) => {
      if (data?.loans) {
        const activeLoans = (data.loans as unknown as Loan[]).filter(
          l => l.status === "ACTIVE" && l.borrowerId === authUser?.id
        )
        setSocialLoans(activeLoans)
      }
    }).catch(() => {})
  }, [authUser?.id])

  // ── Tab activa ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("gastos_fijos")

  // ── Deudas saldadas (pagadas por completo) ──────────────────────────────────
  // GET /debts por defecto solo trae estado=activa (correcto para el saldo
  // total y las cuentas de arriba) — sin esto, una deuda que se terminaba de
  // pagar quedaba visible nada más hasta el próximo refetch y después
  // desaparecía de Obligaciones por completo, sin dejar ningún rastro acá
  // (solo seguía viéndose en el historial de Balance).
  const [settledDebts, setSettledDebts] = useState<Record<string, unknown>[]>([])
  const [showSettled, setShowSettled] = useState(false)
  useEffect(() => {
    if (activeTab !== "deudas") return
    debtsApi.list('saldada').then(({ data }) => {
      if (data?.debts) setSettledDebts(data.debts)
    })
  }, [activeTab, celebration])

  // ── Filtro de estado (Todas / Pendientes / Pagadas) ────────────────────────
  const [statusFilter, setStatusFilter] = useState<"todas" | "pendientes" | "pagadas">("todas")

  // ── Items ocultos (ojo) — persistente en localStorage ────────────────────
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try { return new Set(JSON.parse(localStorage.getItem("kiri_hidden_obligations") ?? "[]")) }
    catch { return new Set() }
  })
  const toggleItemHidden = (id: string) => setHiddenItems(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    localStorage.setItem("kiri_hidden_obligations", JSON.stringify([...next]))
    return next
  })

  // ── Asignación de presupuesto — distribución dinámica del periodo actual ──
  const { allocation, periodData } = usePeriodBudget()

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
  const [showTCOptions, setShowTCOptions] = useState(false)
  const [tcCuotas, setTcCuotas] = useState("1")
  const [selectedTC, setSelectedTC] = useState<string | null>(null)

  // TC options for debt payment modal
  const [showDebtTCOptions, setShowDebtTCOptions] = useState(false)
  const [debtTcCuotas, setDebtTcCuotas] = useState("1")
  const [selectedDebtTC, setSelectedDebtTC] = useState<string | null>(null)

  // ── Modal "Configurar pago automático" (solo gastos fijos) ────────────────
  const [autoPayTarget, setAutoPayTarget] = useState<FixedExpense | null>(null)
  const [autoPaySelectedTC, setAutoPaySelectedTC] = useState<string | null>(null)

  // ── Saldo insuficiente modal ───────────────────────────────────────────────
  const [insufficientOpen, setInsufficientOpen] = useState(false)
  const [insufficientTarget, setInsufficientTarget] = useState<{ type: "debt" | "fixed"; id: string; nombre: string; monto: number } | null>(null)
  const [insufficientSelectedTC, setInsufficientSelectedTC] = useState<string | null>(null)
  const [insufficientTcCuotas, setInsufficientTcCuotas] = useState("1")
  const [payingInsufficientTC, setPayingInsufficientTC] = useState(false)
  const [quickIncomeOpen, setQuickIncomeOpen] = useState(false)
  const [quickIncomeMonto, setQuickIncomeMonto] = useState("")
  const [savingsSourceOpen, setSavingsSourceOpen] = useState(false)
  const [savingsPockets, setSavingsPockets] = useState<{ id: string; nombre: string; acumulado: number }[]>([])
  const [fondoEmergencia, setFondoEmergencia] = useState(0)

  // ── Wallet state ───────────────────────────────────────────────────────────
  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  useEffect(() => {
    userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) })
    const refresh = () => { userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) }) }
    window.addEventListener("kiri:wallet-updated", refresh)
    return () => window.removeEventListener("kiri:wallet-updated", refresh)
  }, [])

  useEffect(() => {
    // Cargar bolsillos de ahorro y fondo de emergencia — bolsillos vienen del
    // backend (savingsPocketsApi), no de localStorage: ese `kiri_saving_pockets`
    // es la clave legacy que la página de Ahorro dejó de escribir hace tiempo
    // (ver comentario en ahorro/page.tsx), así que acá siempre quedaba vacía o
    // desactualizada aunque el usuario sí tuviera plata ahorrada de verdad.
    import("@/lib/api-client").then(({ emergencyFundApi, savingsPocketsApi }) => {
      emergencyFundApi.get().then(({ data }) => { if (data?.fondoActual != null) setFondoEmergencia(data.fondoActual) })
      savingsPocketsApi.list().then(({ data }) => {
        // `montoActual` llega como STRING desde el backend (Decimal de Prisma
        // serializado en JSON) — sin este Number(), sumar dos bolsillos con
        // `+` hacía concatenación de texto en vez de suma ("500000"+"0" =
        // "0500000"), inflando el total mostrado en "Usar Ahorros" muy por
        // encima del dinero real (mostraba $5,000,000 cuando solo había
        // $500,000 — cada bolsillo individual se veía bien porque ese caso sí
        // formateaba el valor crudo sin sumarlo primero).
        if (data?.pockets) setSavingsPockets(data.pockets.map(p => ({ id: p.id, nombre: p.nombre, acumulado: Number(p.montoActual) })))
      })
    })
  }, [])

  // ── Sugerencia de vincular gasto fijo a categoría ─────────────────────────
  const [categorySuggestion, setCategorySuggestion] = useState<{ fixedId: string; fixedName: string; suggestedCategory: string; monto: number } | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setCategorySuggestion(detail)
    }
    window.addEventListener('kiri:suggest-category-link', handler)
    return () => window.removeEventListener('kiri:suggest-category-link', handler)
  }, [])

  const handleAcceptCategorySuggestion = async () => {
    if (!categorySuggestion) return
    const { fixedId, fixedName, suggestedCategory, monto } = categorySuggestion
    // 1. Vincular el gasto fijo a la categoría (backend real)
    try {
      const { data } = await budgetCategoriesApi.list()
      const cat = data?.categories.find(c => c.nombre === suggestedCategory)
      if (cat) {
        await budgetCategoriesApi.update(cat.id, {
          linkedFixedExpenseIds: [...(cat.linkedFixedExpenseIds ?? []), fixedId],
        })
      }
    } catch { /* ignore */ }
    // 2. Registrar el gasto en la categoría
    await impulseApi.create({ nombre: `[${suggestedCategory}] ${fixedName} (gasto fijo)`, monto, categoria: 'otro' })
    setCategorySuggestion(null)
  }

  // ── Add modal ──────────────────────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addType, setAddType] = useState<ItemType>("deuda")

  // ── Modal registrar gasto (desde Obligaciones) ─────────────────────────────
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expNombre, setExpNombre] = useState("")
  const [expMonto, setExpMonto] = useState("")
  const [expSaving, setExpSaving] = useState(false)
  const [expCategoria, setExpCategoria] = useState<string | null>(null)
  const [expShowTCOptions, setExpShowTCOptions] = useState(false)
  const [expSelectedTC, setExpSelectedTC] = useState<string | null>(null)
  const [expTcCuotas, setExpTcCuotas] = useState("1")
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

  // ── Handlers Pay ──────────────────────────────────────────────────────────
  const openPay = (debt: Debt) => {
    // Si el saldo no alcanza, SIEMPRE mostrar el aviso de saldo insuficiente
    // (con sus alternativas: abono parcial, ahorros, tarjeta, nuevo ingreso)
    // — antes solo se mostraba si además no había ninguna tarjeta disponible,
    // así que cualquier usuario con una tarjeta (incluso sin relación con
    // este pago) saltaba directo al modal normal, cuyo botón "Pagar" no
    // valida saldo suficiente: podía dejar cashBalance en negativo sin aviso.
    // (comparar contra lo que REALMENTE falta, no la cuota completa si ya hubo un abono)
    const restante = Math.max(0, debt.cuotaPeriodo - (debt.montoPagadoEstePeriodo ?? 0))
    if (wallet.cashBalance < restante) {
      setInsufficientTarget({ type: "debt", id: debt.id, nombre: debt.nombre, monto: restante })
      setInsufficientOpen(true)
      return
    }
    setPayDebt(debt); setIsPartialMode(false); setPartialAmount(""); setShowDebtTCOptions(false); setSelectedDebtTC(null); setDebtTcCuotas("1")
  }

  const confirmFullPay = async () => {
    if (!payDebt) return
    // Si ya hay un abono parcial este periodo, "pagar" debe cubrir solo lo que
    // falta — no la cuota completa de nuevo (si no, se paga de más).
    const restante = payDebt.cuotaPeriodo - (payDebt.montoPagadoEstePeriodo ?? 0)
    await payAndCelebrate(payDebt.id, restante > 0 ? restante : undefined)
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setPayDebt(null)
  }

  const confirmPartialPay = async () => {
    if (!payDebt || !partialAmount) return
    const amt = Number(partialAmount)
    await payAndCelebrate(payDebt.id, amt)
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setPayDebt(null)
  }

  // ── Abonar extra a una deuda YA pagada este periodo ──────────────────────────
  // Antes, una vez marcada "pagadoEstePeriodo", la tarjeta solo mostraba
  // "Deshacer pago" — si el usuario quería meterle más plata a la deuda (ej.
  // le llegó un bono y quiere adelantar capital) no tenía forma de hacerlo sin
  // deshacer el pago de la cuota primero. El backend (payDebtServer) ya suma
  // cualquier monto extra sin problema — solo faltaba la entrada en la UI.
  const [abonoTarget, setAbonoTarget] = useState<Debt | null>(null)
  const [abonoAmount, setAbonoAmount] = useState("")
  const [abonoSaving, setAbonoSaving] = useState(false)

  const confirmAbono = async () => {
    if (!abonoTarget || !abonoAmount) return
    const amt = Number(abonoAmount)
    if (amt <= 0 || amt > wallet.cashBalance) return
    setAbonoSaving(true)
    await payAndCelebrate(abonoTarget.id, amt)
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setAbonoSaving(false)
    setAbonoTarget(null)
    setAbonoAmount("")
  }

  // ── Handlers Pay Fixed ────────────────────────────────────────────────────
  const openPayFixed = (fe: FixedExpense) => {
    // Mismo criterio que openPay: el aviso de saldo insuficiente se muestra
    // siempre que el saldo no alcance, sin importar si hay tarjetas.
    const montoPorPeriodo = fe.frecuencia === "quincenal" ? Math.round(fe.monto / 2) : fe.monto
    const restante = Math.max(0, montoPorPeriodo - ((fe as any).montoPagadoEstePeriodo ?? 0))
    if (wallet.cashBalance < restante) {
      setInsufficientTarget({ type: "fixed", id: fe.id, nombre: fe.nombre, monto: restante })
      setInsufficientOpen(true)
      return
    }
    setPayFixed(fe); setIsFixedPartialMode(false); setFixedPartialAmount(""); setShowTCOptions(false); setSelectedTC(null); setTcCuotas("1")
  }

  const confirmFullPayFixed = async () => {
    if (!payFixed) return
    // Igual que con deudas: si ya hay un abono parcial este periodo, completar
    // solo lo que falta — no el monto del periodo de nuevo.
    const montoPorPeriodo = payFixed.frecuencia === "quincenal" ? Math.round(payFixed.monto / 2) : payFixed.monto
    const restante = montoPorPeriodo - ((payFixed as any).montoPagadoEstePeriodo ?? 0)
    await markFixedPaid(payFixed.id, restante > 0 ? restante : undefined)
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
      await payAndCelebrate(insufficientTarget.id, amt)
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

    // Retirar del bolsillo de verdad (backend) — antes esto solo tocaba un
    // estado local + localStorage que la página de Ahorro ya no lee ni
    // escribe, así que el bolsillo real nunca bajaba y quedaba desincronizado
    // del saldo que sí se le devolvía a la billetera. El endpoint ya acredita
    // cashBalance/walletAhorro atómicamente, así que no hace falta un
    // walletWithdraw aparte.
    const { savingsPocketsApi } = await import("@/lib/api-client")
    const { error } = await savingsPocketsApi.withdraw(pocketId, needed)
    if (error) return
    setSavingsPockets(prev => prev.map(p => p.id === pocketId ? { ...p, acumulado: p.acumulado - needed } : p))

    // Ahora pagar la obligación
    if (insufficientTarget.type === "debt") {
      await payAndCelebrate(insufficientTarget.id)
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
      await payAndCelebrate(insufficientTarget.id)
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
      if (!addDebtForm.nombre || !addDebtForm.montoTotal || !addDebtForm.diasPago) {
        setSaving(false)
        toast({ title: "Faltan datos", description: "Completa nombre, monto total y día(s) de pago.", variant: "destructive" })
        return
      }
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
      if (!addFixedForm.nombre || !addFixedForm.monto || !addFixedForm.diasPago) {
        setSaving(false)
        toast({ title: "Faltan datos", description: "Completa nombre, monto y día(s) de pago.", variant: "destructive" })
        return
      }
      await addFixedExpense({
        nombre: addFixedForm.nombre,
        monto: Number(addFixedForm.monto),
        fechaCorte: addFixedForm.diasPago,
        frecuencia: addFixedForm.frecuencia,
        yaPagoEstePeriodo: addFixedForm.yaPagoEstePeriodo,
        nuevaProximoPeriodo: addFixedForm.nuevaProximoPeriodo,
        tarjetaVinculadaId: addFixedForm.tarjetaVinculadaId,
        budgetCategoryId: addFixedForm.budgetCategoryId,
      })
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
      saldoRestante: String(debt.saldoRestante),
      cuotaPeriodo: String(debt.cuotaPeriodo),
      diasPago: debt.diasPago ?? '1',
      diaCorte: "",
      frecuencia: (debt.frecuenciaPago as "mensual" | "quincenal") || "mensual",
      tipoPago: "unica",
      fechaFinalProyectada: "",
      numCuotas: "",
      budgetCategoryId: debt.budgetCategoryId ?? null,
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
    const newMontoTotal = Number(editDebtForm.montoTotal)
    const newSaldoRestante = Number(editDebtForm.saldoRestante)
    const patch: Record<string, unknown> = {
      nombre: editDebtForm.nombre,
      montoTotal: newMontoTotal,
      saldoRestante: newSaldoRestante || newMontoTotal,
      diasPago: editDebtForm.diasPago,
      frecuenciaPago: editDebtForm.frecuencia,
      budgetCategoryId: editDebtForm.budgetCategoryId ?? null,
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
    setEditFixedForm({
      nombre: fe.nombre,
      monto: String(fe.monto),
      frecuencia: (fe.frecuencia as "mensual" | "quincenal") ?? "mensual",
      diasPago: fe.fechaCorte,
      tarjetaVinculadaId: fe.tarjetaVinculadaId ?? null,
      budgetCategoryId: fe.budgetCategoryId ?? null,
    })
  }

  const handleEditFixed = async () => {
    if (!editFixed) return
    setSavingFixed(true)
    await updateFixedExpense(editFixed.id, {
      nombre: editFixedForm.nombre,
      monto: Number(editFixedForm.monto),
      fechaCorte: editFixedForm.diasPago,
      frecuencia: editFixedForm.frecuencia,
      tarjetaVinculadaId: editFixedForm.tarjetaVinculadaId ?? null,
      budgetCategoryId: editFixedForm.budgetCategoryId ?? null,
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


  // ── Saldo visible toggle ─────────────────────────────────────────────────
  const [showSaldo, setShowSaldo] = useState(true)

  return (
    <>
      {showTutorial && <TutorialSlider module="obligaciones" onClose={dismissTutorial} />}
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-cyclon-periwinkle truncate">Obligaciones</h1>
          <p className="text-muted-foreground text-xs sm:text-sm truncate">Gestiona tus compromisos y gastos.</p>
        </div>
        {/* Cluster de acciones: siempre en la misma fila que el título, pegado
            a la derecha de la pantalla — en mobile los botones se comprimen a
            solo ícono para que quepan sin empujar el título ni saltar de fila. */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <AnimatedBalance value={wallet.cashBalance} formatAmount={formatAmount} label="Saldo total" showToggle={false} className="scale-90 sm:scale-100 origin-right" />
          {/* Botón Registrar gasto — abre modal de presupuesto.
              En mobile antes quedaba como puro ícono de recibo sin ningún
              texto (el label completo se ocultaba con `hidden sm:inline`) —
              al lado del botón "+" (también verde) era imposible saber para
              qué servía. Se le agrega un label corto SIEMPRE visible (ícono
              arriba, texto abajo) en vez de ocultarlo del todo. */}
          <Button
            size="sm"
            variant="outline"
            className="flex-col h-auto py-1.5 gap-0.5 rounded-xl border-kiri-emerald/30 text-kiri-emerald hover:bg-kiri-emerald/5 font-bold px-2 sm:flex-row sm:h-9 sm:py-0 sm:gap-1 sm:px-3 sm:text-xs"
            onClick={() => { setAddType("gasto_fijo"); setExpenseModalOpen(true) }}
            aria-label="Registrar gasto"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            <span className="text-[8px] leading-none sm:hidden">Gasto</span>
            <span className="hidden sm:inline">Registrar gasto</span>
          </Button>
          {(activeTab === "gastos_fijos" || activeTab === "deudas") && (
            <Button
              size="sm"
              className="rounded-xl bg-cyclon-periwinkle shadow-sm font-bold text-xs gap-1 px-2.5 sm:px-3"
              onClick={() => {
                setAddType(activeTab === "deudas" ? "deuda" : "gasto_fijo")
                setIsAddOpen(true)
              }}
              aria-label={activeTab === "deudas" ? "Nueva deuda" : "Nuevo gasto fijo"}
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{activeTab === "deudas" ? "Nueva deuda" : "Nuevo gasto fijo"}</span>
            </Button>
          )}
        </div>
      </header>

      {/* ── Sugerencia: vincular gasto fijo a categoría ── */}
      {categorySuggestion && (
        <Card className="border-2 border-kiri-emerald/30 bg-kiri-emerald/5 rounded-2xl animate-in fade-in slide-in-from-top-2">
          <CardContent className="p-4 flex items-start gap-3">
            <span className="text-lg shrink-0">🌱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-kiri-emerald">Kiri sugiere vincular este gasto</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                &ldquo;{categorySuggestion.fixedName}&rdquo; parece pertenecer a la categoría <strong>{categorySuggestion.suggestedCategory}</strong>. ¿Deseas registrarlo ahí para que se contabilice en tu presupuesto?
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setCategorySuggestion(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted">No</button>
              <button onClick={handleAcceptCategorySuggestion} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-kiri-emerald text-white hover:bg-kiri-emerald/90">Sí, vincular</button>
            </div>
          </CardContent>
        </Card>
      )}

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
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: "gastos_fijos" as Tab, label: "Gastos Fijos" },
          { key: "deudas" as Tab,       label: "Deudas" },
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
                  tarjetaNombre={debts.find(d => d.id === fe.tarjetaVinculadaId)?.nombre}
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
                  onUndoPay={async () => {
                    const walletData = await undoPayFixed(fe.id)
                    if (walletData) setWallet(walletData)
                  }}
                  hidden={hiddenItems.has(fe.id)}
                  onToggleHidden={() => toggleItemHidden(fe.id)}
                  isPeriodPriority={periodPriorityIds.has(fe.id)}
                  onToggleAutoPay={() => {
                    setAutoPaySelectedTC(fe.tarjetaVinculadaId ?? null)
                    setAutoPayTarget(fe)
                  }}
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
              {(() => {
                // Calcular estrategia de deuda para resaltar la prioritaria
                const debtStrategy = calculateDebtStrategy(debts)
                return [...debts]
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
                    onAbonar={() => { setAbonoTarget(debt); setAbonoAmount("") }}
                    onEdit={() => openEditDebt(debt)}
                    onDelete={() => setDeleteTarget({ type: "debt", id: debt.id, nombre: debt.nombre })}
                    hidden={hiddenItems.has(debt.id)}
                    onToggleHidden={() => toggleItemHidden(debt.id)}
                    isPeriodPriority={periodPriorityIds.has(debt.id)}
                    onToggleAutoPay={async () => {
                      await updateDebt(debt.id, { pagoAutomatico: !debt.pagoAutomatico })
                    }}
                    strategyBadge={debtStrategy?.priorityDebtId === debt.id ? debtStrategy.priorityLabel : null}
                  />
                ))
              })()}
            </>
          )}
          <Link href="/balance" className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-cyclon-lavender/70 hover:text-cyclon-lavender transition-colors pt-1">
            Ver historial completo en Balance →
          </Link>

          {/* ── Deudas saldadas — pagadas por completo, ya no aparecen arriba ── */}
          {settledDebts.length > 0 && (
            <div className="pt-3 border-t border-border/50">
              <button
                onClick={() => setShowSettled(v => !v)}
                className="w-full flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                <span className="flex items-center gap-1.5">
                  <PartyPopper className="h-3.5 w-3.5 text-emerald-500" /> Deudas saldadas ({settledDebts.length})
                </span>
                {showSettled ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showSettled && (
                <div className="space-y-2 mt-2">
                  {settledDebts.map(d => (
                    <Card key={d.id as string} className="border-none bg-emerald-500/5 rounded-2xl">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{d.nombre as string}</p>
                          <p className="text-[10px] text-muted-foreground">Pagada por completo · {formatAmount(Number(d.montoTotal))}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Préstamos Sociales (P2P aprobados) ── */}
          {socialLoans.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border/50">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Préstamos P2P
              </p>
              {socialLoans.map(loan => {
                const lenderName = loan.lender?.nombre ?? "Prestamista"
                const pct = loan.amount > 0 ? Math.round(((loan.amount - loan.remainingAmount) / loan.amount) * 100) : 0
                return (
                  <Card
                    key={loan.id}
                    className="border-none bg-card shadow-sm rounded-2xl cursor-pointer hover:ring-2 hover:ring-cyclon-lavender/30 transition-all"
                    onClick={() => router.push("/social")}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-cyclon-lavender/20 flex items-center justify-center shrink-0">
                          <Users className="h-5 w-5 text-cyclon-lavender" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">Le debo a {lenderName}</p>
                          <p className="text-[10px] text-muted-foreground">{loan.descripcion || "Préstamo P2P"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-amber-600">{formatAmount(loan.remainingAmount)}</p>
                          <p className="text-[9px] text-muted-foreground">de {formatAmount(loan.amount)}</p>
                        </div>
                      </div>
                      <Progress value={pct} className="h-1.5" indicatorClassName="bg-cyclon-lavender" />
                      <p className="text-[8px] text-cyclon-lavender font-bold text-center">
                        Toca para pagar en Social →
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}


      {/* ════ MODALES ════ */}

      {/* Pay Modal */}
      <Dialog open={!!payDebt} onOpenChange={v => { if (!v) { setPayDebt(null); setShowDebtTCOptions(false); setSelectedDebtTC(null); setDebtTcCuotas("1") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Ya pagaste?</DialogTitle>
            <DialogDescription>Obligación: <strong>{payDebt?.nombre}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-3 flex flex-col gap-3">
            <Button onClick={confirmFullPay} className="bg-cyclon-mint text-cyclon-periwinkle hover:bg-cyclon-mint/80 h-14 text-base font-bold rounded-2xl gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Pagar ({formatAmount(Math.max(0, (payDebt?.cuotaPeriodo ?? 0) - (payDebt?.montoPagadoEstePeriodo ?? 0)))})
            </Button>

            {/* Opción: Pagar con tarjeta de crédito */}
            {(() => {
              const tarjetas = debts.filter(d => d.estado === 'activa' && d.id !== payDebt?.id && isCreditCard(d))
              if (tarjetas.length === 0) return null
              return (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setShowDebtTCOptions(v => !v); setSelectedDebtTC(null); setDebtTcCuotas("1") }}
                    className="h-12 rounded-2xl border-2 border-amber-500/40 text-amber-600 hover:bg-amber-500/5 font-bold text-sm gap-2"
                  >
                    <CircleDollarSign className="h-4 w-4" />
                    Pagar con Tarjeta de Crédito
                  </Button>
                  {showDebtTCOptions && (
                    <div className="space-y-3 pl-2">
                      {tarjetas.map(tc => (
                        <button
                          key={tc.id}
                          onClick={() => setSelectedDebtTC(tc.id === selectedDebtTC ? null : tc.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-left",
                            selectedDebtTC === tc.id
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
                          )}
                        >
                          <div>
                            <p className="text-xs font-bold">{tc.nombre}</p>
                            <p className="text-[9px] text-muted-foreground">Saldo: {formatAmount(tc.saldoRestante)} · Cuota: {formatAmount(tc.cuotaPeriodo)}</p>
                          </div>
                          <span className="text-[10px] font-bold text-amber-500">{selectedDebtTC === tc.id ? "✓" : "Seleccionar"}</span>
                        </button>
                      ))}
                      {selectedDebtTC && (
                        <div className="space-y-3 pt-2 border-t border-border/50">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold">¿A cuántas cuotas?</Label>
                            <Input
                              type="number"
                              min="1"
                              max="48"
                              value={debtTcCuotas}
                              onChange={e => setDebtTcCuotas(e.target.value)}
                              className="h-10 rounded-xl text-center font-bold"
                            />
                            <p className="text-[10px] text-muted-foreground">
                              Se sumará <strong>{formatAmount(Math.round(Math.max(0, (payDebt?.cuotaPeriodo ?? 0) - (payDebt?.montoPagadoEstePeriodo ?? 0)) / (Number(debtTcCuotas) || 1)))}/mes</strong> a la cuota de la tarjeta durante {debtTcCuotas} {Number(debtTcCuotas) === 1 ? "mes" : "meses"}.
                            </p>
                          </div>
                          <Button
                            onClick={async () => {
                              if (!payDebt || !selectedDebtTC) return
                              const monto = Math.max(0, payDebt.cuotaPeriodo - (payDebt.montoPagadoEstePeriodo ?? 0))
                              const cuotas = Number(debtTcCuotas) || 1
                              await debtsApi.payWithCard({
                                tarjetaId: selectedDebtTC,
                                monto,
                                cuotas,
                                sourceType: 'debt',
                                sourceId: payDebt.id,
                              })
                              setPayDebt(null); setShowDebtTCOptions(false); setSelectedDebtTC(null); setDebtTcCuotas("1")
                              window.location.reload()
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 rounded-xl"
                          >
                            Confirmar pago con TC
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

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

      {/* Abonar extra a una deuda ya pagada este periodo */}
      <Dialog open={!!abonoTarget} onOpenChange={v => { if (!v) { setAbonoTarget(null); setAbonoAmount("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abonar a esta deuda</DialogTitle>
            <DialogDescription>
              <strong>{abonoTarget?.nombre}</strong> · Saldo restante: {formatAmount(abonoTarget?.saldoRestante ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto a abonar</Label>
              <MoneyInput value={abonoAmount} onChange={v => setAbonoAmount(v)} className="h-12 text-xl font-bold rounded-xl" placeholder="0" autoFocus />
              <p className="text-[10px] text-muted-foreground">Se descuenta de tu saldo disponible ({formatAmount(wallet.cashBalance)}) y se abona directo al capital de la deuda.</p>
            </div>
            {Number(abonoAmount) > wallet.cashBalance && (
              <p className="text-[10px] text-red-500 font-bold">No tienes saldo suficiente para este abono.</p>
            )}
            <Button
              onClick={confirmAbono}
              disabled={abonoSaving || !abonoAmount || Number(abonoAmount) <= 0 || Number(abonoAmount) > wallet.cashBalance}
              className="w-full bg-cyclon-periwinkle text-white font-bold h-11 rounded-xl"
            >
              {abonoSaving ? "Abonando..." : "Confirmar abono"}
            </Button>
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
            {/* Opción 1: Pagar del sueldo real */}
            <Button onClick={confirmFullPayFixed} className="bg-cyclon-mint text-cyclon-periwinkle hover:bg-cyclon-mint/80 h-14 text-base font-bold rounded-2xl gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Pagar ({formatAmount(Math.max(0, (payFixed?.frecuencia === "quincenal" ? Math.round((payFixed?.monto ?? 0) / 2) : (payFixed?.monto ?? 0)) - ((payFixed as any)?.montoPagadoEstePeriodo ?? 0)))})
            </Button>

            {/* Opción 2: Pagar con tarjeta de crédito */}
            {(() => {
              const tarjetas = debts.filter(d => d.estado === 'activa' && isCreditCard(d))
              if (tarjetas.length === 0) return null
              return (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setShowTCOptions(v => !v); setSelectedTC(null); setTcCuotas("1") }}
                    className="h-12 rounded-2xl border-2 border-amber-500/40 text-amber-600 hover:bg-amber-500/5 font-bold text-sm gap-2"
                  >
                    <CircleDollarSign className="h-4 w-4" />
                    Pagar con Tarjeta de Crédito
                  </Button>
                  {showTCOptions && (
                    <div className="space-y-3 pl-2">
                      {tarjetas.map(tc => (
                        <button
                          key={tc.id}
                          onClick={() => setSelectedTC(tc.id === selectedTC ? null : tc.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-left",
                            selectedTC === tc.id
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
                          )}
                        >
                          <div>
                            <p className="text-xs font-bold">{tc.nombre}</p>
                            <p className="text-[9px] text-muted-foreground">Saldo: {formatAmount(tc.saldoRestante)} · Cuota: {formatAmount(tc.cuotaPeriodo)}</p>
                          </div>
                          <span className="text-[10px] font-bold text-amber-500">{selectedTC === tc.id ? "✓" : "Seleccionar"}</span>
                        </button>
                      ))}
                      {selectedTC && (
                        <div className="space-y-3 pt-2 border-t border-border/50">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold">¿A cuántas cuotas?</Label>
                            <Input
                              type="number"
                              min="1"
                              max="48"
                              value={tcCuotas}
                              onChange={e => setTcCuotas(e.target.value)}
                              className="h-10 rounded-xl text-center font-bold"
                            />
                            {(() => {
                              const montoPorPeriodo = payFixed?.frecuencia === "quincenal" ? Math.round((payFixed?.monto ?? 0) / 2) : (payFixed?.monto ?? 0)
                              const montoFijo = Math.max(0, montoPorPeriodo - ((payFixed as any)?.montoPagadoEstePeriodo ?? 0))
                              const cuotasNum = Number(tcCuotas) || 1
                              return (
                                <p className="text-[10px] text-muted-foreground">
                                  Se sumará <strong>{formatAmount(Math.round(montoFijo / cuotasNum))}/mes</strong> a la cuota de la tarjeta durante {tcCuotas} {cuotasNum === 1 ? "mes" : "meses"}.
                                </p>
                              )
                            })()}
                          </div>
                          <Button
                            onClick={async () => {
                              if (!payFixed || !selectedTC) return
                              const montoPorPeriodo = payFixed.frecuencia === "quincenal" ? Math.round(payFixed.monto / 2) : payFixed.monto
                              const monto = Math.max(0, montoPorPeriodo - ((payFixed as any).montoPagadoEstePeriodo ?? 0))
                              const cuotas = Number(tcCuotas) || 1
                              await debtsApi.payWithCard({
                                tarjetaId: selectedTC,
                                monto,
                                cuotas,
                                sourceType: 'fixed',
                                sourceId: payFixed.id,
                              })
                              setPayFixed(null); setShowTCOptions(false); setSelectedTC(null); setTcCuotas("1")
                              window.location.reload()
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 rounded-xl"
                          >
                            Confirmar pago con TC
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

            {/* Opción 3: Pagaste otro valor */}
            <Button variant="outline" onClick={() => setIsFixedPartialMode(v => !v)} className="h-12 font-medium rounded-2xl border-dashed border-2 text-sm">
              ¿Pagaste otro valor?
            </Button>
            <div className={cn("overflow-hidden transition-all duration-300", isFixedPartialMode ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Monto real pagado</Label>
                  <MoneyInput value={fixedPartialAmount} onChange={v => setFixedPartialAmount(v)} className="h-12 text-xl font-bold rounded-xl" placeholder="0" autoFocus={isFixedPartialMode} />
                  <p className="text-[10px] text-muted-foreground">Si pagaste más o menos del valor esperado ({formatAmount(payFixed?.frecuencia === "quincenal" ? Math.round((payFixed?.monto ?? 0) / 2) : (payFixed?.monto ?? 0))}), registra el monto real aquí.</p>
                </div>
                <Button onClick={confirmPartialPayFixed} disabled={!fixedPartialAmount || Number(fixedPartialAmount) <= 0} className="w-full bg-cyclon-periwinkle text-white font-bold h-11 rounded-xl">
                  Confirmar pago
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ MODAL CONFIGURAR PAGO AUTOMÁTICO (gastos fijos) ═══
          Reemplaza el toggle instantáneo del botón ⚡: ahora pregunta si el pago
          automático se hará con el disponible real o con una tarjeta de crédito
          (y en ese caso, con cuál), y permite reabrir para cambiarlo o apagarlo. */}
      <Dialog open={!!autoPayTarget} onOpenChange={v => { if (!v) { setAutoPayTarget(null); setAutoPaySelectedTC(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pago automático</DialogTitle>
            <DialogDescription>Gasto fijo: <strong>{autoPayTarget?.nombre}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {autoPayTarget?.pagoAutomatico && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
                Activo, pagando con{" "}
                <strong>
                  {autoPayTarget.tarjetaVinculadaId
                    ? debts.find(d => d.id === autoPayTarget.tarjetaVinculadaId)?.nombre ?? "una tarjeta"
                    : "tu disponible"}
                </strong>.
              </p>
            )}

            <Button
              type="button"
              onClick={async () => {
                if (!autoPayTarget) return
                await updateFixedExpense(autoPayTarget.id, { pagoAutomatico: true, tarjetaVinculadaId: null })
                setAutoPayTarget(null); setAutoPaySelectedTC(null)
              }}
              variant="outline"
              className={cn("w-full h-12 rounded-2xl border-2 font-bold text-sm gap-2 justify-start px-4",
                autoPayTarget?.pagoAutomatico && !autoPayTarget?.tarjetaVinculadaId
                  ? "border-kiri-emerald bg-kiri-emerald/10 text-kiri-emerald"
                  : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
              )}
            >
              <WalletIcon className="h-4 w-4" /> Con tu disponible
            </Button>

            {(() => {
              const tarjetas = debts.filter(d => d.estado === 'activa' && isCreditCard(d))
              if (tarjetas.length === 0) return null
              return (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground px-1 uppercase tracking-wide">O con una tarjeta de crédito</p>
                  {tarjetas.map(tc => (
                    <button
                      key={tc.id}
                      type="button"
                      onClick={() => setAutoPaySelectedTC(tc.id === autoPaySelectedTC ? null : tc.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-left",
                        autoPaySelectedTC === tc.id
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
                      )}
                    >
                      <div>
                        <p className="text-xs font-bold">{tc.nombre}</p>
                        <p className="text-[9px] text-muted-foreground">Saldo: {formatAmount(tc.saldoRestante)}</p>
                      </div>
                      <span className="text-[10px] font-bold text-amber-500">{autoPaySelectedTC === tc.id ? "✓" : "Seleccionar"}</span>
                    </button>
                  ))}
                  {autoPaySelectedTC && (
                    <Button
                      onClick={async () => {
                        if (!autoPayTarget) return
                        await updateFixedExpense(autoPayTarget.id, { pagoAutomatico: true, tarjetaVinculadaId: autoPaySelectedTC })
                        setAutoPayTarget(null); setAutoPaySelectedTC(null)
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 rounded-xl"
                    >
                      Confirmar con esta tarjeta
                    </Button>
                  )}
                </div>
              )
            })()}

            {autoPayTarget?.pagoAutomatico && (
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  if (!autoPayTarget) return
                  await updateFixedExpense(autoPayTarget.id, { pagoAutomatico: false, tarjetaVinculadaId: null })
                  setAutoPayTarget(null); setAutoPaySelectedTC(null)
                }}
                className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/5 font-bold h-10 rounded-xl"
              >
                Desactivar pago automático
              </Button>
            )}
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

            {/* Opción 3: Pagar con tarjeta de crédito — mismo endpoint atómico
                (payWithCard) que usan los botones "oficiales" de pagar deuda
                y pagar gasto fijo con TC. Antes esto hacía un debtsApi.update
                manual con el saldo leído del cliente (condición de carrera),
                nunca creaba el plan de cuotas de la tarjeta, y para una deuda
                nunca registraba el pago original — la deuda quedaba sin
                pagar mientras el saldo de la tarjeta subía igual. Para un
                gasto fijo, el PATCH que mandaba ni siquiera pasaba la
                validación del backend (montoPagadoEstePeriodo no es un campo
                editable ahí) y siempre fallaba con 400. */}
            {(() => {
              const tarjetas = debts.filter(d => d.estado === 'activa' && isCreditCard(d))
              if (tarjetas.length === 0) return null
              const montoTarget = insufficientTarget?.monto ?? 0
              return (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase pl-1">Pagar con tarjeta de crédito</p>
                  {tarjetas.map(tc => {
                    const tasaMensual = tc.tasaInteres ? Number(tc.tasaInteres) : 1.85
                    const interesMes = Math.round(montoTarget * (tasaMensual / 100))
                    const selected = insufficientSelectedTC === tc.id
                    return (
                      <div key={tc.id} className={cn("rounded-2xl border-2 transition-colors", selected ? "border-amber-500 bg-amber-500/5" : "border-amber-500/40 bg-amber-500/5")}>
                        <button
                          onClick={() => setInsufficientSelectedTC(selected ? null : tc.id)}
                          className="w-full text-left p-4 space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <CircleDollarSign className="h-4 w-4 text-amber-500" />
                            <p className="font-bold text-sm">Pagar con {tc.nombre}</p>
                          </div>
                          <p className="text-xs text-muted-foreground pl-6">
                            Se sumará {formatAmount(montoTarget)} al saldo de tu tarjeta.
                          </p>
                          <div className="pl-6 text-[9px] text-amber-500 space-y-0.5">
                            <p>Interés mensual estimado: +{formatAmount(interesMes)} ({tasaMensual}%)</p>
                            <p>Nuevo saldo tarjeta: {formatAmount(tc.saldoRestante + montoTarget)}</p>
                          </div>
                        </button>
                        {selected && (
                          <div className="px-4 pb-4 space-y-3 pt-1 border-t border-amber-500/20">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold">¿A cuántas cuotas?</Label>
                              <Input
                                type="number"
                                min="1"
                                max="48"
                                value={insufficientTcCuotas}
                                onChange={e => setInsufficientTcCuotas(e.target.value)}
                                className="h-10 rounded-xl text-center font-bold"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Se sumará <strong>{formatAmount(Math.round(montoTarget / (Number(insufficientTcCuotas) || 1)))}/mes</strong> a la cuota de la tarjeta durante {insufficientTcCuotas} {Number(insufficientTcCuotas) === 1 ? "mes" : "meses"}.
                              </p>
                            </div>
                            <Button
                              disabled={payingInsufficientTC}
                              onClick={async () => {
                                if (!insufficientTarget) return
                                setPayingInsufficientTC(true)
                                const { error } = await debtsApi.payWithCard({
                                  tarjetaId: tc.id,
                                  monto: montoTarget,
                                  cuotas: Number(insufficientTcCuotas) || 1,
                                  sourceType: insufficientTarget.type,
                                  sourceId: insufficientTarget.id,
                                })
                                if (error) {
                                  setPayingInsufficientTC(false)
                                  toast({ title: "No se pudo registrar el pago con tarjeta", description: "Intenta de nuevo.", variant: "destructive" })
                                  return
                                }
                                setInsufficientOpen(false); setInsufficientTarget(null)
                                setInsufficientSelectedTC(null); setInsufficientTcCuotas("1")
                                window.location.reload()
                              }}
                              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 rounded-xl"
                            >
                              {payingInsufficientTC ? "Procesando..." : "Confirmar pago con TC"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Opción 4: Registrar ingreso rápido */}
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar {addType === "deuda" ? "Deuda" : "Gasto Fijo"}</DialogTitle>
            <DialogDescription>Completa los datos del compromiso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addType === "deuda" ? (
              <DebtRegistrationForm
                loading={saving}
                onSubmit={async (data) => {
                  setSaving(true)
                  await addDebt({
                    nombre: data.nombre,
                    montoTotal: data.montoTotal,
                    cuotaPeriodo: data.cuotaPeriodo,
                    diasPago: data.diasPago,
                    frecuenciaPago: data.frecuenciaPago,
                    tasaInteres: data.tasaInteres || undefined,
                    acreedor: data.acreedor,
                    saldoRestante: data.saldoActual,
                    bankEntityId: data.bankEntityId,
                    tipoDeuda: data.tipoDeuda,
                    yaPagoEstePeriodo: data.yaPagoEstePeriodo,
                    budgetCategoryId: data.budgetCategoryId,
                  })
                  setSaving(false)
                  setIsAddOpen(false)
                }}
              />
            ) : (
              <>
                <FixedFormFields form={addFixedForm} onChange={setAddFixedForm} showDueQuestion />
                <DialogFooter className="gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                  <Button onClick={handleAdd} disabled={saving} className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-8">
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
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

      {/* ═══ MODAL REGISTRAR GASTO (directo desde Obligaciones) ═══ */}
      <Dialog open={expenseModalOpen} onOpenChange={v => { if (!v) { setExpenseModalOpen(false); setExpNombre(""); setExpMonto(""); setExpCategoria(null); setExpShowTCOptions(false); setExpSelectedTC(null); setExpTcCuotas("1") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-kiri-emerald" />
              Registrar gasto
            </DialogTitle>
            <DialogDescription>El gasto se registrará y descontará de tu presupuesto libre.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción</Label>
              <Input
                placeholder="Ej: Mercado semanal, Uber, Netflix..."
                value={expNombre}
                onChange={e => setExpNombre(e.target.value)}
                className="h-10 rounded-xl"
                autoFocus
              />
              {/* Detección automática de gasto hormiga */}
              {expNombre && (() => {
                const hormigaKeywords = ['café', 'cafe', 'starbucks', 'uber', 'taxi', 'cerveza', 'bar', 'snack', 'helado', 'domicilio', 'rappi', 'pizza', 'hamburguesa', 'cine']
                const isHormiga = hormigaKeywords.some(k => expNombre.toLowerCase().includes(k))
                if (isHormiga) return (
                  <p className="text-[9px] text-cyclon-pink flex items-center gap-1">🐜 Kiri detectó que esto es un gasto hormiga</p>
                )
                return null
              })()}
              {/* Detección automática de categoría */}
              {expNombre && (() => {
                const detected = detectBudgetCategory(expNombre, budgetCategories)
                if (!detected) return null
                return (
                  <p className="text-[9px] text-kiri-emerald flex items-center gap-1">📁 Categoría sugerida: {detected}</p>
                )
              })()}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto</Label>
              <MoneyInput value={expMonto} onChange={v => setExpMonto(v)} className="h-12 text-lg font-bold rounded-xl" placeholder="0" />
            </div>
            {/* Selector de categoría */}
            {budgetCategories.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Categoría (opcional)</Label>
                <div className="flex gap-2 flex-wrap">
                  {budgetCategories.slice(0, 6).map(c => (
                    <button key={c.id} type="button"
                      onClick={() => setExpCategoria(expCategoria === c.name ? null : c.name)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors",
                        expCategoria === c.name
                          ? "border-kiri-emerald bg-kiri-emerald/10 text-kiri-emerald"
                          : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
                      )}
                      style={{ borderColor: expCategoria === c.name ? undefined : c.color + '40' }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Pagar con tarjeta de crédito: es un consumo más, con la misma
                lógica de tarjeta+cuotas que pagar una deuda/gasto fijo con TC. */}
            {(() => {
              const tarjetas = debts.filter(d => d.estado === 'activa' && isCreditCard(d))
              if (tarjetas.length === 0) return null
              return (
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setExpShowTCOptions(v => !v); setExpSelectedTC(null); setExpTcCuotas("1") }}
                    className="w-full h-11 rounded-2xl border-2 border-amber-500/40 text-amber-600 hover:bg-amber-500/5 font-bold text-sm gap-2"
                  >
                    <CircleDollarSign className="h-4 w-4" />
                    Pagar con Tarjeta de Crédito
                  </Button>
                  {expShowTCOptions && (
                    <div className="space-y-3 pl-2 pt-1">
                      {tarjetas.map(tc => (
                        <button
                          key={tc.id}
                          type="button"
                          onClick={() => setExpSelectedTC(tc.id === expSelectedTC ? null : tc.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-left",
                            expSelectedTC === tc.id
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
                          )}
                        >
                          <div>
                            <p className="text-xs font-bold">{tc.nombre}</p>
                            <p className="text-[9px] text-muted-foreground">Saldo: {formatAmount(tc.saldoRestante)} · Cuota: {formatAmount(tc.cuotaPeriodo)}</p>
                          </div>
                          <span className="text-[10px] font-bold text-amber-500">{expSelectedTC === tc.id ? "✓" : "Seleccionar"}</span>
                        </button>
                      ))}
                      {expSelectedTC && (
                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                          <Label className="text-xs font-bold">¿A cuántas cuotas?</Label>
                          <Input
                            type="number"
                            min="1"
                            max="48"
                            value={expTcCuotas}
                            onChange={e => setExpTcCuotas(e.target.value)}
                            className="h-10 rounded-xl text-center font-bold"
                          />
                          {Number(expMonto) > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              Se sumará <strong>{formatAmount(Math.round(Number(expMonto) / (Number(expTcCuotas) || 1)))}/mes</strong> a la cuota de la tarjeta durante {expTcCuotas} {Number(expTcCuotas) === 1 ? "mes" : "meses"}.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setExpenseModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!expNombre || !expMonto || Number(expMonto) <= 0) return
                if (expShowTCOptions && !expSelectedTC) return
                setExpSaving(true)
                const hormigaKeywords = ['café', 'cafe', 'starbucks', 'uber', 'taxi', 'cerveza', 'bar', 'snack', 'helado', 'domicilio', 'rappi', 'pizza', 'hamburguesa', 'cine']
                const isHormiga = hormigaKeywords.some(k => expNombre.toLowerCase().includes(k))
                const withHormiga = isHormiga ? `🐜 ${expNombre}` : expNombre
                // La categoría que se elige acá es una categoría de Presupuesto (nombre
                // libre, ej. "Alimentación") — no la de gasto hormiga (enum fijo cafe/
                // comida/transporte/antojo/salida/otro que espera el backend). Antes se
                // mandaba el nombre de la categoría tal cual en ese campo: el backend lo
                // rechazaba (400, enum inválido) y el gasto NUNCA se guardaba — el modal
                // igual se cerraba como si hubiera funcionado. La categoría de Presupuesto
                // se etiqueta en el nombre (así la reconoce budget-category-spend.ts para
                // el gasto por categoría), y a la API se le manda siempre 'otro'.
                const nombre = expCategoria ? `${withHormiga} [${expCategoria}]` : withHormiga
                const result = await addImpulseExpense({
                  nombre, monto: Number(expMonto), categoria: 'otro',
                  ...(expSelectedTC ? { tarjetaId: expSelectedTC, cuotas: Number(expTcCuotas) || 1 } : {}),
                })
                setExpSaving(false)
                if (!result) {
                  toast({ title: "No se pudo registrar el gasto", description: "Intenta de nuevo.", variant: "destructive" })
                  return
                }
                setExpenseModalOpen(false)
                setExpNombre(""); setExpMonto(""); setExpCategoria(null)
                setExpShowTCOptions(false); setExpSelectedTC(null); setExpTcCuotas("1")
                const { data } = await userApi.getWallet()
                if (data) setWallet(data.wallet)
              }}
              disabled={expSaving || !expNombre || !expMonto || Number(expMonto) <= 0 || (expShowTCOptions && !expSelectedTC)}
              className="bg-kiri-emerald text-white font-bold rounded-xl px-6"
            >
              {expSaving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CelebrationModal
        open={!!celebration}
        onClose={() => setCelebration(null)}
        icon={celebration?.icon ?? "🎉"}
        title={celebration?.title ?? ""}
        subtitle={celebration?.subtitle ?? ""}
      />

    </div>
    </>
  )
}


// ─── DebtCard ──────────────────────────────────────────────────────────────────
function DebtCard({ debt, formatAmount, onPay, onUndoPay, onAbonar, onEdit, onDelete, hidden, onToggleHidden, isPeriodPriority, onToggleAutoPay, strategyBadge }: {
  debt: Debt; formatAmount: (n: number) => string
  onPay: () => void; onUndoPay: () => void; onAbonar: () => void; onEdit: () => void; onDelete: () => void
  hidden: boolean; onToggleHidden: () => void; isPeriodPriority?: boolean
  onToggleAutoPay?: () => void
  strategyBadge?: string | null
}) {
  const [showStrategyInfo, setShowStrategyInfo] = useState(false)
  const cuotasRestantes = debt.cuotaPeriodo > 0 ? Math.ceil(debt.saldoRestante / debt.cuotaPeriodo) : 0
  // Clamp a [0, 100] — en una tarjeta de crédito el saldo puede SUBIR por
  // encima de `montoTotal` (el monto con el que se creó) al hacer nuevas
  // compras con ella, lo que sin este límite mostraba un "% pagado" negativo.
  const progreso = debt.montoTotal > 0 ? Math.max(0, Math.min(100, Math.round(((debt.montoTotal - debt.saldoRestante) / debt.montoTotal) * 100))) : 0
  const payInfo = getNextPaymentInfo(debt.diasPago, debt.pagadoEstePeriodo, debt.frecuenciaPago === 'quincenal')
  const obligIcon = getObligationIcon(debt.nombre)

  // Yellow highlight for period priority (pending in current period)
  const priorityRing = isPeriodPriority && !debt.pagadoEstePeriodo ? "ring-2 ring-amber-400/60 bg-amber-500/5" : ""

  return (
    <Card className={cn("border-none shadow-sm transition-all bg-card", payInfo.cardRing, priorityRing, debt.estado === 'saldada' && "opacity-40")}>
      <CardContent className="p-4 space-y-3">
        {/* Strategy Badge — clickeable para ver explicación */}
        {strategyBadge && !debt.pagadoEstePeriodo && (
          <div className="flex items-center gap-1.5 -mb-1">
            <button
              onClick={(e) => { e.stopPropagation(); setShowStrategyInfo(true) }}
              className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors cursor-pointer"
            >
              {strategyBadge}
            </button>
          </div>
        )}

        {/* Modal explicación de estrategia */}
        {showStrategyInfo && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3 space-y-2 -mb-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {strategyBadge?.includes('Nieve') ? '❄️ Estrategia Bola de Nieve' : '⚡ Estrategia Avalancha'}
              </p>
              <button onClick={(e) => { e.stopPropagation(); setShowStrategyInfo(false) }} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {strategyBadge?.includes('Nieve')
                ? 'La Bola de Nieve prioriza la deuda con MENOR saldo restante. Al liquidarla rápido, liberas esa cuota para atacar la siguiente. Genera motivación psicológica al ver resultados rápidos.'
                : 'La Avalancha prioriza la deuda con MAYOR tasa de interés. Así minimizas el dinero que regalas al banco en intereses. Es la estrategia que más te ahorra a largo plazo.'
              }
            </p>
            <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
              {strategyBadge?.includes('Nieve')
                ? '💡 Paga primero esta deuda porque es la más pequeña. Cuando la liquides, usa esa cuota para la siguiente.'
                : '💡 Paga primero esta deuda porque es la que más interés te cobra. Cada peso extra que abonas aquí te ahorra más.'
              }
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icono automático */}
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", obligIcon.bgColor, obligIcon.color)}>
              {obligIcon.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm truncate">{hidden ? "••••••" : debt.nombre}</h3>
                {(() => {
                  const montoPagadoPeriodo = debt.montoPagadoEstePeriodo ?? 0
                  const isPartial = montoPagadoPeriodo > 0 && !debt.pagadoEstePeriodo
                  if (isPartial) {
                    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Pago parcial</span>
                  }
                  return (
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      payInfo.status === 'pagado' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                      payInfo.status === 'vencido' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                      payInfo.status === 'proximo' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                      "bg-muted text-muted-foreground"
                    )}>{payInfo.statusLabel}</span>
                  )
                })()}
              </div>
              {!hidden && debt.acreedor && <p className="text-[10px] text-muted-foreground truncate">{debt.acreedor}</p>}
              {!hidden && (
                <p className={cn("text-[10px] font-medium mt-0.5", payInfo.statusColor)}>
                  {payInfo.status === 'pagado' ? `Próximo: ${payInfo.nextDate}` : payInfo.nextDate}
                  {" · "}{debt.frecuenciaPago === 'quincenal' ? 'Quincenal' : 'Mensual'}
                  {debt.pagoAutomatico && <span className="ml-1.5 text-amber-500">⚡ Auto</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {debt.frecuenciaPago !== 'quincenal' && (
            <button onClick={onToggleAutoPay} title={debt.pagoAutomatico ? "Pago automático activado: se paga sola al registrar tu sueldo en Billetera" : "Pagar sola al registrar tu sueldo en Billetera"}
              className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                debt.pagoAutomatico ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10")}>
              <span className="text-[10px]">⚡</span>
            </button>
            )}
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

        {/* Deuda compartida — solo informativo, no cambia cómo se paga */}
        {!hidden && debt.esCompartida && debt.nombreParticipanteB && (
          <div className="flex items-center justify-between bg-cyclon-lavender/5 border border-cyclon-lavender/20 rounded-xl px-3 py-2 text-[10px]">
            <span className="font-bold text-cyclon-lavender">Compartida con {debt.nombreParticipanteB}</span>
            <span className="text-muted-foreground">
              Tú: {formatAmount(debt.montoParticipanteA ?? 0)} · {debt.nombreParticipanteB}: {formatAmount(debt.montoParticipanteB ?? 0)}
            </span>
          </div>
        )}

        {/* Montos */}
        {!hidden ? (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">Saldo restante</p>
              <p className="text-xl font-black">{formatAmount(debt.saldoRestante)}</p>
              {debt.montoTotal !== debt.saldoRestante && (
                <p className="text-[9px] text-muted-foreground">de {formatAmount(debt.montoTotal)} original</p>
              )}
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
        {(() => {
          const montoPagadoPeriodo = debt.montoPagadoEstePeriodo ?? 0
          const isPartiallyPaid = montoPagadoPeriodo > 0 && !debt.pagadoEstePeriodo

          if (debt.pagadoEstePeriodo) {
            return (
              <div className="flex gap-2">
                <Button onClick={onUndoPay} size="sm" variant="ghost" className="flex-1 rounded-xl h-9 text-xs text-muted-foreground">
                  Deshacer pago
                </Button>
                <Button onClick={onAbonar} size="sm" className="flex-1 bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">
                  Abonar
                </Button>
              </div>
            )
          }
          if (isPartiallyPaid) {
            return (
              <div className="space-y-2">
                <p className="text-[10px] text-amber-500 font-bold">
                  Abonado: {formatAmount(montoPagadoPeriodo)} de {formatAmount(debt.cuotaPeriodo)} · Falta: {formatAmount(debt.cuotaPeriodo - montoPagadoPeriodo)}
                </p>
                <div className="flex gap-2">
                  <Button onClick={onUndoPay} size="sm" variant="ghost" className="flex-1 rounded-xl h-9 text-xs text-muted-foreground">
                    Deshacer pago
                  </Button>
                  <Button onClick={onPay} size="sm" className="flex-1 bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">
                    Pagar restante
                  </Button>
                </div>
              </div>
            )
          }
          if (debt.estado === 'activa') {
            return (
              <Button onClick={onPay} size="sm" className="w-full bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">
                Registrar pago de cuota
              </Button>
            )
          }
          return null
        })()}
      </CardContent>
    </Card>
  )
}

// ─── FixedCard ─────────────────────────────────────────────────────────────────
function FixedCard({ item, tarjetaNombre, formatAmount, onEdit, onDelete, onTogglePaid, onUndoPay, hidden, onToggleHidden, isPeriodPriority, onToggleAutoPay }: {
  item: FixedExpense; tarjetaNombre?: string; formatAmount: (n: number) => string
  onEdit: () => void; onDelete: () => void; onTogglePaid: () => void; onUndoPay: () => void
  hidden: boolean; onToggleHidden: () => void; isPeriodPriority?: boolean
  onToggleAutoPay?: () => void
}) {
  const payInfo = getNextPaymentInfo(item.fechaCorte, item.pagadoEstePeriodo, item.frecuencia === 'quincenal', item.pendienteProximoPeriodo)
  const montoPagado = (item as any).montoPagadoEstePeriodo ?? 0
  const isPartiallyPaid = montoPagado > 0 && !item.pagadoEstePeriodo
  const remaining = item.monto - montoPagado
  const obligIcon = getObligationIcon(item.nombre)

  // Yellow highlight for period priority
  const priorityRing = isPeriodPriority && !item.pagadoEstePeriodo ? "ring-2 ring-amber-400/60 bg-amber-500/5" : ""

  return (
    <Card className={cn("border-none shadow-sm transition-all bg-card", payInfo.cardRing, priorityRing)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icono automático */}
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", obligIcon.bgColor, obligIcon.color)}>
              {obligIcon.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm truncate">{hidden ? "••••••" : item.nombre}</h3>
                {isPartiallyPaid ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Pago parcial
                  </span>
                ) : (
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0",
                    payInfo.status === 'pagado' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                    payInfo.status === 'vencido' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                    payInfo.status === 'proximo' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                    "bg-muted text-muted-foreground"
                  )}>{payInfo.statusLabel}</span>
                )}
              </div>
              {!hidden && (
                <p className={cn("text-[10px] font-medium mt-0.5", payInfo.statusColor)}>
                  {payInfo.status === 'pagado' ? `Próximo: ${payInfo.nextDate}` : payInfo.nextDate}
                  {" · "}{item.frecuencia === 'quincenal' ? 'Quincenal' : 'Mensual'}
                  {item.pagoAutomatico && (
                    <span className="ml-1.5 text-amber-500">⚡ Auto{tarjetaNombre ? " con TC" : ""}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {item.frecuencia !== 'quincenal' && (
            <button onClick={onToggleAutoPay} title={
              item.pagoAutomatico
                ? tarjetaNombre
                  ? `Pago automático con ${tarjetaNombre}. Toca para cambiarlo.`
                  : "Pago automático con tu disponible. Toca para cambiarlo."
                : "Configurar pago automático"
            }
              className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                item.pagoAutomatico ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10")}>
              <span className="text-[10px]">⚡</span>
            </button>
            )}
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

        {!hidden ? (
          <div>
            <p className="text-xl font-black">
              {item.pagadoEstePeriodo && montoPagado > 0 ? formatAmount(montoPagado) : formatAmount(item.monto)}
            </p>
            {/* Si pagó más (o menos) que la cuota configurada, que quede claro cuál
                era la cuota — antes esto se ocultaba en cuanto quedaba "pagado". */}
            {item.pagadoEstePeriodo && montoPagado > 0 && montoPagado !== item.monto && (
              <p className="text-[9px] text-muted-foreground mt-0.5">Cuota: {formatAmount(item.monto)}</p>
            )}
            {isPartiallyPaid && (
              <p className="text-[10px] text-amber-500 font-bold mt-0.5">
                Pagado: {formatAmount(montoPagado)} · Falta: {formatAmount(remaining)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xl font-black text-muted-foreground">••••••</p>
        )}

        {/* Botones de acción */}
        {item.pagadoEstePeriodo ? (
          <Button onClick={onUndoPay} size="sm" variant="ghost" className="w-full rounded-xl h-9 text-xs text-muted-foreground">
            Deshacer pago
          </Button>
        ) : isPartiallyPaid ? (
          <div className="flex gap-2">
            <Button onClick={onUndoPay} size="sm" variant="ghost" className="flex-1 rounded-xl h-9 text-xs text-muted-foreground">
              Deshacer pago
            </Button>
            <Button onClick={onTogglePaid} size="sm" className="flex-1 bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">
              Pagar restante
            </Button>
          </div>
        ) : (
          <Button onClick={onTogglePaid} size="sm" className="w-full bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">
            Registrar pago de cuota
          </Button>
        )}
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
      {/* Nombre de la deuda — este campo es `nombre`, no `acreedor` (esta
          pantalla no expone ese campo por separado); estaba mal etiquetado
          como "Acreedor", lo que hacía parecer que el nombre real de la
          deuda no se podía editar desde acá. */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Nombre de la deuda</Label>
        <Input placeholder="Ej: Banco Falabella" value={form.nombre} onChange={e => set({ nombre: e.target.value })} className="h-11 rounded-xl" />
      </div>

      {/* Monto total de la deuda */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">Monto total de la deuda</Label>
        <MoneyInput value={form.montoTotal} onChange={v => set({ montoTotal: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
      </div>

      {/* Saldo restante (lo que debes hoy) */}
      {isEdit && (
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">Saldo restante <span className="font-normal text-muted-foreground">(lo que debes hoy)</span></Label>
          <MoneyInput value={form.saldoRestante} onChange={v => set({ saldoRestante: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
          <p className="text-[8px] text-muted-foreground">Este valor baja con cada pago que registres.</p>
        </div>
      )}

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
            <button key={f} type="button" onClick={() => {
              // Al cambiar de frecuencia, precargar un día por defecto — si no,
              // el campo queda vacío detrás de un placeholder que parece valor
              // real ("15"), y "Guardar" no hacía nada sin avisar.
              if (f === "quincenal" && !form.diasPago.includes(',')) set({ frecuencia: f, diasPago: "15,30" })
              else if (f === "mensual" && !form.diasPago) set({ frecuencia: f, diasPago: "1" })
              else set({ frecuencia: f })
            }} className={cn(
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

      <BudgetCategorySelector value={form.budgetCategoryId} onChange={v => set({ budgetCategoryId: v })} />

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
  showDueQuestion,
}: {
  form: FixedForm
  onChange: (f: FixedForm) => void
  /** Solo tiene sentido al crear — al editar, "pagado este periodo" ya se
   * calcula solo a partir de pagos reales, no de esta pregunta. */
  showDueQuestion?: boolean
}) {
  const set = (patch: Partial<FixedForm>) => onChange({ ...form, ...patch })

  // Mismo criterio que en DebtRegistrationForm: si el día (o alguno de los
  // dos días, en quincenal) ya pasó este periodo o es hoy, preguntar si esa
  // cuota ya está paga — si no, el gasto nace marcado "vencido" con una
  // fecha que en realidad ya se resolvió.
  const dueQuestion = useMemo(() => {
    if (!showDueQuestion || !form.diasPago) return null
    const info = getNextPaymentInfo(form.diasPago, false)
    if (info.status === "vencido") return "vencido" as const
    if (info.status === "proximo" && info.daysUntil === 0) return "hoy" as const
    return null
  }, [showDueQuestion, form.diasPago])

  useEffect(() => {
    if (!dueQuestion && (form.yaPagoEstePeriodo || form.nuevaProximoPeriodo)) set({ yaPagoEstePeriodo: false, nuevaProximoPeriodo: false })
  }, [dueQuestion])

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
            <button key={f} type="button" onClick={() => {
              // Al cambiar de frecuencia, precargar un día por defecto — si no,
              // el campo queda vacío detrás de un placeholder que parece valor
              // real ("15"), y "Guardar" no hacía nada sin avisar.
              if (f === "quincenal" && !form.diasPago.includes(',')) set({ frecuencia: f, diasPago: "15,30" })
              else if (f === "mensual" && !form.diasPago) set({ frecuencia: f, diasPago: "1" })
              else set({ frecuencia: f })
            }} className={cn(
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

      {dueQuestion && (
        <div className="rounded-2xl border-2 border-amber-400/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-bold">
            {dueQuestion === "hoy"
              ? "Esta cuota vence hoy. ¿Ya pagaste?"
              : "El día de pago de este periodo ya pasó. ¿Ya pagaste esta cuota?"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set({ yaPagoEstePeriodo: true, nuevaProximoPeriodo: false })}
              className={cn("h-9 rounded-xl text-xs font-bold border-2 transition-colors",
                form.yaPagoEstePeriodo ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
              )}
            >
              {dueQuestion === "hoy" ? "Sí, ya pagué" : "Sí, ya la pagué"}
            </button>
            <button
              type="button"
              onClick={() => set({ yaPagoEstePeriodo: false, nuevaProximoPeriodo: false })}
              className={cn("h-9 rounded-xl text-xs font-bold border-2 transition-colors",
                (!form.yaPagoEstePeriodo && !form.nuevaProximoPeriodo) ? "bg-red-500 text-white border-red-500" : "border-muted text-muted-foreground hover:border-red-400/40"
              )}
            >
              {dueQuestion === "hoy" ? "No, vence hoy" : "No, está vencida"}
            </button>
          </div>
          {/* 3ra opción — para una obligación genuinamente NUEVA (ej. una
              suscripción que arranca el mes que viene) las dos opciones de
              arriba no aplican: no está pagada, pero tampoco está vencida
              porque nunca debió cobrarse este periodo. Elegir "Sí, ya la
              pagué" solo para salir del paso sembraba un pago falso en el
              historial de Balance; elegir "No, está vencida" la dejaba
              marcada como vencida desde el día uno. Esta opción no genera
              ningún movimiento y corre la próxima fecha de pago a este mismo
              día pero del mes siguiente. */}
          <button
            type="button"
            onClick={() => set({ yaPagoEstePeriodo: false, nuevaProximoPeriodo: true })}
            className={cn("w-full h-9 rounded-xl text-xs font-bold border-2 transition-colors",
              form.nuevaProximoPeriodo ? "bg-cyclon-periwinkle text-white border-cyclon-periwinkle" : "border-muted text-muted-foreground hover:border-cyclon-periwinkle/40"
            )}
          >
            Es una obligación nueva (inicia el próximo mes)
          </button>
        </div>
      )}

      {/* La tarjeta vinculada para pago automático ya no se elige aquí: se
          configura desde el botón ⚡ de la lista, junto con activar/cambiar
          el pago automático (ver modal "Configurar pago automático"). */}

      <BudgetCategorySelector value={form.budgetCategoryId} onChange={v => set({ budgetCategoryId: v })} />
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
