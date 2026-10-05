"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { motion, useAnimationControls } from "framer-motion"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Wallet, Heart, TrendingUp, TrendingDown, Sparkles,
  Flame, PiggyBank, ShieldCheck, ChevronRight,
  Droplets, Lock, Check, Gift, Lightbulb, UserPlus, Volume2, VolumeX, CloudLightning, CalendarClock,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InviteLinkModal } from "@/components/social/InviteLinkPanel"
import { calcularClima, type ObligacionClima } from "@/lib/garden-clima"
import { tocarTrueno, prepararAudio, tocarToque, tocarPremio } from "@/lib/thunder-sound"
import { usePlan } from "@/lib/plan-context"
import {
  useJardinJuego, useCombo, FrutosArbol, ComboBadge, PremioSacudida, BotonRegar, HoyEnTuJardin,
  TOQUES_PARA_SACUDIR, ID_BARRA_XP,
} from "@/components/jardin/juego"
import { InvitaWidget } from "@/components/referidos/InvitaYGana"
import { celebrarLogro } from "@/components/referidos/CompartirLogro"
import {
  GARDEN_EVENT_RAIN, GARDEN_EVENT_STORM, GARDEN_EVENT_INCOME,
  consumirLluviaPendiente, consumirTormentaPendiente, consumirIngresoPendiente,
} from "@/lib/garden-events"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { OdometerAmount } from "@/components/ui/odometer-amount"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useStreaks } from "@/hooks/use-streaks"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { userApi, loansApi, connectionsApi, WalletState } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { useSocket, SOCKET_EVENTS } from "@/lib/socket-context"
import { calculateGardenXP } from "@/lib/garden-xp"
import { useBudgetCategories } from "@/hooks/use-budget-categories"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"
import type { Debt, FixedExpense, Loan } from "@/lib/types"
import { tr, localeFecha } from "@/lib/i18n"

// ─── Niveles del jardín ───────────────────────────────────────────────────────

interface GardenLevel {
  level: number
  name: string
  image: string
  xpRequired: number
}

const GARDEN_LEVELS: GardenLevel[] = [
  { level: 1, name: tr("Semilla"),             image: "/garden/tierra.png",          xpRequired: 0 },
  // XP que pide cada nivel: 850 para el 2, luego +1000, +2500, +4000, +6000.
  // Con uso diario (racha + misiones) se llega al 2 en ~2 semanas y al último
  // en varios meses de constancia.
  { level: 2, name: tr("Brote"),               image: "/garden/brote.png",           xpRequired: 850 },
  { level: 3, name: tr("Planta joven"),        image: "/garden/arbol_pequeno.png",   xpRequired: 1850 },
  { level: 4, name: tr("Árbol en crecimiento"), image: "/garden/arbol_mediano.png",  xpRequired: 4350 },
  { level: 5, name: tr("Árbol floreciente"),   image: "/garden/arbol_grande.png",    xpRequired: 8350 },
  { level: 6, name: tr("Jardín próspero"),     image: "/garden/arbol_flores.png",    xpRequired: 14350 },
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

/**
 * Con obligaciones vencidas el jardín está "En tormenta" sin importar el
 * puntaje — antes podía decir "Estable" (o incluso "Creciendo") mientras
 * había cuotas sin pagar, contradiciendo lo que mostraba Obligaciones.
 */
function getHealthLabel(h: number, hayVencidas = false): string {
  if (hayVencidas) return "En tormenta"
  if (h >= 85) return "Floreciendo"
  if (h >= 65) return "Creciendo"
  if (h >= 40) return "Estable"
  return "Necesita atención"
}

function getHealthEmoji(h: number, hayVencidas = false): string {
  if (hayVencidas) return "⛈️"
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
  if (!hasIncome) return tr("Registra tu sueldo real en Gestión → Billetera. Es el primer paso para que tu jardín crezca.")
  if (!hasObligations && !hasBudgetCategories) return tr("Registra tus obligaciones y crea tu presupuesto para tener el control total.")
  if (!hasBudgetCategories) return tr("Crea categorías de presupuesto en Gestión para saber exactamente a dónde va tu dinero.")
  if (!hasObligations) return tr("Registra tus deudas y gastos fijos en Obligaciones para visualizar tu balance real.")
  if (totalAhorrado <= 0) return tr("¡Es momento de ahorrar! Ve a Ahorro y crea tu primer bolsillo. Cada peso cuenta.")
  if (totalDeuda > 0 && streak < 3) return tr("Mantén tu racha pagando a tiempo. Cada periodo consistente fortalece tu jardín.")
  if (streak < 6) return tr("Sigue así, tu constancia está dando frutos. Cada periodo suma XP a tu jardín.")
  return tr("Excelente trabajo. Tu jardín florece gracias a tus decisiones financieras inteligentes.")
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
type GardenWeather = "sol" | "lluvia" | "nubes" | "tormenta"

/**
 * Tormenta: hay obligaciones VENCIDAS — rayos cada pocos segundos mientras se
 * esté en el jardín. La lluvia del ahorro gana unos segundos sobre todo lo
 * demás (antes las nubes le ganaban y el ahorro no se celebraba nunca si
 * había un pago próximo).
 */
function getGardenWeather(hayVencidas: boolean, hayProximas: boolean, showRainCelebration: boolean): GardenWeather {
  if (showRainCelebration) return "lluvia"
  if (hayVencidas) return "tormenta"
  if (hayProximas) return "nubes"
  return "sol"
}

const WEATHER_META: Record<GardenWeather, { icon: string; label: string }> = {
  sol: { icon: "☀️", label: tr("Todo en orden") },
  lluvia: { icon: "🌧️", label: tr("¡Buen ahorro!") },
  nubes: { icon: "☁️", label: tr("Pago próximo") },
  tormenta: { icon: "⛈️", label: tr("Pagos vencidos") },
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
  "Floreciendo": [tr("¡Hoy me siento espectacular! 🌳"), tr("Gracias por cuidarme tan bien"), tr("Este es tu mejor periodo hasta ahora")],
  "Creciendo": [tr("Vamos bien, sigue así 🌿"), tr("Un gasto hormiga menos hoy = más crecimiento"), tr("Me gusta cómo vas esta semana")],
  "Estable": [tr("Podemos llegar más lejos juntos 🌱"), tr("Un pequeño ahorro hoy ayuda bastante"), tr("Sigamos construyendo el hábito")],
  "Necesita atención": [tr("Hace días que no me visitas... 🥺"), tr("Necesito que registres algo hoy"), tr("Mis hojas se sienten un poco tristes")],
  "En tormenta": [tr("Tengo pagos vencidos encima... ⛈️"), tr("Toca las nubes y te muestro qué falta"), tr("Ponte al día y vuelve el sol ☀️")],
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
  const { formatAmount, incomeFrequency, user } = useAppContext()
  const { user: authUser } = useAuth()
  const { debts, fixedExpenses, totalAhorrado, loading: financeLoading } = useFinanceData()
  const { streakActual, badgesDesbloqueados, xpFromMissions, xpFromWatering, xpFromJardin, loading: streakLoading } = useStreaks(incomeFrequency)
  const { plan } = usePlan()
  const { periodData } = usePeriodBudget()
  const { budgetCategories } = useBudgetCategories()

  const [wallet, setWallet] = useState<WalletState>({
    cashBalance: 0, ahorro: 0, obligaciones: 0, libre: 0, endeudamiento: 0,
  })
  useEffect(() => {
    userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) })
    const refresh = () => userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) })
    window.addEventListener("kiri:wallet-updated", refresh)
    return () => window.removeEventListener("kiri:wallet-updated", refresh)
  }, [])

  // Meta total de los bolsillos de ahorro reales (para la barra de "Ahorro"
  // del jardín) — antes leía de una clave de localStorage que la página de
  // Ahorro dejó de escribir hace tiempo, así que para cualquier usuario con
  // bolsillos reales siempre daba 0 y caía al fallback arbitrario de abajo.
  const [realPocketsMeta, setRealPocketsMeta] = useState(0)
  useEffect(() => {
    import("@/lib/api-client").then(({ savingsPocketsApi }) => {
      savingsPocketsApi.list().then(({ data }) => {
        const withMeta = (data?.pockets ?? []).filter(p => p.meta > 0)
        if (withMeta.length > 0) setRealPocketsMeta(withMeta.reduce((a, p) => a + Number(p.meta), 0))
      })
    })
  }, [])

  // ── Clima según obligaciones (vencidas → tormenta, próximas → nubes) ──────
  const clima = useMemo(() => calcularClima(debts, fixedExpenses), [debts, fixedExpenses])
  const hayVencidas = clima.vencidas.length > 0
  const [climaOpen, setClimaOpen] = useState(false)
  const [invitarOpen, setInvitarOpen] = useState(false)

  // Sonido de los truenos — activado por defecto, se recuerda por dispositivo
  const [sonidoOn, setSonidoOn] = useState(true)
  useEffect(() => {
    try { setSonidoOn(localStorage.getItem("kiri_garden_sound") !== "off") } catch { /* sin storage */ }
    const unlock = () => prepararAudio()
    window.addEventListener("pointerdown", unlock, { once: true })
    return () => window.removeEventListener("pointerdown", unlock)
  }, [])
  const toggleSonido = () => {
    prepararAudio()
    setSonidoOn(v => {
      try { localStorage.setItem("kiri_garden_sound", v ? "off" : "on") } catch { /* sin storage */ }
      return !v
    })
  }

  // ── Minijuego: frutos, combo para sacudir y riego (components/jardin/juego) ──
  // La XP que se gana jugando se suma aquí al instante (el servidor ya la guardó)
  const [xpJugando, setXpJugando] = useState(0)
  const [xpPulso, setXpPulso] = useState<{ id: number; xp: number } | null>(null)
  const sumarXp = useCallback((xp: number) => {
    setXpJugando(v => v + xp)
    window.setTimeout(() => setXpPulso({ id: Date.now(), xp }), 850) // cuando el fruto llega a la barra
  }, [])
  const juego = useJardinJuego(sumarXp)
  const [sacudidaKey, setSacudidaKey] = useState(0)
  const [premio, setPremio] = useState<{ icono: string; etiqueta: string } | null>(null)
  const [avisoJuego, setAvisoJuego] = useState<string | null>(null)
  const sacudiendo = useRef(false)
  const onCombo = useCallback((n: number) => {
    if (sonidoOn) tocarToque(n)
    if (n !== TOQUES_PARA_SACUDIR || !juego.estado || sacudiendo.current) return
    if (juego.estado.sacudida) {
      setAvisoJuego(tr("Ya sacudiste tu árbol hoy. Vuelve mañana por otro premio 🌙"))
      window.setTimeout(() => setAvisoJuego(null), 2600)
      return
    }
    sacudiendo.current = true
    setSacudidaKey(k => k + 1)
    try { navigator.vibrate?.([30, 40, 30, 40, 60]) } catch { /* sin vibración */ }
    juego.sacudir().then(r => {
      sacudiendo.current = false
      if (!r) return
      if (sonidoOn) tocarPremio()
      window.setTimeout(() => setPremio({ icono: r.icono, etiqueta: r.etiqueta }), 450)
    })
  }, [juego, sonidoOn])
  const combo = useCombo(onCombo)
  const regar = async () => {
    const r = await juego.regar()
    if (!r) return false
    setShowRainCelebration(true)
    setRainMessage(tr("💧 ¡Regaste tu árbol! +{0} XP", [r.xp]))
    if (rainTimer.current) window.clearTimeout(rainTimer.current)
    rainTimer.current = window.setTimeout(() => { setShowRainCelebration(false); setRainMessage(null) }, 5000)
    return true
  }

  // ── XP y nivel actual ─────────────────────────────────────────────────────
  // Mientras streakLoading es true, streakActual/xpFromMissions todavía valen 0
  // (estado inicial antes de que responda la API) — eso calculaba nivel 1
  // (Semilla) por un instante y se veía un parpadeo semilla→árbol real en cada
  // refresh. dataReady evita mostrar el árbol hasta tener el nivel real.
  const dataReady = !streakLoading && !financeLoading
  const currentXP = calculateGardenXP(streakActual, badgesDesbloqueados.length, xpFromMissions, xpFromWatering, xpFromJardin) + xpJugando
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
  // Momentos de alegría → celebrar y ofrecer compartir (CompartirLogro)
  useEffect(() => {
    if (!showLevelUpGlow) return
    if (sonidoOn) tocarPremio()
    celebrarLogro({ clave: `nivel_${currentLevel.level}`, icono: "🌳", titulo: tr("Mi árbol Kiri subió a nivel {0}: {1}", [currentLevel.level, currentLevel.name]), detalle: tr("Cuidando mi plata todos los días, mi jardín financiero crece.") })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLevelUpGlow])
  useEffect(() => {
    const hitos = [7, 14, 30, 60, 100, 200, 365]
    if (!dataReady || !hitos.includes(streakActual)) return
    celebrarLogro({ clave: `racha_${streakActual}`, icono: "🔥", titulo: tr("{0} días seguidos cuidando mi plata", [streakActual]), detalle: tr("Mi racha en Kiri sigue viva. ¡La constancia es lo que hace crecer el árbol!") })
  }, [dataReady, streakActual])

  const xpForNext = nextLevel?.xpRequired ?? currentLevel.xpRequired
  const xpProgress = xpForNext > 0 ? Math.min(100, Math.round((currentXP / xpForNext) * 100)) : 100
  const xpNeeded = Math.max(0, xpForNext - currentXP)

  // ── Lluvia por ahorro — la registra la capa de API al aportar a un
  //    bolsillo (lib/garden-events.ts): si estás viendo el árbol llueve en el
  //    momento; si no, llueve apenas entras. ──
  const [showRainCelebration, setShowRainCelebration] = useState(false)
  const [rainMessage, setRainMessage] = useState<string | null>(null)
  const rainTimer = useRef<number | null>(null)
  const celebrarAhorro = (monto?: number) => {
    setShowRainCelebration(true)
    setRainMessage(monto ? tr("💧 Ahorraste {0}. ¡Cae la lluvia del crecimiento!", [formatAmount(monto)]) : tr("💧 Ahorro registrado. ¡Cae la lluvia del crecimiento!"))
    if (rainTimer.current) window.clearTimeout(rainTimer.current)
    rainTimer.current = window.setTimeout(() => { setShowRainCelebration(false); setRainMessage(null) }, 8000)
  }
  useEffect(() => {
    const pendiente = consumirLluviaPendiente()
    if (pendiente) window.setTimeout(() => celebrarAhorro(pendiente.monto), 900)
    const onSaving = (e: Event) => {
      consumirLluviaPendiente()
      celebrarAhorro((e as CustomEvent<{ monto?: number }>).detail?.monto)
    }
    window.addEventListener(GARDEN_EVENT_RAIN, onSaving)
    return () => window.removeEventListener(GARDEN_EVENT_RAIN, onSaving)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Ingreso registrado: sale el sol dorado y caen monedas ────────────────
  const [showIncome, setShowIncome] = useState(false)
  const [incomeMessage, setIncomeMessage] = useState<string | null>(null)
  const incomeTimer = useRef<number | null>(null)
  const celebrarIngreso = (monto?: number) => {
    setShowIncome(true)
    setIncomeMessage(monto ? tr("💰 Llegó tu ingreso de {0}. ¡Sale el sol en tu jardín!", [formatAmount(monto)]) : tr("💰 Ingreso registrado. ¡Sale el sol en tu jardín!"))
    if (incomeTimer.current) window.clearTimeout(incomeTimer.current)
    incomeTimer.current = window.setTimeout(() => { setShowIncome(false); setIncomeMessage(null) }, 6000)
  }
  useEffect(() => {
    const pendiente = consumirIngresoPendiente()
    if (pendiente) window.setTimeout(() => celebrarIngreso(pendiente.monto), 700)
    const onIncome = (e: Event) => {
      consumirIngresoPendiente()
      celebrarIngreso((e as CustomEvent<{ monto?: number }>).detail?.monto)
    }
    window.addEventListener(GARDEN_EVENT_INCOME, onIncome)
    return () => window.removeEventListener(GARDEN_EVENT_INCOME, onIncome)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── "Fulano regó tu árbol" — mensajito flotante + lluvia después ──────────
  // Antes de esto, regar el jardín de un amigo no dejaba NADA visible para
  // quien lo recibía salvo un push genérico ("alguien regó tu jardín") — acá
  // nunca aparecía nada dentro de la app. Ahora, si estás viendo el jardín
  // justo cuando te riegan, sale el aviso con el nombre real y, cuando
  // termina de aparecer y desvanecerse, arranca la lluvia (mismo estado que
  // ya usa la celebración de ahorro).
  const [wateredMessage, setWateredMessage] = useState<string | null>(null)
  const { socket } = useSocket()

  const celebrateWatered = (message: string) => {
    // La lluvia empieza de una vez (antes esperaba a que se fuera el mensaje
    // y casi nadie la alcanzaba a ver); el mensaje sale debajo del árbol.
    setWateredMessage(message)
    setShowRainCelebration(true)
    if (rainTimer.current) window.clearTimeout(rainTimer.current)
    rainTimer.current = window.setTimeout(() => setShowRainCelebration(false), 8000)
    setTimeout(() => setWateredMessage(null), 4000)
  }

  useEffect(() => {
    if (!socket) return
    const onWatered = (data: Record<string, unknown>) => {
      celebrateWatered(tr("{0} regó tu árbol", [(data.fromName as string) ?? tr("Un amigo")]))
    }
    socket.on(SOCKET_EVENTS.GARDEN_WATERED, onWatered)
    return () => { socket.off(SOCKET_EVENTS.GARDEN_WATERED, onWatered) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

  // Si te regaron hoy pero no tenías la app abierta en ese momento (el caso
  // más común), el aviso no se pierde: al entrar se muestra una sola vez por
  // día — justo el empujoncito para que vuelvas a revisar tu jardín aunque
  // te lo hayan perdido en vivo.
  useEffect(() => {
    connectionsApi.getFriendsGarden().then(({ data }) => {
      if (!data || data.friendsWhoWateredYouToday <= 0) return
      const LS_KEY = "kiri_garden_watered_seen"
      const today = new Date().toISOString().split("T")[0]
      if (localStorage.getItem(LS_KEY) === today) return
      localStorage.setItem(LS_KEY, today)
      const count = data.friendsWhoWateredYouToday
      celebrateWatered(count === 1 ? tr("Un amigo regó tu árbol hoy") : tr("{0} amigos regaron tu árbol hoy", [count]))
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tormenta de "gasto hormiga" — reacción visual (rayo + nubes oscuras +
  //    lluvia oscura + vibración), sin hormigas dibujadas. Se dispara desde
  //    cualquier pantalla vía CustomEvent (ver addImpulseExpense en
  //    use-finance-data.tsx) — si el usuario está viendo el árbol justo
  //    cuando registra el gasto, lo ve reaccionar en el momento.
  const [showStorm, setShowStorm] = useState(false)
  const [stormMessage, setStormMessage] = useState<string | null>(null)
  const stormTimer = useRef<number | null>(null)
  const dispararTormentaHormiga = (nombre?: string) => {
    setStormMessage(nombre ? tr("🐜 Gasto hormiga: \"{0}\". La tormenta debilita el jardín", [nombre]) : tr("🐜 Gasto hormiga detectado. La tormenta debilita el jardín"))
    setShowStorm(true)
    if (stormTimer.current) window.clearTimeout(stormTimer.current)
    stormTimer.current = window.setTimeout(() => { setShowStorm(false); setStormMessage(null) }, 4500)
  }
  useEffect(() => {
    const pendiente = consumirTormentaPendiente()
    if (pendiente) window.setTimeout(() => dispararTormentaHormiga(pendiente.nombre), 1100)
    const onImpulse = (e: Event) => {
      consumirTormentaPendiente()
      dispararTormentaHormiga((e as CustomEvent<{ nombre?: string }>).detail?.nombre)
    }
    window.addEventListener(GARDEN_EVENT_STORM, onImpulse)
    return () => window.removeEventListener(GARDEN_EVENT_STORM, onImpulse)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Préstamos sociales (solo ACTIVE donde soy borrower) — antes quedaban
  //    fuera de "deuda total" acá y en cualquier otro lugar que mostrara esta
  //    cifra: alguien con un préstamo activo con un amigo veía su jardín (y
  //    su % de libertad financiera) como si esa deuda no existiera.
  const [socialLoansOwed, setSocialLoansOwed] = useState<Loan[]>([])
  useEffect(() => {
    if (!authUser?.id) return
    loansApi.list().then(({ data }) => {
      if (data?.loans) {
        const active = (data.loans as unknown as Loan[]).filter(
          l => l.status === "ACTIVE" && l.borrowerId === authUser.id
        )
        setSocialLoansOwed(active)
      }
    }).catch(() => {})
  }, [authUser?.id])

  // ── Métricas del jardín ───────────────────────────────────────────────────
  const totalDeudaPrestamos = socialLoansOwed.reduce((a, l) => a + Number(l.remainingAmount), 0)
  const totalDeuda = debts.reduce((a, d) => a + Number(d.saldoRestante ?? d.montoTotal), 0) + totalDeudaPrestamos

  // Verificar si tiene categorías de presupuesto configuradas
  const hasBudgetCategories = budgetCategories.length > 0

  // Cada obligación vencida resta salud (hasta 45 puntos): el árbol no puede
  // verse sano con cuotas sin pagar.
  const gardenHealth = Math.max(5, getGardenHealth(
    streakActual,
    wallet.cashBalance > 0,
    totalAhorrado,
    totalDeuda,
    debts.length > 0,
    hasBudgetCategories,
  ) - (hayVencidas ? Math.min(45, 15 + 10 * clima.vencidas.length) : 0))
  const healthLabel = getHealthLabel(gardenHealth, hayVencidas)
  const healthEmoji = getHealthEmoji(gardenHealth, hayVencidas)

  const gardenRecommendation = hayVencidas
    ? (clima.vencidas.length === 1
      ? tr("Tienes 1 obligación vencida por {0}. Toca las nubes para verla y ponte al día.", [formatAmount(clima.totalVencido)])
      : tr("Tienes {0} obligaciones vencidas por {1}. Toca las nubes para verlas y ponte al día.", [clima.vencidas.length, formatAmount(clima.totalVencido)]))
    : getGardenRecommendation(
      wallet.cashBalance > 0,
      totalAhorrado,
      totalDeuda,
      debts.length > 0,
      hasBudgetCategories,
      streakActual,
    )

  // Clima financiero — ver getGardenWeather.
  const gardenWeather = getGardenWeather(hayVencidas, clima.proximas.length > 0, showRainCelebration)
  const cloudBadge = hayVencidas
    ? tr("⚡ {0} vencida{1} · toca aquí", [clima.vencidas.length, clima.vencidas.length === 1 ? "" : "s"])
    : clima.proximas.length > 0 ? tr("☁️ {0} por vencer · toca aquí", [clima.proximas.length]) : null

  // ── Tu progreso general ─────────────────────────────────────────────────
  // Antes: "Sueldo 100%" (barra llena con cualquier saldo), "Deudas 93%" (lo
  // que FALTA, se leía como avance) y "Libertad financiera" = ahorro /
  // (ahorro + deuda), que con cualquier crédito grande quedaba en 0% siempre.
  // Ahora cada barra responde una pregunta concreta.
  const ingresoPeriodo = periodData?.effectiveIncome ?? 0
  const disponiblePct = ingresoPeriodo > 0
    ? Math.min(100, Math.round((wallet.cashBalance / ingresoPeriodo) * 100))
    : wallet.cashBalance > 0 ? 100 : 0
  const savingsPct = realPocketsMeta > 0 ? Math.min(100, Math.round((totalAhorrado / realPocketsMeta) * 100)) : 0
  const deudasActivas = debts.filter(d => d.estado === "activa")
  const deudaOriginal = deudasActivas.reduce((a, d) => a + Number(d.montoTotal), 0)
  const deudaSaldo = deudasActivas.reduce((a, d) => a + Number(d.saldoRestante ?? d.montoTotal), 0)
  const deudaPagadaPct = deudaOriginal > 0 ? Math.max(0, Math.min(100, Math.round((1 - deudaSaldo / deudaOriginal) * 100))) : 0
  // Colchón: cuántos meses de obligaciones podrías cubrir solo con tus ahorros
  const gastoMensualObligaciones = deudasActivas.reduce((a, d) => a + (d.cuotaBase ?? d.cuotaPeriodo) * (d.frecuenciaPago === "quincenal" ? 2 : 1), 0)
    + fixedExpenses.reduce((a, f) => a + Number(f.monto), 0)
  const mesesColchon = gastoMensualObligaciones > 0 ? totalAhorrado / gastoMensualObligaciones : null
  const COLCHON_META_MESES = 3

  // ── Consejo Kiri ────────────────────────────────────────────────────────
  // Antes: una de 4 frases genéricas según el día del mes y un "Ver más
  // consejos" que solo llevaba a Gestión. Ahora primero van los consejos que
  // aplican a TU situación (con un botón para ir a resolverlo) y luego
  // generales; "Otro consejo" los recorre aquí mismo.
  const consejos = useMemo(() => {
    const lista: { texto: string; href?: string; cta?: string }[] = []
    if (hayVencidas) lista.push({ texto: tr("Tienes {0} pago{1} vencido{2}. Empieza por el más antiguo: los atrasos suelen cobrar intereses de mora. ⛈️", [clima.vencidas.length, clima.vencidas.length === 1 ? "" : "s", clima.vencidas.length === 1 ? "" : "s"]), href: "/obligaciones", cta: tr("Pagar") })
    if (clima.proximas.length > 0) lista.push({ texto: tr("{0} vence pronto ({1}). Separa ese dinero desde ya para no gastarlo. ☁️", [clima.proximas[0].nombre, clima.proximas[0].etiqueta.toLowerCase()]), href: "/obligaciones", cta: tr("Ver") })
    if (wallet.cashBalance <= 0) lista.push({ texto: tr("Registra tu sueldo real cuando lo recibas: es la base para que Kiri reparta tu dinero y veas el sol en tu jardín. ☀️"), href: "/gestion?tab=billetera", cta: tr("Registrar") })
    if (totalAhorrado <= 0) lista.push({ texto: tr("Aún no tienes ahorros. Empieza con poco: un bolsillo con una meta pequeña ya hace llover en tu jardín. 🌧️"), href: "/ahorro", cta: tr("Ahorrar") })
    if (mesesColchon !== null && mesesColchon < 1) lista.push({ texto: tr("Tu colchón de emergencia cubre menos de un mes de obligaciones. La meta sana son 3 meses. 🛡️"), href: "/ahorro", cta: tr("Ahorrar") })
    if (!hasBudgetCategories) lista.push({ texto: tr("Crea categorías de presupuesto y Kiri te avisará cuando estés cerca del límite en cada una. 📊"), href: "/gestion", cta: tr("Crear") })
    lista.push(
      { texto: tr("Cuando pagues una deuda, escribe el saldo que te muestra el banco: Kiri calcula el interés real que pagaste. 🏦") },
      { texto: tr("¿Le prestaste plata a alguien que no usa Kiri? Regístralo en Obligaciones → Me deben y recuérdale por WhatsApp. 🤝"), href: "/obligaciones?tab=me_deben", cta: tr("Ver") },
      { texto: tr("Los gastos hormiga de $5.000 al día suman $150.000 al mes. Anótalos todos, así ves a dónde se va tu plata. 🐜") },
      { texto: tr("Invita a alguien con tu enlace: tiene 14 días de KIRI PLUS gratis y, cuando empiece a usar Kiri, los dos ganan más mensajes con Kiri Coach. 💌"), href: "/mi-plan#invita", cta: tr("Ver") },
      ...(currentLevelIdx >= 3 ? [{ texto: tr("Cada gasto, ingreso, pago o ahorro que registras hace caer un fruto de tu árbol. ¡Cosecha los 5 del día! 🍎") }] : []),
      { texto: tr("Completa tus misiones diarias: la racha de días es lo que más hace crecer tu árbol. 🔥"), href: "/misiones", cta: tr("Misiones") },
    )
    return lista
  }, [hayVencidas, clima, wallet.cashBalance, totalAhorrado, mesesColchon, hasBudgetCategories, currentLevelIdx])
  const [consejoIdx, setConsejoIdx] = useState(0)
  const consejo = consejos[consejoIdx % consejos.length]

  return (
    <>
      {showTutorial && <TutorialSlider module="jardin" onClose={dismissTutorial} />}
    <div className="space-y-5 pb-8">

      {/* ═══ HEADER ═══ */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">{tr("🌿 Tu jardín financiero")}</p>
          <h1 className="text-xl font-black mt-0.5">{tr("¡Hola, {0}! 👋", [user.nombre?.split(" ")[0] || tr("Usuario")])}</h1>
          <p className="text-muted-foreground text-xs">{tr("Así va tu jardín financiero hoy, {0}", [new Date().toLocaleDateString(localeFecha(), { day: "numeric", month: "long", year: "numeric" })])}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setClimaOpen(true)}
            className={cn(
              "flex flex-1 sm:flex-none items-center gap-2 bg-card border rounded-2xl px-3 py-2 text-left hover:bg-muted/40 transition-colors",
              hayVencidas ? "border-red-500/40" : "border-border"
            )}
          >
            <span className="text-base leading-none shrink-0">{WEATHER_META[gardenWeather].icon}</span>
            <div className="text-right min-w-0">
              <p className="text-[8px] text-muted-foreground whitespace-nowrap">{tr("Clima financiero")}</p>
              <p className={cn("text-[11px] font-black whitespace-nowrap", hayVencidas && "text-red-500")}>{WEATHER_META[gardenWeather].label}</p>
            </div>
          </button>
          <div className="flex flex-1 sm:flex-none items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2">
            <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
            <div className="text-right min-w-0">
              <p className="text-[8px] text-muted-foreground whitespace-nowrap">{tr("Racha actual")}</p>
              <p className="text-sm font-black text-orange-600 dark:text-orange-400 whitespace-nowrap">{streakActual === 1 ? tr("1 día") : tr("{0} días", [streakActual])}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ JARDÍN PRINCIPAL ═══
          Un solo árbol (antes había uno para móvil y otro para escritorio
          montados a la vez: los rayos y truenos sonaban doble) y solo lo
          esencial: estado, salud, árbol y dos acciones. El progreso va aparte. */}
      <Card className="border-none shadow-xl rounded-3xl overflow-hidden relative">
        <CardContent className="p-5 lg:p-8 relative">
          {/* Mismo diseño en celular y PC: estado → árbol grande al centro →
              salud → acciones (Regar a la izquierda, Invitar a la derecha). */}
          <div className="grid gap-4">
            <div>
              <h2 className={cn("text-2xl lg:text-3xl font-black flex items-center gap-2 whitespace-nowrap", hayVencidas ? "text-slate-600 dark:text-slate-300" : "text-emerald-600 dark:text-emerald-400")}>
                {tr(healthLabel)} {healthEmoji}
              </h2>
              <p className="text-[11px] lg:text-xs text-muted-foreground mt-1">{gardenRecommendation}</p>
            </div>

            <div className="flex justify-center items-center">
              {dataReady ? (
                <GardenTreeVisual
                  currentLevelIdx={currentLevelIdx}
                  currentLevel={currentLevel}
                  gardenHealth={gardenHealth}
                  gardenWeather={gardenWeather}
                  streakActual={streakActual}
                  showLevelUpGlow={showLevelUpGlow}
                  healthLabel={healthLabel}
                  sizeClass="w-[250px] h-[250px] lg:w-[320px] lg:h-[320px]"
                  wateredMessage={wateredMessage}
                  showStorm={showStorm}
                  stormMessage={stormMessage}
                  rainMessage={rainMessage}
                  showIncome={showIncome}
                  incomeMessage={incomeMessage}
                  persistentStorm={gardenWeather === "tormenta"}
                  soundOn={sonidoOn}
                  onToggleSound={toggleSonido}
                  cloudBadge={cloudBadge}
                  onCloudsClick={() => setClimaOpen(true)}
                  onTap={combo.tocar}
                  sacudida={sacudidaKey}
                  extraEscena={<>
                    {/* Frutos caídos al pie del árbol: solo desde el nivel 4 */}
                    {juego.estado?.frutosDesbloqueados && currentLevelIdx >= 3 && (
                      <FrutosArbol frutos={juego.estado.frutos} sonido={sonidoOn} onCosechar={juego.cosechar} />
                    )}
                    <ComboBadge combo={combo.combo} sacudidaLista={!!juego.estado && !juego.estado.sacudida} />
                    <PremioSacudida premio={premio} onCerrar={() => setPremio(null)} />
                    {avisoJuego && (
                      <div key={avisoJuego} className="absolute -bottom-3 left-1/2 z-40 whitespace-nowrap pointer-events-none rounded-full bg-slate-900/90 px-3.5 py-1.5 text-[11px] font-bold text-white"
                        style={{ animation: "kiriToastPop 2.6s ease-out forwards" }}>{avisoJuego}</div>
                    )}
                  </>}
                />
              ) : (
                <div className="w-[250px] h-[250px] lg:w-[320px] lg:h-[320px] rounded-full bg-muted/30 animate-pulse" />
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold">
                  <Heart className={cn("h-3.5 w-3.5", hayVencidas ? "text-slate-500" : "text-emerald-600 dark:text-emerald-400")} />{" "}{tr("Salud del jardín")}</span>
                <span className={cn("font-black", hayVencidas ? "text-slate-600 dark:text-slate-300" : "text-emerald-600 dark:text-emerald-400")}>{gardenHealth}%</span>
              </div>
              <Progress value={gardenHealth} className="h-1.5" indicatorClassName={hayVencidas ? "bg-slate-400" : "bg-emerald-500"} />
            </div>

            {juego.estado && <HoyEnTuJardin estado={juego.estado} />}

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <BotonRegar
                regado={!!juego.estado?.regado}
                xp={juego.estado?.xpRiego ?? 5}
                sonido={sonidoOn}
                onRegado={regar}
                onYaRegado={() => router.push("/ahorro")}
              />
              <Button
                onClick={() => setInvitarOpen(true)}
                variant="outline"
                className="h-12 px-4 rounded-2xl gap-1.5 font-bold border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10"
              >
                <UserPlus className="h-5 w-5" />{" "}{tr("Invitar")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ XP + RECOMPENSAS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        {/* XP Bar — los frutos cosechados vuelan hasta aquí */}
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-4">
            <motion.div
              key={xpPulso?.id ?? 0}
              className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0"
              animate={xpPulso ? { scale: [1, 1.25, 0.95, 1], rotate: [0, -10, 8, 0] } : {}}
              transition={{ duration: 0.5 }}
            >
              <Sparkles className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </motion.div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold truncate">{tr("Próximo hito: Nivel {0}", [currentLevel.level + 1])}</p>
                <span className="relative text-xs text-muted-foreground tabular-nums shrink-0">
                  {currentXP} / {xpForNext}{" "}{tr("XP")}
                  {xpPulso && (
                    <span key={xpPulso.id} className="absolute -top-4 right-0 text-[11px] font-black text-amber-500" style={{ animation: "kiriFloatUp 1.1s ease-out forwards" }}>+{xpPulso.xp}</span>
                  )}
                </span>
              </div>
              <div id={ID_BARRA_XP} className="relative">
                <Progress value={xpProgress} className="h-2.5" indicatorClassName="bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-700" />
                {xpPulso && <span key={`b${xpPulso.id}`} className="absolute inset-0 rounded-full pointer-events-none" style={{ animation: "kiriGlowRing 0.9s ease-out 1 both", background: "radial-gradient(closest-side, rgba(251,191,36,.6), transparent)" }} />}
              </div>
              <p className="text-[9px] text-muted-foreground">{tr("Te faltan {0} XP para desbloquear nuevas recompensas", [xpNeeded])}</p>
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
                <p className="text-sm font-bold">{tr("Misiones")}</p>
                <p className="text-[10px] text-muted-foreground">{tr("Recompensas y cofre sorpresa")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ═══ INVITA Y GANA — progreso al siguiente premio, siempre a la vista ═══ */}
      {plan?.referidos?.niveles && <InvitaWidget referidos={plan.referidos} />}

      {/* ═══ TU PROGRESO GENERAL ═══ */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-4 lg:p-5 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">{tr("Tu progreso general")}{" "}<TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metrica
              icon={Wallet} color="text-emerald-600 dark:text-emerald-400" barra="bg-emerald-500"
              titulo={tr("Disponible")} valor={<OdometerAmount value={wallet.cashBalance} formatAmount={formatAmount} className="text-sm font-black text-emerald-600 dark:text-emerald-400" />}
              pct={disponiblePct}
              detalle={ingresoPeriodo > 0 ? tr("{0}% de tu ingreso del periodo", [disponiblePct]) : tr("Registra tu ingreso para compararlo")}
            />
            <Metrica
              icon={PiggyBank} color="text-blue-600 dark:text-blue-400" barra="bg-blue-500"
              titulo={tr("Ahorros")} valor={formatAmount(totalAhorrado)}
              pct={savingsPct}
              detalle={realPocketsMeta > 0 ? tr("{0}% de tu meta de {1}", [savingsPct, formatAmount(realPocketsMeta)]) : tr("Ponle una meta a tus bolsillos")}
            />
            <Metrica
              icon={TrendingDown} color="text-red-600 dark:text-red-400" barra="bg-emerald-500"
              titulo={tr("Deudas")} valor={formatAmount(totalDeuda)}
              pct={deudaPagadaPct}
              detalle={deudasActivas.length > 0 ? tr("Llevas {0}% pagado", [deudaPagadaPct]) : tr("Sin deudas 🎉")}
            />
            <Metrica
              icon={ShieldCheck} color="text-purple-600 dark:text-purple-400" barra="bg-purple-500"
              titulo={tr("Colchón de emergencia")}
              valor={textoColchon(mesesColchon)}
              pct={mesesColchon === null ? 0 : Math.min(100, Math.round((mesesColchon / COLCHON_META_MESES) * 100))}
              detalle={mesesColchon === null ? tr("Registra tus obligaciones para calcularlo") : tr("Meses de obligaciones que cubren tus ahorros · meta {0}", [COLCHON_META_MESES])}
            />
          </div>
          <Link href="/balance" className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground pt-2 border-t border-border/50">{tr("Ver detalle completo")}{" "}<ChevronRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      {/* ═══ ASÍ CRECE TU JARDÍN — Timeline de niveles ═══ */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">{tr("🌿 Así crece tu jardín")}</h3>
            <p className="text-[10px] text-muted-foreground">{tr("Cada paso cuenta. Tú decides hasta dónde puede llegar.")}</p>
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
                    <p className="text-[9px] font-bold">{tr("Nivel {0}", [level.level])}</p>
                    <p className="text-[8px] text-muted-foreground">{level.name}</p>
                  </div>
                  {/* Badge */}
                  {isCompleted && (
                    <span className="text-[8px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Check className="h-2.5 w-2.5" />{" "}{tr("Completado")}</span>
                  )}
                  {isCurrent && (
                    <span className="text-[8px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">{tr("Actual")}</span>
                  )}
                  {isNext && (
                    <span className="text-[8px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{tr("Próximo")}</span>
                  )}
                  {isLocked && (
                    <span className="text-[8px] font-bold bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Lock className="h-2.5 w-2.5" />{" "}{tr("Bloqueado")}</span>
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
          <p key={consejoIdx} className="text-[11px] text-muted-foreground flex-1" style={{ animation: "kiriBubblePop .4s ease" }}>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{tr("Consejo Kiri:")}</span> {consejo.texto}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {consejo.href && (
              <Link href={consejo.href} className="text-[10px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg px-2.5 py-1">
                {consejo.cta}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setConsejoIdx(i => i + 1)}
              className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
            >{tr("Otro consejo")}{" "}<ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>

      <ClimaObligacionesModal
        open={climaOpen}
        onClose={() => setClimaOpen(false)}
        vencidas={clima.vencidas}
        proximas={clima.proximas}
        formatAmount={formatAmount}
        onIr={() => { setClimaOpen(false); router.push("/obligaciones") }}
      />
      <InviteLinkModal open={invitarOpen} onClose={() => setInvitarOpen(false)} />
    </div>
    </>
  )
}

/** "—", "Menos de 1 día", "12 días", "1.5 meses"… */
function textoColchon(meses: number | null): string {
  if (meses === null) return "—"
  if (meses < 1) {
    const dias = Math.floor(meses * 30)
    return dias < 1 ? tr("Menos de 1 día") : tr("{0} día{1}", [dias, dias === 1 ? "" : "s"])
  }
  const m = meses < 10 ? Math.round(meses * 10) / 10 : Math.round(meses)
  return `${m} ${m === 1 ? "mes" : "meses"}`
}

function Metrica({ icon: Icon, color, barra, titulo, valor, pct, detalle }: {
  icon: typeof Wallet
  color: string
  barra: string
  titulo: string
  valor: React.ReactNode
  pct: number
  detalle: string
}) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", color)} />
        <span className="text-xs">{titulo}</span>
      </div>
      {typeof valor === "string" ? <p className={cn("text-sm font-black", color)}>{valor}</p> : valor}
      <Progress value={pct} className="h-1.5" indicatorClassName={barra} />
      <p className="text-[10px] text-muted-foreground">{detalle}</p>
    </div>
  )
}

// ─── Modal del clima: qué está vencido y qué vence pronto ─────────────────────

function ClimaObligacionesModal({ open, onClose, vencidas, proximas, formatAmount, onIr }: {
  open: boolean
  onClose: () => void
  vencidas: ObligacionClima[]
  proximas: ObligacionClima[]
  formatAmount: (n: number) => string
  onIr: () => void
}) {
  const Fila = ({ o, color }: { o: ObligacionClima; color: string }) => (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <span className="text-base shrink-0">{o.tipo === "deuda" ? "🏦" : "🏠"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate">{o.nombre}</p>
        <p className={cn("text-[10px] font-semibold", color)}>{o.etiqueta}</p>
      </div>
      <p className="text-xs font-black shrink-0">{formatAmount(o.monto)}</p>
    </div>
  )
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {vencidas.length > 0 ? <CloudLightning className="h-5 w-5 text-red-500" /> : <CalendarClock className="h-5 w-5 text-amber-500" />}{tr("El clima de tus obligaciones")}</DialogTitle>
          <DialogDescription>
            {vencidas.length > 0
              ? tr("La tormenta sigue mientras haya pagos vencidos. Ponte al día y vuelve el sol ☀️")
              : proximas.length > 0 ? tr("Nada vencido. Estos pagos se acercan:") : tr("¡Todo al día! No hay pagos vencidos ni próximos ☀️")}
          </DialogDescription>
        </DialogHeader>
        {vencidas.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-red-500">{tr("⚡ Vencidas ({0})", [vencidas.length])}</p>
            {vencidas.map(o => <Fila key={o.key} o={o} color="text-red-500" />)}
          </div>
        )}
        {proximas.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-amber-600">{tr("☁️ Próximas a vencer ({0})", [proximas.length])}</p>
            {proximas.map(o => <Fila key={o.key} o={o} color="text-amber-600" />)}
          </div>
        )}
        {(vencidas.length > 0 || proximas.length > 0) && (
          <Button onClick={onIr} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold">{tr("Ir a pagar en Obligaciones")}</Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

/**
 * Sol del clima financiero — antes era un solo círculo de gradiente radial
 * parpadeando (se veía como una mancha amarilla borrosa, sin forma real, muy
 * por debajo del nivel de detalle de las nubes/lluvia que sí tienen capas e
 * ilustración). Ahora es un disco con degradado nítido + 8 rayos que giran
 * despacio alrededor (como un reloj de sol) + un resplandor suave detrás que
 * respira — sin necesitar ningún asset nuevo en /garden/.
 */
function GardenSun() {
  return (
    <div className="absolute -top-4 -right-1 z-10 w-20 h-20 pointer-events-none">
      {/* Resplandor ambiental, detrás de todo, respira suave */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(251,191,36,0) 70%)" }}
        animate={{ opacity: [0.55, 1, 0.55], scale: [0.92, 1.1, 0.92] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Disco central — quieto, con volumen (degradado + brillo lateral) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-9 h-9 rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 30%, #fef3c7 0%, #fbbf24 45%, #f59e0b 100%)",
            boxShadow: "0 0 16px 3px rgba(251,191,36,0.55)",
          }}
        />
      </div>
    </div>
  )
}

/**
 * Destello de partículas anclado al punto exacto (x, y) donde se tocó el
 * árbol — no al centro. `special` (~30% de los toques, decidido por quien
 * llama) agrega más partículas y un emoji que sube y se desvanece.
 */
function TapBurst({ x, y, special, emoji }: { x: number; y: number; special: boolean; emoji: string }) {
  const particles = useMemo(() => {
    const count = special ? 10 : 5
    return Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const dist = 16 + Math.random() * (special ? 28 : 16)
      return {
        id: i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        delay: Math.random() * 0.08,
        size: 3 + Math.random() * (special ? 4 : 2),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="absolute z-40 pointer-events-none" style={{ left: x, top: y }}>
      {particles.map(p => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: special ? "#fbbf24" : "#6ee7b7",
            boxShadow: special ? "0 0 6px 1px rgba(251,191,36,0.8)" : "0 0 4px 1px rgba(110,231,183,0.7)",
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.55, delay: p.delay, ease: "easeOut" }}
        />
      ))}
      {special && (
        <motion.span
          className="absolute text-lg"
          style={{ left: -8, top: -8 }}
          initial={{ y: 0, opacity: 1, scale: 0.6 }}
          animate={{ y: -34, opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          {emoji}
        </motion.span>
      )}
    </div>
  )
}

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
  wateredMessage,
  showStorm,
  stormMessage,
  rainMessage,
  showIncome = false,
  incomeMessage,
  persistentStorm = false,
  soundOn = true,
  onToggleSound,
  cloudBadge,
  onCloudsClick,
  capaArbol,
  extraEscena,
  onTap,
  sacudida = 0,
}: {
  /** Encima del árbol y moviéndose con él (los frutos del minijuego) */
  capaArbol?: React.ReactNode
  /** Otras capas de la escena (flores de amigos, combo, premio) */
  extraEscena?: React.ReactNode
  /** Cada toque al árbol (para el combo de la sacudida) */
  onTap?: () => void
  /** Cambia → el árbol se sacude fuerte y suelta hojas */
  sacudida?: number
  currentLevelIdx: number
  currentLevel: GardenLevel
  gardenHealth: number
  gardenWeather: GardenWeather
  streakActual: number
  showLevelUpGlow: boolean
  healthLabel: string
  sizeClass: string
  /** "Fulano regó tu árbol" — null cuando no hay nada que mostrar. Se anima
   * una vez sola con `kiriWateredPop` (ver globals.css); el padre es quien
   * decide cuándo aparece y la quita después con un timeout. */
  wateredMessage?: string | null
  /** Reacción de tormenta al registrar un gasto hormiga — nubes oscuras,
   * rayo, vibración; el padre decide cuándo empieza/termina. */
  showStorm?: boolean
  stormMessage?: string | null
  /** "Ahorro registrado…" — abajo del árbol mientras dura la lluvia. */
  rainMessage?: string | null
  /** Ingreso registrado: sol dorado y monedas cayendo unos segundos. */
  showIncome?: boolean
  incomeMessage?: string | null
  /** Obligaciones vencidas: nubes oscuras y rayos cada pocos segundos. */
  persistentStorm?: boolean
  soundOn?: boolean
  onToggleSound?: () => void
  /** Texto de la píldora bajo las nubes ("⚡ 2 vencidas · toca aquí"). */
  cloudBadge?: string | null
  /** Tocar las nubes abre el detalle de vencidas / próximas. */
  onCloudsClick?: () => void
}) {
  const [leaves, setLeaves] = useState<{ id: number; x: number; delay: number }[]>([])
  const leafIdRef = useRef(0)

  // ── Reacción al tocar/clicar el árbol — pura personalidad, no toca XP ni
  // salud del jardín. Rebote de resorte real (compresión + retorno
  // subamortiguado, no un keyframe fijo) más un destello de partículas en el
  // punto exacto de contacto; ~30% de las veces sale una reacción "especial"
  // (más partículas + un emoji que flota y se desvanece). Convive con la
  // lluvia/tormenta porque anima un elemento propio, independiente del clima.
  const tapControls = useAnimationControls()

  // ── Rayos ────────────────────────────────────────────────────────────────
  // Cada golpe: destello + rayo + sacudida de la escena + el árbol se tiñe
  // de color tormenta, y ~0.3-0.8 s después suena el trueno (como la luz
  // llega antes que el sonido). Con obligaciones vencidas caen cada 5-9 s
  // mientras la persona esté en el jardín; el gasto hormiga dispara dos.
  const shakeControls = useAnimationControls()
  const [bolt, setBolt] = useState<{ id: number; left: number } | null>(null)
  const boltIdRef = useRef(0)
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn
  const strike = () => {
    const id = ++boltIdRef.current
    setBolt({ id, left: 30 + Math.random() * 40 })
    window.setTimeout(() => setBolt(b => (b?.id === id ? null : b)), 1100)
    shakeControls.start({ x: [0, -5, 5, -4, 4, -2, 2, 0] }, { duration: 0.55, ease: "easeInOut" })
    if (soundRef.current) window.setTimeout(() => tocarTrueno(0.7 + Math.random() * 0.3), 300 + Math.random() * 500)
  }
  const strikeRef = useRef(strike)
  strikeRef.current = strike

  useEffect(() => {
    if (!persistentStorm || gardenWeather !== "tormenta") return
    let timer: number
    const loop = (delay: number) => {
      timer = window.setTimeout(() => {
        if (!document.hidden) strikeRef.current()
        loop(5000 + Math.random() * 4000)
      }, delay)
    }
    loop(1400)
    return () => window.clearTimeout(timer)
  }, [persistentStorm, gardenWeather])

  useEffect(() => {
    if (!showStorm) return
    strikeRef.current()
    const t = window.setTimeout(() => strikeRef.current(), 1700)
    return () => window.clearTimeout(t)
  }, [showStorm])

  // Monedas del ingreso — posiciones/tiempos al azar, una vez por montaje
  const coins = useMemo(() =>
    Array.from({ length: 14 }, () => ({
      left: 8 + Math.random() * 84,
      delay: Math.random() * 1.4,
      duration: 1.6 + Math.random() * 0.8,
      rotate: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
      size: 14 + Math.random() * 8,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  const [tapBursts, setTapBursts] = useState<{ id: number; x: number; y: number; special: boolean; emoji: string }[]>([])
  const tapIdRef = useRef(0)
  const TAP_EMOJIS = ["💚", "✨", "🌟"]

  const handleTreeTap = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const special = Math.random() < 0.3
    const id = tapIdRef.current++
    const emoji = TAP_EMOJIS[Math.floor(Math.random() * TAP_EMOJIS.length)]

    setTapBursts(prev => [...prev, { id, x, y, special, emoji }])
    window.setTimeout(() => {
      setTapBursts(prev => prev.filter(b => b.id !== id))
    }, special ? 950 : 550)

    // Resorte real: se fija instantáneamente en un estado "comprimido" y
    // luego se suelta con un spring subamortiguado — oscila un par de veces
    // con amplitud decreciente hasta reposar en 1, en vez de una animación
    // lineal de ida y vuelta.
    tapControls.set({ scale: special ? 0.82 : 0.9, rotate: special ? -4 : -2 })
    tapControls.start(
      { scale: 1, rotate: 0 },
      { type: "spring", stiffness: special ? 420 : 480, damping: special ? 7 : 9, mass: 0.55 }
    )
    onTap?.()
  }

  // Sacudida del minijuego: el árbol se bambolea fuerte y suelta una lluvia de hojas
  useEffect(() => {
    if (!sacudida) return
    tapControls.start({ rotate: [0, -9, 8, -7, 6, -4, 3, -1, 0], scale: [1, 0.96, 1.03, 0.98, 1] }, { duration: 0.9, ease: "easeInOut" })
    shakeControls.start({ x: [0, -6, 6, -5, 5, -2, 0] }, { duration: 0.6 })
    const nuevas = Array.from({ length: 9 }, () => ({ id: leafIdRef.current++, x: 15 + Math.random() * 70, delay: Math.random() * 0.4 }))
    setLeaves(prev => [...prev, ...nuevas])
    const t = window.setTimeout(() => setLeaves(prev => prev.filter(l => !nuevas.some(n => n.id === l.id))), 3600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sacudida])
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

  // Gotas de lluvia — antes eran 6 gotas repartidas en línea con `justify-between`
  // y un delay proporcional a su índice (i * 0.18s). Como el índice también fija
  // la posición horizontal, todas terminaban encendiéndose en el mismo orden
  // izquierda→derecha en cada ciclo: se veía como una ola/zigzag barriendo la
  // pantalla, no como lluvia real. Ahora son más gotas, cada una con su propia
  // posición y temporización sorteadas al azar (una sola vez por montaje), sin
  // ninguna relación entre índice y posición — no hay patrón que seguir.
  const rainDrops = useMemo(() =>
    Array.from({ length: 22 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.6,
      duration: 0.85 + Math.random() * 0.55,
      height: 8 + Math.random() * 7,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  // Chispas del aura de level-up — 8 puntos repartidos en círculo (no al azar
  // puro) para que la ráfaga se vea pareja en todas direcciones, con un poco
  // de jitter en distancia/retraso para que no se vea mecánica.
  const levelUpSparkles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => {
      const angle = (i * 360) / 8 + (Math.random() * 20 - 10)
      const dist = 55 + Math.random() * 25
      return {
        dx: Math.cos((angle * Math.PI) / 180) * dist,
        dy: Math.sin((angle * Math.PI) / 180) * dist,
        delay: (i / 8) * 1.4,
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  // Gotas de lluvia oscuras de la tormenta — mismo patrón que rainDrops pero
  // más numerosas y con color de tormenta, generadas una sola vez.
  const stormRainDrops = useMemo(() =>
    Array.from({ length: 28 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 0.6 + Math.random() * 0.4,
      height: 10 + Math.random() * 8,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  const stormVisual = showStorm || (persistentStorm && gardenWeather === "tormenta")
  const filterStyle = moodFilter(gardenHealth)
    + (bolt || showStorm ? " sepia(.35) saturate(1.3) hue-rotate(-8deg) brightness(.82)" : showIncome ? " brightness(1.12) saturate(1.15)" : stormVisual ? " saturate(.85) brightness(.9)" : "")
  const imgClass = cn(sizeClass, "object-contain")

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Altura reservada fija: la frase cambia de largo (1-2 líneas) pero el
          árbol de abajo nunca se mueve, sin importar qué tan corta o larga sea. */}
      {/* (Ya no hay píldora fija sobre las nubes: el detalle se abre al tocarlas,
          y en tormenta la frase misma lo sugiere: "Toca las nubes…") */}
      <div className="flex items-center justify-center h-12">
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
          asomen sin quedar cortadas por el overflow-hidden de la Card.
          La vibración de la tormenta va acá (mueve toda la escena, no solo
          una capa) para que se sienta como un temblor real. */}
      <div style={{ perspective: 1000 }}>
      <div className="kiri-scene-tilt" style={{ animation: "kiriSceneTilt 9s ease-in-out infinite" }}>
      <motion.div
        className="relative flex items-center justify-center pt-6"
        animate={shakeControls}
      >
        {/* "Fulano regó tu árbol" — debajo del árbol (antes salía arriba,
            tapado por las nubes), mientras cae la lluvia. */}
        {wateredMessage && (
          <div
            key={wateredMessage}
            className={cn("absolute left-1/2 z-20 whitespace-nowrap pointer-events-none flex items-center gap-1.5 bg-sky-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg shadow-sky-500/30", stormMessage || incomeMessage ? "bottom-8" : "bottom-0")}
            style={{ animation: "kiriWateredPop 4s ease-out forwards" }}
          >
            <Droplets className="h-3.5 w-3.5 shrink-0" />
            {wateredMessage}
          </div>
        )}
        {/* Aura dorada de level-up + ráfaga de destellos radiales — antes era
            solo un círculo de gradiente pulsando sin forma; ahora respira un
            resplandor suave de fondo y además dispara chispas doradas hacia
            afuera en bucle mientras dura la celebración. */}
        {showLevelUpGlow && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full z-0"
              style={{
                background: "radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 40%, transparent 70%)",
                filter: "blur(20px)",
              }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            {levelUpSparkles.map((s, i) => (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 z-30 w-1.5 h-1.5 rounded-full bg-amber-300 pointer-events-none"
                style={{ boxShadow: "0 0 8px 3px rgba(253,224,71,0.85)" }}
                animate={{ x: [0, s.dx], y: [0, s.dy], opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: s.delay, ease: "easeOut" }}
              />
            ))}
          </>
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

        {/* Sombra simple para Semilla/Brote (niveles 1-2) — todavía no tienen
            la tierra ilustrada de arriba, sin esto se ven flotando sin peso. */}
        {currentLevelIdx < 2 && (
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-[5] w-16 h-3 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.18) 0%, transparent 75%)" }}
          />
        )}

        {/* Clima financiero — capa sol/lluvia/nubes, siempre detrás del árbol (z-10, mismo
            nivel, el árbol pinta después y queda al frente). */}
        {((gardenWeather === "sol" && !stormVisual) || showIncome) && <GardenSun />}
        {/* Ahorro: aro verde que se expande desde la base + destellos */}
        {gardenWeather === "lluvia" && !showStorm && (
          <>
            {[0, 1].map(i => (
              <div
                key={`ring-${i}`}
                className="absolute bottom-2 left-1/2 z-[6] w-3/5 h-10 rounded-full pointer-events-none"
                style={{
                  background: "radial-gradient(closest-side, rgba(51,209,122,.55), rgba(51,209,122,0))",
                  animation: `kiriGlowRing 2.2s ease-out ${i * 1.1}s 2 both`,
                }}
              />
            ))}
            {levelUpSparkles.map((sp, i) => (
              <motion.span
                key={`sav-${i}`}
                className="absolute left-1/2 top-1/2 z-30 w-1.5 h-1.5 rounded-full bg-emerald-300 pointer-events-none"
                style={{ boxShadow: "0 0 8px 3px rgba(110,231,183,0.85)" }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: [0, sp.dx], y: [0, sp.dy], opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, delay: 0.3 + (i % 4) * 0.08, ease: "easeOut" }}
              />
            ))}
          </>
        )}
        {gardenWeather === "lluvia" && !showStorm && (
          <div className="absolute top-1 inset-x-0 h-24 overflow-hidden z-10 pointer-events-none">
            {rainDrops.map((d, i) => (
              <span
                key={i}
                className="absolute top-0 block w-[2px] rounded-full bg-sky-400"
                style={{
                  left: `${d.left}%`,
                  height: `${d.height}px`,
                  opacity: 0,
                  animation: `kiriRainFall ${d.duration}s linear ${d.delay}s infinite`,
                }}
              />
            ))}
          </div>
        )}
        {(gardenWeather === "nubes" || (gardenWeather === "lluvia" && cloudBadge)) && !showStorm && (
          <div
            className="absolute -top-4 inset-x-0 z-20 flex justify-center items-start gap-1 cursor-pointer"
            onClick={onCloudsClick}
            role="button"
            aria-label={tr("Ver obligaciones próximas")}
          >
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

        {/* ── Tormenta de gasto hormiga — nubes oscurecidas + rayo + flash +
            lluvia oscura. Reemplaza cualquier clima normal mientras dura (4.5s),
            sin hormigas dibujadas: el mensaje de abajo ya dice qué pasó. */}
        {stormVisual && (
          <>
            <div
              className="absolute -top-4 inset-x-0 z-20 flex justify-center items-start gap-1 cursor-pointer"
              onClick={onCloudsClick}
              role="button"
              aria-label={tr("Ver obligaciones vencidas")}
            >
              {[
                { w: "w-16", top: "mt-1" },
                { w: "w-24", top: "-mt-1" },
                { w: "w-14", top: "mt-2" },
              ].map((c, i) => (
                <img
                  key={i}
                  src="/garden/nubes.png"
                  alt=""
                  aria-hidden="true"
                  className={cn(c.w, c.top, "-mx-2 drop-shadow-lg")}
                  style={{
                    animation: `kiriCloudDrift ${2 + i}s ease-in-out infinite alternate`,
                    filter: "brightness(0.55) saturate(0.7) contrast(1.15)",
                  }}
                />
              ))}
            </div>
            <div
              className="absolute top-1 inset-x-0 h-28 overflow-hidden z-10 pointer-events-none"
            >
              {stormRainDrops.map((d, i) => (
                <span
                  key={i}
                  className="absolute top-0 block w-[2px] rounded-full bg-slate-400"
                  style={{
                    left: `${d.left}%`,
                    height: `${d.height}px`,
                    opacity: 0,
                    animation: `kiriStormRainFall ${d.duration}s linear ${d.delay}s infinite`,
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Un rayo por golpe (ver strike) */}
        {bolt && (
          <>
            <svg
              key={`bolt-${bolt.id}`}
              viewBox="0 0 24 60"
              className="absolute top-2 z-30 h-24 w-10 pointer-events-none"
              style={{ left: `${bolt.left}%`, animation: "kiriBoltStrike 1.1s ease-out forwards", filter: "drop-shadow(0 0 8px rgba(253,224,71,.9))" }}
              aria-hidden="true"
            >
              <path d="M14 0 L4 30 L12 30 L6 60 L22 22 L13 22 L20 0 Z" fill="#fde047" stroke="#fef9c3" strokeWidth="1" />
            </svg>
            <div
              key={`flash-${bolt.id}`}
              className="absolute -inset-6 z-40 rounded-3xl bg-slate-100 pointer-events-none"
              style={{ animation: "kiriLightningFlash 1.1s ease-out 1" }}
            />
          </>
        )}


        {/* Ingreso: resplandor dorado detrás del árbol + monedas que caen */}
        {showIncome && (
          <>
            <motion.div
              className="absolute inset-0 z-[4] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(251,191,36,0.12) 45%, transparent 70%)", filter: "blur(14px)" }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0.8, 1, 0], scale: [0.6, 1.15, 1, 1.1, 1.2] }}
              transition={{ duration: 5.5, ease: "easeInOut" }}
            />
            <div className="absolute inset-x-0 top-0 h-full overflow-hidden z-30 pointer-events-none">
              {coins.map((c, i) => (
                <motion.span
                  key={`coin-${i}`}
                  className="absolute top-0 flex items-center justify-center rounded-full font-black text-amber-900"
                  style={{
                    left: `${c.left}%`, width: c.size, height: c.size, fontSize: c.size * 0.55,
                    background: "radial-gradient(circle at 35% 30%, #fef3c7 0%, #fbbf24 55%, #d97706 100%)",
                    boxShadow: "0 0 6px rgba(251,191,36,.7)",
                  }}
                  initial={{ y: -24, opacity: 0, rotateY: 0 }}
                  animate={{ y: [-24, 240], opacity: [0, 1, 1, 0], rotateY: c.rotate }}
                  transition={{ duration: c.duration, delay: c.delay, ease: "easeIn", repeat: 1 }}
                >
                  $
                </motion.span>
              ))}
            </div>
          </>
        )}

        {/* Árbol real — mismas 3 variantes de animación que ya tenías. z-10: va
            delante del clima (sol/lluvia/nubes) pero detrás de luciérnagas/hojas.
            El wrapper usa margin (no transform) para no chocar con el transform
            inline que Framer Motion ya aplica en el árbol animado. */}
        <div
          key={currentLevelIdx}
          className="relative z-10 -ml-4 lg:-ml-6 cursor-pointer select-none"
          style={{ animation: "kiriTreeBounceIn .95s cubic-bezier(.34,1.56,.64,1) both", transformOrigin: "bottom center" }}
          onPointerDown={handleTreeTap}
        >
          {/* Rebote de resorte al tocar — elemento propio, no interfiere con
              la animación de reposo (idle sway) del árbol de adentro. */}
          <motion.div animate={tapControls} className="relative" style={{ transformOrigin: "bottom center" }}>
            {currentLevelIdx === 0 ? (
              <motion.img
                src={currentLevel.image}
                alt={currentLevel.name}
                className={imgClass}
                style={{ filter: filterStyle, transition: "filter .6s ease" }}
                animate={{ rotate: [0, -7, 6, -5, 4, -2, 0], y: [0, -3, 0, -2, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
              />
            ) : (
              /* Nivel 1 en adelante — antes el nivel 1 (retoño mediano) se
                 renderizaba como <img> plano, sin animación de reposo: se veía
                 congelado al lado de los demás niveles, que sí tienen su
                 propio sway. Misma brisa sutil que ya usan los niveles 2+. */
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
            )}
            {capaArbol}
          </motion.div>

          {/* Destello de partículas en el punto exacto donde se tocó */}
          {tapBursts.map(b => (
            <TapBurst key={b.id} x={b.x} y={b.y} special={b.special} emoji={b.emoji} />
          ))}
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

        {/* Mensaje inferior con brillo — feedback de la tormenta de gasto
            hormiga, siempre abajo del árbol para no chocar con la frase de
            personalidad ni con "fulano regó tu árbol" (esas van arriba). */}
        {stormMessage && (
          <div
            key={stormMessage}
            className="absolute -bottom-3 left-1/2 z-40 whitespace-nowrap pointer-events-none rounded-full border border-amber-400/30 bg-slate-900/90 px-3.5 py-1.5 text-[11px] font-bold text-amber-200"
            style={{
              animation: "kiriToastPop 4.3s ease-out forwards",
              boxShadow: "0 0 16px 2px rgba(251,191,36,0.35)",
            }}
          >
            {stormMessage}
          </div>
        )}

        {/* Ahorro: mensaje abajo mientras llueve */}
        {incomeMessage && !stormMessage && (
          <div
            key={incomeMessage}
            className="absolute -bottom-3 left-1/2 z-40 whitespace-nowrap pointer-events-none rounded-full border border-amber-400/40 bg-slate-900/90 px-3.5 py-1.5 text-[11px] font-bold text-amber-100"
            style={{ animation: "kiriToastPop 4.3s ease-out forwards", boxShadow: "0 0 16px 2px rgba(251,191,36,0.4)" }}
          >
            {incomeMessage}
          </div>
        )}
        {rainMessage && !stormMessage && !incomeMessage && (
          <div
            key={rainMessage}
            className="absolute -bottom-3 left-1/2 z-40 whitespace-nowrap pointer-events-none rounded-full border border-sky-400/40 bg-slate-900/90 px-3.5 py-1.5 text-[11px] font-bold text-sky-100"
            style={{ animation: "kiriToastPop 4.3s ease-out forwards", boxShadow: "0 0 16px 2px rgba(56,189,248,0.35)" }}
          >
            {rainMessage}
          </div>
        )}

        {extraEscena}

        {/* Sonido del jardín (truenos, frutos, premios) */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            className="absolute bottom-1 -right-2 z-40 h-7 w-7 rounded-full bg-card/80 border border-border/60 flex items-center justify-center text-muted-foreground/70 hover:text-foreground"
            aria-label={soundOn ? tr("Silenciar el jardín") : tr("Activar sonido del jardín")}
            title={soundOn ? tr("Silenciar el jardín") : tr("Activar sonido del jardín")}
          >
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
        )}
      </motion.div>
      </div>
      </div>
    </div>
  )
}
