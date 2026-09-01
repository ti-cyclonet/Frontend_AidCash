"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, Sparkles, Sprout } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { MODULE_GUIDES, type ModuleGuideData } from "@/lib/module-guide-content"

// ─── Sidebar Navigation Item ──────────────────────────────────────────────────

function SideNavItem({
  mod,
  isActive,
  onClick,
}: {
  mod: ModuleGuideData
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm",
        isActive
          ? "bg-kiri-emerald/10 text-kiri-emerald font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <div className={cn(
        "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0",
        isActive ? "bg-kiri-emerald text-white" : "bg-muted text-muted-foreground"
      )}>
        {mod.number}
      </div>
      <div className="min-w-0">
        <p className="font-medium truncate">{mod.title}</p>
        <p className="text-[10px] text-muted-foreground truncate leading-tight">
          {mod.navBlurb}
        </p>
      </div>
    </button>
  )
}

// ─── Module Card Component ────────────────────────────────────────────────────

function ModuleCard({ mod }: { mod: ModuleGuideData }) {
  return (
    <motion.div
      id={`module-${mod.id}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card className={cn(
        "border shadow-lg rounded-3xl overflow-hidden",
        mod.borderColor
      )}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("p-5 pb-4 bg-gradient-to-r", mod.bgGradient)}>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-lg", mod.badgeSolid)}>
                {mod.number}
              </div>
              <div className="flex items-center gap-2">
                <span className={mod.textColor}><mod.Icon className="h-5 w-5" /></span>
                <h3 className="text-xl font-black">{mod.title}</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {mod.subtitle}
            </p>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {mod.description}
            </p>

            {/* Items */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                Qué debes hacer aquí:
              </p>
              <div className="space-y-3">
                {mod.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-base shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GuiaKiriContent() {
  const router = useRouter()
  const [activeModule, setActiveModule] = useState("jardin")

  // Track scroll to update active sidebar item
  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = document.querySelector("main")
      if (!scrollContainer) return

      for (const mod of MODULE_GUIDES) {
        const el = document.getElementById(`module-${mod.id}`)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 200 && rect.bottom > 200) {
            setActiveModule(mod.id)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll, true)
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [])

  const scrollToModule = (id: string) => {
    setActiveModule(id)
    const el = document.getElementById(`module-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="space-y-6 -mt-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-kiri-emerald" />
              <h1 className="text-xl font-black">Guía de Módulos</h1>
              <span className="text-lg">🌱</span>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              Descubre cómo funciona cada módulo de Kiri Finance.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Welcome Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-kiri-emerald/20 bg-gradient-to-r from-kiri-emerald/5 to-kiri-forest/5 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-kiri-emerald/10 flex items-center justify-center shrink-0">
                <Sprout className="h-6 w-6 text-kiri-emerald" />
              </div>
              <div>
                <h2 className="font-bold text-sm mb-1">Guía Modular</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Aprende paso a paso cómo usar cada módulo y haz florecer tu jardín financiero.
                  Explora estas descripciones a tu propio ritmo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Desktop Layout: Sidebar + Content */}
      <div className="lg:flex lg:gap-6">
        {/* Sidebar — solo desktop */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-3">
              Módulos
            </p>
            {MODULE_GUIDES.map(mod => (
              <SideNavItem
                key={mod.id}
                mod={mod}
                isActive={activeModule === mod.id}
                onClick={() => scrollToModule(mod.id)}
              />
            ))}

            {/* Tip box */}
            <div className="mt-6 p-3 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-start gap-2">
                <Sprout className="h-4 w-4 text-kiri-emerald mt-0.5 shrink-0" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <span className="font-bold text-foreground">Recuerda</span><br />
                  Cada acción en la app hace crecer tu jardín. Pequeñas decisiones hoy, grandes logros mañana.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile horizontal nav */}
        <div className="lg:hidden mb-4 -mx-5 px-5 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 pb-2">
            {MODULE_GUIDES.map(mod => (
              <button
                key={mod.id}
                onClick={() => scrollToModule(mod.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap text-xs font-medium transition-all shrink-0",
                  activeModule === mod.id
                    ? "bg-kiri-emerald/10 text-kiri-emerald border border-kiri-emerald/20"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                <span className="h-5 w-5 rounded-md bg-current/10 flex items-center justify-center text-[10px] font-black">
                  {mod.number}
                </span>
                {mod.title}
              </button>
            ))}
          </div>
        </div>

        {/* Module Cards */}
        <div className="flex-1 space-y-6">
          {MODULE_GUIDES.map(mod => (
            <ModuleCard key={mod.id} mod={mod} />
          ))}

          {/* Footer Tip */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="py-4"
          >
            <div className="flex items-center justify-center gap-2 text-center">
              <Sparkles className="h-4 w-4 text-kiri-emerald" />
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-kiri-emerald">Consejo Kiri:</span>{" "}
                Explora cada módulo, toma el control de tus finanzas y observa cómo tu jardín florece día a día.
              </p>
              <Sparkles className="h-4 w-4 text-kiri-emerald" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
