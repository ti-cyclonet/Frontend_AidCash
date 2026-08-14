"use client"

import {
  Zap, Wifi, Home, Car, Heart, GraduationCap, Smartphone,
  Tv, Music, Dumbbell, ShoppingBag, CreditCard, Building2,
  Banknote, Landmark, Receipt, MoreHorizontal, Droplets, Flame,
} from "lucide-react"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Obligation Icons — Asignación automática de iconos por nombre
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Detecta el tipo de obligación (deuda o gasto fijo) por su nombre
 * y retorna un icono + color apropiado.
 */

interface ObligationIcon {
  icon: React.ReactNode
  color: string
  bgColor: string
}

const ICON_RULES: { keywords: string[]; icon: React.ReactNode; color: string; bgColor: string }[] = [
  // Streaming & Entretenimiento
  { keywords: ["netflix", "disney", "hbo", "prime video", "paramount", "star+", "crunchyroll"],
    icon: <Tv className="h-4 w-4" />, color: "text-red-500", bgColor: "bg-red-500/10" },
  { keywords: ["spotify", "deezer", "apple music", "youtube music", "tidal"],
    icon: <Music className="h-4 w-4" />, color: "text-green-500", bgColor: "bg-green-500/10" },
  
  // Servicios públicos
  { keywords: ["energia", "energía", "enel", "electrica", "luz", "codensa"],
    icon: <Zap className="h-4 w-4" />, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  { keywords: ["agua", "acueducto", "epm", "hidro"],
    icon: <Droplets className="h-4 w-4" />, color: "text-blue-400", bgColor: "bg-blue-400/10" },
  { keywords: ["gas", "vanti", "gas natural"],
    icon: <Flame className="h-4 w-4" />, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  { keywords: ["internet", "etb", "fibra", "wifi", "claro tv", "une"],
    icon: <Wifi className="h-4 w-4" />, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
  { keywords: ["celular", "claro", "movistar", "tigo", "wom", "movil", "plan datos"],
    icon: <Smartphone className="h-4 w-4" />, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  
  // Vivienda
  { keywords: ["arriendo", "renta", "hipoteca", "arrendamiento", "canon"],
    icon: <Home className="h-4 w-4" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { keywords: ["administracion", "administración", "conjunto", "propiedad horizontal"],
    icon: <Building2 className="h-4 w-4" />, color: "text-teal-500", bgColor: "bg-teal-500/10" },
  
  // Transporte
  { keywords: ["gasolina", "vehiculo", "vehículo", "soat", "seguro auto", "parqueadero", "peaje"],
    icon: <Car className="h-4 w-4" />, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  
  // Salud & Deporte
  { keywords: ["medicina", "salud", "eps", "seguro medico", "farmacia", "odontologo"],
    icon: <Heart className="h-4 w-4" />, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  { keywords: ["gym", "gimnasio", "smartfit", "bodytech", "spinning", "crossfit"],
    icon: <Dumbbell className="h-4 w-4" />, color: "text-violet-500", bgColor: "bg-violet-500/10" },
  
  // Educación
  { keywords: ["universidad", "colegio", "educacion", "matrícula", "curso", "platzi", "udemy", "coursera"],
    icon: <GraduationCap className="h-4 w-4" />, color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
  
  // Tarjetas de crédito
  { keywords: ["tarjeta", "visa", "mastercard", "amex", "american express", "tc ", "credito bancol", "credito daviv", "nu col"],
    icon: <CreditCard className="h-4 w-4" />, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  
  // Préstamos bancarios
  { keywords: ["credito", "crédito", "prestamo", "préstamo", "libre inversión", "libranza", "hipotecario"],
    icon: <Landmark className="h-4 w-4" />, color: "text-slate-500", bgColor: "bg-slate-500/10" },
  
  // Compras
  { keywords: ["amazon", "mercado libre", "rappi", "compra", "cuota"],
    icon: <ShoppingBag className="h-4 w-4" />, color: "text-fuchsia-500", bgColor: "bg-fuchsia-500/10" },
]

/**
 * Retorna el icono, color y background apropiado según el nombre de la obligación.
 */
export function getObligationIcon(nombre: string): ObligationIcon {
  const lower = nombre.toLowerCase()
  
  for (const rule of ICON_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return { icon: rule.icon, color: rule.color, bgColor: rule.bgColor }
    }
  }
  
  // Default
  return { icon: <Receipt className="h-4 w-4" />, color: "text-muted-foreground", bgColor: "bg-muted/30" }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Estrategia de Deuda — Badge de prioridad
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Calcula la deuda prioritaria según las estrategias:
 *   - Bola de Nieve: la deuda con menor saldo restante primero
 *   - Avalancha: la deuda con mayor tasa de interés primero
 *
 * Retorna el ID de la deuda prioritaria para resaltarla en la UI.
 */

export type DebtStrategy = "snowball" | "avalanche"

interface DebtInput {
  id: string
  nombre: string
  saldoRestante: number
  tasaInteres?: number | null
  cuotaPeriodo: number
  estado: string
  pagadoEstePeriodo: boolean
}

export interface StrategyResult {
  strategy: DebtStrategy
  strategyLabel: string
  priorityDebtId: string | null
  priorityLabel: string
  savingsEstimate: number
}

/**
 * Determina la estrategia óptima y la deuda prioritaria.
 * Si hay tasas de interés diferenciadas → Avalancha (ahorra más intereses).
 * Si no hay tasas o son iguales → Bola de Nieve (progreso psicológico rápido).
 */
export function calculateDebtStrategy(debts: DebtInput[]): StrategyResult | null {
  const active = debts.filter(d => d.estado === 'activa' && !d.pagadoEstePeriodo && d.saldoRestante > 0)
  
  // Se necesitan al menos 2 deudas activas para una estrategia
  if (active.length < 2) return null

  // Determinar si hay tasas diferenciadas
  const withRates = active.filter(d => d.tasaInteres && d.tasaInteres > 0)
  const hasVariedRates = withRates.length >= 2 && 
    new Set(withRates.map(d => d.tasaInteres)).size > 1

  if (hasVariedRates) {
    // Avalancha: priorizar la de mayor tasa
    const sorted = [...active].sort((a, b) => (b.tasaInteres ?? 0) - (a.tasaInteres ?? 0))
    const priority = sorted[0]
    
    // Estimar ahorro en intereses (simplificado)
    const avgRate = withRates.reduce((a, d) => a + (d.tasaInteres ?? 0), 0) / withRates.length
    const totalDebt = active.reduce((a, d) => a + d.saldoRestante, 0)
    const savingsEstimate = Math.round(totalDebt * (avgRate / 100) * 0.15) // ~15% ahorro

    return {
      strategy: "avalanche",
      strategyLabel: "⚡ Avalancha",
      priorityDebtId: priority.id,
      priorityLabel: "⚡ Prioridad Avalancha",
      savingsEstimate,
    }
  }

  // Bola de Nieve: priorizar la de menor saldo
  const sorted = [...active].sort((a, b) => a.saldoRestante - b.saldoRestante)
  const priority = sorted[0]

  return {
    strategy: "snowball",
    strategyLabel: "🔥 Bola de Nieve",
    priorityDebtId: priority.id,
    priorityLabel: "🔥 Prioridad Bola de Nieve",
    savingsEstimate: 0,
  }
}
