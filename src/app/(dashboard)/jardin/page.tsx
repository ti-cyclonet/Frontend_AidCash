"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Wallet, Heart, TrendingUp, TrendingDown, Sparkles,
  Flame, PiggyBank, ShieldCheck, ChevronRight,
  Droplets, Lock, Check, Gift, Lightbulb,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useStreaks } from "@/hooks/use-streaks"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { userApi, WalletState } from "@/lib/api-client"
import { WelcomeOnboarding } from "@/components/gestion/WelcomeOnboarding"
import { getNextPaymentInfo } from "@/lib/payment-schedule"
import { calculateGardenXP } from "@/lib/garden-xp"
import { useBudgetCategories } from "@/hooks/use-budget-categories"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"
import type { Debt, FixedExpense } from "@/lib/types"

// ─── Niveles del jardín ───────────────────────────────────────────────────────

interface GardenLevel {
  level: number
  name: string
  image: string
  xpRequired: number
}

const GARDEN_LEVELS: GardenLevel[] = [
  { level: 1, name: "Semilla",             image: "/garden/tierra.png",          xpRequired: 0 },
  { level: 2, name: "Brote",               image: "/garden/brote.png",           xpRequired: 750 },
  { level: 3, name: "Planta joven",        image: "/garden/arbol_pequeno.png",   xpRequired: 1500 },
  { level: 4, name: "Árbol en crecimiento", image: "/garden/arbol_mediano.png",  xpRequired: 3000 },
  { level: 5, name: "Árbol floreciente",   image: "/garden/arbol_grande.png",    xpRequired: 5000 },
  { level: 6, name: "Jardín próspero",     image: "/garden/arbol_flores.png",    xpRequired: 8000 },
]

function getGardenHealth(
  streak: number,
  hasIncome: boolean,
  totalAhorrado: number,
  totalDeuda: number,
  hasObligations: boolean,
  hasBudgetCategories: boolean,
): number {
  /**
   * Salud del jardín: 0–100%
   * Se calcula sumando puntos por cada hábito positivo:
   *
   * - Registrar ingreso (sueldo real): +15
   * - Tener racha activa: +5 por cada periodo (max +20)
   * - Tener ahorro > 0: +15
   * - No tener deudas: +15 (o +5 si tiene pero está pagando)
   * - Tener presupuesto por categorías: +10
   * - Tener obligaciones registradas: +10
   * - Base: +15 (todos empiezan con algo de vida)
   *
   * Total posible: 100
   */
  let health = 15 // Base: el jardín siempre tiene algo de vida

  // +15 por registrar ingreso
  if (hasIncome) health += 15

  // +5 por cada periodo de racha (max 20)
  health += Math.min(streak * 5, 20)

  // +15 por tener ahorros
  if (totalAhorrado > 0) health += 15

  // +15 si no tiene deudas, +5 si tiene pero está activamente pagando
  if (totalDeuda <= 0) {
    health += 15
  } else if (streak > 0) {
    health += 5 // Tiene deuda pero está pagando (racha activa)
  }

  // +10 por tener categorías de presupuesto configuradas
  if (hasBudgetCategories) health += 10

  // +10 por tener obligaciones registradas (demuestra control)
  if (hasObligations) health += 10

  return Math.max(0, Math.min(100, health))
}

function getHealthLabel(h: number): string {
  if (h >= 85) return "Floreciendo"
  if (h >= 65) return "Creciendo"
  if (h >= 40) return "Estable"
  return "Necesita atención"
}

function getHealthEmoji(h: number): string {
  if (h >= 85) return "🌳"
  if (h >= 65) return "🌿"
  if (h >= 40) return "🌱"
  return "🍂"
}

/**
 * Genera una recomendación contextual basada en lo que le falta al usuario.
 * Prioriza la acción más impactante que puede tomar ahora mismo.
 */
function getGardenRecommendation(
  hasIncome: boolean,
  totalAhorrado: number,
  totalDeuda: number,
  hasObligations: boolean,
  hasBudgetCategories: boolean,
  streak: number,
): string {
  if (!hasIncome) return "Registra tu sueldo real en Gestión → Billetera. Es el primer paso para que tu jardín crezca."
  if (!hasObligations && !hasBudgetCategories) return "Registra tus obligaciones y crea tu presupuesto para tener el control total."
  if (!hasBudgetCategories) return "Crea categorías de presupuesto en Gestión para saber exactamente a dónde va tu dinero."
  if (!hasObligations) return "Registra tus deudas y gastos fijos en Obligaciones para visualizar tu balance real."
  if (totalAhorrado <= 0) return "¡Es momento de ahorrar! Ve a Ahorro y crea tu primer bolsillo. Cada peso cuenta."
  if (totalDeuda > 0 && streak < 3) return "Mantén tu racha pagando a tiempo. Cada periodo consistente fortalece tu jardín."
  if (streak < 6) return "Sigue así, tu constancia está dando frutos. Cada periodo suma XP a tu jardín."
  return "Excelente trabajo. Tu jardín florece gracias a tus decisiones financieras inteligentes."
}

/**
 * ¿Hay una deuda o gasto fijo sin pagar que vence en los próximos 3 días (o ya
 * vencido)? Reutiliza el mismo cálculo de "próxima fecha de pago" que ya usa
 * Obligaciones (payment-schedule.ts), así que ambas pantallas quedan consistentes.
 */
function hasUpcomingUnpaidObligation(debts: Debt[], fixedExpenses: FixedExpense[]): boolean {
  const dueSoon = (diasPago: string, pagadoEstePeriodo: boolean) => {
    if (pagadoEstePeriodo) return false
    const { status } = getNextPaymentInfo(diasPago, pagadoEstePeriodo)
    return status === "proximo" || status === "vencido"
  }
  return debts.some((d) => d.estado === "activa" && dueSoon(d.diasPago, d.pagadoEstePeriodo)) ||
    fixedExpenses.some((f) => dueSoon(f.fechaCorte, f.pagadoEstePeriodo))
}

/**
 * Clima financiero del jardín — capa puramente visual (sol/lluvia/nubes) que se
 * superpone al árbol sin tocar tu imagen. Ligado a eventos reales, no es un
 * estado fijo:
 * - Nubes: hay una obligación sin pagar que vence en ≤3 días (o vencida). Gana
 *   siempre, es la señal más urgente. Desaparecen solas en cuanto se paga.
 * - Lluvia: acabas de registrar un ahorro — dura unos segundos (showRainCelebration)
 *   y para sola, no se queda lloviendo para siempre.
 * - Sol: estado neutro, todo en orden.
 */
function getGardenWeather(hasUpcomingObligation: boolean, showRainCelebration: boolean): "sol" | "lluvia" | "nubes" {
  if (hasUpcomingObligation) return "nubes"
  if (showRainCelebration) return "lluvia"
  return "sol"
}

const WEATHER_META: Record<"sol" | "lluvia" | "nubes", { icon: string; label: string }> = {
  sol: { icon: "☀️", label: "Todo en orden" },
  lluvia: { icon: "🌧️", label: "¡Buen ahorro!" },
  nubes: { icon: "☁️", label: "Pago próximo" },
}

/**
 * Filtro CSS según salud del jardín. No usa hue-rotate a propósito: funciona
 * igual de bien sobre follaje verde que sobre la imagen de tierra/semilla del
 * nivel 1, sin riesgo de desfasar el color hacia tonos raros.
 * Incluye el drop-shadow existente para no pisar el filtro que ya tenías en
 * className (dos "filter" — uno por clase de Tailwind y otro por style inline—
 * no conviven: el inline gana y borra el otro).
 */
function moodFilter(health: number): string {
  const sat = (0.5 + (health / 100) * 0.8).toFixed(2)
  const bright = (0.85 + (health / 100) * 0.25).toFixed(2)
  const gray = health < 35 ? 0.25 : 0
  return `grayscale(${gray}) saturate(${sat}) brightness(${bright}) drop-shadow(0 0 40px rgba(16,185,129,0.15))`
}

// Frases cortas de "personalidad" — no reemplazan tu gardenRecommendation
// (esa sigue siendo la instrucción accionable); esto es solo tono/carácter.
const GARDEN_PHRASES: Record<string, string[]> = {
  "Floreciendo": ["¡Hoy me siento espectacular! 🌳", "Gracias por cuidarme tan bien", "Este es tu mejor periodo hasta ahora"],
  "Creciendo": ["Vamos bien, sigue así 🌿", "Un gasto hormiga menos hoy = más crecimiento", "Me gusta cómo vas esta semana"],
  "Estable": ["Podemos llegar más lejos juntos 🌱", "Un pequeño ahorro hoy ayuda bastante", "Sigamos construyendo el hábito"],
  "Necesita atención": ["Hace días que no me visitas... 🥺", "Necesito que registres algo hoy", "Mis hojas se sienten un poco tristes"],
}

function useCyclePhrase(list: string[], intervalMs = 4500): string {
  const [i, setI] = useState(0)
  useEffect(() => {
    setI(0)
    if (list.length <= 1) return
    const t = setInterval(() => setI((v) => (v + 1) % list.length), intervalMs)
    return () => clearInterval(t)
  }, [list, intervalMs])
  return list[i] ?? ""
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function JardinPage() {
  const router = useRouter()
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("jardin")
  const { formatAmount, incomeFrequency, user, onboardingDone } = useAppContext()
  const { debts, fixedExpenses, totalAhorrado, loading: financeLoading } = useFinanceData()
  const { streakActual, badgesDesbloqueados, xpFromMissions, loading: streakLoading } = useStreaks(incomeFrequency)
  const { allocation } = usePeriodBudget()
  const { budgetCategories } = useBudgetCategories()

  // ── Welcome onboarding ──
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem('kiri_welcome_seen')
  })
  const handleWelcomeComplete = () => {
    setShowWelcome(false)
    localStorage.setItem('kiri_welcome_seen', 'true')
  }

  const [wallet, setWallet] = useState<WalletState>({
    cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0,
  })
  useEffect(() => {
    userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) })
    const refresh = () => userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) })
    window.addEventListener("kiri:wallet-updated", refresh)
    return () => window.removeEventListener("kiri:wallet-updated", refresh)
  }, [])

  // ── Feedback del botón "Regar jardín" (splash + XP flotante antes de navegar) ──
  const [watering, setWatering] = useState(false)
  const handleWaterClick = () => {
    setWatering(true)
    setTimeout(() => {
      setWatering(false)
      router.push("/ahorro")
    }, 600)
  }

  // ── XP y nivel actual ─────────────────────────────────────────────────────
  // Mientras streakLoading es true, streakActual/xpFromMissions todavía valen 0
  // (estado inicial antes de que responda la API) — eso calculaba nivel 1
  // (Semilla) por un instante y se veía un parpadeo semilla→árbol real en cada
  // refresh. dataReady evita mostrar el árbol hasta tener el nivel real.
  const dataReady = !streakLoading && !financeLoading
  const currentXP = calculateGardenXP(streakActual, badgesDesbloqueados.length, xpFromMissions)
  const currentLevelIdx = GARDEN_LEVELS.findIndex((l, i) =>
    i === GARDEN_LEVELS.length - 1 || currentXP < GARDEN_LEVELS[i + 1].xpRequired
  )
  const currentLevel = GARDEN_LEVELS[currentLevelIdx]
  const nextLevel = GARDEN_LEVELS[currentLevelIdx + 1]

  // ── Detección de level-up (aura dorada) ───────────────────────────────────
  const [showLevelUpGlow, setShowLevelUpGlow] = useState(false)
  useEffect(() => {
    const LS_KEY = "kiri_garden_last_level"
    const savedLevel = parseInt(localStorage.getItem(LS_KEY) ?? "0", 10)
    if (savedLevel > 0 && currentLevelIdx > savedLevel - 1) {
      // ¡Subió de nivel! Mostrar aura dorada
      setShowLevelUpGlow(true)
      // Auto-ocultar después de 8 segundos
      const timer = setTimeout(() => setShowLevelUpGlow(false), 8000)
      localStorage.setItem(LS_KEY, String(currentLevelIdx + 1))
      return () => clearTimeout(timer)
    }
    // Guardar nivel actual si es la primera vez
    if (savedLevel === 0 || savedLevel !== currentLevelIdx + 1) {
      localStorage.setItem(LS_KEY, String(currentLevelIdx + 1))
    }
  }, [currentLevelIdx])
  const xpForNext = nextLevel?.xpRequired ?? currentLevel.xpRequired
  const xpProgress = xpForNext > 0 ? Math.min(100, Math.round((currentXP / xpForNext) * 100)) : 100
  const xpNeeded = Math.max(0, xpForNext - currentXP)

  // ── Lluvia por ahorro reciente (mismo patrón que el aura de level-up: se
  //    detecta el aumento comparando contra localStorage y se auto-oculta).
  //    Mientras financeLoading es true, totalAhorrado todavía vale 0 (estado
  //    inicial antes de que responda la API) — comparar en ese momento hacía
  //    parecer un "aumento" en cada refresh y disparaba lluvia siempre. ──
  const [showRainCelebration, setShowRainCelebration] = useState(false)
  useEffect(() => {
    if (financeLoading) return
    const LS_KEY = "kiri_garden_last_ahorro"
    const savedAhorro = parseFloat(localStorage.getItem(LS_KEY) ?? "0")
    if (totalAhorrado > savedAhorro) {
      setShowRainCelebration(true)
      const timer = setTimeout(() => setShowRainCelebration(false), 8000)
      localStorage.setItem(LS_KEY, String(totalAhorrado))
      return () => clearTimeout(timer)
    }
    if (savedAhorro !== totalAhorrado) {
      localStorage.setItem(LS_KEY, String(totalAhorrado))
    }
  }, [totalAhorrado, financeLoading])

  // ── Métricas del jardín ───────────────────────────────────────────────────
  const totalDeuda = debts.reduce((a, d) => a + Number(d.saldoRestante ?? d.montoTotal), 0)

  // Verificar si tiene categorías de presupuesto configuradas
  const hasBudgetCategories = budgetCategories.length > 0

  const gardenHealth = getGardenHealth(
    streakActual,
    wallet.cashBalance > 0,
    totalAhorrado,
    totalDeuda,
    debts.length > 0,
    hasBudgetCategories,
  )

  const gardenRecommendation = getGardenRecommendation(
    wallet.cashBalance > 0,
    totalAhorrado,
    totalDeuda,
    debts.length > 0,
    hasBudgetCategories,
    streakActual,
  )

  // Clima financiero (sol / lluvia / nubes) — ver getGardenWeather: nubes cuando hay
  // una obligación por vencer en ≤3 días, lluvia unos segundos tras ahorrar, si no, sol.
  const gardenWeather = getGardenWeather(
    hasUpcomingUnpaidObligation(debts, fixedExpenses),
    showRainCelebration,
  )

  // Libertad financiera
  const freedomPct = totalDeuda > 0
    ? Math.min(100, Math.round((totalAhorrado / (totalAhorrado + totalDeuda)) * 100))
    : totalAhorrado > 0 ? 100 : 0

  // Progreso por métrica (para barras)
  // Sueldo: si tiene ingreso registrado, barra al 100%; si no, 0%
  const salaryCoverage = wallet.cashBalance > 0 ? 100 : 0
  // Ahorro: porcentaje de la meta global o relativo al ingreso
  const savingsPct = (() => {
    if (totalAhorrado <= 0) return 0
    // Si hay bolsillos con meta, usar progreso del más alto
    try {
      const pockets = JSON.parse(localStorage.getItem("kiri_saving_pockets") ?? "[]")
      const withMeta = pockets.filter((p: any) => p.meta > 0)
      if (withMeta.length > 0) {
        const totalMeta = withMeta.reduce((a: number, p: any) => a + p.meta, 0)
        return Math.min(100, Math.round((totalAhorrado / totalMeta) * 100))
      }
    } catch { /* ignore */ }
    return Math.min(100, Math.round((totalAhorrado / Math.max(totalAhorrado, 1000000)) * 100))
  })()
  // Deuda: porcentaje pagado (inverso - cuánto falta)
  const debtPct = (() => {
    if (debts.length === 0) return 0
    const totalOriginal = debts.reduce((a, d) => a + Number(d.montoTotal), 0)
    if (totalOriginal <= 0) return 0
    return Math.min(100, Math.round((totalDeuda / totalOriginal) * 100))
  })()

  // Consejo diario
  const tips = [
    "Registra tu sueldo real cada vez que lo recibas. Es la base para tomar mejores decisiones. 🌱",
    "Pequeñas decisiones hoy, grandes logros mañana. Tu jardín lo agradece. 🌿",
    "Cada peso que ahorras es una semilla para tu futuro. 🌳",
    "Tu árbol crece con cada buena decisión financiera. ¡No pares! 💚",
  ]
  const dailyTip = tips[new Date().getDate() % tips.length]

  return (
    <>
      {showTutorial && <TutorialSlider module="jardin" onClose={dismissTutorial} />}
    <div className="space-y-5 pb-8">

      {/* ═══ WELCOME ONBOARDING ═══ */}
      {showWelcome && onboardingDone && (
        <WelcomeOnboarding onComplete={handleWelcomeComplete} />
      )}

      {/* ═══ HEADER ═══ */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            🌿 Tu jardín financiero
          </p>
          <h1 className="text-xl font-black mt-0.5">
            ¡Hola, {user.nombre?.split(" ")[0] || "Usuario"}! 👋
          </h1>
          <p className="text-muted-foreground text-xs">
            Así va tu jardín financiero hoy, {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 sm:flex-none items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2">
            <span className="text-base leading-none shrink-0">{WEATHER_META[gardenWeather].icon}</span>
            <div className="text-right min-w-0">
              <p className="text-[8px] text-muted-foreground whitespace-nowrap">Clima financiero</p>
              <p className="text-[11px] font-black whitespace-nowrap">{WEATHER_META[gardenWeather].label}</p>
            </div>
          </div>
          <div className="flex flex-1 sm:flex-none items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2">
            <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
            <div className="text-right min-w-0">
              <p className="text-[8px] text-muted-foreground whitespace-nowrap">Racha actual</p>
              <p className="text-sm font-black text-orange-600 dark:text-orange-400 whitespace-nowrap">{streakActual} días</p>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ JARDÍN PRINCIPAL ═══ */}
      <Card className="border-none shadow-xl rounded-3xl overflow-hidden relative">
        <CardContent className="p-5 lg:p-6 relative">

          {/* ── Mobile: Estado (ancho completo) + Árbol centrado abajo ── */}
          <div className="lg:hidden">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                {getHealthLabel(gardenHealth)} {getHealthEmoji(gardenHealth)}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {gardenRecommendation}
              </p>
            </div>
            <div className="flex justify-center mt-2">
              {dataReady ? (
                <GardenTreeVisual
                  currentLevelIdx={currentLevelIdx}
                  currentLevel={currentLevel}
                  gardenHealth={gardenHealth}
                  gardenWeather={gardenWeather}
                  streakActual={streakActual}
                  showLevelUpGlow={showLevelUpGlow}
                  healthLabel={getHealthLabel(gardenHealth)}
                  sizeClass="w-[220px] h-[220px]"
                />
              ) : (
                <div className="w-[220px] h-[220px] rounded-full bg-muted/30 animate-pulse" />
              )}
            </div>
          </div>

          {/* ── Mobile: Salud del jardín ── */}
          <div className="lg:hidden mt-4">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold">Salud del jardín</span>
              </div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">♥ {gardenHealth}%</p>
              <Progress value={gardenHealth} className="h-1.5" indicatorClassName="bg-emerald-500" />
              <p className="text-[8px] text-muted-foreground">
                Sigue así para alcanzar tu máximo potencial financiero.
              </p>
            </div>
          </div>

          {/* ── Mobile: Botón regar ── */}
          <div className="lg:hidden mt-4 relative inline-block w-full">
            <Button
              onClick={handleWaterClick}
              className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-2xl gap-2 h-12 font-bold"
            >
              <Droplets className="h-5 w-5" /> Regar jardín
              <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full">+10 XP</span>
            </Button>
            {watering && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none">
                <span className="block text-xs font-bold text-emerald-700 dark:text-emerald-300" style={{ animation: "kiriFloatUp .6s ease-out forwards" }}>
                  +10 XP 💧
                </span>
              </div>
            )}
          </div>

          {/* ── Desktop: Layout 3 columnas ── */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">

            {/* ── Izquierda: Estado + Salud + Regar ── */}
            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  {getHealthLabel(gardenHealth)} {getHealthEmoji(gardenHealth)}
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[280px]">
                  {gardenRecommendation}
                </p>
              </div>

              {/* Salud del jardín */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-2 max-w-[240px]">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-bold">Salud del jardín</span>
                </div>
                <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">♥ {gardenHealth}%</p>
                <Progress value={gardenHealth} className="h-2" indicatorClassName="bg-emerald-500" />
                <p className="text-[9px] text-muted-foreground">
                  Sigue así para alcanzar tu máximo potencial financiero.
                </p>
              </div>

              {/* Botón regar */}
              <div className="relative inline-block">
                <Button
                  onClick={handleWaterClick}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-2xl gap-2 h-12 px-5 font-bold"
                >
                  <Droplets className="h-5 w-5" /> Regar jardín
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full">+10 XP</span>
                </Button>
                {watering && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none">
                    <span className="block text-xs font-bold text-emerald-700 dark:text-emerald-300" style={{ animation: "kiriFloatUp .6s ease-out forwards" }}>
                      +10 XP 💧
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Centro: Árbol ── */}
            <div className="flex justify-center">
              {dataReady ? (
                <GardenTreeVisual
                  currentLevelIdx={currentLevelIdx}
                  currentLevel={currentLevel}
                  gardenHealth={gardenHealth}
                  gardenWeather={gardenWeather}
                  streakActual={streakActual}
                  showLevelUpGlow={showLevelUpGlow}
                  healthLabel={getHealthLabel(gardenHealth)}
                  sizeClass="w-[200px] h-[220px] lg:w-[260px] lg:h-[280px]"
                />
              ) : (
                <div className="w-[200px] h-[220px] lg:w-[260px] lg:h-[280px] rounded-full bg-muted/30 animate-pulse" />
              )}
            </div>

            {/* ── Derecha: Progreso general (desktop) ── */}
            <div className="hidden lg:block bg-card border border-border rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                Tu progreso general <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </h3>
              <div className="space-y-3">
                {/* Sueldo real */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs">Sueldo real disponible</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{salaryCoverage}%</span>
                  </div>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatAmount(wallet.cashBalance)}</p>
                  <Progress value={salaryCoverage} className="h-1.5" indicatorClassName="bg-emerald-500" />
                </div>
                {/* Ahorros */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs">Ahorros totales</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{savingsPct}%</span>
                  </div>
                  <p className="text-sm font-black text-blue-600 dark:text-blue-400">{formatAmount(totalAhorrado)}</p>
                  <Progress value={savingsPct} className="h-1.5" indicatorClassName="bg-blue-500" />
                </div>
                {/* Deudas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="text-xs">Deudas totales</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{debtPct}%</span>
                  </div>
                  <p className="text-sm font-black text-red-600 dark:text-red-400">{formatAmount(totalDeuda)}</p>
                  <Progress value={debtPct} className="h-1.5" indicatorClassName="bg-red-500" />
                </div>
                {/* Libertad financiera */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs">Libertad financiera</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{freedomPct}%</span>
                  </div>
                  <p className="text-sm font-black text-purple-600 dark:text-purple-400">{freedomPct}%</p>
                  <Progress value={freedomPct} className="h-1.5" indicatorClassName="bg-purple-500" />
                </div>
              </div>
              <Link href="/balance" className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground pt-1 border-t border-border/50">
                Ver detalle completo <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Mobile: Tu progreso general (card separada debajo) ── */}
      <Card className="lg:hidden border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            Tu progreso general <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs">Sueldo real disponible</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{salaryCoverage}%</span>
              </div>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatAmount(wallet.cashBalance)}</p>
              <Progress value={salaryCoverage} className="h-1.5" indicatorClassName="bg-emerald-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs">Ahorros totales</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{savingsPct}%</span>
              </div>
              <p className="text-sm font-black text-blue-600 dark:text-blue-400">{formatAmount(totalAhorrado)}</p>
              <Progress value={savingsPct} className="h-1.5" indicatorClassName="bg-blue-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs">Deudas totales</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{debtPct}%</span>
              </div>
              <p className="text-sm font-black text-red-600 dark:text-red-400">{formatAmount(totalDeuda)}</p>
              <Progress value={debtPct} className="h-1.5" indicatorClassName="bg-red-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs">Libertad financiera</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{freedomPct}%</span>
              </div>
              <p className="text-sm font-black text-purple-600 dark:text-purple-400">{freedomPct}%</p>
              <Progress value={freedomPct} className="h-1.5" indicatorClassName="bg-purple-500" />
            </div>
          </div>
          <Link href="/balance" className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground pt-1 border-t border-border/50">
            Ver detalle completo <ChevronRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      {/* ═══ XP + RECOMPENSAS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        {/* XP Bar */}
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Próximo hito: Nivel {currentLevel.level + 1}</p>
                <span className="text-xs text-muted-foreground">{currentXP} / {xpForNext} XP</span>
              </div>
              <Progress value={xpProgress} className="h-2" indicatorClassName="bg-amber-400" />
              <p className="text-[9px] text-muted-foreground">
                Te faltan {xpNeeded} XP para desbloquear nuevas recompensas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recompensas */}
        <Link href="/misiones">
          <Card className="border-none bg-card shadow-sm rounded-2xl hover:bg-muted/30 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Gift className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold">Misiones</p>
                <p className="text-[10px] text-muted-foreground">Recompensas y cofre sorpresa</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ═══ ASÍ CRECE TU JARDÍN — Timeline de niveles ═══ */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              🌿 Así crece tu jardín
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Cada paso cuenta. Tú decides hasta dónde puede llegar.
            </p>
          </div>

          {/* Niveles grid */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {GARDEN_LEVELS.map((level, i) => {
              const isCompleted = currentXP >= level.xpRequired && i < currentLevelIdx
              const isCurrent = i === currentLevelIdx
              const isNext = i === currentLevelIdx + 1
              const isLocked = i > currentLevelIdx + 1

              return (
                <div key={level.level} className="flex flex-col items-center gap-2">
                  {/* Imagen */}
                  <div className={cn(
                    "relative h-16 w-16 rounded-xl flex items-center justify-center overflow-hidden",
                    isCurrent && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background",
                    (isNext || isLocked) && "opacity-40 grayscale",
                  )}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={level.image} alt={level.name} className="h-14 w-14 object-contain" />
                  </div>
                  {/* Conectores */}
                  {i < GARDEN_LEVELS.length - 1 && (
                    <div className="hidden lg:block absolute" />
                  )}
                  {/* Label */}
                  <div className="text-center">
                    <p className="text-[9px] font-bold">Nivel {level.level}</p>
                    <p className="text-[8px] text-muted-foreground">{level.name}</p>
                  </div>
                  {/* Badge */}
                  {isCompleted && (
                    <span className="text-[8px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Check className="h-2.5 w-2.5" /> Completado
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[8px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                      Actual
                    </span>
                  )}
                  {isNext && (
                    <span className="text-[8px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      Próximo
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-[8px] font-bold bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Lock className="h-2.5 w-2.5" /> Bloqueado
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══ CONSEJO KIRI ═══ */}
      <Card className="border-none bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
        <CardContent className="px-5 py-3 flex items-center gap-3">
          <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-[11px] text-muted-foreground flex-1">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Consejo Kiri:</span> {dailyTip}
          </p>
          <Link href="/gestion" className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 flex items-center gap-1">
            Ver más consejos <ChevronRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
    </>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

/**
 * Envuelve tu <img>/<motion.img> real (sin tocar tus assets de /garden/) con:
 * - filtro de ánimo (moodFilter) según salud
 * - clima financiero (sol / lluvia / nubes) como capas superpuestas
 * - luciérnagas si la racha es alta, hojas cayendo si la salud es baja
 * - burbuja de frase con personalidad, encima del árbol
 *
 * Se instancia una vez para mobile y otra para desktop (igual que ya hacías
 * con el árbol), cada una con su propio tamaño vía `sizeClass`.
 */
function GardenTreeVisual({
  currentLevelIdx,
  currentLevel,
  gardenHealth,
  gardenWeather,
  streakActual,
  showLevelUpGlow,
  healthLabel,
  sizeClass,
}: {
  currentLevelIdx: number
  currentLevel: GardenLevel
  gardenHealth: number
  gardenWeather: "sol" | "lluvia" | "nubes"
  streakActual: number
  showLevelUpGlow: boolean
  healthLabel: string
  sizeClass: string
}) {
  const [leaves, setLeaves] = useState<{ id: number; x: number; delay: number }[]>([])
  const leafIdRef = useRef(0)
  // Solo nivel 3+ (Planta joven en adelante) tiene copa/follaje real de donde
  // puedan caer hojas — en Semilla/Brote no hay canopy, no tiene sentido mostrarlas.
  const showFallingLeaves = gardenHealth < 65 && currentLevelIdx >= 2
  const showFireflies = streakActual >= 7
  const phrase = useCyclePhrase(GARDEN_PHRASES[healthLabel] ?? [])

  // Rutas aleatorias por luciérnaga — no un círculo prolijo, sino vuelo errático
  // tipo luciérnaga real. Se generan una sola vez por montaje (useMemo con deps
  // vacías), cada una con sus propios waypoints/duración/retraso.
  const fireflyPaths = useMemo(() => {
    const RANGE = 85   // radio máximo desde el centro
    const STEP = 30    // desplazamiento máximo entre un punto y el siguiente
    const clamp = (n: number) => Math.max(-RANGE, Math.min(RANGE, n))

    return Array.from({ length: 3 }, () => {
      const waypoints = 10
      // Paseo aleatorio: cada punto es un paso corto desde el anterior (no un
      // salto largo a cualquier lugar), así el trazo se ve como un vuelo que
      // deriva suavemente en vez de rectas quebradas entre puntos lejanos.
      let x = (Math.random() - 0.5) * RANGE
      let y = (Math.random() - 0.5) * RANGE
      const xs = [x]
      const ys = [y]
      for (let i = 1; i < waypoints; i++) {
        x = clamp(x + (Math.random() - 0.5) * STEP * 2)
        y = clamp(y + (Math.random() - 0.5) * STEP * 2)
        xs.push(x)
        ys.push(y)
      }
      xs.push(xs[0])
      ys.push(ys[0])

      // Tiempo de cada tramo proporcional a su distancia — sin esto, tramos
      // cortos y largos duran lo mismo y el vuelo se ve con frenones/acelerones
      // poco naturales.
      const segmentDist = xs.slice(1).map((_, i) => Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]))
      const total = segmentDist.reduce((a, b) => a + b, 0) || 1
      let acc = 0
      const times = [0, ...segmentDist.map((d) => (acc += d) / total)]

      return {
        x: xs,
        y: ys,
        opacity: xs.map(() => 0.55 + Math.random() * 0.45),
        times,
        duration: 14 + Math.random() * 8,
        delay: Math.random() * 2,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!showFallingLeaves) return
    const t = setInterval(() => {
      const id = leafIdRef.current++
      setLeaves((prev) => [...prev, { id, x: 20 + Math.random() * 65, delay: Math.random() * 0.5 }])
      setTimeout(() => setLeaves((prev) => prev.filter((l) => l.id !== id)), 3200)
    }, 2600)
    return () => clearInterval(t)
  }, [showFallingLeaves])

  const filterStyle = moodFilter(gardenHealth)
  const imgClass = cn(sizeClass, "object-contain")

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Altura reservada fija: la frase cambia de largo (1-2 líneas) pero el
          árbol de abajo nunca se mueve, sin importar qué tan corta o larga sea. */}
      <div className="h-12 flex items-center justify-center">
        {phrase && (
          <div
            key={phrase}
            className="max-w-[190px] text-center text-[10px] text-foreground bg-card border border-emerald-500/30 rounded-xl px-3 py-1.5 shadow-sm backdrop-blur-sm line-clamp-2"
            style={{ animation: "kiriBubblePop .4s ease" }}
          >
            {phrase}
          </div>
        )}
      </div>

      {/* pt-6 baja el árbol un poco y le da aire arriba para que las nubes
          asomen sin quedar cortadas por el overflow-hidden de la Card. */}
      <div className="relative flex items-center justify-center pt-6">
        {/* Aura dorada de level-up */}
        {showLevelUpGlow && (
          <motion.div
            className="absolute inset-0 rounded-full z-0"
            style={{
              background: "radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 40%, transparent 70%)",
              filter: "blur(20px)",
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Tierra/base del jardín — solo niveles 3+ (Planta joven en adelante), para que
            el árbol parezca crecer desde ahí. Detrás del tronco (z-[5], entre el aura y
            el árbol) para que el tronco quede al frente y no tape la base. */}
        {currentLevelIdx >= 2 && (
          <img
            src="/garden/tierra_arbol.png"
            alt=""
            aria-hidden="true"
            className="absolute -bottom-3 lg:-bottom-4 left-1/2 -translate-x-1/2 z-[5] w-[130%] h-20 lg:h-28 object-cover object-bottom pointer-events-none"
          />
        )}

        {/* Clima financiero — capa sol/lluvia/nubes, siempre detrás del árbol (z-10, mismo
            nivel, el árbol pinta después y queda al frente). */}
        {gardenWeather === "sol" && (
          <div
            className="absolute -top-2 right-2 z-10 w-16 h-16 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0) 70%)",
              animation: "kiriSunPulse 3s ease-in-out infinite",
            }}
          />
        )}
        {gardenWeather === "lluvia" && (
          <div className="absolute top-1 inset-x-6 z-10 flex justify-between pointer-events-none">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="block w-[2px] h-3 rounded-full bg-sky-400"
                style={{ opacity: 0, animation: `kiriRainFall 1.4s linear ${i * 0.18}s infinite` }}
              />
            ))}
          </div>
        )}
        {gardenWeather === "nubes" && (
          <div className="absolute -top-4 inset-x-0 z-10 flex justify-center items-start gap-1 pointer-events-none">
            {[
              { w: "w-14", top: "mt-1", opacity: "opacity-70" },
              { w: "w-20", top: "mt-0", opacity: "opacity-90" },
              { w: "w-12", top: "mt-2", opacity: "opacity-60" },
            ].map((c, i) => (
              <img
                key={i}
                src="/garden/nubes.png"
                alt=""
                aria-hidden="true"
                className={cn(c.w, c.top, c.opacity, "-mx-2 drop-shadow-md")}
                style={{ animation: `kiriCloudDrift ${3 + i}s ease-in-out infinite alternate` }}
              />
            ))}
          </div>
        )}

        {/* Árbol real — mismas 3 variantes de animación que ya tenías. z-10: va
            delante del clima (sol/lluvia/nubes) pero detrás de luciérnagas/hojas.
            El wrapper usa margin (no transform) para no chocar con el transform
            inline que Framer Motion ya aplica en el árbol animado. */}
        <div className="relative z-10 -ml-4 lg:-ml-6">
          {currentLevelIdx === 0 ? (
            <motion.img
              src={currentLevel.image}
              alt={currentLevel.name}
              className={imgClass}
              style={{ filter: filterStyle, transition: "filter .6s ease" }}
              animate={{ rotate: [0, -7, 6, -5, 4, -2, 0], y: [0, -3, 0, -2, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
            />
          ) : currentLevelIdx >= 2 ? (
            <motion.img
              src={currentLevel.image}
              alt={currentLevel.name}
              className={imgClass}
              style={{ transformOrigin: "bottom center", filter: filterStyle, transition: "filter .6s ease" }}
              animate={{
                rotate: [0, 0.4, -0.3, 0.2, -0.2, 0.1, 0],
                skewX: [0, 0.2, -0.15, 0.1, -0.1, 0],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={currentLevel.image}
              alt={currentLevel.name}
              className={imgClass}
              style={{ filter: filterStyle, transition: "filter .6s ease" }}
            />
          )}
        </div>

        {/* Luciérnagas — racha ≥ 7 días. z-30: siempre visibles por delante del árbol.
            Parten de un único punto central (left/top 50%); Framer Motion anima cada
            una por su propia ruta de waypoints aleatorios (fireflyPaths) — vuelo
            errático, no un círculo prolijo, y cada luciérnaga es distinta. */}
        {showFireflies &&
          fireflyPaths.map((path, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 z-30 w-1.5 h-1.5 rounded-full bg-amber-400 pointer-events-none"
              style={{ boxShadow: "0 0 8px 3px rgba(251,191,36,0.75)" }}
              animate={{ x: path.x, y: path.y, opacity: path.opacity }}
              transition={{ duration: path.duration, delay: path.delay, times: path.times, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}

        {/* Hojas cayendo — salud < 65%, nivel 3+. Nacen a media altura (más o
            menos donde está el follaje), no desde arriba del todo (ahí está el
            clima/nubes, no tiene sentido que las hojas salgan de esa zona). */}
        {leaves.map((l) => (
          <span
            key={l.id}
            className="absolute top-1/2 z-20 text-sm pointer-events-none"
            style={{ left: `${l.x}%`, animation: `kiriLeafFall 3s ease-in ${l.delay}s forwards` }}
          >
            🍃
          </span>
        ))}
      </div>
    </div>
  )
}
