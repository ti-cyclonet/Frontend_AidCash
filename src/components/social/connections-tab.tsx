"use client"

import { useState, useEffect, useCallback } from "react"
import { UserCheck, UserX, Loader2, Users, Trash2, Clock, Heart, Home, UsersRound, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { connectionsApi, homeBudgetApi } from "@/lib/api-client"
import { useSocket, SOCKET_EVENTS } from "@/lib/socket-context"
import { useToast } from "@/hooks/use-toast"
import { GamificationLeaderboard, LeaderboardEntry } from "@/components/social/GamificationLeaderboard"
import { HomeBudgetDashboard } from "@/components/social/HomeBudgetDashboard"
import { ConnectionProfileCard } from "@/components/social/ConnectionProfileCard"
import { AddConnectionModal } from "@/components/social/AddConnectionModal"
import { UserAvatar } from "@/components/social/UserAvatar"
import { ParejaChallenge } from "@/components/social/ParejaChallenge"
import { NeighborGardens } from "@/components/social/NeighborGardens"
import { useFriendsGarden } from "@/hooks/use-friends-garden"
import type { Connection, SocialUser } from "@/lib/types"

// ─── Helper ───────────────────────────────────────────────────────────────────

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

type ConnectionRoleType = 'FRIEND' | 'FAMILY' | 'PARTNER'

const ROLE_CONFIG: { value: ConnectionRoleType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'FRIEND', label: 'Amigo', icon: <UsersRound className="h-4 w-4" />, color: 'text-blue-500 border-blue-500/40 bg-blue-500/5' },
  { value: 'FAMILY', label: 'Familia', icon: <Home className="h-4 w-4" />, color: 'text-amber-500 border-amber-500/40 bg-amber-500/5' },
  { value: 'PARTNER', label: 'Pareja', icon: <Heart className="h-4 w-4" />, color: 'text-pink-500 border-pink-500/40 bg-pink-500/5' },
]

function getRoleBadge(role: string) {
  const r = ROLE_CONFIG.find(c => c.value === role)
  if (!r) return null
  return (
    <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border", r.color)}>
      {r.label}
    </span>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface ConnectionsTabProps {
  myId: string
  showInviteModal?: boolean
  onCloseInviteModal?: () => void
}

export function ConnectionsTab({ myId, showInviteModal = false, onCloseInviteModal }: ConnectionsTabProps) {
  const { toast } = useToast()
  const { socket } = useSocket()
  const { friends, friendsWhoWateredYouToday, you: myGarden, water } = useFriendsGarden()

  const [data, setData] = useState<ConnectionsData>({ accepted: [], pendingReceived: [], pendingSent: [] })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [homeBudget, setHomeBudget] = useState<{ budget: any; partnerId: string } | null>(null)
  const [homeBudgetLoading, setHomeBudgetLoading] = useState(false)
  const [profileCardConnId, setProfileCardConnId] = useState<string | null>(null)
  const [connectionsExpanded, setConnectionsExpanded] = useState(true)
  const [inviteModalOpen, setInviteModalOpen] = useState(showInviteModal)

  // Sync invite modal with parent prop
  useEffect(() => { setInviteModalOpen(showInviteModal) }, [showInviteModal])
  const closeInviteModal = () => { setInviteModalOpen(false); onCloseInviteModal?.() }

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

  // Cargar presupuesto del hogar si hay conexión PARTNER
  useEffect(() => {
    const hasPartner = data.accepted.some((c: any) => c.role === 'PARTNER')
    if (hasPartner) {
      setHomeBudgetLoading(true)
      homeBudgetApi.get().then(({ data: res }) => {
        if (res) setHomeBudget(res as any)
        setHomeBudgetLoading(false)
      })
    }
  }, [data.accepted])

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

      {/* ── Modal Invitar usuario ── */}
      <AddConnectionModal
        open={inviteModalOpen}
        onClose={closeInviteModal}
        onInvited={() => { closeInviteModal(); load() }}
      />

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
                  <UserAvatar nombre={peer.nombre} avatarUrl={peer.avatarUrl} className="h-10 w-10 shrink-0" fallbackClassName="bg-cyclon-lavender/10 text-cyclon-lavender" />
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
                  <UserAvatar nombre={peer.nombre} avatarUrl={peer.avatarUrl} className="h-10 w-10 shrink-0" fallbackClassName="bg-muted text-muted-foreground" />
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

      {/* ── Conectados (colapsable) ── */}
      <section className="space-y-2">
        <button
          onClick={() => setConnectionsExpanded(v => !v)}
          className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider"
        >
          <span className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Conexiones activas ({data.accepted.length})
          </span>
          {connectionsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {connectionsExpanded && (
          <>
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
            const role = (conn as any).role as string | undefined
            return (
              <Card key={conn.id} className="border-none bg-card rounded-2xl shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div onClick={() => setProfileCardConnId(conn.id)} className="cursor-pointer">
                    <UserAvatar nombre={peer.nombre} avatarUrl={peer.avatarUrl} className="h-12 w-12 shrink-0 border-2 border-kiri-emerald/20" fallbackClassName="bg-kiri-mint text-kiri-emerald text-sm" />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setProfileCardConnId(conn.id)}>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{peer.nombre}</p>
                      {role && getRoleBadge(role)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{peer.correo}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Cambiar rol */}
                    <select
                      value={role ?? 'FRIEND'}
                      onChange={async (e) => {
                        const newRole = e.target.value as 'FRIEND' | 'FAMILY' | 'PARTNER'
                        setActionLoading(conn.id)
                        const { error } = await connectionsApi.updateRole(conn.id, newRole)
                        setActionLoading(null)
                        if (error) toast({ title: error, variant: "destructive" })
                        else load()
                      }}
                      disabled={busy}
                      className="h-8 rounded-lg bg-muted/50 border-none text-[10px] font-bold px-2 cursor-pointer appearance-none"
                    >
                      <option value="FRIEND">Amigo</option>
                      <option value="FAMILY">Familia</option>
                      <option value="PARTNER">Pareja</option>
                    </select>
                    <span className="h-2 w-2 rounded-full bg-kiri-emerald shrink-0" title="Conectado" />
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
          </>
        )}
      </section>

      {/* ── Presupuesto del Hogar (solo si hay PARTNER) ── */}
      {(homeBudget || homeBudgetLoading) && (
        <section className="space-y-2">
          <HomeBudgetDashboard
            budget={homeBudget?.budget ?? null}
            partnerName={(() => {
              const partnerConn = data.accepted.find((c: any) => c.role === 'PARTNER')
              if (!partnerConn) return "Pareja"
              const peer = getPeer(partnerConn, myId)
              return peer?.nombre ?? "Pareja"
            })()}
            loading={homeBudgetLoading}
          />
        </section>
      )}

      {/* ── Reto en pareja (solo si hay conexión PARTNER) ── */}
      {(() => {
        const partnerConn = data.accepted.find((c: any) => c.role === 'PARTNER')
        return partnerConn ? <ParejaChallenge connection={partnerConn} myId={myId} /> : null
      })()}

      {/* ── Racha entre amigos + Jardines vecinos (solo conexiones tipo amigo) ── */}
      {friends.length > 0 && myGarden && (
        <section className="space-y-4">
          <GamificationLeaderboard
            entries={[
              ...friends.map(f => ({
                id: f.connectionId,
                nombre: f.peer.nombre,
                avatarUrl: f.peer.avatarUrl,
                streakActual: f.streak,
                streakMejor: f.streakMejor,
                badgesCount: f.badgesCount,
                health: f.health,
              })),
              {
                id: myId,
                nombre: "Tú",
                streakActual: myGarden.streak,
                streakMejor: myGarden.streakMejor,
                badgesCount: myGarden.badgesCount,
                health: myGarden.health,
                isCurrentUser: true,
              },
            ] as LeaderboardEntry[]}
          />
          <NeighborGardens friends={friends} friendsWhoWateredYouToday={friendsWhoWateredYouToday} onWater={water} />
        </section>
      )}

      {/* Tarjeta de perfil de conexión */}
      <ConnectionProfileCard
        connectionId={profileCardConnId ?? ""}
        open={!!profileCardConnId}
        onClose={() => setProfileCardConnId(null)}
      />
    </div>
  )
}
