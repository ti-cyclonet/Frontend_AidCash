"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronRight, ChevronLeft, Wallet, Building2, BarChart3, Users, PiggyBank, Sparkles, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TutorialSlider — Carousel de introducción por módulos
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Uso:
 *   - Como overlay de primera vez: <TutorialSlider module="gestion" onClose={...} />
 *   - Como tutorial completo: <TutorialSlider showAll onClose={...} />
 */

// ─── Contenido de cada módulo ─────────────────────────────────────────────────

export interface TutorialSlide {
  id: string
  number: number
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  features: { icon: string; title: string; description: string }[]
}

const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    id: "gestion",
    number: 1,
    title: "Gestión",
    subtitle: "¡El centro de mando de tu dinero!",
    icon: <Wallet className="h-6 w-6" />,
    color: "from-emerald-500/20 to-emerald-900/20",
    features: [
      { icon: "💰", title: "BILLETERA", description: "Controla lo que ganas y lo que tienes disponible. Registra ingresos y ve tu saldo real." },
      { icon: "📊", title: "PRESUPUESTO", description: "Toma el control de tu gasto libre. Crea categorías y monitorea cuánto gastas en cada una." },
      { icon: "📈", title: "PROYECCIONES", description: "Simula nuevas deudas y proyecta tu futuro financiero a 3, 6, 12 o 24 meses." },
    ],
  },
  {
    id: "obligaciones",
    number: 2,
    title: "Obligaciones",
    subtitle: "¡Mantén tus compromisos a raya sin estrés!",
    icon: <Building2 className="h-6 w-6" />,
    color: "from-blue-500/20 to-blue-900/20",
    features: [
      { icon: "🏠", title: "GASTOS FIJOS", description: "Añade tus pagos recurrentes (renta, internet) y dales 'check' al pagarlos." },
      { icon: "💳", title: "DEUDAS", description: "Controla tus cuotas y usa estrategias como 'Bola de Nieve' para salir más rápido." },
      { icon: "🛒", title: "GASTOS HORMIGA", description: "Registra tus compras impulsivas clasificadas en categorías para que se descuenten del presupuesto libre." },
    ],
  },
  {
    id: "balance",
    number: 3,
    title: "Balance",
    subtitle: "¡Tu máquina del tiempo financiera!",
    icon: <BarChart3 className="h-6 w-6" />,
    color: "from-purple-500/20 to-purple-900/20",
    features: [
      { icon: "📅", title: "FILTROS TEMPORALES", description: "Revisa tus números por semana, mes, año o todo tu historial." },
      { icon: "📋", title: "HISTORIAL DETALLADO", description: "Navega por 5 pestañas para ver el desglose exacto de tus movimientos." },
      { icon: "📄", title: "EXPORTACIÓN", description: "Descarga tus reportes en PDF o Excel con un solo clic." },
    ],
  },
  {
    id: "social",
    number: 4,
    title: "Social",
    subtitle: "¡Mejorar tus finanzas es más divertido en equipo!",
    icon: <Users className="h-6 w-6" />,
    color: "from-pink-500/20 to-pink-900/20",
    features: [
      { icon: "🤝", title: "CONEXIONES", description: "Invita a tus amigos, familia o pareja." },
      { icon: "🐷", title: "BOLSILLOS COMPARTIDOS", description: "Creen metas juntos y usen la calculadora inteligente para aportar lo justo según sus ingresos." },
      { icon: "💸", title: "PRÉSTAMOS P2P", description: "Pide prestado, aprueba solicitudes y lleva el registro exacto de cada abono hasta saldar la cuenta." },
    ],
  },
  {
    id: "ahorro",
    number: 5,
    title: "Ahorro",
    subtitle: "¡El lugar donde tus metas cobran vida!",
    icon: <PiggyBank className="h-6 w-6" />,
    color: "from-amber-500/20 to-amber-900/20",
    features: [
      { icon: "🎨", title: "BOLSILLOS DE AHORRO", description: "Crea alcancías con colores e íconos para tus sueños y llénalas poco a poco." },
      { icon: "🛡️", title: "FONDO DE EMERGENCIA", description: "Mantén tu colchón de seguridad. La app te guiará hasta alcanzar la meta ideal de 6 meses de gastos fijos." },
    ],
  },
  {
    id: "final",
    number: 6,
    title: "¡Todo en orden!",
    subtitle: "Ya conoces tu jardín financiero",
    icon: <Sparkles className="h-6 w-6" />,
    color: "from-kiri-emerald/20 to-emerald-900/20",
    features: [
      { icon: "🌱", title: "Usa cada módulo a tu ritmo", description: "" },
      { icon: "💡", title: "Toma mejores decisiones", description: "" },
      { icon: "🌳", title: "Y mira cómo tu jardín florece", description: "" },
    ],
  },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface TutorialSliderProps {
  /** Mostrar un solo módulo (primera vez) */
  module?: string
  /** Mostrar todos los slides (tutorial completo) */
  showAll?: boolean
  /** Callback al cerrar */
  onClose: () => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function TutorialSlider({ module, showAll = false, onClose }: TutorialSliderProps) {
  const slides = showAll
    ? TUTORIAL_SLIDES
    : TUTORIAL_SLIDES.filter(s => s.id === module)

  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentSlide = slides[currentIndex]
  const isLast = currentIndex === slides.length - 1
  const isFirst = currentIndex === 0

  const goNext = () => {
    if (isLast) {
      onClose()
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  const goPrev = () => {
    if (!isFirst) setCurrentIndex(i => i - 1)
  }

  if (!currentSlide) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-3xl bg-card border border-border shadow-2xl relative"
      >
        {/* Header con indicadores */}
        {showAll && slides.length > 1 && (
          <div className="absolute top-4 left-0 right-0 flex items-center justify-center gap-1.5 z-10">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === currentIndex ? "w-6 bg-kiri-emerald" : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}

        {/* Botón X */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Contenido del slide */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6 pt-10 pb-4 overflow-y-auto max-h-[85vh]"
          >
            {/* Número + Título */}
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-black text-sm", currentSlide.color)}>
                {currentSlide.number}
              </div>
              <div>
                <h2 className="text-xl font-black">{currentSlide.title}</h2>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{currentSlide.subtitle}</p>

            {/* Área visual — fondo gradiente */}
            <div className={cn("rounded-2xl p-5 mb-5 bg-gradient-to-br border border-border/50", currentSlide.color)}>
              <div className="space-y-4">
                {currentSlide.features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl shrink-0">{feat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider">{feat.title}</p>
                      {feat.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{feat.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer: Omitir / Siguiente */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={onClose}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Omitir
              </button>

              <div className="flex items-center gap-2">
                {!isFirst && showAll && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={goPrev}
                    className="rounded-xl text-xs gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={goNext}
                  className="rounded-xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold text-xs gap-1 px-4"
                >
                  {isLast && currentSlide.id === "final"
                    ? "¡Comenzar mi viaje en Kiri!"
                    : "Siguiente"}
                  {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ─── Hook para controlar la primera vez por módulo ────────────────────────────

const LS_TUTORIAL_PREFIX = "kiri_tutorial_seen_"

export function useTutorialFirstTime(moduleId: string) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const seen = localStorage.getItem(`${LS_TUTORIAL_PREFIX}${moduleId}`)
    if (!seen) {
      setShow(true)
    }
  }, [moduleId])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(`${LS_TUTORIAL_PREFIX}${moduleId}`, "true")
  }

  return { showTutorial: show, dismissTutorial: dismiss }
}

// Export slides for the full tutorial view
export { TUTORIAL_SLIDES }
