"use client"

import { useState, useEffect, useCallback } from "react"
import { UserPlus, UserCheck, UserX, Loader2, Users, Mail, Trash2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { connectionsApi } from "@/lib/api-client"
import { useSocket, SOCKET_EVENTS } from "@/lib/socket-context"
import { useToast } from "@/hooks/use-toast"
import type { Connection, SocialUser } from "@/lib/types"

// ─── Helper ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

function getPeer(conn: Connection, myId: string): SocialUser | undefined {
  if (conn.requesterId === myId) return conn.addressee
  return conn.requester
}

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface ConnectionsData {
  accepted: Connection[]
  pendingReceived: Connection[]
  pendingSent: Connection[]
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface ConnectionsTabProps {
  myId: string
}

export function ConnectionsTab({ myId }: ConnectionsTabProps) {
  const { toast } = useToast()
  const { socket } = useSocket()

  const [data, setData] = useState<ConnectionsData>({ accepted: [], pendingReceived: [], pendingSent: [] })
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ── Cargar conexiones ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data: res, error } = await connectionsApi.list()
    if (error || !res) {
      toast({ title: "Error al cargar conexiones", variant: "destructive" })
    } else {
      setData({
        accepted:        res.accepted        as unknown as Connection[],
        pendingReceived: res.pendingReceived  as unknown as Connection[],
        pendingSent:     res.pendingSent      as unknown as Connection[],
      })
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  // ── Recargar al recibir eventos socket ─────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const refresh = () => load()
    socket.on(SOCKET_EVENTS.NEW_INVITE,      refresh)
    socket.on(SOCKET_EVENTS.INVITE_ACCEPTED, refresh)
    socket.on(SOCKET_EVENTS.INVITE_REJECTED, refresh)
    return () => {
      socket.off(SOCKET_EVENTS.NEW_INVITE,      refresh)
      socket.off(SOCKET_EVENTS.INVITE_ACCEPTED, refresh)
      socket.off(SOCKET_EVENTS.INVITE_REJECTED, refresh)
    }
  }, [socket, load])

  // ── Enviar invitación ──────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    const { error } = await connectionsApi.invite(inviteEmail.trim())
    setInviting(false)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Invitación enviada", description: `Se notificó a ${inviteEmail}` })
      setInviteEmail("")
      load()
    }
  }

  // ── Aceptar / rechazar ─────────────────────────────────────────────────────
  const handleAccept = async (connId: string) => {
    setActionLoading(connId)
    const { error } = await connectionsApi.accept(connId)
    setActionLoading(null)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Conexión aceptada ✓" })
      load()
    }
  }

  const handleReject = async (connId: string) => {
    setActionLoading(connId)
    const { error } = await connectionsApi.reject(connId)
    setActionLoading(null)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Invitación rechazada" })
      load()
    }
  }

  const handleRemove = async (connId: string) => {
    setActionLoading(connId)
    const { error } = await connectionsApi.remove(connId)
    setActionLoading(null)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: "Conexión eliminada" })
      load()
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-cyclon-lavender" />
        <p className="text-sm">Cargando conexiones...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Invitar usuario ── */}
      <Card className="border-none bg-card rounded-3xl shadow-sm">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-cyclon-lavender" />
            <h3 className="font-bold text-sm">Invitar usuario</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Ingresa el correo de tu pareja, familiar o amigo en Kiri Finance.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleInvite() }}
              className="h-11 rounded-2xl flex-1"
            />
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviting}
              className="h-11 px-5 rounded-2xl bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white font-bold"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Pendientes recibidas ── */}
      {data.pendingReceived.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Invitaciones recibidas ({data.pendingReceived.length})
          </h3>
          {data.pendingReceived.map(conn => {
            const peer = conn.requester!
            const busy = actionLoading === conn.id
            return (
              <Card key={conn.id} className="border-none bg-card rounded-2xl shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-cyclon-lavender/10 text-cyclon-lavender font-bold text-xs">
                      {initials(peer.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{peer.nombre}</p>
                    <p className="text-xs text-muted-foreground truncate">{peer.correo}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => handleAccept(conn.id)}
                      className="h-8 px-3 rounded-xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold text-xs"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => handleReject(conn.id)}
                      className="h-8 px-3 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <UserX className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      {/* ── Pendientes enviadas ── */}
      {data.pendingSent.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Enviadas · esperando respuesta ({data.pendingSent.length})
          </h3>
          {data.pendingSent.map(conn => {
            const peer = conn.addressee!
            return (
              <Card key={conn.id} className="border-none bg-card rounded-2xl shadow-sm opacity-70">
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-muted text-muted-foreground font-bold text-xs">
                      {initials(peer.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{peer.nombre}</p>
                    <p className="text-xs text-muted-foreground truncate">{peer.correo}</p>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                    Pendiente
                  </span>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      {/* ── Conectados ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          Conexiones activas ({data.accepted.length})
        </h3>
        {data.accepted.length === 0 ? (
          <Card className="border-none bg-muted/30 rounded-3xl">
            <CardContent className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
              <Users className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">Sin conexiones aún</p>
              <p className="text-xs text-center opacity-70">Invita a alguien para compartir bolsillos y préstamos</p>
            </CardContent>
          </Card>
        ) : (
          data.accepted.map(conn => {
            const peer = getPeer(conn, myId)!
            const busy = actionLoading === conn.id
            return (
              <Card key={conn.id} className="border-none bg-card rounded-2xl shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-kiri-mint text-kiri-emerald font-bold text-xs">
                      {initials(peer.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{peer.nombre}</p>
                    <p className="text-xs text-muted-foreground truncate">{peer.correo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-kiri-emerald" title="Conectado" />
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => handleRemove(conn.id)}
                      className="h-8 w-8 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Eliminar conexión"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </section>
    </div>
  )
}
