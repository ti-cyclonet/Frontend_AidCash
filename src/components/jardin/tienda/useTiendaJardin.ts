"use client"

/**
 * Estado de la tienda del árbol 3D: saldo de monedas, lo equipado, inventario y
 * cofres por abrir. Todo viene del servidor (lib/economia.ts del backend); aquí
 * solo se muestra. Se vuelve a pedir cuando el usuario ahorra, paga o salda una
 * deuda, y avisa cuánto ganó.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { gamificationApi, type EstadoTienda } from "@/lib/api-client"
import { GARDEN_EVENT_MONEDAS, GARDEN_EVENT_RAIN } from "@/lib/garden-events"
import { tr } from "@/lib/i18n"

const claveVistas = () => `kiri_monedas_vistas_${localStorage.getItem("kiri_user_id") ?? "anon"}`

export function useTiendaJardin() {
  const [estado, setEstado] = useState<EstadoTienda | null>(null)
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null)
  const previo = useRef<EstadoTienda | null>(null)
  const avisoTimer = useRef<number | null>(null)

  const avisar = useCallback((texto: string) => {
    setAviso({ id: Date.now(), texto })
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current)
    avisoTimer.current = window.setTimeout(() => setAviso(null), 3600)
  }, [])

  /** Pide el estado; con `motivo` compara contra el anterior y avisa lo ganado. */
  const cargar = useCallback(async (motivo?: "ahorro" | "pago" | "deuda") => {
    const { data } = await gamificationApi.tienda()
    if (!data) return
    const antes = previo.current
    previo.current = data
    setEstado(data)
    // Los ahorros y pagos suelen hacerse en otras pantallas: al entrar se cuenta lo ganado desde la última visita
    // Regalo mensual del plan (PLUS/PRO): se avisa aparte y no cuenta como "ganadas desde tu última visita"
    const regalo = data.plan?.regaloRecibido ?? 0
    if (regalo > 0) avisar(tr("Tu plan {0} te regaló {1} monedas este mes", [data.plan.tier, regalo]))
    try {
      const clave = claveVistas(), vistas = Number(localStorage.getItem(clave) ?? NaN)
      localStorage.setItem(clave, String(data.monedas))
      if (!antes && !regalo && Number.isFinite(vistas) && data.monedas > vistas) avisar(tr("Ganaste {0} monedas desde tu última visita", [data.monedas - vistas]))
    } catch { /* sin storage */ }
    if (!antes) return
    const ganadas = data.monedas - antes.monedas
    const nuevosRaros = data.cofres.filter(c => c.tipo === "raro").length - antes.cofres.filter(c => c.tipo === "raro").length
    if (motivo === "deuda" && ganadas > 0) avisar(tr("+{0} monedas y un cofre por saldar tu deuda", [ganadas]))
    else if (motivo === "ahorro" && ganadas > 0) avisar(tr("+{0} monedas por tu ahorro", [ganadas]))
    else if (motivo === "pago" && ganadas > 0) avisar(tr("+{0} monedas por pagar a tiempo", [ganadas]))
    else if (nuevosRaros > 0) avisar(nuevosRaros === 1 ? tr("Subiste de nivel: ganaste un cofre raro") : tr("Subiste de nivel: ganaste {0} cofres raros", [nuevosRaros]))
  }, [avisar])

  useEffect(() => {
    cargar()
    // el servidor abona después de guardar el movimiento: se espera un momento
    const tras = (motivo?: "ahorro" | "pago" | "deuda") => () => { window.setTimeout(() => cargar(motivo), 700) }
    const alAhorrar = tras("ahorro")
    const alPagar = (e: Event) => tras((e as CustomEvent<{ motivo?: "pago" | "deuda" }>).detail?.motivo ?? "pago")()
    const alVolver = () => { if (!document.hidden) cargar() }
    window.addEventListener(GARDEN_EVENT_RAIN, alAhorrar)
    window.addEventListener(GARDEN_EVENT_MONEDAS, alPagar)
    document.addEventListener("visibilitychange", alVolver)
    return () => {
      window.removeEventListener(GARDEN_EVENT_RAIN, alAhorrar)
      window.removeEventListener(GARDEN_EVENT_MONEDAS, alPagar)
      document.removeEventListener("visibilitychange", alVolver)
      if (avisoTimer.current) window.clearTimeout(avisoTimer.current)
    }
  }, [cargar])

  /** Estado que devolvió una compra, un equipo o un cofre: ya se mostró, no cuenta como "ganado desde la última visita". */
  const fijar = useCallback((e: EstadoTienda) => {
    previo.current = e; setEstado(e)
    try { localStorage.setItem(claveVistas(), String(e.monedas)) } catch { /* sin storage */ }
  }, [])

  return { estado, aviso, avisar, recargar: cargar, setEstado: fijar }
}
