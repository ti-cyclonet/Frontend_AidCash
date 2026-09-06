"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Landmark, TrendingUp, Plus, BookOpen, PiggyBank, ScanLine, Sprout, Mic } from "lucide-react"
import { cn } from "@/lib/utils"

const leftItems = [
  { label: "Gestión",       icon: TrendingUp, href: "/gestion" },
  { label: "Obligaciones",  icon: Landmark,   href: "/obligaciones" },
]

const rightItems = [
  { label: "Balance",       icon: BookOpen,   href: "/balance" },
  { label: "Ahorro",        icon: PiggyBank,  href: "/ahorro" },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [actionsOpen, setActionsOpen] = useState(false)

  return (
    <>
      {/* Overlay de acciones rápidas */}
      {actionsOpen && (
        <div className="fixed inset-0 z-[55] flex flex-col items-center justify-end pb-28">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActionsOpen(false)} />
          <div className="relative flex items-center gap-5 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Dictado (izquierda) */}
            <ActionButton icon={<Mic className="h-6 w-6" />} label="Dictar" color="bg-kiri-emerald" onClick={() => { setActionsOpen(false); window.dispatchEvent(new CustomEvent('kiri:open-voice')) }} />
            {/* Árbol de Kiri (centro) */}
            <ActionButton icon={<Sprout className="h-7 w-7" />} label="Árbol Kiri" color="bg-gradient-to-br from-kiri-emerald to-kiri-forest" large onClick={() => { setActionsOpen(false); router.push('/jardin') }} />
            {/* Escáner (derecha) */}
            <ActionButton icon={<ScanLine className="h-6 w-6" />} label="Escáner" color="bg-cyclon-periwinkle" onClick={() => { setActionsOpen(false); window.dispatchEvent(new CustomEvent('kiri:open-scanner')) }} />
          </div>
        </div>
      )}

      {/* Barra inferior */}
      <nav className="fixed bottom-0 left-0 right-0 glass-nav border-t border-border/50 flex items-center justify-around px-2 pt-3 pb-2 z-50 safe-bottom">
        {/* Items izquierda */}
        {leftItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={cn("flex flex-col items-center gap-0.5 min-w-[52px] py-1 px-1.5 rounded-xl",
                isActive ? "text-kiri-emerald" : "text-muted-foreground"
              )}>
              <item.icon className={cn("h-5 w-5", isActive && "scale-110")} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={cn("text-[9px] font-medium", isActive && "font-bold")}>{item.label}</span>
            </Link>
          )
        })}

        {/* Espacio reservado para el botón + flotante (renderizado aparte, ver abajo) */}
        <div className="h-12 w-12" aria-hidden="true" />

        {/* Items derecha */}
        {rightItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={cn("flex flex-col items-center gap-0.5 min-w-[52px] py-1 px-1.5 rounded-xl",
                isActive ? "text-kiri-emerald" : "text-muted-foreground"
              )}>
              <item.icon className={cn("h-5 w-5", isActive && "scale-110")} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={cn("text-[9px] font-medium", isActive && "font-bold")}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Botón +/X flotante: solo sube por encima de TODO mientras nuestro propio
          overlay está abierto (para no quedar tapado por el fondo difuminado). El resto
          del tiempo va a la misma altura que la barra, para no taparle modales a la app
          (los Dialog de la app usan z-50, portados al final del <body>). */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 flex justify-center pt-3 pb-2 pointer-events-none safe-bottom",
        actionsOpen ? "z-[60]" : "z-50"
      )}>
        <button onClick={() => setActionsOpen(v => !v)}
          className={cn(
            "pointer-events-auto h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
            actionsOpen
              ? "bg-muted text-foreground scale-95"
              : "bg-gradient-to-br from-kiri-emerald to-kiri-forest text-white scale-100"
          )}>
          {/* Un "+" girado 45° se lee como una "X": así el ícono no salta, solo gira suave */}
          <Plus className={cn("h-6 w-6 transition-transform duration-300 ease-out", actionsOpen && "rotate-45")} />
        </button>
      </div>
    </>
  )
}

function ActionButton({ icon, label, color, large, onClick }: {
  icon: React.ReactNode; label: string; color: string; large?: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div className={cn(
        "rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform active:scale-90",
        color,
        large ? "h-16 w-16" : "h-14 w-14"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-bold text-white">{label}</span>
    </button>
  )
}
