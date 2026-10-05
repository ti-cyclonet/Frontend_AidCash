"use client"

/**
 * "¡Lo lograste! Comparte tu logro e invita a un amigo": aparece en momentos
 * de alegría (subir de nivel el árbol, racha de 7+ días, meta de ahorro
 * cumplida, deuda en ceros). Arma una imagen bonita para estados de WhatsApp
 * e Instagram con tu enlace, o manda el mensaje directo por WhatsApp.
 *
 * Cualquier pantalla lo dispara con `celebrarLogro({ icono, titulo, detalle })`.
 * No sale más de una vez cada 6 horas para no cansar.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Download, Share2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { WhatsAppIcon } from "@/components/social/InviteLinkPanel"
import { inviteLinksApi, urlInvitacion } from "@/lib/api-client"
import { tr } from "@/lib/i18n"

export interface Logro { icono: string; titulo: string; detalle: string; clave: string }

const EVENTO = "kiri:logro"
const CLAVE_ULTIMO = "kiri_logro_ultimo"
const PAUSA_MS = 6 * 60 * 60 * 1000

/** Muestra la celebración (una vez por `clave`, y no más de una cada 6 horas). */
export function celebrarLogro(logro: Logro) {
  if (typeof window === "undefined") return
  try {
    const vistos = JSON.parse(localStorage.getItem("kiri_logros_vistos") ?? "[]") as string[]
    if (vistos.includes(logro.clave)) return
    const ultimo = Number(localStorage.getItem(CLAVE_ULTIMO) ?? 0)
    if (Date.now() - ultimo < PAUSA_MS) return
    localStorage.setItem("kiri_logros_vistos", JSON.stringify([...vistos, logro.clave].slice(-60)))
    localStorage.setItem(CLAVE_ULTIMO, String(Date.now()))
  } catch { /* sin storage: se muestra igual */ }
  window.dispatchEvent(new CustomEvent<Logro>(EVENTO, { detail: logro }))
}

/** Imagen 1080×1350 (formato de estado) con el logro y el enlace. */
async function dibujarImagen(logro: Logro, enlace: string | null): Promise<Blob | null> {
  const c = document.createElement("canvas")
  c.width = 1080; c.height = 1350
  const g = c.getContext("2d")
  if (!g) return null
  const fondo = g.createLinearGradient(0, 0, 1080, 1350)
  fondo.addColorStop(0, "#0b3d2a"); fondo.addColorStop(0.55, "#14684a"); fondo.addColorStop(1, "#1f8f63")
  g.fillStyle = fondo; g.fillRect(0, 0, 1080, 1350)
  // brillos
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`
    g.beginPath(); g.arc(Math.random() * 1080, Math.random() * 1350, 3 + Math.random() * 10, 0, Math.PI * 2); g.fill()
  }
  g.fillStyle = "rgba(255,255,255,.08)"
  g.beginPath(); g.arc(540, 470, 260, 0, Math.PI * 2); g.fill()
  g.textAlign = "center"
  g.font = "280px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"
  g.fillText(logro.icono, 540, 570)
  g.fillStyle = "#ffffff"
  g.font = "bold 76px system-ui, -apple-system, 'Segoe UI', sans-serif"
  const lineas = (texto: string, max: number) => {
    const out: string[] = []; let l = ""
    for (const p of texto.split(" ")) {
      const prueba = l ? `${l} ${p}` : p
      if (g.measureText(prueba).width > max && l) { out.push(l); l = p } else l = prueba
    }
    if (l) out.push(l)
    return out
  }
  let y = 860
  for (const l of lineas(logro.titulo, 920).slice(0, 3)) { g.fillText(l, 540, y); y += 90 }
  g.fillStyle = "rgba(255,255,255,.85)"
  g.font = "44px system-ui, -apple-system, 'Segoe UI', sans-serif"
  for (const l of lineas(logro.detalle, 900).slice(0, 3)) { g.fillText(l, 540, y + 10); y += 58 }
  g.fillStyle = "#b9f5d3"
  g.font = "bold 46px system-ui, -apple-system, 'Segoe UI', sans-serif"
  g.fillText(tr("🌱 Kiri Finance · organiza tu plata"), 540, 1230)
  if (enlace) {
    g.fillStyle = "rgba(255,255,255,.75)"
    g.font = "34px system-ui, -apple-system, 'Segoe UI', sans-serif"
    g.fillText(enlace.replace(/^https?:\/\//, ""), 540, 1290)
  }
  return new Promise(res => c.toBlob(b => res(b), "image/png"))
}

export function LogroCompartible() {
  const [logro, setLogro] = useState<Logro | null>(null)
  const [enlace, setEnlace] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    const h = (e: Event) => setLogro((e as CustomEvent<Logro>).detail)
    window.addEventListener(EVENTO, h)
    return () => window.removeEventListener(EVENTO, h)
  }, [])
  useEffect(() => {
    if (!logro || enlace) return
    inviteLinksApi.get("FRIEND").then(({ data }) => { if (data?.code) setEnlace(urlInvitacion(data.code)) }).catch(() => {})
  }, [logro, enlace])

  const mensaje = useCallback(() => logro
    ? tr("{0} {1} en Kiri 🌱 Organiza tu plata conmigo: entra con mi enlace y tienes 14 días de KIRI PLUS gratis.", [logro.icono, logro.titulo])
    : "", [logro])

  const compartirImagen = async () => {
    if (!logro) return
    setTrabajando(true)
    try {
      const blob = await dibujarImagen(logro, enlace)
      if (!blob) return
      const archivo = new File([blob], "logro-kiri.png", { type: "image/png" })
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
      if (typeof nav.share === "function" && nav.canShare?.({ files: [archivo] })) {
        await nav.share({ files: [archivo], text: `${mensaje()} ${enlace ?? ""}`.trim() }).catch(() => {})
      } else {
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob); a.download = "logro-kiri.png"; a.click()
        window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      }
    } finally {
      setTrabajando(false)
    }
  }
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${mensaje()} ${enlace ?? ""}`.trim())}`, "_blank", "noopener")

  const confeti = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    x: (Math.random() - 0.5) * 320, y: -80 - Math.random() * 160, r: Math.random() * 540 - 270,
    c: ["#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#a78bfa"][i % 5], d: Math.random() * 0.25,
  })), [logro]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={!!logro} onOpenChange={v => { if (!v) setLogro(null) }}>
      <DialogContent className="sm:max-w-sm overflow-hidden text-center">
        {logro && (
          <>
            <div className="relative h-28 flex items-center justify-center">
              {confeti.map((p, i) => (
                <motion.span key={i} className="absolute left-1/2 top-1/2 h-2 w-1.5 rounded-sm" style={{ background: p.c }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                  animate={{ x: p.x, y: [0, p.y, p.y + 220], opacity: [1, 1, 0], rotate: p.r }}
                  transition={{ duration: 1.8, delay: p.d, ease: "easeOut" }} />
              ))}
              <motion.span className="text-7xl" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 11 }}>
                {logro.icono}
              </motion.span>
            </div>
            <DialogTitle className="text-xl">{tr("¡Lo lograste!")} {logro.titulo}</DialogTitle>
            <DialogDescription>{logro.detalle}</DialogDescription>
            <p className="text-xs rounded-xl bg-amber-400/10 border border-amber-400/30 px-3 py-2">
              {tr("Compártelo e invita a un amigo: tiene 14 días de KIRI PLUS gratis y los dos ganan cuando empiece a usar Kiri.")}
            </p>
            <div className="grid gap-2">
              <Button onClick={whatsapp} className="gap-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white"><WhatsAppIcon className="h-4 w-4" />{" "}{tr("Compartir por WhatsApp")}</Button>
              <Button onClick={compartirImagen} disabled={trabajando} variant="outline" className="gap-2">
                {typeof navigator !== "undefined" && typeof navigator.share === "function" ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {tr("Imagen para tu estado")}
              </Button>
              <Button variant="ghost" onClick={() => setLogro(null)}>{tr("Ahora no")}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
