"use client"

/**
 * Árbol Kiri en 3D (Three.js) — reemplaza la parte visual del árbol del Jardín.
 *
 * Es solo la capa visual: nivel, progreso, clima, frutos y gastos hormiga llegan
 * por props desde la página, y todo lo que da XP sigue pasando por el minijuego
 * (useJardinJuego) y el servidor. El motor (./motor) se carga aparte para que
 * Three.js no pese en el resto de la app.
 */
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { tocarGolpe, tocarHojas, tocarPop, tocarRiego, tocarTrueno, ponerLluvia } from "@/lib/thunder-sound"
import { tr } from "@/lib/i18n"
import type { ClimaArbol, FrutoArbol3D, MotorArbol3D } from "./motor"

export type { ClimaArbol, FrutoArbol3D }
export interface GastoHormigaCola { id: number; nombre: string; monto: number }

interface Props {
  nivel: number
  progreso: number
  vistaPrevia: number | null
  clima: ClimaArbol
  tormentaHormiga: boolean
  /** Regadera echando agua (botón Regar, ahorro o un amigo que regó) */
  regando: boolean
  /** El riego viene del botón (ya suena por su cuenta) */
  regandoBoton: boolean
  ingreso: boolean
  salud: number
  manzanasArbol: boolean
  sonido: boolean
  frutos: FrutoArbol3D[] | null
  /** Cambia → sacudida fuerte del combo (tumba las manzanas) */
  sacudida: number
  subioNivel: boolean
  gastosHormiga: GastoHormigaCola[]
  formatAmount: (n: number) => string
  onTap: () => void
  onNubes: () => void
  onCosechar: (indice: number, dorado: boolean, x: number, y: number) => void
  /** WebGL no disponible: la página vuelve al árbol en imágenes */
  onFallo: () => void
  /** Capas encima del canvas (mensajes, combo, premio, sonido) */
  children?: ReactNode
}

function soportaWebGL() {
  try {
    const c = document.createElement("canvas")
    return !!(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    return false
  }
}

export function ArbolKiri3D(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const motorRef = useRef<MotorArbol3D | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const [listo, setListo] = useState(false)
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null)
  const avisoTimer = useRef<number | null>(null)

  const mostrarAviso = (texto: string, ms: number) => {
    setAviso({ id: Date.now(), texto })
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current)
    avisoTimer.current = window.setTimeout(() => setAviso(null), ms)
  }
  const mostrarAvisoRef = useRef(mostrarAviso)
  mostrarAvisoRef.current = mostrarAviso

  // ── Crear y destruir el motor ─────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false
    let motor: MotorArbol3D | null = null
    const timers = new Set<number>()
    const despues = (ms: number, fn: () => void) => { const id = window.setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id) }
    if (!soportaWebGL()) { propsRef.current.onFallo(); return }
    import("./motor").then(({ crearMotorArbol }) => {
      if (cancelado || !canvasRef.current) return
      const p = propsRef.current
      const suena = () => propsRef.current.sonido
      try {
        motor = crearMotorArbol(canvasRef.current, {
          estado: {
            nivel: p.nivel, progreso: p.progreso, vistaPrevia: p.vistaPrevia, clima: p.clima, tormentaHormiga: p.tormentaHormiga,
            regando: p.regando, ingreso: p.ingreso, salud: p.salud, manzanasArbol: p.manzanasArbol,
          },
          sonidos: {
            hojas: () => { if (suena()) tocarHojas() },
            golpe: () => { if (suena()) tocarGolpe() },
            pop: () => { if (suena()) tocarPop() },
            riego: () => { if (suena() && !propsRef.current.regandoBoton) tocarRiego() },
            trueno: retraso => despues(retraso * 1000, () => { if (suena()) tocarTrueno(0.7 + Math.random() * 0.3) }),
            lluvia: v => ponerLluvia(suena() ? v : 0),
          },
          formatearMonto: n => propsRef.current.formatAmount(n),
          alTocarArbol: () => propsRef.current.onTap(),
          alTocarNubes: () => propsRef.current.onNubes(),
          alCosechar: (i, dorado, x, y) => propsRef.current.onCosechar(i, dorado, x, y),
          alTocarHormiga: g => mostrarAvisoRef.current(g ? tr("🐜 {0} · -{1}", [g.nombre, propsRef.current.formatAmount(g.monto)]) : tr("🐜 De paseo"), 2200),
          alTerminarHormigas: total => mostrarAvisoRef.current(tr("🐜 Hoy se fueron {0} en gastos hormiga", [propsRef.current.formatAmount(total)]), 3200),
        })
      } catch {
        propsRef.current.onFallo()
        return
      }
      motorRef.current = motor
      setListo(true)
    }).catch(() => { if (!cancelado) propsRef.current.onFallo() })
    return () => {
      cancelado = true
      timers.forEach(id => window.clearTimeout(id))
      motor?.destruir()
      motorRef.current = null
      ponerLluvia(0)
      setListo(false)
    }
  }, [])

  // ── Estado → motor ────────────────────────────────────────────────────────
  const { nivel, progreso, vistaPrevia, clima, tormentaHormiga, regando, ingreso, salud, manzanasArbol, frutos, sacudida, subioNivel, gastosHormiga } = props
  useEffect(() => {
    motorRef.current?.actualizar({ nivel, progreso, vistaPrevia, clima, tormentaHormiga, regando, ingreso, salud, manzanasArbol })
  }, [listo, nivel, progreso, vistaPrevia, clima, tormentaHormiga, regando, ingreso, salud, manzanasArbol])

  useEffect(() => { motorRef.current?.ponerFrutos(frutos) }, [listo, frutos])

  // Tormenta del gasto hormiga: dos rayos seguidos (la tormenta fija por vencidas la maneja el motor)
  useEffect(() => {
    if (!listo || !tormentaHormiga) return
    motorRef.current?.rayo()
    const t = window.setTimeout(() => motorRef.current?.rayo(), 1700)
    return () => window.clearTimeout(t)
  }, [listo, tormentaHormiga])

  const sacudidaVista = useRef(sacudida)
  useEffect(() => {
    if (!listo || sacudida === sacudidaVista.current) return
    sacudidaVista.current = sacudida
    motorRef.current?.sacudir(true)
  }, [listo, sacudida])

  useEffect(() => {
    if (!listo || !subioNivel) return
    motorRef.current?.subirNivel()
    const t = window.setTimeout(() => motorRef.current?.subirNivel(), 2600)
    return () => window.clearTimeout(t)
  }, [listo, subioNivel])

  // Cada gasto hormiga nuevo sale como una hormiga (en fila si son varios)
  const gastosVistos = useRef(new Set<number>())
  useEffect(() => {
    if (!listo) return
    const nuevos = gastosHormiga.filter(g => !gastosVistos.current.has(g.id))
    if (!nuevos.length) return
    nuevos.forEach(g => gastosVistos.current.add(g.id))
    motorRef.current?.gastoHormiga(nuevos.map(g => ({ nombre: g.nombre, monto: g.monto })))
  }, [listo, gastosHormiga])

  useEffect(() => () => { if (avisoTimer.current) window.clearTimeout(avisoTimer.current) }, [])

  return (
    <div className="relative w-full overflow-hidden rounded-[18px] bg-[#cfe6e4] dark:bg-[#0f1a14] aspect-[4/5] sm:aspect-[16/11] sm:max-h-[70vh] min-h-[300px]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full cursor-pointer"
        style={{ touchAction: "pan-y" }}
        role="img"
        aria-label={tr("Tu árbol en 3D. Toca el árbol para sacudirlo; toca el hormiguero para que salga una hormiga; arrastra a los lados para girar.")}
      />
      {!listo && <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-sky-200/60 to-teal-300/40 dark:from-slate-800/60 dark:to-emerald-900/30" />}
      {aviso && (
        <div
          key={aviso.id}
          role="status"
          className="absolute left-1/2 top-3 z-40 max-w-[90%] -translate-x-1/2 truncate rounded-xl border border-white/10 bg-slate-900/85 px-3.5 py-1.5 text-center text-xs font-extrabold text-white pointer-events-none"
          style={{ animation: "kiriBubblePop .3s ease" }}
        >
          {aviso.texto}
        </div>
      )}
      {props.children}
    </div>
  )
}
