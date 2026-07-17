"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Wallet, Building2, BarChart3, Users, PiggyBank,
  Sprout, ArrowLeft, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

// ─── Module Data ──────────────────────────────────────────────────────────────

interface ModuleGuide {
  id: string
  number: number
  title: string
  icon: React.ReactNode
  emoji: string
  color: string
  bgGradient: string
  borderColor: string
  subtitle: string
  description: string
  steps: { icon: string; title: string; description: string }[]
}

const MODULES: ModuleGuide[] = [
  {
    id: "gestion",
    number: 1,
    title: "Gestión",
    icon: <Wallet className="h-5 w-5" />,
    emoji: "📈",
    color: "text-emerald-400",
    bgGradient: "from-emerald-500/10 to-emerald-900/5",
    borderColor: "border-emerald-500/20",
    subtitle: "¡El centro de mando de tu dinero! Administra tus ingresos y decide exactamente a dónde va cada centavo.",
    description: "Piensa en este módulo como tu centro de mando financiero de alto nivel. Aquí es donde estableces el rumbo general de tus finanzas y visualizas el panorama completo.",
    steps: [
      {
        icon: "💰",
        title: "Configurar Ingresos",
        description: "Registra tus ingresos fijos y variables. Tu Sueldo Base es el planificado y el Sueldo Real se actualiza al pagar obligaciones."
      },
      {
        icon: "📊",
        title: "Definir Presupuesto Base",
        description: "Crea categorías personalizadas y asígnales límites. Las tarjetas muestran en tiempo real tu Disponible y Total gastado."
      },
      {
        icon: "📈",
        title: "Establecer Metas Globales",
        description: "Define grandes objetivos y usa el simulador de Proyecciones para ver el impacto de decisiones a 3, 6, 12 o 24 meses."
      },
    ],
  },
  {
    id: "obligaciones",
    number: 2,
    title: "Obligaciones",
    icon: <Building2 className="h-5 w-5" />,
    emoji: "🏛️",
    color: "text-blue-400",
    bgGradient: "from-blue-500/10 to-blue-900/5",
    borderColor: "border-blue-500/20",
    subtitle: "¡Mantén tus compromisos a raya sin estrés! Todo lo que debes pagar en un solo lugar.",
    description: "Este es el lugar dedicado a gestionar todos tus compromisos financieros fijos e ineludibles. Desde deudas hasta facturas mensuales y pagos de tarjeta de crédito.",
    steps: [
      {
        icon: "🏠",
        title: "Registrar Gastos Fijos",
        description: "Añade tus pagos recurrentes (renta, internet, servicios) y dales 'check' al pagarlos. Activa el pago automático ⚡."
      },
      {
        icon: "💳",
        title: "Ingresar Deudas y Tarjetas",
        description: "Registra deudas bancarias y tarjetas de crédito. Vincula cada tarjeta para controlar cuotas, intereses y fechas de corte automáticamente."
      },
      {
        icon: "🧮",
        title: "Pagos con Tarjeta de Crédito",
        description: "Visualiza el monto mínimo, cuota negociada y pago total. Simula cuántos meses tardas en pagar según el abono que elijas."
      },
      {
        icon: "⚡",
        title: "Simular Estrategias de Deuda",
        description: "Usa 'Bola de Nieve' vs 'Avalancha' para comparar métodos y salir de deudas más rápido."
      },
    ],
  },
  {
    id: "balance",
    number: 3,
    title: "Balance",
    icon: <BarChart3 className="h-5 w-5" />,
    emoji: "📖",
    color: "text-purple-400",
    bgGradient: "from-purple-500/10 to-purple-900/5",
    borderColor: "border-purple-500/20",
    subtitle: "¡Tu máquina del tiempo financiera! Úsala para auditar tu progreso con gráficos súper visuales.",
    description: "Tu historial financiero detallado. Reportes completos con gráficos de torta, barras para diferentes periodos.",
    steps: [
      {
        icon: "📅",
        title: "Filtros Temporales",
        description: "Revisa tus números por semana, mes, año o todo tu historial."
      },
      {
        icon: "📋",
        title: "Historial Detallado",
        description: "Navega por 5 pestañas para ver el desglose exacto de tus movimientos."
      },
      {
        icon: "📄",
        title: "Exportación",
        description: "Descarga tus reportes en PDF o Excel con un solo clic."
      },
    ],
  },
  {
    id: "social",
    number: 4,
    title: "Social",
    icon: <Users className="h-5 w-5" />,
    emoji: "👥",
    color: "text-pink-400",
    bgGradient: "from-pink-500/10 to-pink-900/5",
    borderColor: "border-pink-500/20",
    subtitle: "¡Mejorar tus finanzas es más divertido en equipo!",
    description: "La dimensión social de tus finanzas. Conéctate con otros usuarios para compartir objetivos y gestionar presupuestos conjuntos.",
    steps: [
      {
        icon: "🤝",
        title: "Conexiones",
        description: "Invita a tus amigos o pareja enviándoles una invitación por correo electrónico."
      },
      {
        icon: "🐷",
        title: "Bolsillos Compartidos",
        description: "Creen metas juntos y usen la calculadora inteligente para aportar lo justo según sus ingresos."
      },
      {
        icon: "💸",
        title: "Préstamos P2P",
        description: "Pide prestado, aprueba solicitudes y lleva el registro exacto de cada abono hasta saldar la cuenta."
      },
    ],
  },
  {
    id: "ahorro",
    number: 5,
    title: "Ahorro",
    icon: <PiggyBank className="h-5 w-5" />,
    emoji: "🐷",
    color: "text-amber-400",
    bgGradient: "from-amber-500/10 to-amber-900/5",
    borderColor: "border-amber-500/20",
    subtitle: "¡El lugar donde tus metas cobran vida!",
    description: "Tu espacio dedicado a hacer crecer tu dinero. Gestiona tus bolsillos de ahorro personales y sigue tu progreso.",
    steps: [
      {
        icon: "🎨",
        title: "Bolsillos de Ahorro",
        description: "Crea alcancías con colores e íconos para tus sueños y llénalas poco a poco."
      },
      {
        icon: "💵",
        title: "Registrar Depósitos",
        description: "Añade dinero y mira cómo crecen tus metas. Estima el tiempo necesario para alcanzar cada objetivo."
      },
      {
        icon: "🛡️",
        title: "Fondo de Emergencia",
        description: "Mantén tu colchón de seguridad. La app te guiará hasta alcanzar la meta ideal de 6 meses de gastos fijos."
      },
    ],
  },
]

// ─── Sidebar Navigation Item ──────────────────────────────────────────────────

function SideNavItem({
  mod,
  isActive,
  onClick,
}: {
  mod: ModuleGuide
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
          {mod.id === "gestion" && "Centro de mando de tus finanzas"}
          {mod.id === "obligaciones" && "Gestiona tus compromisos y deudas"}
          {mod.id === "balance" && "Analiza tu historia financiera"}
          {mod.id === "social" && "Finanzas compartidas en equipo"}
          {mod.id === "ahorro" && "Tus metas, tu futuro"}
        </p>
      </div>
    </button>
  )
}

// ─── Module Card Component ────────────────────────────────────────────────────

function ModuleCard({ mod }: { mod: ModuleGuide }) {
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
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-lg",
                mod.id === "gestion" && "bg-emerald-600",
                mod.id === "obligaciones" && "bg-blue-600",
                mod.id === "balance" && "bg-purple-600",
                mod.id === "social" && "bg-pink-600",
                mod.id === "ahorro" && "bg-amber-600",
              )}>
                {mod.number}
              </div>
              <div className="flex items-center gap-2">
                <span className={mod.color}>{mod.icon}</span>
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

            {/* Steps */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                Qué debes hacer aquí:
              </p>
              <div className="space-y-3">
                {mod.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-base shrink-0">
                      {step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{step.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        {step.description}
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
  const [activeModule, setActiveModule] = useState("gestion")

  // Track scroll to update active sidebar item
  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = document.querySelector("main")
      if (!scrollContainer) return

      for (const mod of MODULES) {
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
            {MODULES.map(mod => (
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
            {MODULES.map(mod => (
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
          {MODULES.map(mod => (
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
