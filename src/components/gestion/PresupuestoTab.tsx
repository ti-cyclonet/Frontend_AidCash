"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Plus, Pencil, ArrowLeft, Info,
  Utensils, Car, Gamepad2, Dumbbell, Heart, ShoppingBag, Wifi, GraduationCap, MoreHorizontal,
  PawPrint, Home, Baby, Plane, Gift, Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { useFinanceData } from "@/hooks/use-finance-data"
import { userApi, WalletState } from "@/lib/api-client"

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
const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316", "#6366f1"]
function getIcon(key: string) { return ICONS.find(i => i.key === key)?.el || <MoreHorizontal className="h-5 w-5" /> }

const SUGGESTIONS = [
  { name: "Alimentacion", icon: "utensils", color: "#10b981", keys: ["comida", "mercado", "supermercado", "restaurante", "hamburguesa", "almuerzo", "cena", "cafeteria", "snack"] },
  { name: "Transporte", icon: "car", color: "#3b82f6", keys: ["gasolina", "uber", "taxi", "bus", "peaje", "parqueadero"] },
  { name: "Entretenimiento", icon: "gamepad", color: "#8b5cf6", keys: ["netflix", "spotify", "cine", "juego", "streaming", "bar", "fiesta"] },
  { name: "Deporte", icon: "dumbbell", color: "#f59e0b", keys: ["gym", "gimnasio", "cancha", "yoga"] },
  { name: "Salud", icon: "heart", color: "#ef4444", keys: ["medico", "doctor", "farmacia", "odontologo", "hospital"] },
  { name: "Compras", icon: "shopping", color: "#ec4899", keys: ["ropa", "zapatos", "accesorios", "electronica", "amazon"] },
  { name: "Servicios", icon: "wifi", color: "#06b6d4", keys: ["internet", "luz", "agua", "gas", "telefono", "celular"] },
  { name: "Educacion", icon: "education", color: "#6366f1", keys: ["universidad", "curso", "libro", "matricula"] },
  { name: "Mascotas", icon: "paw", color: "#f97316", keys: ["veterinario", "perro", "gato", "mascota"] },
  { name: "Vivienda", icon: "home", color: "#84cc16", keys: ["arriendo", "renta", "hipoteca", "administracion"] },
  { name: "Hijos", icon: "baby", color: "#14b8a6", keys: ["colegio", "guarderia", "juguete"] },
  { name: "Viajes", icon: "plane", color: "#a855f7", keys: ["vuelo", "hotel", "vacaciones"] },
  { name: "Regalos", icon: "gift", color: "#e11d48", keys: ["cumpleanos", "navidad", "regalo", "detalle"] },
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

// --- Component ---
export function PresupuestoTab() {
  const { formatAmount } = useAppContext()
  const { allocation } = usePeriodBudget()
  const { impulseExpenses } = useFinanceData()

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

  // Conectar gastos hormiga a categorias
  const catsWithSpent = categories.map(cat => {
    const sug = SUGGESTIONS.find(s => s.name.toLowerCase() === cat.name.toLowerCase())
    const keys = sug?.keys ?? [cat.name.toLowerCase()]
    const matched = impulseExpenses.filter(e => keys.some(k => e.nombre.toLowerCase().includes(k)))
    return { ...cat, spent: matched.reduce((a, e) => a + e.monto, 0), expenses: matched }
  })

  const totalBudget = catsWithSpent.reduce((a, c) => a + c.budget, 0)
  const totalSpent = catsWithSpent.reduce((a, c) => a + c.spent, 0)
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  const remaining = Math.max(0, realFreeAmount - totalSpent)
  const selectedCat = catsWithSpent.find(c => c.id === selectedId) ?? null
  const circ = 2 * Math.PI * 42

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black">Presupuesto por Categoria</h1>
          <p className="text-[10px] text-muted-foreground">Asigna y controla tu gasto libre por categoria</p>
        </div>
        <Button onClick={openAdd} size="sm" className="bg-kiri-emerald text-white font-bold rounded-xl text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
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
                        strokeDasharray={`${pct * circ * 0.96} ${circ}`} strokeDashoffset={-offset * circ}
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
                  <Button variant="outline" size="sm" onClick={() => openEdit(selectedCat)} className="rounded-xl text-xs gap-1"><Pencil className="h-3 w-3" /> Editar</Button>
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
                    <div className={cn("rounded-xl p-3 flex items-start gap-2", selectedCat.spent > selectedCat.budget ? "bg-red-500/10" : "bg-kiri-emerald/5")}>
                      <Info className={cn("h-4 w-4 shrink-0 mt-0.5", selectedCat.spent > selectedCat.budget ? "text-red-500" : "text-kiri-emerald")} />
                      <p className="text-[10px] text-muted-foreground">
                        {selectedCat.spent > selectedCat.budget ? `Excediste en ${formatAmount(selectedCat.spent - selectedCat.budget)}. Reduce gastos o ajusta el limite.` : "Llevas un buen control. Sigue asi!"}
                      </p>
                    </div>
                  </div>
                </div>

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
