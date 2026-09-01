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
  Plus, Trash2, ReceiptText, Landmark,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Pasos del test ───────────────────────────────────────────────────────────

const STEPS = [
  "Bienvenida",
  "Frecuencia de ingresos",
  "Sueldo base",
  "Situación de deudas",
  "Registrar deudas",         // nuevo paso intermedio
  "Finalización",
]

// Tipo para deudas/gastos fijos registrados en onboarding
interface OnboardingObligation {
  id: string
  tipo: "deuda" | "gasto_fijo"
  nombre: string
  monto: string
  diasPago: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const { setIncome, setOnboardingDone, setUser, user, setIncomeFrequency } = useAppContext()
  const { updateUserProfile, addDebt, addFixedExpense } = useFinanceData()
  const { user: authUser } = useAuth()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Form data
  const [frecuencia, setFrecuencia] = useState<"mensual" | "quincenal">("mensual")
  const [incomeValue, setIncomeValue] = useState("")
  const [metaAhorro, setMetaAhorro] = useState("")
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
  })
  const [savingObligation, setSavingObligation] = useState(false)

  const totalSteps = STEPS.length
  const isFirst = step === 0
  const isLast = step === totalSteps - 1

  // ── Navegación ────────────────────────────────────────────────────────────
  const goNext = () => {
    if (isLast) {
      handleFinish()
    } else {
      // Si no tiene deudas o no quiere registrar, saltar el paso de registro
      if (step === 3) {
        if (tieneDeudas === false) {
          setStep(5) // saltar a finalización
          return
        }
        // Si tiene deudas, va al paso 4 (pregunta de registrar)
        setStep(4)
        return
      }
      if (step === 4 && quiereRegistrar === false) {
        setStep(5) // saltar a finalización
        return
      }
      setStep(s => s + 1)
    }
  }

  const goPrev = () => {
    if (!isFirst) {
      // Ajustar navegación hacia atrás
      if (step === 5) {
        if (tieneDeudas === false) {
          setStep(3)
          return
        }
        if (quiereRegistrar === false) {
          setStep(4)
          return
        }
        setStep(4)
        return
      }
      setStep(s => s - 1)
    }
  }

  const canNext = () => {
    if (step === 1) return true
    if (step === 2) return !!incomeValue && Number(incomeValue) > 0
    if (step === 3) return tieneDeudas !== null
    if (step === 4) return quiereRegistrar !== null
    return true
  }

  // ── Guardar obligación individual ─────────────────────────────────────────
  const handleSaveObligation = async () => {
    if (!currentObligation.nombre || !currentObligation.monto) return
    setSavingObligation(true)

    try {
      if (currentObligation.tipo === "deuda") {
        await addDebt({
          nombre: currentObligation.nombre,
          montoTotal: Number(currentObligation.monto),
          cuotaPeriodo: Number(currentObligation.monto),
          diasPago: currentObligation.diasPago || "1",
          frecuenciaPago: frecuencia,
        })
      } else {
        await addFixedExpense({
          nombre: currentObligation.nombre,
          monto: Number(currentObligation.monto),
          fechaCorte: currentObligation.diasPago || "1",
          frecuencia,
        })
      }

      setObligations(prev => [...prev, currentObligation])
      // Reset para la siguiente
      setCurrentObligation({
        id: crypto.randomUUID(),
        tipo: "deuda",
        nombre: "",
        monto: "",
        diasPago: "",
      })
    } catch (e) {
      // silently handle
    }
    setSavingObligation(false)
  }

  // ── Finalizar y guardar ───────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true)
    try {
      const rawIncome = Number(incomeValue) || 0
      const parsedIncome = frecuencia === "quincenal" ? rawIncome * 2 : rawIncome

      await updateUserProfile({
        ingreso_base: parsedIncome,
        frecuencia_ingreso: frecuencia,
        onboarding_done: true,
      })

      if (parsedIncome > 0) setIncome(parsedIncome)
      setIncomeFrequency(frecuencia)
      setOnboardingDone(true)
      router.replace("/dashboard")
    } catch {
      setSaving(false)
    }
  }

  // Calcula el paso visual (para la progress bar)
  const visualStep = step >= 5 ? 4 : step >= 4 ? 3 : step
  const visualTotalSteps = 5

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
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Paso {Math.min(visualStep, 3)} de 3
          </p>
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
                  <span className="text-kiri-emerald">🌱</span> Kiri Finance
                </div>

                <div className="h-40 w-40 rounded-full bg-kiri-emerald/5 border-2 border-kiri-emerald/20 flex items-center justify-center">
                  <span className="text-7xl">🌱</span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-black">¡Bienvenido a Kiri! 🌱</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
                    Este test inicial nos ayudará a conocerte mejor para ofrecerte una experiencia personalizada y consejos que realmente te servirán.
                  </p>
                </div>

                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-kiri-emerald" /> 2-3 min
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-kiri-emerald" /> 100% confidencial
                  </span>
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
                    <h2 className="text-lg font-black">¿Con qué frecuencia recibes tus ingresos principales?</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esto nos ayudará a organizar tu presupuesto correctamente.
                </p>

                <div className="space-y-3">
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
                      <p className="text-sm font-bold">Mensual</p>
                      <p className="text-[10px] text-muted-foreground">Una vez al mes</p>
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
                      <p className="text-sm font-bold">Quincenal</p>
                      <p className="text-[10px] text-muted-foreground">Cada 15 días</p>
                    </div>
                  </button>
                </div>

                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-kiri-emerald" />
                  Podrás cambiar esto cuando quieras desde configuración.
                </p>
              </div>
            )}

            {/* ═══ PASO 2: Sueldo base ═══ */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">¿Cuál es tu ingreso base, aproximado por periodo?</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta será la base para calcular tu presupuesto inteligente.
                </p>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Ingresa tu sueldo {frecuencia === "quincenal" ? "quincenal" : "mensual"}</Label>
                  <MoneyInput
                    value={incomeValue}
                    onChange={v => setIncomeValue(v)}
                    className="h-14 text-2xl font-bold rounded-2xl"
                    placeholder="0"
                    autoFocus
                  />
                </div>

                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-kiri-emerald" />
                  Ingresa el valor antes de impuestos de lo que recibes en cada periodo.
                </p>
              </div>
            )}

            {/* ═══ PASO 3: Situación de deudas ═══ */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">¿Tienes deudas u obligaciones financieras activas?</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esto nos permitirá darte recomendaciones más personalizadas desde el inicio.
                </p>

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
                      <p className="text-sm font-bold">Sí, tengo deudas o obligaciones</p>
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
                      <p className="text-sm font-bold">No, estoy libre de deudas</p>
                    </div>
                  </button>
                </div>

                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-kiri-emerald" />
                  No te preocupes, podrás registrar tus deudas más adelante si cambias de opinión.
                </p>
              </div>
            )}

            {/* ═══ PASO 4: Registrar deudas/gastos fijos ═══ */}
            {step === 4 && (
              <div className="space-y-5">
                {/* Si aún no eligió si quiere registrar */}
                {quiereRegistrar === null && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <ReceiptText className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black">¿Quieres registrar tus deudas y gastos fijos ahora?</h2>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Puedes agregar tus compromisos financieros uno por uno para que Kiri los tenga en cuenta desde el primer día.
                    </p>

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
                          <p className="text-sm font-bold">Sí, registrar ahora</p>
                          <p className="text-[10px] text-muted-foreground">Agrega tus deudas y gastos fijos uno por uno</p>
                        </div>
                      </button>

                      <button
                        onClick={() => setQuiereRegistrar(false)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-left",
                          "border-muted hover:border-kiri-emerald/30"
                        )}
                      >
                        <div className="h-8 w-8 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground shrink-0">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Más tarde</p>
                          <p className="text-[10px] text-muted-foreground">Puedes hacerlo después desde Obligaciones</p>
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
                        <h2 className="text-lg font-black">Registrar obligación</h2>
                        <p className="text-[10px] text-muted-foreground">
                          {obligations.length === 0
                            ? "Agrega tu primera deuda o gasto fijo"
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
                            <span className="text-[10px] text-muted-foreground capitalize">{ob.tipo === "gasto_fijo" ? "Gasto fijo" : "Deuda"}</span>
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
                        <Landmark className="h-3.5 w-3.5 inline mr-1" />
                        Deuda
                      </button>
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
                        <ReceiptText className="h-3.5 w-3.5 inline mr-1" />
                        Gasto fijo
                      </button>
                    </div>

                    {/* Nombre */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">Nombre</Label>
                      <Input
                        placeholder={currentObligation.tipo === "deuda" ? "Ej: Préstamo banco, Cuota moto..." : "Ej: Netflix, Arriendo, Luz..."}
                        value={currentObligation.nombre}
                        onChange={e => setCurrentObligation(prev => ({ ...prev, nombre: e.target.value }))}
                        className="h-10 rounded-xl"
                      />
                    </div>

                    {/* Monto (cuota mensual/quincenal) */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">
                        {currentObligation.tipo === "deuda" ? "Cuota por periodo" : "Monto"}
                      </Label>
                      <MoneyInput
                        value={currentObligation.monto}
                        onChange={v => setCurrentObligation(prev => ({ ...prev, monto: v }))}
                        className="h-11 rounded-xl font-bold"
                        placeholder="0"
                      />
                    </div>

                    {/* Día de pago */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">Día de pago (1-31)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Ej: 15"
                        value={currentObligation.diasPago}
                        onChange={e => setCurrentObligation(prev => ({ ...prev, diasPago: e.target.value }))}
                        className="h-10 rounded-xl w-24"
                      />
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        onClick={handleSaveObligation}
                        disabled={!currentObligation.nombre || !currentObligation.monto || savingObligation}
                        className="flex-1 h-10 rounded-xl bg-kiri-emerald text-white font-bold text-xs gap-1"
                      >
                        {savingObligation ? "Guardando..." : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Guardar y agregar otra
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Botón para continuar */}
                    <button
                      onClick={() => setStep(5)}
                      className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                    >
                      {obligations.length > 0 ? "Continuar →" : "Continuar después →"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ═══ PASO 5: Finalización ═══ */}
            {step === 5 && (
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="h-40 w-40 rounded-full bg-kiri-emerald/5 border-2 border-kiri-emerald/20 flex items-center justify-center relative">
                  <span className="text-7xl">🌱</span>
                  <div className="absolute -top-2 -right-2 text-2xl">✨</div>
                  <div className="absolute -bottom-1 -left-2 text-xl">🎉</div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-black">¡Listo, Kiri te conoce mejor! 🎉</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
                    Con esta información personalizaremos tu experiencia y te ayudaremos a hacer crecer tu jardín financiero.
                  </p>
                </div>

                {obligations.length > 0 && (
                  <div className="w-full bg-kiri-emerald/5 rounded-xl p-3 text-left">
                    <p className="text-[10px] font-bold text-kiri-emerald uppercase mb-1">Registraste:</p>
                    <p className="text-xs text-muted-foreground">
                      {obligations.filter(o => o.tipo === "deuda").length} deuda{obligations.filter(o => o.tipo === "deuda").length !== 1 ? "s" : ""}
                      {" · "}
                      {obligations.filter(o => o.tipo === "gasto_fijo").length} gasto{obligations.filter(o => o.tipo === "gasto_fijo").length !== 1 ? "s" : ""} fijo{obligations.filter(o => o.tipo === "gasto_fijo").length !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}

                <div className="w-full space-y-3 text-left">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-kiri-emerald/5">
                    <div className="h-8 w-8 rounded-lg bg-kiri-emerald/20 flex items-center justify-center text-kiri-emerald shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">Recomendaciones personalizadas</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-kiri-emerald/5">
                    <div className="h-8 w-8 rounded-lg bg-kiri-emerald/20 flex items-center justify-center text-kiri-emerald shrink-0">
                      <Target className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">Metas adaptadas a ti</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-kiri-emerald/5">
                    <div className="h-8 w-8 rounded-lg bg-kiri-emerald/20 flex items-center justify-center text-kiri-emerald shrink-0">
                      <Brain className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">Consejos inteligentes con IA</span>
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
          >
            Comenzar test
          </Button>
        ) : step === 5 ? (
          <Button
            onClick={handleFinish}
            disabled={saving}
            className="w-full h-12 rounded-2xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold text-sm shadow-lg shadow-kiri-emerald/30 gap-2"
          >
            {saving ? "Guardando..." : "Comenzar mi viaje en Kiri 🚀"}
          </Button>
        ) : step === 4 && quiereRegistrar === true ? (
          // No mostrar footer de navegación estándar cuando está en modo registro
          null
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Volver
            </button>
            <Button
              onClick={goNext}
              disabled={!canNext()}
              size="sm"
              className="rounded-xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold text-xs gap-1 px-5 h-10"
            >
              Siguiente <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
