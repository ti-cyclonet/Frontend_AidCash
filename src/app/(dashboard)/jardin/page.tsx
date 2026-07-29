"use client"

import { useMemo, useState, useEffect } from "react"
import { motion } from "framer-motion"
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function JardinPage() {
  const { formatAmount, incomeFrequency, user, onboardingDone } = useAppContext()
  const { debts, totalAhorrado } = useFinanceData()
  const { streakActual, badgesDesbloqueados } = useStreaks(incomeFrequency)
  const { allocation } = usePeriodBudget()

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

  // ── XP y nivel actual ─────────────────────────────────────────────────────
  const xpPerStreak = 250
  const currentXP = streakActual * xpPerStreak + badgesDesbloqueados.length * 100
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

  // ── Métricas del jardín ───────────────────────────────────────────────────
  const totalDeuda = debts.reduce((a, d) => a + Number(d.saldoRestante ?? d.montoTotal), 0)

  // Verificar si tiene categorías de presupuesto configuradas
  const hasBudgetCategories = (() => {
    if (typeof window === "undefined") return false
    try { return JSON.parse(localStorage.getItem("kiri_budget_categories") ?? "[]").length > 0 }
    catch { return false }
  })()

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
    <div className="space-y-5 pb-8">

      {/* ═══ WELCOME ONBOARDING ═══ */}
      {showWelcome && onboardingDone && (
        <WelcomeOnboarding onComplete={handleWelcomeComplete} />
      )}

      {/* ═══ HEADER ═══ */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
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
          <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <div className="text-right">
              <p className="text-[8px] text-muted-foreground">Racha actual</p>
              <p className="text-sm font-black text-orange-400">{streakActual} días</p>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ JARDÍN PRINCIPAL ═══ */}
      <Card className="border-none bg-gradient-to-br from-[#0a1f14] to-[#0d2818] shadow-xl rounded-3xl overflow-hidden">
        <CardContent className="p-5 lg:p-6">

          {/* ── Mobile: Estado + Árbol en fila ── */}
          <div className="flex items-start justify-between gap-2 lg:hidden">
            <div className="space-y-1 shrink-0">
              <h2 className="text-2xl font-black text-emerald-400 flex items-center gap-2">
                {getHealthLabel(gardenHealth)} {getHealthEmoji(gardenHealth)}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                {gardenRecommendation}
              </p>
            </div>
            <div className="flex-1 flex justify-end relative">
              {/* Aura dorada de level-up (mobile) */}
              {showLevelUpGlow && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 40%, transparent 70%)",
                    filter: "blur(15px)",
                  }}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              {currentLevelIdx === 0 ? (
                <motion.img
                  src={currentLevel.image}
                  alt={currentLevel.name}
                  className="w-[140px] h-[140px] object-contain"
                  animate={{
                    rotate: [0, -3, 3, -2, 2, -1, 1, 0],
                    scale: [1, 1.02, 0.98, 1.03, 0.97, 1.01, 0.99, 1],
                    y: [0, -2, 2, -1, 1, 0],
                  }}
                  transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
                />
              ) : currentLevelIdx >= 2 ? (
                <motion.img
                  src={currentLevel.image}
                  alt={currentLevel.name}
                  className="w-[140px] h-[140px] object-contain"
                  animate={{
                    rotate: [0, 0.5, -0.5, 0.3, -0.3, 0.1, 0],
                    skewX: [0, 0.3, -0.2, 0.2, -0.1, 0],
                    scaleX: [1, 1.005, 0.995, 1.003, 0.997, 1],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={currentLevel.image} alt={currentLevel.name} className="w-[140px] h-[140px] object-contain" />
              )}
            </div>
          </div>

          {/* ── Mobile: Salud del jardín ── */}
          <div className="lg:hidden mt-4">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-bold">Salud del jardín</span>
              </div>
              <p className="text-2xl font-black text-emerald-400">♥ {gardenHealth}%</p>
              <Progress value={gardenHealth} className="h-1.5" indicatorClassName="bg-emerald-500" />
              <p className="text-[8px] text-muted-foreground">
                Sigue así para alcanzar tu máximo potencial financiero.
              </p>
            </div>
          </div>

          {/* ── Mobile: Botón regar ── */}
          <div className="lg:hidden mt-4">
            <Link href="/ahorro" className="block">
              <Button className="w-full bg-[#1a3a2a] hover:bg-[#1f4533] text-emerald-400 border border-emerald-500/30 rounded-2xl gap-2 h-12 font-bold">
                <Droplets className="h-5 w-5" /> Regar jardín
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full">+10 XP</span>
              </Button>
            </Link>
          </div>

          {/* ── Desktop: Layout 3 columnas ── */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">

            {/* ── Izquierda: Estado + Salud + Regar ── */}
            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-black text-emerald-400 flex items-center gap-2">
                  {getHealthLabel(gardenHealth)} {getHealthEmoji(gardenHealth)}
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[280px]">
                  {gardenRecommendation}
                </p>
              </div>

              {/* Salud del jardín */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-2 max-w-[240px]">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold">Salud del jardín</span>
                </div>
                <p className="text-4xl font-black text-emerald-400">♥ {gardenHealth}%</p>
                <Progress value={gardenHealth} className="h-2" indicatorClassName="bg-emerald-500" />
                <p className="text-[9px] text-muted-foreground">
                  Sigue así para alcanzar tu máximo potencial financiero.
                </p>
              </div>

              {/* Botón regar */}
              <Link href="/ahorro">
                <Button className="bg-[#1a3a2a] hover:bg-[#1f4533] text-emerald-400 border border-emerald-500/30 rounded-2xl gap-2 h-12 px-5 font-bold">
                  <Droplets className="h-5 w-5" /> Regar jardín
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full">+10 XP</span>
                </Button>
              </Link>
            </div>

            {/* ── Centro: Árbol ── */}
            <div className="flex justify-center relative">
              {/* Aura dorada de level-up */}
              {showLevelUpGlow && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 40%, transparent 70%)",
                    filter: "blur(20px)",
                  }}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              {currentLevelIdx === 0 ? (
                /* Nivel 1 (tierra/semilla): animación de huevo vibrando */
                <motion.img
                  src={currentLevel.image}
                  alt={currentLevel.name}
                  className="w-[200px] h-[220px] lg:w-[260px] lg:h-[280px] object-contain drop-shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                  animate={{
                    rotate: [0, -3, 3, -2, 2, -1, 1, 0],
                    scale: [1, 1.02, 0.98, 1.03, 0.97, 1.01, 0.99, 1],
                    y: [0, -2, 2, -1, 1, 0],
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    repeatDelay: 2,
                    ease: "easeInOut",
                  }}
                />
              ) : currentLevelIdx >= 2 ? (
                /* Nivel 3+ (árboles): efecto de brisa natural */
                <motion.img
                  src={currentLevel.image}
                  alt={currentLevel.name}
                  className="w-[200px] h-[220px] lg:w-[260px] lg:h-[280px] object-contain drop-shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                  animate={{
                    rotate: [0, 0.5, -0.5, 0.3, -0.3, 0.1, 0],
                    skewX: [0, 0.3, -0.2, 0.2, -0.1, 0],
                    scaleX: [1, 1.005, 0.995, 1.003, 0.997, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ) : (
                /* Nivel 2 (brote): sin animación especial */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentLevel.image}
                  alt={currentLevel.name}
                  className="w-[200px] h-[220px] lg:w-[260px] lg:h-[280px] object-contain drop-shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                />
              )}
            </div>

            {/* ── Derecha: Progreso general (desktop) ── */}
            <div className="hidden lg:block bg-card/80 border border-border rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                Tu progreso general <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              </h3>
              <div className="space-y-3">
                {/* Sueldo real */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs">Sueldo real disponible</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{salaryCoverage}%</span>
                  </div>
                  <p className="text-sm font-black text-emerald-400">{formatAmount(wallet.cashBalance)}</p>
                  <Progress value={salaryCoverage} className="h-1.5" indicatorClassName="bg-emerald-500" />
                </div>
                {/* Ahorros */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="h-4 w-4 text-blue-400" />
                      <span className="text-xs">Ahorros totales</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{savingsPct}%</span>
                  </div>
                  <p className="text-sm font-black text-blue-400">{formatAmount(totalAhorrado)}</p>
                  <Progress value={savingsPct} className="h-1.5" indicatorClassName="bg-blue-500" />
                </div>
                {/* Deudas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-400" />
                      <span className="text-xs">Deudas totales</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{debtPct}%</span>
                  </div>
                  <p className="text-sm font-black text-red-400">{formatAmount(totalDeuda)}</p>
                  <Progress value={debtPct} className="h-1.5" indicatorClassName="bg-red-500" />
                </div>
                {/* Libertad financiera */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-purple-400" />
                      <span className="text-xs">Libertad financiera</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{freedomPct}%</span>
                  </div>
                  <p className="text-sm font-black text-purple-400">{freedomPct}%</p>
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
            Tu progreso general <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs">Sueldo real disponible</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{salaryCoverage}%</span>
              </div>
              <p className="text-sm font-black text-emerald-400">{formatAmount(wallet.cashBalance)}</p>
              <Progress value={salaryCoverage} className="h-1.5" indicatorClassName="bg-emerald-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-blue-400" />
                  <span className="text-xs">Ahorros totales</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{savingsPct}%</span>
              </div>
              <p className="text-sm font-black text-blue-400">{formatAmount(totalAhorrado)}</p>
              <Progress value={savingsPct} className="h-1.5" indicatorClassName="bg-blue-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  <span className="text-xs">Deudas totales</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{debtPct}%</span>
              </div>
              <p className="text-sm font-black text-red-400">{formatAmount(totalDeuda)}</p>
              <Progress value={debtPct} className="h-1.5" indicatorClassName="bg-red-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                  <span className="text-xs">Libertad financiera</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{freedomPct}%</span>
              </div>
              <p className="text-sm font-black text-purple-400">{freedomPct}%</p>
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
              <Sparkles className="h-6 w-6 text-amber-400" />
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
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Gift className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold">Recompensas</p>
              <p className="text-[10px] text-muted-foreground">Ver premios</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
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
                    <span className="text-[8px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-0.5">
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
          <Lightbulb className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-[11px] text-muted-foreground flex-1">
            <span className="font-bold text-emerald-400">Consejo Kiri:</span> {dailyTip}
          </p>
          <Link href="/gestion" className="text-[9px] font-bold text-emerald-400 hover:underline shrink-0 flex items-center gap-1">
            Ver más consejos <ChevronRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
