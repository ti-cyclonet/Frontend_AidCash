"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Landmark, PiggyBank, TrendingUp, BookOpen, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSocket } from "@/lib/socket-context"

const navItems = [
  { label: "Inicio",        icon: Home,       href: "/dashboard" },
  { label: "Gestión",       icon: TrendingUp, href: "/gestion" },
  { label: "Obligaciones",  icon: Landmark,   href: "/obligaciones" },
  { label: "Balance",       icon: BookOpen,   href: "/balance" },
  { label: "Social",        icon: Users,      href: "/social" },
]

export function BottomNav() {
  const pathname = usePathname()
  const { unreadCount } = useSocket()

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-nav border-t border-border/50 flex items-center justify-around px-1 py-2.5 z-50 safe-bottom">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        const showBadge = item.href === "/social" && unreadCount > 0

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 transition-all duration-200 min-w-[52px] py-1 px-1.5 rounded-xl relative",
              isActive
                ? "text-kiri-emerald"
                : "text-muted-foreground hover:text-kiri-sage"
            )}
          >
            <item.icon
              className={cn("h-5 w-5 transition-all", isActive && "scale-110")}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            {showBadge && (
              <span className="absolute top-0.5 right-2 h-4 w-4 bg-cyclon-pink rounded-full flex items-center justify-center text-[8px] font-black text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className={cn(
              "text-[9px] font-medium",
              isActive && "font-bold"
            )}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
