"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { activarNotificaciones, estadoPush, registrarDispositivo, type EstadoPush } from "@/lib/push-client"

const POSPUESTO_KEY = "kiri_push_pospuesto_hasta"

/**
 * - Si el dispositivo ya dio permiso: renueva la suscripción en silencio en
 *   cada inicio de sesión (así siempre queda registrado en el backend).
 * - Si no: muestra una tarjeta con "Activar" (el permiso se pide con el
 *   toque, que es lo que exigen Chrome e iPhone). "Ahora no" la esconde 7 días.
 */
export function NotificationInitializer() {
  const { user } = useAuth()
  const initialized = useRef(false)
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [visible, setVisible] = useState(false)
  const [activando, setActivando] = useState(false)

  useEffect(() => {
    if (!user || initialized.current) return
    initialized.current = true
    const e = estadoPush()
    setEstado(e)
    if (e === "activas") {
      registrarDispositivo().catch(() => {})
      return
    }
    if (e === "sin-activar" || e === "instalar-ios") {
      let pospuesto = 0
      try { pospuesto = Number(localStorage.getItem(POSPUESTO_KEY) ?? 0) } catch { /* sin storage */ }
      if (Date.now() > pospuesto) {
        const t = window.setTimeout(() => setVisible(true), 4000)
        return () => window.clearTimeout(t)
      }
    }
  }, [user])

  const posponer = () => {
    setVisible(false)
    try { localStorage.setItem(POSPUESTO_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000)) } catch { /* sin storage */ }
  }

  const activar = async () => {
    setActivando(true)
    const e = await activarNotificaciones()
    setActivando(false)
    setEstado(e)
    if (e === "activas" || e === "bloqueadas") setVisible(false)
  }

  if (!visible || !estado) return null

  return (
    <div className="fixed inset-x-3 bottom-24 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[360px] z-50 rounded-2xl border border-border bg-card shadow-2xl p-4 space-y-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-kiri-emerald/10 flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4 text-kiri-emerald" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Activa las notificaciones</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {estado === "instalar-ios"
              ? "En iPhone llegan solo con Kiri instalada: en Safari toca Compartir → \"Agregar a inicio\" y abre Kiri desde ahí."
              : "Te avisamos de pagos por vencer, tu día de pago, misiones y lo que pase en Social, aunque la app esté cerrada."}
          </p>
        </div>
        <button onClick={posponer} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>
      {estado !== "instalar-ios" && (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={posponer} className="flex-1 h-9 rounded-xl text-xs">Ahora no</Button>
          <Button onClick={activar} disabled={activando} className="flex-1 h-9 rounded-xl text-xs font-bold bg-kiri-emerald hover:bg-kiri-emerald/90 text-white">
            {activando ? "Activando…" : "Activar"}
          </Button>
        </div>
      )}
    </div>
  )
}
