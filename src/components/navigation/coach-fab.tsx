"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  X, Send, Mic, Loader2, Sparkles, CheckCircle2, AlertTriangle, ScanLine, Camera, Upload,
  Calculator, ArrowRight, Keyboard, RotateCcw, ListChecks, Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { DebtSimulator } from "@/components/recommendations/debt-simulator"
import { getPeriodData } from "@/lib/period-filter"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { resizeImageToDataUrl } from "@/lib/avatar-upload"
import { AccionesReview } from "@/components/coach/AccionesReview"
import {
  iaApi, useDestinos, useEjecutarAcciones, faltantes, pantallaActual,
  type Accion, type RespuestaRecibo, type UsoIA, type UsoIAMes,
} from "@/lib/kiri-acciones"
import { usePlan } from "@/lib/plan-context"

/** "Te quedan 7 mensajes este mes" (nada si es ilimitado o aún no se sabe). */
function CuotaIA({ uso, que }: { uso?: UsoIA | null; que: string }) {
  if (!uso || uso.ilimitado || uso.restantes == null) return null
  const poco = uso.restantes <= Math.max(1, Math.round(uso.limite * 0.2))
  return (
    <span className={cn("text-[10px] font-bold tabular-nums", uso.restantes === 0 ? "text-destructive" : poco ? "text-amber-600" : "text-muted-foreground")}>
      {uso.restantes === 0 ? `Sin ${que} este mes` : `Te quedan ${uso.restantes} ${que} este mes`}
    </span>
  )
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Coach — chat, dictado por voz y escáner de recibos
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Los tres usan la IA del backend (/api/ai/*, con login), que recibe los datos
 * reales del usuario y el manual completo de la app, y devuelve "acciones"
 * (registrar un gasto, un ingreso, pagar una obligación, ahorrar, crear una
 * categoría/deuda/gasto fijo/bolsillo, "Me deben"…). Las acciones se muestran
 * en tarjetas editables y solo se guardan cuando el usuario confirma.
 */

type EstadoAcciones = "pendiente" | "guardando" | "guardado" | "descartado"
interface Msg {
  id: string
  role: "user" | "assistant"
  texto: string
  error?: boolean
  acciones?: Accion[]
  estado?: EstadoAcciones
  errores?: Record<string, string>
  resultado?: string
  sugerencias?: string[]
  ir?: { ruta: string; etiqueta: string } | null
}

const nuevoId = () => Math.random().toString(36).slice(2, 10)

// ─── Texto con **negritas** y listas ──────────────────────────────────────────
function TextoCoach({ texto }: { texto: string }) {
  const negritas = (linea: string) => linea.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)
  const lineas = texto.split("\n")
  return (
    <div className="space-y-1">
      {lineas.map((l, i) => {
        const t = l.trim()
        if (!t) return <div key={i} className="h-1" />
        const bullet = t.match(/^[-•*]\s+(.*)/)
        const num = t.match(/^(\d+)[.)]\s+(.*)/)
        if (bullet) return <div key={i} className="flex gap-1.5"><span className="text-kiri-emerald">•</span><span>{negritas(bullet[1])}</span></div>
        if (num) return <div key={i} className="flex gap-1.5"><span className="font-bold text-kiri-emerald">{num[1]}.</span><span>{negritas(num[2])}</span></div>
        return <p key={i}>{negritas(t)}</p>
      })}
    </div>
  )
}

function KiriLogo({ className, ojos = "#2D6A4F" }: { className?: string; ojos?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <rect x="13" y="26" width="14" height="10" rx="3" fill="#D8F3DC" />
      <path d="M20 26 C20 20 20 18 20 14" stroke="#B7E4C7" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="16" cy="14" rx="4" ry="6" fill="#52B788" transform="rotate(-20 16 14)" />
      <ellipse cx="24" cy="12" rx="4" ry="5.5" fill="#40916C" transform="rotate(15 24 12)" />
      <circle cx="17" cy="30" r="1.2" fill={ojos} />
      <circle cx="23" cy="30" r="1.2" fill={ojos} />
      <path d="M18 33 Q20 35 22 33" stroke={ojos} strokeWidth="1" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function VoiceWaveform() {
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: 20 }, (_, i) => (
        <span key={i}
          className="w-[3px] h-8 rounded-full bg-kiri-emerald origin-bottom animate-[kiriWaveBar_1s_ease-in-out_infinite]"
          style={{ animationDelay: `${(i % 7) * 70}ms`, animationDuration: `${700 + (i % 5) * 100}ms` }} />
      ))}
    </div>
  )
}

// ─── Reconocimiento de voz ────────────────────────────────────────────────────
// Español de Colombia, continuo (antes se cortaba a los 8 s y en la primera
// pausa): junta todo lo que el usuario dice y se detiene tras ~2,5 s de
// silencio, al tocar el micrófono, o a los 60 s.
type SR = SpeechRecognition
/** Solo revisa que el navegador tenga dictado (sin crear nada ni pedir el micrófono). */
function soportaVoz(): boolean {
  if (typeof window === "undefined") return false
  const w = window as unknown as Record<string, unknown>
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}
function crearReconocimiento(): SR | null {
  if (typeof window === "undefined") return null
  const C = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  return C ? new (C as new () => SR)() : null
}

export function CoachFab() {
  const router = useRouter()
  const pathname = usePathname()
  const { income, ingresoPeriodo, incomeFrequency, diasCobro, formatAmount, user } = useAppContext()
  const { debts, fixedExpenses, extraIncomes } = useFinanceData()
  const { ejecutar } = useEjecutarAcciones()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [iaActiva, setIaActiva] = useState<boolean | null>(null)
  const [usoIA, setUsoIA] = useState<UsoIAMes | null>(null)
  const { hasFeature } = usePlan()
  const actualizarUso = (tipo: "coach" | "dictado" | "escaneo", u?: UsoIA) => {
    if (u) setUsoIA(prev => prev ? { ...prev, [tipo]: { ...prev[tipo], ...u } } : prev)
  }
  const [showSatellites, setShowSatellites] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [simOpen, setSimOpen] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Voz
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voicePhase, setVoicePhase] = useState<"idle" | "listening" | "processing" | "review" | "done">("idle")
  const [transcript, setTranscript] = useState("")
  const [escribiendo, setEscribiendo] = useState(false)
  const [voiceResumen, setVoiceResumen] = useState("")
  const [voiceConfianza, setVoiceConfianza] = useState<"alta" | "media" | "baja" | null>(null)
  const [voiceAcciones, setVoiceAcciones] = useState<Accion[]>([])
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceErrores, setVoiceErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [chatEscuchando, setChatEscuchando] = useState(false)
  const recRef = useRef<SR | null>(null)

  // Escáner
  const [scanOpen, setScanOpen] = useState(false)
  const [scanState, setScanState] = useState<"idle" | "scanning" | "result" | "error" | "done">("idle")
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<RespuestaRecibo | null>(null)
  const [scanAcciones, setScanAcciones] = useState<Accion[]>([])
  const [porItems, setPorItems] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanErrores, setScanErrores] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const destinos = useDestinos(isOpen || voiceOpen || scanOpen)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading])

  // ¿La IA está activa? (se pregunta una vez, al abrir cualquier cosa)
  useEffect(() => {
    if (iaActiva !== null || !(isOpen || voiceOpen || scanOpen)) return
    iaApi.estado().then(({ data }) => setIaActiva(data?.activa ?? false))
  }, [isOpen, voiceOpen, scanOpen, iaActiva])

  // Cuotas del mes (se vuelven a pedir cada vez que se abre algo)
  useEffect(() => {
    if (!(isOpen || voiceOpen || scanOpen)) return
    iaApi.uso().then(({ data }) => { if (data) setUsoIA(data) })
  }, [isOpen, voiceOpen, scanOpen])

  // "Ver planes" desde el aviso de límite: cerrar el chat para que se vea Mi plan
  useEffect(() => {
    const h = () => { setIsOpen(false); setVoiceOpen(false); setScanOpen(false) }
    window.addEventListener("kiri:ir-mi-plan", h)
    return () => window.removeEventListener("kiri:ir-mi-plan", h)
  }, [])

  // ── Simulador (satélite) ──────────────────────────────────────────────────
  const periodData = getPeriodData(income, extraIncomes.reduce((a, e) => a + e.monto, 0), debts, fixedExpenses, incomeFrequency, diasCobro, ingresoPeriodo)
  const debtCapacityAmount = periodData.effectiveIncome > 0
    ? calculateBudgetAllocation(periodData.effectiveIncome, periodData.totalObligations).debtCapacityAmount
    : 0

  // ══════════════════════════════════════════════════════════════════════════
  // CHAT
  // ══════════════════════════════════════════════════════════════════════════
  const enviar = useCallback(async (texto: string) => {
    const t = texto.trim()
    if (!t || loading) return
    const historial = messages.filter(m => !m.error).slice(-10).map(m => ({
      rol: (m.role === "assistant" ? "coach" : "usuario") as "coach" | "usuario",
      texto: m.texto + (m.acciones?.length ? `\n[Propuse ${m.acciones.length} registro(s); el usuario ${m.estado === "guardado" ? "los guardó" : m.estado === "descartado" ? "los descartó" : "aún no confirma"}]` : ""),
    }))
    setMessages(p => [...p, { id: nuevoId(), role: "user", texto: t }])
    setInput("")
    setLoading(true)
    const { data, error } = await iaApi.coach(t, historial, pantallaActual(pathname))
    setLoading(false)
    if (!data) {
      setMessages(p => [...p, { id: nuevoId(), role: "assistant", texto: error ?? "No pude responder ahora. Intenta de nuevo.", error: true }])
      return
    }
    actualizarUso("coach", data.uso)
    setMessages(p => [...p, {
      id: nuevoId(), role: "assistant", texto: data.respuesta,
      acciones: data.acciones.length ? data.acciones : undefined,
      estado: data.acciones.length ? "pendiente" : undefined,
      sugerencias: data.sugerencias, ir: data.ir,
    }])
  }, [loading, messages, pathname])

  // Otros módulos pueden abrir el chat con una pregunta (ej. Proyecciones → "Pregúntale")
  useEffect(() => {
    const onAsk = (e: Event) => {
      const mensaje = (e as CustomEvent<{ mensaje?: string }>).detail?.mensaje
      setIsOpen(true)
      if (mensaje) setTimeout(() => enviar(mensaje), 50)
    }
    window.addEventListener("kiri:coach-ask", onAsk)
    return () => window.removeEventListener("kiri:coach-ask", onAsk)
  }, [enviar])

  const editarAccionMsg = (msgId: string, accId: string, patch: Partial<Accion>) =>
    setMessages(p => p.map(m => m.id === msgId ? { ...m, acciones: m.acciones?.map(a => a.id === accId ? { ...a, ...patch } : a), errores: { ...m.errores, [accId]: "" } } : m))
  const quitarAccionMsg = (msgId: string, accId: string) =>
    setMessages(p => p.map(m => m.id === msgId ? { ...m, acciones: m.acciones?.filter(a => a.id !== accId) } : m))

  const confirmarMsg = async (msg: Msg) => {
    const acciones = msg.acciones ?? []
    const conFalta = acciones.filter(a => faltantes(a).length > 0)
    if (conFalta.length) {
      setMessages(p => p.map(m => m.id === msg.id ? { ...m, errores: Object.fromEntries(conFalta.map(a => [a.id, faltantes(a)[0]])) } : m))
      return
    }
    setMessages(p => p.map(m => m.id === msg.id ? { ...m, estado: "guardando" } : m))
    const { ok, errores } = await ejecutar(acciones)
    setMessages(p => p.map(m => m.id !== msg.id ? m : errores.length
      ? { ...m, estado: "pendiente", acciones: acciones.filter(a => errores.some(e => e.id === a.id)), errores: Object.fromEntries(errores.map(e => [e.id, e.mensaje])), resultado: ok ? `✅ ${ok} guardado${ok === 1 ? "" : "s"}. Revisa lo que falló:` : undefined }
      : { ...m, estado: "guardado", resultado: `✅ Listo: ${ok} movimiento${ok === 1 ? "" : "s"} guardado${ok === 1 ? "" : "s"}.` }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VOZ
  // ══════════════════════════════════════════════════════════════════════════
  // Terminar la escucha actual (el usuario tocó el micrófono otra vez)
  const detenerRef = useRef<(() => void) | null>(null)
  const detenerVoz = () => { detenerRef.current?.() }
  /** Corta la escucha sin entregar el texto (al cerrar el dictado o empezar otra). */
  const cancelarVoz = () => {
    const r = recRef.current
    recRef.current = null
    detenerRef.current = null
    try { r?.abort() } catch { /* ya terminó */ }
  }

  /**
   * Escucha hasta que el usuario toque el micrófono otra vez o deje de hablar.
   * Antes el `onend` de una escucha anterior (abortada al tocar de nuevo)
   * llegaba tarde y apagaba la nueva: al segundo toque paraba sola. Ahora cada
   * escucha solo responde a su propio reconocedor, y si el navegador corta
   * solo (Chrome en el celular corta tras cada frase) se reanuda hasta que haya
   * silencio de verdad.
   */
  const escuchar = (onFin: (texto: string) => void, onParcial: (texto: string) => void) => {
    cancelarVoz()
    const r = crearReconocimiento()
    if (!r) { onFin(""); return false }
    r.lang = "es-CO"
    r.continuous = true
    r.interimResults = true
    let final = ""
    let parcial = ""
    let terminado = false
    let silencio: ReturnType<typeof setTimeout> | null = null
    const terminar = () => {
      if (terminado) return
      terminado = true
      clearTimeout(maximo)
      if (silencio) clearTimeout(silencio)
      try { r.stop() } catch { /* ya terminó */ }
    }
    const maximo = setTimeout(terminar, 90000)
    // Al empezar hay más tiempo para arrancar a hablar; después de hablar, 3 s de silencio terminan
    const esperarSilencio = (ms: number) => {
      if (silencio) clearTimeout(silencio)
      silencio = setTimeout(terminar, ms)
    }
    r.onresult = (e: SpeechRecognitionEvent) => {
      if (recRef.current !== r) return
      parcial = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += (final ? " " : "") + t.trim()
        else parcial += t
      }
      onParcial(`${final} ${parcial}`.trim())
      esperarSilencio(3000)
    }
    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (recRef.current !== r) return
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        terminado = true
        setVoiceError("Kiri no tiene permiso para usar el micrófono. Actívalo en tu navegador, o escríbelo aquí abajo.")
        setEscribiendo(true)
      }
    }
    r.onend = () => {
      if (recRef.current !== r) return // escucha vieja (cancelada): no toca la nueva
      if (!terminado) {
        // El navegador cortó solo: se sigue escuchando hasta que haya silencio
        try { r.start(); return } catch { /* no se pudo reanudar: termina */ }
      }
      clearTimeout(maximo)
      if (silencio) clearTimeout(silencio)
      recRef.current = null
      detenerRef.current = null
      onFin(`${final} ${final ? "" : parcial}`.trim())
    }
    recRef.current = r
    detenerRef.current = terminar
    try { r.start() } catch { recRef.current = null; detenerRef.current = null; onFin(""); return false }
    esperarSilencio(8000)
    return true
  }

  const interpretar = async (texto: string) => {
    if (!texto.trim()) { setVoicePhase("idle"); return }
    setTranscript(texto)
    setVoicePhase("processing")
    setVoiceError(null)
    const { data, error } = await iaApi.dictado(texto)
    if (!data) { setVoiceError(error ?? "No pude interpretar lo que dijiste."); setVoicePhase("idle"); setEscribiendo(true); return }
    actualizarUso("dictado", data.uso)
    setVoiceResumen(data.resumen)
    setVoiceConfianza(data.confianza)
    setVoiceAcciones(data.acciones)
    setVoiceErrores({})
    setVoicePhase("review")
  }

  const abrirVoz = () => {
    setShowSatellites(false)
    // El chat (z-60) tapaba el diálogo del dictado: se cierra para que se vea
    setIsOpen(false)
    setChatEscuchando(false)
    cancelarVoz()
    setVoiceOpen(true)
    setVoiceError(null); setTranscript(""); setVoiceAcciones([]); setVoiceResumen(""); setVoiceConfianza(null); setVoiceErrores({})
    const puede = soportaVoz()
    setEscribiendo(!puede)
    if (!puede) { setVoicePhase("idle"); return }
    setVoicePhase("listening")
    setTimeout(() => {
      const ok = escuchar(t => { if (t) interpretar(t); else setVoicePhase(p => p === "listening" ? "idle" : p) }, setTranscript)
      if (!ok) { setVoicePhase("idle"); setEscribiendo(true) }
    }, 250)
  }

  const cerrarVoz = () => {
    cancelarVoz()
    setVoiceOpen(false)
    setVoicePhase("idle")
  }

  const confirmarVoz = async () => {
    const conFalta = voiceAcciones.filter(a => faltantes(a).length > 0)
    if (conFalta.length) { setVoiceErrores(Object.fromEntries(conFalta.map(a => [a.id, faltantes(a)[0]]))); return }
    setGuardando(true)
    const { ok, errores } = await ejecutar(voiceAcciones)
    setGuardando(false)
    if (errores.length) {
      setVoiceAcciones(prev => prev.filter(a => errores.some(e => e.id === a.id)))
      setVoiceErrores(Object.fromEntries(errores.map(e => [e.id, e.mensaje])))
      setVoiceError(ok ? `Se guardaron ${ok}; revisa lo que falló.` : null)
      return
    }
    setSavedCount(ok)
    setVoicePhase("done")
  }

  // Micrófono dentro del chat: dicta la pregunta
  const vozEnChat = () => {
    if (chatEscuchando) { detenerVoz(); return }
    const ok = escuchar(t => { setChatEscuchando(false); if (t) setInput(t) }, t => setInput(t))
    setChatEscuchando(ok)
    if (!ok) setMessages(p => [...p, { id: nuevoId(), role: "assistant", texto: "Tu navegador no permite dictar por voz. Escríbeme tu pregunta.", error: true }])
  }

  // Botones del "+" de la barra inferior (celular)
  useEffect(() => {
    const onSim = () => { setShowSatellites(false); setSimOpen(true) }
    const onVoice = () => abrirVoz()
    const onScan = () => abrirScanner()
    window.addEventListener("kiri:open-simulator", onSim)
    window.addEventListener("kiri:open-voice", onVoice)
    window.addEventListener("kiri:open-scanner", onScan)
    return () => {
      window.removeEventListener("kiri:open-simulator", onSim)
      window.removeEventListener("kiri:open-voice", onVoice)
      window.removeEventListener("kiri:open-scanner", onScan)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ══════════════════════════════════════════════════════════════════════════
  // ESCÁNER
  // ══════════════════════════════════════════════════════════════════════════
  const abrirScanner = () => {
    setShowSatellites(false)
    setScanOpen(true)
    resetScan()
  }
  const resetScan = () => {
    setScanState("idle"); setScanPreview(null); setScanResult(null); setScanAcciones([]); setScanError(null); setScanErrores({}); setPorItems(false)
  }

  const procesarImagen = async (file: File) => {
    setScanState("scanning")
    setScanError(null)
    try {
      // Reescalada a 1600 px: se lee igual de bien y pesa 10-20 veces menos
      const dataUrl = await resizeImageToDataUrl(file, 1600, 0.85)
      setScanPreview(dataUrl)
      const { data, error } = await iaApi.recibo(dataUrl.split(",")[1], "image/jpeg")
      if (!data) { setScanError(error ?? "No se pudo leer el recibo."); setScanState("error"); return }
      actualizarUso("escaneo", data.uso)
      if (!data.esRecibo) { setScanError("Esa foto no parece un recibo o factura. Intenta con otra más cerca y con buena luz."); setScanState("error"); return }
      setScanResult(data)
      setScanAcciones(data.acciones)
      setScanErrores({})
      setScanState("result")
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "No se pudo leer la imagen.")
      setScanState("error")
    }
  }

  const onArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) procesarImagen(file)
  }

  // "Separar por ítems": un gasto por cada ítem (con la categoría que la IA eligió para el total)
  const cambiarModoItems = (v: boolean) => {
    if (!scanResult) return
    // Separar el recibo en un gasto por producto es de KIRI PRO
    if (v && !hasFeature("receiptItems")) {
      window.dispatchEvent(new CustomEvent("kiri:limite", { detail: {
        codigo: "FUNCION", mensaje: "Separar un recibo en un gasto por cada producto es parte de KIRI PRO.", mejora: { plan: "KIRI PRO" },
      } }))
      return
    }
    setPorItems(v)
    setScanErrores({})
    if (!v) { setScanAcciones(scanResult.acciones); return }
    const base = scanResult.acciones[0]
    setScanAcciones(scanResult.items.map(it => ({
      id: nuevoId(), tipo: base && base.tipo !== "sin_destino" ? "gasto" : "sin_destino", nombre: it.descripcion, monto: it.monto,
      categoriaId: base?.categoriaId ?? null, esHormiga: base?.esHormiga ?? null, faltan: [],
    })))
  }

  const confirmarScan = async () => {
    const conFalta = scanAcciones.filter(a => faltantes(a).length > 0)
    if (conFalta.length) { setScanErrores(Object.fromEntries(conFalta.map(a => [a.id, faltantes(a)[0]]))); return }
    setGuardando(true)
    const { ok, errores } = await ejecutar(scanAcciones)
    setGuardando(false)
    if (errores.length) {
      setScanAcciones(prev => prev.filter(a => errores.some(e => e.id === a.id)))
      setScanErrores(Object.fromEntries(errores.map(e => [e.id, e.mensaje])))
      return
    }
    setSavedCount(ok)
    setScanState("done")
  }

  // ── FAB ───────────────────────────────────────────────────────────────────
  const handleFabMouseEnter = () => {
    if (isMobile) return
    hoverTimer.current = setTimeout(() => setShowSatellites(true), 300)
  }
  const handleFabMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setShowSatellites(false)
  }

  const avisoIA = iaActiva === false && (
    <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
      <span>La IA de Kiri todavía no está activada. Mientras tanto puedes registrar todo desde los formularios de la app.</span>
    </div>
  )

  const ultimaAsistente = [...messages].reverse().find(m => m.role === "assistant" && !m.error)

  return (
    <>
      {/* ══════════ FAB principal + satélites ══════════ */}
      {!isOpen && (
        <div className="fixed z-50 flex flex-col items-center gap-3 bottom-24 right-5 lg:bottom-8 lg:right-8"
          onMouseEnter={handleFabMouseEnter} onMouseLeave={handleFabMouseLeave}>
          <div className={cn("flex-col items-center gap-3 transition-all duration-300 ease-out hidden lg:flex",
            showSatellites ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none")}>
            {[
              { onClick: abrirScanner, icon: <ScanLine className="h-5 w-5" />, label: "Escanear recibo", color: "bg-cyclon-periwinkle shadow-cyclon-periwinkle/30", anim: "animate-[satellite-enter_0.3s_ease-out_0.1s_both]" },
              { onClick: () => { setShowSatellites(false); setSimOpen(true) }, icon: <Calculator className="h-5 w-5" />, label: "Simulador", color: "bg-cyclon-lavender shadow-cyclon-lavender/30", anim: "animate-[satellite-enter_0.3s_ease-out_0.05s_both]" },
              { onClick: abrirVoz, icon: <Mic className="h-5 w-5" />, label: "Dictar datos", color: "bg-kiri-emerald shadow-kiri-emerald/30", anim: "animate-[satellite-enter_0.3s_ease-out_0s_both]" },
            ].map(s => (
              <div key={s.label} className="relative group/sat">
                <button onClick={s.onClick} aria-label={s.label}
                  className={cn("h-12 w-12 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-xl active:scale-95", s.color,
                    showSatellites && s.anim)}>
                  {s.icon}
                </button>
                <span className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover/sat:opacity-100 transition-opacity duration-150 pointer-events-none">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <div className="relative">
            <button onClick={() => setIsOpen(true)} onTouchEnd={(e) => { e.preventDefault(); setIsOpen(true) }}
              className={cn("relative h-11 w-11 lg:h-16 lg:w-16 rounded-full bg-kiri-emerald shadow-lg shadow-kiri-emerald/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95",
                showSatellites && "scale-95 shadow-xl")}
              aria-label="Abrir Kiri Coach">
              <KiriLogo className="h-7 w-7 lg:h-10 lg:w-10" />
            </button>
            <div className="absolute inset-0 rounded-full bg-kiri-emerald/40 animate-ping pointer-events-none" />
          </div>
        </div>
      )}

      {simOpen && <DebtSimulator debtCapacity={debtCapacityAmount} incomeFrequency={incomeFrequency} forceOpen onClose={() => setSimOpen(false)} />}

      {/* ══════════ MODAL: Dictado por voz ══════════ */}
      <Dialog open={voiceOpen} onOpenChange={v => { if (!v) cerrarVoz() }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto [&>*]:min-w-0">
          {voicePhase === "done" ? (
            <div className="py-4 text-center">
              <div className="h-16 w-16 rounded-full bg-kiri-emerald/15 flex items-center justify-center mx-auto"><CheckCircle2 className="h-8 w-8 text-kiri-emerald" /></div>
              <p className="text-base font-bold mt-4">¡Listo! 🌿</p>
              <p className="text-sm text-muted-foreground mt-1">Guardamos {savedCount} movimiento{savedCount !== 1 ? "s" : ""} en tu app.</p>
              <div className="flex gap-2 mt-5">
                <Button variant="outline" size="sm" onClick={abrirVoz} className="flex-1 rounded-xl h-9 text-xs font-bold gap-1.5"><Mic className="h-3.5 w-3.5" /> Dictar otro</Button>
                <Button size="sm" onClick={cerrarVoz} className="flex-1 rounded-xl h-9 bg-kiri-emerald hover:bg-kiri-sage text-white font-bold text-xs">Listo</Button>
              </div>
            </div>
          ) : voicePhase === "review" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-kiri-emerald" /> Kiri entendió esto</DialogTitle>
                <DialogDescription>Revisa, ajusta lo que haga falta y confirma. Nada se guarda sin tu confirmación.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="bg-kiri-mint/10 rounded-2xl p-3 space-y-1.5">
                  <p className="text-[11px] italic text-muted-foreground">&ldquo;{transcript}&rdquo;</p>
                  {voiceResumen && <p className="text-xs text-foreground/85 leading-relaxed">{voiceResumen}</p>}
                  {voiceConfianza && voiceConfianza !== "alta" && (
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400">Confianza {voiceConfianza}: revisa bien</span>
                  )}
                </div>
                <AccionesReview acciones={voiceAcciones} destinos={destinos} errores={voiceErrores}
                  onChange={(id, patch) => { setVoiceAcciones(p => p.map(a => a.id === id ? { ...a, ...patch } : a)); setVoiceErrores(e => ({ ...e, [id]: "" })) }}
                  onRemove={id => setVoiceAcciones(p => p.filter(a => a.id !== id))} />
                {voiceError && <p className="text-[11px] text-destructive font-bold bg-destructive/10 rounded-lg p-2 text-center">{voiceError}</p>}
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
                <Button variant="outline" size="sm" onClick={() => { setEscribiendo(true); setVoicePhase("idle") }} disabled={guardando} className="w-full rounded-xl h-9 text-xs font-bold gap-1.5 border-dashed">
                  <RotateCcw className="h-3.5 w-3.5" /> Corregir lo que dije
                </Button>
                <div className="flex gap-2 w-full">
                  <Button variant="ghost" size="sm" onClick={cerrarVoz} disabled={guardando} className="flex-1 rounded-xl h-10 text-xs font-bold">Cancelar</Button>
                  <Button size="sm" onClick={confirmarVoz} disabled={guardando || voiceAcciones.length === 0} className="flex-1 rounded-xl h-10 bg-kiri-emerald hover:bg-kiri-sage text-white font-bold text-xs gap-1.5">
                    {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {guardando ? "Guardando..." : `Confirmar (${voiceAcciones.length})`}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Mic className="h-4 w-4 text-kiri-emerald" /> Dictado inteligente</DialogTitle>
                <DialogDescription>Cuéntale a Kiri qué hiciste con tu plata: gastos, ingresos, pagos, ahorros o préstamos. Él lo ubica en su lugar.</DialogDescription>
                <CuotaIA uso={usoIA?.dictado} que="dictados" />
              </DialogHeader>
              <div className="py-2 space-y-4">
                {avisoIA}
                {voicePhase === "listening" && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <span className="absolute inset-0 rounded-full bg-kiri-emerald/25 animate-ping" />
                      <button onClick={detenerVoz} className="relative h-16 w-16 rounded-full bg-kiri-emerald flex items-center justify-center" aria-label="Terminar">
                        <Mic className="h-7 w-7 text-white" />
                      </button>
                    </div>
                    <VoiceWaveform />
                    <p className="text-sm font-bold text-kiri-emerald">Escuchando…</p>
                    <p className="text-xs text-muted-foreground min-h-[1.5rem] px-2 text-center">{transcript || "Ej: \"gasté 18 mil en almuerzo y pagué el arriendo\". Toca el micrófono al terminar."}</p>
                  </div>
                )}
                {voicePhase === "processing" && (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-kiri-emerald animate-spin" />
                    <p className="text-sm font-bold">Ubicando cada movimiento…</p>
                    <div className="relative w-full overflow-hidden rounded-2xl bg-muted/40 px-4 py-3">
                      <p className="text-xs text-foreground/80 italic leading-relaxed relative z-10">&ldquo;{transcript}&rdquo;</p>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-kiri-emerald/20 to-transparent bg-[length:200%_100%] animate-[kiriShimmer_1.4s_ease-in-out_infinite]" />
                    </div>
                  </div>
                )}
                {voicePhase === "idle" && (
                  <div className="space-y-3">
                    {voiceError && <p className="text-[11px] text-destructive font-bold bg-destructive/10 rounded-lg p-2 text-center">{voiceError}</p>}
                    {escribiendo ? (
                      <>
                        <Textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={3} autoFocus
                          placeholder='Ej: "Me pagaron la quincena, gasté 25 mil en mercado y le presté 50 mil a Juan"' className="text-sm rounded-xl" />
                        <Button onClick={() => interpretar(transcript)} disabled={!transcript.trim()} className="w-full rounded-xl bg-kiri-emerald hover:bg-kiri-sage text-white font-bold gap-1.5">
                          <Sparkles className="h-4 w-4" /> Interpretar
                        </Button>
                        {soportaVoz() && (
                          <button onClick={abrirVoz} className="w-full text-xs text-kiri-emerald font-bold flex items-center justify-center gap-1"><Mic className="h-3.5 w-3.5" /> Mejor hablar</button>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <button onClick={abrirVoz} className="h-20 w-20 rounded-full bg-kiri-emerald/10 border-2 border-kiri-emerald/30 flex items-center justify-center hover:bg-kiri-emerald/20">
                          <Mic className="h-9 w-9 text-kiri-emerald" />
                        </button>
                        <p className="text-sm text-muted-foreground">Toca para hablar</p>
                        <button onClick={() => setEscribiendo(true)} className="text-xs text-muted-foreground font-bold flex items-center gap-1 hover:text-foreground"><Keyboard className="h-3.5 w-3.5" /> Prefiero escribir</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════ MODAL: Escáner de recibos ══════════ */}
      <Dialog open={scanOpen} onOpenChange={v => { if (!v) { setScanOpen(false); resetScan() } }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-cyclon-periwinkle" /> Escanear recibo</DialogTitle>
            <DialogDescription>Toma o sube la foto de un recibo o factura. Kiri lee el total, el comercio y los productos.</DialogDescription>
            <CuotaIA uso={usoIA?.escaneo} que="escaneos" />
          </DialogHeader>
          <div className="space-y-3">
            {avisoIA}
            {scanState === "idle" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-cyclon-periwinkle/30 hover:border-cyclon-periwinkle/60 hover:bg-cyclon-periwinkle/5">
                    <Camera className="h-7 w-7 text-cyclon-periwinkle" /><span className="text-xs font-bold text-cyclon-periwinkle">Tomar foto</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-muted hover:border-muted-foreground/30">
                    <Upload className="h-7 w-7 text-muted-foreground" /><span className="text-xs font-bold text-muted-foreground">Subir imagen</span>
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">Consejo: recibo completo, plano y con buena luz.</p>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onArchivo} />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onArchivo} />
              </>
            )}
            {scanState === "scanning" && (
              <div className="flex flex-col items-center gap-4 py-4">
                {scanPreview && <img src={scanPreview} alt="" className="w-full max-h-40 object-cover rounded-2xl opacity-50" />}
                <Loader2 className="h-10 w-10 text-cyclon-periwinkle animate-spin" />
                <p className="text-sm font-bold">Leyendo el recibo…</p>
              </div>
            )}
            {scanState === "error" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <p className="text-sm font-bold text-destructive text-center">{scanError}</p>
                <Button size="sm" variant="outline" onClick={resetScan} className="rounded-xl">Intentar con otra foto</Button>
              </div>
            )}
            {scanState === "done" && (
              <div className="py-4 text-center">
                <div className="h-16 w-16 rounded-full bg-kiri-emerald/15 flex items-center justify-center mx-auto"><CheckCircle2 className="h-8 w-8 text-kiri-emerald" /></div>
                <p className="text-base font-bold mt-4">¡Recibo registrado! 🧾</p>
                <p className="text-sm text-muted-foreground mt-1">{savedCount} movimiento{savedCount !== 1 ? "s" : ""} guardado{savedCount !== 1 ? "s" : ""}.</p>
                <div className="flex gap-2 mt-5">
                  <Button variant="outline" size="sm" onClick={resetScan} className="flex-1 rounded-xl h-9 text-xs font-bold">Escanear otro</Button>
                  <Button size="sm" onClick={() => { setScanOpen(false); resetScan() }} className="flex-1 rounded-xl h-9 bg-kiri-emerald hover:bg-kiri-sage text-white font-bold text-xs">Listo</Button>
                </div>
              </div>
            )}
            {scanState === "result" && scanResult && (
              <>
                <div className="flex gap-3 rounded-2xl bg-muted/30 p-3">
                  {scanPreview && <img src={scanPreview} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{scanResult.establecimiento || "Comercio no legible"}</p>
                    <p className="text-[11px] text-muted-foreground">{scanResult.fecha ?? "Sin fecha"} · {scanResult.items.length} producto{scanResult.items.length !== 1 ? "s" : ""}</p>
                    <p className="text-lg font-black text-cyclon-periwinkle">{formatAmount(scanResult.total)}</p>
                  </div>
                  <span className={cn("self-start text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0",
                    scanResult.confianza === "alta" ? "bg-kiri-emerald/15 text-kiri-emerald" : scanResult.confianza === "media" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400")}>
                    {scanResult.confianza === "alta" ? "Se lee bien" : scanResult.confianza === "media" ? "Revisa" : "Borroso"}
                  </span>
                </div>
                {scanResult.items.length > 1 && (
                  <div className="flex bg-muted/40 rounded-xl p-1 text-[11px] font-bold">
                    <button onClick={() => cambiarModoItems(false)} className={cn("flex-1 py-1.5 rounded-lg", !porItems ? "bg-background shadow-sm" : "text-muted-foreground")}>Todo en uno</button>
                    <button onClick={() => cambiarModoItems(true)} className={cn("flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1", porItems ? "bg-background shadow-sm" : "text-muted-foreground")}>{hasFeature("receiptItems") ? <ListChecks className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />} Separar por productos{!hasFeature("receiptItems") && <span className="text-[9px] font-black text-amber-600 ml-0.5">PRO</span>}</button>
                  </div>
                )}
                <AccionesReview acciones={scanAcciones} destinos={destinos} errores={scanErrores} compacto={porItems}
                  onChange={(id, patch) => { setScanAcciones(p => p.map(a => a.id === id ? { ...a, ...patch } : a)); setScanErrores(e => ({ ...e, [id]: "" })) }}
                  onRemove={id => setScanAcciones(p => p.filter(a => a.id !== id))} />
                {porItems && scanAcciones.length > 0 && (
                  <p className="text-[10px] text-muted-foreground text-right">Suma: {formatAmount(scanAcciones.reduce((s, a) => s + a.monto, 0))} de {formatAmount(scanResult.total)}</p>
                )}
              </>
            )}
          </div>
          {scanState === "result" && (
            <DialogFooter className="gap-2 pt-3 border-t border-border">
              <Button variant="ghost" onClick={resetScan} disabled={guardando}>Otra foto</Button>
              <Button onClick={confirmarScan} disabled={guardando || scanAcciones.length === 0} className="bg-cyclon-periwinkle hover:bg-cyclon-periwinkle/90 text-white font-bold rounded-xl px-6 gap-2">
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {guardando ? "Guardando..." : `Confirmar (${scanAcciones.length})`}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════ PANEL DE CHAT ══════════ */}
      {isOpen && (
        <div className="fixed z-[60] bg-card border border-border shadow-2xl shadow-black/10 flex flex-col overflow-hidden inset-x-0 top-0 bottom-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[400px] sm:rounded-2xl lg:bottom-8 lg:right-8 lg:top-auto lg:w-[420px] lg:h-[640px] lg:rounded-2xl">
          <div className="flex items-center gap-3 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:pt-3 border-b border-border bg-kiri-emerald/5">
            <div className="h-10 w-10 bg-kiri-emerald rounded-xl flex items-center justify-center shrink-0"><KiriLogo className="h-6 w-6" ojos="#fff" /></div>
            <div className="flex-1 min-w-0"><p className="text-sm font-bold">Kiri Coach</p>{usoIA?.coach && !usoIA.coach.ilimitado && usoIA.coach.restantes != null
              ? <p className="truncate leading-tight"><CuotaIA uso={usoIA.coach} que="mensajes" /></p>
              : <p className="text-[10px] text-muted-foreground truncate">Tu experto en Kiri Finance y en tu plata</p>}</div>
            <button onClick={abrirVoz} title="Dictar movimientos" className="h-8 w-8 rounded-lg bg-kiri-emerald/10 text-kiri-emerald hover:bg-kiri-emerald/20 flex items-center justify-center"><Mic className="h-4 w-4" /></button>
            <button onClick={() => { setIsOpen(false); abrirScanner() }} title="Escanear recibo" className="h-8 w-8 rounded-lg bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 flex items-center justify-center"><ScanLine className="h-4 w-4" /></button>
            <button onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Cerrar"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-full gap-4 text-center px-4">
                <div className="h-20 w-20 bg-kiri-mint/30 rounded-full flex items-center justify-center"><KiriLogo className="h-12 w-12" /></div>
                <div>
                  <p className="font-bold">¡Hola{user.nombre ? `, ${user.nombre.split(" ")[0]}` : ""}! Soy Kiri 🌱</p>
                  <p className="text-sm text-muted-foreground mt-1">Te explico cualquier parte de la app, analizo tus finanzas y registro lo que me digas.</p>
                </div>
                {avisoIA}
                <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                  <button onClick={abrirVoz} className="flex items-center gap-2 text-left text-xs bg-kiri-emerald/10 hover:bg-kiri-emerald/20 px-3 py-2.5 rounded-xl text-kiri-emerald font-bold"><Mic className="h-4 w-4 shrink-0" /> Dictar mis movimientos</button>
                  <button onClick={() => { setIsOpen(false); abrirScanner() }} className="flex items-center gap-2 text-left text-xs bg-cyclon-periwinkle/10 hover:bg-cyclon-periwinkle/20 px-3 py-2.5 rounded-xl text-cyclon-periwinkle font-bold"><ScanLine className="h-4 w-4 shrink-0" /> Escanear un recibo</button>
                  {["¿Cómo voy este mes?", "Registra un gasto de 20 mil en almuerzo", "¿Qué deuda debería pagar primero?", "Explícame cómo funciona el presupuesto del hogar"].map(q => (
                    <button key={q} onClick={() => enviar(q)} className="text-left text-xs bg-muted/50 hover:bg-kiri-mint/20 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground">{q}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[88%] space-y-2", msg.role === "user" && "max-w-[80%]")}>
                  <div className={cn("px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                    msg.role === "user" ? "bg-kiri-emerald text-white rounded-br-md" : msg.error ? "bg-amber-500/10 text-amber-900 dark:text-amber-200 rounded-bl-md" : "bg-muted rounded-bl-md")}>
                    {msg.role === "assistant" ? <TextoCoach texto={msg.texto} /> : msg.texto}
                  </div>

                  {/* Acciones propuestas */}
                  {msg.acciones && msg.estado !== "descartado" && msg.estado !== "guardado" && (
                    <div className="space-y-2">
                      {msg.resultado && <p className="text-[11px] font-bold text-kiri-emerald">{msg.resultado}</p>}
                      <AccionesReview acciones={msg.acciones} destinos={destinos} errores={msg.errores} compacto
                        onChange={(id, patch) => editarAccionMsg(msg.id, id, patch)} onRemove={id => quitarAccionMsg(msg.id, id)} />
                      {msg.acciones.length > 0 && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" disabled={msg.estado === "guardando"} onClick={() => setMessages(p => p.map(m => m.id === msg.id ? { ...m, estado: "descartado" } : m))} className="flex-1 h-8 rounded-xl text-xs">Descartar</Button>
                          <Button size="sm" disabled={msg.estado === "guardando"} onClick={() => confirmarMsg(msg)} className="flex-1 h-8 rounded-xl text-xs font-bold bg-kiri-emerald hover:bg-kiri-sage text-white gap-1">
                            {msg.estado === "guardando" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirmar ({msg.acciones.length})
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.estado === "guardado" && <p className="text-[11px] font-bold text-kiri-emerald">{msg.resultado}</p>}
                  {msg.estado === "descartado" && <p className="text-[11px] text-muted-foreground">Descartado — no se guardó nada.</p>}

                  {msg.ir && (
                    <button onClick={() => { router.push(msg.ir!.ruta); if (isMobile) setIsOpen(false) }}
                      className="flex items-center gap-1 text-[11px] font-bold text-kiri-emerald hover:underline">
                      {msg.ir.etiqueta} <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                  {msg === ultimaAsistente && !loading && (msg.sugerencias?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sugerencias!.map(s => (
                        <button key={s} onClick={() => enviar(s)} className="text-[11px] px-2.5 py-1 rounded-full border border-kiri-emerald/30 text-kiri-emerald hover:bg-kiri-emerald/10">{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-kiri-emerald animate-spin" />
                  <span className="text-xs text-muted-foreground">Kiri está pensando…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3 flex items-center gap-2">
            <button onClick={vozEnChat} aria-label="Dictar pregunta"
              className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                chatEscuchando ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted")}>
              <Mic className="h-4 w-4" />
            </button>
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(input) } }}
              placeholder={chatEscuchando ? "Escuchando…" : "Pregúntale o pídele algo a Kiri…"}
              className="flex-1 h-10 rounded-xl bg-muted/40 border-none text-sm" disabled={loading} />
            <Button onClick={() => enviar(input)} disabled={!input.trim() || loading} size="icon" className="h-10 w-10 rounded-xl bg-kiri-emerald hover:bg-kiri-sage text-white shrink-0" aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
