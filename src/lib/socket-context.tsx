"use client"

/**
 * Kiri Finance — Socket.io Client Context
 *
 * Provee la instancia del socket autenticada a toda la app.
 * El socket se conecta solo cuando el usuario está autenticado
 * y se desconecta automáticamente al cerrar sesión.
 */

import {
  createContext, useContext, useEffect, useRef,
  useState, useCallback, ReactNode,
} from "react"
import { io, Socket } from "socket.io-client"
import { getAccessToken } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

// ─── Nombres de eventos (espejo del backend) ──────────────────────────────────

export const SOCKET_EVENTS = {
  NEW_INVITE:              "notification:new_invite",
  INVITE_ACCEPTED:         "notification:invite_accepted",
  INVITE_REJECTED:         "notification:invite_rejected",
  SHARED_DEPOSIT:          "social:shared_deposit",
  LOAN_REQUESTED:          "loan:requested",
  LOAN_APPROVED:           "loan:approved",
  LOAN_REJECTED:           "loan:rejected",
  LOAN_PAYMENT:            "loan:payment_submitted",
  LOAN_PAYMENT_CONFIRMED:  "loan:payment_confirmed",
  LOAN_PAYMENT_REJECTED:   "loan:payment_rejected",
  // Alertas inteligentes (locales, no vienen del socket)
  ALERT_PAYMENT_PROXIMITY: "alert:payment_proximity",
  ALERT_INCOME_REMINDER:   "alert:income_reminder",
  ALERT_PERIOD_ASSIGNED:   "alert:period_assigned",
} as const

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS]

// ─── Tipos de notificaciones ──────────────────────────────────────────────────

export interface KiriNotification {
  id:        string
  event:     SocketEvent
  data:      Record<string, unknown>
  read:      boolean
  createdAt: Date
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

interface SocketContextValue {
  socket:        Socket | null
  connected:     boolean
  notifications: KiriNotification[]
  unreadCount:   number
  markAllRead:   () => void
  clearNotifications: () => void
  addNotification: (event: SocketEvent, data: Record<string, unknown>) => void
}

const SocketContext = createContext<SocketContextValue>({
  socket:        null,
  connected:     false,
  notifications: [],
  unreadCount:   0,
  markAllRead:   () => {},
  clearNotifications: () => {},
  addNotification: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ?? "http://localhost:4000"

// Eventos que generan notificaciones persistentes en la UI
const NOTIFICATION_EVENTS: SocketEvent[] = [
  SOCKET_EVENTS.NEW_INVITE,
  SOCKET_EVENTS.INVITE_ACCEPTED,
  SOCKET_EVENTS.INVITE_REJECTED,
  SOCKET_EVENTS.SHARED_DEPOSIT,
  SOCKET_EVENTS.LOAN_REQUESTED,
  SOCKET_EVENTS.LOAN_APPROVED,
  SOCKET_EVENTS.LOAN_REJECTED,
  SOCKET_EVENTS.LOAN_PAYMENT,
  SOCKET_EVENTS.LOAN_PAYMENT_CONFIRMED,
  SOCKET_EVENTS.LOAN_PAYMENT_REJECTED,
]

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<KiriNotification[]>([])

  // ── Conectar / desconectar según sesión ────────────────────────────────────
  useEffect(() => {
    if (!authUser) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setSocket(null)
      setConnected(false)
      return
    }

    const token = getAccessToken()
    if (!token) return

    const sock = io(SOCKET_URL, {
      auth:       { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay:    2000,
    })

    sock.on("connect", () => {
      setConnected(true)
    })

    sock.on("disconnect", () => {
      setConnected(false)
    })

    sock.on("connect_error", (err) => {
      console.warn("[Socket] Error de conexión:", err.message)
    })

    // Registrar listeners para todos los eventos de notificación
    NOTIFICATION_EVENTS.forEach((event) => {
      sock.on(event, (data: Record<string, unknown>) => {
        const notif: KiriNotification = {
          id:        `${Date.now()}-${Math.random()}`,
          event,
          data,
          read:      false,
          createdAt: new Date(),
        }
        setNotifications(prev => [notif, ...prev].slice(0, 50)) // máx 50
      })
    })

    socketRef.current = sock
    setSocket(sock)

    return () => {
      sock.disconnect()
      socketRef.current = null
      setSocket(null)
      setConnected(false)
    }
  }, [authUser])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const addNotification = useCallback((event: SocketEvent, data: Record<string, unknown>) => {
    const notif: KiriNotification = {
      id: `local-${Date.now()}-${Math.random()}`,
      event,
      data,
      read: false,
      createdAt: new Date(),
    }
    setNotifications(prev => [notif, ...prev].slice(0, 50))
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <SocketContext.Provider value={{
      socket,
      connected,
      notifications,
      unreadCount,
      markAllRead,
      clearNotifications,
      addNotification,
    }}>
      {children}
    </SocketContext.Provider>
  )
}

// ─── Hook público ─────────────────────────────────────────────────────────────

export function useSocket() {
  return useContext(SocketContext)
}

/**
 * Hook simplificado para escuchar un evento específico.
 * Limpia el listener automáticamente al desmontar.
 */
export function useSocketEvent<T = Record<string, unknown>>(
  event: SocketEvent,
  handler: (data: T) => void
) {
  const { socket } = useSocket()

  useEffect(() => {
    if (!socket) return
    socket.on(event, handler as (data: unknown) => void)
    return () => { socket.off(event, handler as (data: unknown) => void) }
  }, [socket, event, handler])
}
