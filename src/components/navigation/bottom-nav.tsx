"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Landmark, TrendingUp, Plus, X, BookOpen, PiggyBank, ScanLine, Calculator, Mic } from "lucide-react"
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
  const [actionsOpen, setActionsOpen] = useState(false)

  return (
    <>
      {/* Overlay de acciones rápidas */}
      {actionsOpen && (
        <div className="fixed inset-0 z-[55] flex flex-col items-center justify-end pb-28">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActionsOpen(false)} />
          <div className="relative flex items-center gap-5 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Simulador */}
            <ActionButton icon={<Calculator className="h-6 w-6" />} label="Simulador" color="bg-cyclon-lavender" onClick={() => { setActionsOpen(false); window.dispatchEvent(new CustomEvent('kiri:open-simulator')) }} />
            {/* Micrófono (centro) */}
            <ActionButton icon={<Mic className="h-7 w-7" />} label="Dictar" color="bg-kiri-emerald" large onClick={() => { setActionsOpen(false); window.dispatchEvent(new CustomEvent('kiri:open-voice')) }} />
            {/* Escáner */}
            <ActionButton icon={<ScanLine className="h-6 w-6" />} label="Escáner" color="bg-cyclon-periwinkle" onClick={() => { setActionsOpen(false); window.dispatchEvent(new CustomEvent('kiri:open-scanner')) }} />
          </div>
        </div>
      )}

      {/* Barra inferior */}
      <nav className="fixed bottom-0 left-0 right-0 glass-nav border-t border-border/50 flex items-center justify-around px-2 py-2 z-50 safe-bottom">
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

        {/* Botón + central */}
        <button onClick={() => setActionsOpen(v => !v)}
          className={cn(
            "h-14 w-14 -mt-6 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
            actionsOpen
              ? "bg-muted text-foreground rotate-45 scale-95"
              : "bg-gradient-to-br from-kiri-emerald to-kiri-forest text-white scale-100"
          )}>
          {actionsOpen ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
        </button>

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
