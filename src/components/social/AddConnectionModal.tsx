"use client"

import { useState } from "react"
import { Heart, Home, HandHeart, Search, Check, ChevronLeft, UserPlus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { userApi, connectionsApi } from "@/lib/api-client"
import { UserAvatar } from "@/components/social/UserAvatar"
import type { SocialUser, ConnectionRole } from "@/lib/types"

const TYPE_META: Record<ConnectionRole, { label: string; color: string; icon: typeof Heart; desc: string }> = {
  PARTNER: { label: "Pareja", color: "text-pink-500 border-pink-500/40 bg-pink-500/5", icon: Heart, desc: "Deudas y ahorro conjunto, préstamos entre ustedes, presupuesto del hogar" },
  FAMILY:  { label: "Familia", color: "text-amber-500 border-amber-500/40 bg-amber-500/5", icon: Home, desc: "Préstamos familiares, vaquitas para regalos o eventos, gastos de casa compartida" },
  FRIEND:  { label: "Amigo", color: "text-blue-500 border-blue-500/40 bg-blue-500/5", icon: HandHeart, desc: "Préstamos puntuales, ahorro grupal para un plan, dividir cuentas, y racha/jardín social" },
}

type Method = "username" | "correo"
type Step = "type" | "search" | "sent"

interface AddConnectionModalProps {
  open: boolean
  onClose: () => void
  onInvited: () => void
}

export function AddConnectionModal({ open, onClose, onInvited }: AddConnectionModalProps) {
  const [step, setStep] = useState<Step>("type")
  const [role, setRole] = useState<ConnectionRole>("FRIEND")
  const [method, setMethod] = useState<Method>("username")
  const [value, setValue] = useState("")
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState<SocialUser | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep("type"); setRole("FRIEND"); setMethod("username"); setValue("")
    setSearching(false); setSearched(false); setResult(null); setSending(false); setError(null)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSearch = async () => {
    if (!value.trim()) return
    setSearching(true); setSearched(false); setError(null)
    const { data } = await userApi.searchUser(method, value.trim())
    setResult(data?.user ?? null)
    setSearched(true)
    setSearching(false)
  }

  const handleInvite = async () => {
    if (!result) return
    setSending(true); setError(null)
    const { error: err } = await connectionsApi.invite(method, value.trim(), role)
    setSending(false)
    if (err) { setError(err); return }
    setStep("sent")
    onInvited()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-sm">
        {step === "type" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-kiri-emerald" /> ¿Con quién es esta conexión?
              </DialogTitle>
              <DialogDescription>Esto decide qué pueden compartir juntos.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-1">
              {(Object.entries(TYPE_META) as [ConnectionRole, typeof TYPE_META[ConnectionRole]][]).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => { setRole(key); setStep("search") }}
                  className="flex items-center gap-3 text-left bg-muted/40 border border-border rounded-2xl px-3.5 py-3 hover:bg-muted/70 transition-colors"
                >
                  <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border", t.color)}>
                    <t.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.label}</p>
                    <p className="text-[10.5px] text-muted-foreground leading-snug">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "search" && (
          <>
            <button
              onClick={() => { setStep("type"); setSearched(false); setResult(null); setValue("") }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Cambiar tipo
            </button>
            <DialogHeader>
              <DialogTitle>Buscar {TYPE_META[role].label.toLowerCase()}</DialogTitle>
              <DialogDescription>Solo se encuentra con una coincidencia exacta.</DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 mt-1">
              {(["username", "correo"] as Method[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMethod(m); setValue(""); setSearched(false); setResult(null) }}
                  className={cn(
                    "flex-1 h-8 rounded-lg text-xs font-bold border capitalize transition-colors",
                    method === m ? "border-kiri-emerald bg-kiri-emerald/10 text-kiri-emerald" : "border-border text-muted-foreground"
                  )}
                >
                  {m === "username" ? "Usuario" : "Correo"}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-3">
              <Input
                value={value}
                onChange={(e) => { setValue(e.target.value); setSearched(false) }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
                placeholder={method === "username" ? "@nombredeusuario" : "correo@ejemplo.com"}
                className="h-10 rounded-xl flex-1"
                autoFocus
              />
              <Button onClick={handleSearch} disabled={!value.trim() || searching} className="h-10 px-3 rounded-xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {searched && !result && (
              <p className="text-center text-xs text-destructive py-3">No encontramos a nadie con ese dato exacto.</p>
            )}

            {result && (
              <div className="flex items-center gap-3 bg-muted/40 border border-border rounded-2xl p-3 mt-3">
                <UserAvatar nombre={result.nombre} avatarUrl={result.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{result.nombre}</p>
                  {result.username && <p className="text-[10.5px] text-muted-foreground">@{result.username}</p>}
                </div>
                <Button size="sm" onClick={handleInvite} disabled={sending} className="h-8 rounded-lg bg-kiri-emerald hover:bg-kiri-emerald/90 text-white text-xs font-bold">
                  {sending ? "..." : "Invitar"}
                </Button>
              </div>
            )}

            {error && <p className="text-center text-xs text-destructive mt-2">{error}</p>}
          </>
        )}

        {step === "sent" && (
          <div className="text-center py-4">
            <div className="h-11 w-11 rounded-full bg-kiri-emerald/10 flex items-center justify-center mx-auto mb-3">
              <Check className="h-5 w-5 text-kiri-emerald" />
            </div>
            <p className="text-sm font-bold">Solicitud enviada</p>
            <p className="text-xs text-muted-foreground mt-1">Se activará como {TYPE_META[role].label.toLowerCase()} cuando acepte.</p>
            <Button onClick={handleClose} variant="outline" className="mt-4 rounded-xl">Listo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
