"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Landmark, TrendingUp, Plus, BookOpen, PiggyBank, ScanLine, Sprout, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
import { tr } from "@/lib/i18n"

/**
 * Barra inferior (celular): flotante, oscura, con el botón "+" elevado en una
 * muesca central. El indicador del módulo activo se desliza entre ítems y la
 * barra se esconde al bajar la página (vuelve al subir). Antes era una franja
 * fija pegada al borde, sin ninguna transición al cambiar de módulo.
 */

const leftItems = [
  { label: tr("Gestión"),       icon: TrendingUp, href: "/gestion" },
  { label: tr("Obligaciones"),  icon: Landmark,   href: "/obligaciones" },
]

const rightItems = [
  { label: tr("Balance"),       icon: BookOpen,   href: "/balance" },
  { label: tr("Ahorro"),        icon: PiggyBank,  href: "/ahorro" },
]

const spring = { type: "spring" as const, stiffness: 420, damping: 32 }

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [actionsOpen, setActionsOpen] = useState(false)
  const oculta = useOcultarAlBajar(actionsOpen)

  const acciones = [
    { key: "dictar", icon: <Mic className="h-6 w-6" />, label: tr("Dictar"), color: "bg-kiri-emerald", run: () => window.dispatchEvent(new CustomEvent("kiri:open-voice")) },
    { key: "arbol", icon: <Sprout className="h-7 w-7" />, label: tr("Árbol Kiri"), color: "bg-gradient-to-br from-kiri-emerald to-kiri-forest", large: true, run: () => router.push("/jardin") },
    { key: "escaner", icon: <ScanLine className="h-6 w-6" />, label: tr("Escáner"), color: "bg-cyclon-periwinkle", run: () => window.dispatchEvent(new CustomEvent("kiri:open-scanner")) },
  ]

  return (
    <>
      {/* Acciones rápidas: salen en abanico desde el botón central */}
      <AnimatePresence>
        {actionsOpen && (
          <motion.div className="fixed inset-0 z-[55]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setActionsOpen(false)} />
            <div className="absolute inset-x-0 bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] flex items-end justify-center gap-6 pointer-events-none">
              {acciones.map((a, i) => {
                const offsetY = a.large ? -18 : 0
                return (
                  <motion.button
                    key={a.key}
                    type="button"
                    initial={{ opacity: 0, y: 60, scale: 0.4 }}
                    animate={{ opacity: 1, y: offsetY, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.4 }}
                    transition={{ ...spring, delay: i * 0.045 }}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => { setActionsOpen(false); a.run() }}
                    className="pointer-events-auto flex flex-col items-center gap-1.5"
                  >
                    <span className={cn("rounded-2xl flex items-center justify-center text-white shadow-xl", a.color, a.large ? "h-16 w-16" : "h-14 w-14")}>{a.icon}</span>
                    <span className="text-[10px] font-bold text-white drop-shadow">{a.label}</span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={cn("fixed inset-x-0 bottom-0 px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] pointer-events-none", actionsOpen ? "z-[60]" : "z-50")}
        initial={false}
        animate={{ y: oculta ? 120 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 34 }}
      >
        <nav
          aria-label={tr("Navegación principal")}
          className="pointer-events-auto relative mx-auto max-w-md h-[66px] rounded-[26px] bg-gradient-to-r from-[hsl(153,40%,36%)] to-[hsl(153,44%,30%)] dark:from-[hsl(153,32%,26%)] dark:to-[hsl(153,36%,22%)] shadow-[0_12px_32px_-8px_rgba(9,40,25,0.5)] ring-1 ring-white/10 flex items-center px-2"
        >
          {leftItems.map(item => <NavItem key={item.href} {...item} active={pathname === item.href} />)}

          {/* Hueco para el botón central */}
          <div className="w-[76px] shrink-0" aria-hidden="true" />

          {rightItems.map(item => <NavItem key={item.href} {...item} active={pathname === item.href} />)}

          {/* Botón central elevado — el aro del color del fondo hace la "muesca" */}
          <div className="absolute left-1/2 -top-7 -translate-x-1/2 flex flex-col items-center">
            <motion.button
              type="button"
              aria-label={actionsOpen ? tr("Cerrar acciones rápidas") : tr("Acciones rápidas")}
              aria-expanded={actionsOpen}
              onClick={() => setActionsOpen(v => !v)}
              whileTap={{ scale: 0.9 }}
              animate={{ rotate: actionsOpen ? 135 : 0 }}
              transition={spring}
              className={cn(
                "h-[60px] w-[60px] rounded-full flex items-center justify-center ring-[6px] ring-background shadow-lg",
                // El botón central es lo más oscuro de la barra: resalta sobre el verde
                actionsOpen ? "bg-white text-[hsl(153,44%,13%)]" : "bg-gradient-to-br from-[hsl(153,44%,18%)] to-[hsl(153,50%,9%)] text-white",
              )}
            >
              <Plus className="h-7 w-7" strokeWidth={2.6} />
            </motion.button>
          </div>
        </nav>
      </motion.div>
    </>
  )
}

function NavItem({ label, icon: Icon, href, active }: { label: string; icon: typeof TrendingUp; href: string; active: boolean }) {
  return (
    <Link href={href} className="relative flex-1 h-full flex flex-col items-center justify-center gap-0.5 select-none" aria-current={active ? "page" : undefined}>
      {active && (
        <motion.span
          layoutId="bottom-nav-activo"
          transition={spring}
          className="absolute inset-x-1.5 inset-y-2 rounded-2xl bg-black/15"
        />
      )}
      <motion.span animate={{ y: active ? -2 : 0, scale: active ? 1.12 : 1 }} transition={spring} className="relative">
        <Icon className={cn("h-5 w-5 transition-colors", active ? "text-white" : "text-white/65")} strokeWidth={active ? 2.5 : 1.9} />
      </motion.span>
      <span className={cn("relative text-[9px] transition-colors", active ? "font-bold text-white" : "font-medium text-white/70")}>{label}</span>
    </Link>
  )
}

/** Esconde la barra al bajar la página y la muestra al subir (o cerca del inicio). */
function useOcultarAlBajar(bloqueado: boolean) {
  const [oculta, setOculta] = useState(false)
  const ultimo = useRef(0)
  useEffect(() => {
    if (bloqueado) { setOculta(false); return }
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - ultimo.current
      if (y < 80) setOculta(false)
      else if (delta > 8) setOculta(true)
      else if (delta < -8) setOculta(false)
      ultimo.current = y
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [bloqueado])
  return oculta
}
