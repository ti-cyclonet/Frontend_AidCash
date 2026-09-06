"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronRight, ChevronLeft, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { MODULE_GUIDES, type ModuleGuideData, type GuideItem } from "@/lib/module-guide-content"
import { getUserId } from "@/lib/api-client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TutorialSlider — Carousel de introducción por módulos
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Uso:
 *   - Como overlay de primera vez: <TutorialSlider module="gestion" onClose={...} />
 *   - Como tutorial completo: <TutorialSlider showAll onClose={...} />
 *
 * El contenido de cada módulo vive en `module-guide-content.ts` — la misma
 * fuente que usa /guia-kiri — para que ambas pantallas nunca se desincronicen.
 */

// ─── Slide — un módulo real (de MODULE_GUIDES) o el cierre "final" ────────────

export type TutorialSlide =
  | (ModuleGuideData & { features: GuideItem[] })
  | {
      id: "final"
      number: number
      title: string
      subtitle: string
      textColor: string
      badgeSolid: string
      bgGradient: string
      features: GuideItem[]
    }

const TUTORIAL_SLIDES: TutorialSlide[] = [
  ...MODULE_GUIDES.map(mod => ({ ...mod, features: mod.items })),
  {
    id: "final",
    number: MODULE_GUIDES.length + 1,
    title: "¡Todo en orden!",
    subtitle: "Ya conoces tu jardín financiero",
    textColor: "text-kiri-emerald",
    badgeSolid: "bg-kiri-emerald",
    bgGradient: "from-kiri-emerald/10 to-emerald-900/5",
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
  const router = useRouter()
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
        className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl bg-card border border-border shadow-2xl relative"
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
            className="p-6 pt-10 pb-4 overflow-y-auto max-h-[90vh]"
          >
            {/* Número + Título — círculo SÓLIDO (no translúcido): el número va en
                blanco encima, y un tinte al 20% de opacidad no da contraste
                suficiente en modo claro. */}
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center text-white font-black text-lg", currentSlide.badgeSolid)}>
                {currentSlide.number}
              </div>
              <div>
                <h2 className="text-2xl font-black">{currentSlide.title}</h2>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{currentSlide.subtitle}</p>

            {/* Descripción del módulo */}
            {currentSlide.id !== "final" && "description" in currentSlide && (
              <p className="text-xs text-muted-foreground leading-relaxed mb-5 border-l-2 border-kiri-emerald/30 pl-3">
                {currentSlide.description}
              </p>
            )}

            {/* Área visual — Qué debes hacer aquí */}
            <div className={cn("rounded-2xl p-5 mb-5 bg-gradient-to-br border border-border/50", currentSlide.bgGradient)}>
              {currentSlide.id !== "final" && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground mb-3">Qué debes hacer aquí:</p>
              )}
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

            {/* Ver guía completa button */}
            <button
              onClick={() => { onClose(); router.push("/guia-kiri") }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-kiri-emerald/20 bg-kiri-emerald/5 text-kiri-emerald hover:bg-kiri-emerald/10 transition-colors text-xs font-bold"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Ver guía completa
            </button>

            {/* Footer: solo visible en tutorial completo (showAll) */}
            {showAll && (
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={onClose}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Omitir
                </button>

                <div className="flex items-center gap-2">
                  {!isFirst && (
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
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ─── Hook para controlar la primera vez por módulo ────────────────────────────

const LS_TUTORIAL_PREFIX = "kiri_tutorial_seen_"

// La llave incluye el userId para que el estado "ya vi este módulo" sea por
// cuenta: así no se borra al cerrar sesión (debe verse una sola vez, siempre)
// ni se hereda entre cuentas distintas que compartan el mismo navegador.
function tutorialKey(moduleId: string): string | null {
  const userId = getUserId()
  if (!userId) return null
  return `${LS_TUTORIAL_PREFIX}${userId}_${moduleId}`
}

export function useTutorialFirstTime(moduleId: string) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const key = tutorialKey(moduleId)
    if (!key) return
    const seen = localStorage.getItem(key)
    if (!seen) {
      setShow(true)
    }
  }, [moduleId])

  const dismiss = () => {
    setShow(false)
    const key = tutorialKey(moduleId)
    if (key) localStorage.setItem(key, "true")
  }

  return { showTutorial: show, dismissTutorial: dismiss }
}

// Export slides for the full tutorial view
export { TUTORIAL_SLIDES }
