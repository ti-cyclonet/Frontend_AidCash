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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanData {
  planName: string
  contractId?: string
  isBillable?: boolean
  features: Record<string, boolean>
  limits: Record<string, { displayName: string; maxValue: number }>
  hasPlan: boolean
}

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
  refreshPlan: () => Promise<void>
}

const PlanContext = createContext<PlanContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)

  // Features included in the FREE plan (available even without an active contract)
  const FREE_FEATURES: Record<string, boolean> = {
    budgetManagement: true,
    debtsTracking: true,
    fixedExpenses: true,
    savingsPockets: true,
    // Everything else is locked
    basicReports: false,
    impulseExpenses: false,
    extraIncomes: false,
    emergencyFund: false,
    gamification: false,
    aiCoach: false,
    advancedReports: false,
    debtStrategies: false,
    socialConnections: false,
    sharedPockets: false,
    p2pLoans: false,
  }

  const fetchPlan = useCallback(async () => {
    if (!user) {
      setPlan(null)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await api<PlanData>("/plan")
      if (error || !data || !data.hasPlan) {
        // No active plan — apply FREE features as defaults
        setPlan({
          planName: data?.planName || "Sin plan",
          features: FREE_FEATURES,
          limits: {},
          hasPlan: false,
        })
      } else {
        setPlan(data)
      }
    } catch {
      setPlan({
        planName: "Sin plan",
        features: FREE_FEATURES,
        limits: {},
        hasPlan: false,
      })
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

  const refreshPlan = useCallback(async () => {
    setLoading(true)
    await fetchPlan()
  }, [fetchPlan])

  return (
    <PlanContext.Provider value={{ plan, loading, hasFeature, refreshPlan }}>
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
