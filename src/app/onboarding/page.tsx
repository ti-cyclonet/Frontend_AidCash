"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useAuth } from "@/lib/auth-context"
import {
  ChevronRight, ChevronLeft, Clock, Shield,
  Calendar, CalendarDays, Wallet, PiggyBank,
  CheckCircle2, XCircle, Sparkles, Rocket, Target, Brain,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Pasos del test ───────────────────────────────────────────────────────────

const STEPS = [
  "Bienvenida",
  "Frecuencia de ingresos",
  "Sueldo base",
  "Meta de ahorro",
  "Situación de deudas",
  "Finalización",
]

export default function OnboardingPage() {
  const router = useRouter()
  const { setIncome, setOnboardingDone, setUser, user, setIncomeFrequency } = useAppContext()
  const { updateUserProfile } = useFinanceData()
  const { user: authUser } = useAuth()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Form data
  const [frecuencia, setFrecuencia] = useState<"mensual" | "quincenal">("mensual")
  const [incomeValue, setIncomeValue] = useState("")
  const [metaAhorro, setMetaAhorro] = useState("")
  const [tieneDeudas, setTieneDeudas] = useState<boolean | null>(null)

  const totalSteps = STEPS.length
  const isFirst = step === 0
  const isLast = step === totalSteps - 1

  // ── Navegación ────────────────────────────────────────────────────────────
  const goNext = () => {
    if (isLast) {
      handleFinish()
    } else {
      setStep(s => s + 1)
    }
  }

  const goPrev = () => {
    if (!isFirst) setStep(s => s - 1)
  }

  const canNext = () => {
    if (step === 1) return true // frecuencia siempre tiene un valor
    if (step === 2) return !!incomeValue && Number(incomeValue) > 0
    if (step === 3) return true // meta es opcional
    if (step === 4) return tieneDeudas !== null
    return true
  }

  // ── Finalizar y guardar ───────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true)
    try {
      const parsedIncome = Number(incomeValue) || 0
      const parsedMeta = Number(metaAhorro) || 5000

      await updateUserProfile({
        ingreso_base: parsedIncome,
        frecuencia_ingreso: frecuencia,
        meta_ahorro_global: parsedMeta,
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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Progress bar ── */}
      <div className="px-6 pt-6 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i <= step ? "bg-kiri-emerald flex-1" : "bg-muted/30 flex-1"
              )}
            />
          ))}
        </div>
        {step > 0 && step < totalSteps - 1 && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Paso {step} de {totalSteps - 2}
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
                {/* Logo Kiri */}
                <div className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                  <span className="text-kiri-emerald">🌱</span> Kiri Finance
                </div>

                {/* Planta */}
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

            {/* ═══ PASO 3: Meta de ahorro ═══ */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500">
                    <PiggyBank className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">¿Cuánto dinero te gustaría alcanzar como meta de ahorro inicial?</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta será tu meta global de ahorro y la verás crecer con el tiempo.
                </p>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Ingresa tu meta de ahorro</Label>
                  <MoneyInput
                    value={metaAhorro}
                    onChange={v => setMetaAhorro(v)}
                    className="h-14 text-2xl font-bold rounded-2xl"
                    placeholder="0"
                  />
                </div>

                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-kiri-emerald" />
                  Puedes ajustar o crear metas más específicas más adelante.
                </p>
              </div>
            )}

            {/* ═══ PASO 4: Situación de deudas ═══ */}
            {step === 4 && (
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

            {/* ═══ PASO 5: Finalización ═══ */}
            {step === 5 && (
              <div className="flex flex-col items-center text-center space-y-6">
                {/* Planta con confetti */}
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
        ) : isLast ? (
          <Button
            onClick={goNext}
            disabled={saving}
            className="w-full h-12 rounded-2xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold text-sm shadow-lg shadow-kiri-emerald/30 gap-2"
          >
            {saving ? "Guardando..." : "Comenzar mi viaje en Kiri 🚀"}
          </Button>
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
