"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  X, PiggyBank, Coins, Loader2, ChevronRight, ArrowLeft,
  Heart, Users, Home, MessageCircle, Sparkles, ArrowRightLeft, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { connectionsApi } from "@/lib/api-client"
import { useAppContext } from "@/lib/app-context"
import { useToast } from "@/hooks/use-toast"
import { UserAvatar } from "@/components/social/UserAvatar"
import type { ConnectionSharedResponse, ConnectionRole } from "@/lib/types"

const ROLE_LABEL: Record<ConnectionRole, string> = { FRIEND: "Amigo", FAMILY: "Familia", PARTNER: "Pareja" }

/**
 * ConnectionProfileCard — Tarjeta de presentación completa de una conexión
 * Diseño inspirado en la referencia visual con:
 *   - Avatar grande centrado + nombre + fecha de conexión
 *   - Selector de rol (Amigo/Pareja/Familia)
 *   - Bolsillos compartidos con progreso
 *   - Préstamos entre ambos con estado
 *   - Sección "Creciendo juntos" motivacional
 */

interface Props {
  connectionId: string
  /** Id del usuario actual — necesario para saber si la solicitud de cambio
   * de rol pendiente (si hay una) la mandé yo o la mandó la otra persona. */
  myId: string
  open: boolean
  onClose: () => void
  /** Se llama después de pedir/responder un cambio de rol, para que la lista
   * de conexiones que abrió esta tarjeta también se refresque. */
  onChanged?: () => void
}

export function ConnectionProfileCard({ connectionId, myId, open, onClose, onChanged }: Props) {
  const { formatAmount } = useAppContext()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [data, setData] = useState<ConnectionSharedResponse | null>(null)
  // El cambio de rol nunca es instantáneo: elegir una opción abre esta modal
  // de confirmación primero — es la que realmente manda la solicitud.
  const [roleConfirmTarget, setRoleConfirmTarget] = useState<ConnectionRole | null>(null)

  const load = () => {
    setLoading(true)
    connectionsApi.getShared(connectionId).then(({ data: res }) => {
      if (res) setData(res)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!open || !connectionId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connectionId])

  const confirmRoleRequest = async () => {
    if (!roleConfirmTarget) return
    setUpdatingRole(true)
    const { error } = await connectionsApi.requestRole(connectionId, roleConfirmTarget)
    setUpdatingRole(false)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: `Solicitud enviada — ${data?.peer.nombre} debe aprobarla` })
      setRoleConfirmTarget(null)
      load()
      onChanged?.()
    }
  }

  const handleRoleRespond = async (accept: boolean) => {
    setUpdatingRole(true)
    const { error } = await connectionsApi.respondRole(connectionId, accept)
    setUpdatingRole(false)
    if (error) {
      toast({ title: error, variant: "destructive" })
    } else {
      toast({ title: accept ? "Cambio de rol aceptado ✓" : "Cambio de rol rechazado" })
      load()
      onChanged?.()
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("es-ES", { month: "long", year: "numeric" })
  }

  if (!open) return null

  // Cálculo de "nivel de conexión" basado en ahorros reales y actividad
  const connectionLevel = data ? (() => {
    const totalSaved = data.pockets.reduce((a, p) => a + p.balance, 0)
    const totalMeta = data.pockets.reduce((a, p) => a + p.meta, 0)
    const paidLoans = data.loans.filter(l => l.status === 'PAID').length

    if (totalMeta === 0 && data.pockets.length === 0 && data.loans.length === 0) return 0

    let score = 0
    // Progreso en metas de ahorro (hasta 50%)
    if (totalMeta > 0) score += Math.round((totalSaved / totalMeta) * 50)
    else if (data.pockets.length > 0) score += 20
    // Préstamos pagados (hasta 30%)
    if (data.loans.length > 0) score += Math.round((paidLoans / data.loans.length) * 30)
    // Tener actividad compartida (20% base)
    if (data.pockets.length > 0 || data.loans.length > 0) score += 20

    return Math.min(100, score)
  })() : 0

  return (
    <>
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md lg:max-w-xl max-h-[90vh] overflow-y-auto bg-card rounded-3xl shadow-2xl">
        {/* Header con fondo */}
        <div className="relative bg-gradient-to-b from-kiri-emerald/20 to-transparent pb-16 pt-4 px-4 rounded-t-3xl">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-8 left-1/2 -translate-x-1/2">
              <Sparkles className="h-5 w-5 text-kiri-emerald/30" />
            </div>
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div />
            <button onClick={onClose} className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-kiri-emerald" />
        </div>
      ) : data ? (
        <div className="px-4 -mt-12 pb-6 space-y-4 max-w-lg mx-auto">
          {/* Avatar + Nombre */}
          <div className="flex flex-col items-center gap-3">
            <UserAvatar
              nombre={data.peer.nombre}
              avatarUrl={data.peer.avatarUrl}
              className="h-24 w-24 border-4 border-kiri-emerald/30 shadow-lg shadow-kiri-emerald/20"
              fallbackClassName="bg-kiri-mint text-kiri-emerald font-black text-3xl"
            />
            <div className="text-center">
              <h2 className="text-xl font-black flex items-center gap-1.5 justify-center">
                {data.peer.nombre}
                <span className="text-kiri-emerald">⚙</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conectados desde {formatDate(data.connection.createdAt)}
              </p>
            </div>
          </div>

          {/* Rol en tu vida — cambiar de opción NUNCA aplica al instante: abre
              la modal de confirmación, que es la que manda la solicitud. La
              otra persona tiene que aprobarla antes de que el rol cambie de
              verdad (mismo patrón que la tasa de interés de un préstamo). */}
          <Card className="border-none bg-card rounded-2xl shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-kiri-emerald/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-kiri-emerald" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Rol en tu vida</p>
                  <p className="text-[9px] text-muted-foreground">Define cómo es tu relación</p>
                </div>
              </div>

              {data.connection.pendingRole && data.connection.roleChangeRequestedBy === myId && (
                <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Esperando que {data.peer.nombre} apruebe el cambio a <strong>{ROLE_LABEL[data.connection.pendingRole]}</strong>
                  </p>
                </div>
              )}
              {data.connection.pendingRole && data.connection.roleChangeRequestedBy && data.connection.roleChangeRequestedBy !== myId && (
                <div className="flex items-center justify-between gap-2 bg-cyclon-lavender/5 border border-cyclon-lavender/20 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-cyclon-lavender font-medium">
                    {data.peer.nombre} propone cambiar a <strong>{ROLE_LABEL[data.connection.pendingRole]}</strong>
                  </p>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="icon" disabled={updatingRole} onClick={() => handleRoleRespond(true)} className="h-7 w-7 rounded-lg bg-kiri-emerald text-white">
                      {updatingRole ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" disabled={updatingRole} onClick={() => handleRoleRespond(false)} className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'FRIEND', label: 'Amigo', icon: <Users className="h-3.5 w-3.5" /> },
                  { value: 'PARTNER', label: 'Pareja', icon: <Heart className="h-3.5 w-3.5" /> },
                  { value: 'FAMILY', label: 'Familia', icon: <Home className="h-3.5 w-3.5" /> },
                ] as const).map(r => {
                  const isActive = data.connection.role === r.value
                  return (
                    <button
                      key={r.value}
                      onClick={() => { if (r.value !== data.connection.role) setRoleConfirmTarget(r.value) }}
                      disabled={updatingRole || !!data.connection.pendingRole}
                      className={cn(
                        "flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-bold border-2 transition-all disabled:opacity-50",
                        isActive
                          ? "bg-kiri-emerald text-white border-kiri-emerald shadow-sm shadow-kiri-emerald/20"
                          : "border-muted text-muted-foreground hover:border-kiri-emerald/30"
                      )}
                    >
                      {r.icon} {r.label}
                    </button>
                  )
                })}
              </div>

              <p className="text-[8px] text-muted-foreground">
                Cambiar el rol le manda una solicitud a {data.peer.nombre} — solo se aplica si la acepta.
              </p>
            </CardContent>
          </Card>

          {/* Bolsillos + Préstamos (2 columnas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bolsillos compartidos */}
            <Card className="border-none bg-card rounded-2xl shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-kiri-emerald" />
                    <span className="text-sm font-bold">Ahorros compartidos</span>
                    <span className="text-[8px] font-bold bg-kiri-emerald/10 text-kiri-emerald px-1.5 py-0.5 rounded-full">{data.pockets.length}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[9px] text-muted-foreground">Metas que construyen juntos</p>

                {data.pockets.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-3">Sin ahorros compartidos aún</p>
                ) : (
                  <div className="space-y-3">
                    {data.pockets.slice(0, 2).map(p => {
                      const pct = p.meta > 0 ? Math.round((p.balance / p.meta) * 100) : 0
                      return (
                        <div key={p.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{p.nombre}</span>
                            <span className="text-[10px] font-bold text-kiri-emerald">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                            <div className="h-full rounded-full bg-kiri-emerald transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <p className="text-[8px] text-muted-foreground">{formatAmount(p.balance)} / {formatAmount(p.meta)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {data.pockets.length > 0 && (
                  <button className="w-full text-center text-[10px] font-bold text-kiri-emerald hover:underline pt-1">
                    Ver todos los ahorros
                  </button>
                )}
              </CardContent>
            </Card>

            {/* Préstamos */}
            <Card className="border-none bg-card rounded-2xl shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold">Préstamos entre ustedes</span>
                    <span className="text-[8px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full">{data.loans.length}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[9px] text-muted-foreground">Control de préstamos y pagos</p>

                {data.loans.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-3">Sin préstamos activos</p>
                ) : (
                  <div className="space-y-3">
                    {data.loans.slice(0, 2).map(l => {
                      const isPaid = l.status === 'PAID'
                      const pct = l.amount > 0 ? Math.round(((l.amount - l.remainingAmount) / l.amount) * 100) : 0
                      const paid = l.amount - l.remainingAmount
                      return (
                        <div key={l.id} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate flex-1">{l.descripcion || "Préstamo"}</span>
                            <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full",
                              isPaid ? "bg-kiri-emerald/10 text-kiri-emerald" : "bg-amber-500/10 text-amber-500"
                            )}>
                              {isPaid ? "Pagado" : "Activo"}
                            </span>
                          </div>
                          <p className="text-sm font-black">{formatAmount(l.amount)}</p>
                          <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isPaid ? "#10b981" : "#f59e0b" }} />
                          </div>
                          <div className="flex justify-between text-[8px] text-muted-foreground">
                            <span>Pagado: {formatAmount(paid)}</span>
                            <span>Falta: {formatAmount(l.remainingAmount)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {data.loans.length > 0 && (
                  <button className="w-full text-center text-[10px] font-bold text-amber-500 hover:underline pt-1">
                    Ver todos los préstamos
                  </button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Creciendo juntos — con datos reales y recomendaciones */}
          <Card className="border-none bg-gradient-to-r from-kiri-emerald/5 to-emerald-900/5 rounded-2xl shadow-sm border border-kiri-emerald/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-bold flex items-center gap-1">Creciendo juntos 🌱</h4>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {(() => {
                      const totalSaved = data.pockets.reduce((a, p) => a + p.balance, 0)
                      const totalMeta = data.pockets.reduce((a, p) => a + p.meta, 0)
                      const activeLoans = data.loans.filter(l => l.status === 'ACTIVE').length
                      
                      if (totalSaved === 0 && data.pockets.length === 0 && data.loans.length === 0) {
                        return "¡Empiecen creando un ahorro compartido! Juntos pueden lograr más."
                      }
                      if (activeLoans > 0 && totalSaved === 0) {
                        return "Tienen préstamos activos pero sin ahorros juntos. Consideren crear una meta compartida."
                      }
                      if (totalMeta > 0 && totalSaved / totalMeta < 0.3) {
                        return "Van por buen camino. Intenten aportar regularmente para alcanzar sus metas más rápido."
                      }
                      if (totalMeta > 0 && totalSaved / totalMeta >= 0.7) {
                        return "¡Excelente progreso! Están muy cerca de cumplir sus metas juntos. 🎉"
                      }
                      return "Sigan trabajando en equipo para alcanzar todas sus metas."
                    })()}
                  </p>
                  {data.pockets.length > 0 && (
                    <p className="text-[9px] font-bold text-kiri-emerald mt-2">
                      Total ahorrado juntos: {formatAmount(data.pockets.reduce((a, p) => a + p.balance, 0))}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-center">
                  <div className="relative h-16 w-16">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${connectionLevel * 2.64} 264`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-black text-kiri-emerald">{connectionLevel}%</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-muted-foreground mt-1">Nivel de conexión</p>
                  <p className="text-[8px] font-bold text-kiri-emerald">🌱 Equipo Kiri</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">No se pudieron cargar los datos</p>
        </div>
      )}
      </div>
    </div>

      {/* ── Confirmar solicitud de cambio de rol ──
          Esta modal solo explica que se va a mandar una solicitud — el rol
          real no cambia hasta que {data?.peer.nombre} la aprueba. */}
      <Dialog open={!!roleConfirmTarget} onOpenChange={(v) => { if (!v) setRoleConfirmTarget(null) }}>
        {/* La tarjeta de perfil es su propio overlay a z-[80] — el Dialog
            comparte el mismo componente en toda la app con z-50 por defecto,
            así que sin este override quedaba abierto pero invisible y sin
            poder hacerle clic, detrás del backdrop de la tarjeta. */}
        <DialogContent className="max-w-sm z-[90]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-cyclon-lavender" /> Solicitar cambio de rol
            </DialogTitle>
          </DialogHeader>
          {roleConfirmTarget && data && (
            <div className="py-1 space-y-3">
              <p className="text-sm text-muted-foreground">
                Vas a proponerle a <strong className="text-foreground">{data.peer.nombre}</strong> cambiar esta conexión
                de <strong className="text-foreground">{ROLE_LABEL[data.connection.role]}</strong> a{" "}
                <strong className="text-foreground">{ROLE_LABEL[roleConfirmTarget]}</strong>.
              </p>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
                Le enviaremos una solicitud — el rol de la conexión solo cambiará si {data.peer.nombre} la acepta.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRoleConfirmTarget(null)} className="rounded-xl">Cancelar</Button>
            <Button
              disabled={updatingRole}
              onClick={confirmRoleRequest}
              className="rounded-xl bg-cyclon-lavender text-white font-bold px-6"
            >
              {updatingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
