"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Plus, CheckCircle2, Pencil, Trash2, ReceiptText,
  AlertTriangle, Eye, EyeOff, Wallet as WalletIcon, PiggyBank, CircleDollarSign, Users,
  ChevronDown, ChevronUp, PartyPopper, CreditCard,
} from "lucide-react"
import { Debt, FixedExpense, PagosPeriodo, CuotaAtrasada } from "@/lib/types"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { getNextPaymentInfo, formatPeriodo } from "@/lib/payment-schedule"
import { useFinanceData, avisarCupo } from "@/hooks/use-finance-data"
import { useAppContext } from "@/lib/app-context"
import { useBudgetCategories, useCategoriaSugerida } from "@/hooks/use-budget-categories"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { useMemo } from "react"
import { DebtSimulator } from "@/components/recommendations/debt-simulator"
import { analyzeFinances } from "@/lib/recommendations"
import { userApi, WalletState, loansApi, hogarApi } from "@/lib/api-client"
import { debtsApi, fixedExpensesApi, impulseApi, budgetCategoriesApi } from "@/lib/api-client"
import { DebtRegistrationForm } from "@/components/obligaciones/DebtRegistrationForm"
import { MeDebenTab } from "@/components/obligaciones/MeDebenTab"
import { BudgetCategorySelector } from "@/components/obligaciones/BudgetCategorySelector"
import { DueQuestion, DueQuestionKind, useDueQuestion } from "@/components/obligaciones/DueQuestion"
import { esGastoHormiga } from "@/lib/hormiga"
import type { UndoAlcance } from "@/lib/api-client"
import { getObligationIcon, calculateDebtStrategy } from "@/lib/obligation-icons"
import { lineasDeCredito, usoCupoTras } from "@/lib/debt-utils"
import { TarjetaOpcion } from "@/components/obligaciones/TarjetaOpcion"
import { AnimatedBalance } from "@/components/ui/animated-balance"
import { CelebrationModal } from "@/components/ui/celebration-modal"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import type { Loan } from "@/lib/types"
import { tr } from "@/lib/i18n"
import { celebrarLogro } from "@/components/referidos/CompartirLogro"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Tab = "gastos_fijos" | "deudas" | "me_deben"
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
  yaPagoEstePeriodo?: boolean
  nuevaProximoPeriodo?: boolean
  /** Tipo (reclasificable al editar) y, en tarjetas / créditos de compras, su cupo */
  tipoDeuda?: Debt["tipoDeuda"]
  cupoTotal?: string
  tasaInteres?: string
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
    markPaid, undoPayDebt, marcarAtrasoPagado, markFixedPaid, undoPayFixed, marcarAtrasoFijoPagado,
    extraIncomes, addImpulseExpense, refetch,
  } = useFinanceData()
  // "Actualizar saldo" de una tarjeta o crédito (lo que dice el banco)
  const [saldoTarget, setSaldoTarget] = useState<Debt | null>(null)
  const { formatAmount, income, incomeFrequency } = useAppContext()
  const { user: authUser } = useAuth()
  const { toast } = useToast()

  // ── Celebración al liquidar una deuda por completo ──────────────────────────
  // Antes esto pasaba en silencio: la tarjeta quedaba atenuada y luego
  // desaparecía del todo en el próximo refetch (ver GET /debts, filtra por
  // estado=activa) sin que la app dijera nada de "listo, la terminaste".
  const [celebration, setCelebration] = useState<{ icon: string; title: string; subtitle: string } | null>(null)
  const payAndCelebrate = async (debtId: string, monto?: number, periodo: string = 'actual', opciones: { saldoReal?: number; cuotaCompleta?: boolean } = {}) => {
    const result = await markPaid(debtId, monto, periodo, opciones)
    // Con el saldo real del banco, Kiri calcula el interés que de verdad se
    // pagó y ajusta la tasa para estimar mejor la próxima vez.
    if (result && opciones.saldoReal !== undefined && !result.liquidada) {
      toast({
        title: tr("Interés real pagado: {0}", [formatAmount(result.pagoInteres)]),
        description: result.tasaObservadaMensual !== null
          ? tr("Tu tasa real quedó en {0}% mensual. La usaremos para tus próximas estimaciones.", [result.tasaObservadaMensual.toFixed(2)])
          : tr("Saldo actualizado a {0}, igual que en tu banco.", [formatAmount(result.saldoNuevo)]),
      })
    }
    if (result?.liquidada) {
      setCelebration({
        icon: "🎉",
        title: tr("¡Terminaste de pagar \"{0}\"!", [result.nombre]),
        subtitle: tr("Una deuda menos, un paso más cerca de tu libertad financiera."),
      })
      // Después del festejo: compartir el logro (sin cifras) e invitar a un amigo
      window.setTimeout(() => celebrarLogro({
        clave: `deuda_${debtId}`, icono: "🎉",
        titulo: tr("Terminé de pagar una deuda"),
        detalle: tr("Una deuda menos, un paso más cerca de mi libertad financiera."),
      }), 3500)
    } else if (result?.enCeros) {
      // Una tarjeta o crédito de compras no "se termina": queda en ceros y su cupo libre
      setCelebration({
        icon: "💳",
        title: tr("¡{0} quedó en ceros!", [result.nombre]),
        subtitle: result.cupoDisponible != null
          ? tr("Tu cupo de {0} quedó libre. La tarjeta sigue disponible para tus compras.", [formatAmount(result.cupoDisponible)])
          : tr("No le debes nada. Sigue disponible para tus compras."),
      })
    }
    return result
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const { budgetCategories } = useBudgetCategories()

  // Llegar desde Presupuesto → "Registrar gasto" en una categoría abre este
  // modal directo con esa categoría ya elegida (ver BudgetRadialChart.tsx).
  // Los recordatorios de "Me deben" (push) abren directo esa pestaña.
  useEffect(() => {
    if (searchParams.get('tab') === 'me_deben') setActiveTab('me_deben')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('registrarGasto') !== '1') return
    const categoria = searchParams.get('categoria')
    if (categoria) { setExpCategoria(categoria); setExpCategoriaManual(true) }
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
  // Saldo que quedó según el banco (opcional) y "con este valor quedó pagada la cuota".
  const [saldoRealDebt, setSaldoRealDebt] = useState("")
  const [cuotaCompletaDebt, setCuotaCompletaDebt] = useState(false)
  const [partialAmount, setPartialAmount] = useState("")

  // ── Pay modal (gastos fijos) ───────────────────────────────────────────────
  const [payFixed, setPayFixed] = useState<FixedExpense | null>(null)
  const [isFixedPartialMode, setIsFixedPartialMode] = useState(false)
  const [cuotaCompletaFixed, setCuotaCompletaFixed] = useState(false)
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
    const { fixedId, suggestedCategory } = categorySuggestion
    // Vincular el gasto fijo a la categoría con su propia FK: desde ahí, cada
    // pago suyo cuenta en esa categoría (ver GET /budget-categories/resumen).
    // Antes además se registraba un gasto variable "(gasto fijo)" por el mismo
    // monto — el mismo dinero quedaba contado DOS veces en el presupuesto y en
    // Balance (como pago del fijo y como gasto variable).
    const { data } = await budgetCategoriesApi.list()
    const cat = data?.categories.find(c => c.nombre === suggestedCategory)
    if (cat) await updateFixedExpense(fixedId, { budgetCategoryId: cat.id })
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
  // Categoría del hogar (compartida con la pareja) — opcional
  const [expHogarId, setExpHogarId] = useState<string | null>(null)
  const [hogarCats, setHogarCats] = useState<{ id: string; nombre: string; icono: string; disponible: number }[]>([])
  const [hogarPareja, setHogarPareja] = useState<string | null>(null)
  useEffect(() => {
    if (!expenseModalOpen) return
    hogarApi.resumen().then(({ data }) => {
      // Sin KIRI PRO en la pareja no se ofrecen categorías del hogar al registrar
      if (data?.conectado && data.habilitado !== false) {
        setHogarCats((data.categorias ?? []).map(c => ({ id: c.id, nombre: c.nombre, icono: c.icono, disponible: c.disponible })))
        setHogarPareja(data.pareja?.nombre ?? null)
      } else setHogarCats([])
    })
  }, [expenseModalOpen])
  const [expShowTCOptions, setExpShowTCOptions] = useState(false)
  const [expSelectedTC, setExpSelectedTC] = useState<string | null>(null)
  const [expTcCuotas, setExpTcCuotas] = useState("1")
  // null = usar la clasificación automática (monto chico o palabra clave)
  const [expHormiga, setExpHormiga] = useState<boolean | null>(null)
  // Categoría sugerida por Kiri (historial del usuario primero, luego palabras
  // clave) — solo se preselecciona si el usuario no eligió una a mano.
  const [expCategoriaManual, setExpCategoriaManual] = useState(false)
  const expCategoriaSugerida = useCategoriaSugerida(expenseModalOpen ? expNombre : "")
  useEffect(() => {
    if (expCategoriaSugerida && !expCategoriaManual) setExpCategoria(expCategoriaSugerida.nombre)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expCategoriaSugerida])
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

  // ── "¿Ya pagaste la cuota de este periodo?" ────────────────────────────────
  // Al editar, solo tiene sentido si la obligación NO está pagada este periodo
  // ni marcada "inicia el próximo periodo": con los datos editados (ej. otro
  // día de pago) quedaría vencida, y antes no había forma de decir "ya la
  // pagué" o "todavía no me la cobran" — quedaba vencida sin remedio.
  const addFixedDueQ = useDueQuestion(addFixedForm.diasPago, addFixedForm.frecuencia === "quincenal", isAddOpen && addType === "gasto_fijo")
  const editDebtDueQ = useDueQuestion(
    editDebtForm.diasPago,
    editDebtForm.frecuencia === "quincenal",
    !!editDebt && !editDebt.pagadoEstePeriodo && !editDebt.pendienteProximoPeriodo,
  )
  const editFixedDueQ = useDueQuestion(
    editFixedForm.diasPago,
    editFixedForm.frecuencia === "quincenal",
    !!editFixed && !editFixed.pagadoEstePeriodo && !editFixed.pendienteProximoPeriodo,
  )
  /** Traduce la respuesta a lo que espera PATCH: nada si no se preguntó; `nuevaProximoPeriodo: false` = "sí, está vencida". */
  const dueAnswerPatch = (dueQ: DueQuestionKind | null, form: { yaPagoEstePeriodo?: boolean; nuevaProximoPeriodo?: boolean }) => {
    if (!dueQ) return {}
    if (form.yaPagoEstePeriodo) return { yaPagoEstePeriodo: true }
    return { nuevaProximoPeriodo: !!form.nuevaProximoPeriodo }
  }

  // ── Deshacer pago: solo el último abono o todo el periodo ─────────────────
  // Si en el periodo hay más de un pago (la cuota + uno o más abonos), se
  // pregunta qué deshacer; si hay uno solo, se deshace directo como siempre.
  const [undoTarget, setUndoTarget] = useState<{ type: "debt" | "fixed"; id: string; nombre: string; pagos: PagosPeriodo; totalPeriodo: number } | null>(null)
  const [undoing, setUndoing] = useState(false)
  const runUndo = async (type: "debt" | "fixed", id: string, alcance: UndoAlcance) => {
    const w = type === "debt" ? await undoPayDebt(id, alcance) : await undoPayFixed(id, alcance)
    if (w) setWallet(w)
  }
  const requestUndo = async (type: "debt" | "fixed", item: Debt | FixedExpense) => {
    const pagos = item.pagosPeriodo
    if (pagos && pagos.cantidad > 1) {
      setUndoTarget({ type, id: item.id, nombre: item.nombre, pagos, totalPeriodo: item.montoPagadoEstePeriodo ?? 0 })
      return
    }
    await runUndo(type, item.id, "todo")
  }
  const confirmUndo = async (alcance: UndoAlcance) => {
    if (!undoTarget) return
    setUndoing(true)
    await runUndo(undoTarget.type, undoTarget.id, alcance)
    setUndoing(false)
    setUndoTarget(null)
  }

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
    setSaldoRealDebt(""); setCuotaCompletaDebt(false)
  }

  const confirmFullPay = async () => {
    if (!payDebt) return
    // Si ya hay un abono parcial este periodo, "pagar" debe cubrir solo lo que
    // falta — no la cuota completa de nuevo (si no, se paga de más).
    const restante = payDebt.cuotaPeriodo - (payDebt.montoPagadoEstePeriodo ?? 0)
    await payAndCelebrate(payDebt.id, restante > 0 ? restante : undefined, 'actual', {
      saldoReal: saldoRealDebt ? Number(saldoRealDebt) : undefined,
    })
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setPayDebt(null)
  }

  const confirmPartialPay = async () => {
    if (!payDebt || !partialAmount) return
    const amt = Number(partialAmount)
    await payAndCelebrate(payDebt.id, amt, 'actual', {
      saldoReal: saldoRealDebt ? Number(saldoRealDebt) : undefined,
      cuotaCompleta: cuotaCompletaDebt,
    })
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

  // ── Adelantar la PRÓXIMA cuota ────────────────────────────────────────────
  // Con la cuota del periodo ya pagada, lo que se pague queda asignado al
  // periodo siguiente (antes un pago "antes de tiempo" se sumaba al periodo en
  // curso como abono y la próxima cuota salía sin pagar al cambiar de periodo).
  const [adelantoTarget, setAdelantoTarget] = useState<{ type: "debt" | "fixed"; id: string; nombre: string; periodo?: string } | null>(null)
  const [adelantoAmount, setAdelantoAmount] = useState("")
  const [adelantoSaving, setAdelantoSaving] = useState(false)
  const openAdelanto = (type: "debt" | "fixed", item: Debt | FixedExpense) => {
    const cuota = type === "debt"
      ? ((item as Debt).cuotaBase ?? (item as Debt).cuotaPeriodo)
      : ((item as FixedExpense).frecuencia === "quincenal" ? Math.round((item as FixedExpense).monto / 2) : (item as FixedExpense).monto)
    const falta = Math.max(0, cuota - (item.montoAdelantado ?? 0))
    setAdelantoTarget({ type, id: item.id, nombre: item.nombre, periodo: item.periodoSiguiente })
    setAdelantoAmount(String(falta || cuota))
  }
  const confirmAdelanto = async () => {
    if (!adelantoTarget) return
    const amt = Number(adelantoAmount)
    if (amt <= 0 || amt > wallet.cashBalance) return
    setAdelantoSaving(true)
    if (adelantoTarget.type === "debt") await payAndCelebrate(adelantoTarget.id, amt, "siguiente")
    else await markFixedPaid(adelantoTarget.id, amt, "siguiente")
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setAdelantoSaving(false)
    setAdelantoTarget(null)
  }
  const undoAdelanto = async (type: "debt" | "fixed", id: string) => {
    const w = type === "debt" ? await undoPayDebt(id, "todo", "siguiente") : await undoPayFixed(id, "todo", "siguiente")
    if (w) setWallet(w)
  }

  // ── Cuotas atrasadas (periodos ya cerrados sin cubrir) ─────────────────────
  const pagarAtraso = async (type: "debt" | "fixed", id: string, atraso: CuotaAtrasada) => {
    if (wallet.cashBalance < atraso.falta) {
      toast({ title: tr("Saldo insuficiente"), description: tr("Necesitas {0} y tienes {1} disponibles.", [formatAmount(atraso.falta), formatAmount(wallet.cashBalance)]), variant: "destructive" })
      return
    }
    if (type === "debt") await payAndCelebrate(id, atraso.falta, atraso.periodo)
    else await markFixedPaid(id, atraso.falta, atraso.periodo)
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
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
    setPayFixed(fe); setIsFixedPartialMode(false); setFixedPartialAmount(""); setShowTCOptions(false); setSelectedTC(null); setTcCuotas("1"); setCuotaCompletaFixed(false)
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
    await markFixedPaid(payFixed.id, Number(fixedPartialAmount), 'actual', cuotaCompletaFixed)
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setPayFixed(null)
  }

  // ── Abonar extra a un gasto fijo YA pagado este periodo ──────────────────────
  // Mismo caso que abonoTarget/confirmAbono para deudas: una vez marcado
  // "pagadoEstePeriodo" no había forma de meterle más plata sin deshacer el
  // pago primero (útil, ej., cuando la cuota registrada fue un estimado y el
  // cobro real salió más alto).
  const [abonoFixedTarget, setAbonoFixedTarget] = useState<FixedExpense | null>(null)
  const [abonoFixedAmount, setAbonoFixedAmount] = useState("")
  const [abonoFixedSaving, setAbonoFixedSaving] = useState(false)

  const confirmAbonoFixed = async () => {
    if (!abonoFixedTarget || !abonoFixedAmount) return
    const amt = Number(abonoFixedAmount)
    if (amt <= 0 || amt > wallet.cashBalance) return
    setAbonoFixedSaving(true)
    await markFixedPaid(abonoFixedTarget.id, amt)
    const { data } = await userApi.getWallet()
    if (data) setWallet(data.wallet)
    setAbonoFixedSaving(false)
    setAbonoFixedTarget(null)
    setAbonoFixedAmount("")
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
    if (error) { toast({ title: tr("No se pudo retirar del bolsillo"), description: error, variant: "destructive" }); return }
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

    // Retirar del fondo de emergencia — el backend ya devuelve esa plata a la
    // billetera en la misma transacción (antes era un walletWithdraw aparte)
    const { emergencyFundApi } = await import("@/lib/api-client")
    const { data: fundData, error: fundError } = await emergencyFundApi.transaction(needed, "retiro")
    if (fundError || !fundData) { toast({ title: tr("No se pudo retirar del fondo de emergencia"), description: fundError ?? undefined, variant: "destructive" }); return }
    setFondoEmergencia(fundData.fondoActual)

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
    // Antes el error se ignoraba: los modales se cerraban y no pasaba nada
    const { error } = await userApi.walletIncome(amt, 'extra')
    if (error) { toast({ title: tr("No se pudo registrar el ingreso"), description: error, variant: "destructive" }); return }
    toast({ title: tr("Ingreso registrado"), description: tr("Ya puedes registrar el pago de la cuota.") })
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
        toast({ title: tr("Faltan datos"), description: tr("Completa nombre, monto total y día(s) de pago."), variant: "destructive" })
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
        toast({ title: tr("Faltan datos"), description: tr("Completa nombre, monto y día(s) de pago."), variant: "destructive" })
        return
      }
      await addFixedExpense({
        nombre: addFixedForm.nombre,
        monto: Number(addFixedForm.monto),
        fechaCorte: addFixedForm.diasPago,
        frecuencia: addFixedForm.frecuencia,
        yaPagoEstePeriodo: addFixedDueQ ? addFixedForm.yaPagoEstePeriodo : undefined,
        nuevaProximoPeriodo: addFixedDueQ ? addFixedForm.nuevaProximoPeriodo : undefined,
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
    const esLineaD = debt.esLineaCredito ?? debt.tipoDeuda !== 'PRESTAMO'
    setEditDebtForm({
      nombre: debt.nombre,
      montoTotal: String(debt.montoTotal),
      saldoRestante: String(debt.saldoRestante),
      // En una tarjeta, cuotaPeriodo es la cuota exigible de este mes (con compras
      // a cuotas, o tope en lo que se debe): se edita la cuota habitual
      cuotaPeriodo: String(esLineaD ? (debt.cuotaBase ?? debt.cuotaPeriodo) : debt.cuotaPeriodo),
      // Tarjeta sin día ("31") = fin de mes: se muestra vacío
      diasPago: esLineaD && debt.diasPago === '31' ? '' : (debt.diasPago ?? '1'),
      tipoDeuda: debt.tipoDeuda,
      cupoTotal: debt.cupoTotal != null ? String(debt.cupoTotal) : "",
      tasaInteres: debt.tasaInteres != null ? String(debt.tasaInteres) : "",
      diaCorte: "",
      frecuencia: (debt.frecuenciaPago as "mensual" | "quincenal") || "mensual",
      tipoPago: "unica",
      fechaFinalProyectada: "",
      numCuotas: "",
      budgetCategoryId: debt.budgetCategoryId ?? null,
      yaPagoEstePeriodo: false,
      nuevaProximoPeriodo: false,
    })
  }

  const handleEditDebtSubmit = () => {
    if (!editDebt) return
    const cuotaNew = Number(editDebtForm.cuotaPeriodo)
    const esLineaForm = editDebtForm.tipoDeuda !== 'PRESTAMO'
    const cuotaActual = esLineaForm ? (editDebt.cuotaBase ?? editDebt.cuotaPeriodo) : editDebt.cuotaPeriodo
    if (cuotaNew !== cuotaActual) {
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
    const esLineaForm = editDebtForm.tipoDeuda !== 'PRESTAMO'
    const tasa = Number((editDebtForm.tasaInteres ?? "").replace(",", "."))
    const patch: Record<string, unknown> = esLineaForm
      ? {
          // Tarjeta / crédito de compras: cupo, ocupado y día opcional (vacío = fin de mes)
          nombre: editDebtForm.nombre,
          tipoDeuda: editDebtForm.tipoDeuda,
          cupoTotal: Number(editDebtForm.cupoTotal) > 0 ? Number(editDebtForm.cupoTotal) : null,
          saldoRestante: newSaldoRestante,
          diasPago: editDebtForm.diasPago || '31',
          frecuenciaPago: 'mensual',
          tasaInteres: tasa > 0 ? tasa : null,
          budgetCategoryId: editDebtForm.budgetCategoryId ?? null,
          ...dueAnswerPatch(editDebtDueQ, editDebtForm),
        }
      : {
          nombre: editDebtForm.nombre,
          tipoDeuda: 'PRESTAMO',
          montoTotal: newMontoTotal,
          saldoRestante: newSaldoRestante || newMontoTotal,
          diasPago: editDebtForm.diasPago,
          frecuenciaPago: editDebtForm.frecuencia,
          tasaInteres: tasa > 0 ? tasa : null,
          budgetCategoryId: editDebtForm.budgetCategoryId ?? null,
          ...dueAnswerPatch(editDebtDueQ, editDebtForm),
        }
    // "Solo este mes": la cuota del periodo actual cambia y la siguiente vuelve
    // sola a la normal (antes esta opción no enviaba nada y el cambio se perdía).
    if (scope === "permanente") patch.cuotaPeriodo = Number(editDebtForm.cuotaPeriodo)
    else patch.cuotaSoloEstePeriodo = Number(editDebtForm.cuotaPeriodo)
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
      yaPagoEstePeriodo: false,
      nuevaProximoPeriodo: false,
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
      ...dueAnswerPatch(editFixedDueQ, editFixedForm),
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
          <h1 className="text-lg sm:text-2xl font-bold text-cyclon-periwinkle truncate">{tr("Obligaciones")}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm leading-snug line-clamp-2">{tr("Gestiona tus compromisos y gastos.")}</p>
        </div>
        {/* Cluster de acciones: siempre en la misma fila que el título, pegado
            a la derecha de la pantalla — en mobile los botones se comprimen a
            solo ícono para que quepan sin empujar el título ni saltar de fila. */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
            aria-label={tr("Registrar gasto")}
          >
            <ReceiptText className="h-3.5 w-3.5" />
            <span className="text-[8px] leading-none sm:hidden">{tr("Gasto")}</span>
            <span className="hidden sm:inline">{tr("Registrar gasto")}</span>
          </Button>
          {(activeTab === "gastos_fijos" || activeTab === "deudas") && (
            <Button
              size="sm"
              className="rounded-xl bg-cyclon-periwinkle shadow-sm font-bold text-xs gap-1 px-2.5 sm:px-3"
              onClick={() => {
                setAddType(activeTab === "deudas" ? "deuda" : "gasto_fijo")
                setIsAddOpen(true)
              }}
              aria-label={activeTab === "deudas" ? tr("Nueva deuda") : tr("Nuevo gasto fijo")}
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{activeTab === "deudas" ? tr("Nueva deuda") : tr("Nuevo gasto fijo")}</span>
            </Button>
          )}
          {/* Saldo al extremo derecho: primero las acciones (registrar), luego el saldo. */}
          <AnimatedBalance value={wallet.cashBalance} formatAmount={formatAmount} label={tr("Saldo total")} showToggle={false} className="scale-90 sm:scale-100 origin-right" />
        </div>
      </header>

      {/* ── Sugerencia: vincular gasto fijo a categoría ── */}
      {categorySuggestion && (
        <Card className="border-2 border-kiri-emerald/30 bg-kiri-emerald/5 rounded-2xl animate-in fade-in slide-in-from-top-2">
          <CardContent className="p-4 flex items-start gap-3">
            <span className="text-lg shrink-0">🌱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-kiri-emerald">{tr("Kiri sugiere vincular este gasto")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{tr("“{0}” parece pertenecer a la categoría", [categorySuggestion.fixedName])}{" "}<strong>{categorySuggestion.suggestedCategory}</strong>{tr(". ¿Deseas registrarlo ahí para que se contabilice en tu presupuesto?")}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setCategorySuggestion(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted">{tr("No")}</button>
              <button onClick={handleAcceptCategorySuggestion} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-kiri-emerald text-white hover:bg-kiri-emerald/90">{tr("Sí, vincular")}</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Simulador de Escenarios ── */}
      {allocation && (
        <DebtSimulator
          // La misma capacidad que muestran el Dashboard ("Endeudamiento") y el
          // simulador del botón de Kiri: sale de la distribución del periodo.
          // Antes acá se recalculaba con el saldo de la billetera y, a fin de
          // quincena, decía "Capacidad $0" mientras el Dashboard mostraba $778.600.
          debtCapacity={Math.max(0, allocation.debtCapacityAmount)}
          incomeFrequency={incomeFrequency}
        />
      )}

      {/* ── Pestañas ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: "gastos_fijos" as Tab, label: tr("Gastos Fijos") },
          { key: "deudas" as Tab,       label: tr("Deudas") },
          // Plata que TE deben personas que no usan Kiri (ver MeDebenTab).
          { key: "me_deben" as Tab,     label: tr("Me deben") },
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
                {f === "todas" ? tr("Todas") : f === "pendientes" ? tr("Pendientes") : tr("Pagadas")}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{tr("Cargando...")}</p>
          ) : fixedExpenses.length === 0 ? (
            <button
              onClick={() => { setAddType("gasto_fijo"); setIsAddOpen(true) }}
              className="w-full border-2 border-dashed border-muted rounded-2xl p-6 text-sm text-muted-foreground hover:border-cyclon-periwinkle/40 hover:text-cyclon-periwinkle transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />{" "}{tr("Agregar gasto fijo (Netflix, arriendo, etc.)")}</button>
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
                    if (fe.pagadoEstePeriodo) await requestUndo("fixed", fe)
                    else openPayFixed(fe)
                  }}
                  onUndoPay={() => requestUndo("fixed", fe)}
                  onAdelantar={() => openAdelanto("fixed", fe)}
                  onUndoAdelanto={() => undoAdelanto("fixed", fe.id)}
                  onPagarAtraso={a => pagarAtraso("fixed", fe.id, a)}
                  onMarcarAtraso={a => marcarAtrasoFijoPagado(fe.id, a.periodo)}
                  onAbonar={() => { setAbonoFixedTarget(fe); setAbonoFixedAmount("") }}
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
          <Link href="/balance" className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-cyclon-lavender/70 hover:text-cyclon-lavender transition-colors pt-1">{tr("Ver historial completo en Balance →")}</Link>
        </div>
      )}

      {activeTab === "me_deben" && <MeDebenTab />}

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
                {f === "todas" ? tr("Todas") : f === "pendientes" ? tr("Pendientes") : tr("Pagadas")}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{tr("Cargando...")}</p>
          ) : debts.length === 0 ? (
            <button
              onClick={() => { setAddType("deuda"); setIsAddOpen(true) }}
              className="w-full border-2 border-dashed border-muted rounded-2xl p-6 text-sm text-muted-foreground hover:border-cyclon-periwinkle/40 hover:text-cyclon-periwinkle transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />{" "}{tr("Agregar deuda (tarjeta, crédito, etc.)")}</button>
          ) : (
            <>
              <TusCupos debts={debts} formatAmount={formatAmount} />
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
                    onUndoPay={() => requestUndo("debt", debt)}
                    onAdelantar={() => openAdelanto("debt", debt)}
                    onUndoAdelanto={() => undoAdelanto("debt", debt.id)}
                    onPagarAtraso={a => pagarAtraso("debt", debt.id, a)}
                    onMarcarAtraso={a => marcarAtrasoPagado(debt.id, a.periodo)}
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
                    onActualizarSaldo={() => setSaldoTarget(debt)}
                  />
                ))
              })()}
            </>
          )}
          <Link href="/balance" className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-cyclon-lavender/70 hover:text-cyclon-lavender transition-colors pt-1">{tr("Ver historial completo en Balance →")}</Link>

          {/* ── Deudas saldadas — pagadas por completo, ya no aparecen arriba ── */}
          {settledDebts.length > 0 && (
            <div className="pt-3 border-t border-border/50">
              <button
                onClick={() => setShowSettled(v => !v)}
                className="w-full flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                <span className="flex items-center gap-1.5">
                  <PartyPopper className="h-3.5 w-3.5 text-emerald-500" />{" "}{tr("Deudas saldadas ({0})", [settledDebts.length])}</span>
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
                          <p className="text-[10px] text-muted-foreground">{tr("Pagada por completo · {0}", [formatAmount(Number(d.montoTotal))])}</p>
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
                <Users className="h-3 w-3" />{" "}{tr("Préstamos P2P")}</p>
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
                          <p className="font-bold text-sm truncate">{tr("Le debo a {0}", [lenderName])}</p>
                          <p className="text-[10px] text-muted-foreground">{loan.descripcion || tr("Préstamo P2P")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-amber-600">{formatAmount(loan.remainingAmount)}</p>
                          <p className="text-[9px] text-muted-foreground">{tr("de")}{" "}{formatAmount(loan.amount)}</p>
                        </div>
                      </div>
                      <Progress value={pct} className="h-1.5" indicatorClassName="bg-cyclon-lavender" />
                      <p className="text-[8px] text-cyclon-lavender font-bold text-center">{tr("Toca para pagar en Social →")}</p>
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
            <DialogTitle>{tr("¿Ya pagaste?")}</DialogTitle>
            <DialogDescription>{tr("Obligación:")}{" "}<strong>{payDebt?.nombre}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-3 flex flex-col gap-3">
            {payDebt && (
              <SaldoRealBanco
                debt={payDebt}
                monto={isPartialMode && Number(partialAmount) > 0 ? Number(partialAmount) : Math.max(0, payDebt.cuotaPeriodo - (payDebt.montoPagadoEstePeriodo ?? 0))}
                value={saldoRealDebt}
                onChange={setSaldoRealDebt}
                formatAmount={formatAmount}
              />
            )}
            <Button onClick={confirmFullPay} className="bg-cyclon-mint text-cyclon-periwinkle hover:bg-cyclon-mint/80 h-14 text-base font-bold rounded-2xl gap-2">
              <CheckCircle2 className="h-5 w-5" />{tr("Pagar ({0})", [formatAmount(Math.max(0, (payDebt?.cuotaPeriodo ?? 0) - (payDebt?.montoPagadoEstePeriodo ?? 0)))])}</Button>

            {/* Opción: Pagar con tarjeta de crédito */}
            {(() => {
              const tarjetas = lineasDeCredito(debts).filter(d => d.id !== payDebt?.id)
              if (tarjetas.length === 0) return null
              return (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setShowDebtTCOptions(v => !v); setSelectedDebtTC(null); setDebtTcCuotas("1") }}
                    className="h-12 rounded-2xl border-2 border-amber-500/40 text-amber-600 hover:bg-amber-500/5 font-bold text-sm gap-2"
                  >
                    <CircleDollarSign className="h-4 w-4" />{tr("Pagar con Tarjeta de Crédito")}</Button>
                  {showDebtTCOptions && (
                    <div className="space-y-3 pl-2">
                      {tarjetas.map(tc => (
                        <TarjetaOpcion
                          key={tc.id}
                          tc={tc}
                          selected={selectedDebtTC === tc.id}
                          onSelect={() => setSelectedDebtTC(tc.id === selectedDebtTC ? null : tc.id)}
                          formatAmount={formatAmount}
                          monto={Math.max(0, (payDebt?.cuotaPeriodo ?? 0) - (payDebt?.montoPagadoEstePeriodo ?? 0))}
                        />
                      ))}
                      {selectedDebtTC && (
                        <div className="space-y-3 pt-2 border-t border-border/50">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold">{tr("¿A cuántas cuotas?")}</Label>
                            <Input
                              type="number"
                              min="1"
                              max="48"
                              value={debtTcCuotas}
                              onChange={e => setDebtTcCuotas(e.target.value)}
                              className="h-10 rounded-xl text-center font-bold"
                            />
                            <p className="text-[10px] text-muted-foreground">{tr("Se sumará")}{" "}<strong>{formatAmount(Math.round(Math.max(0, (payDebt?.cuotaPeriodo ?? 0) - (payDebt?.montoPagadoEstePeriodo ?? 0)) / (Number(debtTcCuotas) || 1)))}{tr("/mes")}</strong>{" "}{tr("a la cuota de la tarjeta desde el próximo mes, durante {0} {1}.", [debtTcCuotas, Number(debtTcCuotas) === 1 ? tr("mes") : tr("meses")])}</p>
                          </div>
                          <Button
                            onClick={async () => {
                              if (!payDebt || !selectedDebtTC) return
                              const monto = Math.max(0, payDebt.cuotaPeriodo - (payDebt.montoPagadoEstePeriodo ?? 0))
                              const cuotas = Number(debtTcCuotas) || 1
                              const { data, error } = await debtsApi.payWithCard({
                                tarjetaId: selectedDebtTC,
                                monto,
                                cuotas,
                                sourceType: 'debt',
                                sourceId: payDebt.id,
                              })
                              if (error) { toast({ title: tr("No se pudo registrar el pago con tarjeta"), description: error, variant: "destructive" }); return }
                              const nombreTC = debts.find(d => d.id === selectedDebtTC)?.nombre ?? ''
                              setPayDebt(null); setShowDebtTCOptions(false); setSelectedDebtTC(null); setDebtTcCuotas("1")
                              // Sin recargar la página: se traen los datos nuevos y la billetera se entera sola
                              await refetch()
                              window.dispatchEvent(new Event("kiri:wallet-updated"))
                              if (data?.avisoCupo) avisarCupo(data.avisoCupo, nombreTC)
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 rounded-xl"
                          >{tr("Confirmar pago con TC")}</Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

            <Button variant="outline" onClick={() => setIsPartialMode(v => !v)} className="h-12 font-medium rounded-2xl border-dashed border-2 text-sm">{tr("¿Pagaste otro valor?")}</Button>
            <div className={cn("overflow-hidden transition-all duration-300", isPartialMode ? "max-h-80 opacity-100" : "max-h-0 opacity-0")}>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{tr("Monto abonado")}</Label>
                  <MoneyInput value={partialAmount} onChange={v => setPartialAmount(v)} className="h-12 text-xl font-bold rounded-xl" placeholder="0" autoFocus={isPartialMode} />
                </div>
                {payDebt && Number(partialAmount) > 0 && Number(partialAmount) < Math.max(0, payDebt.cuotaPeriodo - (payDebt.montoPagadoEstePeriodo ?? 0)) && (
                  <CuotaCompletaCheck
                    checked={cuotaCompletaDebt}
                    onChange={setCuotaCompletaDebt}
                    falta={Math.max(0, payDebt.cuotaPeriodo - (payDebt.montoPagadoEstePeriodo ?? 0)) - Number(partialAmount)}
                    formatAmount={formatAmount}
                  />
                )}
                <Button onClick={confirmPartialPay} disabled={!partialAmount || Number(partialAmount) <= 0} className="w-full bg-cyclon-periwinkle text-white font-bold h-11 rounded-xl">{tr("Confirmar abono")}</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Abonar extra a una deuda ya pagada este periodo */}
      <Dialog open={!!abonoTarget} onOpenChange={v => { if (!v) { setAbonoTarget(null); setAbonoAmount("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Abonar a esta deuda")}</DialogTitle>
            <DialogDescription>
              <strong>{abonoTarget?.nombre}</strong>{" "}{tr("· Saldo restante: {0}", [formatAmount(abonoTarget?.saldoRestante ?? 0)])}</DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Monto a abonar")}</Label>
              <MoneyInput value={abonoAmount} onChange={v => setAbonoAmount(v)} className="h-12 text-xl font-bold rounded-xl" placeholder="0" autoFocus />
              <p className="text-[10px] text-muted-foreground">{tr("Se descuenta de tu saldo disponible ({0}) y se abona directo al capital de la deuda.", [formatAmount(wallet.cashBalance)])}</p>
            </div>
            {Number(abonoAmount) > wallet.cashBalance && (
              <p className="text-[10px] text-red-500 font-bold">{tr("No tienes saldo suficiente para este abono.")}</p>
            )}
            <Button
              onClick={confirmAbono}
              disabled={abonoSaving || !abonoAmount || Number(abonoAmount) <= 0 || Number(abonoAmount) > wallet.cashBalance}
              className="w-full bg-cyclon-periwinkle text-white font-bold h-11 rounded-xl"
            >
              {abonoSaving ? "Abonando..." : tr("Confirmar abono")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Fixed Modal */}
      <Dialog open={!!payFixed} onOpenChange={v => !v && setPayFixed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("¿Ya pagaste?")}</DialogTitle>
            <DialogDescription>{tr("Gasto fijo:")}{" "}<strong>{payFixed?.nombre}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-3 flex flex-col gap-3">
            {/* Opción 1: Pagar del sueldo real */}
            <Button onClick={confirmFullPayFixed} className="bg-cyclon-mint text-cyclon-periwinkle hover:bg-cyclon-mint/80 h-14 text-base font-bold rounded-2xl gap-2">
              <CheckCircle2 className="h-5 w-5" />{tr("Pagar ({0})", [formatAmount(Math.max(0, (payFixed?.frecuencia === "quincenal" ? Math.round((payFixed?.monto ?? 0) / 2) : (payFixed?.monto ?? 0)) - ((payFixed as any)?.montoPagadoEstePeriodo ?? 0)))])}</Button>

            {/* Opción 2: Pagar con tarjeta de crédito */}
            {(() => {
              const tarjetas = lineasDeCredito(debts)
              if (tarjetas.length === 0) return null
              const montoFijoTC = Math.max(0, (payFixed?.frecuencia === "quincenal" ? Math.round((payFixed?.monto ?? 0) / 2) : (payFixed?.monto ?? 0)) - ((payFixed as any)?.montoPagadoEstePeriodo ?? 0))
              return (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setShowTCOptions(v => !v); setSelectedTC(null); setTcCuotas("1") }}
                    className="h-12 rounded-2xl border-2 border-amber-500/40 text-amber-600 hover:bg-amber-500/5 font-bold text-sm gap-2"
                  >
                    <CircleDollarSign className="h-4 w-4" />{tr("Pagar con Tarjeta de Crédito")}</Button>
                  {showTCOptions && (
                    <div className="space-y-3 pl-2">
                      {tarjetas.map(tc => (
                        <TarjetaOpcion
                          key={tc.id}
                          tc={tc}
                          selected={selectedTC === tc.id}
                          onSelect={() => setSelectedTC(tc.id === selectedTC ? null : tc.id)}
                          formatAmount={formatAmount}
                          monto={montoFijoTC}
                        />
                      ))}
                      {selectedTC && (
                        <div className="space-y-3 pt-2 border-t border-border/50">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold">{tr("¿A cuántas cuotas?")}</Label>
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
                                <p className="text-[10px] text-muted-foreground">{tr("Se sumará")}{" "}<strong>{formatAmount(Math.round(montoFijo / cuotasNum))}{tr("/mes")}</strong>{" "}{tr("a la cuota de la tarjeta desde el próximo mes, durante {0} {1}.", [tcCuotas, cuotasNum === 1 ? tr("mes") : tr("meses")])}</p>
                              )
                            })()}
                          </div>
                          <Button
                            onClick={async () => {
                              if (!payFixed || !selectedTC) return
                              const montoPorPeriodo = payFixed.frecuencia === "quincenal" ? Math.round(payFixed.monto / 2) : payFixed.monto
                              const monto = Math.max(0, montoPorPeriodo - ((payFixed as any).montoPagadoEstePeriodo ?? 0))
                              const cuotas = Number(tcCuotas) || 1
                              const { data, error } = await debtsApi.payWithCard({
                                tarjetaId: selectedTC,
                                monto,
                                cuotas,
                                sourceType: 'fixed',
                                sourceId: payFixed.id,
                              })
                              if (error) { toast({ title: tr("No se pudo registrar el pago con tarjeta"), description: error, variant: "destructive" }); return }
                              const nombreTC = debts.find(d => d.id === selectedTC)?.nombre ?? ''
                              setPayFixed(null); setShowTCOptions(false); setSelectedTC(null); setTcCuotas("1")
                              await refetch()
                              window.dispatchEvent(new Event("kiri:wallet-updated"))
                              if (data?.avisoCupo) avisarCupo(data.avisoCupo, nombreTC)
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 rounded-xl"
                          >{tr("Confirmar pago con TC")}</Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

            {/* Opción 3: Pagaste otro valor */}
            <Button variant="outline" onClick={() => setIsFixedPartialMode(v => !v)} className="h-12 font-medium rounded-2xl border-dashed border-2 text-sm">{tr("¿Pagaste otro valor?")}</Button>
            <div className={cn("overflow-hidden transition-all duration-300", isFixedPartialMode ? "max-h-96 opacity-100" : "max-h-0 opacity-0")}>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">{tr("Monto real pagado")}</Label>
                  <MoneyInput value={fixedPartialAmount} onChange={v => setFixedPartialAmount(v)} className="h-12 text-xl font-bold rounded-xl" placeholder="0" autoFocus={isFixedPartialMode} />
                  <p className="text-[10px] text-muted-foreground">{tr("Si pagaste más o menos del valor esperado ({0}), registra el monto real aquí.", [formatAmount(payFixed?.frecuencia === "quincenal" ? Math.round((payFixed?.monto ?? 0) / 2) : (payFixed?.monto ?? 0))])}</p>
                </div>
                {payFixed && (() => {
                  const esperado = (payFixed.frecuencia === "quincenal" ? Math.round(payFixed.monto / 2) : payFixed.monto) - (payFixed.montoPagadoEstePeriodo ?? 0)
                  const monto = Number(fixedPartialAmount)
                  if (!(monto > 0 && monto < esperado)) return null
                  return <CuotaCompletaCheck checked={cuotaCompletaFixed} onChange={setCuotaCompletaFixed} falta={esperado - monto} formatAmount={formatAmount} />
                })()}
                <Button onClick={confirmPartialPayFixed} disabled={!fixedPartialAmount || Number(fixedPartialAmount) <= 0} className="w-full bg-cyclon-periwinkle text-white font-bold h-11 rounded-xl">{tr("Confirmar pago")}</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Abonar extra a un gasto fijo ya pagado este periodo */}
      <Dialog open={!!abonoFixedTarget} onOpenChange={v => { if (!v) { setAbonoFixedTarget(null); setAbonoFixedAmount("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Abonar a este gasto fijo")}</DialogTitle>
            <DialogDescription>
              <strong>{abonoFixedTarget?.nombre}</strong>{" "}{tr("· Ya pagado este periodo: {0}", [formatAmount((abonoFixedTarget as any)?.montoPagadoEstePeriodo ?? 0)])}</DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Monto a abonar")}</Label>
              <MoneyInput value={abonoFixedAmount} onChange={v => setAbonoFixedAmount(v)} className="h-12 text-xl font-bold rounded-xl" placeholder="0" autoFocus />
              <p className="text-[10px] text-muted-foreground">{tr("Se descuenta de tu saldo disponible ({0}) y se suma a lo ya pagado este periodo.", [formatAmount(wallet.cashBalance)])}</p>
            </div>
            {Number(abonoFixedAmount) > wallet.cashBalance && (
              <p className="text-[10px] text-red-500 font-bold">{tr("No tienes saldo suficiente para este abono.")}</p>
            )}
            <Button
              onClick={confirmAbonoFixed}
              disabled={abonoFixedSaving || !abonoFixedAmount || Number(abonoFixedAmount) <= 0 || Number(abonoFixedAmount) > wallet.cashBalance}
              className="w-full bg-cyclon-periwinkle text-white font-bold h-11 rounded-xl"
            >
              {abonoFixedSaving ? "Abonando..." : tr("Confirmar abono")}
            </Button>
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
            <DialogTitle>{tr("Pago automático")}</DialogTitle>
            <DialogDescription>{tr("Gasto fijo:")}{" "}<strong>{autoPayTarget?.nombre}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {autoPayTarget?.pagoAutomatico && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">{tr("Activo, pagando con{0}", [" "])}<strong>
                  {autoPayTarget.tarjetaVinculadaId
                    ? debts.find(d => d.id === autoPayTarget.tarjetaVinculadaId)?.nombre ?? tr("una tarjeta")
                    : tr("tu disponible")}
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
              <WalletIcon className="h-4 w-4" />{" "}{tr("Con tu disponible")}</Button>

            {(() => {
              const tarjetas = lineasDeCredito(debts)
              if (tarjetas.length === 0) return null
              return (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground px-1 uppercase tracking-wide">{tr("O con una tarjeta de crédito")}</p>
                  {tarjetas.map(tc => (
                    <TarjetaOpcion
                      key={tc.id}
                      tc={tc}
                      selected={autoPaySelectedTC === tc.id}
                      onSelect={() => setAutoPaySelectedTC(tc.id === autoPaySelectedTC ? null : tc.id)}
                      formatAmount={formatAmount}
                    />
                  ))}
                  {autoPaySelectedTC && (
                    <Button
                      onClick={async () => {
                        if (!autoPayTarget) return
                        await updateFixedExpense(autoPayTarget.id, { pagoAutomatico: true, tarjetaVinculadaId: autoPaySelectedTC })
                        setAutoPayTarget(null); setAutoPaySelectedTC(null)
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 rounded-xl"
                    >{tr("Confirmar con esta tarjeta")}</Button>
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
              >{tr("Desactivar pago automático")}</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Saldo Insuficiente Modal */}
      <Dialog open={insufficientOpen} onOpenChange={v => { if (!v) { setInsufficientOpen(false); setInsufficientTarget(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />{" "}{tr("Saldo insuficiente")}</DialogTitle>
            <DialogDescription>{tr("Tu sueldo disponible actual ({0}) no es suficiente para cubrir esta cuota de", [formatAmount(wallet.cashBalance)])}{" "}<strong>{formatAmount(insufficientTarget?.monto ?? 0)}</strong>{" "}{tr("de")}{" "}<strong>{insufficientTarget?.nombre}</strong>{tr(". ¿Cómo te gustaría proceder?")}</DialogDescription>
          </DialogHeader>
          <div className="py-3 flex flex-col gap-2.5">
            {/* Opción 1: Abono parcial */}
            <button onClick={handleInsufficientPartial}
              disabled={wallet.cashBalance <= 0}
              className={cn("w-full text-left p-4 rounded-2xl border-2 border-cyclon-sky/40 bg-cyclon-sky/5 hover:border-cyclon-sky transition-colors space-y-0.5", wallet.cashBalance <= 0 && "opacity-40 cursor-not-allowed hover:border-cyclon-sky/40")}>
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-cyclon-sky" />
                <p className="font-bold text-sm">{tr("Abono parcial")}</p>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {wallet.cashBalance > 0 ? tr("Abonar mis {0} disponibles", [formatAmount(wallet.cashBalance)]) : tr("No tienes saldo disponible")}
              </p>
            </button>

            {/* Opción 2: Usar ahorros (solo si hay fondos) */}
            {(savingsPockets.reduce((a, p) => a + p.acumulado, 0) + fondoEmergencia) > 0 && (
              <button onClick={handleInsufficientFromSavings}
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/10 hover:border-emerald-400 transition-colors space-y-0.5">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-emerald-600" />
                  <p className="font-bold text-sm">{tr("Usar Ahorros")}</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">{tr("Completar usando mis ahorros (")}{formatAmount(savingsPockets.reduce((a, p) => a + p.acumulado, 0) + fondoEmergencia)}{" "}{tr("disponibles)")}</p>
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
              const tarjetas = lineasDeCredito(debts)
              if (tarjetas.length === 0) return null
              const montoTarget = insufficientTarget?.monto ?? 0
              return (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase pl-1">{tr("Pagar con tarjeta de crédito")}</p>
                  {tarjetas.map(tc => {
                    // La tasa real que Kiri aprendió de los pagos (si la hay), si no la registrada
                    const tasaMensual = tc.tasaInteresAplicada ? Number(tc.tasaInteresAplicada) : tc.tasaInteres ? Number(tc.tasaInteres) : 1.85
                    const trasCupo = usoCupoTras(tc, montoTarget)
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
                            <p className="font-bold text-sm">{tr("Pagar con {0}", [tc.nombre])}</p>
                          </div>
                          <p className="text-xs text-muted-foreground pl-6">{tr("Se sumará {0} al saldo de tu tarjeta.", [formatAmount(montoTarget)])}</p>
                          <div className="pl-6 text-[9px] text-amber-500 space-y-0.5">
                            <p>{tr("Interés mensual estimado: +{0} ({1}%)", [formatAmount(interesMes), tasaMensual])}</p>
                            <p>{tr("Nuevo saldo tarjeta: {0}", [formatAmount(tc.saldoRestante + montoTarget)])}</p>
                            {trasCupo && (
                              <p className={cn("font-bold", trasCupo.disponible < 0 && "text-red-500")}>
                                {trasCupo.disponible < 0
                                  ? tr("Te pasarías del cupo por {0}", [formatAmount(-trasCupo.disponible)])
                                  : tr("Te quedarían {0} de cupo ({1}% usado)", [formatAmount(trasCupo.disponible), trasCupo.pct])}
                              </p>
                            )}
                          </div>
                        </button>
                        {selected && (
                          <div className="px-4 pb-4 space-y-3 pt-1 border-t border-amber-500/20">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold">{tr("¿A cuántas cuotas?")}</Label>
                              <Input
                                type="number"
                                min="1"
                                max="48"
                                value={insufficientTcCuotas}
                                onChange={e => setInsufficientTcCuotas(e.target.value)}
                                className="h-10 rounded-xl text-center font-bold"
                              />
                              <p className="text-[10px] text-muted-foreground">{tr("Se sumará")}{" "}<strong>{formatAmount(Math.round(montoTarget / (Number(insufficientTcCuotas) || 1)))}{tr("/mes")}</strong>{" "}{tr("a la cuota de la tarjeta desde el próximo mes, durante {0} {1}.", [insufficientTcCuotas, Number(insufficientTcCuotas) === 1 ? tr("mes") : tr("meses")])}</p>
                            </div>
                            <Button
                              disabled={payingInsufficientTC}
                              onClick={async () => {
                                if (!insufficientTarget) return
                                setPayingInsufficientTC(true)
                                const { data, error } = await debtsApi.payWithCard({
                                  tarjetaId: tc.id,
                                  monto: montoTarget,
                                  cuotas: Number(insufficientTcCuotas) || 1,
                                  sourceType: insufficientTarget.type,
                                  sourceId: insufficientTarget.id,
                                })
                                if (error) {
                                  setPayingInsufficientTC(false)
                                  toast({ title: tr("No se pudo registrar el pago con tarjeta"), description: tr("Intenta de nuevo."), variant: "destructive" })
                                  return
                                }
                                setInsufficientOpen(false); setInsufficientTarget(null)
                                setInsufficientSelectedTC(null); setInsufficientTcCuotas("1")
                                await refetch()
                                setPayingInsufficientTC(false)
                                window.dispatchEvent(new Event("kiri:wallet-updated"))
                                if (data?.avisoCupo) avisarCupo(data.avisoCupo, tc.nombre)
                              }}
                              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 rounded-xl"
                            >
                              {payingInsufficientTC ? "Procesando..." : tr("Confirmar pago con TC")}
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
                <p className="font-bold text-sm">{tr("Registrar nuevo ingreso")}</p>
              </div>
              <p className="text-xs text-muted-foreground pl-6">{tr("Agregar dinero extra para cubrir la cuota")}</p>
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setInsufficientOpen(false); setInsufficientTarget(null) }}>{tr("Cancelar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Income Modal (dentro del flujo de saldo insuficiente) */}
      <Dialog open={quickIncomeOpen} onOpenChange={v => { if (!v) setQuickIncomeOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><WalletIcon className="h-5 w-5 text-cyclon-lavender" />{" "}{tr("Agregar dinero extra")}</DialogTitle>
            <DialogDescription>{tr("Inyecta liquidez a tu sueldo real para cubrir la cuota.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr("Monto")}</Label>
              <MoneyInput value={quickIncomeMonto} onChange={setQuickIncomeMonto} className="h-14 text-2xl font-bold bg-muted/30 border-none rounded-2xl" placeholder="0" autoFocus />
              {insufficientTarget && (
                <p className="text-[10px] text-muted-foreground">{tr("Te faltan al menos {0} para cubrir la cuota", [formatAmount(Math.max(0, (insufficientTarget.monto) - wallet.cashBalance))])}</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setQuickIncomeOpen(false)}>{tr("Cancelar")}</Button>
            <Button onClick={handleQuickIncome} disabled={!quickIncomeMonto || Number(quickIncomeMonto) <= 0}
              className="bg-cyclon-lavender text-white font-bold rounded-xl px-6">{tr("Registrar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Savings Source Selector (elegir de dónde sacar) */}
      <Dialog open={savingsSourceOpen} onOpenChange={v => { if (!v) setSavingsSourceOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5 text-emerald-600" />{" "}{tr("¿De dónde sacar?")}</DialogTitle>
            <DialogDescription>{tr("Necesitas {0} adicionales. Elige de dónde tomar los fondos.", [formatAmount(Math.max(0, (insufficientTarget?.monto ?? 0) - wallet.cashBalance))])}</DialogDescription>
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
                      <p className="font-bold text-sm">{tr("Fondo de Emergencia")}</p>
                      <p className="text-[10px] text-muted-foreground">{tr("Disponible: {0}", [formatAmount(fondoEmergencia)])}</p>
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
                      <p className="text-[10px] text-muted-foreground">{tr("Disponible: {0}", [formatAmount(pocket.acumulado)])}</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {savingsPockets.filter(p => p.acumulado > 0).length === 0 && fondoEmergencia === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">{tr("No tienes fondos de ahorro disponibles.")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSavingsSourceOpen(false)}>{tr("Cancelar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActualizarSaldoDialog debt={saldoTarget} onClose={() => setSaldoTarget(null)} formatAmount={formatAmount} onDone={refetch} />

      {/* Add Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr("Agregar {0}", [addType === "deuda" ? tr("Deuda") : tr("Gasto Fijo")])}</DialogTitle>
            <DialogDescription>{tr("Completa los datos del compromiso.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addType === "deuda" ? (
              <DebtRegistrationForm
                loading={saving}
                onSubmit={async (data) => {
                  setSaving(true)
                  const creada = await addDebt({
                    nombre: data.nombre,
                    montoTotal: data.montoTotal,
                    cuotaPeriodo: data.cuotaPeriodo,
                    cupoTotal: data.cupoTotal,
                    diasPago: data.diasPago,
                    frecuenciaPago: data.frecuenciaPago,
                    tasaInteres: data.tasaInteres || undefined,
                    acreedor: data.acreedor,
                    saldoRestante: data.saldoActual,
                    bankEntityId: data.bankEntityId,
                    tipoDeuda: data.tipoDeuda,
                    yaPagoEstePeriodo: data.yaPagoEstePeriodo,
                    nuevaProximoPeriodo: data.nuevaProximoPeriodo,
                    budgetCategoryId: data.budgetCategoryId,
                  })
                  setSaving(false)
                  // Si falló, el formulario queda abierto con lo escrito (el error ya se avisó)
                  if (creada) setIsAddOpen(false)
                }}
              />
            ) : (
              <>
                <FixedFormFields form={addFixedForm} onChange={setAddFixedForm} dueQuestion={addFixedDueQ} />
                <DialogFooter className="gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setIsAddOpen(false)}>{tr("Cancelar")}</Button>
                  <Button onClick={handleAdd} disabled={saving} className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-8">
                    {saving ? "Guardando..." : tr("Guardar")}
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
            <DialogTitle>{tr("Editar Deuda")}</DialogTitle>
            <DialogDescription>{tr("Modifica los datos de")}{" "}<strong>{editDebt?.nombre}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <DebtFormFields form={editDebtForm} onChange={setEditDebtForm} isEdit dueQuestion={editDebtDueQ} />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditDebt(null)}>{tr("Cancelar")}</Button>
            <Button onClick={handleEditDebtSubmit} disabled={savingEdit} className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-8">
              {savingEdit ? "Guardando..." : tr("Guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scope Confirmation */}
      <Dialog open={isScopeOpen} onOpenChange={v => !v && setIsScopeOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("¿Cómo aplicar el cambio?")}</DialogTitle>
            <DialogDescription>{tr("Cambiaste la cuota de")}{" "}<strong>{formatAmount(editDebt?.cuotaPeriodo ?? 0)}</strong> a <strong>{formatAmount(Number(editDebtForm.cuotaPeriodo))}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-3">
            <button onClick={() => applyDebtEdit("este_mes")} className="w-full text-left p-4 rounded-2xl border-2 border-cyclon-sky/40 bg-cyclon-sky/5 hover:border-cyclon-sky transition-colors space-y-0.5">
              <p className="font-bold text-sm">{tr("Solo este periodo")}</p>
              <p className="text-xs text-muted-foreground">{tr("Solo la cuota de este periodo cambia; la de {0} vuelve sola el próximo periodo.", [formatAmount(editDebt?.cuotaBase ?? editDebt?.cuotaPeriodo ?? 0)])}</p>
            </button>
            <button onClick={() => applyDebtEdit("permanente")} className="w-full text-left p-4 rounded-2xl border-2 border-cyclon-lavender/40 bg-cyclon-lavender/5 hover:border-cyclon-lavender transition-colors space-y-0.5">
              <p className="font-bold text-sm">{tr("Cambio permanente")}</p>
              <p className="text-xs text-muted-foreground">{tr("La nueva cuota se usará en todos los periodos futuros.")}</p>
            </button>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setIsScopeOpen(false)}>{tr("Cancelar")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Fixed Modal */}
      <Dialog open={!!editFixed} onOpenChange={v => !v && setEditFixed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Editar Gasto Fijo")}</DialogTitle>
            <DialogDescription>{tr("Modifica")}{" "}<strong>{editFixed?.nombre}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FixedFormFields form={editFixedForm} onChange={setEditFixedForm} dueQuestion={editFixedDueQ} isEdit />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditFixed(null)}>{tr("Cancelar")}</Button>
            <Button onClick={handleEditFixed} disabled={savingFixed} className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-8">
              {savingFixed ? "Guardando..." : tr("Guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adelantar la próxima cuota */}
      <Dialog open={!!adelantoTarget} onOpenChange={v => { if (!v && !adelantoSaving) setAdelantoTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Adelantar próxima cuota")}</DialogTitle>
            <DialogDescription>{tr("Este pago queda asignado a")}{" "}<strong>{adelantoTarget?.periodo ? formatPeriodo(adelantoTarget.periodo) : tr("el próximo periodo")}</strong>{" "}{tr("de")}{" "}<strong>{adelantoTarget?.nombre}</strong>{tr(", así la próxima cuota ya aparece pagada cuando llegue.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs font-bold">{tr("Monto")}</Label>
            <MoneyInput value={adelantoAmount} onChange={setAdelantoAmount} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
            {Number(adelantoAmount) > wallet.cashBalance && (
              <p className="text-[10px] text-red-500 font-bold">{tr("Tu saldo disponible es {0}.", [formatAmount(wallet.cashBalance)])}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={adelantoSaving} onClick={() => setAdelantoTarget(null)}>{tr("Cancelar")}</Button>
            <Button onClick={confirmAdelanto} disabled={adelantoSaving || Number(adelantoAmount) <= 0 || Number(adelantoAmount) > wallet.cashBalance} className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-6">
              {adelantoSaving ? "Guardando..." : tr("Adelantar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deshacer pago — solo cuando hay más de un pago en el periodo */}
      <Dialog open={!!undoTarget} onOpenChange={v => { if (!v && !undoing) setUndoTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("¿Qué quieres deshacer?")}</DialogTitle>
            <DialogDescription>{tr("En este periodo registraste {0} pagos a", [undoTarget?.pagos.cantidad])}{" "}<strong>{undoTarget?.nombre}</strong>{" "}{tr("por un total de {0}.", [formatAmount(undoTarget?.totalPeriodo ?? 0)])}</DialogDescription>
          </DialogHeader>
          <div className="py-2 flex flex-col gap-3">
            <button disabled={undoing} onClick={() => confirmUndo("ultimo")} className="w-full text-left p-4 rounded-2xl border-2 border-cyclon-periwinkle/40 bg-cyclon-periwinkle/5 hover:border-cyclon-periwinkle transition-colors space-y-0.5 disabled:opacity-50">
              <p className="font-bold text-sm">{tr("Solo el último abono ({0})", [formatAmount(undoTarget?.pagos.ultimoMonto ?? 0)])}</p>
              <p className="text-xs text-muted-foreground">
                {undoTarget?.pagos.ultimoEsMarcador
                  ? tr("Quita la marca de \"ya la había pagado\". No devuelve dinero porque no salió de tu billetera.")
                  : tr("Se devuelve ese monto y el resto de lo pagado este periodo queda igual.")}
              </p>
            </button>
            <button disabled={undoing} onClick={() => confirmUndo("todo")} className="w-full text-left p-4 rounded-2xl border-2 border-red-400/40 bg-red-500/5 hover:border-red-500 transition-colors space-y-0.5 disabled:opacity-50">
              <p className="font-bold text-sm">{tr("Todo lo pagado este periodo ({0})", [formatAmount(undoTarget?.totalPeriodo ?? 0)])}</p>
              <p className="text-xs text-muted-foreground">{tr("La cuota y todos los abonos del periodo se revierten.")}</p>
            </button>
          </div>
          <DialogFooter><Button variant="ghost" disabled={undoing} onClick={() => setUndoTarget(null)}>{tr("Cancelar")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />{" "}{tr("Eliminar")}</DialogTitle>
            <DialogDescription>{tr("¿Eliminar")}{" "}<strong>{deleteTarget?.nombre}</strong>{tr("? Esta acción no se puede deshacer.")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>{tr("Cancelar")}</Button>
            <Button variant="destructive" onClick={confirmDelete} className="rounded-xl font-bold px-8">{tr("Eliminar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ MODAL REGISTRAR GASTO (directo desde Obligaciones) ═══ */}
      <Dialog open={expenseModalOpen} onOpenChange={v => { if (!v) { setExpenseModalOpen(false); setExpNombre(""); setExpMonto(""); setExpCategoria(null); setExpShowTCOptions(false); setExpSelectedTC(null); setExpTcCuotas("1"); setExpHormiga(null); setExpCategoriaManual(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-kiri-emerald" />{tr("Registrar gasto")}</DialogTitle>
            <DialogDescription>{tr("El gasto se registrará y descontará de tu presupuesto libre.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Descripción")}</Label>
              <Input
                placeholder={tr("Ej: Mercado semanal, Uber, Netflix...")}
                value={expNombre}
                onChange={e => setExpNombre(e.target.value)}
                className="h-10 rounded-xl"
                autoFocus
              />
              {/* Categoría sugerida por Kiri */}
              {expNombre && expCategoriaSugerida && !expCategoriaManual && (
                <p className="text-[9px] text-kiri-emerald flex items-center gap-1">{tr("📁 Categoría sugerida: {0}", [expCategoriaSugerida.nombre])}{expCategoriaSugerida.fuente === 'historial' && <span className="text-muted-foreground">{tr("· así lo registraste antes")}</span>}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">{tr("Monto")}</Label>
              <MoneyInput value={expMonto} onChange={v => setExpMonto(v)} className="h-12 text-lg font-bold rounded-xl" placeholder="0" />
            </div>
            {/* Gasto hormiga: Kiri lo sugiere (monto chico o palabra clave) y el usuario decide */}
            {expNombre && Number(expMonto) > 0 && (() => {
              const auto = esGastoHormiga(expNombre, Number(expMonto))
              const activo = expHormiga ?? auto
              return (
                <button type="button" onClick={() => setExpHormiga(!activo)}
                  className={cn("w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors",
                    activo ? "border-cyclon-pink/40 bg-cyclon-pink/5" : "border-muted")}>
                  <span className="text-[10px] font-bold">{tr("🐜 Gasto hormiga")}{" "}{expHormiga === null && auto && <span className="font-normal text-muted-foreground">{tr("· sugerido por Kiri")}</span>}
                  </span>
                  <span className={cn("relative h-5 w-9 rounded-full transition-colors", activo ? "bg-cyclon-pink" : "bg-muted")}>
                    <span className={cn("absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", activo && "translate-x-4")} />
                  </span>
                </button>
              )
            })()}
            {/* Selector de categoría */}
            {budgetCategories.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{tr("Categoría (opcional)")}</Label>
                <div className="flex gap-2 flex-wrap">
                  {budgetCategories.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { setExpCategoria(expCategoria === c.name ? null : c.name); setExpCategoriaManual(true) }}
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
            {/* Del hogar: suma al presupuesto compartido con la pareja y le avisa */}
            {hogarCats.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{tr("Del hogar")}{" "}{hogarPareja && <span className="font-normal text-muted-foreground">{tr("(con")}{" "}{hogarPareja.split(" ")[0]})</span>}</Label>
                <div className="flex gap-2 flex-wrap">
                  {hogarCats.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => setExpHogarId(expHogarId === c.id ? null : c.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors",
                        expHogarId === c.id ? "border-pink-500 bg-pink-500/10 text-pink-600 dark:text-pink-400" : "border-muted text-muted-foreground hover:border-pink-500/40"
                      )}
                    >
                      {c.icono} {c.nombre} <span className="font-normal opacity-70">{tr("· quedan {0}", [formatAmount(c.disponible)])}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Pagar con tarjeta de crédito: es un consumo más, con la misma
                lógica de tarjeta+cuotas que pagar una deuda/gasto fijo con TC. */}
            {(() => {
              const tarjetas = lineasDeCredito(debts)
              if (tarjetas.length === 0) return null
              return (
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setExpShowTCOptions(v => !v); setExpSelectedTC(null); setExpTcCuotas("1") }}
                    className="w-full h-11 rounded-2xl border-2 border-amber-500/40 text-amber-600 hover:bg-amber-500/5 font-bold text-sm gap-2"
                  >
                    <CircleDollarSign className="h-4 w-4" />{tr("Pagar con Tarjeta de Crédito")}</Button>
                  {expShowTCOptions && (
                    <div className="space-y-3 pl-2 pt-1">
                      {tarjetas.map(tc => (
                        <TarjetaOpcion
                          key={tc.id}
                          tc={tc}
                          selected={expSelectedTC === tc.id}
                          onSelect={() => setExpSelectedTC(tc.id === expSelectedTC ? null : tc.id)}
                          formatAmount={formatAmount}
                          monto={Number(expMonto) || 0}
                        />
                      ))}
                      {expSelectedTC && (
                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                          <Label className="text-xs font-bold">{tr("¿A cuántas cuotas?")}</Label>
                          <Input
                            type="number"
                            min="1"
                            max="48"
                            value={expTcCuotas}
                            onChange={e => setExpTcCuotas(e.target.value)}
                            className="h-10 rounded-xl text-center font-bold"
                          />
                          {Number(expMonto) > 0 && (
                            <p className="text-[10px] text-muted-foreground">{tr("Se sumará")}{" "}<strong>{formatAmount(Math.round(Number(expMonto) / (Number(expTcCuotas) || 1)))}{tr("/mes")}</strong>{" "}{tr("a la cuota de la tarjeta desde el próximo mes, durante {0} {1}.", [expTcCuotas, Number(expTcCuotas) === 1 ? tr("mes") : tr("meses")])}</p>
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
            <Button variant="ghost" onClick={() => setExpenseModalOpen(false)}>{tr("Cancelar")}</Button>
            <Button
              onClick={async () => {
                if (!expNombre || !expMonto || Number(expMonto) <= 0) return
                if (expShowTCOptions && !expSelectedTC) return
                setExpSaving(true)
                const esHormiga = expHormiga ?? esGastoHormiga(expNombre, Number(expMonto))
                // La categoría que se elige acá es una categoría de Presupuesto (nombre
                // libre, ej. "Alimentación") — no la de gasto hormiga (enum fijo cafe/
                // comida/transporte/antojo/salida/otro que espera el backend). Antes se
                // mandaba el nombre de la categoría tal cual en ese campo: el backend lo
                // rechazaba (400, enum inválido) y el gasto NUNCA se guardaba — el modal
                // igual se cerraba como si hubiera funcionado. La categoría de Presupuesto
                // se etiqueta en el nombre (así la reconoce budget-category-spend.ts para
                // el gasto por categoría), y a la API se le manda siempre 'otro'.
                // La categoría de Presupuesto va en su propio campo (FK), ya no
                // como "[Cat]" pegado al nombre.
                const budgetCategoryId = expCategoria ? budgetCategories.find(c => c.name === expCategoria)?.id ?? null : null
                const result = await addImpulseExpense({
                  nombre: expNombre, monto: Number(expMonto), categoria: 'otro', esHormiga, budgetCategoryId, sharedCategoryId: expHogarId,
                  ...(expSelectedTC ? { tarjetaId: expSelectedTC, cuotas: Number(expTcCuotas) || 1 } : {}),
                })
                setExpSaving(false)
                if (!result) {
                  toast({ title: tr("No se pudo registrar el gasto"), description: tr("Intenta de nuevo."), variant: "destructive" })
                  return
                }
                setExpenseModalOpen(false)
                setExpNombre(""); setExpMonto(""); setExpCategoria(null); setExpHormiga(null); setExpCategoriaManual(false); setExpHogarId(null)
                setExpShowTCOptions(false); setExpSelectedTC(null); setExpTcCuotas("1")
                const { data } = await userApi.getWallet()
                if (data) setWallet(data.wallet)
              }}
              disabled={expSaving || !expNombre || !expMonto || Number(expMonto) <= 0 || (expShowTCOptions && !expSelectedTC)}
              className="bg-kiri-emerald text-white font-bold rounded-xl px-6"
            >
              {expSaving ? "Guardando..." : tr("Registrar")}
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
function DebtCard({ debt, formatAmount, onPay, onUndoPay, onAbonar, onAdelantar, onUndoAdelanto, onPagarAtraso, onMarcarAtraso, onEdit, onDelete, hidden, onToggleHidden, isPeriodPriority, onToggleAutoPay, strategyBadge, onActualizarSaldo }: {
  debt: Debt; formatAmount: (n: number) => string
  onPay: () => void; onUndoPay: () => void; onAbonar: () => void; onEdit: () => void; onDelete: () => void
  onAdelantar: () => void; onUndoAdelanto: () => void
  onPagarAtraso: (a: CuotaAtrasada) => void; onMarcarAtraso: (a: CuotaAtrasada) => void
  hidden: boolean; onToggleHidden: () => void; isPeriodPriority?: boolean
  onToggleAutoPay?: () => void
  strategyBadge?: string | null
  /** "Mi banco dice que debo $X" (tarjetas y créditos de compras) */
  onActualizarSaldo: () => void
}) {
  const [showStrategyInfo, setShowStrategyInfo] = useState(false)
  const esLinea = debt.esLineaCredito ?? debt.tipoDeuda !== 'PRESTAMO'
  const cuotasRestantes = debt.cuotaPeriodo > 0 ? Math.ceil(debt.saldoRestante / debt.cuotaPeriodo) : 0
  // Clamp a [0, 100] — en una tarjeta de crédito el saldo puede SUBIR por
  // encima de `montoTotal` (el monto con el que se creó) al hacer nuevas
  // compras con ella, lo que sin este límite mostraba un "% pagado" negativo.
  const progreso = debt.montoTotal > 0 ? Math.max(0, Math.min(100, Math.round(((debt.montoTotal - debt.saldoRestante) / debt.montoTotal) * 100))) : 0
  const payInfo = getNextPaymentInfo(debt.diasPago, debt.pagadoEstePeriodo, debt.frecuenciaPago === 'quincenal', debt.pendienteProximoPeriodo)
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
                {strategyBadge?.includes('Nieve') ? tr("❄️ Estrategia Bola de Nieve") : tr("⚡ Estrategia Avalancha")}
              </p>
              <button onClick={(e) => { e.stopPropagation(); setShowStrategyInfo(false) }} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {strategyBadge?.includes('Nieve')
                ? tr("La Bola de Nieve prioriza la deuda con MENOR saldo restante. Al liquidarla rápido, liberas esa cuota para atacar la siguiente. Genera motivación psicológica al ver resultados rápidos.")
                : tr("La Avalancha prioriza la deuda con MAYOR tasa de interés. Así minimizas el dinero que regalas al banco en intereses. Es la estrategia que más te ahorra a largo plazo.")
              }
            </p>
            <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
              {strategyBadge?.includes('Nieve')
                ? tr("💡 Paga primero esta deuda porque es la más pequeña. Cuando la liquides, usa esa cuota para la siguiente.")
                : tr("💡 Paga primero esta deuda porque es la que más interés te cobra. Cada peso extra que abonas aquí te ahorra más.")
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-bold text-sm leading-tight line-clamp-2 break-words min-w-0">{hidden ? "••••••" : debt.nombre}</h3>
                {(() => {
                  const montoPagadoPeriodo = debt.montoPagadoEstePeriodo ?? 0
                  const isPartial = montoPagadoPeriodo > 0 && !debt.pagadoEstePeriodo
                  if (esLinea && debt.saldoRestante <= 0) {
                    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{tr("En ceros ✓")}</span>
                  }
                  if (isPartial) {
                    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{tr("Pago parcial")}</span>
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
                  {payInfo.status === 'pagado' ? tr("Próximo: {0}", [payInfo.nextDate]) : payInfo.nextDate}
                  {" · "}{debt.frecuenciaPago === 'quincenal' ? tr("Quincenal") : tr("Mensual")}
                  {debt.pagoAutomatico && <span className="ml-1.5 text-amber-500">{tr("⚡ Auto")}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {debt.frecuenciaPago !== 'quincenal' && (
            <button onClick={onToggleAutoPay} title={debt.pagoAutomatico ? tr("Pago automático activado: se paga sola al registrar tu sueldo en Billetera") : tr("Pagar sola al registrar tu sueldo en Billetera")}
              className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                debt.pagoAutomatico ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10")}>
              <span className="text-[10px]">⚡</span>
            </button>
            )}
            <button onClick={onToggleHidden} aria-label={hidden ? tr("Mostrar") : tr("Ocultar")} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors">
              {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onEdit} aria-label={tr("Editar")} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-cyclon-lavender hover:bg-cyclon-lavender/10 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} aria-label={tr("Eliminar")} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Cuotas atrasadas: periodos ya cerrados que quedaron sin cubrir. Antes
            desaparecían solas al cambiar de mes y solo quedaban en el saldo. */}
        {!hidden && <AtrasosBanner atrasos={debt.atrasos} montoAtrasado={debt.montoAtrasado} formatAmount={formatAmount} onPagar={onPagarAtraso} onMarcar={onMarcarAtraso} />}

        {/* Deuda compartida — solo informativo, no cambia cómo se paga */}
        {!hidden && debt.esCompartida && debt.nombreParticipanteB && (
          <div className="flex items-center justify-between bg-cyclon-lavender/5 border border-cyclon-lavender/20 rounded-xl px-3 py-2 text-[10px]">
            <span className="font-bold text-cyclon-lavender">{tr("Compartida con {0}", [debt.nombreParticipanteB])}</span>
            <span className="text-muted-foreground">{tr("Tú: {0} · {1}: {2}", [formatAmount(debt.montoParticipanteA ?? 0), debt.nombreParticipanteB, formatAmount(debt.montoParticipanteB ?? 0)])}</span>
          </div>
        )}

        {/* Tarjeta o crédito de compras: cupo, ocupado, disponible e intereses */}
        {esLinea && !hidden && (
          <LineaCreditoResumen debt={debt} formatAmount={formatAmount} onAgregarCupo={onEdit} onActualizarSaldo={onActualizarSaldo} />
        )}

        {/* Montos */}
        {esLinea ? null : !hidden ? (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">{tr("Saldo restante")}</p>
              <p className="text-xl font-black">{formatAmount(debt.saldoRestante)}</p>
              {debt.montoTotal !== debt.saldoRestante && (
                <p className="text-[9px] text-muted-foreground">{tr("de")}{" "}{formatAmount(debt.montoTotal)}{" "}{tr("original")}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">
                {debt.pagadoEstePeriodo && debt.montoPagadoEstePeriodo ? tr("Pagado") : tr("Cuota")}
              </p>
              <p className="text-sm font-bold">
                {debt.pagadoEstePeriodo && debt.montoPagadoEstePeriodo
                  ? formatAmount(debt.montoPagadoEstePeriodo)
                  : formatAmount(debt.cuotaPeriodo)}
              </p>
              {debt.cuotaAjustadaEstePeriodo && (
                <p className="text-[9px] text-amber-600">{tr("Ajustada este periodo · normal {0}", [formatAmount(debt.cuotaBase ?? 0)])}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xl font-black text-muted-foreground">••••••</p>
        )}

        {/* Barra de progreso + cuotas restantes (un cupo no tiene "cuotas restantes") */}
        {!hidden && !esLinea && (
          <div className="space-y-1.5">
            <Progress value={progreso} className="h-1.5" indicatorClassName="bg-cyclon-periwinkle" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">{tr("{0}% pagado", [progreso])}</span>
              <span className="text-[10px] font-bold bg-cyclon-periwinkle/10 text-cyclon-periwinkle px-2 py-0.5 rounded-full">
                {cuotasRestantes}{" "}{tr("cuotas restantes")}</span>
            </div>
          </div>
        )}

        {/* Botón de pagar */}
        {(() => {
          const montoPagadoPeriodo = debt.montoPagadoEstePeriodo ?? 0
          const isPartiallyPaid = montoPagadoPeriodo > 0 && !debt.pagadoEstePeriodo

          // Tarjeta en ceros: no hay nada que pagar este mes
          if (esLinea && debt.saldoRestante <= 0 && montoPagadoPeriodo === 0) return null
          if (debt.pagadoEstePeriodo) {
            return (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button onClick={onUndoPay} size="sm" variant="ghost" className="flex-1 rounded-xl h-9 text-xs text-muted-foreground">{tr("Deshacer pago")}</Button>
                  <Button onClick={onAbonar} size="sm" className="flex-1 bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">{tr("Abonar")}</Button>
                  {!debt.proximaCuotaCubierta && debt.estado === 'activa' && (
                    <Button onClick={onAdelantar} size="sm" className="flex-1 bg-kiri-emerald/10 text-kiri-emerald hover:bg-kiri-emerald/20 border-none rounded-xl h-9 font-bold text-xs">{tr("Adelantar")}</Button>
                  )}
                </div>
                <AdelantoInfo monto={debt.montoAdelantado} cubierta={debt.proximaCuotaCubierta} periodo={debt.periodoSiguiente} formatAmount={formatAmount} onUndo={onUndoAdelanto} />
              </div>
            )
          }
          if (isPartiallyPaid) {
            return (
              <div className="space-y-2">
                <p className="text-[10px] text-amber-500 font-bold">{tr("Abonado: {0} de {1} · Falta: {2}", [formatAmount(montoPagadoPeriodo), formatAmount(debt.cuotaPeriodo), formatAmount(debt.cuotaPeriodo - montoPagadoPeriodo)])}</p>
                <div className="flex gap-2">
                  <Button onClick={onUndoPay} size="sm" variant="ghost" className="flex-1 rounded-xl h-9 text-xs text-muted-foreground">{tr("Deshacer pago")}</Button>
                  <Button onClick={onPay} size="sm" className="flex-1 bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">{tr("Pagar restante")}</Button>
                </div>
              </div>
            )
          }
          if (debt.estado === 'activa') {
            return (
              <Button onClick={onPay} size="sm" className="w-full bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">{tr("Registrar pago de cuota")}</Button>
            )
          }
          return null
        })()}
      </CardContent>
    </Card>
  )
}

// ─── TusCupos — todas las tarjetas y créditos de compras juntos ──────────────
function TusCupos({ debts, formatAmount }: { debts: Debt[]; formatAmount: (n: number) => string }) {
  const lineas = lineasDeCredito(debts)
  const conCupo = lineas.filter(d => d.cupoTotal != null && d.cupoTotal > 0)
  if (lineas.length === 0) return null
  const cupo = conCupo.reduce((s, d) => s + (d.cupoTotal ?? 0), 0)
  const ocupado = conCupo.reduce((s, d) => s + d.saldoRestante, 0)
  const disponible = cupo - ocupado
  const uso = cupo > 0 ? Math.round((ocupado / cupo) * 100) : 0
  const sinCupo = lineas.length - conCupo.length
  return (
    <Card className="border-none shadow-sm rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      <CardContent className="p-4 space-y-3 bg-gradient-to-br from-amber-500/10 via-transparent to-kiri-emerald/10">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-amber-600" />{tr("Tus cupos")}</p>
          <span className="text-[10px] text-muted-foreground">{tr("{0} tarjetas y créditos", [lineas.length])}</span>
        </div>
        {cupo > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-[9px] text-muted-foreground">{tr("Cupo total")}</p><p className="text-sm font-black">{formatAmount(cupo)}</p></div>
              <div><p className="text-[9px] text-muted-foreground">{tr("Ocupado")}</p><p className="text-sm font-black text-amber-600">{formatAmount(ocupado)}</p></div>
              <div><p className="text-[9px] text-muted-foreground">{tr("Disponible")}</p><p className={cn("text-sm font-black", disponible < 0 ? "text-red-500" : "text-kiri-emerald")}>{formatAmount(disponible)}</p></div>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden flex">
              {conCupo.map((d, i) => (
                <div key={d.id} title={d.nombre} className="h-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (d.saldoRestante / cupo) * 100)}%`, backgroundColor: ["#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"][i % 6] }} />
              ))}
            </div>
            <p className={cn("text-[10px]", uso >= 80 ? "text-red-500 font-bold" : uso >= 30 ? "text-amber-600" : "text-muted-foreground")}>
              {uso >= 80 ? tr("Usas el {0}% de tus cupos: es mucho, intenta no cargar más compras.", [uso])
                : uso >= 30 ? tr("Usas el {0}% de tus cupos. Lo ideal es estar por debajo del 30%.", [uso])
                : tr("Usas el {0}% de tus cupos. ¡Vas muy bien!", [uso])}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">{tr("Agrega el cupo de tus tarjetas (lápiz de cada una) para ver cuánto te queda disponible.")}</p>
        )}
        {sinCupo > 0 && cupo > 0 && (
          <p className="text-[9px] text-muted-foreground">{tr("{0} sin cupo registrado (no se suman aquí).", [sinCupo])}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── LineaCreditoResumen — cupo de una tarjeta o crédito de compras ──────────
// Ocupado, disponible, % de uso y los intereses que Kiri detectó con el saldo
// del banco. Una tarjeta no tiene "cuotas restantes" ni "% pagado": tiene cupo.
function LineaCreditoResumen({ debt, formatAmount, onAgregarCupo, onActualizarSaldo }: {
  debt: Debt; formatAmount: (n: number) => string; onAgregarCupo: () => void; onActualizarSaldo: () => void
}) {
  const uso = debt.cupoUsoPct ?? null
  const color = uso == null ? "bg-amber-500" : uso >= 100 ? "bg-red-500" : uso >= 80 ? "bg-amber-500" : uso >= 30 ? "bg-amber-400" : "bg-kiri-emerald"
  const tasa = debt.tasaInteresAplicada ?? debt.tasaInteres ?? null
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground">{tr("Ocupado")}</p>
          <p className="text-xl font-black">{formatAmount(debt.saldoRestante)}</p>
        </div>
        {debt.cupoDisponible != null ? (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">{tr("Disponible")}</p>
            <p className={cn("text-lg font-black", debt.cupoDisponible < 0 ? "text-red-500" : "text-kiri-emerald")}>{formatAmount(debt.cupoDisponible)}</p>
            <p className="text-[9px] text-muted-foreground">{tr("de {0} de cupo", [formatAmount(debt.cupoTotal ?? 0)])}</p>
          </div>
        ) : (
          <button onClick={onAgregarCupo} className="text-[10px] font-bold text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg transition-colors text-right">
            {tr("+ Agrega el cupo para ver cuánto te queda")}
          </button>
        )}
      </div>
      {debt.cupoTotal != null && debt.cupoTotal > 0 && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-700 ease-out", color)} style={{ width: `${Math.min(100, uso ?? 0)}%` }} />
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className={cn("font-medium", (uso ?? 0) >= 100 ? "text-red-500" : (uso ?? 0) >= 80 ? "text-amber-600" : "text-muted-foreground")}>
              {(uso ?? 0) >= 100 ? tr("Por encima del cupo") : tr("Usas el {0}% del cupo", [uso ?? 0])}
            </span>
            {debt.saldoRestante > 0 && <span className="text-muted-foreground">{tr("Cuota del mes: {0}", [formatAmount(debt.cuotaPeriodo)])}</span>}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/20 px-3 py-2">
        <div className="text-[10px] leading-tight min-w-0">
          {debt.ultimoInteres ? (
            <>
              <p className="font-bold text-red-500">{tr("Intereses y cargos detectados: {0}", [formatAmount(debt.ultimoInteres.monto)])}</p>
              <p className="text-muted-foreground">{tasa ? tr("Tu tasa real: {0}% mensual", [Number(tasa).toLocaleString("es-CO", { maximumFractionDigits: 2 })]) : tr("Con el saldo de tu banco")}</p>
            </>
          ) : (
            <p className="text-muted-foreground">{tasa ? tr("Tasa: {0}% mensual", [Number(tasa).toLocaleString("es-CO", { maximumFractionDigits: 2 })]) : tr("Kiri detecta los intereses cuando le dices cuánto dice tu banco que debes.")}</p>
          )}
        </div>
        <button onClick={onActualizarSaldo} className="shrink-0 text-[10px] font-bold text-cyclon-periwinkle bg-cyclon-periwinkle/10 hover:bg-cyclon-periwinkle/20 px-2.5 py-1.5 rounded-lg transition-colors active:scale-95">
          {tr("Actualizar saldo")}
        </button>
      </div>
    </div>
  )
}

// ─── ActualizarSaldoDialog — "mi banco dice que debo $X" ─────────────────────
// Kiri compara con su saldo y registra la diferencia: intereses y cargos,
// compras que no se registraron, o una corrección si el banco dice menos.
function ActualizarSaldoDialog({ debt, onClose, formatAmount, onDone }: {
  debt: Debt | null; onClose: () => void; formatAmount: (n: number) => string; onDone: () => Promise<void> | void
}) {
  const { toast } = useToast()
  const [valor, setValor] = useState("")
  const [motivo, setMotivo] = useState<"interes" | "compras">("interes")
  const [saving, setSaving] = useState(false)
  useEffect(() => { setValor(""); setMotivo("interes") }, [debt?.id])
  if (!debt) return null
  const banco = valor ? Number(valor) : null
  const diferencia = banco != null ? Math.round(banco - debt.saldoRestante) : 0
  const esLinea = debt.esLineaCredito ?? debt.tipoDeuda !== "PRESTAMO"
  // Más de 8% del saldo de un mes a otro rara vez son solo intereses
  const grande = diferencia > 0 && debt.saldoRestante > 0 && diferencia / debt.saldoRestante > 0.08

  const guardar = async () => {
    if (banco == null) return
    setSaving(true)
    const { data, error } = await debtsApi.ajustarSaldo(debt.id, banco, esLinea ? motivo : "interes")
    setSaving(false)
    if (error || !data) { toast({ title: tr("No se pudo actualizar el saldo"), description: error ?? undefined, variant: "destructive" }); return }
    const a = data.ajuste
    toast({
      title: !a ? tr("Tu saldo ya cuadraba con el banco") : a.tipo === "interes" ? tr("Intereses y cargos: {0}", [formatAmount(a.monto)]) : a.tipo === "compras" ? tr("Compras sin registrar: {0}", [formatAmount(a.monto)]) : tr("Saldo corregido ({0})", [formatAmount(a.monto)]),
      description: a?.tasaObservadaMensual != null ? tr("Tu tasa real quedó en {0}% mensual.", [a.tasaObservadaMensual.toLocaleString("es-CO", { maximumFractionDigits: 2 })]) : tr("Saldo actualizado a {0}, igual que en tu banco.", [formatAmount(banco)]),
    })
    await onDone()
    onClose()
  }

  return (
    <Dialog open={!!debt} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Actualizar saldo de {0}", [debt.nombre])}</DialogTitle>
          <DialogDescription>{tr("Escribe cuánto dice tu banco que debes hoy. Kiri tiene {0}.", [formatAmount(debt.saldoRestante)])}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <MoneyInput value={valor} onChange={setValor} className="h-12 text-xl font-bold rounded-xl" placeholder={String(Math.round(debt.saldoRestante))} autoFocus />
          {banco != null && Math.abs(diferencia) >= 1 && (
            <div className="rounded-2xl bg-muted/30 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-xs">
                {diferencia > 0
                  ? tr("Debes {0} más de lo que Kiri tenía.", [formatAmount(diferencia)])
                  : tr("Debes {0} menos: Kiri corrige el saldo.", [formatAmount(-diferencia)])}
              </p>
              {diferencia > 0 && esLinea && (
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: "interes" as const, t: tr("Intereses y cargos"), d: tr("Cuota de manejo, seguros…") },
                    { v: "compras" as const, t: tr("Compras que no registré"), d: tr("Se agregan como gasto") },
                  ]).map(o => (
                    <button key={o.v} type="button" onClick={() => setMotivo(o.v)}
                      className={cn("rounded-xl border px-3 py-2 text-left transition-colors", motivo === o.v ? "border-kiri-emerald bg-kiri-emerald/10" : "border-border hover:bg-muted/40")}>
                      <span className="block text-[11px] font-bold">{o.t}</span>
                      <span className="block text-[9px] text-muted-foreground">{o.d}</span>
                    </button>
                  ))}
                </div>
              )}
              {grande && motivo === "interes" && esLinea && (
                <p className="text-[10px] text-amber-600 font-medium">{tr("Es bastante para ser solo intereses: ¿no habrá compras que no registraste?")}</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>{tr("Cancelar")}</Button>
          <Button onClick={guardar} disabled={banco == null || saving} className="bg-kiri-emerald text-white font-bold rounded-xl">
            {saving ? tr("Guardando...") : tr("Actualizar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── SaldoRealBanco — "¿en cuánto quedó según el banco?" ─────────────────────
// El interés que cobra el banco casi nunca calza exacto con la tasa registrada
// (días del mes, seguros, redondeos). Si el usuario escribe el saldo que le
// muestra el banco, ese manda: lo que bajó es capital y el resto fue interés.
function SaldoRealBanco({ debt, monto, value, onChange, formatAmount }: {
  debt: Debt; monto: number; value: string; onChange: (v: string) => void; formatAmount: (n: number) => string
}) {
  const tasaMensual = debt.tasaInteres ?? 0
  const tasaPeriodo = debt.frecuenciaPago === "quincenal" ? tasaMensual / 2 : tasaMensual
  // Estimación de Kiri: el interés del periodo solo lo cubre el primer pago.
  const interesEstimado = (debt.montoPagadoEstePeriodo ?? 0) > 0 ? 0 : Math.round(debt.saldoRestante * tasaPeriodo / 100)
  const estimado = Math.max(0, debt.saldoRestante - Math.max(0, monto - Math.min(monto, interesEstimado)))
  const real = value ? Number(value) : null
  const interesReal = real !== null ? Math.max(0, monto - (debt.saldoRestante - real)) : null
  return (
    <div className="rounded-2xl border border-border bg-muted/10 p-3 space-y-1.5">
      <Label className="text-xs font-bold">{tr("¿En cuánto quedó tu saldo según el banco?")}{" "}<span className="font-normal text-muted-foreground">{tr("(opcional)")}</span></Label>
      <MoneyInput value={value} onChange={onChange} className="h-11 text-lg font-bold rounded-xl" placeholder={String(Math.round(estimado))} />
      <p className="text-[10px] text-muted-foreground">
        {tasaMensual > 0
          ? <>{tr("Con la tasa registrada ({0}% mensual) Kiri estima que queda en", [tasaMensual])}{" "}<strong>{formatAmount(estimado)}</strong>{tr(". Si tu banco muestra otro saldo, escríbelo y calculamos el interés real.")}</>
          : <>{tr("Kiri estima que queda en")}{" "}<strong>{formatAmount(estimado)}</strong>{tr(". Si tu banco muestra otro saldo (por intereses o seguros), escríbelo.")}</>}
      </p>
      {interesReal !== null && (
        <p className="text-[10px] font-bold text-amber-600">{tr("Interés real de este pago: {0} · a capital: {1}", [formatAmount(interesReal), formatAmount(Math.max(0, debt.saldoRestante - real!))])}</p>
      )}
    </div>
  )
}

// ─── CuotaCompletaCheck — "con este valor quedó pagada la cuota" ─────────────
function CuotaCompletaCheck({ checked, onChange, falta, formatAmount }: {
  checked: boolean; onChange: (v: boolean) => void; falta: number; formatAmount: (n: number) => string
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn("w-full flex items-start gap-2.5 text-left p-3 rounded-xl border-2 transition-colors",
        checked ? "border-kiri-emerald bg-kiri-emerald/5" : "border-muted hover:border-kiri-emerald/30")}>
      <span className={cn("mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
        checked ? "bg-kiri-emerald border-kiri-emerald" : "border-muted-foreground/40")}>
        {checked && <span className="text-white text-[9px] font-bold">✓</span>}
      </span>
      <span className="text-[11px]">
        <strong>{tr("Con este valor quedó pagada la cuota")}</strong>
        <span className="block text-muted-foreground">{tr("La cuota llegó más baja: no quedarán {0} pendientes este periodo.", [formatAmount(falta)])}</span>
      </span>
    </button>
  )
}

// ─── AtrasosBanner — cuotas de periodos ya cerrados sin cubrir ─────────────────
// Antes desaparecían solas al cambiar de periodo (deudas y gastos fijos) y
// solo quedaban, en el caso de una deuda, reflejadas en el saldo.
function AtrasosBanner({ atrasos, montoAtrasado, formatAmount, onPagar, onMarcar }: {
  atrasos?: CuotaAtrasada[]; montoAtrasado?: number; formatAmount: (n: number) => string
  onPagar: (a: CuotaAtrasada) => void; onMarcar: (a: CuotaAtrasada) => void
}) {
  if (!atrasos || atrasos.length === 0) return null
  return (
    <div className="rounded-xl border border-red-400/30 bg-red-500/5 p-3 space-y-2">
      <p className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" />
        {atrasos.length === 1 ? "1 cuota atrasada" : `${atrasos.length} cuotas atrasadas`} · {formatAmount(montoAtrasado ?? 0)}
      </p>
      {atrasos.map(a => (
        <div key={a.periodo} className="flex items-center gap-2">
          <span className="text-[10px] flex-1 min-w-0 truncate first-letter:uppercase">
            {formatPeriodo(a.periodo)} · <strong>{formatAmount(a.falta)}</strong>{a.pagado > 0 && <span className="text-muted-foreground">{" "}{tr("(abonaste")}{" "}{formatAmount(a.pagado)})</span>}
          </span>
          <button onClick={() => onMarcar(a)} className="text-[9px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/40 shrink-0">{tr("Ya la pagué")}</button>
          <button onClick={() => onPagar(a)} className="text-[9px] font-bold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg shrink-0">{tr("Pagar")}</button>
        </div>
      ))}
    </div>
  )
}

// ─── AdelantoInfo — lo ya adelantado a la próxima cuota ────────────────────────
function AdelantoInfo({ monto, cubierta, periodo, formatAmount, onUndo }: {
  monto?: number | null; cubierta?: boolean; periodo?: string
  formatAmount: (n: number) => string; onUndo: () => void
}) {
  if (!monto) return null
  return (
    <div className="flex items-center justify-between text-[10px] bg-kiri-emerald/5 rounded-lg px-2.5 py-1.5">
      <span className="text-kiri-emerald font-bold">
        {cubierta ? tr("✓ Próxima cuota adelantada") : tr("Adelantado a la próxima cuota")}: {formatAmount(monto)}
        {periodo && <span className="font-normal text-muted-foreground"> · {formatPeriodo(periodo)}</span>}
      </span>
      <button onClick={onUndo} className="text-muted-foreground hover:text-foreground font-bold">{tr("Deshacer")}</button>
    </div>
  )
}

// ─── FixedCard ─────────────────────────────────────────────────────────────────
function FixedCard({ item, tarjetaNombre, formatAmount, onEdit, onDelete, onTogglePaid, onUndoPay, onAbonar, onAdelantar, onUndoAdelanto, onPagarAtraso, onMarcarAtraso, hidden, onToggleHidden, isPeriodPriority, onToggleAutoPay }: {
  item: FixedExpense; tarjetaNombre?: string; formatAmount: (n: number) => string
  onEdit: () => void; onDelete: () => void; onTogglePaid: () => void; onUndoPay: () => void; onAbonar: () => void
  onAdelantar: () => void; onUndoAdelanto: () => void
  onPagarAtraso: (a: CuotaAtrasada) => void; onMarcarAtraso: (a: CuotaAtrasada) => void
  hidden: boolean; onToggleHidden: () => void; isPeriodPriority?: boolean
  onToggleAutoPay?: () => void
}) {
  const payInfo = getNextPaymentInfo(item.fechaCorte, item.pagadoEstePeriodo, item.frecuencia === 'quincenal', item.pendienteProximoPeriodo)
  const montoPagado = item.montoPagadoEstePeriodo ?? 0
  const isPartiallyPaid = montoPagado > 0 && !item.pagadoEstePeriodo
  // Quincenal: la cuota del periodo es la mitad del monto (antes "Falta" usaba el monto completo).
  const montoPeriodo = item.frecuencia === 'quincenal' ? Math.round(item.monto / 2) : item.monto
  const remaining = Math.max(0, montoPeriodo - montoPagado)
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
              {/* En el celular el nombre quedaba en "Netf…" (competía con la
                  etiqueta y 4 botones): ahora usa hasta 2 líneas y la etiqueta
                  baja si no cabe */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-bold text-sm leading-tight line-clamp-2 break-words min-w-0">{hidden ? "••••••" : item.nombre}</h3>
                {isPartiallyPaid ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{tr("Pago parcial")}</span>
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
                  {payInfo.status === 'pagado' ? tr("Próximo: {0}", [payInfo.nextDate]) : payInfo.nextDate}
                  {" · "}{item.frecuencia === 'quincenal' ? tr("Quincenal") : tr("Mensual")}
                  {item.pagoAutomatico && (
                    <span className="ml-1.5 text-amber-500">{tr("⚡ Auto{0}", [tarjetaNombre ? tr(" con TC") : ""])}</span>
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
                  ? tr("Pago automático con {0}. Toca para cambiarlo.", [tarjetaNombre])
                  : tr("Pago automático con tu disponible. Toca para cambiarlo.")
                : tr("Configurar pago automático")
            }
              className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                item.pagoAutomatico ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10")}>
              <span className="text-[10px]">⚡</span>
            </button>
            )}
            <button onClick={onToggleHidden} aria-label={hidden ? tr("Mostrar") : tr("Ocultar")} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors">
              {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onEdit} aria-label={tr("Editar")} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-cyclon-lavender hover:bg-cyclon-lavender/10 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} aria-label={tr("Eliminar")} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
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
              <p className="text-[9px] text-muted-foreground mt-0.5">{tr("Cuota: {0}", [formatAmount(item.monto)])}</p>
            )}
            {isPartiallyPaid && (
              <p className="text-[10px] text-amber-500 font-bold mt-0.5">{tr("Pagado: {0} · Falta: {1}", [formatAmount(montoPagado), formatAmount(remaining)])}</p>
            )}
          </div>
        ) : (
          <p className="text-xl font-black text-muted-foreground">••••••</p>
        )}

        {!hidden && <AtrasosBanner atrasos={item.atrasos} montoAtrasado={item.montoAtrasado} formatAmount={formatAmount} onPagar={onPagarAtraso} onMarcar={onMarcarAtraso} />}

        {/* Botones de acción */}
        {item.pagadoEstePeriodo ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button onClick={onUndoPay} size="sm" variant="ghost" className="flex-1 rounded-xl h-9 text-xs text-muted-foreground">{tr("Deshacer pago")}</Button>
              <Button onClick={onAbonar} size="sm" className="flex-1 bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">{tr("Abonar")}</Button>
              {!item.proximaCuotaCubierta && (
                <Button onClick={onAdelantar} size="sm" className="flex-1 bg-kiri-emerald/10 text-kiri-emerald hover:bg-kiri-emerald/20 border-none rounded-xl h-9 font-bold text-xs">{tr("Adelantar")}</Button>
              )}
            </div>
            <AdelantoInfo monto={item.montoAdelantado} cubierta={item.proximaCuotaCubierta} periodo={item.periodoSiguiente} formatAmount={formatAmount} onUndo={onUndoAdelanto} />
          </div>
        ) : isPartiallyPaid ? (
          <div className="flex gap-2">
            <Button onClick={onUndoPay} size="sm" variant="ghost" className="flex-1 rounded-xl h-9 text-xs text-muted-foreground">{tr("Deshacer pago")}</Button>
            <Button onClick={onTogglePaid} size="sm" className="flex-1 bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">{tr("Pagar restante")}</Button>
          </div>
        ) : (
          <Button onClick={onTogglePaid} size="sm" className="w-full bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 border-none rounded-xl h-9 font-bold text-xs">{tr("Registrar pago de cuota")}</Button>
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
  dueQuestion = null,
}: {
  form: DebtForm
  onChange: (f: DebtForm) => void
  isEdit?: boolean
  /** Calculada por el padre (ver editDebtDueQ): con los datos editados la cuota de este periodo quedaría vencida. */
  dueQuestion?: DueQuestionKind | null
}) {
  const set = (patch: Partial<DebtForm>) => onChange({ ...form, ...patch })
  const { formatAmount } = useAppContext()
  const esLineaForm = !!form.tipoDeuda && form.tipoDeuda !== "PRESTAMO"

  if (esLineaForm) {
    const cupo = Number(form.cupoTotal) || 0
    const ocupado = Number(form.saldoRestante) || 0
    const uso = cupo > 0 ? Math.round((ocupado / cupo) * 100) : 0
    return (
      <div className="space-y-4">
        <TipoDeudaSelector value={form.tipoDeuda!} onChange={t => set({ tipoDeuda: t })} />
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">{tr("Nombre")}</Label>
          <Input value={form.nombre} onChange={e => set({ nombre: e.target.value })} className="h-11 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Cupo total")}</Label>
            <MoneyInput value={form.cupoTotal ?? ""} onChange={v => set({ cupoTotal: v })} className="h-11 rounded-xl" placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Ocupado hoy")}</Label>
            <MoneyInput value={form.saldoRestante} onChange={v => set({ saldoRestante: v })} className="h-11 rounded-xl" placeholder="0" />
          </div>
        </div>
        {cupo > 0 && (
          <div className="rounded-xl bg-muted/30 p-2.5 space-y-1.5">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500", uso >= 100 ? "bg-red-500" : uso >= 80 ? "bg-amber-500" : "bg-kiri-emerald")} style={{ width: `${Math.min(100, uso)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{tr("Disponible {0} · usas el {1}%", [formatAmount(cupo - ocupado), uso])}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Pago mensual")}</Label>
            <MoneyInput value={form.cuotaPeriodo} onChange={v => set({ cuotaPeriodo: v })} className="h-11 rounded-xl" placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Tasa mensual (%)")}</Label>
            <Input inputMode="decimal" value={form.tasaInteres ?? ""} onChange={e => set({ tasaInteres: e.target.value.replace(/[^\d.,]/g, "") })} className="h-11 rounded-xl" placeholder={tr("Opcional")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">{tr("Recordarme pagar el día")}</Label>
          <Input type="number" min={1} max={31} value={form.diasPago} onChange={e => set({ diasPago: e.target.value })} className="h-11 rounded-xl w-28 text-center font-bold" placeholder={tr("Fin de mes")} />
          <p className="text-[9px] text-muted-foreground">{tr("Opcional. Vacío = fin de mes.")}</p>
        </div>
        {dueQuestion && (
          <DueQuestion kind={dueQuestion} isEdit={isEdit} yaPago={!!form.yaPagoEstePeriodo} nueva={!!form.nuevaProximoPeriodo}
            onChange={v => set({ yaPagoEstePeriodo: v.yaPago, nuevaProximoPeriodo: v.nueva })} />
        )}
        <BudgetCategorySelector value={form.budgetCategoryId} onChange={v => set({ budgetCategoryId: v })} />
      </div>
    )
  }

  // Cálculo reactivo: cuotas restantes
  const cuotasEstimadas = (() => {
    const total = Number(form.montoTotal)
    const cuota = Number(form.cuotaPeriodo)
    if (!total || !cuota || cuota <= 0) return null
    return Math.ceil(total / cuota)
  })()

  return (
    <div className="space-y-4">
      {isEdit && form.tipoDeuda && <TipoDeudaSelector value={form.tipoDeuda} onChange={t => set({ tipoDeuda: t })} />}
      {/* Nombre de la deuda — este campo es `nombre`, no `acreedor` (esta
          pantalla no expone ese campo por separado); estaba mal etiquetado
          como "Acreedor", lo que hacía parecer que el nombre real de la
          deuda no se podía editar desde acá. */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{tr("Nombre de la deuda")}</Label>
        <Input placeholder={tr("Ej: Banco Falabella")} value={form.nombre} onChange={e => set({ nombre: e.target.value })} className="h-11 rounded-xl" />
      </div>

      {/* Monto total de la deuda */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{tr("Monto total de la deuda")}</Label>
        <MoneyInput value={form.montoTotal} onChange={v => set({ montoTotal: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
      </div>

      {/* Saldo restante (lo que debes hoy) */}
      {isEdit && (
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">{tr("Saldo restante")}{" "}<span className="font-normal text-muted-foreground">{tr("(lo que debes hoy)")}</span></Label>
          <MoneyInput value={form.saldoRestante} onChange={v => set({ saldoRestante: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
          <p className="text-[8px] text-muted-foreground">{tr("Este valor baja con cada pago que registres.")}</p>
        </div>
      )}

      {/* Cuota por periodo + tasa */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">{tr("Cuota por periodo")}</Label>
          <MoneyInput value={form.cuotaPeriodo} onChange={v => set({ cuotaPeriodo: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
        </div>
        {isEdit && (
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">{tr("Tasa mensual (%)")}</Label>
            <Input inputMode="decimal" value={form.tasaInteres ?? ""} onChange={e => set({ tasaInteres: e.target.value.replace(/[^\d.,]/g, "") })} className="h-12 rounded-xl" placeholder={tr("Opcional")} />
          </div>
        )}
      </div>

      {/* Frecuencia de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{tr("Frecuencia de pago")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["mensual", "quincenal"] as const).map(f => (
            <button key={f} type="button" onClick={() => {
              // Al cambiar de frecuencia, precargar un día por defecto — si no,
              // el campo queda vacío detrás de un placeholder que parece valor
              // real ("15"), y "Guardar" no hacía nada sin avisar.
              if (f === "quincenal" && !form.diasPago.includes(',')) set({ frecuencia: f, diasPago: "15,30" })
              else if (f === "mensual") set({ frecuencia: f, diasPago: form.diasPago.split(',')[0] || "1" })
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
          {form.frecuencia === "quincenal" ? tr("Días de pago (quincenal)") : tr("Día de pago")}
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
          <Input type="number" min={1} max={31} placeholder={tr("Ej: 15")}
            value={form.diasPago}
            onChange={e => set({ diasPago: e.target.value })}
            className="h-11 rounded-xl w-24 text-center font-bold text-lg" />
        )}
        <p className="text-[9px] text-muted-foreground">
          {form.frecuencia === "quincenal" ? tr("Ej: 1 y 15 ó 15 y 30") : tr("Día del mes en que se paga")}
        </p>
      </div>

      {dueQuestion && (
        <DueQuestion
          kind={dueQuestion}
          isEdit={isEdit}
          yaPago={!!form.yaPagoEstePeriodo}
          nueva={!!form.nuevaProximoPeriodo}
          onChange={v => set({ yaPagoEstePeriodo: v.yaPago, nuevaProximoPeriodo: v.nueva })}
        />
      )}

      <BudgetCategorySelector value={form.budgetCategoryId} onChange={v => set({ budgetCategoryId: v })} />

      {/* Cálculo reactivo */}
      {cuotasEstimadas && cuotasEstimadas > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-3 flex items-center gap-3">
          <span className="text-lg">✅</span>
          <div>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{tr("Pagarás esta deuda en aproximadamente {0} cuotas", [cuotasEstimadas])}</p>
            <p className="text-[10px] text-muted-foreground">{tr("Cálculo: {0} / {1} = {2}", [form.montoTotal ? formatAmount(Number(form.montoTotal)) : '?', form.cuotaPeriodo ? formatAmount(Number(form.cuotaPeriodo)) : '?', cuotasEstimadas])}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TipoDeudaSelector — reclasificar una deuda al editarla ──────────────────
function TipoDeudaSelector({ value, onChange }: { value: Debt["tipoDeuda"]; onChange: (t: Debt["tipoDeuda"]) => void }) {
  const opciones: { v: Debt["tipoDeuda"]; t: string; icon: React.ReactNode }[] = [
    { v: "TARJETA_CREDITO", t: tr("Tarjeta"), icon: <CreditCard className="h-3.5 w-3.5" /> },
    { v: "CREDITO_COMPRAS", t: tr("Crédito de compras"), icon: <span className="text-[11px]">🛍️</span> },
    { v: "PRESTAMO", t: tr("Préstamo"), icon: <span className="text-[11px]">🏦</span> },
  ]
  return (
    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/40">
      {opciones.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={cn("h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all",
            value === o.v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
          {o.icon}{o.t}
        </button>
      ))}
    </div>
  )
}

// ─── FixedFormFields — formulario de gasto fijo ─────────────────────────────
function FixedFormFields({
  form,
  onChange,
  dueQuestion = null,
  isEdit = false,
}: {
  form: FixedForm
  onChange: (f: FixedForm) => void
  /** Calculada por el padre: al crear, si el día ya pasó este periodo; al
   * editar, si con los datos editados la cuota quedaría vencida. */
  dueQuestion?: DueQuestionKind | null
  isEdit?: boolean
}) {
  const set = (patch: Partial<FixedForm>) => onChange({ ...form, ...patch })

  return (
    <div className="space-y-4">
      {/* Nombre */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{tr("Nombre")}</Label>
        <Input placeholder={tr("Ej: Netflix, Arriendo, Luz")} value={form.nombre} onChange={e => set({ nombre: e.target.value })} className="h-11 rounded-xl" />
      </div>

      {/* Monto */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{tr("Monto")}</Label>
        <MoneyInput value={form.monto} onChange={v => set({ monto: v })} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
      </div>

      {/* Frecuencia de pago */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold">{tr("Frecuencia de pago")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["mensual", "quincenal"] as const).map(f => (
            <button key={f} type="button" onClick={() => {
              // Al cambiar de frecuencia, precargar un día por defecto — si no,
              // el campo queda vacío detrás de un placeholder que parece valor
              // real ("15"), y "Guardar" no hacía nada sin avisar.
              if (f === "quincenal" && !form.diasPago.includes(',')) set({ frecuencia: f, diasPago: "15,30" })
              else if (f === "mensual") set({ frecuencia: f, diasPago: form.diasPago.split(',')[0] || "1" })
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
          {form.frecuencia === "quincenal" ? tr("Días de pago (quincenal)") : tr("Día de pago")}
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
          <Input type="number" min={1} max={31} placeholder={tr("Ej: 15")}
            value={form.diasPago}
            onChange={e => set({ diasPago: e.target.value })}
            className="h-11 rounded-xl w-24 text-center font-bold text-lg" />
        )}
        <p className="text-[9px] text-muted-foreground">
          {form.frecuencia === "quincenal" ? tr("Ej: 1 y 15 ó 15 y 30") : tr("Día del mes en que se cobra")}
        </p>
      </div>

      {dueQuestion && (
        <DueQuestion
          kind={dueQuestion}
          isEdit={isEdit}
          yaPago={!!form.yaPagoEstePeriodo}
          nueva={!!form.nuevaProximoPeriodo}
          onChange={v => set({ yaPagoEstePeriodo: v.yaPago, nuevaProximoPeriodo: v.nueva })}
        />
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
