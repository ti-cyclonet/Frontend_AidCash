"use client"

import { useState, useEffect, useMemo } from "react"
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
  Lightbulb, MapPin, Receipt, AlertTriangle, PiggyBank, CircleDollarSign,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { useFinanceData } from "@/hooks/use-finance-data"
import { userApi, WalletState } from "@/lib/api-client"
import { analyzeBudgetCategories, BudgetInsight, getCategoryInsight } from "@/lib/budget-insights"
import { detectBudgetCategory } from "@/hooks/use-budget-categories"
import { ImpulseCategory } from "@/lib/types"
import Link from "next/link"

// --- Types ---
interface BudgetCategory { id: string; name: string; budget: number; spent: number; color: string; icon: string }

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

const SUGGESTIONS = [
  { name: "Vivienda", icon: "home", color: "#06b6d4", keys: ["arriendo", "renta", "hipoteca", "administracion", "arreglo casa", "muebles"] },
  { name: "Alimentacion", icon: "utensils", color: "#10b981", keys: ["comida", "mercado", "supermercado", "restaurante", "hamburguesa", "almuerzo", "cena", "cafeteria", "snack", "desayuno", "pizza", "pollo", "arroz"] },
  { name: "Transporte", icon: "car", color: "#3b82f6", keys: ["gasolina", "uber", "taxi", "bus", "peaje", "parqueadero", "metro", "moto", "lavada", "mantenimiento", "aceite", "llanta"] },
  { name: "Servicios", icon: "wifi", color: "#f59e0b", keys: ["internet", "luz", "agua", "gas", "telefono", "celular", "plan datos", "streaming"] },
  { name: "Deudas", icon: "more", color: "#ef4444", keys: ["tarjeta", "credito", "prestamo", "cuota", "banco", "interes"] },
  { name: "Ocio", icon: "gamepad", color: "#a855f7", keys: ["netflix", "spotify", "cine", "juego", "bar", "fiesta", "salida", "discoteca", "cerveza", "trago"] },
  { name: "Salud", icon: "heart", color: "#ec4899", keys: ["medico", "doctor", "farmacia", "odontologo", "hospital", "lentes", "examen", "cirugia"] },
  { name: "Familia", icon: "baby", color: "#14b8a6", keys: ["colegio", "guarderia", "juguete", "mesada", "hijos", "papa", "mama", "regalo familia"] },
  { name: "Educacion", icon: "education", color: "#6366f1", keys: ["universidad", "curso", "libro", "matricula", "capacitacion", "idiomas", "diplomado"] },
  { name: "Ahorro", icon: "gift", color: "#84cc16", keys: ["ahorro", "inversion", "fondo", "meta", "emergencia"] },
  { name: "Mascotas", icon: "paw", color: "#f97316", keys: ["veterinario", "perro", "gato", "mascota", "comida mascota", "peluqueria mascota", "vacuna mascota"] },
  { name: "Compras", icon: "shopping", color: "#e11d48", keys: ["ropa", "zapatos", "accesorios", "electronica", "amazon", "tienda", "online"] },
  { name: "Deporte", icon: "dumbbell", color: "#8b5cf6", keys: ["gym", "gimnasio", "cancha", "yoga", "suplemento", "proteina"] },
  { name: "Viajes", icon: "plane", color: "#0ea5e9", keys: ["vuelo", "hotel", "vacaciones", "paseo", "hospedaje", "maleta"] },
]

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

const LS_KEY = "kiri_budget_categories"
function load(): BudgetCategory[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") } catch { return [] } }
function save(c: BudgetCategory[]) { localStorage.setItem(LS_KEY, JSON.stringify(c)) }

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
  const { formatAmount, incomeFrequency } = useAppContext()
  const { allocation } = usePeriodBudget()
  const { impulseExpenses, addImpulseExpense, totalImpulseThisPeriod } = useFinanceData()

  // Usar el gasto libre REAL de la billetera (mismo calculo que BilleteraTab)
  const fallbackFree = allocation?.dailyFreeAmount ?? 0

  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  useEffect(() => { userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) }) }, [])

  // El gasto libre real se basa en el cashBalance (misma logica que BilleteraTab)
  const realFreeAmount = wallet.cashBalance > 0 ? (() => {
    const oblig = allocation?.obligationsAmount ?? 0
    const rem = Math.max(0, wallet.cashBalance - oblig)
    const remPct = wallet.cashBalance > 0 ? (rem / wallet.cashBalance) * 100 : 0
    const savPct = remPct >= 40 ? 20 : remPct >= 25 ? 15 : remPct >= 15 ? 10 : 5
    const savAmt = Math.min((savPct / 100) * wallet.cashBalance, rem)
    const afterSav = rem - savAmt
    return Math.min(afterSav, (15 / 100) * wallet.cashBalance)
  })() : fallbackFree

  const [categories, setCategories] = useState<BudgetCategory[]>(load)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showSugg, setShowSugg] = useState(false)
  const [form, setForm] = useState({ name: "", budget: "", icon: "more", color: COLORS[0] })

  // Conectar gastos hormiga a categorias (incluye matching por nombre de categoria personalizada)
  const catsWithSpent = categories.map(cat => {
    const sug = SUGGESTIONS.find(s => s.name.toLowerCase() === cat.name.toLowerCase())
    // Keywords: las predefinidas + el nombre de la categoria como keyword adicional
    const keys = [...(sug?.keys ?? []), cat.name.toLowerCase()]
    // Tag pattern: [NombreCategoria] al inicio del nombre del gasto
    const tagPattern = `[${cat.name.toLowerCase()}]`
    // Buscar gastos que coincidan con alguna keyword, nombre de la categoría, o tag
    const matched = impulseExpenses.filter(e => {
      const expName = e.nombre.toLowerCase()
      return expName.startsWith(tagPattern) || keys.some(k => expName.includes(k)) || expName.includes(cat.name.toLowerCase())
    })
    return { ...cat, spent: matched.reduce((a, e) => a + e.monto, 0), expenses: matched }
  })

  const totalBudget = catsWithSpent.reduce((a, c) => a + c.budget, 0)
  const totalSpent = catsWithSpent.reduce((a, c) => a + c.spent, 0)
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  const remaining = Math.max(0, realFreeAmount - totalSpent)
  const selectedCat = catsWithSpent.find(c => c.id === selectedId) ?? null
  const circ = 2 * Math.PI * 42

  // ═══ INSIGHTS: Analizar gastos y generar recomendaciones ═══
  const [insightsModalOpen, setInsightsModalOpen] = useState(false)

  const { insights } = useMemo(() => {
    if (categories.length === 0) return { insights: [], analyses: [] }
    return analyzeBudgetCategories(categories, impulseExpenses, incomeFrequency, realFreeAmount)
  }, [categories, impulseExpenses, incomeFrequency, realFreeAmount])

  // Insight principal: el más relevante para mostrar como banner único
  const primaryInsight = insights.length > 0 ? insights[0] : null

  const persist = (cats: BudgetCategory[]) => { setCategories(cats); save(cats) }
  const openAdd = () => { setEditingId(null); setForm({ name: "", budget: "", icon: "more", color: COLORS[categories.length % COLORS.length] }); setFormOpen(true) }
  const openEdit = (cat: BudgetCategory) => { setEditingId(cat.id); setForm({ name: cat.name, budget: String(cat.budget), icon: cat.icon, color: cat.color }); setFormOpen(true) }
  const handleSave = () => {
    if (!form.name || !form.budget) return
    if (editingId) persist(categories.map(c => c.id === editingId ? { ...c, name: form.name, budget: Number(form.budget), icon: form.icon, color: form.color } : c))
    else persist([...categories, { id: Date.now().toString(), name: form.name, budget: Number(form.budget), spent: 0, icon: form.icon, color: form.color }])
    setFormOpen(false)
  }
  const handleDelete = () => { if (editingId) persist(categories.filter(c => c.id !== editingId)); setFormOpen(false); setSelectedId(null) }

  // ═══ REGISTRAR GASTO — modal con categorías del presupuesto ═══
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expNombre, setExpNombre] = useState("")
  const [expMonto, setExpMonto] = useState("")
  const [expCategoria, setExpCategoria] = useState<string>("")
  const [expSaving, setExpSaving] = useState(false)
  const [autoDetected, setAutoDetected] = useState<string | null>(null)

  // Auto-detectar categoría cuando cambia la descripción
  const handleExpNombreChange = (value: string) => {
    setExpNombre(value)
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
    setExpenseModalOpen(true)
  }

  const handleRegisterExpense = async () => {
    if (!expNombre || !expMonto || Number(expMonto) <= 0) return
    const monto = Number(expMonto)

    // Verificar disponibilidad:
    // 1. Si hay categoría con presupuesto → verificar contra el presupuesto de esa categoría
    // 2. Además, verificar contra el disponible restante general (realFreeAmount - totalSpent)
    const generalAvailable = Math.max(0, realFreeAmount - totalSpent)

    if (expCategoria) {
      const cat = catsWithSpent.find(c => c.name === expCategoria)
      if (cat && cat.budget > 0) {
        const catAvailable = cat.budget - cat.spent
        // Bloquear si excede el presupuesto de la categoría O el disponible real general
        if (monto > catAvailable || monto > generalAvailable) {
          setExpenseModalOpen(false)
          setInsufficientExpOpen(true)
          return
        }
      }
    } else {
      // Sin categoría — verificar contra el disponible restante general
      if (generalAvailable > 0 && monto > generalAvailable) {
        setExpenseModalOpen(false)
        setInsufficientExpOpen(true)
        return
      }
    }

    setExpSaving(true)
    const impulseCategory = mapToImpulseCategory(expCategoria)
    const nombreConTag = expCategoria ? `[${expCategoria}] ${expNombre}` : expNombre
    await addImpulseExpense({ nombre: nombreConTag, monto, categoria: impulseCategory })
    setExpSaving(false)
    setExpenseModalOpen(false)
    setExpNombre("")
    setExpMonto("")
    setExpCategoria("")
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
          <h1 className="text-lg font-black">Presupuesto por Categoria</h1>
          <p className="text-[10px] text-muted-foreground">Asigna y controla tu gasto libre por categoria</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => openExpenseModal()} size="sm" variant="outline" className="font-bold rounded-xl text-xs gap-1 border-kiri-emerald/30 text-kiri-emerald hover:bg-kiri-emerald/5">
            <Receipt className="h-3.5 w-3.5" /> Registrar gasto
          </Button>
          <Button onClick={openAdd} size="sm" className="bg-kiri-emerald text-white font-bold rounded-xl text-xs gap-1">
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
      </div>

      {/* 4 metricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MC label="Disponible para gastar" value={formatAmount(realFreeAmount)} sub="Tu gasto libre del periodo" color="text-kiri-emerald" />
        <MC label="Total presupuestado" value={formatAmount(totalBudget)} sub="Limites asignados (no se descuenta)" />
        <MC label="Total gastado" value={formatAmount(totalSpent)} sub={`${totalPct}% del presupuestado`} color={totalSpent > totalBudget ? "text-red-500" : "text-amber-500"} />
        <MC label="Disponible restante" value={formatAmount(remaining)} sub={`${realFreeAmount > 0 ? Math.round((remaining / realFreeAmount) * 100) : 0}% sin gastar`} />
      </div>

      {/* --- VISTA GENERAL --- */}
      {!selectedCat && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          <Card className="border-none bg-card shadow-sm rounded-2xl">
            <CardContent className="p-5 flex flex-col items-center">
              <h3 className="text-sm font-bold self-start mb-3">Distribucion actual</h3>
              <div className="relative w-[200px] h-[200px]">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-muted/10" strokeWidth="12" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                  {catsWithSpent.map((cat, i) => {
                    const pct = totalBudget > 0 ? cat.budget / totalBudget : 0
                    const offset = catsWithSpent.slice(0, i).reduce((a, c) => a + (totalBudget > 0 ? c.budget / totalBudget : 0), 0)
                    return (
                      <motion.circle key={cat.id} cx="50" cy="50" r="42" fill="none" stroke={cat.color} strokeWidth="12" strokeLinecap="round"
                        strokeDasharray={`${pct * circ * 0.94} ${circ}`} strokeDashoffset={-offset * circ}
                        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
                        className="cursor-pointer hover:opacity-80" onClick={() => setSelectedId(cat.id)}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }} />
                    )
                  })}
                </svg>
                <div className="absolute inset-0 m-auto w-[95px] h-[95px] rounded-full bg-card flex flex-col items-center justify-center">
                  <span className="text-[7px] text-muted-foreground">Total gastado</span>
                  <span className="text-sm font-black">{formatAmount(totalSpent)}</span>
                  <span className="text-[9px] font-bold text-amber-500">{totalPct}%</span>
                  <span className="text-[7px] text-muted-foreground">del presupuestado</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mt-2 text-center">Toca una categoria para ver detalles</p>
            </CardContent>
          </Card>

          {/* Tabla */}
          <Card className="border-none bg-card shadow-sm rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-sm font-bold mb-1">Tus categorias</h3>
              <p className="text-[9px] text-muted-foreground mb-3">Edita los limites maximos de gasto</p>
              <div className="space-y-2">
                {catsWithSpent.map(cat => {
                  const pct = cat.budget > 0 ? Math.round((cat.spent / cat.budget) * 100) : 0
                  const over = cat.spent > cat.budget
                  return (
                    <div key={cat.id} onClick={() => setSelectedId(cat.id)} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted/20 cursor-pointer transition-colors">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: cat.color }}>
                        <span className="scale-[0.6]">{getIcon(cat.icon)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{cat.name}</p>
                        <p className="text-[8px] text-muted-foreground">{totalBudget > 0 ? Math.round((cat.budget / totalBudget) * 100) : 0}% del total</p>
                      </div>
                      <span className="text-[10px] font-bold shrink-0">{formatAmount(cat.budget)}</span>
                      <span className={cn("text-[10px] font-bold shrink-0", over && "text-red-500")}>{formatAmount(cat.spent)}</span>
                      <div className="w-12 shrink-0"><Progress value={Math.min(pct, 100)} className="h-1.5" indicatorClassName={over ? "bg-red-500" : "bg-kiri-emerald"} /></div>
                      <span className={cn("text-[9px] font-bold shrink-0", over ? "text-red-500" : "text-kiri-emerald")}>{over ? "Excedido" : "Dentro"}</span>
                    </div>
                  )
                })}
              </div>
              {catsWithSpent.length > 0 && (
                <div className="flex justify-between mt-3 pt-3 border-t border-border text-[10px]">
                  <span>Total asignado <strong>{formatAmount(totalBudget)}</strong></span>
                  <span>Total gastado <strong>{formatAmount(totalSpent)}</strong></span>
                  <span className="font-bold">{totalPct}%</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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

      {/* --- VISTA DETALLE --- */}
      {selectedCat && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a distribucion
          </button>
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
            {/* Sidebar mini */}
            <div className="space-y-1">
              {catsWithSpent.map(cat => {
                const pct = cat.budget > 0 ? Math.round((cat.spent / cat.budget) * 100) : 0
                return (
                  <button key={cat.id} onClick={() => setSelectedId(cat.id)}
                    className={cn("w-full flex items-center gap-2 p-2 rounded-xl text-left transition-colors", cat.id === selectedId ? "bg-muted/30 ring-1 ring-border" : "hover:bg-muted/10")}>
                    <div className="h-6 w-6 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: cat.color }}>
                      <span className="scale-[0.5]">{getIcon(cat.icon)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold truncate">{cat.name}</p>
                      <p className="text-[8px] text-muted-foreground">{formatAmount(cat.spent)} / {formatAmount(cat.budget)}</p>
                    </div>
                    <span className="text-[9px] font-bold">{pct}%</span>
                  </button>
                )
              })}
            </div>

            {/* Panel */}
            <Card className="border-none bg-card shadow-sm rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: selectedCat.color }}>{getIcon(selectedCat.icon)}</div>
                    <div><h2 className="text-lg font-black">{selectedCat.name}</h2><p className="text-[10px] text-muted-foreground">{totalBudget > 0 ? Math.round((selectedCat.budget / totalBudget) * 100) : 0}% del presupuesto total</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => openExpenseModal(selectedCat.name)} className="bg-kiri-emerald text-white font-bold rounded-xl text-xs gap-1">
                      <Receipt className="h-3 w-3" /> Registrar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(selectedCat)} className="rounded-xl text-xs gap-1"><Pencil className="h-3 w-3" /> Editar</Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-6 items-center">
                  {/* Donut progreso circular */}
                  <div className="relative w-[160px] h-[160px] mx-auto">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="42" fill="none" stroke={selectedCat.color} strokeOpacity={0.15} strokeWidth="10" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                      <motion.circle cx="50" cy="50" r="42" fill="none"
                        stroke={selectedCat.spent > selectedCat.budget ? "#ef4444" : selectedCat.color}
                        strokeWidth="10" strokeLinecap="round"
                        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
                        initial={{ strokeDasharray: `0 ${circ}` }}
                        animate={{ strokeDasharray: `${Math.min(selectedCat.budget > 0 ? selectedCat.spent / selectedCat.budget : 0, 1) * circ} ${circ}` }}
                        transition={{ duration: 0.8, ease: "easeOut" }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black">{selectedCat.budget > 0 ? Math.round((selectedCat.spent / selectedCat.budget) * 100) : 0}%</span>
                      <span className="text-[8px] text-muted-foreground">del presupuesto</span>
                      <span className="text-[8px] text-muted-foreground">utilizado</span>
                      <span className={cn("text-[8px] font-bold mt-0.5", selectedCat.spent > selectedCat.budget ? "text-red-500" : "text-kiri-emerald")}>
                        {selectedCat.spent > selectedCat.budget ? "Excedido" : "Dentro del presupuesto"}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border/50"><span className="text-xs text-muted-foreground">Presupuesto asignado</span><span className="text-sm font-black">{formatAmount(selectedCat.budget)}</span></div>
                    <div className="flex justify-between py-2 border-b border-border/50"><span className="text-xs text-muted-foreground">Gastado</span><span className={cn("text-sm font-black", selectedCat.spent > selectedCat.budget && "text-red-500")}>{formatAmount(selectedCat.spent)}</span></div>
                    <div className="flex justify-between py-2"><span className="text-xs text-muted-foreground">Disponible</span><span className={cn("text-sm font-black", selectedCat.spent > selectedCat.budget ? "text-red-500" : "text-kiri-emerald")}>{formatAmount(Math.max(0, selectedCat.budget - selectedCat.spent))}</span></div>
                  </div>
                </div>

                {/* Consejo Kiri específico de esta categoría — siempre visible */}
                {(() => {
                  const catInsight = getCategoryInsight(selectedCat.name, selectedCat.budget, selectedCat.spent, incomeFrequency)
                  return (
                    <div
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border",
                        catInsight.severity === 'critical' && "bg-red-500/5 border-red-500/20",
                        catInsight.severity === 'warning' && "bg-amber-500/5 border-amber-500/20",
                        catInsight.severity === 'success' && "bg-emerald-500/5 border-emerald-500/20",
                        catInsight.severity === 'info' && "bg-emerald-500/5 border-emerald-500/20",
                      )}
                    >
                      <MapPin className={cn(
                        "h-4 w-4 shrink-0",
                        catInsight.severity === 'critical' && "text-red-500",
                        catInsight.severity === 'warning' && "text-amber-500",
                        catInsight.severity === 'success' && "text-emerald-500",
                        catInsight.severity === 'info' && "text-emerald-500",
                      )} />
                      <p className="text-[11px] text-muted-foreground flex-1">
                        <span className="font-bold text-foreground">Consejo Kiri: </span>
                        {catInsight.message}
                      </p>
                    </div>
                  )
                })()}

                {/* Historial de gastos de esta categoria */}
                {selectedCat.expenses.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <h4 className="text-xs font-bold mb-2">Historial de gasto - {selectedCat.name}</h4>
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                      {selectedCat.expenses.map((e, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/10">
                          <span className="text-[10px] truncate flex-1">{e.nombre}</span>
                          <span className="text-[10px] font-bold shrink-0">{formatAmount(e.monto)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

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
                  onFocus={() => setShowSugg(true)}
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
          </div>
          <DialogFooter className="gap-2">
            {editingId && <Button variant="destructive" size="sm" onClick={handleDelete} className="mr-auto rounded-xl text-xs">Eliminar</Button>}
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.budget} className="bg-kiri-emerald text-white font-bold rounded-xl px-6">
              {editingId ? "Guardar" : "+ Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL REGISTRAR GASTO --- */}
      <Dialog open={expenseModalOpen} onOpenChange={v => { if (!v) { setExpenseModalOpen(false); setExpNombre(""); setExpMonto(""); setExpCategoria(""); setAutoDetected(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-kiri-emerald" />
              Registrar gasto
            </DialogTitle>
            <DialogDescription>¿En qué gastaste? Se asignará a tu presupuesto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción</Label>
              <Input
                placeholder="Ej: Almuerzo, Uber, Netflix..."
                value={expNombre}
                onChange={e => handleExpNombreChange(e.target.value)}
                className="h-10 rounded-xl"
                autoFocus
              />
              {autoDetected && expCategoria === autoDetected && (
                <p className="text-[9px] text-kiri-emerald flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Categoría detectada: {autoDetected}
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
              {categories.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setExpCategoria(cat.name)}
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
                  Aún no tienes categorías. Crea una primero con el botón "Agregar".
                </p>
              )}
            </div>
            {/* Warning si se va a exceder el presupuesto de la categoría seleccionada */}
            {expCategoria && Number(expMonto) > 0 && (() => {
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
