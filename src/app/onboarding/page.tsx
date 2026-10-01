"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useAuth } from "@/lib/auth-context"
import {
  ChevronRight, ChevronLeft, Clock, Shield,
  Calendar, CalendarDays, Wallet, PiggyBank,
  CheckCircle2, XCircle, Sparkles, Rocket, Target, Brain,
  Plus, Trash2, ReceiptText, Landmark, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DueQuestion, useDueQuestion } from "@/components/obligaciones/DueQuestion"
import { tr } from "@/lib/i18n"
import { userApi } from "@/lib/api-client"

// ─── Pasos del test ───────────────────────────────────────────────────────────

const STEPS = [
  tr("Bienvenida"),
  tr("Cómo recibes tu plata"),
  tr("Sueldo base"),
  tr("Ingreso extra"),
  tr("Tu plata hoy"),
  tr("Situación de deudas"),
  tr("Registrar deudas"),         // nuevo paso intermedio
  tr("Finalización"),
]

// Tipo para deudas/gastos fijos registrados en onboarding
interface OnboardingObligation {
  id: string
  tipo: "deuda" | "gasto_fijo"
  nombre: string
  monto: string
  diasPago: string
  /** Solo deudas: cuánto se debe en total (si se deja vacío, la cuota) */
  saldoTotal: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const { setOnboardingDone, setUser, user, configurarIngreso, formatAmount } = useAppContext()
  const { updateUserProfile, addDebt, addFixedExpense, addExtraIncome } = useFinanceData()
  const { user: authUser } = useAuth()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Form data
  // Sueldo fijo, o ingresos variables (independiente, ventas, comisiones: sin sueldo fijo)
  const [tipoIngreso, setTipoIngreso] = useState<"fijo" | "variable" | null>(null)
  const [frecuencia, setFrecuencia] = useState<"mensual" | "quincenal">("mensual")
  // Quincenal: ¿las dos quincenas son iguales? Si no, un monto para cada una
  const [quincenasIguales, setQuincenasIguales] = useState(true)
  const [incomeValue2, setIncomeValue2] = useState("")
  const [diaPago1, setDiaPago1] = useState("")
  const [diaPago2, setDiaPago2] = useState("")
  const [incomeValue, setIncomeValue] = useState("")
  const [metaAhorro, setMetaAhorro] = useState("")
  const [tieneIngresoExtra, setTieneIngresoExtra] = useState<boolean | null>(null)
  const [extraNombre, setExtraNombre] = useState("")
  const [extraMonto, setExtraMonto] = useState("")
  const [extraTemp, setExtraTemp] = useState<"una_vez" | "definido" | "indefinido">("una_vez")
  const [extraMeses, setExtraMeses] = useState("")
  // Lo que tiene HOY en total (bancos, billeteras, efectivo): arranque del Sueldo Real
  const [saldoHoy, setSaldoHoy] = useState("")
  const [tieneDeudas, setTieneDeudas] = useState<boolean | null>(null)
  const [quiereRegistrar, setQuiereRegistrar] = useState<boolean | null>(null)

  // Registro de obligaciones en onboarding
  const [obligations, setObligations] = useState<OnboardingObligation[]>([])
  const [currentObligation, setCurrentObligation] = useState<OnboardingObligation>({
    id: crypto.randomUUID(),
    tipo: "deuda",
    nombre: "",
    monto: "",
    diasPago: "",
    saldoTotal: "",
  })
  const [savingObligation, setSavingObligation] = useState(false)
  // Si el día de pago de este mes ya pasó, se pregunta si ya la pagó — si no,
  // la obligación nacía "vencida" y el usuario nuevo entraba con su árbol en
  // tormenta. Por defecto: ya la pagué (lo normal al empezar a usar Kiri).
  const [dueFlags, setDueFlags] = useState({ yaPago: true, nueva: false })
  const dueKind = useDueQuestion(currentObligation.diasPago, false)
  const [obligationError, setObligationError] = useState<string | null>(null)

  const totalSteps = STEPS.length
  const isFirst = step === 0
  const isLast = step === totalSteps - 1

  // ── Navegación ────────────────────────────────────────────────────────────
  const goNext = () => {
    if (isLast) {
      handleFinish()
    } else {
      // Si no quiere contar un ingreso extra, no hay nada más que pedirle en
      // este paso — pero SÍ sigue al de deudas normalmente (no se salta nada).
      if (step === 5) {
        // Si no tiene deudas o no quiere registrar, saltar el paso de registro
        if (tieneDeudas === false) {
          setStep(7) // saltar a finalización
          return
        }
        // Si tiene deudas, va al paso 6 (pregunta de registrar)
        setStep(6)
        return
      }
      if (step === 6 && quiereRegistrar === false) {
        setStep(7) // saltar a finalización
        return
      }
      setStep(s => s + 1)
    }
  }

  const goPrev = () => {
    if (!isFirst) {
      // Ajustar navegación hacia atrás
      if (step === 7) {
        if (tieneDeudas === false) {
          setStep(5)
          return
        }
        if (quiereRegistrar === false) {
          setStep(6)
          return
        }
        setStep(6)
        return
      }
      setStep(s => s - 1)
    }
  }

  // Días de pago según la frecuencia elegida: 1 para mensual, 2 para quincenal.
  const diasPagoValidos = () => {
    const d1 = Number(diaPago1)
    if (!d1 || d1 < 1 || d1 > 31) return false
    if (frecuencia === "quincenal") {
      const d2 = Number(diaPago2)
      if (!d2 || d2 < 1 || d2 > 31) return false
    }
    return true
  }

  const canNext = () => {
    if (step === 1) return tipoIngreso === "variable" || (tipoIngreso === "fijo" && diasPagoValidos())
    // Con ingresos variables la estimación es opcional (sin ella se usa el promedio real)
    if (step === 2) {
      if (tipoIngreso === "variable") return true
      if (frecuencia === "quincenal" && !quincenasIguales) return Number(incomeValue) > 0 && Number(incomeValue2) > 0
      return !!incomeValue && Number(incomeValue) > 0
    }
    if (step === 3) return tieneIngresoExtra !== null && (tieneIngresoExtra === false || (!!extraNombre && !!extraMonto))
    if (step === 4) return saldoHoy !== ""
    if (step === 5) return tieneDeudas !== null
    if (step === 6) return quiereRegistrar !== null
    return true
  }

  // ── Guardar obligación individual ─────────────────────────────────────────
  // addDebt/addFixedExpense devuelven `null` si no se pudo guardar (ej. justo
  // después de registrarse, antes de que la sesión termine de cargar) — antes
  // este flujo no revisaba eso, así que el wizard marcaba la obligación como
  // "registrada" en pantalla aunque nunca se hubiera guardado de verdad.
  // Devuelve true si quedó guardada. Las obligaciones son MENSUALES aunque el
  // sueldo sea quincenal (antes heredaban la frecuencia del sueldo: un
  // arriendo mensual quedaba como quincenal con un solo día de pago).
  const handleSaveObligation = async (): Promise<boolean> => {
    if (!currentObligation.nombre || !currentObligation.monto) return false
    setSavingObligation(true)
    setObligationError(null)
    const due = dueKind ? { yaPagoEstePeriodo: dueFlags.yaPago, nuevaProximoPeriodo: dueFlags.nueva } : {}

    try {
      const cuota = Number(currentObligation.monto)
      const saved = currentObligation.tipo === "deuda"
        ? await addDebt({
            nombre: currentObligation.nombre,
            montoTotal: Math.max(cuota, Number(currentObligation.saldoTotal) || cuota),
            cuotaPeriodo: cuota,
            diasPago: currentObligation.diasPago || "1",
            frecuenciaPago: "mensual",
            ...due,
          })
        : await addFixedExpense({
            nombre: currentObligation.nombre,
            monto: cuota,
            fechaCorte: currentObligation.diasPago || "1",
            frecuencia: "mensual",
            ...due,
          })

      if (!saved) {
        setObligationError(tr("No se pudo guardar. Espera un momento e intenta de nuevo."))
        setSavingObligation(false)
        return false
      }

      setObligations(prev => [...prev, currentObligation])
      // Reset para la siguiente
      setCurrentObligation({
        id: crypto.randomUUID(),
        tipo: "deuda",
        nombre: "",
        monto: "",
        diasPago: "",
        saldoTotal: "",
      })
      setDueFlags({ yaPago: true, nueva: false })
      setSavingObligation(false)
      return true
    } catch (e) {
      setObligationError(tr("No se pudo guardar. Espera un momento e intenta de nuevo."))
    }
    setSavingObligation(false)
    return false
  }

  // "Continuar": si dejó una obligación llena sin guardar, se guarda primero
  // (antes se perdía en silencio).
  const continuarDesdeRegistro = async () => {
    if (currentObligation.nombre && currentObligation.monto) {
      const ok = await handleSaveObligation()
      if (!ok) return
    }
    setStep(7)
  }

  // ── Finalizar y guardar ───────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true)
    try {
      // Cómo recibe su plata: sueldo fijo (mensual, quincenal igual o
      // quincenal con montos distintos) o ingresos variables sin sueldo fijo
      const variable = tipoIngreso === "variable"
      const rawIncome = Number(incomeValue) || 0
      const quincenal = !variable && frecuencia === "quincenal"
      const distintas = quincenal && !quincenasIguales
      const diasPago = variable ? [1] : quincenal
        ? [Number(diaPago1), Number(diaPago2)].sort((a, b) => a - b)
        : [Number(diaPago1)]
      await configurarIngreso({
        tipo: variable ? "variable" : "fijo",
        frecuencia: variable ? "mensual" : frecuencia,
        // Siempre MENSUAL: quincena × 2, o la suma de las dos quincenas
        ingresoBase: variable ? rawIncome : distintas ? rawIncome + (Number(incomeValue2) || 0) : quincenal ? rawIncome * 2 : rawIncome,
        // incomeValue es lo del primer día de pago del mes (el menor)
        quincena1: distintas ? rawIncome : null,
        quincena2: distintas ? Number(incomeValue2) || 0 : null,
        diasCobro: diasPago.join(","),
      })
      await updateUserProfile({ onboarding_done: true })

      // Lo que tiene hoy arranca su Sueldo Real (después de las obligaciones
      // del paso 6, que ya quedaron guardadas: así se reparte con ellas)
      if (Number(saldoHoy) > 0) {
        await userApi.walletSaldoInicial(Number(saldoHoy))
        window.dispatchEvent(new Event("kiri:wallet-updated"))
      }

      // El ingreso extra se guarda hasta el final, junto con todo lo demás —
      // no apenas se llena el formulario en el paso 3 (mismo patrón que ya
      // usa el resto del test: nada se persiste hasta "Comenzar mi viaje").
      if (tieneIngresoExtra && extraNombre && extraMonto) {
        await addExtraIncome({
          nombre: extraNombre,
          monto: Number(extraMonto),
          temporalidad: extraTemp,
          mesesRestantes: extraTemp === "definido" ? (Number(extraMeses) || 1) : null,
        })
      }

      setOnboardingDone(true)
      router.replace("/dashboard")
    } catch {
      setSaving(false)
    }
  }

  // Calcula el paso visual (para la progress bar)
  const visualStep = step >= 7 ? 6 : step >= 6 ? 5 : step
  const visualTotalSteps = 7

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Progress bar ── */}
      <div className="px-6 pt-6 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: visualTotalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i <= visualStep ? "bg-kiri-emerald flex-1" : "bg-muted/30 flex-1"
              )}
            />
          ))}
        </div>
        {step > 0 && step < totalSteps - 1 && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">{tr("Paso {0} de 5", [Math.min(visualStep, 5)])}</p>
        )}
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm"
          >
            {/* ═══ PASO 0: Bienvenida ═══ */}
            {step === 0 && (
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                  <span className="text-kiri-emerald">🌱</span>{" "}{tr("Kiri Finance")}</div>

                <div className="h-40 w-40 rounded-full bg-kiri-emerald/5 border-2 border-kiri-emerald/20 flex items-center justify-center">
                  <span className="text-7xl">🌱</span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-black">{tr("¡Bienvenido a Kiri! 🌱")}</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tr("Este test inicial nos ayudará a conocerte mejor para ofrecerte una experiencia personalizada y consejos que realmente te servirán.")}</p>
                </div>

                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-kiri-emerald" />{" "}{tr("2-3 min")}</span>
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-kiri-emerald" />{" "}{tr("100% confidencial")}</span>
                </div>
              </div>
            )}

            {/* ═══ PASO 1: Frecuencia ═══ */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-kiri-emerald/10 flex items-center justify-center text-kiri-emerald">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">{tr("¿Cómo recibes tu plata?")}</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{tr("Esto nos ayudará a organizar tu presupuesto correctamente.")}</p>

                <div className="grid grid-cols-2 gap-3">
                  {([
                    { v: "fijo", icon: Wallet, t: tr("Tengo un sueldo fijo"), d: tr("Me pagan en fechas fijas (aunque el monto cambie un poco)") },
                    { v: "variable", icon: Sparkles, t: tr("Mis ingresos varían"), d: tr("Independiente, ventas, comisiones, domicilios…") },
                  ] as const).map(o => (
                    <button key={o.v} onClick={() => setTipoIngreso(o.v)}
                      className={cn("flex flex-col gap-1.5 p-4 rounded-2xl border-2 transition-colors text-left",
                        tipoIngreso === o.v ? "border-kiri-emerald bg-kiri-emerald/5" : "border-muted hover:border-kiri-emerald/30")}>
                      <o.icon className={cn("h-5 w-5", tipoIngreso === o.v ? "text-kiri-emerald" : "text-muted-foreground")} />
                      <p className="text-sm font-bold leading-tight">{o.t}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{o.d}</p>
                    </button>
                  ))}
                </div>

                {tipoIngreso === "variable" && (
                  <div className="rounded-2xl bg-kiri-emerald/5 border border-kiri-emerald/20 p-4 text-xs text-muted-foreground space-y-1.5">
                    <p className="font-bold text-foreground">{tr("¡Perfecto! No necesitas un sueldo fijo.")}</p>
                    <p>{tr("Cada vez que te entre plata la registras (o se la dictas a Kiri) y Kiri organiza tus gastos con lo que de verdad tienes. Con el tiempo aprende tu promedio para planear mejor tus meses.")}</p>
                  </div>
                )}

                {tipoIngreso === "fijo" && (
                <div className="space-y-3">
                <p className="text-xs font-bold">{tr("¿Cada cuánto te pagan?")}</p>
                  <button
                    onClick={() => setFrecuencia("mensual")}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left",
                      frecuencia === "mensual"
                        ? "border-kiri-emerald bg-kiri-emerald/5"
                        : "border-muted hover:border-kiri-emerald/30"
                    )}
                  >
                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      frecuencia === "mensual" ? "border-kiri-emerald" : "border-muted-foreground"
                    )}>
                      {frecuencia === "mensual" && <div className="h-2.5 w-2.5 rounded-full bg-kiri-emerald" />}
                    </div>
                    <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-bold">{tr("Mensual")}</p>
                      <p className="text-[10px] text-muted-foreground">{tr("Una vez al mes")}</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setFrecuencia("quincenal")}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left",
                      frecuencia === "quincenal"
                        ? "border-kiri-emerald bg-kiri-emerald/5"
                        : "border-muted hover:border-kiri-emerald/30"
                    )}
                  >
                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      frecuencia === "quincenal" ? "border-kiri-emerald" : "border-muted-foreground"
                    )}>
                      {frecuencia === "quincenal" && <div className="h-2.5 w-2.5 rounded-full bg-kiri-emerald" />}
                    </div>
                    <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-bold">{tr("Quincenal")}</p>
                      <p className="text-[10px] text-muted-foreground">{tr("Cada 15 días")}</p>
                    </div>
                  </button>
                </div>
                )}

                {/* Fecha(s) de pago — un cuadro si es mensual, dos si es
                    quincenal. Se guardan junto con todo lo demás al terminar
                    el test y quedan reflejadas de inmediato en Gestión
                    (mismo campo que usa el selector de días de pago ahí). */}
                {tipoIngreso === "fijo" && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-bold">
                    {frecuencia === "quincenal" ? tr("¿Qué días te pagan?") : tr("¿Qué día te pagan?")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder={tr("Ej: 15")}
                      value={diaPago1}
                      onChange={e => setDiaPago1(e.target.value)}
                      className="h-11 rounded-xl w-24 text-center font-bold"
                    />
                    {frecuencia === "quincenal" && (
                      <>
                        <span className="text-xs text-muted-foreground font-bold">y</span>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          placeholder={tr("Ej: 30")}
                          value={diaPago2}
                          onChange={e => setDiaPago2(e.target.value)}
                          className="h-11 rounded-xl w-24 text-center font-bold"
                        />
                      </>
                    )}
                  </div>
                </div>
                )}

                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-kiri-emerald" />{tr("Podrás cambiar esto cuando quieras desde Gestión → Billetera.")}</p>
              </div>
            )}

            {/* ═══ PASO 2: Cuánto te entra ═══ */}
            {step === 2 && (() => {
              const [diaA, diaB] = [Number(diaPago1), Number(diaPago2)].sort((a, b) => a - b)
              const variable = tipoIngreso === "variable"
              const distintas = !variable && frecuencia === "quincenal" && !quincenasIguales
              return (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">
                      {variable ? tr("¿Cuánto te entra en un mes normal?") : frecuencia === "quincenal" ? tr("¿Cuánto te pagan cada quincena?") : tr("¿Cuánto te pagan al mes?")}
                    </h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {variable
                    ? tr("Es solo una idea para planear: si no lo sabes, déjalo vacío y Kiri usará tu promedio real apenas registres tus ingresos.")
                    : tr("Esta será la base para calcular tu presupuesto inteligente.")}
                </p>

                {!variable && frecuencia === "quincenal" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">{tr("¿Te pagan lo mismo las dos quincenas?")}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ v: true, t: tr("Sí, lo mismo") }, { v: false, t: tr("No, cambia") }].map(o => (
                        <button key={String(o.v)} onClick={() => setQuincenasIguales(o.v)}
                          className={cn("h-11 rounded-xl border-2 text-sm font-bold transition-colors",
                            quincenasIguales === o.v ? "border-kiri-emerald bg-kiri-emerald/5 text-kiri-emerald" : "border-muted text-muted-foreground")}>
                          {o.t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {distintas ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">{tr("Lo que te pagan el día {0}", [diaA])}</Label>
                      <MoneyInput value={incomeValue} onChange={v => setIncomeValue(v)} className="h-14 text-xl font-bold rounded-2xl" placeholder="0" autoFocus />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">{tr("Lo que te pagan el día {0}", [diaB])}</Label>
                      <MoneyInput value={incomeValue2} onChange={v => setIncomeValue2(v)} className="h-14 text-xl font-bold rounded-2xl" placeholder="0" />
                    </div>
                    {Number(incomeValue) > 0 && Number(incomeValue2) > 0 && (
                      <p className="col-span-2 text-xs text-muted-foreground">{tr("Al mes te entran")}{" "}<strong className="text-foreground">{formatAmount(Number(incomeValue) + Number(incomeValue2))}</strong>{tr(". Cada quincena Kiri usará lo que corresponde a esa fecha.")}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">
                      {variable ? tr("Estimación mensual (opcional)") : frecuencia === "quincenal" ? tr("Lo que te pagan cada quincena") : tr("Tu sueldo del mes")}
                    </Label>
                    <MoneyInput
                      value={incomeValue}
                      onChange={v => setIncomeValue(v)}
                      className="h-14 text-2xl font-bold rounded-2xl"
                      placeholder={variable ? tr("No lo sé") : "0"}
                      autoFocus
                    />
                    {variable && (
                      <button onClick={() => { setIncomeValue(""); goNext() }} className="text-xs font-bold text-kiri-emerald hover:underline">{tr("No lo sé todavía, sigamos →")}</button>
                    )}
                  </div>
                )}

                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-kiri-emerald" />
                  {variable ? tr("Registra cada ingreso cuando te llegue: así Kiri siempre sabe con cuánto cuentas.") : tr("Pon lo que de verdad te llega a la cuenta (después de descuentos).")}
                </p>
              </div>
              )
            })()}

            {/* ═══ PASO 3: Ingreso extra (opcional) ═══ */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">{tipoIngreso === "variable" ? tr("¿Tienes algún ingreso fijo aparte?") : tr("¿Tienes algún ingreso extra?")}</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tipoIngreso === "variable"
                    ? tr("Un arriendo que cobras, una pensión, una mesada… algo que te llegue siempre, además de lo que te entra por tu trabajo.")
                    : tr("Freelance, comisiones, un negocio aparte — cualquier plata que te entre además de tu sueldo base.")}
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => setTieneIngresoExtra(true)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left",
                      tieneIngresoExtra === true
                        ? "border-kiri-emerald bg-kiri-emerald/5"
                        : "border-muted hover:border-kiri-emerald/30"
                    )}
                  >
                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      tieneIngresoExtra === true ? "border-kiri-emerald" : "border-muted-foreground"
                    )}>
                      {tieneIngresoExtra === true && <div className="h-2.5 w-2.5 rounded-full bg-kiri-emerald" />}
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-kiri-emerald shrink-0" />
                    <p className="text-sm font-bold">{tipoIngreso === "variable" ? tr("Sí, tengo un ingreso fijo") : tr("Sí, tengo un ingreso extra")}</p>
                  </button>

                  <button
                    onClick={() => { setTieneIngresoExtra(false); setExtraNombre(""); setExtraMonto("") }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left",
                      tieneIngresoExtra === false
                        ? "border-kiri-emerald bg-kiri-emerald/5"
                        : "border-muted hover:border-kiri-emerald/30"
                    )}
                  >
                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      tieneIngresoExtra === false ? "border-kiri-emerald" : "border-muted-foreground"
                    )}>
                      {tieneIngresoExtra === false && <div className="h-2.5 w-2.5 rounded-full bg-kiri-emerald" />}
                    </div>
                    <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                    <p className="text-sm font-bold">{tipoIngreso === "variable" ? tr("No, solo lo de mi trabajo") : tr("No, solo mi sueldo base")}</p>
                  </button>
                </div>

                {/* Mismo formulario/campos que "Ingreso Extra" en Billetera —
                    se guarda hasta el final del test, junto con todo lo demás. */}
                {tieneIngresoExtra === true && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">{tr("Nombre")}</Label>
                      <Input
                        placeholder={tr("Ej: Freelance, comisiones, venta...")}
                        value={extraNombre}
                        onChange={e => setExtraNombre(e.target.value)}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">{tr("Monto aproximado")}</Label>
                      <MoneyInput
                        value={extraMonto}
                        onChange={v => setExtraMonto(v)}
                        className="h-11 rounded-xl font-bold"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">{tr("¿Con qué frecuencia te entra?")}</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => setExtraTemp("una_vez")}
                          className={cn("h-9 rounded-xl text-[10px] font-bold border-2 transition-colors",
                            extraTemp === "una_vez" ? "bg-kiri-emerald/10 border-kiri-emerald text-kiri-emerald" : "border-muted text-muted-foreground")}>{tr("Una vez")}</button>
                        <button type="button" onClick={() => setExtraTemp("definido")}
                          className={cn("h-9 rounded-xl text-[10px] font-bold border-2 transition-colors",
                            extraTemp === "definido" ? "bg-kiri-emerald/10 border-kiri-emerald text-kiri-emerald" : "border-muted text-muted-foreground")}>{tr("Por un tiempo")}</button>
                        <button type="button" onClick={() => setExtraTemp("indefinido")}
                          className={cn("h-9 rounded-xl text-[10px] font-bold border-2 transition-colors",
                            extraTemp === "indefinido" ? "bg-kiri-emerald/10 border-kiri-emerald text-kiri-emerald" : "border-muted text-muted-foreground")}>{tr("Siempre")}</button>
                      </div>
                    </div>
                    {extraTemp === "definido" && (
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">{tr("¿Por cuántos periodos?")}</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder={tr("Ej: 3")}
                          value={extraMeses}
                          onChange={e => setExtraMeses(e.target.value)}
                          className="h-10 rounded-xl w-24"
                        />
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-kiri-emerald" />{tr("Podrás registrar más ingresos extra cuando quieras desde Gestión.")}</p>
              </div>
            )}

            {/* ═══ PASO 4: Cuánta plata tiene hoy (arranque del Sueldo Real) ═══ */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-kiri-emerald/10 flex items-center justify-center text-kiri-emerald">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">{tr("¿Cuánta plata tienes hoy?")}</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{tr("Suma TODO lo que tienes en este momento: tus cuentas de banco, Nequi, Daviplata, el efectivo… hasta las monedas de la cartera.")}</p>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">{tr("Total que tienes hoy")}</Label>
                  <MoneyInput value={saldoHoy} onChange={v => setSaldoHoy(v)} className="h-14 text-2xl font-bold rounded-2xl" placeholder="0" autoFocus />
                  <button onClick={() => setSaldoHoy("0")}
                    className={cn("text-xs font-bold hover:underline", saldoHoy === "0" ? "text-kiri-emerald" : "text-muted-foreground")}>
                    {saldoHoy === "0" ? tr("✓ Empiezo en $0") : tr("Hoy no tengo nada, empiezo en $0")}
                  </button>
                </div>

                <div className="rounded-2xl bg-kiri-emerald/5 border border-kiri-emerald/20 p-4 space-y-2 text-xs">
                  <p className="font-bold text-foreground">{tr("¿Para qué lo usa Kiri?")}</p>
                  <ul className="space-y-1.5 text-muted-foreground">
                    <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-kiri-emerald shrink-0 mt-px" /><span>{tr("Será tu Sueldo Real en Gestión: el punto de partida de todo.")}</span></li>
                    <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-kiri-emerald shrink-0 mt-px" /><span>{tr("Cada gasto, pago e ingreso que registres lo irá moviendo: siempre sabrás cuánto te queda de verdad.")}</span></li>
                    <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-kiri-emerald shrink-0 mt-px" /><span>{tr("Si un día tu plata real no cuadra con la de Kiri, es que se te escapó un gasto. Así no se te escapa ni uno.")}</span></li>
                  </ul>
                </div>

                <p className="text-[9px] text-muted-foreground flex items-start gap-1">
                  <Sparkles className="h-3 w-3 text-kiri-emerald shrink-0 mt-px" />{tr("No cuentes el cupo de tus tarjetas de crédito: eso es deuda, no plata tuya. Si tienes plata ahorrada aparte, inclúyela y luego la pasas a un bolsillo en Ahorro.")}</p>
              </div>
            )}

            {/* ═══ PASO 5: Situación de deudas ═══ */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">{tr("¿Tienes deudas u obligaciones financieras activas?")}</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{tr("Esto nos permitirá darte recomendaciones más personalizadas desde el inicio.")}</p>

                <div className="space-y-3">
                  <button
                    onClick={() => setTieneDeudas(true)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left",
                      tieneDeudas === true
                        ? "border-kiri-emerald bg-kiri-emerald/5"
                        : "border-muted hover:border-kiri-emerald/30"
                    )}
                  >
                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      tieneDeudas === true ? "border-kiri-emerald" : "border-muted-foreground"
                    )}>
                      {tieneDeudas === true && <div className="h-2.5 w-2.5 rounded-full bg-kiri-emerald" />}
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-kiri-emerald shrink-0" />
                    <div>
                      <p className="text-sm font-bold">{tr("Sí, tengo deudas o obligaciones")}</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setTieneDeudas(false)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left",
                      tieneDeudas === false
                        ? "border-kiri-emerald bg-kiri-emerald/5"
                        : "border-muted hover:border-kiri-emerald/30"
                    )}
                  >
                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      tieneDeudas === false ? "border-kiri-emerald" : "border-muted-foreground"
                    )}>
                      {tieneDeudas === false && <div className="h-2.5 w-2.5 rounded-full bg-kiri-emerald" />}
                    </div>
                    <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-bold">{tr("No, estoy libre de deudas")}</p>
                    </div>
                  </button>
                </div>

                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-kiri-emerald" />{tr("No te preocupes, podrás registrar tus deudas más adelante si cambias de opinión.")}</p>
              </div>
            )}

            {/* ═══ PASO 6: Registrar deudas/gastos fijos ═══ */}
            {step === 6 && (
              <div className="space-y-5">
                {/* Si aún no eligió si quiere registrar */}
                {quiereRegistrar === null && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <ReceiptText className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black">{tr("¿Quieres registrar tus deudas y gastos fijos ahora?")}</h2>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{tr("Puedes agregar tus compromisos financieros uno por uno para que Kiri los tenga en cuenta desde el primer día.")}</p>

                    <div className="space-y-3">
                      <button
                        onClick={() => setQuiereRegistrar(true)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left",
                          "border-muted hover:border-kiri-emerald/30"
                        )}
                      >
                        <div className="h-8 w-8 rounded-xl bg-kiri-emerald/10 flex items-center justify-center text-kiri-emerald shrink-0">
                          <Plus className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{tr("Sí, registrar ahora")}</p>
                          <p className="text-[10px] text-muted-foreground">{tr("Agrega tus deudas y gastos fijos uno por uno")}</p>
                        </div>
                      </button>

                      <button
                        onClick={() => { setQuiereRegistrar(false); setStep(7) }}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left",
                          "border-muted hover:border-kiri-emerald/30"
                        )}
                      >
                        <div className="h-8 w-8 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground shrink-0">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{tr("Más tarde")}</p>
                          <p className="text-[10px] text-muted-foreground">{tr("Puedes hacerlo después desde Obligaciones")}</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}

                {/* Formulario de registro individual */}
                {quiereRegistrar === true && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-kiri-emerald/10 flex items-center justify-center text-kiri-emerald">
                        <Plus className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black">{tr("Registrar obligación")}</h2>
                        <p className="text-[10px] text-muted-foreground">
                          {obligations.length === 0
                            ? tr("Agrega tu primera deuda o gasto fijo")
                            : `${obligations.length} registrada${obligations.length > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>

                    {/* Lista de ya registradas */}
                    {obligations.length > 0 && (
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                        {obligations.map(ob => (
                          <div key={ob.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-kiri-emerald/5 border border-kiri-emerald/20">
                            <CheckCircle2 className="h-3.5 w-3.5 text-kiri-emerald shrink-0" />
                            <span className="text-xs font-bold flex-1 truncate">{ob.nombre}</span>
                            <span className="text-[10px] text-muted-foreground capitalize">{ob.tipo === "gasto_fijo" ? tr("Gasto fijo") : tr("Deuda")}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tipo toggle */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentObligation(prev => ({ ...prev, tipo: "deuda" }))}
                        className={cn(
                          "h-10 rounded-xl text-xs font-bold border-2 transition-colors",
                          currentObligation.tipo === "deuda"
                            ? "bg-kiri-emerald/10 border-kiri-emerald text-kiri-emerald"
                            : "border-muted text-muted-foreground"
                        )}
                      >
                        <Landmark className="h-3.5 w-3.5 inline mr-1" />{tr("Deuda")}</button>
                      <button
                        type="button"
                        onClick={() => setCurrentObligation(prev => ({ ...prev, tipo: "gasto_fijo" }))}
                        className={cn(
                          "h-10 rounded-xl text-xs font-bold border-2 transition-colors",
                          currentObligation.tipo === "gasto_fijo"
                            ? "bg-kiri-emerald/10 border-kiri-emerald text-kiri-emerald"
                            : "border-muted text-muted-foreground"
                        )}
                      >
                        <ReceiptText className="h-3.5 w-3.5 inline mr-1" />{tr("Gasto fijo")}</button>
                    </div>

                    {/* Nombre */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">{tr("Nombre")}</Label>
                      <Input
                        placeholder={currentObligation.tipo === "deuda" ? tr("Ej: Préstamo banco, Cuota moto...") : tr("Ej: Netflix, Arriendo, Luz...")}
                        value={currentObligation.nombre}
                        onChange={e => setCurrentObligation(prev => ({ ...prev, nombre: e.target.value }))}
                        className="h-10 rounded-xl"
                      />
                    </div>

                    {/* Monto mensual */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">
                        {currentObligation.tipo === "deuda" ? tr("Cuota mensual") : tr("Monto mensual")}
                      </Label>
                      <MoneyInput
                        value={currentObligation.monto}
                        onChange={v => setCurrentObligation(prev => ({ ...prev, monto: v }))}
                        className="h-11 rounded-xl font-bold"
                        placeholder="0"
                      />
                    </div>

                    {currentObligation.tipo === "deuda" && (
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">{tr("¿Cuánto debes en total?")}{" "}<span className="font-normal text-muted-foreground">{tr("(opcional)")}</span></Label>
                        <MoneyInput
                          value={currentObligation.saldoTotal}
                          onChange={v => setCurrentObligation(prev => ({ ...prev, saldoTotal: v }))}
                          className="h-11 rounded-xl font-bold"
                          placeholder={tr("Saldo pendiente con el banco")}
                        />
                      </div>
                    )}

                    {/* Día de pago */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">{tr("Día de pago (1-31)")}</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        placeholder={tr("Ej: 15")}
                        value={currentObligation.diasPago}
                        onChange={e => setCurrentObligation(prev => ({ ...prev, diasPago: e.target.value }))}
                        className="h-10 rounded-xl w-24"
                      />
                    </div>

                    {dueKind && (
                      <DueQuestion kind={dueKind} yaPago={dueFlags.yaPago} nueva={dueFlags.nueva} onChange={setDueFlags} />
                    )}

                    {/* Botones de acción */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        onClick={() => { handleSaveObligation() }}
                        disabled={!currentObligation.nombre || !currentObligation.monto || savingObligation}
                        className="flex-1 h-10 rounded-xl bg-kiri-emerald text-white font-bold text-xs gap-1"
                      >
                        {savingObligation ? "Guardando..." : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />{tr("Guardar y agregar otra")}</>
                        )}
                      </Button>
                    </div>

                    {obligationError && (
                      <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg p-2 text-center">{obligationError}</p>
                    )}

                    {/* Volver / continuar */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setQuiereRegistrar(null)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />{" "}{tr("Volver")}</button>
                      <button
                        onClick={continuarDesdeRegistro}
                        disabled={savingObligation}
                        className="text-xs font-bold text-kiri-emerald hover:underline py-2 disabled:opacity-50"
                      >
                        {obligations.length > 0 || (currentObligation.nombre && currentObligation.monto) ? tr("Continuar →") : tr("Continuar después →")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══ PASO 7: Finalización ═══ */}
            {step === 7 && (
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="h-40 w-40 rounded-full bg-kiri-emerald/5 border-2 border-kiri-emerald/20 flex items-center justify-center relative">
                  <span className="text-7xl">🌱</span>
                  <div className="absolute -top-2 -right-2 text-2xl">✨</div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-black">{tr("¡Listo, Kiri te conoce mejor!")}</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tr("Con esta información personalizaremos tu experiencia y te ayudaremos a hacer crecer tu jardín financiero.")}</p>
                </div>

                {Number(saldoHoy) > 0 && (
                  <div className="w-full bg-kiri-emerald/5 rounded-xl p-3 text-left">
                    <p className="text-[10px] font-bold text-kiri-emerald uppercase mb-1">{tr("Tu Sueldo Real arranca en")}</p>
                    <p className="text-lg font-black">{formatAmount(Number(saldoHoy))}</p>
                  </div>
                )}

                {obligations.length > 0 && (
                  <div className="w-full bg-kiri-emerald/5 rounded-xl p-3 text-left">
                    <p className="text-[10px] font-bold text-kiri-emerald uppercase mb-1">{tr("Registraste:")}</p>
                    <p className="text-xs text-muted-foreground">
                      {obligations.filter(o => o.tipo === "deuda").length}{" "}{tr("deuda")}{obligations.filter(o => o.tipo === "deuda").length !== 1 ? "s" : ""}
                      {" · "}
                      {obligations.filter(o => o.tipo === "gasto_fijo").length}{" "}{tr("gasto")}{obligations.filter(o => o.tipo === "gasto_fijo").length !== 1 ? "s" : ""}{" "}{tr("fijo")}{obligations.filter(o => o.tipo === "gasto_fijo").length !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}

                <div className="w-full space-y-3 text-left">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-kiri-emerald/5">
                    <div className="h-8 w-8 rounded-lg bg-kiri-emerald/20 flex items-center justify-center text-kiri-emerald shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">{tr("Recomendaciones personalizadas")}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-kiri-emerald/5">
                    <div className="h-8 w-8 rounded-lg bg-kiri-emerald/20 flex items-center justify-center text-kiri-emerald shrink-0">
                      <Target className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">{tr("Metas adaptadas a ti")}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-kiri-emerald/5">
                    <div className="h-8 w-8 rounded-lg bg-kiri-emerald/20 flex items-center justify-center text-kiri-emerald shrink-0">
                      <Brain className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">{tr("Consejos inteligentes con IA")}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-4 shrink-0 space-y-2">
        {step === 0 ? (
          <Button
            onClick={goNext}
            className="w-full h-12 rounded-2xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold text-sm shadow-lg shadow-kiri-emerald/30"
          >{tr("Comenzar test")}</Button>
        ) : step === 7 ? (
          <Button
            onClick={handleFinish}
            disabled={saving}
            className="w-full h-12 rounded-2xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold text-sm shadow-lg shadow-kiri-emerald/30 gap-2"
          >
            {saving ? "Guardando..." : tr("Comenzar mi viaje en Kiri 🚀")}
          </Button>
        ) : step === 6 && quiereRegistrar === true ? (
          // No mostrar footer de navegación estándar cuando está en modo registro
          null
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />{" "}{tr("Volver")}</button>
            <Button
              onClick={goNext}
              disabled={!canNext()}
              size="sm"
              className="rounded-xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold text-xs gap-1 px-5 h-10"
            >{tr("Siguiente")}{" "}<ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
