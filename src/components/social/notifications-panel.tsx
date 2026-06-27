"use client"

import { useState } from "react"
import { Bell, X, CheckCheck, Trash2, UserPlus, UserCheck, UserX, PiggyBank, Coins, Check, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSocket, SOCKET_EVENTS, KiriNotification } from "@/lib/socket-context"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

// ─── Helpers para renderizar notificaciones ───────────────────────────────────

function notifIcon(event: KiriNotification["event"]) {
  switch (event) {
    case SOCKET_EVENTS.NEW_INVITE:        return <UserPlus  className="h-4 w-4 text-cyclon-lavender" />
    case SOCKET_EVENTS.INVITE_ACCEPTED:   return <UserCheck className="h-4 w-4 text-kiri-emerald" />
    case SOCKET_EVENTS.INVITE_REJECTED:   return <UserX     className="h-4 w-4 text-destructive" />
    case SOCKET_EVENTS.SHARED_DEPOSIT:    return <PiggyBank className="h-4 w-4 text-cyclon-mint" />
    case SOCKET_EVENTS.LOAN_REQUESTED:    return <Coins     className="h-4 w-4 text-cyclon-sky" />
    case SOCKET_EVENTS.LOAN_APPROVED:     return <Check     className="h-4 w-4 text-kiri-emerald" />
    case SOCKET_EVENTS.LOAN_REJECTED:     return <XCircle   className="h-4 w-4 text-destructive" />
    case SOCKET_EVENTS.LOAN_PAYMENT:      return <Coins     className="h-4 w-4 text-cyclon-sky" />
    case SOCKET_EVENTS.LOAN_PAYMENT_CONFIRMED: return <Check className="h-4 w-4 text-kiri-emerald" />
    case SOCKET_EVENTS.LOAN_PAYMENT_REJECTED:  return <XCircle className="h-4 w-4 text-destructive" />
    default: return <Bell className="h-4 w-4 text-muted-foreground" />
  }
}

function notifTitle(n: KiriNotification): string {
  const d = n.data
  switch (n.event) {
    case SOCKET_EVENTS.NEW_INVITE:
      return `${(d.from as { nombre?: string })?.nombre ?? "Alguien"} te envió una invitación`
    case SOCKET_EVENTS.INVITE_ACCEPTED:
      return `${(d.by as { nombre?: string })?.nombre ?? "Tu contacto"} aceptó tu invitación`
    case SOCKET_EVENTS.INVITE_REJECTED:
      return "Tu invitación fue rechazada"
    case SOCKET_EVENTS.SHARED_DEPOSIT:
      return d.type === "deposit"
        ? `${(d.by as { nombre?: string })?.nombre ?? "Tu pareja"} depositó en "${d.pocketName}"`
        : `${(d.by as { nombre?: string })?.nombre ?? "Tu pareja"} creó el bolsillo "${d.nombre}"`
    case SOCKET_EVENTS.LOAN_REQUESTED:
      return `${(d.borrower as { nombre?: string })?.nombre ?? "Alguien"} solicita un préstamo`
    case SOCKET_EVENTS.LOAN_APPROVED:
      return "Tu solicitud de préstamo fue aprobada"
    case SOCKET_EVENTS.LOAN_REJECTED:
      return "Tu solicitud de préstamo fue rechazada"
    case SOCKET_EVENTS.LOAN_PAYMENT:
      return `${(d.borrower as { nombre?: string })?.nombre ?? "Tu deudor"} registró un abono`
    case SOCKET_EVENTS.LOAN_PAYMENT_CONFIRMED:
      return "Tu abono fue confirmado"
    case SOCKET_EVENTS.LOAN_PAYMENT_REJECTED:
      return "Tu abono fue rechazado"
    default:
      return "Nueva notificación"
  }
}

// ─── Panel flotante ───────────────────────────────────────────────────────────

export function NotificationsPanel() {
  const { notifications, unreadCount, markAllRead, clearNotifications, connected } = useSocket()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => { setOpen(v => !v); if (!open) markAllRead() }}
        className={cn(
          "relative h-10 w-10 rounded-2xl flex items-center justify-center transition-all",
          open ? "bg-cyclon-lavender/20 text-cyclon-lavender" : "bg-card hover:bg-muted text-muted-foreground"
        )}
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-cyclon-pink rounded-full flex items-center justify-center text-[8px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-12 w-[340px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-3xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-cyclon-lavender" />
                <span className="font-bold text-sm">Notificaciones</span>
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  connected ? "bg-kiri-emerald" : "bg-muted-foreground"
                )} title={connected ? "Conectado" : "Desconectado"} />
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl" onClick={markAllRead} title="Marcar todo leído">
                      <CheckCheck className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl text-destructive hover:text-destructive" onClick={clearNotifications} title="Limpiar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl" onClick={() => setOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
                  <Bell className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">Sin notificaciones</p>
                  <p className="text-xs opacity-60">Las actividades de tu red aparecerán aquí</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {notifications.map(n => (
                    <li
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors",
                        !n.read && "bg-cyclon-lavender/5"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                        "bg-muted/50"
                      )}>
                        {notifIcon(n.event)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs leading-snug", !n.read && "font-semibold")}>
                          {notifTitle(n)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(n.createdAt, { addSuffix: true, locale: es })}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="h-1.5 w-1.5 rounded-full bg-cyclon-lavender shrink-0 mt-1.5" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
