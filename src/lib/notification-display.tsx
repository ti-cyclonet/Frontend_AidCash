import {
  UserPlus, UserCheck, UserX, PiggyBank, Coins, Check, XCircle,
  CalendarClock, Wallet, ArrowRightLeft, Droplet, Bell,
} from "lucide-react"
import { SOCKET_EVENTS, KiriNotification } from "@/lib/socket-context"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Fuente única de verdad para renderizar una notificación (ícono, título, ruta
 * al hacer clic) — antes había TRES copias independientes de esta lógica
 * (top-bar.tsx, sidebar.tsx, y un notifications-panel.tsx que ni siquiera se
 * usaba en ningún lado) que habían divergido: cada una reconocía un subconjunto
 * distinto de eventos, así que la misma notificación se veía completa en un
 * lugar y como "Nueva notificación" genérica en otro. Con un solo lugar, un
 * evento nuevo (o uno que faltaba, como el riego de jardín o los cambios de
 * rol) se agrega una vez y aparece correcto en todas las campanas a la vez.
 */

export function notifIcon(event: KiriNotification["event"]) {
  switch (event) {
    case SOCKET_EVENTS.NEW_INVITE:             return <UserPlus className="h-4 w-4 text-cyclon-lavender" />
    case SOCKET_EVENTS.INVITE_ACCEPTED:        return <UserCheck className="h-4 w-4 text-kiri-emerald" />
    case SOCKET_EVENTS.INVITE_REJECTED:        return <UserX className="h-4 w-4 text-destructive" />
    case SOCKET_EVENTS.SHARED_DEPOSIT:         return <PiggyBank className="h-4 w-4 text-cyclon-mint" />
    case SOCKET_EVENTS.LOAN_REQUESTED:         return <Coins className="h-4 w-4 text-cyclon-sky" />
    case SOCKET_EVENTS.LOAN_APPROVED:          return <Check className="h-4 w-4 text-kiri-emerald" />
    case SOCKET_EVENTS.LOAN_REJECTED:          return <XCircle className="h-4 w-4 text-destructive" />
    case SOCKET_EVENTS.LOAN_PAYMENT:           return <Coins className="h-4 w-4 text-cyclon-sky" />
    case SOCKET_EVENTS.LOAN_PAYMENT_CONFIRMED: return <Check className="h-4 w-4 text-kiri-emerald" />
    case SOCKET_EVENTS.LOAN_PAYMENT_REJECTED:  return <XCircle className="h-4 w-4 text-destructive" />
    case SOCKET_EVENTS.ROLE_CHANGE_REQUESTED:  return <ArrowRightLeft className="h-4 w-4 text-cyclon-lavender" />
    case SOCKET_EVENTS.ROLE_CHANGE_ACCEPTED:   return <Check className="h-4 w-4 text-kiri-emerald" />
    case SOCKET_EVENTS.ROLE_CHANGE_REJECTED:   return <XCircle className="h-4 w-4 text-destructive" />
    case SOCKET_EVENTS.GARDEN_WATERED:         return <Droplet className="h-4 w-4 text-cyclon-sky" />
    case SOCKET_EVENTS.ALERT_PAYMENT_PROXIMITY: return <CalendarClock className="h-4 w-4 text-amber-500" />
    case SOCKET_EVENTS.ALERT_INCOME_REMINDER:   return <Wallet className="h-4 w-4 text-kiri-emerald" />
    case SOCKET_EVENTS.ALERT_PERIOD_ASSIGNED:   return <CalendarClock className="h-4 w-4 text-cyclon-sky" />
    default: return <Bell className="h-4 w-4 text-muted-foreground" />
  }
}

export function notifTitle(n: KiriNotification): string {
  const d = n.data
  switch (n.event) {
    case SOCKET_EVENTS.NEW_INVITE:
      return `${(d.from as { nombre?: string })?.nombre ?? "Alguien"} te invitó`
    case SOCKET_EVENTS.INVITE_ACCEPTED:
      return `${(d.by as { nombre?: string })?.nombre ?? "Tu contacto"} aceptó tu invitación`
    case SOCKET_EVENTS.INVITE_REJECTED:
      return "Tu invitación fue rechazada"
    case SOCKET_EVENTS.SHARED_DEPOSIT:
      return d.type === "deposit"
        ? `${(d.by as { nombre?: string })?.nombre ?? "Tu contacto"} depositó en "${d.pocketName ?? d.nombre}"`
        : `${(d.by as { nombre?: string })?.nombre ?? "Tu contacto"} creó el bolsillo "${d.nombre}"`
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
    case SOCKET_EVENTS.ROLE_CHANGE_REQUESTED:
      return `${(d.requesterName as string) ?? "Tu contacto"} propone cambiar su conexión contigo`
    case SOCKET_EVENTS.ROLE_CHANGE_ACCEPTED:
      return `${(d.responderName as string) ?? "Tu contacto"} aceptó el cambio de rol`
    case SOCKET_EVENTS.ROLE_CHANGE_REJECTED:
      return `${(d.responderName as string) ?? "Tu contacto"} rechazó el cambio de rol`
    case SOCKET_EVENTS.GARDEN_WATERED:
      return `${(d.fromName as string) ?? "Alguien"} regó tu árbol${d.xpGiven ? ` (+${d.xpGiven} XP)` : ""}`
    case SOCKET_EVENTS.ALERT_PAYMENT_PROXIMITY:
      return (d.message as string) ?? "Se acerca tu fecha de pago"
    case SOCKET_EVENTS.ALERT_INCOME_REMINDER:
      return (d.message as string) ?? "¿Ya registraste tu ingreso?"
    case SOCKET_EVENTS.ALERT_PERIOD_ASSIGNED:
      return (d.message as string) ?? "Ingreso asignado al periodo"
    default:
      return "Nueva notificación"
  }
}

export function notifRoute(n: KiriNotification): string {
  const d = n.data
  // Si la notificación trae una ruta específica, usarla
  if (d.route && typeof d.route === "string") return d.route
  // Las alertas inteligentes van a la billetera
  if (n.event.startsWith("alert:")) return "/gestion?tab=billetera"
  // Regar el jardín lleva directo al árbol, no a Social — mismo destino que
  // usa la notificación push equivalente (ver pushGardenWatered).
  if (n.event === SOCKET_EVENTS.GARDEN_WATERED) return "/jardin"
  // El resto son notificaciones sociales (invitaciones, préstamos, roles)
  return "/social"
}
