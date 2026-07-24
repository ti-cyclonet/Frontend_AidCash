"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Wallet, ReceiptText, PieChart,
  ArrowRight, Sparkles, X, ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"

interface WelcomeOnboardingProps {
  onComplete: () => void
}

// ─── Steps data ───────────────────────────────────────────────────────────────

const steps = [
  {
    id: 1,
    title: "¡Bienvenido a",
    titleHighlight: "Kiri Finance!",
    description: "Tu aliado para tomar el control de tus finanzas y hacer florecer tu jardín financiero.",
    cardTitle: "Sueldo Real (Disponible)",
    cardSubtitle: "Tu dinero, en tus manos.",
    cardExplanation: "Este es el dinero que tienes actualmente en tu cuenta y en tu bolsillo.",
    cardTip: "Registrar tu Sueldo Real es vital para saber qué es lo que te va quedando tras cada gasto.",
    cardCta: "+ Registrar Ingreso",
    icon: <Wallet className="h-6 w-6" />,
    accentColor: "from-emerald-500/20 to-emerald-600/5",
  },
  {
    id: 2,
    title: "Registra tus",
    titleHighlight: "Obligaciones",
    description: "Lleva el control de tus pagos pendientes y compromisos.",
    cardExplanation: "Así podrás visualizar tu balance real antes de gastar y evitar sorpresas.",
    icon: <ReceiptText className="h-6 w-6" />,
    accentColor: "from-amber-500/20 to-amber-600/5",
  },
  {
    id: 3,
    title: "Crea tu",
    titleHighlight: "Presupuesto\ny Categorías",
    description: "Divide tu dinero en categorías y establece límites de gasto.",
    cardExplanation: "Así tendrás control total y sabrás exactamente a dónde va cada centavo.",
    icon: <PieChart className="h-6 w-6" />,
    accentColor: "from-blue-500/20 to-blue-600/5",
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const { formatAmount } = useAppContext()

  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1
  const isFirst = currentStep === 0

  const next = () => {
    if (isLast) {
      onComplete()
    } else {
      setCurrentStep(s => s + 1)
    }
  }

  const prev = () => {
    if (!isFirst) setCurrentStep(s => s - 1)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-[#0a1a14] border border-emerald-900/30 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-950/50"
      >
        {/* Close button */}
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="px-6 pt-5">
          <div className="flex items-center gap-2">
            {steps.map((_, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                  i <= currentStep
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-muted-foreground"
                )}>
                  {i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: i < currentStep ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-4 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="flex-1 flex flex-col"
            >
              {/* Step 1: Welcome + Sueldo Real */}
              {currentStep === 0 && (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left: text */}
                  <div className="flex flex-col justify-center space-y-3">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <span className="text-3xl">🌱</span>
                    </div>
                    <h2 className="text-xl font-black leading-tight">
                      {step.title}{" "}
                      <span className="text-emerald-400">{step.titleHighlight}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Right: card */}
                  <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/20 border border-emerald-800/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{step.cardTitle}</p>
                        <p className="text-[9px] text-muted-foreground">{step.cardSubtitle}</p>
                      </div>
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Wallet className="h-4 w-4" />
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] text-muted-foreground mb-0.5">Disponible ahora</p>
                      <p className="text-2xl font-black text-white">$3,750,000</p>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {step.cardExplanation}
                    </p>

                    <p className="text-[10px] text-emerald-300/80 leading-relaxed">
                      {step.cardTip}
                    </p>

                    <div className="pt-1">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        <Sparkles className="h-3 w-3" />
                        {step.cardCta}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Obligaciones */}
              {currentStep === 1 && (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left: text */}
                  <div className="flex flex-col justify-center space-y-3">
                    <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                      <span className="text-3xl">📋</span>
                    </div>
                    <h2 className="text-xl font-black leading-tight">
                      {step.title}{" "}
                      <span className="text-amber-400">{step.titleHighlight}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                    <p className="text-xs text-amber-300/70 leading-relaxed">
                      {step.cardExplanation}
                    </p>
                  </div>

                  {/* Right: sample obligations */}
                  <div className="bg-gradient-to-br from-amber-900/20 to-amber-950/10 border border-amber-800/20 rounded-2xl p-4 space-y-3">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Próximos pagos</p>
                    <div className="space-y-2.5">
                      {[
                        { name: "Renta", date: "15 Jul 2026", amount: "$1,200,000", icon: "✅" },
                        { name: "Internet", date: "18 Jul 2026", amount: "$80,000", icon: "🌐" },
                        { name: "Tarjeta de crédito", date: "22 Jul 2026", amount: "$250,000", icon: "💳" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                          <span className="text-sm">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{item.name}</p>
                            <p className="text-[9px] text-muted-foreground">{item.date}</p>
                          </div>
                          <span className="text-xs font-bold shrink-0">{item.amount}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-1 text-center">
                      <span className="text-[9px] text-amber-400/70 font-medium">Ver todas las obligaciones →</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Presupuesto y Categorías */}
              {currentStep === 2 && (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left: text */}
                  <div className="flex flex-col justify-center space-y-3">
                    <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                      <span className="text-3xl">📊</span>
                    </div>
                    <h2 className="text-xl font-black leading-tight">
                      {step.title}{" "}
                      <span className="text-blue-400 whitespace-pre-line">{step.titleHighlight}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                    <p className="text-xs text-blue-300/70 leading-relaxed">
                      {step.cardExplanation}
                    </p>
                  </div>

                  {/* Right: donut chart preview */}
                  <div className="bg-gradient-to-br from-blue-900/20 to-blue-950/10 border border-blue-800/20 rounded-2xl p-4 space-y-3">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Distribución actual</p>

                    {/* Mini donut chart (SVG) */}
                    <div className="flex justify-center">
                      <div className="relative w-[120px] h-[120px]">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#10b981" strokeWidth="14"
                            strokeDasharray="66 220" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#3b82f6" strokeWidth="14"
                            strokeDasharray="52.8 220" strokeDashoffset="-66" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#a855f7" strokeWidth="14"
                            strokeDasharray="44 220" strokeDashoffset="-118.8" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#6b7280" strokeWidth="14"
                            strokeDasharray="44 220" strokeDashoffset="-162.8" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[8px] text-muted-foreground">Total gastado</span>
                          <span className="text-sm font-black">$2,950,000</span>
                          <span className="text-[8px] text-amber-400 font-bold">68%</span>
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-1.5">
                      {[
                        { name: "Alimentación", pct: "36%", amount: "$1,260,000", color: "bg-emerald-500" },
                        { name: "Transporte", pct: "24%", amount: "$860,000", color: "bg-blue-500" },
                        { name: "Ocio / Antojos", pct: "20%", amount: "$590,000", color: "bg-purple-500" },
                        { name: "Otros", pct: "20%", amount: "$500,000", color: "bg-gray-500" },
                      ].map((cat, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full shrink-0", cat.color)} />
                          <span className="text-[9px] flex-1 truncate">{cat.name}</span>
                          <span className="text-[9px] text-muted-foreground">{cat.pct}</span>
                          <span className="text-[9px] font-bold">{cat.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer: navigation */}
          <div className="flex items-center justify-between pt-5 mt-auto">
            {/* Left: Skip/Back */}
            {isFirst ? (
              <button
                onClick={onComplete}
                className="text-xs text-muted-foreground hover:text-white transition-colors"
              >
                Saltar
              </button>
            ) : (
              <button
                onClick={prev}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Atrás
              </button>
            )}

            {/* Center: dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i === currentStep ? "w-6 bg-emerald-500" : "w-2 bg-white/20"
                  )}
                />
              ))}
            </div>

            {/* Right: Next/Complete */}
            {isLast ? (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Button
                  onClick={onComplete}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-5 gap-1.5 shadow-lg shadow-emerald-500/30"
                >
                  ¡Comenzar ahora! <Sparkles className="h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Button
                  onClick={next}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-5 gap-1.5"
                >
                  Siguiente <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </div>

          {/* Last step: CTA hint */}
          {isLast && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 text-center"
            >
              <p className="text-[10px] text-muted-foreground">
                👆 Tu primer paso: Haz clic en &quot;<span className="text-emerald-400 font-bold">+ Registrar Ingreso</span>&quot; para añadir tu Sueldo Real (Disponible).
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
