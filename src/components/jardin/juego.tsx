"use client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Minijuego del Árbol Kiri
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * - Frutos (desde el nivel 4): caen al pie del árbol, 1 por visitar y 1 por cada
 *   movimiento real de hoy (hasta 5). Tocarlos los cosecha: saltan, vuelan
 *   hasta la barra de XP y suenan.
 * - Combo: tocar el árbol seguido sube el combo; al llegar a 5 se sacude y
 *   suelta el premio sorpresa del día.
 * - Regar: mantener presionado el botón hasta llenar la regadera (1 vez al día).
 *
 * El servidor decide la XP (lib/jardin-juego.ts del backend); aquí solo se anima.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Droplets, Sparkles, Sprout } from "lucide-react"
import { gamificationApi, type EstadoJardin } from "@/lib/api-client"
import { tocarCosecha, tocarPremio, tocarRiego, tocarToque, prepararAudio } from "@/lib/thunder-sound"
import { GARDEN_EVENT_RAIN, GARDEN_EVENT_STORM, GARDEN_EVENT_INCOME } from "@/lib/garden-events"
import { cn } from "@/lib/utils"
import { tr } from "@/lib/i18n"

const vibrar = (ms: number | number[]) => { try { navigator.vibrate?.(ms) } catch { /* sin vibración */ } }

/** id del elemento al que vuelan los frutos (la barra de XP del jardín) */
export const ID_BARRA_XP = "kiri-barra-xp"

// ─── Estado del juego ────────────────────────────────────────────────────────

export function useJardinJuego(onXp: (xp: number) => void) {
  const [estado, setEstado] = useState<EstadoJardin | null>(null)
  const cargar = useCallback(async () => {
    const { data } = await gamificationApi.jardin()
    if (data) setEstado(data)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // Un movimiento nuevo (gasto, ingreso, pago, ahorro) hace nacer otro fruto
  useEffect(() => {
    const recargar = () => { window.setTimeout(cargar, 600) }
    const eventos = ["kiri:wallet-updated", GARDEN_EVENT_RAIN, GARDEN_EVENT_STORM, GARDEN_EVENT_INCOME]
    eventos.forEach(e => window.addEventListener(e, recargar))
    const visible = () => { if (!document.hidden) cargar() }
    document.addEventListener("visibilitychange", visible)
    return () => {
      eventos.forEach(e => window.removeEventListener(e, recargar))
      document.removeEventListener("visibilitychange", visible)
    }
  }, [cargar])

  const cosechar = useCallback(async (indice: number) => {
    // Optimista: el fruto desaparece de una; si el servidor dice que no, vuelve
    setEstado(e => e && { ...e, frutos: e.frutos.map(f => f.indice === indice ? { ...f, cosechado: true } : f) })
    const { data, error } = await gamificationApi.cosechar(indice)
    if (error || !data) { cargar(); return null }
    setEstado(e => e && { ...e, xpHoy: e.xpHoy + data.xp, xpJardin: e.xpJardin + data.xp })
    onXp(data.xp)
    return data
  }, [cargar, onXp])

  const sacudir = useCallback(async () => {
    const { data, error } = await gamificationApi.sacudir()
    if (error || !data) { cargar(); return null }
    setEstado(e => e && { ...e, sacudida: { etiqueta: data.etiqueta, xp: data.xp }, xpHoy: e.xpHoy + data.xp, xpJardin: e.xpJardin + data.xp, boost: e.boost || data.tipo === "boost" })
    if (data.xp) onXp(data.xp)
    return data
  }, [cargar, onXp])

  const regar = useCallback(async () => {
    const { data, error } = await gamificationApi.regar()
    if (error || !data) { cargar(); return null }
    setEstado(e => e && { ...e, regado: true, xpHoy: e.xpHoy + data.xp, xpJardin: e.xpJardin + data.xp })
    onXp(data.xp)
    return data
  }, [cargar, onXp])

  return { estado, cosechar, sacudir, regar, recargar: cargar }
}

// ─── Frutos caídos al pie del árbol ──────────────────────────────────────────

/**
 * Dónde queda cada fruto en el piso, al pie del árbol (% horizontal, px desde
 * abajo y cómo quedó tirado). Solo desde el nivel 4: antes no hay copa.
 */
const POS_PISO = [
  { x: 24, b: 4, r: -28 }, { x: 70, b: 0, r: 18 }, { x: 40, b: -4, r: 62 },
  { x: 84, b: 8, r: -12 }, { x: 56, b: 6, r: 35 },
]

interface Vuelo { id: number; x: number; y: number; dorado: boolean; xp: number }

export function FrutosArbol({ frutos, sonido, onCosechar }: {
  frutos: EstadoJardin["frutos"]
  sonido: boolean
  onCosechar: (indice: number) => Promise<{ xp: number; dorado: boolean } | null>
}) {
  const pos = POS_PISO
  const [cayendo, setCayendo] = useState<number[]>([])
  const [vuelos, setVuelos] = useState<Vuelo[]>([])
  const idRef = useRef(0)

  const tocar = async (e: React.PointerEvent<HTMLButtonElement>, f: EstadoJardin["frutos"][number]) => {
    e.stopPropagation()
    prepararAudio()
    if (cayendo.includes(f.indice)) return
    const r = e.currentTarget.getBoundingClientRect()
    setCayendo(c => [...c, f.indice])
    vibrar(f.dorado ? [12, 40, 18] : 12)
    if (sonido) tocarCosecha(f.dorado)
    const res = await onCosechar(f.indice)
    if (res) {
      const id = ++idRef.current
      setVuelos(v => [...v, { id, x: r.left + r.width / 2, y: r.top + r.height / 2, dorado: res.dorado, xp: res.xp }])
      window.setTimeout(() => setVuelos(v => v.filter(x => x.id !== id)), 1400)
    }
    window.setTimeout(() => setCayendo(c => c.filter(i => i !== f.indice)), 700)
  }

  return (
    <>
      <div className="absolute inset-x-0 bottom-0 h-16 z-20 pointer-events-none">
        <AnimatePresence>
          {frutos.filter(f => !f.cosechado || cayendo.includes(f.indice)).map(f => {
            const p = pos[f.indice % pos.length]
            const recogido = cayendo.includes(f.indice)
            return (
              <motion.button
                key={f.indice}
                type="button"
                aria-label={f.dorado ? tr("Cosechar fruto dorado") : tr("Cosechar fruto")}
                onPointerDown={e => tocar(e, f)}
                className="absolute pointer-events-auto p-1 touch-manipulation"
                // framer-motion usa transform: se centra con calc (mitad del botón ≈ 18px)
                style={{ left: `calc(${p.x}% - 18px)`, bottom: p.b }}
                // Entra cayendo desde la copa, rebota y queda tirado en el piso
                initial={{ y: -150, opacity: 0, rotate: 0 }}
                animate={recogido
                  ? { y: [0, -34], scale: [1, 1.35, 0], opacity: [1, 1, 0], rotate: p.r }
                  : { y: 0, opacity: 1, rotate: p.r }}
                exit={{ opacity: 0, scale: 0 }}
                transition={recogido
                  ? { duration: 0.45, ease: "easeOut" }
                  : { y: { type: "spring", stiffness: 260, damping: 11, delay: 0.3 + f.indice * 0.12 }, rotate: { duration: 0.6, delay: 0.3 + f.indice * 0.12 }, opacity: { duration: 0.2, delay: 0.3 + f.indice * 0.12 } }}
                whileHover={{ scale: 1.15 }}
              >
                <Fruto dorado={f.dorado} />
                {/* sombrita en el piso */}
                <span className="absolute left-1/2 -bottom-0.5 h-1.5 w-6 -translate-x-1/2 rounded-full bg-black/20 blur-[2px]" />
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
      <VuelosXP vuelos={vuelos} />
    </>
  )
}

function Fruto({ dorado }: { dorado: boolean }) {
  return (
    <span className="relative block h-7 w-7 lg:h-8 lg:w-8">
      {/* tallito + hoja */}
      <span className="absolute left-1/2 -top-1 h-2 w-[2px] -translate-x-1/2 rounded bg-amber-900/70" />
      <span className="absolute left-1/2 -top-1.5 h-2 w-3 rounded-[100%_0] bg-emerald-500 rotate-[-25deg]" />
      <span
        className={cn("absolute inset-0 rounded-full", dorado && "animate-pulse")}
        style={{
          background: dorado
            ? "radial-gradient(circle at 32% 28%, #fff7d1 0%, #fcd34d 35%, #f59e0b 75%, #b45309 100%)"
            : "radial-gradient(circle at 32% 28%, #ffd1d1 0%, #f87171 35%, #dc2626 75%, #991b1b 100%)",
          boxShadow: dorado ? "0 0 14px 4px rgba(252,211,77,.75)" : "0 3px 6px rgba(0,0,0,.25)",
        }}
      />
      {dorado && <span className="absolute -right-1 -top-1 text-[10px]">✨</span>}
    </span>
  )
}

/** Fruto que vuela desde el árbol hasta la barra de XP (+N XP flotando). */
function VuelosXP({ vuelos }: { vuelos: Vuelo[] }) {
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  if (!montado) return null
  const destino = () => {
    const el = document.getElementById(ID_BARRA_XP)
    const r = el?.getBoundingClientRect()
    return r ? { x: r.left + r.width * 0.5, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight - 80 }
  }
  return createPortal(
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {vuelos.map(v => {
        const d = destino()
        return (
          <div key={v.id}>
            <motion.span
              className="absolute text-xs font-black"
              style={{ left: v.x, top: v.y, color: v.dorado ? "#f59e0b" : "#10b981", textShadow: "0 1px 2px rgba(0,0,0,.25)" }}
              initial={{ y: 0, opacity: 1, scale: 0.8 }}
              animate={{ y: -46, opacity: 0, scale: 1.3 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              +{v.xp} XP
            </motion.span>
            <motion.span
              className="absolute h-4 w-4 -ml-2 -mt-2 rounded-full"
              style={{ left: v.x, top: v.y, background: v.dorado ? "#fbbf24" : "#34d399", boxShadow: `0 0 10px 3px ${v.dorado ? "rgba(251,191,36,.8)" : "rgba(52,211,153,.8)"}` }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
              animate={{ x: [0, (d.x - v.x) * 0.3, d.x - v.x], y: [0, -70, d.y - v.y], scale: [1, 1.2, 0.4], opacity: [1, 1, 0.2] }}
              transition={{ duration: 0.9, ease: "easeInOut", delay: 0.15 }}
            />
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

// ─── Combo de toques y sacudida ──────────────────────────────────────────────

export const TOQUES_PARA_SACUDIR = 5

/** Cuenta toques seguidos (se corta si pasan 900 ms sin tocar). */
export function useCombo(onCombo: (n: number) => void) {
  const [combo, setCombo] = useState(0)
  const timer = useRef<number | null>(null)
  const actual = useRef(0)
  const tocar = useCallback(() => {
    actual.current += 1
    setCombo(actual.current)
    onCombo(actual.current)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { actual.current = 0; setCombo(0) }, 900)
  }, [onCombo])
  const reiniciar = useCallback(() => { actual.current = 0; setCombo(0) }, [])
  return { combo, tocar, reiniciar }
}

export function ComboBadge({ combo, sacudidaLista }: { combo: number; sacudidaLista: boolean }) {
  return (
    <AnimatePresence>
      {combo >= 2 && (
        <motion.div
          key="combo"
          className="absolute top-8 right-0 z-40 pointer-events-none"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
        >
          <motion.span
            key={combo}
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
            className={cn("block rounded-full px-2.5 py-1 text-xs font-black shadow-lg",
              combo >= TOQUES_PARA_SACUDIR ? "bg-amber-400 text-amber-950" : "bg-emerald-500 text-white")}
          >
            {tr("x{0} combo", [combo])}
            {sacudidaLista && combo < TOQUES_PARA_SACUDIR && <span className="ml-1 opacity-80">· {TOQUES_PARA_SACUDIR - combo} 🎁</span>}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Premio que cae del árbol al sacudirlo. */
export function PremioSacudida({ premio, onCerrar }: { premio: { icono: string; etiqueta: string } | null; onCerrar: () => void }) {
  useEffect(() => {
    if (!premio) return
    const t = window.setTimeout(onCerrar, 3200)
    return () => window.clearTimeout(t)
  }, [premio, onCerrar])
  return (
    <AnimatePresence>
      {premio && (
        <motion.div key="premio" className="absolute left-1/2 top-1/3 z-50 -translate-x-1/2" exit={{ opacity: 0 }}>
          <motion.button
            type="button"
            onClick={onCerrar}
            className="flex flex-col items-center gap-1"
            initial={{ y: -60, opacity: 0, scale: 0.4 }}
            animate={{ y: [-60, 30, 12, 20], opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, y: -20 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            <motion.span className="text-5xl drop-shadow-lg" animate={{ rotate: [0, -12, 12, -6, 0] }} transition={{ delay: 0.8, duration: 0.6 }}>{premio.icono}</motion.span>
            <span className="whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950 shadow-lg">{tr("¡Premio! {0}", [tr(premio.etiqueta)])}</span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Regar: mantener presionado ──────────────────────────────────────────────

export function BotonRegar({ regado, xp, sonido, onRegado, onYaRegado }: {
  regado: boolean
  xp: number
  sonido: boolean
  onRegado: () => Promise<boolean>
  onYaRegado: () => void
}) {
  const [progreso, setProgreso] = useState(0)
  const raf = useRef<number | null>(null)
  const inicio = useRef(0)
  const DUR = 900

  const soltar = () => {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    setProgreso(p => (p >= 1 ? p : 0))
  }
  const presionar = () => {
    prepararAudio()
    if (regado) { onYaRegado(); return }
    inicio.current = performance.now()
    const paso = async (t: number) => {
      const p = Math.min(1, (t - inicio.current) / DUR)
      setProgreso(p)
      if (p < 1) { raf.current = requestAnimationFrame(paso); return }
      raf.current = null
      vibrar([15, 30, 15])
      if (sonido) tocarRiego()
      const ok = await onRegado()
      if (!ok) setProgreso(0)
    }
    raf.current = requestAnimationFrame(paso)
  }
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

  return (
    <button
      type="button"
      onPointerDown={presionar}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onContextMenu={e => e.preventDefault()}
      className={cn("relative h-12 overflow-hidden rounded-2xl border px-4 font-bold text-sm flex items-center justify-center gap-2 select-none touch-manipulation transition-colors",
        regado
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300")}
    >
      {/* agua que llena el botón mientras se mantiene presionado */}
      <span className="absolute inset-y-0 left-0 bg-sky-400/30" style={{ width: `${progreso * 100}%` }} />
      <span className="relative flex items-center gap-2">
        {regado ? <Sprout className="h-5 w-5" /> : <motion.span animate={progreso > 0 ? { rotate: -35 } : { rotate: 0 }}><Droplets className="h-5 w-5" /></motion.span>}
        {regado ? tr("Abonar: ahorrar") : progreso > 0 ? tr("Regando…") : tr("Mantén para regar · +{0} XP", [xp])}
      </span>
    </button>
  )
}

// ─── Hoy en tu jardín ────────────────────────────────────────────────────────

export function HoyEnTuJardin({ estado }: { estado: EstadoJardin }) {
  const cosechados = estado.frutos.filter(f => f.cosechado).length
  const pendientes = estado.frutos.length - cosechados
  // Los frutos (y su chip) solo existen desde el nivel 4
  const items = [
    ...(estado.frutosDesbloqueados ? [{ ok: pendientes === 0 && estado.frutosPorGanar === 0, icono: "🍎", texto: tr("Frutos {0}/{1}", [cosechados, estado.frutosMaximo]) }] : []),
    { ok: !!estado.sacudida, icono: "🎁", texto: estado.sacudida ? tr("Sacudido") : tr("Toca 5 veces") },
    { ok: estado.regado, icono: "💧", texto: estado.regado ? tr("Regado") : tr("Riega") },
  ]
  const pista = pendientes > 0
    ? tr("Toca los frutos que cayeron al pie del árbol para cosecharlos 🍎")
    : estado.frutosPorGanar > 0
      ? tr("Registra un gasto, ingreso, pago o ahorro y cae otro fruto ({0} más hoy)", [estado.frutosPorGanar])
      : !estado.sacudida
        ? tr("Toca el árbol 5 veces seguidas para sacudirlo: suelta un premio 🎁")
        : !estado.regado
          ? tr("Mantén presionado Regar para darle agua a tu árbol 💧")
          : estado.frutosDesbloqueados
            ? tr("¡Jardín al día! Mañana hay frutos nuevos 🌙")
            : tr("¡Jardín al día! Desde el nivel {0} tu árbol también da frutos 🍎", [estado.nivelFrutos])
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{tr("Hoy en tu jardín")}</span>
        {items.map(i => (
          <span key={i.icono} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border",
            i.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted/40 text-muted-foreground")}>
            {i.icono} {i.texto}{i.ok && " ✓"}
          </span>
        ))}
        {estado.xpHoy > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-amber-600 dark:text-amber-400">
            <Sparkles className="h-3 w-3" />{tr("+{0} XP hoy", [estado.xpHoy])}{estado.boost && " ⚡x2"}
          </span>
        )}
      </div>
      <p key={pista} className="text-[11px] text-muted-foreground" style={{ animation: "kiriBubblePop .4s ease" }}>{pista}</p>
    </div>
  )
}
