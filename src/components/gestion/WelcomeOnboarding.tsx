"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Wallet, ReceiptText, PieChart,
  ArrowRight, Sparkles, X, ChevronLeft, Info, ShieldCheck,
  Mic, ScanLine, Bot,
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
    label: "Tu ingreso",
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
    label: "Tus metas",
    title: "Registra tus",
    titleHighlight: "Obligaciones",
    description: "Lleva el control de tus pagos pendientes y compromisos.",
    cardExplanation: "Así podrás visualizar tu balance real antes de gastar y evitar sorpresas.",
    icon: <ReceiptText className="h-6 w-6" />,
    accentColor: "from-amber-500/20 to-amber-600/5",
  },
  {
    id: 3,
    label: "Tus deudas",
    title: "Crea tu",
    titleHighlight: "Presupuesto\ny Categorías",
    description: "Divide tu dinero en categorías y establece límites de gasto.",
    cardExplanation: "Así tendrás control total y sabrás exactamente a dónde va cada centavo.",
    icon: <PieChart className="h-6 w-6" />,
    accentColor: "from-blue-500/20 to-blue-600/5",
  },
  {
    id: 4,
    label: "Registro rápido",
    title: "Registra sin",
    titleHighlight: "escribir nada",
    description: "Dile a Kiri qué gastaste, cuánto ganaste o qué deuda tienes — por voz o con una foto — y él lo ubica solo.",
    cardExplanation: "Todo esto vive en el botón de Kiri Coach 🌱 (abajo a la derecha, o el + de la barra inferior en el celular).",
    icon: <Mic className="h-6 w-6" />,
    accentColor: "from-kiri-emerald/20 to-kiri-forest/5",
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const { formatAmount, income } = useAppContext()

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

  // Sueldo a mostrar: si el usuario ya registró su ingreso, lo usa; si no, muestra ejemplo
  const displayIncome = income > 0 ? income : 3750000

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
        className="relative w-full max-w-3xl bg-white dark:bg-[#0f1f18] border border-gray-200 dark:border-emerald-900/30 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar with labels */}
        <div className="px-6 pt-5">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                    i <= currentStep
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-muted-foreground"
                  )}>
                    {i + 1}
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium hidden sm:inline",
                    i <= currentStep ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-muted-foreground"
                  )}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-0.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
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
                  {/* Left: welcome card with nature bg */}
                  <div className="relative flex flex-col justify-between rounded-2xl overflow-hidden bg-gradient-to-b from-[#0a2e1f] to-[#0f3d28] p-5 min-h-[320px]">
                    {/* Nature background decoration */}
                    <div className="absolute inset-0 opacity-20 bg-gradient-to-t from-emerald-800/40 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-emerald-900/60 to-transparent" />

                    <div className="relative z-10 space-y-3 flex-1 flex flex-col justify-center">
                      <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                        <span className="text-3xl">🌱</span>
                      </div>
                      <h2 className="text-2xl font-black leading-tight text-white">
                        {step.title}{" "}
                        <span className="text-emerald-400">{step.titleHighlight}</span>
                      </h2>
                      <p className="text-sm text-white/70 leading-relaxed">
                        {step.description}
                      </p>
                    </div>

                    {/* Security badge */}
                    <div className="relative z-10 mt-4 flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                      <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-white">Tus datos están seguros</p>
                        <p className="text-[9px] text-white/50">Solo tú puedes ver tu información.</p>
                      </div>
                    </div>
                  </div>

                  {/* Right: card */}
                  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-center">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{step.cardTitle}</p>
                        <p className="text-[9px] text-gray-500 dark:text-gray-400">{step.cardSubtitle}</p>
                      </div>
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Wallet className="h-4 w-4" />
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-0.5">Disponible ahora</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white">
                        {formatAmount(displayIncome)}
                      </p>
                    </div>

                    {/* Info box */}
                    <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2.5">
                      <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-gray-700 dark:text-gray-300 leading-relaxed">
                        {step.cardExplanation}
                      </p>
                    </div>

                    <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">
                      Registrar tu Sueldo Real es vital para{" "}
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        saber qué es lo que te va quedando tras cada gasto.
                      </span>
                    </p>

                    <div className="pt-1">
                      <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                        <Sparkles className="h-3.5 w-3.5" />
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
                      <span className="text-amber-600 dark:text-amber-400">{step.titleHighlight}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-300/70 leading-relaxed">
                      {step.cardExplanation}
                    </p>
                  </div>

                  {/* Right: sample obligations */}
                  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 shadow-lg">
                    <p className="text-[10px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">Próximos pagos</p>
                    <div className="space-y-2.5">
                      {[
                        { name: "Renta", date: "15 Jul 2026", amount: "$1,200,000", icon: "✅" },
                        { name: "Internet", date: "18 Jul 2026", amount: "$80,000", icon: "🌐" },
                        { name: "Tarjeta de crédito", date: "22 Jul 2026", amount: "$250,000", icon: "💳" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">
                          <span className="text-sm">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                            <p className="text-[9px] text-gray-500 dark:text-gray-400">{item.date}</p>
                          </div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white shrink-0">{item.amount}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-1 text-center">
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">Ver todas las obligaciones →</span>
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
                      <span className="text-blue-600 dark:text-blue-400 whitespace-pre-line">{step.titleHighlight}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                    <p className="text-xs text-blue-700/80 dark:text-blue-300/70 leading-relaxed">
                      {step.cardExplanation}
                    </p>
                  </div>

                  {/* Right: donut chart preview */}
                  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 shadow-lg">
                    <p className="text-[10px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">Distribución actual</p>

                    {/* Mini donut chart (SVG) */}
                    <div className="flex justify-center">
                      <div className="relative w-[100px] h-[100px]">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <circle cx="50" cy="50" r="38" fill="none" stroke="#10b981" strokeWidth="10"
                            strokeDasharray="86 240" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                          <circle cx="50" cy="50" r="38" fill="none" stroke="#3b82f6" strokeWidth="10"
                            strokeDasharray="57 240" strokeDashoffset="-86" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                          <circle cx="50" cy="50" r="38" fill="none" stroke="#a855f7" strokeWidth="10"
                            strokeDasharray="48 240" strokeDashoffset="-143" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                          <circle cx="50" cy="50" r="38" fill="none" stroke="#6b7280" strokeWidth="10"
                            strokeDasharray="48 240" strokeDashoffset="-191" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">68%</span>
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-2">
                      {[
                        { name: "Alimentación", pct: "36%", amount: "$1,260,000", color: "bg-emerald-500" },
                        { name: "Transporte", pct: "24%", amount: "$860,000", color: "bg-blue-500" },
                        { name: "Ocio / Antojos", pct: "20%", amount: "$590,000", color: "bg-purple-500" },
                        { name: "Otros", pct: "20%", amount: "$500,000", color: "bg-gray-500" },
                      ].map((cat, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", cat.color)} />
                          <span className="text-[10px] text-gray-700 dark:text-gray-200 flex-1">{cat.name}</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{cat.pct}</span>
                          <span className="text-[10px] font-bold text-gray-900 dark:text-white">{cat.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Registro rápido — voz, escáner y Kiri Coach */}
              {currentStep === 3 && (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left: text */}
                  <div className="flex flex-col justify-center space-y-3">
                    <div className="h-14 w-14 rounded-2xl bg-kiri-emerald/10 flex items-center justify-center">
                      <span className="text-3xl">🌱</span>
                    </div>
                    <h2 className="text-xl font-black leading-tight">
                      {step.title}{" "}
                      <span className="text-kiri-emerald">{step.titleHighlight}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-300/70 leading-relaxed">
                      {step.cardExplanation}
                    </p>
                  </div>

                  {/* Right: 3 quick-input methods */}
                  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-2.5 shadow-lg flex flex-col justify-center">
                    <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2.5">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shrink-0">
                        <Mic className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">Dictar por voz</p>
                        <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
                          Di algo como &quot;gasté 20 mil en el almuerzo&quot; o &quot;me pagaron 2 millones&quot; — Kiri entiende gastos, ingresos, deudas y ahorros, y los guarda solo.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl px-3 py-2.5">
                      <div className="h-8 w-8 rounded-lg bg-cyclon-periwinkle flex items-center justify-center text-white shrink-0">
                        <ScanLine className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">Escanear un recibo</p>
                        <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
                          Tómale foto a un recibo o factura y Kiri extrae el monto y lo registra como gasto por ti.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/40 rounded-xl px-3 py-2.5">
                      <div className="h-8 w-8 rounded-lg bg-slate-700 dark:bg-slate-600 flex items-center justify-center text-white shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">Pregúntale a Kiri Coach</p>
                        <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
                          El mismo botón te abre un chat para resolver dudas y darte recomendaciones sobre tus finanzas.
                        </p>
                      </div>
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
                className="text-xs text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Saltar
              </button>
            ) : (
              <button
                onClick={prev}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-white transition-colors"
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
                    i === currentStep ? "w-6 bg-emerald-500" : "w-2 bg-gray-300 dark:bg-white/20"
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
                👆 Tu primer paso: registra tu Sueldo Real con &quot;<span className="text-emerald-600 dark:text-emerald-400 font-bold">+ Registrar Ingreso</span>&quot;, o simplemente dile a Kiri Coach cuánto ganas.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
