"use client"

import {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef, ReactNode,
} from "react"
import { IncomeFrequency } from "@/lib/types"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { userApi, isAuthenticated, getUserId } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { saveAvatar, loadAvatar } from "@/lib/avatar-storage"
import { InactivityTimeout } from "@/hooks/use-inactivity-timeout"
import { ingresoMensual, ingresoDelPeriodo, type PerfilIngreso, type TipoIngreso } from "@/lib/ingresos"
import { cambiarIdioma, idioma as idiomaActual, sincronizarIdioma, type Idioma } from "@/lib/i18n"

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
  username: string
  avatarUrl: string
  /** Partes del nombre (Perfil las edita por separado) */
  primerNombre?: string
  segundoNombre?: string
  primerApellido?: string
  segundoApellido?: string
}

/** Todo lo de "cómo recibo mi plata", para guardarlo de una vez. */
export interface ConfigIngreso {
  tipo: TipoIngreso
  frecuencia: IncomeFrequency
  /** Mensual: sueldo del mes (fijo) o estimación (variable, 0 = no sabe) */
  ingresoBase: number
  quincena1?: number | null
  quincena2?: number | null
  diasCobro?: string
}

interface AppContextValue {
  user: UserProfile
  setUser: (u: UserProfile) => void
  currency: Currency
  setCurrency: (c: Currency) => void
  isDarkMode: boolean
  setIsDarkMode: (v: boolean) => void
  /** Ingreso MENSUAL con el que se planea (sueldo, o estimación/promedio si es variable) */
  income: number
  setIncome: (v: number) => void
  /** Lo que le entra en el periodo en curso (quincena actual o mes) */
  ingresoPeriodo: number
  tipoIngreso: TipoIngreso
  /** Montos de cada quincena si son distintos (null = iguales) */
  quincenas: [number | null, number | null]
  /** Promedio mensual real registrado (ingresos variables) */
  ingresoPromedio: number
  /** Lo que el usuario dejó como sueldo/estimación mensual (sin promedio) */
  ingresoEstimado: number
  perfilIngreso: PerfilIngreso
  configurarIngreso: (cfg: ConfigIngreso) => Promise<void>
  /** Idioma de la app (se guarda en la cuenta y recarga la app) */
  idioma: Idioma
  setIdioma: (v: Idioma) => Promise<void>
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
  ingresoCfg:  "kiri_ingreso_cfg",
} as const

const defaultUser: UserProfile = { nombre: "", correo: "", username: "", avatarUrl: "" }

const AppContext = createContext<AppContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth()
  const [user, setUserState] = useState<UserProfile>(defaultUser)
  // Pesos colombianos por defecto: antes era USD y, como cerrar sesión borra la
  // moneda guardada, en un celular nuevo o tras salir los pesos salían como
  // dólares ("$3,800,000" en vez de "$ 3.800.000")
  const [currency, setCurrencyState] = useState<Currency>("COP")
  const [isDarkMode, setDarkModeState] = useState(false)
  const [incomeRaw, setIncomeState] = useState(0)
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngreso>("fijo")
  const [quincenas, setQuincenas] = useState<[number | null, number | null]>([null, null])
  const [ingresoPromedio, setIngresoPromedio] = useState(0)
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

    if (storedCurrency && storedCurrency in CURRENCY_CONFIG) setCurrencyState(storedCurrency as Currency)
    if (storedDark)     setDarkModeState(storedDark === "true")
    if (storedTimeout)  setInactivityTimeoutState(storedTimeout as InactivityTimeout)

    setMounted(true)

    if (!isAuthenticated() || !authUser) {
      profileLoadedRef.current = true
      setProfileLoading(false)
      return
    }

    const userId = authUser.id

    // Carga avatar desde IndexedDB, cacheado por userId — antes era un slot
    // único y global (sin userId), así que en el mismo navegador la foto de
    // la última persona que inició sesión se le mostraba a la SIGUIENTE
    // cuenta que iniciara sesión ahí hasta que esa cuenta resubiera la suya.
    loadAvatar(userId).then(url => {
      if (url) setUserState(prev => ({ ...prev, avatarUrl: url }))
    }).catch(() => {})

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
      try {
        const cfg = JSON.parse(localStorage.getItem(LS.ingresoCfg) || "null")
        if (cfg) { setTipoIngreso(cfg.tipo ?? "fijo"); setQuincenas([cfg.q1 ?? null, cfg.q2 ?? null]); setIngresoPromedio(Number(cfg.promedio) || 0) }
      } catch { /* caché dañada */ }
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
      // El idioma de la cuenta manda: si este navegador tiene otro, se recarga en el de la cuenta
      if (sincronizarIdioma(u.idioma as string | undefined)) return
      const nombre       = (u.nombre as string) ?? ""
      const correo       = (u.correo as string) ?? ""
      const username     = (u.username as string) ?? ""
      // El backend SÍ tiene el avatar guardado (columna avatar_url), pero
      // antes este fetch lo ignoraba por completo — IndexedDB era la única
      // fuente para mostrarlo, así que en un navegador/dispositivo nuevo
      // (sin nada cacheado localmente) la foto que el usuario ya había
      // subido antes simplemente nunca aparecía, aunque estuviera guardada.
      const avatarUrl    = (u.avatarUrl as string) ?? ""
      const ingreso_base = Number(u.ingresoBase ?? 0)
      const frecuencia   = (u.frecuenciaIngreso as IncomeFrequency) ?? "mensual"
      const onboarding   = (u.onboardingDone as boolean) ?? false
      const meta         = Number(u.metaAhorroGlobal ?? 5000)
      // diasPago viene como Int[] del backend, convertir a string "14,30"
      const diasPagoArr  = (u.diasPago as number[] | undefined) ?? []
      const dias_cobro   = diasPagoArr.length > 0 ? diasPagoArr.join(",") : (localStorage.getItem("kiri_dias_cobro") || "1,16")

      const partes = {
        primerNombre: (u.primerNombre as string) ?? "", segundoNombre: (u.segundoNombre as string) ?? "",
        primerApellido: (u.primerApellido as string) ?? "", segundoApellido: (u.segundoApellido as string) ?? "",
      }
      setUserState(prev => ({ ...prev, nombre, correo, username, ...partes, avatarUrl: avatarUrl || prev.avatarUrl }))
      if (avatarUrl && userId) saveAvatar(userId, avatarUrl).catch(() => {})
      // Fotos que antes quedaron guardadas solo en este navegador (el guardado
      // en el backend falló sin avisar): se suben ahora para que se vean en
      // cualquier dispositivo donde se inicie sesión.
      if (!avatarUrl && userId) {
        loadAvatar(userId).then(local => {
          if (local && local.length < 700_000) {
            userApi.updateProfile({ avatarUrl: local }).catch(() => {})
            setUserState(prev => ({ ...prev, avatarUrl: prev.avatarUrl || local }))
          }
        }).catch(() => {})
      }
      setIncomeState(ingreso_base)
      const tipo = (u.tipoIngreso as TipoIngreso) === "variable" ? "variable" : "fijo"
      const q1 = u.ingresoQuincena1 != null ? Number(u.ingresoQuincena1) : null
      const q2 = u.ingresoQuincena2 != null ? Number(u.ingresoQuincena2) : null
      const promedio = Number(u.ingresoPromedio ?? 0) || 0
      setTipoIngreso(tipo)
      setQuincenas([q1, q2])
      setIngresoPromedio(promedio)
      localStorage.setItem(LS.ingresoCfg, JSON.stringify({ tipo, q1, q2, promedio }))
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
      localStorage.setItem(LS.user, JSON.stringify({ nombre, correo, username, avatarUrl: "" }))
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

      // El backend guarda esto como "diasPago" (array de números, ej. [10, 25]),
      // no como "diasCobro" (string "10,25") — mandar el campo tal cual hacía
      // que Zod lo descartara en silencio (no es un campo reconocido por el
      // schema), así que el PATCH llegaba vacío: el cambio solo vivía acá y en
      // localStorage, nunca se guardaba de verdad en la base de datos.
      if (field === "diasCobro") {
        const dias = String(value).split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 1 && d <= 31)
        await userApi.updateProfile({ diasPago: dias })
        return
      }

      await userApi.updateProfile({ [field]: value })
    },
    []
  )

  // ── Setters públicos ───────────────────────────────────────────────────────

  const setUser = useCallback((u: UserProfile) => {
    const { avatarUrl, ...rest } = u
    setUserState(u)
    // Guardar avatar en IndexedDB (evita QuotaExceededError en localStorage),
    // en el slot del usuario actual — nunca en uno global compartido.
    const userId = getUserId()
    if (avatarUrl && userId) {
      saveAvatar(userId, avatarUrl).catch(() => {})
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

  // ── Cómo recibe su plata (fijo igual, fijo por quincena, variable) ─────────
  const perfilIngreso = useMemo<PerfilIngreso>(() => ({
    tipo: tipoIngreso, frecuencia: incomeFrequency, ingresoBase: incomeRaw,
    quincena1: quincenas[0], quincena2: quincenas[1], promedio: ingresoPromedio, diasCobro,
  }), [tipoIngreso, incomeFrequency, incomeRaw, quincenas, ingresoPromedio, diasCobro])
  const income = ingresoMensual(perfilIngreso)
  const ingresoPeriodo = ingresoDelPeriodo(perfilIngreso)
  const ingresoEstimado = incomeRaw

  /** Guarda de una vez la forma de recibir ingresos (el backend la deja coherente). */
  const configurarIngreso = useCallback(async (cfg: ConfigIngreso) => {
    const variable = cfg.tipo === "variable"
    const frecuencia: IncomeFrequency = variable ? "mensual" : cfg.frecuencia
    const distintas = !variable && frecuencia === "quincenal" && (cfg.quincena1 ?? 0) > 0 && (cfg.quincena2 ?? 0) > 0 && cfg.quincena1 !== cfg.quincena2
    const q1 = distintas ? cfg.quincena1! : null
    const q2 = distintas ? cfg.quincena2! : null
    const base = distintas ? q1! + q2! : Math.max(0, cfg.ingresoBase)
    const dias = variable ? "1" : cfg.diasCobro
    setTipoIngreso(variable ? "variable" : "fijo")
    setIncomeFrequencyState(frecuencia)
    setIncomeState(base)
    setQuincenas([q1, q2])
    if (dias) setDiasCobroState(dias)
    localStorage.setItem(LS.income, String(base))
    localStorage.setItem(LS.frequency, frecuencia)
    if (dias) localStorage.setItem(LS.diasCobro, dias)
    if (!isAuthenticated()) return
    const diasPago = dias ? dias.split(",").map(d => parseInt(d.trim(), 10)).filter(d => d >= 1 && d <= 31) : undefined
    await userApi.updateProfile({
      tipoIngreso: variable ? "variable" : "fijo", frecuenciaIngreso: frecuencia, ingresoBase: base,
      ingresoQuincena1: q1, ingresoQuincena2: q2, ...(diasPago?.length ? { diasPago } : {}),
    })
    // El promedio real (ingresos variables) lo calcula el backend
    let prom = ingresoPromedio
    if (variable) {
      const { data } = await userApi.getProfile()
      prom = Number(data?.user?.ingresoPromedio ?? 0) || 0
      setIngresoPromedio(prom)
    }
    localStorage.setItem(LS.ingresoCfg, JSON.stringify({ tipo: variable ? "variable" : "fijo", q1, q2, promedio: prom }))
  }, [ingresoPromedio])

  /** Cambia el idioma: se guarda en la cuenta (para todos sus dispositivos) y recarga la app. */
  const setIdioma = useCallback(async (v: Idioma) => {
    if (isAuthenticated()) await userApi.updateProfile({ idioma: v }).catch(() => {})
    cambiarIdioma(v)
  }, [])

  // Ingresos variables: al registrar un ingreso cambia su promedio real
  useEffect(() => {
    if (tipoIngreso !== "variable") return
    const h = () => {
      userApi.getProfile().then(({ data }) => {
        const prom = Number(data?.user?.ingresoPromedio ?? 0) || 0
        setIngresoPromedio(prom)
      })
    }
    window.addEventListener("kiri:wallet-updated", h)
    window.addEventListener("kiri:income-registered", h)
    return () => { window.removeEventListener("kiri:wallet-updated", h); window.removeEventListener("kiri:income-registered", h) }
  }, [tipoIngreso])

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

  // Memoizado para que la referencia solo cambie cuando algún valor realmente
  // cambia — sin esto, cada render de AppProvider crea un objeto nuevo y
  // dispara de nuevo cualquier useEffect que dependa de useAppContext() en
  // toda la app (causaba una tormenta de refetch en cascada).
  const value = useMemo(() => ({
    user, setUser,
    currency, setCurrency,
    isDarkMode, setIsDarkMode,
    formatAmount,
    income, setIncome,
    ingresoPeriodo, tipoIngreso, quincenas, ingresoPromedio, ingresoEstimado, perfilIngreso, configurarIngreso,
    idioma: idiomaActual(), setIdioma,
    incomeFrequency, setIncomeFrequency,
    diasCobro, setDiasCobro,
    savingsAmount,
    onboardingDone, setOnboardingDone,
    metaAhorro, setMetaAhorro,
    profileLoading,
    inactivityTimeout, setInactivityTimeout,
  }), [
    user, setUser,
    currency, setCurrency,
    isDarkMode, setIsDarkMode,
    formatAmount,
    income, setIncome,
    ingresoPeriodo, tipoIngreso, quincenas, ingresoPromedio, ingresoEstimado, perfilIngreso, configurarIngreso,
    setIdioma,
    incomeFrequency, setIncomeFrequency,
    diasCobro, setDiasCobro,
    savingsAmount,
    onboardingDone, setOnboardingDone,
    metaAhorro, setMetaAhorro,
    profileLoading,
    inactivityTimeout, setInactivityTimeout,
  ])

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider")
  return ctx
}
