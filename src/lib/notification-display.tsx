import {
  UserPlus, UserCheck, UserX, PiggyBank, Coins, Check, XCircle,
  CalendarClock, Wallet, ArrowRightLeft, Droplet, Bell, PartyPopper, Target, Home, Receipt,
} from "lucide-react"
import { SOCKET_EVENTS, KiriNotification } from "@/lib/socket-context"
import { tr } from "@/lib/i18n"

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

export function notifIcon(event: KiriNotification["event"], data?: Record<string, unknown>) {
  // Avisos de factura (FactoNet → Kiri)
  if (event === SOCKET_EVENTS.AVISO && data?.tipo === "factura") return <Receipt className="h-4 w-4 text-sky-500" />
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
    case SOCKET_EVENTS.REFERRAL_JOINED:        return <PartyPopper className="h-4 w-4 text-kiri-emerald" />
    case SOCKET_EVENTS.HOGAR_GASTO:            return <Home className="h-4 w-4 text-pink-500" />
    case SOCKET_EVENTS.MISSION_REMINDER:       return <Target className="h-4 w-4 text-amber-500" />
    case SOCKET_EVENTS.AVISO:                  return <Bell className="h-4 w-4 text-kiri-emerald" />
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
      return tr("{0} te invitó", [(d.from as { nombre?: string })?.nombre ?? tr("Alguien")])
    case SOCKET_EVENTS.INVITE_ACCEPTED:
      return tr("{0} aceptó tu invitación", [(d.by as { nombre?: string })?.nombre ?? tr("Tu contacto")])
    case SOCKET_EVENTS.INVITE_REJECTED:
      return tr("Tu invitación fue rechazada")
    case SOCKET_EVENTS.SHARED_DEPOSIT:
      return d.type === "deposit"
        ? tr("{0} depositó en \"{1}\"", [(d.by as { nombre?: string })?.nombre ?? tr("Tu contacto"), d.pocketName ?? d.nombre])
        : tr("{0} creó el bolsillo \"{1}\"", [(d.by as { nombre?: string })?.nombre ?? tr("Tu contacto"), d.nombre])
    case SOCKET_EVENTS.LOAN_REQUESTED:
      return tr("{0} solicita un préstamo", [(d.borrower as { nombre?: string })?.nombre ?? tr("Alguien")])
    case SOCKET_EVENTS.LOAN_APPROVED:
      return tr("Tu solicitud de préstamo fue aprobada")
    case SOCKET_EVENTS.LOAN_REJECTED:
      return tr("Tu solicitud de préstamo fue rechazada")
    case SOCKET_EVENTS.LOAN_PAYMENT:
      return tr("{0} registró un abono", [(d.borrower as { nombre?: string })?.nombre ?? tr("Tu deudor")])
    case SOCKET_EVENTS.LOAN_PAYMENT_CONFIRMED:
      return tr("Tu abono fue confirmado")
    case SOCKET_EVENTS.LOAN_PAYMENT_REJECTED:
      return tr("Tu abono fue rechazado")
    case SOCKET_EVENTS.ROLE_CHANGE_REQUESTED:
      return tr("{0} propone cambiar su conexión contigo", [(d.requesterName as string) ?? tr("Tu contacto")])
    case SOCKET_EVENTS.ROLE_CHANGE_ACCEPTED:
      return tr("{0} aceptó el cambio de rol", [(d.responderName as string) ?? tr("Tu contacto")])
    case SOCKET_EVENTS.ROLE_CHANGE_REJECTED:
      return tr("{0} rechazó el cambio de rol", [(d.responderName as string) ?? tr("Tu contacto")])
    case SOCKET_EVENTS.GARDEN_WATERED:
      return tr("{0} regó tu árbol{1}", [(d.fromName as string) ?? tr("Alguien"), d.xpGiven ? tr(" (+{0} XP)", [d.xpGiven]) : ""])
    case SOCKET_EVENTS.HOGAR_GASTO:
      return (d.message as string) ?? tr("Movimiento en el presupuesto del hogar")
    case SOCKET_EVENTS.REFERRAL_JOINED:
      return (d.message as string) ?? tr("{0} se unió a Kiri con tu enlace", [(d.nombre as string) ?? tr("Alguien")])
    case SOCKET_EVENTS.MISSION_REMINDER:
      return (d.message as string) ?? tr("Tus misiones de hoy te esperan")
    case SOCKET_EVENTS.AVISO:
      return (d.message as string) ?? tr("Aviso de Kiri")
    case SOCKET_EVENTS.ALERT_PAYMENT_PROXIMITY:
      return (d.message as string) ?? tr("Se acerca tu fecha de pago")
    case SOCKET_EVENTS.ALERT_INCOME_REMINDER:
      return (d.message as string) ?? tr("¿Ya registraste tu ingreso?")
    case SOCKET_EVENTS.ALERT_PERIOD_ASSIGNED:
      return (d.message as string) ?? tr("Ingreso asignado al periodo")
    default:
      return tr("Nueva notificación")
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
