"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { tr } from "@/lib/i18n"

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanTier = "FREE" | "PLUS" | "PRO"
/** De dónde sale el plan: contrato pagado, gratis, prestado (prueba de invitado o meses ganados invitando), acceso interno o sin conexión con Authoriza. */
export type PlanFuente = "contrato" | "gratis" | "prueba" | "acceso" | "sin_conexion"

export interface PlanData {
  planName: string
  tier?: PlanTier
  fuente?: PlanFuente
  contractId?: string | null
  isBillable?: boolean
  features: Record<string, boolean>
  limits: Record<string, { displayName: string; maxValue: number }>
  hasPlan: boolean
  /** Hasta cuándo dura el plan prestado (prueba de invitado o meses ganados invitando). */
  pruebaHasta?: string | null
  /** Con un plan ganado encima de uno pago: el plan que de verdad paga. */
  tierContrato?: PlanTier | null
  /** Llegó invitado y aún puede usar su descuento del primer mes: { PLUS: 50, PRO: 30 } */
  descuentoInvitado?: { PLUS: number; PRO: number } | null
  /** Pagó su primera factura con descuento de invitado: se recuerda solo ese mes */
  primerMesInvitado?: { pct: number; hasta: string } | null
  /** Invita y gana (lib/referidos.ts del backend) */
  referidos?: ResumenReferidos
}

export interface NivelReferido { clave: string; amigos: number; pagados: number; titulo: string; icono: string; logrado: boolean }
export interface ResumenReferidos {
  /** Amigos con cuenta activa que llegaron con tu enlace */
  invitados: number
  /** Los que ya usan Kiri (3 movimientos en 2 días) o pagan */
  activos: number
  /** Los que ya pagaron su primera factura */
  pagados: number
  suscritos: number
  niveles: NivelReferido[]
  siguiente: (Omit<NivelReferido, "logrado"> & { faltanAmigos: number; faltanPagados: number }) | null
  /** "Te falta 1 amigo para 1 mes gratis de tu plan." */
  falta: string
  premios: { clave: string; premio: string; pendiente: boolean; fecha: string; amigo: string | null }[]
  reglas: { pruebaAmigoDias: number; bonoActivacion: { coach: number; dictado: number; escaneo: number }; activacion: { movimientos: number; dias: number } }
  descuentoAmigo: { PLUS: number; PRO: number }
}

/** Cantidades "sin límite" (Authoriza guarda 999999). */
export const ILIMITADO = 999999

export interface AvailablePlan {
  packageId: string
  displayName: string
  name: string
  description: string
  price: number
  isHighlighted: boolean
  displayOrder: number
  features: string[]
  ctaLabel: string
  ctaType: string
  images: string[]
}

interface PlanContextValue {
  plan: PlanData | null
  loading: boolean
  hasFeature: (featureName: string) => boolean
  /** Tope de una variable del plan (nCategorias, mesesProyeccion…); null si no se conoce. */
  limite: (variable: string) => number | null
  tier: PlanTier
  refreshPlan: () => Promise<void>
  welcomePackage: string | null
  welcomePlanPrice: number | null
  dismissWelcome: () => void
}

const PlanContext = createContext<PlanContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)

  // KIRI FREE (si /plan no responde): lo mismo que la matriz del backend (lib/planes.ts)
  const FREE_FEATURES: Record<string, boolean> = {
    budgetManagement: true, impulseExpenses: true, debtsTracking: true, fixedExpenses: true,
    savingsPockets: true, emergencyFund: true, extraIncomes: true, gamification: true,
    basicReports: true, aiCoach: true, socialConnections: true,
    advancedReports: false, debtStrategies: false, p2pLoans: false, sharedDebts: false, sharedPockets: false,
    householdBudget: false, openBanking: false, receiptItems: false, savedScenarios: false,
    exclusiveBadges: false, prioritySupport: false,
  }
  const FREE_LIMITS: PlanData["limits"] = {
    nCategorias: { displayName: tr("categorías"), maxValue: 5 },
    nDeudas: { displayName: "deudas", maxValue: 5 },
    nGastosFijos: { displayName: "gastos fijos", maxValue: 8 },
    nBolsillos: { displayName: "bolsillos", maxValue: 3 },
    nMeDeben: { displayName: tr("personas que te deben"), maxValue: 3 },
    nIngresosExtra: { displayName: "ingresos extra", maxValue: 2 },
    nConexiones: { displayName: "conexiones", maxValue: 2 },
    mesesProyeccion: { displayName: tr("meses de proyección"), maxValue: 3 },
    mesesHistorial: { displayName: tr("meses de historial"), maxValue: 3 },
  }
  const PLAN_FREE: PlanData = { planName: tr("KIRI FREE"), tier: "FREE", fuente: "gratis", features: FREE_FEATURES, limits: FREE_LIMITS, hasPlan: false }

  const [welcomePackage, setWelcomePackage] = useState<string | null>(null)
  const [welcomePlanPrice, setWelcomePlanPrice] = useState<number | null>(null)

  const fetchPlan = useCallback(async () => {
    if (!user) {
      setPlan(null)
      setLoading(false)
      return
    }

    // Check for pending plan-upgrade welcome notification
    try {
      const { data: welcomeData } = await api<{ pendingWelcome: string | null; planPrice: number | null }>("/plan/welcome")
      if (welcomeData?.pendingWelcome) {
        setWelcomePackage(welcomeData.pendingWelcome)
        if (welcomeData.planPrice) {
          setWelcomePlanPrice(welcomeData.planPrice)
        }
      }
    } catch {
      // ignore
    }

    try {
      const { data, error } = await api<PlanData>("/plan")
      if (error || !data || !data.hasPlan) {
        // No active plan — apply FREE features as defaults.
        // A PENDING upgrade (unsigned) also lands here, so the user stays on FREE.
        setPlan(PLAN_FREE)
      } else {
        setPlan(data)
      }
    } catch {
      setPlan(PLAN_FREE)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  const hasFeature = useCallback(
    (featureName: string): boolean => {
      if (!plan) return false
      // If no plan or feature not defined, default to false
      return plan.features[featureName] === true
    },
    [plan]
  )

  const limite = useCallback(
    (variable: string): number | null => plan?.limits?.[variable]?.maxValue ?? null,
    [plan]
  )
  const tier: PlanTier = plan?.tier ?? "FREE"

  // Al cambiar de plan (webhook de activación, prueba por invitar) se refresca solo
  useEffect(() => {
    const h = () => { fetchPlan() }
    window.addEventListener("kiri:plan-cambio", h)
    return () => window.removeEventListener("kiri:plan-cambio", h)
  }, [fetchPlan])

  const refreshPlan = useCallback(async () => {
    setLoading(true)
    await fetchPlan()
  }, [fetchPlan])

  const dismissWelcome = useCallback(() => setWelcomePackage(null), [])

  return (
    <PlanContext.Provider value={{ plan, loading, hasFeature, limite, tier, refreshPlan, welcomePackage, welcomePlanPrice, dismissWelcome }}>
      {children}
    </PlanContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error("usePlan must be used inside PlanProvider")
  return ctx
}
