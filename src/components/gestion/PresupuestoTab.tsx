"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Plus, Pencil, ArrowLeft,
  Utensils, Car, Gamepad2, Dumbbell, Heart, ShoppingBag, Wifi, GraduationCap, MoreHorizontal,
  PawPrint, Home, Baby, Plane, Gift, Wrench,
  Lightbulb, MapPin, Receipt, AlertTriangle, PiggyBank, CircleDollarSign, Trash2, Coffee,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { OdometerAmount } from "@/components/ui/odometer-amount"
import { useAppContext } from "@/lib/app-context"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { useFinanceData } from "@/hooks/use-finance-data"
import { userApi, WalletState, budgetCategoriesApi } from "@/lib/api-client"
import { analyzeBudgetCategories, BudgetInsight, getCategoryInsight } from "@/lib/budget-insights"
import { detectBudgetCategory } from "@/hooks/use-budget-categories"
import { getPeriodDateRange, getPeriodLabel } from "@/lib/period-filter"
import { SUGGESTIONS } from "@/lib/budget-category-spend"
import { ImpulseCategory } from "@/lib/types"
import Link from "next/link"
import { TopConsumosSection } from "./TopConsumosSection"
import { DesgloseGastosSection } from "./DesgloseGastosSection"
import { BudgetRadialChart, CategoryDetail } from "@/components/presupuesto/BudgetRadialChart"

// --- Types ---
interface BudgetCategory { id: string; name: string; budget: number; spent: number; color: string; icon: string; linkedFixedIds?: string[] }

// --- Icons (todos Lucide, sin emojis) ---
const ICONS = [
  { key: "utensils", el: <Utensils className="h-5 w-5" /> },
  { key: "car", el: <Car className="h-5 w-5" /> },
  { key: "gamepad", el: <Gamepad2 className="h-5 w-5" /> },
  { key: "dumbbell", el: <Dumbbell className="h-5 w-5" /> },
  { key: "heart", el: <Heart className="h-5 w-5" /> },
  { key: "shopping", el: <ShoppingBag className="h-5 w-5" /> },
  { key: "wifi", el: <Wifi className="h-5 w-5" /> },
  { key: "education", el: <GraduationCap className="h-5 w-5" /> },
  { key: "paw", el: <PawPrint className="h-5 w-5" /> },
  { key: "home", el: <Home className="h-5 w-5" /> },
  { key: "baby", el: <Baby className="h-5 w-5" /> },
  { key: "plane", el: <Plane className="h-5 w-5" /> },
  { key: "gift", el: <Gift className="h-5 w-5" /> },
  { key: "tools", el: <Wrench className="h-5 w-5" /> },
  { key: "more", el: <MoreHorizontal className="h-5 w-5" /> },
]
const COLORS = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6", "#e11d48"]
function getIcon(key: string) { return ICONS.find(i => i.key === key)?.el || <MoreHorizontal className="h-5 w-5" /> }

function suggestIcon(n: string): string {
  const l = n.toLowerCase()
  for (const s of SUGGESTIONS) { if (s.keys.some(k => l.includes(k)) || l.includes(s.name.toLowerCase())) return s.icon }
  return "more"
}
function filterSuggestions(input: string) {
  if (!input) return SUGGESTIONS
  const l = input.toLowerCase()
  return SUGGESTIONS.filter(s => s.name.toLowerCase().includes(l) || s.keys.some(k => k.includes(l)))
}

// Mapeo entre la forma del backend (nombre/icono/montoLimite/linkedFixedExpenseIds)
// y la forma local que ya usaba este archivo (name/icon/budget/linkedFixedIds) —
// se mantiene la forma local para no reescribir todo el componente de una vez.
function fromApi(c: { id: string; nombre: string; icono: string; color: string; montoLimite: number; linkedFixedExpenseIds: string[] }): BudgetCategory {
  return { id: c.id, name: c.nombre, budget: c.montoLimite, spent: 0, icon: c.icono, color: c.color, linkedFixedIds: c.linkedFixedExpenseIds }
}

// Mapear categoría de presupuesto a ImpulseCategory del backend
function mapToImpulseCategory(budgetCatName: string): ImpulseCategory {
  const lower = budgetCatName.toLowerCase()
  if (lower.includes("alimenta") || lower.includes("comida") || lower.includes("restaur")) return "comida"
  if (lower.includes("transport") || lower.includes("vehic")) return "transporte"
  if (lower.includes("ocio") || lower.includes("salida") || lower.includes("fiesta")) return "salida"
  if (lower.includes("cafe") || lower.includes("café")) return "cafe"
  if (lower.includes("antojo") || lower.includes("compra") || lower.includes("ropa")) return "antojo"
  return "otro"
}

// --- Component ---
export function PresupuestoTab() {
  const { formatAmount, incomeFrequency, diasCobro } = useAppContext()
  const { allocation } = usePeriodBudget()
  const { impulseExpenses, addImpulseExpense, impulseThisPeriod, totalImpulseThisPeriod, removeImpulseExpense, fixedExpenses, debts } = useFinanceData()

  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  const [walletError, setWalletError] = useState(false)
  useEffect(() => {
    userApi.getWallet()
      .then(({ data, error }) => { if (data) setWallet(data.wallet); if (error) setWalletError(true) })
      .catch(() => setWalletError(true))
  }, [])

  // El gasto libre real es libre + endeudamiento (todo lo que el usuario puede gastar)
  const realFreeAmount = wallet.libre + wallet.endeudamiento

  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const fetchCategories = async () => {
    const { data } = await budgetCategoriesApi.list()
    if (data) setCategories(data.categories.map(fromApi))
    setCategoriesLoading(false)
  }
  useEffect(() => { fetchCategories() }, [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedDetailRef = useRef<HTMLDivElement>(null)
  // Al elegir una categoría (o "ver todas") en el diagrama, el detalle aparece
  // más abajo en la página — sin esto, en pantallas chicas quedaba fuera de
  // vista y parecía que no había pasado nada al tocar.
  useEffect(() => {
    if (!selectedId) return
    const t = setTimeout(() => {
      selectedDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
    return () => clearTimeout(t)
  }, [selectedId])
  const [radialView, setRadialView] = useState<null | 'all' | 'category'>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showSugg, setShowSugg] = useState(false)
  const [form, setForm] = useState({ name: "", budget: "", icon: "more", color: COLORS[0] })
  const [linkedFixed, setLinkedFixed] = useState<string[]>([])

  // Gasto por categoría se reinicia cada periodo (mensual/quincenal, según
  // incomeFrequency — el mismo que ya se elige en Billetera). El límite de la
  // categoría (budget) NO se reinicia, solo lo gastado: se filtran los gastos
  // hormiga por fecha dentro del periodo actual antes de sumarlos.
  const periodRange = getPeriodDateRange(incomeFrequency, diasCobro)
  const impulseThisBudgetPeriod = impulseExpenses.filter(e => {
    const created = new Date(e.createdAt)
    return created >= periodRange.start && created < periodRange.end
  })

  // Conectar gastos a categorias: impulseExpenses por keyword/tag + gastos fijos vinculados pagados
  const catsWithSpent = categories.map(cat => {
    const sug = SUGGESTIONS.find(s => s.name.toLowerCase() === cat.name.toLowerCase())
    const keys = [...(sug?.keys ?? []), cat.name.toLowerCase()]
    const tagPattern = `[${cat.name.toLowerCase()}]`

    // Gastos hormiga/impulse del periodo actual que coincidan por keyword o tag
    const matchedImpulse = impulseThisBudgetPeriod.filter(e => {
      const expName = e.nombre.toLowerCase()
      return expName.startsWith(tagPattern) || keys.some(k => expName.includes(k)) || expName.includes(cat.name.toLowerCase())
    })

    // Gastos fijos vinculados desde ESTA categoría (legacy) que ya fueron pagados
    // este periodo — si el gasto YA tiene su propia categoría asignada
    // (budgetCategoryId) y no es esta misma, esa es la fuente de verdad; contarlo
    // también acá lo duplicaría en dos categorías a la vez (mismo fix que en
    // computeCategorySpend, para datos guardados antes de que el formulario
    // bloqueara vincular por ambos mecanismos al mismo tiempo).
    const legacyIds = new Set(cat.linkedFixedIds ?? [])
    const linkedFixedPaid = [...legacyIds]
      .map(id => fixedExpenses.find(f => f.id === id))
      .filter((f): f is NonNullable<typeof f> => !!f && f.pagadoEstePeriodo && (!f.budgetCategoryId || f.budgetCategoryId === cat.id))

    // Deudas y gastos fijos vinculados desde SU PROPIO formulario de creación/
    // edición (budgetCategoryId) — cuentan el pago real de este periodo, no el
    // monto configurado, y no duplican lo que ya viene por el mecanismo legacy.
    const linkedByOwnCategory = [
      ...fixedExpenses.filter(f => f.budgetCategoryId === cat.id && !legacyIds.has(f.id)),
      ...debts.filter(d => d.budgetCategoryId === cat.id),
    ]

    const spentFromImpulse = matchedImpulse.reduce((a, e) => a + e.monto, 0)
    const spentFromFixed = linkedFixedPaid.reduce((a, f) => a + f.monto, 0)
    const spentFromOwnCategory = linkedByOwnCategory.reduce((a, x) => a + (x.montoPagadoEstePeriodo ?? 0), 0)

    // Desglose para mostrarle al usuario "en qué se fue" el total — antes solo
    // incluía los gastos hormiga (matchedImpulse); un gasto fijo o deuda
    // vinculado a la categoría SÍ sumaba al total de arriba pero desaparecía
    // del desglose, así que el usuario veía "$3.797.000 gastados" con una
    // lista que solo sumaba $20.000 — sin forma de ver a dónde se fue el resto.
    const breakdownItems: { nombre: string; monto: number }[] = [
      ...matchedImpulse.map(e => ({ nombre: e.nombre, monto: e.monto })),
      ...linkedFixedPaid.map(f => ({ nombre: f.nombre, monto: f.monto })),
      ...linkedByOwnCategory.map(x => ({ nombre: x.nombre, monto: x.montoPagadoEstePeriodo ?? 0 })),
    ]

    return {
      ...cat,
      spent: spentFromImpulse + spentFromFixed + spentFromOwnCategory,
      expenses: matchedImpulse,
      linkedFixedPaid,
      breakdownItems,
    }
  })

  const totalBudget = catsWithSpent.reduce((a, c) => a + c.budget, 0)
  const totalSpent = catsWithSpent.reduce((a, c) => a + c.spent, 0)
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  const selectedCat = catsWithSpent.find(c => c.id === selectedId) ?? null
  const circ = 2 * Math.PI * 42

  // ═══ INSIGHTS: Analizar gastos y generar recomendaciones ═══
  const [insightsModalOpen, setInsightsModalOpen] = useState(false)

  const { insights } = useMemo(() => {
    if (categories.length === 0) return { insights: [], analyses: [] }
    return analyzeBudgetCategories(categories, impulseExpenses, incomeFrequency, realFreeAmount, diasCobro)
  }, [categories, impulseExpenses, incomeFrequency, realFreeAmount, diasCobro])

  // Insight principal: el más relevante para mostrar como banner único
  const primaryInsight = insights.length > 0 ? insights[0] : null

  // ═══ GASTOS HORMIGA — Panel colapsable ═══
  const [showHormiga, setShowHormiga] = useState(false)

  const IMPULSE_CATEGORIES: { value: ImpulseCategory; label: string; emoji: string }[] = [
    { value: "cafe",       label: "Café",       emoji: "☕" },
    { value: "comida",     label: "Comida",     emoji: "🍔" },
    { value: "transporte", label: "Transporte", emoji: "🚕" },
    { value: "antojo",     label: "Antojo",     emoji: "🍫" },
    { value: "salida",     label: "Salida",     emoji: "🎉" },
    { value: "otro",       label: "Otro",       emoji: "💸" },
  ]

  // Estadísticas de gastos hormiga — solo los marcados con 🐜
  const hormigaExpenses = impulseExpenses.filter(e => e.nombre.startsWith('🐜'))
  // Solo los pagados en efectivo consumen el "disponible libre" — los pagados
  // con tarjeta no tocan cashBalance/walletLibre al registrarse (ver
  // addImpulseExpense en use-finance-data.tsx), así que sumarlos acá inflaba
  // el % de uso y las proyecciones de ahorro sin que hubiera salido plata real
  // del bolsillo libre. Mismo bug que totalImpulseThisPeriod, repetido acá con
  // su propia suma — el historial sigue mostrando todos los registros, solo el
  // total que se compara contra `realFreeAmount` excluye los de tarjeta.
  const totalHormiga = hormigaExpenses.reduce((a, e) => a + (e.tarjetaId ? 0 : e.monto), 0)
  const hormigaUsagePct = realFreeAmount > 0
    ? Math.min(100, Math.round((totalHormiga / realFreeAmount) * 100))
    : 0
  const hormigaRemaining = Math.max(0, realFreeAmount - totalImpulseThisPeriod)
  const hormigaIsOver = totalHormiga > realFreeAmount * 0.5

  const [savingCategory, setSavingCategory] = useState(false)
  const openAdd = () => { setEditingId(null); setForm({ name: "", budget: "", icon: "more", color: COLORS[categories.length % COLORS.length] }); setLinkedFixed([]); setShowSugg(false); setFormOpen(true) }
  const openEdit = (cat: BudgetCategory) => { setEditingId(cat.id); setForm({ name: cat.name, budget: String(cat.budget), icon: cat.icon, color: cat.color }); setLinkedFixed(cat.linkedFixedIds ?? []); setFormOpen(true) }
  const handleSave = async () => {
    if (!form.name || !form.budget) return
    setSavingCategory(true)
    const payload = { nombre: form.name, montoLimite: Number(form.budget), icono: form.icon, color: form.color, linkedFixedExpenseIds: linkedFixed }
    if (editingId) await budgetCategoriesApi.update(editingId, payload)
    else await budgetCategoriesApi.create(payload)
    await fetchCategories()
    setSavingCategory(false)
    setFormOpen(false)
  }
  const handleDelete = async () => {
    if (!editingId) return
    setSavingCategory(true)
    await budgetCategoriesApi.delete(editingId)
    await fetchCategories()
    setSavingCategory(false)
    setFormOpen(false)
    setSelectedId(null)
  }
  const handleDeleteCategory = async (id: string) => {
    await budgetCategoriesApi.delete(id)
    await fetchCategories()
  }

  // ═══ REGISTRAR GASTO — modal con categorías del presupuesto ═══
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expNombre, setExpNombre] = useState("")
  const [expMonto, setExpMonto] = useState("")
  const [expCategoria, setExpCategoria] = useState<string>("")
  const [expSaving, setExpSaving] = useState(false)
  const [autoDetected, setAutoDetected] = useState<string | null>(null)
  const [isDetectedHormiga, setIsDetectedHormiga] = useState(false)
  const [detectedImpulseCategory, setDetectedImpulseCategory] = useState<ImpulseCategory | null>(null)

  // Keywords que indican gastos hormiga (pequeños, cotidianos, impulsivos)
  const HORMIGA_KEYWORDS: { keys: string[]; category: ImpulseCategory }[] = [
    { keys: ["café", "cafe", "starbucks", "tinto", "capuchino", "latte", "espresso", "juan valdez"], category: "cafe" },
    { keys: ["almuerzo", "cena", "desayuno", "hamburguesa", "pizza", "empanada", "arepa", "sandwich", "sushi", "comida rapida", "domicilio", "rappi", "ifood", "uber eats", "snack", "helado", "postre"], category: "comida" },
    { keys: ["uber", "taxi", "didi", "bus", "metro", "transmilenio", "pasaje", "parqueadero", "peaje"], category: "transporte" },
    { keys: ["dulce", "chocolate", "galleta", "chicle", "golosina", "antojo", "maquina", "vending", "tienda", "papas", "gaseosa", "jugo"], category: "antojo" },
    { keys: ["bar", "cerveza", "trago", "rumba", "fiesta", "discoteca", "cine", "boliche", "karaoke", "concierto", "cover", "entrada", "boleta"], category: "salida" },
    { keys: ["propina", "limosna", "parquimetro", "fotocopia", "impresion", "recarga", "minutos"], category: "otro" },
  ]

  function detectIfHormiga(text: string): { isHormiga: boolean; category: ImpulseCategory | null } {
    const lower = text.toLowerCase().trim()
    if (!lower) return { isHormiga: false, category: null }
    for (const group of HORMIGA_KEYWORDS) {
      if (group.keys.some(k => lower.includes(k))) {
        return { isHormiga: true, category: group.category }
      }
    }
    return { isHormiga: false, category: null }
  }

  // Auto-detectar categoría cuando cambia la descripción
  const handleExpNombreChange = (value: string) => {
    setExpNombre(value)

    // 1. Detectar si podría ser gasto hormiga (SOLO sugerencia, no activar automáticamente)
    const hormigaResult = detectIfHormiga(value)
    setDetectedImpulseCategory(hormigaResult.category)
    // NO activar isDetectedHormiga automáticamente — el usuario decide

    // 2. Detectar categoría del presupuesto
    const detected = detectBudgetCategory(value, categories)
    setAutoDetected(detected)
    if (detected && !expCategoria) {
      setExpCategoria(detected)
    }
  }

  const openExpenseModal = (preselectedCategory?: string) => {
    setExpNombre("")
    setExpMonto("")
    setExpCategoria(preselectedCategory ?? "")
    setAutoDetected(null)
    setIsDetectedHormiga(false)
    setDetectedImpulseCategory(null)
    setExpenseModalOpen(true)
  }

  const handleRegisterExpense = async () => {
    if (!expNombre || !expMonto || Number(expMonto) <= 0) return
    const monto = Number(expMonto)

    // Determinar la categoría del presupuesto (puede ser vacía si el usuario no selecciona)
    const budgetCat = expCategoria && expCategoria !== "__hormiga__" ? expCategoria : ""

    // Verificar disponibilidad contra el presupuesto de la categoría
    const generalAvailable = Math.max(0, realFreeAmount - totalSpent)

    if (budgetCat) {
      const cat = catsWithSpent.find(c => c.name === budgetCat)
      if (cat && cat.budget > 0) {
        const catAvailable = cat.budget - cat.spent
        if (monto > catAvailable || monto > generalAvailable) {
          setExpenseModalOpen(false)
          setInsufficientExpOpen(true)
          return
        }
      }
    } else {
      if (generalAvailable > 0 && monto > generalAvailable) {
        setExpenseModalOpen(false)
        setInsufficientExpOpen(true)
        return
      }
    }

    // Registrar el gasto como impulseExpense (una única transacción)
    // El nombre se tagea con la categoría para la vinculación
    // Si es gasto hormiga, se marca con 🐜 para identificarlo
    setExpSaving(true)
    const impulseCategory = detectedImpulseCategory ?? mapToImpulseCategory(budgetCat || expNombre)
    let nombreFinal = expNombre
    if (budgetCat) nombreFinal = `[${budgetCat}] ${expNombre}`
    if (isDetectedHormiga) nombreFinal = `🐜 ${nombreFinal}`

    await addImpulseExpense({ nombre: nombreFinal, monto, categoria: impulseCategory })
    setExpSaving(false)
    setExpenseModalOpen(false)
    setExpNombre("")
    setExpMonto("")
    setExpCategoria("")
    setIsDetectedHormiga(false)
    setDetectedImpulseCategory(null)
  }

  // Modal de insuficiencia para presupuesto
  const [insufficientExpOpen, setInsufficientExpOpen] = useState(false)

  const handleExpForceRegister = async () => {
    if (!expNombre || !expMonto) return
    setExpSaving(true)
    const impulseCategory = mapToImpulseCategory(expCategoria)
    const nombreConTag = expCategoria ? `[${expCategoria}] ${expNombre}` : expNombre
    await addImpulseExpense({ nombre: nombreConTag, monto: Number(expMonto), categoria: impulseCategory })
    setExpSaving(false)
    setInsufficientExpOpen(false)
    setExpNombre("")
    setExpMonto("")
    setExpCategoria("")
  }

  const handleExpCancel = () => {
    setInsufficientExpOpen(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black">Presupuestos y hábitos de gasto</h1>
          <p className="text-[10px] text-muted-foreground">Controla tus límites, entiende tus hábitos y encuentra oportunidades para ahorrar.</p>
          <p className="text-[9px] font-bold text-kiri-emerald mt-0.5">
            {getPeriodLabel(incomeFrequency, diasCobro)} · el gasto por categoría se reinicia cada periodo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openAdd} size="sm" className="bg-kiri-emerald text-white font-bold rounded-xl text-xs gap-1">
            <Plus className="h-3.5 w-3.5" /> Agregar categoría
          </Button>
        </div>
      </div>

      {walletError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-[11px] font-medium rounded-xl px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          No pudimos cargar tu billetera — los montos de abajo pueden no ser exactos.
        </div>
      )}

      {/* 4 metricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AnimatedStatCard label="Disponible para gastar" value={realFreeAmount} sub="Tu bolsillo de gasto libre" formatAmount={formatAmount} />
        <MC label="Total presupuestado" value={formatAmount(totalBudget)} sub="Límites asignados a categorías" />
        <MC label="Total gastado" value={formatAmount(totalSpent)} sub={`${totalPct}% del presupuestado`} color={totalSpent > totalBudget ? "text-red-500" : "text-amber-500"} />
        <MC label="Disponible restante" value={formatAmount(Math.max(0, realFreeAmount - totalSpent))} sub={`${realFreeAmount > 0 ? Math.round((Math.max(0, realFreeAmount - totalSpent) / realFreeAmount) * 100) : 0}% sin gastar`} />
      </div>

      {/* ═══ DISTRIBUCIÓN ACTUAL (ancho completo) + DETALLE DEBAJO ═══ */}
      <BudgetRadialChart
        categories={catsWithSpent.map(c => ({
          id: c.id, name: c.name, spent: c.spent, limit: c.budget,
          color: c.color, icon: c.icon,
          items: (c.expenses ?? []).reduce((acc: { emoji: string; name: string; amount: number }[], e: any) => {
            const cleanName = e.nombre.replace(/^\[.*?\]\s*/, '').replace(/^🐜\s*/, '')
            const existing = acc.find(a => a.name === cleanName)
            if (existing) existing.amount += e.monto
            else acc.push({ emoji: '', name: cleanName, amount: e.monto })
            return acc
          }, []).sort((a: any, b: any) => b.amount - a.amount),
        }))}
        onEdit={(catId) => { const cat = catsWithSpent.find(c => c.id === catId); if (cat) openEdit(cat) }}
        incomeFrequency={incomeFrequency}
        onSelectionChange={(sel) => {
          if (!sel) setSelectedId(null)
          else if (sel.type === 'category') setSelectedId(catsWithSpent[sel.index]?.id ?? null)
          else if (sel.type === 'all') setSelectedId('__all__')
        }}
      />

      {/* Lista de categorías — aparece al clic en centro */}
      {selectedId === '__all__' && catsWithSpent.length > 0 && (
        <Card ref={selectedDetailRef} className="border-none bg-card shadow-sm rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-bold">Tus categorías</h3>
            <p className="text-[9px] text-muted-foreground">Edita los límites máximos de gasto por categoría.</p>
            <div className="space-y-3">
              {catsWithSpent.map(cat => {
                const pct = cat.budget > 0 ? Math.round((cat.spent / cat.budget) * 100) : 0
                const over = cat.spent > cat.budget
                return (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: cat.color }}>
                        <span className="scale-[0.6]">{getIcon(cat.icon)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{cat.name}</p>
                        <p className="text-[9px] text-muted-foreground">{totalBudget > 0 ? Math.round((cat.budget / totalBudget) * 100) : 0}% del total</p>
                      </div>
                      <span className="text-xs font-bold shrink-0">{formatAmount(cat.budget)}</span>
                      <span className={cn("text-xs font-bold shrink-0", over && "text-red-500")}>{formatAmount(cat.spent)}</span>
                      <button onClick={() => openEdit(cat)} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors shrink-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pl-12">
                      <div className="flex-1 h-2 rounded-full bg-muted/20 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: over ? "#ef4444" : cat.color }} />
                      </div>
                      <span className={cn("text-[10px] font-bold w-[35px] text-right", over ? "text-red-500" : "text-muted-foreground")}>{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {catsWithSpent.length > 0 && (
              <div className="flex justify-between pt-3 border-t border-border text-[10px]">
                <span>Total asignado <strong>{formatAmount(totalBudget)}</strong></span>
                <span>Total gastado <strong>{formatAmount(totalSpent)}</strong></span>
                <span className="font-bold">{totalPct}%</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detalle de categoría seleccionada — debajo de la gráfica */}
      {selectedId && selectedId !== '__all__' && (() => {
        const cat = catsWithSpent.find(c => c.id === selectedId)
        if (!cat) return null
        const ratio = cat.budget > 0 ? cat.spent / cat.budget : 0
        return (
          <Card ref={selectedDetailRef} className="border-none bg-card shadow-sm rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            <CardContent className="p-5">
              <CategoryDetail
                cat={{ ...cat, limit: cat.budget, ratio, items: (cat.breakdownItems ?? []).reduce((acc: { emoji: string; name: string; amount: number }[], e: any) => {
                  const cleanName = e.nombre.replace(/^\[.*?\]\s*/, '').replace(/^🐜\s*/, '')
                  const existing = acc.find(a => a.name === cleanName)
                  if (existing) existing.amount += e.monto
                  else acc.push({ emoji: '', name: cleanName, amount: e.monto })
                  return acc
                }, []).sort((a: any, b: any) => b.amount - a.amount) }}
                onEdit={() => openEdit(cat)}
                frequency={incomeFrequency}
              />
            </CardContent>
          </Card>
        )
      })()}

      {/* ═══ BOTÓN GASTOS HORMIGA (debajo de categorías) ═══ */}
      {!selectedCat && (
        <>
          <button
            onClick={() => setShowHormiga(v => !v)}
            className={cn(
              "w-full rounded-2xl border-2 transition-all text-left",
              showHormiga
                ? "border-cyclon-pink bg-cyclon-pink/5"
                : hormigaIsOver
                  ? "border-red-400/50 bg-red-500/5"
                  : "border-muted hover:border-cyclon-pink/40"
            )}
          >
            {/* Fila principal */}
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
              <div className={cn(
                "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0",
                hormigaIsOver ? "bg-red-500/10 text-red-500" : "bg-cyclon-pink/10 text-cyclon-pink"
              )}>
                <Coffee className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">🐜 Gastos Hormiga</p>
                <p className="text-[10px] text-muted-foreground">Pequeños gastos que pueden afectar tus metas sin que lo notes.</p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn("text-sm font-black", hormigaIsOver ? "text-red-500" : "")}>{hormigaUsagePct}%</p>
                <p className="text-[9px] text-muted-foreground">del libre</p>
              </div>
            </div>
            {/* Barra de progreso integrada */}
            {realFreeAmount > 0 && (
              <div className="px-4 pb-3.5 space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className={hormigaIsOver ? "text-red-500" : "text-muted-foreground"}>
                    Hormiga: {formatAmount(totalHormiga)} ({hormigaExpenses.length} gastos)
                  </span>
                  <span className="text-muted-foreground">Total gastado: {formatAmount(totalImpulseThisPeriod)}</span>
                </div>
                <Progress
                  value={hormigaUsagePct}
                  className="h-1.5"
                  indicatorClassName={cn(
                    hormigaUsagePct >= 50 ? "bg-red-500" : hormigaUsagePct >= 30 ? "bg-yellow-500" : "bg-cyclon-pink"
                  )}
                />
                <p className="text-[8px] text-muted-foreground text-right">
                  de {formatAmount(realFreeAmount)} disponible
                </p>
              </div>
            )}
          </button>

          {/* Historial Gastos Hormiga (colapsable) — SOLO los marcados como hormiga */}
          {showHormiga && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Gastos hormiga — {hormigaExpenses.length > 0 ? `${hormigaExpenses.length} registros este periodo` : "Sin registros"}
              </p>
              {hormigaExpenses.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <div className="h-12 w-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
                    <span className="text-2xl">🎉</span>
                  </div>
                  <p className="text-sm font-bold text-emerald-500">¡No tienes gastos hormiga!</p>
                  <p className="text-xs text-muted-foreground">Excelente. Kiri no ha encontrado pequeños gastos marcados como hábito.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {hormigaExpenses.map(item => {
                    const cat = IMPULSE_CATEGORIES.find(c => c.value === item.categoria)
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
                          onClick={(e) => { e.stopPropagation(); removeImpulseExpense(item.id) }}
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
          )}
        </>
      )}

      {/* ═══ SIMULADOR DE REDUCCIÓN + IMPACTO + META ═══ */}
      {!selectedCat && totalHormiga > 0 && (
        <HormigaSimulator
          totalHormiga={totalHormiga}
          hormigaCount={hormigaExpenses.length}
          realFreeAmount={realFreeAmount}
          incomeFrequency={incomeFrequency}
          formatAmount={formatAmount}
        />
      )}

      {/* ═══ BANNER CONSEJO KIRI — Un solo mensaje clickeable ═══ */}
      {!selectedCat && primaryInsight && (
        <button
          onClick={() => setInsightsModalOpen(true)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors text-left",
            primaryInsight.severity === 'critical' && "bg-red-500/5 border-red-500/20 hover:bg-red-500/10",
            primaryInsight.severity === 'warning' && "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10",
            primaryInsight.severity === 'success' && "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10",
            primaryInsight.severity === 'info' && "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10",
          )}
        >
          <div className={cn(
            "shrink-0",
            primaryInsight.severity === 'critical' && "text-red-500",
            primaryInsight.severity === 'warning' && "text-amber-500",
            primaryInsight.severity === 'success' && "text-emerald-500",
            primaryInsight.severity === 'info' && "text-emerald-500",
          )}>
            <MapPin className="h-4 w-4" />
          </div>
          <p className="text-[11px] text-muted-foreground flex-1">
            <span className="font-bold text-foreground">Consejo Kiri: </span>
            {primaryInsight.message}
          </p>
          {insights.length > 1 && (
            <span className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full shrink-0">
              +{insights.length - 1}
            </span>
          )}
        </button>
      )}

      {/* ═══ TOP MAYORES CONSUMOS — Vista General ═══ */}
      {!selectedCat && catsWithSpent.length > 0 && <TopConsumosSection />}

      {/* ═══ MODAL DETALLE DE RECOMENDACIONES ═══ */}
      <Dialog open={insightsModalOpen} onOpenChange={setInsightsModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-kiri-emerald" />
              Análisis de tu presupuesto
            </DialogTitle>
            <DialogDescription>Recomendaciones basadas en tus patrones de gasto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {insights.map((insight) => (
              <InsightRow key={insight.id} insight={insight} formatAmount={formatAmount} />
            ))}
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No hay recomendaciones por ahora. ¡Todo va bien!</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* --- MODAL CREAR/EDITAR --- */}
      <Dialog open={formOpen} onOpenChange={v => { setFormOpen(v); if (!v) setShowSugg(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar categoria" : "Crear nueva categoria"}</DialogTitle>
            <DialogDescription>Agrega una categoria personalizada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nombre de la categoria</Label>
              <div className="relative">
                <Input value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value, icon: suggestIcon(e.target.value) })); setShowSugg(true) }}
                  onClick={() => { if (form.name.length === 0) setShowSugg(true) }}
                  onBlur={() => { setTimeout(() => setShowSugg(false), 150) }}
                  placeholder="Ej: Alimentacion, Mascotas, Transporte..." className="h-10 rounded-xl" autoFocus />
                {showSugg && form.name.length < 20 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-50 max-h-[160px] overflow-y-auto">
                    {filterSuggestions(form.name).slice(0, 6).map(sug => (
                      <button key={sug.name} type="button"
                        onClick={() => { setForm(f => ({ ...f, name: sug.name, icon: sug.icon, color: sug.color })); setShowSugg(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left">
                        <div className="h-6 w-6 rounded-md flex items-center justify-center text-white" style={{ backgroundColor: sug.color }}>
                          <span className="scale-[0.5]">{getIcon(sug.icon)}</span>
                        </div>
                        <span className="text-xs">{sug.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Icono</Label>
              <div className="grid grid-cols-5 gap-2">
                {ICONS.map(opt => (
                  <button key={opt.key} type="button" onClick={() => setForm(f => ({ ...f, icon: opt.key }))}
                    className={cn("h-10 rounded-xl flex items-center justify-center transition-colors",
                      form.icon === opt.key ? "bg-kiri-emerald text-white" : "bg-muted/30 text-muted-foreground hover:bg-muted")}>
                    {opt.el}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Presupuesto mensual</Label>
              <MoneyInput value={form.budget} onChange={v => setForm(f => ({ ...f, budget: v }))} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
              {/* Sugerencia inteligente de Kiri */}
              {realFreeAmount > 0 && !editingId && (
                <div className="bg-kiri-emerald/5 border border-kiri-emerald/20 rounded-xl p-3 space-y-1.5">
                  <p className="text-[9px] font-bold text-kiri-emerald flex items-center gap-1">
                    🌱 Sugerencia de Kiri
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    Tu disponible para gastar es <strong className="text-foreground">{formatAmount(realFreeAmount)}</strong>.
                    {categories.length === 0
                      ? ` Si creas 4 categorías, podrías asignar ~${formatAmount(Math.round(realFreeAmount / 4))} a cada una.`
                      : ` Ya tienes ${categories.length} categoría${categories.length > 1 ? 's' : ''} con ${formatAmount(totalBudget)} asignados. Te quedan ~${formatAmount(Math.max(0, realFreeAmount - totalBudget))} disponibles para nuevas categorías.`
                    }
                  </p>
                  {!form.budget && (
                    <div className="flex gap-2 pt-1">
                      {[
                        Math.round((realFreeAmount - totalBudget) * 0.5),
                        Math.round((realFreeAmount - totalBudget) * 0.3),
                        Math.round((realFreeAmount - totalBudget) * 0.2),
                      ].filter(v => v > 0).map((suggested, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, budget: String(suggested) }))}
                          className="text-[9px] font-bold px-2 py-1 rounded-lg bg-kiri-emerald/10 text-kiri-emerald hover:bg-kiri-emerald/20 transition-colors"
                        >
                          {formatAmount(suggested)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={cn("h-7 w-7 rounded-full transition-all", form.color === c ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-105")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            {/* Vincular gastos fijos relacionados */}
            {fixedExpenses.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Vincular gastos fijos (opcional)</Label>
                <p className="text-[9px] text-muted-foreground">Al pagar estos gastos fijos, se contarán como gasto de esta categoría.</p>
                <div className="max-h-[120px] overflow-y-auto space-y-1.5 rounded-xl border border-muted p-2">
                  {fixedExpenses
                    .filter(f => {
                      // Sugerir los que coinciden con el nombre de la categoría
                      if (!form.name) return true
                      const lower = form.name.toLowerCase()
                      const sug = SUGGESTIONS.find(s => s.name.toLowerCase() === lower)
                      const keys = [...(sug?.keys ?? []), lower]
                      return keys.some(k => f.nombre.toLowerCase().includes(k)) || f.nombre.toLowerCase().includes(lower) || true
                    })
                    .map(f => {
                      const isLinked = linkedFixed.includes(f.id)
                      // Ya vinculado a OTRA categoría — por el mecanismo viejo
                      // (linkedFixedIds) o por el nuevo (el propio budgetCategoryId
                      // del gasto fijo). Antes solo se revisaba el mecanismo viejo,
                      // así que un gasto con su propia categoría asignada se podía
                      // volver a marcar acá y terminaba contando el pago DOS VECES
                      // — una vez en cada categoría — inflando el total general.
                      const linkedElsewhere = categories.find(c => c.id !== editingId && c.linkedFixedIds?.includes(f.id))
                        ?? (f.budgetCategoryId && f.budgetCategoryId !== editingId ? categories.find(c => c.id === f.budgetCategoryId) : undefined)
                      return (
                        <button
                          key={f.id}
                          type="button"
                          disabled={!!linkedElsewhere}
                          onClick={() => {
                            if (isLinked) setLinkedFixed(prev => prev.filter(id => id !== f.id))
                            else setLinkedFixed(prev => [...prev, f.id])
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors",
                            isLinked ? "bg-kiri-emerald/10 border border-kiri-emerald/30" : "hover:bg-muted/30",
                            linkedElsewhere && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
                            isLinked ? "bg-kiri-emerald border-kiri-emerald" : "border-muted-foreground/30"
                          )}>
                            {isLinked && <span className="text-white text-[8px]">✓</span>}
                          </div>
                          <span className="text-[10px] font-medium truncate flex-1">{f.nombre}</span>
                          <span className="text-[9px] text-muted-foreground shrink-0">{formatAmount(f.monto)}</span>
                          {linkedElsewhere && <span className="text-[8px] text-muted-foreground">({linkedElsewhere.name})</span>}
                        </button>
                      )
                    })}
                </div>
                {linkedFixed.length > 0 && (
                  <p className="text-[9px] text-kiri-emerald font-bold">{linkedFixed.length} gasto{linkedFixed.length > 1 ? 's' : ''} fijo{linkedFixed.length > 1 ? 's' : ''} vinculado{linkedFixed.length > 1 ? 's' : ''}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editingId && <Button variant="destructive" size="sm" onClick={handleDelete} disabled={savingCategory} className="mr-auto rounded-xl text-xs">Eliminar</Button>}
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={savingCategory}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.budget || savingCategory} className="bg-kiri-emerald text-white font-bold rounded-xl px-6">
              {savingCategory ? "Guardando..." : editingId ? "Guardar" : "+ Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL REGISTRAR GASTO --- */}
      <Dialog open={expenseModalOpen} onOpenChange={v => { if (!v) { setExpenseModalOpen(false); setExpNombre(""); setExpMonto(""); setExpCategoria(""); setAutoDetected(null); setIsDetectedHormiga(false); setDetectedImpulseCategory(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-kiri-emerald" />
              Registrar gasto
            </DialogTitle>
            <DialogDescription>El gasto se registrará en la categoría seleccionada y descontará de tu presupuesto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción</Label>
              <Input
                placeholder="Ej: Mercado semanal, Uber al trabajo, Netflix..."
                value={expNombre}
                onChange={e => handleExpNombreChange(e.target.value)}
                className="h-10 rounded-xl"
                autoFocus
              />
              {/* Detección inteligente de categoría */}
              {autoDetected && expCategoria === autoDetected && (
                <p className="text-[9px] text-kiri-emerald flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Categoría sugerida: {autoDetected}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto</Label>
              <MoneyInput
                value={expMonto}
                onChange={v => setExpMonto(v)}
                className="h-12 text-lg font-bold rounded-xl"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Categoría</Label>
              {/* Categorías del presupuesto */}
              {categories.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setExpCategoria(cat.name); }}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-colors",
                        expCategoria === cat.name
                          ? "border-kiri-emerald bg-kiri-emerald/5"
                          : "border-muted text-muted-foreground hover:border-kiri-emerald/30"
                      )}
                    >
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}>
                        <span className="scale-[0.55]">{getIcon(cat.icon)}</span>
                      </div>
                      <span className="text-[9px] font-bold truncate max-w-full">{cat.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-xl text-center">
                  Crea categorías con &ldquo;Agregar&rdquo; para organizar tu presupuesto.
                </p>
              )}
            </div>

            {/* ═══ CLASIFICACIÓN: ¿Es gasto hormiga? ═══ */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-3 rounded-xl border border-muted bg-muted/10">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-cyclon-pink" />
                  <div>
                    <p className="text-xs font-bold">🐜 Marcar como gasto hormiga</p>
                    <p className="text-[9px] text-muted-foreground">Pequeño gasto cotidiano o impulsivo</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetectedHormiga(!isDetectedHormiga)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    isDetectedHormiga ? "bg-cyclon-pink" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                    isDetectedHormiga && "translate-x-5"
                  )} />
                </button>
              </div>
              {isDetectedHormiga && (
                <p className="text-[9px] text-cyclon-pink flex items-center gap-1 px-1">
                  <Coffee className="h-3 w-3" /> Kiri analizará este gasto como hábito de consumo.
                </p>
              )}
              {!isDetectedHormiga && detectedImpulseCategory && (
                <p className="text-[9px] text-amber-500 flex items-center gap-1 px-1">
                  💡 Kiri detectó que este podría ser un gasto hormiga. ¿Quieres marcarlo?
                </p>
              )}
            </div>

            {/* Warning si se va a exceder el presupuesto de la categoría seleccionada */}
            {expCategoria && expCategoria !== "__hormiga__" && Number(expMonto) > 0 && (() => {
              const cat = catsWithSpent.find(c => c.name === expCategoria)
              if (!cat) return null
              const newTotal = cat.spent + Number(expMonto)
              if (newTotal > cat.budget * 0.8) {
                const isOver = newTotal > cat.budget
                return (
                  <div className={cn(
                    "flex items-start gap-2 p-2.5 rounded-xl text-xs",
                    isOver ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-600"
                  )}>
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      {isOver
                        ? `Este gasto excederá tu presupuesto de ${expCategoria} (${formatAmount(cat.budget)}).`
                        : `Estarás al ${Math.round((newTotal / cat.budget) * 100)}% de tu presupuesto de ${expCategoria}.`}
                    </span>
                  </div>
                )
              }
              return null
            })()}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setExpenseModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleRegisterExpense}
              disabled={expSaving || !expNombre || !expMonto || Number(expMonto) <= 0}
              className="bg-kiri-emerald text-white font-bold rounded-xl px-6"
            >
              {expSaving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL PRESUPUESTO INSUFICIENTE --- */}
      <Dialog open={insufficientExpOpen} onOpenChange={v => !v && handleExpCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" /> Presupuesto insuficiente
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const generalAvail = Math.max(0, realFreeAmount - totalSpent)
                if (expCategoria) {
                  const cat = catsWithSpent.find(c => c.name === expCategoria)
                  const catAvail = Math.max(0, (cat?.budget ?? 0) - (cat?.spent ?? 0))
                  const effectiveAvail = Math.min(catAvail, generalAvail)
                  return `Tu disponible en ${expCategoria} es ${formatAmount(effectiveAvail)}, pero necesitas ${formatAmount(Number(expMonto))}.`
                }
                return `Tu disponible restante es ${formatAmount(generalAvail)}, pero necesitas ${formatAmount(Number(expMonto))}.`
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Card className="border-none bg-red-500/5 rounded-2xl">
              <CardContent className="p-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Disponible en {expCategoria || "gasto libre"}</p>
                <p className="text-lg font-black">{(() => {
                  const generalAvail = Math.max(0, realFreeAmount - totalSpent)
                  if (expCategoria) {
                    const cat = catsWithSpent.find(c => c.name === expCategoria)
                    const catAvail = Math.max(0, (cat?.budget ?? 0) - (cat?.spent ?? 0))
                    return formatAmount(Math.min(catAvail, generalAvail))
                  }
                  return formatAmount(generalAvail)
                })()}</p>
                <p className="text-xs text-red-500 font-bold">
                  Necesitas: {formatAmount(Number(expMonto))}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-2 pt-2">
            {/* Opción 1: Registrar de todas formas (exceder) */}
            {wallet.cashBalance > 0 && (
              <button
                onClick={handleExpForceRegister}
                className="w-full text-left p-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 hover:border-amber-500 transition-colors space-y-0.5"
              >
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-amber-500" />
                  <p className="font-bold text-sm">Usar más del presupuesto asignado</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Registrar de todas formas. Excederás tu presupuesto.
                </p>
              </button>
            )}

            {/* Opción 2: Usar ahorro */}
            {wallet.ahorro > 0 && (
              <button
                onClick={handleExpForceRegister}
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500 transition-colors space-y-0.5"
              >
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-emerald-500" />
                  <p className="font-bold text-sm">Usar ahorro</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Cubrir con tu ahorro disponible ({formatAmount(wallet.ahorro)}).
                </p>
              </button>
            )}

            {/* Opción 3: Registrar como nueva deuda */}
            <Link href="/obligaciones">
              <button className="w-full text-left p-4 rounded-2xl border-2 border-cyclon-lavender/40 bg-cyclon-lavender/5 hover:border-cyclon-lavender transition-colors space-y-0.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-cyclon-lavender" />
                  <p className="font-bold text-sm">Registrar como nueva deuda</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Si pediste prestado para cubrir este gasto, agrégalo como obligación.
                </p>
              </button>
            </Link>

            {/* Cancelar */}
            <Button variant="ghost" onClick={handleExpCancel} className="w-full text-muted-foreground mt-1">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

function MC({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-3">
        <p className="text-[8px] text-muted-foreground font-bold uppercase">{label}</p>
        <p className={cn("text-sm font-black mt-0.5", color)}>{value}</p>
        <p className="text-[8px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ─── AnimatedStatCard — como MC, pero con el efecto de "Sueldo Real" (tween +
// delta flotante + mini sparkline). Usa el token de marca `kiri-emerald` (ya
// usado sin variante dark: en el resto de este archivo) en vez de blanco fijo,
// porque a diferencia de la tarjeta de Sueldo Real (siempre verde oscuro), esta
// vive sobre `bg-card`, que cambia entre claro y oscuro. ──────────────────────

function AnimatedStatCard({ label, value, sub, formatAmount }: {
  label: string; value: number; sub: string; formatAmount: (n: number) => string
}) {
  const prevRef = useRef(value)
  const idRef = useRef(0)
  const [flash, setFlash] = useState<"up" | "down" | null>(null)
  const [delta, setDelta] = useState<{ amount: number; id: number } | null>(null)
  const [history, setHistory] = useState<number[]>([value])
  // El presupuesto disponible arranca en 0 mientras carga y recién después
  // salta al valor real — sin este guard, ESE salto disparaba el globito de
  // diferencia y el brillo cada vez que se entraba o refrescaba la página,
  // como si fuera un movimiento real. Se absorbe en silencio el primero.
  const skipNextRef = useRef(true)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    if (from === to) return
    prevRef.current = to

    if (skipNextRef.current) {
      skipNextRef.current = false
      setHistory([to])
      return
    }

    setHistory(h => [...h.slice(-9), to])
    setFlash(to > from ? "up" : "down")

    const deltaId = idRef.current++
    setDelta({ amount: to - from, id: deltaId })
    setTimeout(() => setDelta(d => (d?.id === deltaId ? null : d)), 1400)
    setTimeout(() => setFlash(null), 1400)
  }, [value])

  const W = 64, H = 14
  const vals = history.length > 1 ? history : [value, value]
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 3) - 1.5
    return `${x},${y}`
  }).join(" ")

  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-3">
        <p className="text-[8px] text-muted-foreground font-bold uppercase">{label}</p>
        <div className="relative inline-block">
          <OdometerAmount
            value={value}
            formatAmount={formatAmount}
            className={cn(
              "text-sm font-black mt-0.5 transition-colors duration-500",
              flash === "up" && "text-emerald-600 dark:text-emerald-400",
              flash === "down" && "text-red-600 dark:text-red-400",
              !flash && "text-kiri-emerald"
            )}
          />
          {delta && (
            <span
              key={delta.id}
              className={cn(
                "absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold rounded-full px-1.5 py-0.5 pointer-events-none",
                delta.amount > 0
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/15 text-red-600 dark:text-red-400"
              )}
              style={{ animation: "kiriFloatUp 1.4s ease-out forwards" }}
            >
              {delta.amount > 0 ? "+" : ""}{formatAmount(delta.amount)}
            </span>
          )}
        </div>
        <p className="text-[8px] text-muted-foreground">{sub}</p>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-1 text-kiri-emerald opacity-60">
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </CardContent>
    </Card>
  )
}

// ─── InsightRow — Fila de recomendación en el modal (semáforo) ─────────────────

function InsightRow({ insight, formatAmount }: { insight: BudgetInsight; formatAmount: (n: number) => string }) {
  // Colores semáforo: verde = bueno, amarillo = advertencia, rojo = malo
  const severityConfig: Record<string, { dot: string; bg: string; label: string; labelColor: string }> = {
    critical: { dot: "bg-red-500", bg: "bg-red-500/5", label: "Excedido", labelColor: "text-red-500" },
    warning: { dot: "bg-amber-500", bg: "bg-amber-500/5", label: "Atención", labelColor: "text-amber-500" },
    success: { dot: "bg-emerald-500", bg: "bg-emerald-500/5", label: "Bien", labelColor: "text-emerald-500" },
    info: { dot: "bg-emerald-500", bg: "bg-emerald-500/5", label: "Info", labelColor: "text-emerald-500" },
  }

  const s = severityConfig[insight.severity] ?? severityConfig.info

  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-xl", s.bg)}>
      <div className={cn("h-2.5 w-2.5 rounded-full mt-1 shrink-0", s.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold">{insight.title}</p>
          <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-current/10", s.labelColor)}>
            {s.label}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{insight.message}</p>
        {insight.savingsAmount && insight.savingsAmount > 0 && (
          <span className="inline-block mt-1.5 text-[9px] font-bold text-kiri-emerald bg-kiri-emerald/10 px-2 py-0.5 rounded-full">
            Potencial ahorro: {formatAmount(insight.savingsAmount)}
          </span>
        )}
        {insight.usagePct !== undefined && (
          <div className="mt-2">
            <Progress value={Math.min(insight.usagePct, 100)} className="h-1.5" indicatorClassName={
              insight.usagePct > 100 ? "bg-red-500" : insight.usagePct >= 70 ? "bg-amber-500" : "bg-emerald-500"
            } />
            <p className="text-[8px] text-muted-foreground mt-0.5">{insight.usagePct}% del presupuesto usado</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── HormigaSimulator — Simulador de reducción + impacto anual + conexión metas ──

function HormigaSimulator({ totalHormiga, hormigaCount, realFreeAmount, incomeFrequency, formatAmount }: {
  totalHormiga: number
  hormigaCount: number
  realFreeAmount: number
  incomeFrequency: 'mensual' | 'quincenal'
  formatAmount: (n: number) => string
}) {
  const [selectedPct, setSelectedPct] = useState(30)

  // Cálculos dinámicos
  const savingsPerPeriod = Math.round(totalHormiga * (selectedPct / 100))
  const periodsPerYear = incomeFrequency === 'quincenal' ? 24 : 12
  const savingsPerYear = savingsPerPeriod * periodsPerYear
  const hormigaPctOfFree = realFreeAmount > 0 ? Math.round((totalHormiga / realFreeAmount) * 100) : 0

  // Meta de ahorro del usuario (localStorage)
  // Venía de una clave de localStorage ("kiri_saving_pockets") que la página
  // de Ahorro dejó de escribir hace tiempo — para cualquier usuario con
  // bolsillos reales esto siempre quedaba en null y la sugerencia nunca se
  // mostraba. Ahora usa los bolsillos reales del backend.
  const [savingsMeta, setSavingsMeta] = useState<{ nombre: string; meta: number; acumulado: number } | null>(null)
  useEffect(() => {
    import("@/lib/api-client").then(({ savingsPocketsApi }) => {
      savingsPocketsApi.list().then(({ data }) => {
        const pockets = data?.pockets ?? []
        const withMeta = pockets.filter(p => p.meta > 0 && p.montoActual < p.meta)
        if (withMeta.length > 0) setSavingsMeta({ nombre: withMeta[0].nombre, meta: Number(withMeta[0].meta), acumulado: Number(withMeta[0].montoActual) })
      })
    })
  }, [])

  const percentages = [10, 20, 30, 50]

  return (
    <div className="space-y-4">
      {/* Impacto en presupuesto */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h3 className="text-sm font-bold">Impacto de tus gastos hormiga</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/20 rounded-xl p-3 text-center">
              <p className="text-[9px] text-muted-foreground">Total hormiga</p>
              <p className="text-sm font-black">{formatAmount(totalHormiga)}</p>
              <p className="text-[8px] text-muted-foreground">{hormigaCount} gastos</p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3 text-center">
              <p className="text-[9px] text-muted-foreground">% del libre</p>
              <p className="text-sm font-black text-amber-500">{hormigaPctOfFree}%</p>
              <p className="text-[8px] text-muted-foreground">de tu presupuesto</p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3 text-center">
              <p className="text-[9px] text-muted-foreground">Proyección anual</p>
              <p className="text-sm font-black text-red-500">{formatAmount(totalHormiga * periodsPerYear)}</p>
              <p className="text-[8px] text-muted-foreground">si continúas así</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulador de reducción */}
      <Card className="border-none bg-gradient-to-br from-emerald-50/50 to-green-50/30 dark:from-emerald-950/10 dark:to-green-950/5 shadow-sm rounded-2xl border border-emerald-500/10">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🌱</span>
            <div>
              <h3 className="text-sm font-bold">¿Qué pasaría si reduces tus gastos hormiga?</h3>
              <p className="text-[9px] text-muted-foreground">Selecciona un porcentaje de reducción</p>
            </div>
          </div>

          {/* Selector de porcentaje */}
          <div className="grid grid-cols-4 gap-2">
            {percentages.map(pct => (
              <button
                key={pct}
                onClick={() => setSelectedPct(pct)}
                className={cn(
                  "h-10 rounded-xl text-sm font-bold border-2 transition-all",
                  selectedPct === pct
                    ? "bg-kiri-emerald text-white border-kiri-emerald shadow-sm scale-105"
                    : "border-muted text-muted-foreground hover:border-kiri-emerald/40"
                )}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Resultado */}
          <div className="bg-background/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground">Podrías liberar por periodo</p>
                <p className="text-xl font-black text-kiri-emerald">{formatAmount(savingsPerPeriod)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground">Potencial anual</p>
                <p className="text-lg font-black text-emerald-600">{formatAmount(savingsPerYear)}</p>
              </div>
            </div>

            {/* Barra visual de reducción */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>Gasto actual: {formatAmount(totalHormiga)}</span>
                <span>Nuevo: {formatAmount(totalHormiga - savingsPerPeriod)}</span>
              </div>
              <div className="h-3 bg-red-500/20 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-kiri-emerald rounded-full transition-all duration-500"
                  style={{ width: `${100 - selectedPct}%` }}
                />
                <div
                  className="absolute top-0 right-0 h-full bg-emerald-300/40 rounded-r-full transition-all duration-500"
                  style={{ width: `${selectedPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Conexión con meta de ahorro */}
          {savingsMeta ? (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-kiri-emerald/5 border border-kiri-emerald/20">
              <PiggyBank className="h-4 w-4 text-kiri-emerald shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-kiri-emerald">🎯 Tu oportunidad de ahorro</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  Si reduces un {selectedPct}% tus gastos hormiga, podrías destinar {formatAmount(savingsPerPeriod)} por periodo a tu meta &ldquo;{savingsMeta.nombre}&rdquo;.
                </p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[8px]">
                    <span className="text-muted-foreground">Progreso actual: {formatAmount(savingsMeta.acumulado)}</span>
                    <span className="font-bold text-kiri-emerald">{Math.round((savingsMeta.acumulado / savingsMeta.meta) * 100)}%</span>
                  </div>
                  <Progress value={(savingsMeta.acumulado / savingsMeta.meta) * 100} className="h-1.5" indicatorClassName="bg-kiri-emerald" />
                  <p className="text-[8px] text-muted-foreground">Meta: {formatAmount(savingsMeta.meta)}</p>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/ahorro" className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors">
              <PiggyBank className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] font-bold">Convierte este ahorro en una meta</p>
                <p className="text-[9px] text-muted-foreground">Crea una meta de ahorro y descubre qué impacto tendría este dinero.</p>
              </div>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
