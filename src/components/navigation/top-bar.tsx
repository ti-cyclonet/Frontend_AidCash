"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { X, Bell, Sprout, Users, CheckCheck, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSocket, KiriNotification } from "@/lib/socket-context"
import { notifIcon, notifTitle, notifRoute } from "@/lib/notification-display"
import { useAppContext } from "@/lib/app-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

export function TopBar() {
  const [notifsOpen, setNotifsOpen] = useState(false)
  const router = useRouter()
  const { unreadCount, socialUnreadCount, notifications, markAllRead, clearNotifications, connected } = useSocket()
  const { user } = useAppContext()

  const initials = user.nombre
    ? user.nombre.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "KF"

  const handleNotifClick = (n: KiriNotification) => {
    setNotifsOpen(false)
    router.push(notifRoute(n))
  }

  return (
    <>
      {/* Barra superior móvil */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-nav border-b border-border/50 safe-top">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Botón Social (icono de personas) */}
          <Link href="/social"
            className="h-9 w-9 rounded-xl flex items-center justify-center text-foreground hover:bg-muted/50 transition-colors relative">
            <Users className="h-5 w-5" />
            {socialUnreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 bg-cyclon-pink rounded-full flex items-center justify-center text-[8px] font-black text-white">
                {socialUnreadCount > 9 ? "9+" : socialUnreadCount}
              </span>
            )}
          </Link>

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 bg-kiri-emerald rounded-xl flex items-center justify-center">
              <Sprout className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <span className="text-sm font-bold text-foreground">Kiri</span>
          </Link>

          {/* Derecha: Notificaciones + Avatar */}
          <div className="flex items-center gap-2">
            {/* Notificaciones dropdown */}
            <button onClick={() => { setNotifsOpen(v => !v); if (!notifsOpen) markAllRead() }}
              className="relative h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-4 px-0.5 bg-cyclon-pink rounded-full flex items-center justify-center text-[8px] font-black text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <Link href="/perfil">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback className="bg-kiri-mint text-kiri-emerald text-[10px] font-bold">{initials}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      {/* Panel de notificaciones (dropdown) */}
      {notifsOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] pt-14">
          <div className="absolute inset-0 bg-black/30" onClick={() => setNotifsOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl mx-3 mt-2 overflow-hidden max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-cyclon-lavender" />
                <span className="font-bold text-sm">Notificaciones</span>
                <span className={cn("h-2 w-2 rounded-full", connected ? "bg-kiri-emerald" : "bg-muted-foreground")} />
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl" onClick={markAllRead}><CheckCheck className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl text-destructive" onClick={clearNotifications}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl" onClick={() => setNotifsOpen(false)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            {/* Lista */}
            <div className="max-h-[50vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                  <Bell className="h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium">Sin notificaciones</p>
                  <p className="text-xs opacity-60">Las actividades de tu red aparecerán aquí</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {notifications.map(n => (
                    <li key={n.id} onClick={() => handleNotifClick(n)}
                      className={cn("flex items-start gap-3 px-4 py-3 active:bg-muted/50 cursor-pointer", !n.read && "bg-cyclon-lavender/5")}>
                      <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">{notifIcon(n.event)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs leading-snug", !n.read && "font-semibold")}>{notifTitle(n)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDistanceToNow(n.createdAt, { addSuffix: true, locale: es })}</p>
                      </div>
                      {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-cyclon-lavender shrink-0 mt-1.5" />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  )
}
