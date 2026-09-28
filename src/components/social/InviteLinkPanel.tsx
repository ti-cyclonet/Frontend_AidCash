"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Heart, HandHeart, Home, Share2, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { inviteLinksApi, urlInvitacion } from "@/lib/api-client"
import type { ConnectionRole } from "@/lib/types"

export const ROLE_OPTIONS: { value: ConnectionRole; label: string; icon: typeof Heart; color: string }[] = [
  { value: "FRIEND", label: "Amigo", icon: HandHeart, color: "text-blue-500 border-blue-500/50 bg-blue-500/10" },
  { value: "FAMILY", label: "Familia", icon: Home, color: "text-amber-500 border-amber-500/50 bg-amber-500/10" },
  { value: "PARTNER", label: "Pareja", icon: Heart, color: "text-pink-500 border-pink-500/50 bg-pink-500/10" },
]

const ROLE_TEXTO: Record<ConnectionRole, string> = { FRIEND: "amigo", FAMILY: "familia", PARTNER: "pareja" }

/**
 * Enlace de invitación a Kiri: quien se registre con él queda conectado
 * contigo en Social (ya aceptado, con el tipo de relación elegido) y cuenta
 * para tus misiones de invitar. `role` fijo = sin selector (Social ya lo
 * eligió antes); sin `role` = el usuario elige Amigo / Familia / Pareja.
 */
export function InviteLinkPanel({ role: roleFijo, compact = false }: { role?: ConnectionRole; compact?: boolean }) {
  const [role, setRole] = useState<ConnectionRole>(roleFijo ?? "FRIEND")
  const [code, setCode] = useState<string | null>(null)
  const [referidos, setReferidos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => { if (roleFijo) setRole(roleFijo) }, [roleFijo])

  useEffect(() => {
    let vigente = true
    setCode(null); setError(null)
    inviteLinksApi.get(role).then(({ data, error: err }) => {
      if (!vigente) return
      if (err || !data) { setError(err ?? "No se pudo generar tu enlace"); return }
      setCode(data.code); setReferidos(data.referidos)
    })
    return () => { vigente = false }
  }, [role])

  const url = code ? urlInvitacion(code) : ""
  const mensaje = `¡Únete a Kiri Finance! Organiza tu plata, ahorra y cuida tu jardín financiero conmigo 🌱 Entra con mi enlace y quedamos conectados como ${ROLE_TEXTO[role]}:`

  const copiar = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Navegadores sin permiso de portapapeles: selección manual
      const t = document.createElement("textarea")
      t.value = url; document.body.appendChild(t); t.select()
      try { document.execCommand("copy") } catch { /* nada más que hacer */ }
      t.remove()
    }
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 1800)
  }

  const compartir = async () => {
    if (!url) return
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: "Kiri Finance", text: mensaje, url }); return } catch { /* canceló o no se pudo */ return }
    }
    // Sin Web Share (escritorio): WhatsApp con el mensaje ya redactado
    window.open(`https://wa.me/?text=${encodeURIComponent(`${mensaje} ${url}`)}`, "_blank", "noopener")
  }

  return (
    <div className="space-y-3">
      {!roleFijo && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold">¿Qué es esta persona para ti?</p>
          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setRole(o.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 py-2 text-[11px] font-bold transition-colors",
                  role === o.value ? o.color : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                <o.icon className="h-4 w-4" /> {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 h-11 rounded-xl border border-border bg-muted/30 px-3 flex items-center">
          {/* dir="rtl": si no cabe, se recorta el inicio y se ve el código */}
          <span dir={url && !error ? "rtl" : undefined} className="truncate text-xs font-mono text-muted-foreground" title={url}>
            <bdi dir="ltr">{error ?? (url.replace(/^https?:\/\//, "") || "Generando tu enlace…")}</bdi>
          </span>
        </div>
        <Button type="button" onClick={copiar} disabled={!code} variant="outline" className="h-11 px-3 rounded-xl gap-1.5 font-bold text-xs shrink-0" aria-label="Copiar enlace">
          {copiado ? <Check className="h-4 w-4 text-kiri-emerald" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
        <Button type="button" onClick={compartir} disabled={!code} className="h-11 px-3 rounded-xl gap-1.5 font-bold text-xs shrink-0 bg-kiri-emerald hover:bg-kiri-emerald/90 text-white" aria-label="Compartir enlace">
          <Share2 className="h-4 w-4" /> {!compact && "Compartir"}
        </Button>
      </div>

      <p className="text-[10.5px] text-muted-foreground leading-snug">
        Cuando se registre con este enlace, aparecerán conectados en Social como <strong>{ROLE_TEXTO[role]}</strong> y avanzas tus misiones de invitar.
        {referidos > 0 && <> <span className="inline-flex items-center gap-1 font-bold text-kiri-emerald"><Users className="h-3 w-3" /> {referidos} {referidos === 1 ? "persona se ha unido" : "personas se han unido"} con tus enlaces.</span></>}
      </p>
    </div>
  )
}

export function InviteLinkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md [&>*]:min-w-0 overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">💌 Invita a alguien a Kiri</DialogTitle>
          <DialogDescription>Compártele tu enlace: con un toque se crea su cuenta y quedan conectados.</DialogDescription>
        </DialogHeader>
        <InviteLinkPanel />
      </DialogContent>
    </Dialog>
  )
}
