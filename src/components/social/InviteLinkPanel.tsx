"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Heart, HandHeart, Home, Share2, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { inviteLinksApi, urlInvitacion } from "@/lib/api-client"
import type { ConnectionRole } from "@/lib/types"
import { tr } from "@/lib/i18n"

export const ROLE_OPTIONS: { value: ConnectionRole; label: string; icon: typeof Heart; color: string }[] = [
  { value: "FRIEND", label: tr("Amigo"), icon: HandHeart, color: "text-blue-500 border-blue-500/50 bg-blue-500/10" },
  { value: "FAMILY", label: tr("Familia"), icon: Home, color: "text-amber-500 border-amber-500/50 bg-amber-500/10" },
  { value: "PARTNER", label: tr("Pareja"), icon: Heart, color: "text-pink-500 border-pink-500/50 bg-pink-500/10" },
]

const ROLE_TEXTO: Record<ConnectionRole, string> = { FRIEND: "amigo", FAMILY: "familia", PARTNER: "pareja" }

/** Mensaje de invitación ya escrito, con lo que gana quien llega con el enlace. */
export function mensajeInvitacion(rol = "amigo"): string {
  return tr("¡Únete a Kiri Finance! Organizo mi plata, ahorro y cuido mi jardín financiero ahí 🌱 Entra con mi enlace: tienes 14 días de KIRI PLUS gratis y quedamos conectados como {0}.", [rol])
}

/** Logo de WhatsApp (lucide no lo trae). */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.38 9.38 0 0 1 9.43 9.44c0 5.2-4.23 9.43-9.44 9.43m8.03-17.47A11.27 11.27 0 0 0 12.05.7C5.8.7.7 5.79.7 12.05c0 2 .52 3.95 1.52 5.67L.6 23.6l6.03-1.58a11.3 11.3 0 0 0 5.42 1.38h.01c6.25 0 11.35-5.1 11.35-11.35 0-3.03-1.18-5.88-3.33-8.02" />
    </svg>
  )
}

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
      if (err || !data) { setError(err ?? tr("No se pudo generar tu enlace")); return }
      setCode(data.code); setReferidos(data.referidos)
    })
    return () => { vigente = false }
  }, [role])

  const url = code ? urlInvitacion(code) : ""
  const mensaje = mensajeInvitacion(ROLE_TEXTO[role])

  // WhatsApp directo con el mensaje ya escrito (en Colombia es por donde se comparte todo)
  const whatsapp = () => {
    if (!url) return
    window.open(`https://wa.me/?text=${encodeURIComponent(`${mensaje} ${url}`)}`, "_blank", "noopener")
  }

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
      try { await navigator.share({ title: tr("Kiri Finance"), text: mensaje, url }); return } catch { /* canceló o no se pudo */ return }
    }
    // Sin Web Share (escritorio): WhatsApp con el mensaje ya redactado
    window.open(`https://wa.me/?text=${encodeURIComponent(`${mensaje} ${url}`)}`, "_blank", "noopener")
  }

  return (
    <div className="space-y-3">
      {!roleFijo && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold">{tr("¿Qué es esta persona para ti?")}</p>
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
            <bdi dir="ltr">{error ?? (url.replace(/^https?:\/\//, "") || tr("Generando tu enlace…"))}</bdi>
          </span>
        </div>
        <Button type="button" onClick={copiar} disabled={!code} variant="outline" className="h-11 px-3 rounded-xl gap-1.5 font-bold text-xs shrink-0" aria-label={tr("Copiar enlace")}>
          {copiado ? <Check className="h-4 w-4 text-kiri-emerald" /> : <Copy className="h-4 w-4" />}
          {copiado ? tr("Copiado") : tr("Copiar")}
        </Button>
        <Button type="button" onClick={compartir} disabled={!code} variant="outline" className="h-11 px-3 rounded-xl gap-1.5 font-bold text-xs shrink-0" aria-label={tr("Compartir enlace")}>
          <Share2 className="h-4 w-4" /> {!compact && tr("Compartir")}
        </Button>
      </div>
      <Button type="button" onClick={whatsapp} disabled={!code} className="w-full h-11 rounded-xl gap-2 font-bold text-sm bg-[#25D366] hover:bg-[#1ebe5b] text-white">
        <WhatsAppIcon className="h-4 w-4" />{" "}{tr("Enviar por WhatsApp")}</Button>

      <p className="text-[10.5px] text-muted-foreground leading-snug">{tr("Cuando se registre con este enlace, aparecerán conectados en Social como")}{" "}<strong>{ROLE_TEXTO[role]}</strong>{". "}{tr("Tiene 14 días de KIRI PLUS gratis. Cuando registre sus primeros movimientos, los dos ganan más mensajes con Kiri Coach, y si se suscribe, tú ganas 1 mes gratis de tu plan.")}{referidos > 0 && <> <span className="inline-flex items-center gap-1 font-bold text-kiri-emerald"><Users className="h-3 w-3" />{" "}{tr("{0} {1} con tus enlaces.", [referidos, referidos === 1 ? tr("persona se ha unido") : tr("personas se han unido")])}</span></>}
      </p>
    </div>
  )
}

export function InviteLinkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md [&>*]:min-w-0 overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{tr("💌 Invita a alguien a Kiri")}</DialogTitle>
          <DialogDescription>{tr("Compártele tu enlace: tiene 14 días de KIRI PLUS gratis y los dos ganan cuando empiece a usar Kiri.")}</DialogDescription>
        </DialogHeader>
        <InviteLinkPanel />
      </DialogContent>
    </Dialog>
  )
}
