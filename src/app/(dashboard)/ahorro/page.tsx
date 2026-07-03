"use client"

import { useState, useCallback, useEffect } from "react"
import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  PiggyBank, History, TrendingUp, TrendingDown,
  XCircle, CheckCircle2, Pencil, Target, ShieldCheck,
  Plus, Trash2, Star, Wallet, Plane, Home, GraduationCap,
  Car, Heart, Sparkles, Minus, Eye, EyeOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { EmergencyFundSection } from "@/components/recommendations/emergency-fund"
import { emergencyFundApi, userApi } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

// ─── Tipos de bolsillos ───────────────────────────────────────────────────────
type PocketIcon = "piggybank" | "plane" | "home" | "education" | "car" | "health" | "star" | "wallet"
type PocketColor = "mint" | "sky" | "lavender" | "pink" | "periwinkle"

interface SavingPocket {
  id: string
  nombre: string
  meta: number
  acumulado: number
  icono: PocketIcon
  color: PocketColor
  descripcion?: string
  createdAt: string
}

const POCKET_ICONS: { value: PocketIcon; icon: React.ReactNode; label: string }[] = [
  { value: "piggybank",  icon: <PiggyBank className="h-5 w-5" />,      label: "Ahorro" },
  { value: "plane",      icon: <Plane className="h-5 w-5" />,           label: "Viaje" },
  { value: "home",       icon: <Home className="h-5 w-5" />,            label: "Casa" },
  { value: "education",  icon: <GraduationCap className="h-5 w-5" />,   label: "Educación" },
  { value: "car",        icon: <Car className="h-5 w-5" />,             label: "Vehículo" },
  { value: "health",     icon: <Heart className="h-5 w-5" />,           label: "Salud" },
  { value: "star",       icon: <Star className="h-5 w-5" />,            label: "Meta" },
  { value: "wallet",     icon: <Wallet className="h-5 w-5" />,          label: "General" },
]

const POCKET_COLORS: { value: PocketColor; bg: string; text: string; bar: string; ring: string }[] = [
  { value: "mint",       bg: "bg-cyclon-mint/20",       text: "text-cyclon-mint",       bar: "bg-cyclon-mint",       ring: "ring-cyclon-mint/30" },
  { value: "sky",        bg: "bg-cyclon-sky/20",        text: "text-cyclon-sky",        bar: "bg-cyclon-sky",        ring: "ring-cyclon-sky/30" },
  { value: "lavender",   bg: "bg-cyclon-lavender/20",   text: "text-cyclon-lavender",   bar: "bg-cyclon-lavender",   ring: "ring-cyclon-lavender/30" },
  { value: "pink",       bg: "bg-cyclon-pink/20",       text: "text-cyclon-pink",       bar: "bg-cyclon-pink",       ring: "ring-cyclon-pink/30" },
  { value: "periwinkle", bg: "bg-cyclon-periwinkle/20", text: "text-cyclon-periwinkle", bar: "bg-cyclon-periwinkle", ring: "ring-cyclon-periwinkle/30" },
]

const POCKETS_KEY = "kiri_saving_pockets"

function getPocketIcon(icon: PocketIcon, className = "h-5 w-5") {
  const found = POCKET_ICONS.find(i => i.value === icon)
  if (!found) return <PiggyBank className={className} />
  const cloned = found.icon as React.ReactElement<{ className?: string }>
  return React.cloneElement(cloned, { className })
}

function getPocketColor(color: PocketColor) {
  return POCKET_COLORS.find(c => c.value === color) ?? POCKET_COLORS[0]
}

export default function AhorroPage() {
  const { formatAmount, savingsAmount, metaAhorro, setMetaAhorro } = useAppContext()
  const { savingsHistory, totalAhorrado, addSavingsEntry, fixedExpenses, loading } = useFinanceData()
  const { user: authUser } = useAuth()

  const [activeTab, setActiveTab] = useState<"ahorro" | "emergencia">("ahorro")
  // Sub-tab dentro de Ahorro
  const [ahorroSubTab, setAhorroSubTab] = useState<"bolsillos" | "historial">("bolsillos")

  // ── Fondo emergencia ──────────────────────────────────────────────────────
  const [fondoActual, setFondoActual] = useState(0)
  const totalGastosFijos = fixedExpenses.reduce((acc, f) => acc + f.monto, 0)
  const [fondoLoaded, setFondoLoaded] = useState(false)
  if (!fondoLoaded && authUser?.id) {
    setFondoLoaded(true)
    emergencyFundApi.get().then(({ data }) => { if (data?.fondoActual != null) setFondoActual(data.fondoActual) })
  }
  const handleAporte = useCallback(async (monto: number) => {
    if (!authUser?.id) return
    const { data } = await emergencyFundApi.transaction(monto, "aporte")
    if (data) setFondoActual(data.fondoActual)
  }, [authUser?.id])
  const handleRetiro = useCallback(async (monto: number) => {
    if (!authUser?.id) return
    const { data } = await emergencyFundApi.transaction(monto, "retiro")
    if (data) setFondoActual(data.fondoActual)
  }, [authUser?.id])

  // ── Bolsillos (persistidos en localStorage) ────────────────────────────────
  const [pockets, setPockets] = useState<SavingPocket[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem(POCKETS_KEY) ?? "[]") } catch { return [] }
  })
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(POCKETS_KEY, JSON.stringify(pockets))
  }, [pockets])

  // ── Modal: nuevo bolsillo ─────────────────────────────────────────────────
  const [newPocketOpen, setNewPocketOpen] = useState(false)
  const [pocketForm, setPocketForm] = useState({ nombre: "", meta: "", descripcion: "", icono: "piggybank" as PocketIcon, color: "mint" as PocketColor })
  const [savingPocket, setSavingPocket] = useState(false)

  // ── Modal: aportar/retirar bolsillo ───────────────────────────────────────
  const [txPocket, setTxPocket] = useState<SavingPocket | null>(null)
  const [txType, setTxType] = useState<"aporte" | "retiro">("aporte")
  const [txAmount, setTxAmount] = useState("")
  const [savingTx, setSavingTx] = useState(false)

  // ── Ocultar bolsillos (ojo) ───────────────────────────────────────────────
  const [hiddenPockets, setHiddenPockets] = useState<Set<string>>(new Set())
  const toggleHidden = (id: string) => setHiddenPockets(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // ── Modal: editar bolsillo ────────────────────────────────────────────────
  const [editPocket, setEditPocket] = useState<SavingPocket | null>(null)
  const [editForm, setEditForm] = useState({ nombre: "", meta: "", descripcion: "" })

  // ── Modal: editar meta global ─────────────────────────────────────────────
  const [isMetaOpen, setIsMetaOpen] = useState(false)
  const [metaInput, setMetaInput] = useState("")
  const [savingMeta, setSavingMeta] = useState(false)

  // ── Modal: registrar ahorro (historial) ───────────────────────────────────
  const [isAhorroOpen, setIsAhorroOpen] = useState(false)
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [customAmount, setCustomAmount] = useState("")
  const [savingAhorro, setSavingAhorro] = useState(false)

  // ── Métricas globales ─────────────────────────────────────────────────────
  const totalAcumuladoBolsillos = pockets.reduce((a, p) => a + p.acumulado, 0)
  const progress = metaAhorro > 0 ? Math.min((totalAcumuladoBolsillos / metaAhorro) * 100, 100) : 0
  const lastSaving = savingsHistory.find(e => e.tipo === "ahorro")
  const streakCount = savingsHistory.filter(e => e.tipo === "ahorro").length

  // Cuánto le corresponde a cada bolsillo de la distribución de ahorro
  // Si hay bolsillos, dividimos savingsAmount equitativamente
  const sugerenciaPorBolsillo = pockets.length > 0 && savingsAmount > 0
    ? Math.round(savingsAmount / pockets.length)
    : 0

  // ── Handlers bolsillos ────────────────────────────────────────────────────
  const handleCreatePocket = () => {
    setSavingPocket(true)
    const pocket: SavingPocket = {
      id: Date.now().toString(),
      nombre: pocketForm.nombre,
      meta: Number(pocketForm.meta) || 0,
      acumulado: 0,
      icono: pocketForm.icono,
      color: pocketForm.color,
      descripcion: pocketForm.descripcion || undefined,
      createdAt: new Date().toISOString(),
    }
    setPockets(p => [...p, pocket])
    setSavingPocket(false)
    setNewPocketOpen(false)
    setPocketForm({ nombre: "", meta: "", descripcion: "", icono: "piggybank", color: "mint" })
  }

  const handleDeletePocket = (id: string) => setPockets(p => p.filter(x => x.id !== id))

  const openEditPocket = (pocket: SavingPocket) => {
    setEditPocket(pocket)
    setEditForm({ nombre: pocket.nombre, meta: String(pocket.meta || ""), descripcion: pocket.descripcion || "" })
  }

  const handleSaveEditPocket = () => {
    if (!editPocket) return
    setPockets(p => p.map(x => x.id === editPocket.id ? { ...x, nombre: editForm.nombre || x.nombre, meta: editForm.meta === "" ? 0 : Number(editForm.meta), descripcion: editForm.descripcion || undefined } : x))
    setEditPocket(null)
  }

  const openTx = (pocket: SavingPocket, type: "aporte" | "retiro") => {
    setTxPocket(pocket); setTxType(type); setTxAmount(""); 
  }

  const handleTx = async () => {
    if (!txPocket || !txAmount || Number(txAmount) <= 0) return
    setSavingTx(true)
    const amt = Number(txAmount)

    if (txType === "aporte") {
      // Aportar al bolsillo de ahorro → descontar del sueldo real (cashBalance)
      await userApi.walletDeduct(amt, 'ahorro')
      // Registrar en historial de ahorro para que aparezca en Balance
      await addSavingsEntry(amt, "ahorro")
    } else {
      // Retirar del bolsillo de ahorro → sumar al sueldo real (cashBalance)
      await userApi.walletWithdraw(amt, 'ahorro')
    }

    setPockets(p => p.map(x => {
      if (x.id !== txPocket.id) return x
      const nuevo = txType === "aporte" ? x.acumulado + amt : Math.max(0, x.acumulado - amt)
      return { ...x, acumulado: nuevo }
    }))
    setSavingTx(false)
    setTxPocket(null)
    setTxAmount("")
  }

  // ── Handlers ahorro historial ─────────────────────────────────────────────
  const handleSaveAhorro = async (monto: number) => {
    setSavingAhorro(true)
    await addSavingsEntry(monto, "ahorro")
    setSavingAhorro(false)
    setIsAhorroOpen(false)
    setIsCustomMode(false)
    setCustomAmount("")
  }
  const handleSkipAhorro = async () => {
    setSavingAhorro(true)
    await addSavingsEntry(0, "sin_ahorro")
    setSavingAhorro(false)
    setIsAhorroOpen(false)
  }
  const handleSaveMeta = async () => {
    const parsed = Number(metaInput)
    if (!parsed || parsed <= 0) return
    setSavingMeta(true)
    await setMetaAhorro(parsed)
    setSavingMeta(false)
    setIsMetaOpen(false)
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-cyclon-mint">Ahorro</h1>
          <p className="text-muted-foreground text-sm">Tu banco personal, a tu ritmo.</p>
        </div>
        {activeTab === "ahorro" && ahorroSubTab === "bolsillos" && (
          <Button
            size="icon"
            className="rounded-2xl bg-cyclon-mint shadow-lg shadow-cyclon-mint/30 text-cyclon-periwinkle"
            onClick={() => setNewPocketOpen(true)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}
      </header>

      {/* ── Tabs principales: Ahorro / Emergencia ── */}
      <div className="grid grid-cols-2 gap-2">
        {([
          { key: "ahorro",     label: "Ahorro",     icon: <PiggyBank className="h-3.5 w-3.5 inline mr-1.5" /> },
          { key: "emergencia", label: "Emergencia", icon: <ShieldCheck className="h-3.5 w-3.5 inline mr-1.5" /> },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "h-11 rounded-2xl text-sm font-bold border-2 transition-colors",
              activeTab === tab.key
                ? tab.key === "ahorro"
                  ? "bg-cyclon-mint text-cyclon-periwinkle border-cyclon-mint"
                  : "bg-cyclon-periwinkle text-white border-cyclon-periwinkle"
                : "border-muted text-muted-foreground hover:border-cyclon-mint/40"
            )}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ════ TAB: AHORRO — resumen + bolsillos + historial ════ */}
      {activeTab === "ahorro" && (
        <div className="space-y-5">

          {/* ── Cuadro resumen (como emergencia) ── */}
          <Card className="border-none bg-cyclon-mint/10 rounded-3xl overflow-hidden relative shadow-none">
            <div className="absolute top-[-20px] right-[-20px] h-32 w-32 bg-white/20 rounded-full blur-2xl" />
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              <div className="h-20 w-20 bg-card rounded-3xl shadow-xl shadow-cyclon-mint/10 flex items-center justify-center">
                <PiggyBank className="h-10 w-10 text-cyclon-mint" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium tracking-wide">TOTAL AHORRADO</p>
                <h2 className="text-4xl font-black text-cyclon-periwinkle mt-1">{formatAmount(totalAcumuladoBolsillos)}</h2>
                {pockets.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    en {pockets.length} {pockets.length === 1 ? "bolsillo" : "bolsillos"}
                  </p>
                )}
              </div>
              {savingsAmount > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-white/30 w-full justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-cyclon-mint shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Sugerido este periodo:{" "}
                    <span className="font-black text-cyclon-mint">{formatAmount(savingsAmount)}</span>
                    {pockets.length > 1 && (
                      <span> ({formatAmount(sugerenciaPorBolsillo)} por bolsillo)</span>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Sub-tabs: Bolsillos / Historial ── */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "bolsillos", label: "Bolsillos",  icon: <Sparkles className="h-3.5 w-3.5 inline mr-1.5" /> },
              { key: "historial", label: "Historial",  icon: <History className="h-3.5 w-3.5 inline mr-1.5" /> },
            ] as const).map(sub => (
              <button
                key={sub.key}
                onClick={() => setAhorroSubTab(sub.key)}
                className={cn(
                  "h-10 rounded-xl text-xs font-bold border-2 transition-colors",
                  ahorroSubTab === sub.key
                    ? "bg-cyclon-mint/20 text-cyclon-periwinkle border-cyclon-mint"
                    : "border-muted text-muted-foreground hover:border-cyclon-mint/40"
                )}
              >
                {sub.icon}{sub.label}
              </button>
            ))}
          </div>

          {/* ── Sub-tab: Bolsillos ── */}
          {ahorroSubTab === "bolsillos" && (
            <div className="space-y-3">
              {pockets.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <div className="h-16 w-16 bg-cyclon-mint/10 rounded-2xl flex items-center justify-center mx-auto">
                    <PiggyBank className="h-8 w-8 text-cyclon-mint" />
                  </div>
                  <p className="text-sm font-bold">Sin bolsillos aún</p>
                  <p className="text-xs text-muted-foreground">Crea tu primer bolsillo con el botón <strong>+</strong></p>
                  {savingsAmount > 0 && (
                    <p className="text-xs text-cyclon-mint font-bold">
                      Tienes {formatAmount(savingsAmount)} sugerido para ahorrar este periodo
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {pockets.map(pocket => {
                    const c = getPocketColor(pocket.color)
                    const pct = pocket.meta > 0 ? Math.min((pocket.acumulado / pocket.meta) * 100, 100) : 0
                    const done = pct >= 100
                    return (
                      <Card key={pocket.id} className={cn("border-none shadow-sm bg-card ring-1 transition-all", c.ring)}>
                        <CardContent className="p-5 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0", c.bg, c.text)}>
                              {getPocketIcon(pocket.icono)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-sm truncate">{pocket.nombre}</p>
                                  {pocket.descripcion && (
                                    <p className="text-[10px] text-muted-foreground truncate">{pocket.descripcion}</p>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => toggleHidden(pocket.id)}
                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors">
                                    {hiddenPockets.has(pocket.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  </button>
                                  <button onClick={() => openEditPocket(pocket)}
                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-cyclon-lavender hover:bg-cyclon-lavender/10 transition-colors">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => handleDeletePocket(pocket.id)}
                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-1.5 mt-1">
                                {hiddenPockets.has(pocket.id) ? (
                                  <span className="text-xl font-black text-muted-foreground">••••••</span>
                                ) : (
                                  <>
                                    <span className={cn("text-xl font-black", c.text)}>{formatAmount(pocket.acumulado)}</span>
                                    {pocket.meta > 0 && (
                                      <span className="text-[10px] text-muted-foreground">de {formatAmount(pocket.meta)}</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          {sugerenciaPorBolsillo > 0 && (
                            <div className="flex items-center gap-1.5 px-1">
                              <TrendingUp className="h-3 w-3 text-cyclon-mint shrink-0" />
                              <p className="text-[10px] text-muted-foreground">
                                Sugerido este periodo:{" "}
                                <span className="font-bold text-cyclon-mint">{formatAmount(sugerenciaPorBolsillo)}</span>
                              </p>
                            </div>
                          )}
                          {pocket.meta > 0 && (
                            <div className="space-y-1">
                              <Progress value={pct} className="h-2" indicatorClassName={cn(c.bar, done && "animate-pulse")} />
                              <div className="flex justify-between text-[10px] text-muted-foreground font-bold">
                                <span>{Math.round(pct)}% completado</span>
                                {done && <span className="text-cyclon-mint">🎉 ¡Meta alcanzada!</span>}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => openTx(pocket, "aporte")}
                              className={cn("h-9 rounded-xl font-bold gap-1.5 text-xs border-none hover:opacity-90", c.bg, c.text)}
                            >
                              <TrendingUp className="h-3.5 w-3.5" /> Aportar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openTx(pocket, "retiro")}
                              disabled={pocket.acumulado <= 0}
                              className="h-9 rounded-xl font-bold gap-1.5 text-xs border-2 border-dashed"
                            >
                              <Minus className="h-3.5 w-3.5" /> Retirar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* ── Sub-tab: Historial ── */}
          {ahorroSubTab === "historial" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <History className="h-3.5 w-3.5" /> Historial de periodos
                </h3>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>🔥 Racha: <strong>{streakCount}</strong></span>
                  {lastSaving && <span>Último: <strong>{formatAmount(lastSaving.monto)}</strong></span>}
                </div>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
              ) : savingsHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aún no hay registros.</p>
              ) : (
                <div className="space-y-2">
                  {savingsHistory.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-card rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                          item.tipo === "ahorro" ? "bg-cyclon-mint/20 text-cyclon-mint" : "bg-cyclon-pink/20 text-cyclon-pink"
                        )}>
                          {item.tipo === "ahorro" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-xs capitalize">{item.periodo}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                            {item.tipo === "ahorro" ? "Aporte realizado" : "Sin ahorro"}
                          </p>
                        </div>
                      </div>
                      <div className={cn("text-sm font-black", item.tipo === "ahorro" ? "text-cyclon-mint" : "text-muted-foreground")}>
                        {item.tipo === "ahorro" ? `+${formatAmount(item.monto)}` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════ TAB: EMERGENCIA ════ */}
      {activeTab === "emergencia" && (
        <EmergencyFundSection
          totalGastosFijos={totalGastosFijos}
          fondoActual={fondoActual}
          aporteMensual={savingsAmount}
          onAporte={handleAporte}
          onRetiro={handleRetiro}
        />
      )}

      {/* ════ MODALES ════ */}

      {/* Nuevo bolsillo */}
      <Dialog open={newPocketOpen} onOpenChange={v => !v && setNewPocketOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyclon-mint" /> Nuevo bolsillo de ahorro
            </DialogTitle>
            <DialogDescription>Define tu meta y personaliza tu bolsillo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nombre del bolsillo</Label>
              <Input placeholder="Ej: Viaje a Cartagena" value={pocketForm.nombre}
                onChange={e => setPocketForm(f => ({ ...f, nombre: e.target.value }))} className="h-11 rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Meta <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <MoneyInput value={pocketForm.meta} onChange={v => setPocketForm(f => ({ ...f, meta: v }))}
                className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input placeholder="Para qué es este ahorro..." value={pocketForm.descripcion}
                onChange={e => setPocketForm(f => ({ ...f, descripcion: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Ícono</Label>
              <div className="grid grid-cols-4 gap-2">
                {POCKET_ICONS.map(i => (
                  <button key={i.value} onClick={() => setPocketForm(f => ({ ...f, icono: i.value }))}
                    className={cn("flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-colors",
                      pocketForm.icono === i.value ? "border-cyclon-mint bg-cyclon-mint/5 text-cyclon-mint" : "border-muted text-muted-foreground hover:border-cyclon-mint/30")}>
                    {i.icon}
                    <span className="text-[9px] font-bold">{i.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Color</Label>
              <div className="flex gap-2">
                {POCKET_COLORS.map(c => (
                  <button key={c.value} onClick={() => setPocketForm(f => ({ ...f, color: c.value }))}
                    className={cn("h-8 w-8 rounded-full transition-all", c.bar,
                      pocketForm.color === c.value ? "scale-125 ring-2 ring-offset-2 ring-current" : "opacity-60 hover:opacity-100")} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setNewPocketOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePocket} disabled={savingPocket || !pocketForm.nombre}
              className="bg-cyclon-mint text-cyclon-periwinkle font-bold rounded-xl px-8 hover:bg-cyclon-mint/80">
              {savingPocket ? "Creando..." : "Crear bolsillo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aportar/Retirar bolsillo */}
      <Dialog open={!!txPocket} onOpenChange={v => !v && setTxPocket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {txType === "aporte" ? <TrendingUp className="h-5 w-5 text-cyclon-mint" /> : <TrendingDown className="h-5 w-5 text-cyclon-pink" />}
              {txType === "aporte" ? "Aportar a" : "Retirar de"} {txPocket?.nombre}
            </DialogTitle>
            <DialogDescription>
              {txType === "aporte" ? "Agrega dinero a este bolsillo." : "Retira fondos de este bolsillo."}
              {txPocket && <span className="block font-bold mt-1">Disponible: {formatAmount(txPocket.acumulado)}</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <MoneyInput value={txAmount} onChange={setTxAmount} className="h-14 text-2xl font-bold rounded-2xl" placeholder="0" />
            {txType === "retiro" && txPocket && Number(txAmount) > txPocket.acumulado && (
              <p className="text-xs text-destructive font-bold">No puedes retirar más de lo que tienes.</p>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setTxPocket(null)}>Cancelar</Button>
            <Button onClick={handleTx}
              disabled={savingTx || !txAmount || Number(txAmount) <= 0 || (txType === "retiro" && txPocket !== null && Number(txAmount) > txPocket.acumulado)}
              className={cn("font-bold rounded-xl px-8", txType === "aporte" ? "bg-cyclon-mint text-cyclon-periwinkle" : "bg-cyclon-pink text-white")}>
              {savingTx ? "Guardando..." : txType === "aporte" ? "Aportar" : "Retirar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar ahorro / retirar global */}
      <Dialog open={isAhorroOpen} onOpenChange={setIsAhorroOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCustomMode ? "Retirar del ahorro" : "Registrar Ahorro"}</DialogTitle>
            <DialogDescription>{isCustomMode ? "¿Cuánto estás retirando?" : "¿Cuánto vas a ahorrar este periodo?"}</DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-3">
            {!isCustomMode ? (
              <>
                <Button onClick={() => handleSaveAhorro(savingsAmount)} disabled={savingAhorro || savingsAmount === 0}
                  className="h-16 rounded-2xl bg-cyclon-mint text-cyclon-periwinkle hover:bg-cyclon-mint/80 font-bold text-base flex flex-col gap-0.5">
                  <span className="text-xs opacity-70">Monto sugerido</span>
                  <span className="text-xl font-black">{formatAmount(savingsAmount)}</span>
                </Button>
                <Button variant="outline" onClick={() => setIsCustomMode(true)}
                  className="h-12 rounded-2xl border-dashed border-2 font-bold flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Otro monto
                </Button>
                <Button variant="ghost" onClick={handleSkipAhorro} disabled={savingAhorro}
                  className="h-11 rounded-2xl text-muted-foreground hover:text-cyclon-pink font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4" /> No ahorré este periodo
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <MoneyInput value={customAmount} onChange={setCustomAmount}
                  className="h-14 text-2xl font-bold rounded-2xl" placeholder="0" />
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setIsCustomMode(false)} className="flex-1">Volver</Button>
                  <Button onClick={() => handleSaveAhorro(Number(customAmount))}
                    disabled={savingAhorro || !customAmount || Number(customAmount) <= 0}
                    className="flex-1 bg-cyclon-mint text-cyclon-periwinkle font-bold h-12 rounded-xl">
                    {savingAhorro ? "Guardando..." : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar meta global */}
      <Dialog open={isMetaOpen} onOpenChange={setIsMetaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-cyclon-periwinkle" /> Editar meta de ahorro
            </DialogTitle>
            <DialogDescription>Actualmente vas {Math.round(progress)}% del camino.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">$</span>
              <Input type="number" placeholder="5000"
                className="pl-10 h-14 text-2xl font-bold bg-muted/30 border-none rounded-2xl"
                value={metaInput} onChange={e => setMetaInput(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsMetaOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMeta} disabled={savingMeta || !metaInput || Number(metaInput) <= 0}
              className="bg-cyclon-mint text-cyclon-periwinkle font-bold rounded-xl px-8 hover:bg-cyclon-mint/80">
              {savingMeta ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar bolsillo */}
      <Dialog open={!!editPocket} onOpenChange={v => !v && setEditPocket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-cyclon-lavender" /> Editar bolsillo
            </DialogTitle>
            <DialogDescription>Modifica los datos de &quot;{editPocket?.nombre}&quot;.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nombre</Label>
              <Input value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Meta</Label>
              <MoneyInput value={editForm.meta} onChange={v => setEditForm(f => ({ ...f, meta: v }))} className="h-12 text-xl font-bold rounded-xl" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción</Label>
              <Input value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))} className="h-10 rounded-xl" placeholder="Para qué es..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditPocket(null)}>Cancelar</Button>
            <Button onClick={handleSaveEditPocket} disabled={!editForm.nombre} className="bg-cyclon-lavender text-white font-bold rounded-xl px-8">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
