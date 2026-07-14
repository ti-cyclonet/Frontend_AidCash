"use client"

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from "react"
import { IncomeFrequency } from "@/lib/types"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { userApi, isAuthenticated, getUserId } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { saveAvatar, loadAvatar } from "@/lib/avatar-storage"
import { InactivityTimeout } from "@/hooks/use-inactivity-timeout"
export type { IncomeFrequency, InactivityTimeout }

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Currency = "USD" | "COP" | "EUR" | "MXN"

const CURRENCY_CONFIG: Record<Currency, { locale: string; currency: string }> = {
  USD: { locale: "en-US", currency: "USD" },
  COP: { locale: "es-CO", currency: "COP" },
  EUR: { locale: "de-DE", currency: "EUR" },
  MXN: { locale: "es-MX", currency: "MXN" },
}

interface UserProfile {
  nombre: string
  correo: string
  avatarUrl: string
}

interface AppContextValue {
  user: UserProfile
  setUser: (u: UserProfile) => void
  currency: Currency
  setCurrency: (c: Currency) => void
  isDarkMode: boolean
  setIsDarkMode: (v: boolean) => void
  income: number
  setIncome: (v: number) => void
  incomeFrequency: IncomeFrequency
  setIncomeFrequency: (v: IncomeFrequency) => void
  diasCobro: string
  setDiasCobro: (v: string) => void
  onboardingDone: boolean
  setOnboardingDone: (v: boolean) => void
  metaAhorro: number
  setMetaAhorro: (v: number) => void
  savingsAmount: number
  formatAmount: (amount: number) => string
  profileLoading: boolean
  inactivityTimeout: InactivityTimeout
  setInactivityTimeout: (v: InactivityTimeout) => void
}

// ─── Keys de localStorage ─────────────────────────────────────────────────────
const LS = {
  user:        "kiri_user",
  currency:    "kiri_currency",
  dark:        "kiri_dark",
  income:      "kiri_income",
  frequency:   "kiri_frequency",
  diasCobro:   "kiri_dias_cobro",
  onboarding:  "kiri_onboarding_done",
  metaAhorro:  "kiri_meta_ahorro",
  cachedUserId: "kiri_cached_uid",
  inactivityTimeout: "kiri_inactivity_timeout",
} as const

const defaultUser: UserProfile = { nombre: "", correo: "", avatarUrl: "" }

const AppContext = createContext<AppContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth()
  const [user, setUserState] = useState<UserProfile>(defaultUser)
  const [currency, setCurrencyState] = useState<Currency>("USD")
  const [isDarkMode, setDarkModeState] = useState(false)
  const [income, setIncomeState] = useState(0)
  const [incomeFrequency, setIncomeFrequencyState] = useState<IncomeFrequency>("mensual")
  const [diasCobro, setDiasCobroState] = useState("1,16")
  const [onboardingDone, setOnboardingDoneState] = useState(false)
  const [metaAhorro, setMetaAhorroState] = useState(5000)
  const [inactivityTimeout, setInactivityTimeoutState] = useState<InactivityTimeout>("never")
  const [mounted, setMounted] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  const profileLoadedRef = useRef(false)

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    const storedCurrency = localStorage.getItem(LS.currency)
    const storedDark     = localStorage.getItem(LS.dark)
    const storedTimeout  = localStorage.getItem(LS.inactivityTimeout)

    if (storedCurrency) setCurrencyState(storedCurrency as Currency)
    if (storedDark)     setDarkModeState(storedDark === "true")
    if (storedTimeout)  setInactivityTimeoutState(storedTimeout as InactivityTimeout)

    setMounted(true)

    // Carga avatar desde IndexedDB (no va en localStorage)
    loadAvatar().then(url => {
      if (url) setUserState(prev => ({ ...prev, avatarUrl: url }))
    }).catch(() => {})

    if (!isAuthenticated() || !authUser) {
      profileLoadedRef.current = true
      setProfileLoading(false)
      return
    }

    const userId = authUser.id

    // Carga caché local si pertenece al mismo usuario
    const cachedUserId = localStorage.getItem(LS.cachedUserId)
    if (cachedUserId === userId) {
      const storedUser     = localStorage.getItem(LS.user)
      const cachedIncome     = localStorage.getItem(LS.income)
      const cachedFrequency  = localStorage.getItem(LS.frequency)
      const cachedOnboarding = localStorage.getItem(LS.onboarding)
      const cachedMeta       = localStorage.getItem(LS.metaAhorro)

      if (storedUser) {
        const parsed = JSON.parse(storedUser)
        setUserState({ ...parsed, avatarUrl: "" }) // avatarUrl se carga desde IndexedDB arriba
      }
      if (cachedIncome)     setIncomeState(Number(cachedIncome))
      if (cachedFrequency)  setIncomeFrequencyState(cachedFrequency as IncomeFrequency)
      if (cachedOnboarding) setOnboardingDoneState(cachedOnboarding === "true")
      if (cachedMeta)       setMetaAhorroState(Number(cachedMeta))
      const cachedDiasCobro = localStorage.getItem(LS.diasCobro)
      if (cachedDiasCobro)  setDiasCobroState(cachedDiasCobro)
    } else {
      localStorage.removeItem(LS.user)
      localStorage.removeItem(LS.income)
      localStorage.removeItem(LS.frequency)
      localStorage.removeItem(LS.onboarding)
      localStorage.removeItem(LS.metaAhorro)
    }

    // Sobrescribe con los valores reales del backend (fuente de verdad)
    userApi.getProfile().then(({ data, error }) => {
      if (error || !data) {
        console.warn("[AppContext] Error cargando perfil:", error)
        profileLoadedRef.current = true
        setProfileLoading(false)
        return
      }

      const u = data.user
      const nombre       = (u.nombre as string) ?? ""
      const correo       = (u.correo as string) ?? ""
      const ingreso_base = Number(u.ingresoBase ?? 0)
      const frecuencia   = (u.frecuenciaIngreso as IncomeFrequency) ?? "mensual"
      const onboarding   = (u.onboardingDone as boolean) ?? false
      const meta         = Number(u.metaAhorroGlobal ?? 5000)
      // diasPago viene como Int[] del backend, convertir a string "14,30"
      const diasPagoArr  = (u.diasPago as number[] | undefined) ?? []
      const dias_cobro   = diasPagoArr.length > 0 ? diasPagoArr.join(",") : (localStorage.getItem("kiri_dias_cobro") || "1,16")

      setUserState(prev => ({ ...prev, nombre, correo }))
      setIncomeState(ingreso_base)
      setIncomeFrequencyState(frecuencia)
      setDiasCobroState(dias_cobro)
      setOnboardingDoneState(onboarding)
      setMetaAhorroState(meta)

      // Actualiza caché localStorage
      if (userId) localStorage.setItem(LS.cachedUserId, userId)
      localStorage.setItem(LS.income,     String(ingreso_base))
      localStorage.setItem(LS.frequency,  frecuencia)
      localStorage.setItem(LS.diasCobro,  dias_cobro)
      localStorage.setItem(LS.onboarding, String(onboarding))
      localStorage.setItem(LS.metaAhorro, String(meta))
      localStorage.setItem(LS.user, JSON.stringify({ nombre, correo, avatarUrl: "" }))
      profileLoadedRef.current = true
      setProfileLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser])

  // ── Dark mode → DOM ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle("dark", isDarkMode)
  }, [isDarkMode, mounted])

  // ── Persistencia al backend ────────────────────────────────────────────────
  const persistProfileField = useCallback(
    async (field: string, value: unknown) => {
      const lsKey = field === "ingresoBase"         ? LS.income
                  : field === "frecuenciaIngreso"    ? LS.frequency
                  : field === "diasCobro"            ? LS.diasCobro
                  : field === "metaAhorroGlobal"     ? LS.metaAhorro
                  : LS.onboarding
      localStorage.setItem(lsKey, String(value))

      if (!profileLoadedRef.current) return
      if (!isAuthenticated()) return

      await userApi.updateProfile({ [field]: value })
    },
    []
  )

  // ── Setters públicos ───────────────────────────────────────────────────────

  const setUser = useCallback((u: UserProfile) => {
    const { avatarUrl, ...rest } = u
    setUserState(u)
    // Guardar avatar en IndexedDB (evita QuotaExceededError en localStorage)
    if (avatarUrl) {
      saveAvatar(avatarUrl).catch(() => {})
    }
    // En localStorage solo se guarda nombre y correo, nunca el avatar
    localStorage.setItem(LS.user, JSON.stringify({ ...rest, avatarUrl: "" }))
    if (isAuthenticated()) {
      // Persistir nombre Y correo al backend
      const patch: Record<string, unknown> = { nombre: u.nombre }
      if (u.correo) patch.correo = u.correo
      userApi.updateProfile(patch)
    }
  }, [])

  const setIncome = useCallback((v: number) => {
    setIncomeState(v)
    persistProfileField("ingresoBase", v)
  }, [persistProfileField])

  const setIncomeFrequency = useCallback((v: IncomeFrequency) => {
    setIncomeFrequencyState(v)
    persistProfileField("frecuenciaIngreso", v)
  }, [persistProfileField])

  const setDiasCobro = useCallback((v: string) => {
    setDiasCobroState(v)
    persistProfileField("diasCobro", v)
  }, [persistProfileField])

  const setOnboardingDone = useCallback((v: boolean) => {
    setOnboardingDoneState(v)
    persistProfileField("onboardingDone", v)
  }, [persistProfileField])

  const setMetaAhorro = useCallback((v: number) => {
    setMetaAhorroState(v)
    persistProfileField("metaAhorroGlobal", v)
  }, [persistProfileField])

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c)
    localStorage.setItem(LS.currency, c)
  }, [])

  const setIsDarkMode = useCallback((v: boolean) => {
    setDarkModeState(v)
    localStorage.setItem(LS.dark, String(v))
  }, [])

  const setInactivityTimeout = useCallback((v: InactivityTimeout) => {
    setInactivityTimeoutState(v)
    localStorage.setItem(LS.inactivityTimeout, v)
  }, [])

  // ── Derivados ──────────────────────────────────────────────────────────────
  // savingsAmount como referencia: basado en ingreso sin obligaciones (caso ideal)
  // Los componentes usan usePeriodBudget() para cálculos dinámicos reales.
  const savingsAmount = income > 0
    ? calculateBudgetAllocation(income, 0).savingsAmount
    : 0

  const formatAmount = useCallback((amount: number) => {
    const config = CURRENCY_CONFIG[currency]
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [currency])

  return (
    <AppContext.Provider value={{
      user, setUser,
      currency, setCurrency,
      isDarkMode, setIsDarkMode,
      formatAmount,
      income, setIncome,
      incomeFrequency, setIncomeFrequency,
      diasCobro, setDiasCobro,
      savingsAmount,
      onboardingDone, setOnboardingDone,
      metaAhorro, setMetaAhorro,
      profileLoading,
      inactivityTimeout, setInactivityTimeout,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider")
  return ctx
}
