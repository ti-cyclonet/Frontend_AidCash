"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Plus, RefreshCw, Wallet, Zap,
  Lock, CheckCircle2, Pencil, ChevronDown, ChevronUp,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { userApi, WalletState } from "@/lib/api-client"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { getIncomeQuincenaLabel } from "@/hooks/use-smart-alerts"
import { useSocket, SOCKET_EVENTS } from "@/lib/socket-context"
import { RecommendationModal, RecommendationType } from "./RecommendationModal"
import { PaydaySelector } from "./PaydaySelector"
import { Debt, FixedExpense } from "@/lib/types"

// ─── Animated Amount ──────────────────────────────────────────────────────────

function AnimatedAmount({ value, formatAmount, className }: { value: number; formatAmount: (n: number) => string; className?: string }) {
  const prevRef = useRef(value)
  const [flash, setFlash] = useState<"up" | "down" | null>(null)
  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(value > prevRef.current ? "up" : "down")
      prevRef.current = value
      const timer = setTimeout(() => setFlash(null), 800)
      return () => clearTimeout(timer)
    }
  }, [value])
  return (
    <span className={cn("transition-all duration-500 inline-block",
      flash === "up" && "animate-pulse text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]",
      flash === "down" && "animate-pulse text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]",
      className)}>{formatAmount(value)}</span>
  )
}

// ─── Counting Animation (números que suben/bajan como odómetro) ───────────────

function CountingAmount({ value, formatAmount, className, duration = 1600 }: {
  value: number; formatAmount: (n: number) => string; className?: string; duration?: number
}) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const frameRef = useRef<number>(0)
  const [flash, setFlash] = useState<"up" | "down" | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    if (from === to) return

    setFlash(to > from ? "up" : "down")
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease in-out sine para un efecto suave y agradable
      const eased = -(Math.cos(Math.PI * progress) - 1) / 2
      const current = Math.round(from + (to - from) * eased)
      setDisplay(current)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(to)
        prevRef.current = to
        setTimeout(() => setFlash(null), 800)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return (
    <span className={cn(
      "inline-block transition-all duration-500",
      flash === "up" && "text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]",
      flash === "down" && "text-red-300 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]",
      className
    )}>
      {formatAmount(display)}
    </span>
  )
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function getPeriodRangeLabel(diasCobro: string, frequency: string): string {
  const days = diasCobro.split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d)).sort((a, b) => a - b)
  const now = new Date()
  const day = now.getDate()
  const monthName = now.toLocaleString("es", { month: "long" })
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (frequency === "mensual" || days.length < 2) return `1 - ${lastDay} de ${monthName}`
  const [d1, d2] = days
  if (day >= d1 && day < d2) return `${d1} - ${d2 - 1} de ${monthName}`
  return `${d2} - ${lastDay} de ${monthName}`
}

function getCurrentPeriodNumber(diasCobro: string, frequency: string): 1 | 2 {
  if (frequency === "mensual") return 1
  const days = diasCobro.split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d)).sort((a, b) => a - b)
  if (days.length < 2) return 1
  return new Date().getDate() >= days[0] && new Date().getDate() < days[1] ? 1 : 2
}

function getDaysRemaining(diasCobro: string, frequency: string): number {
  const now = new Date(); const day = now.getDate()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (frequency === "mensual") return lastDay - day
  const days = diasCobro.split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d)).sort((a, b) => a - b)
  if (days.length < 2) return lastDay - day
  const [d1, d2] = days
  if (day >= d1 && day < d2) return d2 - day - 1
  return lastDay - day + d1 - 1
}

function getNextPeriodLabel(diasCobro: string, frequency: string): string {
  if (frequency === "mensual") return ""
  const days = diasCobro.split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d)).sort((a, b) => a - b)
  if (days.length < 2) return ""
  const now = new Date(); const day = now.getDate()
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthName = now.toLocaleString("es", { month: "long" })
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleString("es", { month: "long" })
  const [d1, d2] = days

  // Calcular fin de periodo (día anterior al siguiente pago, mínimo 1)
  const endOfSecondPeriod = d1 - 1 <= 0 ? lastDayOfMonth : d1 - 1

  if (day >= d1 && day < d2) {
    // Periodo actual: d1 al d2-1. Próximo: d2 al fin del segundo periodo
    return `${d2} de ${monthName} – ${endOfSecondPeriod} de ${d1 - 1 <= 0 ? monthName : nextMonth}`
  }
  if (day >= d2) {
    // Periodo actual: d2 al endOfSecondPeriod. Próximo: d1 al d2-1 del siguiente mes
    return `${d1} – ${d2 - 1} de ${nextMonth}`
  }
  // day < d1
  return `${d1} – ${d2 - 1} de ${monthName}`
}

/**
 * Calcula el monto a mostrar de una obligación en la lista del periodo.
 * Si la frecuencia de la obligación es QUINCENAL, el monto se DIVIDE entre 2
 * (se paga la mitad en cada quincena).
 * Si es MENSUAL, se muestra completo (solo aparece en 1 periodo).
 */
function getDisplayAmount(item: { frecuenciaPago?: string; frecuencia?: string; cuotaPeriodo?: number; monto?: number }): number {
  const freq = item.frecuenciaPago || item.frecuencia || "mensual"
  const rawAmount = item.cuotaPeriodo ?? item.monto ?? 0
  // Quincenal: el monto se divide entre las 2 quincenas
  if (freq === "quincenal") return Math.round(rawAmount / 2)
  return rawAmount
}

// ─── Pocket config ────────────────────────────────────────────────────────────

const POCKETS = [
  { key: "ahorro" as const, allocKey: "savingsPct" as const, title: "Ahorro", emoji: "💚",
    bg: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20",
    ringStroke: "stroke-emerald-400", ringBg: "stroke-emerald-100 dark:stroke-emerald-900/40",
    badgeBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", illustration: "🐷" },
  { key: "obligaciones" as const, allocKey: "obligationsPct" as const, title: "Obligaciones", emoji: "🔒",
    bg: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20",
    ringStroke: "stroke-amber-400", ringBg: "stroke-amber-100 dark:stroke-amber-900/40",
    badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", illustration: "📋" },
  { key: "libre" as const, allocKey: "dailyFreePct" as const, title: "Gasto libre", emoji: "😎",
    bg: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/20",
    ringStroke: "stroke-blue-400", ringBg: "stroke-blue-100 dark:stroke-blue-900/40",
    badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", illustration: "🎮" },
  { key: "endeudamiento" as const, allocKey: "debtCapacityPct" as const, title: "Endeudamiento", emoji: "💪",
    bg: "bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20",
    ringStroke: "stroke-purple-400", ringBg: "stroke-purple-100 dark:stroke-purple-900/40",
    badgeBg: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", illustration: "💳" },
] as const

// ─── Main Component ───────────────────────────────────────────────────────────

export function BilleteraTab() {
  const { formatAmount, income, setIncome, incomeFrequency, setIncomeFrequency, diasCobro } = useAppContext()
  const { debts, fixedExpenses, extraIncomes, addExtraIncome } = useFinanceData()
  const [wallet, setWallet] = useState<WalletState>({ cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0 })
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [editIncomeOpen, setEditIncomeOpen] = useState(false)
  const [editIncomeValue, setEditIncomeValue] = useState("")
  const [obligationsExpanded, setObligationsExpanded] = useState(false)
  const [frequencyExpanded, setFrequencyExpanded] = useState(false)

  // Cerrar paneles desplegables al hacer clic fuera
  useEffect(() => {
    if (!frequencyExpanded && !obligationsExpanded) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Si el clic fue dentro de un panel desplegable o un dialog, no cerrar
      if (target.closest('[data-panel="frequency"]') || target.closest('[data-panel="obligations"]') || target.closest('[role="dialog"]')) return
      setFrequencyExpanded(false)
      setObligationsExpanded(false)
    }
    // Pequeño delay para no interferir con el clic que abrió el panel
    const timer = setTimeout(() => document.addEventListener('click', handleClickOutside), 100)
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClickOutside) }
  }, [frequencyExpanded, obligationsExpanded])
  const [monto, setMonto] = useState("")
  const [tipo, setTipo] = useState<"salario" | "extra">("salario")
  const [extraDesc, setExtraDesc] = useState("")
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [recommendationType, setRecommendationType] = useState<RecommendationType>(null)
  const [recommendationOpen, setRecommendationOpen] = useState(false)

  // ── Extra income inline form state ──
  const [extraIncomeFormOpen, setExtraIncomeFormOpen] = useState(false)
  const [extraName, setExtraName] = useState("")
  const [extraMonto, setExtraMonto] = useState("")
  const [extraTemp, setExtraTemp] = useState<"una_vez" | "definido" | "indefinido">("una_vez")
  const [extraFreq, setExtraFreq] = useState<"mensual" | "quincenal">("mensual")
  const [extraMeses, setExtraMeses] = useState("")
  const [savingExtra, setSavingExtra] = useState(false)

  const handleAddExtraIncome = async () => {
    if (!extraName || !extraMonto) return
    setSavingExtra(true)
    // Si la frecuencia del extra es quincenal y la del usuario es mensual, duplicar el monto
    // Si la frecuencia del extra es mensual y la del usuario es quincenal, dividir entre 2
    let montoAjustado = Number(extraMonto)
    if (extraFreq === "quincenal" && incomeFrequency === "mensual") {
      montoAjustado = montoAjustado * 2 // Recibe quincenal, presupuesto mensual → x2
    } else if (extraFreq === "mensual" && incomeFrequency === "quincenal") {
      montoAjustado = Math.round(montoAjustado / 2) // Recibe mensual, presupuesto quincenal → /2
    }
    await addExtraIncome({
      nombre: extraName,
      monto: montoAjustado,
      temporalidad: extraTemp,
      mesesRestantes: extraTemp === "definido" ? Number(extraMeses) || 1 : null,
    })
    setSavingExtra(false)
    setExtraName("")
    setExtraMonto("")
    setExtraTemp("una_vez")
    setExtraFreq("mensual")
    setExtraMeses("")
    setExtraIncomeFormOpen(false)
  }

  useEffect(() => { userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) }) }, [])

  // Refrescar wallet cuando el coach u otro componente registra un ingreso/pago
  useEffect(() => {
    const refresh = () => { userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) }) }
    window.addEventListener("kiri:wallet-updated", refresh)
    return () => window.removeEventListener("kiri:wallet-updated", refresh)
  }, [])

  const { allocation, periodData, pendingObligations } = usePeriodBudget()
  const { periodDebts, periodFixed } = periodData
  const { addNotification } = useSocket()

  const periodNum = getCurrentPeriodNumber(diasCobro, incomeFrequency)
  const periodRange = getPeriodRangeLabel(diasCobro, incomeFrequency)
  const nextPeriodLabel = getNextPeriodLabel(diasCobro, incomeFrequency)

  // Obligaciones con monto ajustado por frecuencia (quincenal = /2)
  const displayObligationsTotal = useMemo(() => {
    const debtsTotal = periodDebts.reduce((a, d) => a + getDisplayAmount(d), 0)
    const fixedTotal = periodFixed.reduce((a, f) => a + getDisplayAmount(f), 0)
    return debtsTotal + fixedTotal
  }, [periodDebts, periodFixed])

  const nextPeriodObligations = useMemo(() => {
    const currentIds = new Set([...periodDebts.map(d => d.id), ...periodFixed.map(f => f.id)])
    const nextDebts = debts.filter(d => d.estado !== 'saldada' && !currentIds.has(d.id))
    const nextFixed = fixedExpenses.filter(f => !currentIds.has(f.id))
    return { total: nextDebts.reduce((a, d) => a + d.cuotaPeriodo, 0) + nextFixed.reduce((a, f) => a + f.monto, 0) }
  }, [debts, fixedExpenses, periodDebts, periodFixed])

  // Handlers
  const handleRegisterIncome = async () => {
    if (!monto || Number(monto) <= 0) return
    setSaving(true)
    const { data } = await userApi.walletIncome(Number(monto), tipo)
    if (data) {
      setWallet(data.wallet)
      if (tipo === 'salario') {
        const label = getIncomeQuincenaLabel(incomeFrequency)
        if (label) addNotification(SOCKET_EVENTS.ALERT_PERIOD_ASSIGNED, { message: label, action: "info" })
      }
      if (pendingObligations === 0) { setRecommendationType("no_obligations"); setRecommendationOpen(true) }
      else if (income > 0 && data.wallet.cashBalance > income) { setRecommendationType("extra_income"); setRecommendationOpen(true) }
    }
    setSaving(false); setIncomeOpen(false); setMonto(""); setExtraDesc("")
  }

  const handleEditIncome = async () => {
    const val = Number(editIncomeValue)
    if (val <= 0) return
    setIncome(val)
    setEditIncomeOpen(false)
    setEditIncomeValue("")
  }

  const handleReset = async () => { setResetting(true); const { data } = await userApi.walletReset(); if (data) setWallet(data.wallet); setResetting(false) }

  const total = wallet.cashBalance

  // ═══ DISTRIBUCIÓN INTELIGENTE BASADA EN SUELDO REAL ═══
  // Si cashBalance es 0, NO hay dinero para distribuir.
  // Solo se muestra el monto de obligaciones pendientes (lo que debes).
  const realIncome = total
  const realObligations = displayObligationsTotal

  // Calcular distribución real basada en lo que HAY disponible
  const realAllocation = useMemo(() => {
    // Sin saldo real → todo en 0, solo obligaciones muestra lo pendiente
    if (realIncome <= 0) return { obligationsPct: 0, savingsPct: 0, freePct: 0, debtCapPct: 0, obligationsAmount: realObligations, savingsAmount: 0, freeAmount: 0, debtCapAmount: 0, isOverloaded: realObligations > 0, isTight: false }

    const obligPct = Math.min(100, (realObligations / realIncome) * 100)
    const isOverloaded = realObligations >= realIncome
    const isTight = obligPct >= 70
    const remanente = Math.max(0, realIncome - realObligations)

    if (isOverloaded) {
      return { obligationsPct: obligPct, savingsPct: 0, freePct: 0, debtCapPct: 0, obligationsAmount: realObligations, savingsAmount: 0, freeAmount: 0, debtCapAmount: 0, isOverloaded: true, isTight: true }
    }

    // Escala de ahorro según salud
    const remanentePct = (remanente / realIncome) * 100
    const targetSavPct = remanentePct >= 40 ? 20 : remanentePct >= 25 ? 15 : remanentePct >= 15 ? 10 : 5
    const savingsAmount = Math.min((targetSavPct / 100) * realIncome, remanente)
    const savingsPct = (savingsAmount / realIncome) * 100

    const afterSavings = remanente - savingsAmount
    const maxFree = (15 / 100) * realIncome
    const freeAmount = Math.min(afterSavings, maxFree)
    const freePct = (freeAmount / realIncome) * 100
    const debtCapAmount = afterSavings - freeAmount
    const debtCapPct = (debtCapAmount / realIncome) * 100

    return { obligationsPct: obligPct, savingsPct, freePct, debtCapPct, obligationsAmount: realObligations, savingsAmount, freeAmount, debtCapAmount, isOverloaded, isTight }
  }, [realIncome, realObligations])

  const pocketValues: Record<string, number> = {
    ahorro: Math.round(realAllocation.savingsAmount),
    obligaciones: Math.round(realAllocation.obligationsAmount),
    libre: Math.round(realAllocation.freeAmount),
    endeudamiento: Math.round(realAllocation.debtCapAmount),
  }
  const pocketPcts: Record<string, number> = {
    ahorro: Math.round(realAllocation.savingsPct),
    obligaciones: Math.min(100, Math.round(realAllocation.obligationsPct)),
    libre: Math.round(realAllocation.freePct),
    endeudamiento: Math.round(realAllocation.debtCapPct),
  }

  return (
    <div className="space-y-5">
      {/* ═══ SUELDO REAL (centro, grande) ═══ */}
      <Card className="border-none bg-gradient-to-br from-emerald-600 to-kiri-emerald rounded-2xl overflow-hidden shadow-lg">
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Sueldo Real (disponible)</p>
          <CountingAmount value={total > 0 ? total : 0} formatAmount={formatAmount} className="text-4xl font-black text-white block" />
          <p className="text-white/50 text-[9px]">Se actualiza conforme pagues tus obligaciones</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button onClick={() => { setIncomeOpen(true); setTipo("salario"); setMonto(String(periodData.effectiveIncome + extraIncomes.reduce((a, e) => a + e.monto, 0))) }} size="sm"
              className="bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl gap-1.5 h-9 px-4 text-xs">
              <Plus className="h-3.5 w-3.5" /> Ingresar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={resetting || total === 0}
              className="text-white/40 hover:text-white/70 hover:bg-white/10 rounded-xl h-9 px-3 text-xs gap-1">
              <RefreshCw className={cn("h-3 w-3", resetting && "animate-spin")} /> Reiniciar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SUELDO BASE + BALANCE OBLIGACIONES (lado a lado) ═══ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sueldo Base — con botón editar + flecha para frecuencia */}
        <Card className="border-none bg-gray-900 dark:bg-gray-800 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-wider">Sueldo Base del periodo</p>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditIncomeOpen(true); setEditIncomeValue(String(income)) }}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setFrequencyExpanded(v => !v)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors">
                  {frequencyExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <AnimatedAmount value={periodData.effectiveIncome} formatAmount={formatAmount} className="text-xl font-black text-white block mt-1" />
            <p className="text-white/40 text-[8px] mt-0.5">
              {incomeFrequency === "quincenal" ? `Quincenal (De ${formatAmount(income)} al mes)` : "Mensual"}
            </p>
          </CardContent>
        </Card>

        {/* Balance Obligaciones — con flecha desplegable */}
        <Card className="border-none bg-gray-900 dark:bg-gray-800 rounded-2xl cursor-pointer hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
          onClick={() => setObligationsExpanded(v => !v)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-amber-400 text-[9px] font-bold uppercase tracking-wider">Balance obligaciones</p>
              {obligationsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-amber-400/60" /> : <ChevronDown className="h-3.5 w-3.5 text-amber-400/60" />}
            </div>
            <AnimatedAmount value={displayObligationsTotal} formatAmount={formatAmount} className="text-xl font-black text-white block mt-1" />
            <p className="text-amber-400/60 text-[8px] mt-0.5">Pendientes de pago</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ FRECUENCIA (desplegable, conectado al Sueldo Base) ═══ */}
      {frequencyExpanded && (
        <Card data-panel="frequency" className="border-none rounded-2xl animate-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setIncomeFrequency("quincenal")}
                className={cn("h-10 rounded-xl font-bold text-sm transition-colors",
                  incomeFrequency === "quincenal" ? "bg-kiri-emerald text-white" : "border-2 border-muted text-muted-foreground")}>
                Quincenal
              </button>
              <button onClick={() => setIncomeFrequency("mensual")}
                className={cn("h-10 rounded-xl font-bold text-sm transition-colors",
                  incomeFrequency === "mensual" ? "bg-kiri-emerald text-white" : "border-2 border-muted text-muted-foreground")}>
                Mensual
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {incomeFrequency === "quincenal" ? `Quincenal (De ${formatAmount(income)} al mes)` : "Mensual"}
            </p>

            {/* ── Selector de días de pago ── */}
            <div className="border-t border-border/50 pt-3">
              <PaydaySelector compact />
            </div>

            {/* ── Ingresos Extra ── */}
            <div className="border-t border-border/50 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">Ingresos extra</p>
                <button
                  onClick={() => setExtraIncomeFormOpen(!extraIncomeFormOpen)}
                  className="text-[10px] font-bold text-kiri-emerald hover:underline"
                >
                  {extraIncomeFormOpen ? "Cancelar" : "+ Agregar extra"}
                </button>
              </div>

              {extraIncomeFormOpen && (
                <div className="space-y-2 bg-muted/20 rounded-xl p-3">
                  <input
                    placeholder="Nombre (ej: Freelance, Bono)"
                    value={extraName}
                    onChange={e => setExtraName(e.target.value)}
                    className="w-full h-9 rounded-lg bg-background border border-border px-3 text-sm"
                  />
                  <MoneyInput
                    value={extraMonto}
                    onChange={v => setExtraMonto(v)}
                    className="h-9 rounded-lg text-sm"
                    placeholder="Monto"
                  />
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-muted-foreground">¿Cada cuánto recibes esto?</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => setExtraFreq("mensual")}
                        className={cn("h-8 rounded-lg text-[9px] font-bold border transition-colors",
                          extraFreq === "mensual" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground")}>
                        Mensual
                      </button>
                      <button onClick={() => setExtraFreq("quincenal")}
                        className={cn("h-8 rounded-lg text-[9px] font-bold border transition-colors",
                          extraFreq === "quincenal" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground")}>
                        Quincenal
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-muted-foreground">¿Por cuánto tiempo recibirás esto?</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={() => setExtraTemp("una_vez")}
                        className={cn("h-8 rounded-lg text-[9px] font-bold border transition-colors",
                          extraTemp === "una_vez" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground")}>
                        Una vez
                      </button>
                      <button onClick={() => setExtraTemp("definido")}
                        className={cn("h-8 rounded-lg text-[9px] font-bold border transition-colors",
                          extraTemp === "definido" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground")}>
                        Definido
                      </button>
                      <button onClick={() => setExtraTemp("indefinido")}
                        className={cn("h-8 rounded-lg text-[9px] font-bold border transition-colors",
                          extraTemp === "indefinido" ? "bg-kiri-emerald text-white border-kiri-emerald" : "border-muted text-muted-foreground")}>
                        Siempre
                      </button>
                    </div>
                    {extraTemp === "definido" && (
                      <input
                        type="number" min="1" max="60"
                        placeholder="¿Cuántos periodos?"
                        value={extraMeses}
                        onChange={e => setExtraMeses(e.target.value)}
                        className="w-full h-8 rounded-lg bg-background border border-border px-3 text-xs"
                      />
                    )}
                  </div>
                  <button
                    onClick={handleAddExtraIncome}
                    disabled={!extraName || !extraMonto || savingExtra}
                    className="w-full h-9 rounded-lg bg-kiri-emerald text-white font-bold text-xs disabled:opacity-50"
                  >
                    {savingExtra ? "Guardando..." : "Registrar ingreso extra"}
                  </button>
                </div>
              )}

              {/* Lista de extras activos */}
              {extraIncomes.length > 0 && (
                <div className="space-y-1">
                  {extraIncomes.slice(0, 3).map(e => (
                    <div key={e.id} className="flex items-center justify-between text-xs py-1">
                      <span className="text-muted-foreground truncate flex-1">{e.nombre}</span>
                      <span className="font-bold shrink-0 ml-2">{formatAmount(e.monto)}</span>
                      <span className="text-[8px] text-muted-foreground ml-1.5 shrink-0">
                        {e.temporalidad === "una_vez" ? "1×" : e.temporalidad === "definido" ? `${e.mesesRestantes}p` : "∞"}
                      </span>
                    </div>
                  ))}
                  {extraIncomes.length > 3 && (
                    <p className="text-[8px] text-muted-foreground text-center">+{extraIncomes.length - 3} más</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ OBLIGACIONES (desplegable, conectado al Balance) ═══ */}
      {obligationsExpanded && (
        <Card data-panel="obligations" className="border-none rounded-2xl animate-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-sm">
              Obligaciones del período actual
              <span className="text-muted-foreground font-normal text-xs ml-1">({periodRange})</span>
            </h3>
            {incomeFrequency === "quincenal" && (
              <p className="text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
                💡 Las obligaciones con frecuencia <span className="font-bold">quincenal</span> se dividen entre las 2 quincenas.
                Solo se muestra la mitad correspondiente a este periodo.
              </p>
            )}
            {periodDebts.length === 0 && periodFixed.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">🎉 No tienes obligaciones pendientes</p>
            ) : (
              <div className="divide-y divide-border/50">
                {periodDebts.map(d => (
                  <ObligationRow key={d.id} name={d.nombre} day={d.diasPago}
                    amount={getDisplayAmount(d)} fullAmount={d.cuotaPeriodo}
                    isQuincenal={d.frecuenciaPago === "quincenal"}
                    paid={d.pagadoEstePeriodo} formatAmount={formatAmount} />
                ))}
                {periodFixed.map(f => (
                  <ObligationRow key={f.id} name={f.nombre} day={f.fechaCorte}
                    amount={getDisplayAmount(f)} fullAmount={f.monto}
                    isQuincenal={f.frecuencia === "quincenal"}
                    paid={f.pagadoEstePeriodo} formatAmount={formatAmount} />
                ))}
              </div>
            )}
            <Link href="/obligaciones" className="block text-center text-kiri-emerald font-bold text-xs hover:underline">
              Ver todas las obligaciones
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ═══ PRÓXIMO PERIODO (congelado) ═══ */}
      {incomeFrequency === "quincenal" && nextPeriodLabel && (
        <Card className="border-none bg-muted/30 rounded-2xl opacity-80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-muted-foreground">Próximo período ({nextPeriodLabel})</h3>
              <p className="text-[10px] text-muted-foreground">Congeladas hasta el inicio del periodo</p>
              {nextPeriodObligations.total > 0 && <p className="text-xs font-bold text-muted-foreground mt-1">{formatAmount(nextPeriodObligations.total)}</p>}
            </div>
            <Lock className="h-6 w-6 text-muted-foreground/50" />
          </CardContent>
        </Card>
      )}

      {/* ═══ BOLSILLOS PRESUPUESTO ═══ */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold flex items-center gap-2">Tu presupuesto 💰</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {POCKETS.map(pocket => <PocketCard key={pocket.key} pocket={pocket} amount={pocketValues[pocket.key]} pct={pocketPcts[pocket.key]} formatAmount={formatAmount} />)}
      </div>

      {/* ── Análisis inteligente del presupuesto ── */}
      <Card className={cn("border-none rounded-2xl",
        realAllocation.isOverloaded ? "bg-red-50 dark:bg-red-950/20"
          : realAllocation.isTight ? "bg-amber-50 dark:bg-amber-950/20"
          : total <= 0 && displayObligationsTotal > 0 ? "bg-amber-50 dark:bg-amber-950/20"
          : "bg-emerald-50 dark:bg-emerald-950/20"
      )}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">
              {realAllocation.isOverloaded ? "🚨" : realAllocation.isTight ? "⚠️" : total <= 0 && displayObligationsTotal > 0 ? "💡" : "🌱"}
            </span>
            <div className="flex-1">
              <p className={cn("font-bold text-sm",
                realAllocation.isOverloaded ? "text-red-700 dark:text-red-300"
                  : realAllocation.isTight ? "text-amber-700 dark:text-amber-300"
                  : "text-emerald-700 dark:text-emerald-300"
              )}>
                {realAllocation.isOverloaded
                  ? "Tus obligaciones superan tu saldo disponible"
                  : realAllocation.isTight
                    ? "Tu presupuesto está ajustado"
                    : total <= 0 && displayObligationsTotal > 0
                      ? "Registra tu ingreso para distribuir tu presupuesto"
                      : total > 0 && displayObligationsTotal === 0
                        ? "¡Todas tus obligaciones están al día! 🎉"
                        : "¡Tu presupuesto está equilibrado!"
                }
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {realAllocation.isOverloaded
                  ? `Tienes ${formatAmount(displayObligationsTotal)} en obligaciones pero solo ${formatAmount(total)} disponibles. Considera usar la estrategia Bola de Nieve o renegociar tus deudas.`
                  : realAllocation.isTight
                    ? `El ${Math.round(realAllocation.obligationsPct)}% de tu saldo va a obligaciones. Intenta reducir gastos fijos o generar un ingreso extra para tener más margen.`
                    : total <= 0 && displayObligationsTotal > 0
                      ? `Tienes ${formatAmount(displayObligationsTotal)} en obligaciones pendientes. Registra tu ingreso para ver cómo se distribuye tu dinero.`
                      : total > 0 && realAllocation.savingsAmount > 0
                        ? `Puedes destinar ${formatAmount(Math.round(realAllocation.savingsAmount))} al ahorro (${Math.round(realAllocation.savingsPct)}%) y ${formatAmount(Math.round(realAllocation.freeAmount))} a gastos libres este periodo.`
                        : "Estás distribuyendo tu dinero de forma inteligente."
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ MODAL REGISTRAR INGRESO ═══ */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent className="sm:max-w-lg lg:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-kiri-emerald" /> Registrar Ingreso</DialogTitle>
            <DialogDescription>Se distribuirá en tus 4 bolsillos según tu distribución inteligente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setTipo("salario"); setMonto(String(periodData.effectiveIncome)) }} className={cn("flex items-center justify-center gap-2 h-11 rounded-xl border-2 font-bold text-sm transition-colors",
                  tipo === "salario" ? "border-kiri-emerald bg-kiri-emerald/5 text-kiri-emerald" : "border-muted text-muted-foreground")}>
                  <Wallet className="h-4 w-4" /> Sueldo
                </button>
                <button onClick={() => { setTipo("extra"); setMonto("") }} className={cn("flex items-center justify-center gap-2 h-11 rounded-xl border-2 font-bold text-sm transition-colors",
                  tipo === "extra" ? "border-kiri-emerald bg-kiri-emerald/5 text-kiri-emerald" : "border-muted text-muted-foreground")}>
                  <Zap className="h-4 w-4" /> Extra
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monto recibido</Label>
              <MoneyInput value={monto} onChange={setMonto} className="h-14 text-2xl font-bold bg-muted/30 border-none rounded-2xl" placeholder="0" autoFocus />
              {tipo === "salario" && periodData.effectiveIncome > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Sugerido: {formatAmount(periodData.effectiveIncome + extraIncomes.reduce((a, e) => a + e.monto, 0))} (sueldo base{extraIncomes.length > 0 ? " + extras" : ""} del periodo)
                </p>
              )}
            </div>
            {tipo === "extra" && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">¿Qué es?</Label>
                <Input value={extraDesc} onChange={e => setExtraDesc(e.target.value)} placeholder="Ej: Freelance, venta, regalo..." className="rounded-xl" />
              </div>
            )}
            {tipo === "salario" && incomeFrequency === "quincenal" && (
              <div className="flex items-center gap-2 bg-kiri-mint/30 rounded-xl px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-kiri-emerald shrink-0" />
                <p className="text-xs text-kiri-forest font-medium">
                  Ingreso asignado a <span className="font-bold">Quincena {periodNum}</span> ({periodRange})
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setIncomeOpen(false); setMonto(""); setExtraDesc("") }}>Cancelar</Button>
            <Button onClick={handleRegisterIncome} disabled={saving || !monto || Number(monto) <= 0}
              className={cn("font-bold rounded-xl px-6", tipo === "salario" ? "bg-kiri-emerald text-white" : "bg-cyclon-lavender text-white")}>
              {saving ? "Distribuyendo..." : tipo === "salario" ? "Sí, registrar mi Sueldo Base" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ MODAL EDITAR SUELDO BASE ═══ */}
      <Dialog open={editIncomeOpen} onOpenChange={setEditIncomeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-kiri-emerald" /> Editar Sueldo Base</DialogTitle>
            <DialogDescription>Este es tu ingreso mensual fijo. Si eres quincenal, se dividirá automáticamente entre las 2 quincenas para calcular el sueldo del periodo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ingreso mensual total</Label>
              <MoneyInput value={editIncomeValue} onChange={setEditIncomeValue} className="h-14 text-2xl font-bold bg-muted/30 border-none rounded-2xl" placeholder="0" autoFocus />
            </div>
            {incomeFrequency === "quincenal" && Number(editIncomeValue) > 0 && (
              <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs text-muted-foreground">Así se distribuirá:</p>
                <div className="flex justify-between text-sm">
                  <span>Quincena 1:</span>
                  <span className="font-bold">{formatAmount(Math.round(Number(editIncomeValue) / 2))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Quincena 2:</span>
                  <span className="font-bold">{formatAmount(Math.round(Number(editIncomeValue) / 2))}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditIncomeOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditIncome} disabled={!editIncomeValue || Number(editIncomeValue) <= 0}
              className="bg-kiri-emerald text-white font-bold rounded-xl px-6">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecommendationModal type={recommendationType} open={recommendationOpen} onClose={() => { setRecommendationOpen(false); setRecommendationType(null) }} formatAmount={formatAmount} />
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function ObligationRow({ name, day, amount, fullAmount, isQuincenal, paid, formatAmount }: {
  name: string; day: string; amount: number; fullAmount: number; isQuincenal: boolean; paid: boolean; formatAmount: (n: number) => string
}) {
  let dayLabel = day
  if (day.includes("-")) { dayLabel = day.split("-").pop() || day }
  return (
    <div className="flex items-center justify-between py-2.5 gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{name}</span>
        {isQuincenal && (
          <span className="text-[9px] text-muted-foreground">Quincenal · Total: {formatAmount(fullAmount)}</span>
        )}
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-[10px] text-muted-foreground">Día {dayLabel}</span>
        <span className="text-sm font-bold">{formatAmount(amount)}</span>
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
          paid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        )}>{paid ? "Pagado" : "Pendiente"}</span>
      </div>
    </div>
  )
}

function PocketCard({ pocket, amount, pct, formatAmount }: { pocket: typeof POCKETS[number]; amount: number; pct: number; formatAmount: (n: number) => string }) {
  const radius = 22; const circ = 2 * Math.PI * radius; const offset = circ - (pct / 100) * circ
  return (
    <Card className={cn("border-none rounded-2xl overflow-hidden shadow-sm", pocket.bg)}>
      <CardContent className="p-3.5 space-y-1.5 relative min-h-[130px]">
        <div className="absolute top-2 right-2 text-xl opacity-70 pointer-events-none">{pocket.illustration}</div>
        <h3 className="font-bold text-xs">{pocket.title} {pocket.emoji}</h3>
        <AnimatedAmount value={amount} formatAmount={formatAmount} className="text-lg font-black block" />
        <div className="flex items-center justify-between">
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", pocket.badgeBg)}>{pct}%</span>
          <div className="relative h-10 w-10">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="4" className={pocket.ringBg} />
              <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="4" className={pocket.ringStroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center"><span className="text-[8px] font-black">{pct}%</span></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
