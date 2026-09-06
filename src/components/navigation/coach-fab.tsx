"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  X, Send, Mic, MicOff, Loader2, Sparkles, CheckCircle2,
  AlertTriangle, ScanLine, Camera, Upload, Store, Calendar,
  DollarSign, Tag, Calculator, TrendingUp, TrendingDown, PiggyBank, Coffee,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData, SavingsEntry } from "@/hooks/use-finance-data"
import { useStreaks } from "@/hooks/use-streaks"
import { DebtSimulator } from "@/components/recommendations/debt-simulator"
import { getPeriodData } from "@/lib/period-filter"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import { userApi } from "@/lib/api-client"
import type { VoiceExtractOutput } from "@/app/api/ai/voice-extract/route"
import type { ReceiptScannerOutput } from "@/ai/flows/receipt-scanner-flow"
import type { ProactiveCoachInput } from "@/ai/types"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

// ─── Dictado por voz: fases + tarjetas editables ─────────────────────────────
type VoicePhase = "idle" | "listening" | "processing" | "review" | "done"

type HormigaCategoria = VoiceExtractOutput["gastosHormiga"][number]["categoria"]

interface DraftItem {
  id: string
  kind: "ingreso" | "deuda" | "gastoFijo" | "ahorro" | "hormiga"
  nombre: string
  monto: number
  when?: string
  // Datos que el AI detectó pero que no se editan en la tarjeta — se
  // preservan tal cual para guardarlos junto con nombre/monto.
  frecuencia?: VoiceExtractOutput["ingreso"]["frecuencia"]
  cuota?: number | null
  diaCorte?: number | null
  fechaVencimiento?: string | null
  fechaCorte?: string | null
  categoriaHormiga?: HormigaCategoria
}

function buildDraftItems(result: VoiceExtractOutput): DraftItem[] {
  const items: DraftItem[] = []
  if (result.ingreso.monto) {
    items.push({
      id: "ingreso",
      kind: "ingreso",
      nombre: "Ingreso",
      monto: result.ingreso.monto,
      when: result.ingreso.frecuencia === "quincenal" ? "Quincenal" : "Mensual",
      frecuencia: result.ingreso.frecuencia,
    })
  }
  result.deudas.forEach((d, i) => items.push({
    id: `deuda-${i}`, kind: "deuda", nombre: d.nombre, monto: d.monto,
    when: d.diaCorte ? `Vence el día ${d.diaCorte}` : undefined,
    cuota: d.cuota, diaCorte: d.diaCorte, fechaVencimiento: d.fechaVencimiento,
  }))
  result.gastosFijos.forEach((g, i) => items.push({
    id: `gastoFijo-${i}`, kind: "gastoFijo", nombre: g.nombre, monto: g.monto,
    when: g.diaCorte ? `Corte el día ${g.diaCorte}` : undefined,
    diaCorte: g.diaCorte, fechaCorte: g.fechaCorte,
  }))
  ;(result.ahorro ?? []).forEach((a, i) => items.push({
    id: `ahorro-${i}`, kind: "ahorro", nombre: a.nombre, monto: a.monto,
  }))
  result.gastosHormiga.forEach((h, i) => items.push({
    id: `hormiga-${i}`, kind: "hormiga", nombre: h.nombre, monto: h.monto,
    categoriaHormiga: h.categoria,
  }))
  return items
}

const KIND_META: Record<DraftItem["kind"], { icon: LucideIcon; color: string; label: string }> = {
  ingreso:   { icon: TrendingUp,   color: "text-kiri-emerald",      label: "Ingreso detectado" },
  deuda:     { icon: TrendingDown, color: "text-cyclon-pink",       label: "Deuda detectada" },
  gastoFijo: { icon: Calendar,     color: "text-cyclon-sky",        label: "Gasto fijo detectado" },
  ahorro:    { icon: PiggyBank,    color: "text-cyclon-lavender",   label: "Ahorro detectado" },
  hormiga:   { icon: Coffee,       color: "text-cyclon-periwinkle", label: "Gasto hormiga" },
}

const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

function VoiceWaveform() {
  const bars = useRef(Array.from({ length: 20 }, (_, i) => i)).current
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {bars.map(i => (
        <span key={i}
          className="w-[3px] h-8 rounded-full bg-kiri-emerald origin-bottom animate-[kiriWaveBar_1s_ease-in-out_infinite]"
          style={{ animationDelay: `${(i % 7) * 70}ms`, animationDuration: `${700 + (i % 5) * 100}ms` }}
        />
      ))}
    </div>
  )
}

function VoiceReviewCard({ item, onDiscard, onChange }: {
  item: DraftItem
  onDiscard: () => void
  onChange: (patch: Partial<DraftItem>) => void
}) {
  const meta = KIND_META[item.kind]
  const Icon = meta.icon
  return (
    <div className="flex items-start gap-2.5 bg-card border border-border rounded-2xl p-3">
      <div className={cn("h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0", meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-[10px] font-bold uppercase tracking-wide truncate", meta.color)}>{meta.label}</span>
          <button onClick={onDiscard} className="text-muted-foreground hover:text-destructive transition-colors shrink-0" aria-label="Descartar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          <Input value={item.nombre} onChange={e => onChange({ nombre: e.target.value })}
            className="flex-1 h-8 text-xs rounded-lg" />
          <div className="relative w-24 shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground pointer-events-none">$</span>
            <Input value={item.monto ? String(item.monto) : ""} inputMode="numeric"
              onChange={e => onChange({ monto: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              className="h-8 text-xs rounded-lg pl-5" />
          </div>
        </div>
        {item.when && <p className="text-[10px] text-muted-foreground mt-1.5">{item.when}</p>}
      </div>
    </div>
  )
}

function VoiceDictationPanel({
  phase, transcript, error, resumenKiri, confianza, draftItems, saving, savedCount,
  onStartOrRetry, onStopListening, onDiscardItem, onUpdateItem, onConfirm, onDictateMore, onCancel, onClose,
}: {
  phase: VoicePhase
  transcript: string
  error: string | null
  resumenKiri?: string
  confianza?: VoiceExtractOutput["confianza"]
  draftItems: DraftItem[]
  saving: boolean
  savedCount: number
  onStartOrRetry: () => void
  onStopListening: () => void
  onDiscardItem: (id: string) => void
  onUpdateItem: (id: string, patch: Partial<DraftItem>) => void
  onConfirm: () => void
  onDictateMore: () => void
  onCancel: () => void
  onClose: () => void
}) {
  if (phase === "review") {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-kiri-emerald/15 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-kiri-emerald" />
            </div>
            Kiri entendió esto
          </DialogTitle>
          <DialogDescription>Revisa, ajusta si hace falta, y confirma antes de guardar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {resumenKiri && (
            <div className="bg-kiri-mint/10 rounded-2xl p-3">
              <p className="text-xs text-foreground/85 leading-relaxed">{resumenKiri}</p>
              {confianza && (
                <span className={cn("mt-1.5 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full",
                  confianza === "alta" ? "bg-kiri-emerald/20 text-kiri-emerald" :
                  confianza === "media" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" :
                  "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400")}>
                  Confianza {confianza}
                </span>
              )}
            </div>
          )}
          {draftItems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Descartaste todo — no hay nada que guardar.</p>
          ) : (
            <div className="space-y-2">
              {draftItems.map(item => (
                <VoiceReviewCard key={item.id} item={item}
                  onDiscard={() => onDiscardItem(item.id)}
                  onChange={patch => onUpdateItem(item.id, patch)} />
              ))}
            </div>
          )}
          {error && <p className="text-[11px] text-destructive font-bold bg-destructive/10 rounded-lg p-2 text-center">{error}</p>}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button variant="outline" size="sm" onClick={onDictateMore} disabled={saving} className="w-full rounded-xl h-9 text-xs font-bold gap-1.5 border-dashed">
            <Mic className="h-3.5 w-3.5" /> Dictar algo más
          </Button>
          <div className="flex gap-2 w-full">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="flex-1 rounded-xl h-10 text-xs font-bold">Cancelar</Button>
            <Button size="sm" onClick={onConfirm} disabled={saving || draftItems.length === 0} className="flex-1 rounded-xl h-10 bg-kiri-emerald hover:bg-kiri-sage text-white font-bold text-xs gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? "Guardando..." : `Guardar todo (${draftItems.length})`}
            </Button>
          </div>
        </DialogFooter>
      </>
    )
  }

  if (phase === "done") {
    return (
      <div className="py-4 text-center">
        <div className="relative inline-block">
          <div className="h-16 w-16 rounded-full bg-kiri-emerald/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-kiri-emerald" />
          </div>
          {BURST_ANGLES.map((deg, i) => {
            const rad = (deg * Math.PI) / 180
            const tx = Math.round(Math.cos(rad) * 46)
            const ty = Math.round(Math.sin(rad) * 46)
            return (
              <span key={i} className="absolute left-1/2 top-1/2 text-sm animate-[kiriBurstOut_0.7s_ease-out_forwards]"
                style={{ "--tx": `${tx}px`, "--ty": `${ty}px`, animationDelay: `${i * 30}ms` } as React.CSSProperties}>
                ✨
              </span>
            )
          })}
        </div>
        <p className="text-base font-bold mt-4">¡Listo! 🌿</p>
        <p className="text-sm text-muted-foreground mt-1">
          Guardamos {savedCount} movimiento{savedCount !== 1 ? "s" : ""} en tu app.
        </p>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={onDictateMore} className="flex-1 rounded-xl h-9 text-xs font-bold gap-1.5">
            <Mic className="h-3.5 w-3.5" /> Dictar otro
          </Button>
          <Button size="sm" onClick={onClose} className="flex-1 rounded-xl h-9 bg-kiri-emerald hover:bg-kiri-sage text-white font-bold text-xs">
            Listo
          </Button>
        </div>
      </div>
    )
  }

  // idle / listening / processing
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center",
            phase === "listening" ? "bg-kiri-emerald/20 text-kiri-emerald animate-pulse" : "bg-muted/50 text-muted-foreground")}>
            <Mic className="h-4 w-4" />
          </div>
          Dictado inteligente
        </DialogTitle>
        <DialogDescription>Habla y Kiri clasificará tus datos financieros automáticamente.</DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-4 text-center">
        {phase === "listening" && (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-kiri-emerald/25 animate-ping" />
              <span className="absolute inset-0 rounded-full bg-kiri-emerald/15 animate-ping [animation-delay:300ms]" />
              <button onClick={onStopListening} className="relative h-16 w-16 rounded-full bg-kiri-emerald flex items-center justify-center cursor-pointer">
                <Mic className="h-7 w-7 text-white" />
              </button>
            </div>
            <VoiceWaveform />
            <p className="text-sm font-bold text-kiri-emerald">Escuchando...</p>
            <p className="text-xs text-muted-foreground min-h-[1.5rem] px-2">
              {transcript || "Toca el micrófono para detener"}
            </p>
          </div>
        )}
        {phase === "processing" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-kiri-emerald animate-spin" />
            <p className="text-sm font-bold">Analizando lo que dijiste...</p>
            {transcript && (
              <div className="relative w-full overflow-hidden rounded-2xl bg-muted/40 px-4 py-3">
                <p className="text-xs text-foreground/80 italic leading-relaxed relative z-10">&ldquo;{transcript}&rdquo;</p>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-kiri-emerald/20 to-transparent bg-[length:200%_100%] animate-[kiriShimmer_1.4s_ease-in-out_infinite]" />
              </div>
            )}
          </div>
        )}
        {phase === "idle" && error && (
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-destructive font-bold">{error}</p>
            <Button size="sm" onClick={onStartOrRetry} className="rounded-xl bg-kiri-emerald hover:bg-kiri-sage text-white">Intentar de nuevo</Button>
          </div>
        )}
        {phase === "idle" && !error && (
          <div className="flex flex-col items-center gap-3">
            <button onClick={onStartOrRetry} className="h-20 w-20 rounded-full bg-kiri-emerald/10 border-2 border-kiri-emerald/30 flex items-center justify-center hover:bg-kiri-emerald/20 transition-colors">
              <Mic className="h-9 w-9 text-kiri-emerald" />
            </button>
            <p className="text-sm text-muted-foreground">Toca para hablar</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} className="rounded-xl w-full">Cancelar</Button>
      </DialogFooter>
    </>
  )
}

// ─── Etiqueta de categoría del escáner ───────────────────────────────────────
const CAT_STYLES: Record<string, { label: string; color: string }> = {
  gasto_fijo:  { label: "Gasto Fijo",  color: "bg-cyclon-sky/10 text-cyclon-sky" },
  gasto_libre: { label: "Gasto Libre", color: "bg-cyclon-mint/20 text-cyclon-periwinkle" },
  deuda:       { label: "Deuda",        color: "bg-cyclon-pink/10 text-cyclon-pink" },
  ahorro:      { label: "Ahorro",       color: "bg-cyclon-lavender/10 text-cyclon-lavender" },
  otro:        { label: "Otro",         color: "bg-muted text-muted-foreground" },
}

export function CoachFab() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)

  // ── Satélites FAB ──────────────────────────────────────────────────────────
  // showSatellites: hover en desktop / long-press en mobile
  const [showSatellites, setShowSatellites] = useState(false)

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── En móviles los satélites viven en el BottomNav (+), no en el FAB ──────
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Escuchar eventos del BottomNav (+) para abrir modales
  useEffect(() => {
    const onSim = () => handleSimSatellite()
    const onVoice = () => handleVoiceSatellite()
    const onScan = () => handleScanSatellite()
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

  const handleFabMouseEnter = () => {
    if (isMobile) return
    hoverTimer.current = setTimeout(() => setShowSatellites(true), 300)
  }
  const handleFabMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setShowSatellites(false)
  }

  const handleFabTouchEnd = () => {
    // Un tap (en móvil o escritorio táctil) siempre abre el chat.
    // Los satélites de escritorio son exclusivos del hover con mouse
    // (un long-press aquí los dejaba abiertos sin ningún "mouseleave" que los cerrara).
    setIsOpen(true)
  }

  // ── Modo voz inteligente ──────────────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState(false)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle")
  const [voiceTranscript, setVoiceTranscript] = useState("")
  const [extractResult, setExtractResult] = useState<VoiceExtractOutput | null>(null)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [extractError, setExtractError] = useState<string | null>(null)
  const [savingExtract, setSavingExtract] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  // ── Modo escáner ──────────────────────────────────────────────────────────
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [scanState, setScanState] = useState<"idle" | "scanning" | "result" | "error">("idle")
  const [scanResult, setScanResult] = useState<ReceiptScannerOutput | null>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [savingScan, setSavingScan] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // ── Simulador ─────────────────────────────────────────────────────────────
  const [simOpen, setSimOpen] = useState(false)

  const { income, incomeFrequency, formatAmount, setIncome, user, metaAhorro } = useAppContext()
  const { debts, fixedExpenses, extraIncomes, totalAhorrado, totalImpulseThisPeriod, savingsHistory, addDebt, addFixedExpense, addImpulseExpense, refetch } = useFinanceData()
  const { streakActual } = useStreaks(incomeFrequency)

  const periodData = getPeriodData(
    income,
    extraIncomes.reduce((a, e) => a + e.monto, 0),
    debts,
    fixedExpenses,
    incomeFrequency,
  )
  const debtCapacityAmount = periodData.effectiveIncome > 0
    ? calculateBudgetAllocation(periodData.effectiveIncome, periodData.totalObligations).debtCapacityAmount
    : 0

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  // ── Speech ────────────────────────────────────────────────────────────────
  // onInterim recibe texto parcial mientras el usuario sigue hablando (para
  // mostrarlo creciendo en vivo). onStopWithoutResult se llama exactamente
  // una vez si el reconocimiento termina SIN transcripción final — por error,
  // por el timeout de seguridad, o porque el navegador lo cortó solo — para
  // que el que llama pueda volver a un estado "idle" en vez de quedarse
  // colgado esperando algo que nunca va a llegar.
  const startListening = (
    onFinal: (t: string) => void,
    onInterim?: (t: string) => void,
    onStopWithoutResult?: () => void,
  ) => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SR) { alert("Tu navegador no soporta reconocimiento de voz"); onStopWithoutResult?.(); return }
    const r = new (SR as new () => SpeechRecognition)()
    r.lang = "es-ES"; r.continuous = false; r.interimResults = true
    let settled = false
    // Timeout de seguridad: si no se detecta voz en 8 segundos, detener
    const timeout = setTimeout(() => { r.stop() }, 8000)
    r.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          settled = true
          clearTimeout(timeout)
          setIsListening(false)
          onFinal(transcript)
          return
        }
        interim += transcript
      }
      if (interim) onInterim?.(interim)
    }
    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      clearTimeout(timeout)
      setIsListening(false)
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        alert(e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? "Kiri necesita permiso para usar el micrófono."
          : "No se pudo reconocer tu voz. Intenta de nuevo.")
      }
      if (!settled) { settled = true; onStopWithoutResult?.() }
    }
    r.onend = () => {
      clearTimeout(timeout)
      setIsListening(false)
      if (!settled) { settled = true; onStopWithoutResult?.() }
    }
    recognitionRef.current = r; r.start(); setIsListening(true)
  }

  const toggleVoice = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
    startListening(t => setInput(t))
  }

  // ── Satélite: Voz inteligente ─────────────────────────────────────────────
  const handleVoiceSatellite = () => {
    // Detener escucha previa si la hay
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    setIsListening(false)
    setShowSatellites(false)
    setVoiceModalOpen(true)
    setVoicePhase("listening")
    setVoiceTranscript(""); setExtractResult(null); setDraftItems([]); setExtractError(null)
    // Iniciar nueva escucha con delay para evitar conflicto
    setTimeout(() => {
      startListening(
        async t => {
          setVoiceTranscript(t)
          setVoicePhase("processing")
          try {
            const res = await fetch("/api/ai/voice-extract", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcripcion: t }),
            })
            if (!res.ok) throw new Error("Error del servidor")
            const data: VoiceExtractOutput = await res.json()
            setExtractResult(data)
            setDraftItems(buildDraftItems(data))
            setVoicePhase("review")
          } catch {
            setExtractError("No pude procesar el audio. Intenta de nuevo.")
            setVoicePhase("idle")
          }
        },
        interim => setVoiceTranscript(interim),
        () => setVoicePhase("idle"),
      )
    }, 300)
  }

  const handleVoiceExtractStart = () => handleVoiceSatellite()

  const closeVoiceModal = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    setVoiceModalOpen(false)
    setVoicePhase("idle")
    setVoiceTranscript(""); setExtractResult(null); setDraftItems([]); setExtractError(null)
  }

  const handleConfirmExtract = async () => {
    if (draftItems.length === 0) return
    setExtractError(null)
    setSavingExtract(true)
    // addDebt/addFixedExpense/addImpulseExpense NUNCA lanzan — devuelven `null`
    // si no se pudo guardar (ver nota en use-finance-data.tsx). Antes este
    // handler ignoraba ese valor: si un ítem fallaba, el modal se cerraba
    // igual como si todo se hubiera guardado. Ahora se cuentan los fallos y,
    // si hay alguno, el modal se queda abierto con un aviso en vez de darlo
    // por hecho.
    const failed: string[] = []
    try {
      for (const item of draftItems) {
        if (item.kind === "ingreso") {
          // Distinguir entre sueldo base y un ingreso extra
          const esSueldo = item.monto === income || item.monto === Math.round(income / 2) // quincena
          const { error } = await userApi.walletIncome(item.monto, esSueldo ? "salario" : "extra")
          if (error) failed.push(`Ingreso de ${formatAmount(item.monto)}`)
        } else if (item.kind === "deuda") {
          const saved = await addDebt({ nombre: item.nombre, montoTotal: item.monto, cuotaPeriodo: item.cuota ?? item.monto, diasPago: String(item.diaCorte ?? "1") })
          if (!saved) failed.push(`Deuda: ${item.nombre}`)
        } else if (item.kind === "gastoFijo") {
          const saved = await addFixedExpense({ nombre: item.nombre, monto: item.monto, fechaCorte: item.fechaCorte ?? new Date().toISOString().split("T")[0] })
          if (!saved) failed.push(`Gasto fijo: ${item.nombre}`)
        } else if (item.kind === "ahorro") {
          try {
            const raw = localStorage.getItem("kiri_saving_pockets")
            const pockets = raw ? JSON.parse(raw) : []
            pockets.push({ id: String(Date.now()) + Math.random(), nombre: item.nombre, meta: item.monto, acumulado: 0, icono: "piggybank", color: "mint", createdAt: new Date().toISOString() })
            localStorage.setItem("kiri_saving_pockets", JSON.stringify(pockets))
          } catch { failed.push(`Ahorro: ${item.nombre}`) }
        } else if (item.kind === "hormiga") {
          const saved = await addImpulseExpense({ nombre: item.nombre, monto: item.monto, categoria: item.categoriaHormiga ?? "otro" })
          if (!saved) failed.push(item.nombre)
        }
      }
      refetch()
      // Disparar evento para que la billetera refresque el wallet
      window.dispatchEvent(new Event("kiri:wallet-updated"))

      if (failed.length > 0) {
        setExtractError(`No se pudo guardar: ${failed.join(", ")}. Intenta de nuevo.`)
        return
      }
      setSavedCount(draftItems.length)
      setVoicePhase("done")
    } catch {
      setExtractError("No se pudo guardar. Intenta de nuevo.")
    } finally {
      setSavingExtract(false)
    }
  }

  // ── Satélite: Simulador ───────────────────────────────────────────────────
  const handleSimSatellite = () => { setShowSatellites(false); setSimOpen(true) }

  // ── Satélite: Escáner ─────────────────────────────────────────────────────
  const handleScanSatellite = () => { setShowSatellites(false); setScanModalOpen(true); resetScan() }

  const resetScan = () => { setScanState("idle"); setScanResult(null); setScanPreview(null); setScanError(null) }

  const processImage = useCallback(async (file: File) => {
    const reader = new FileReader()
    reader.onload = e => setScanPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    setScanState("scanning")
    const toBase64 = (f: File): Promise<string> => new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(",")[1])
      r.onerror = rej; r.readAsDataURL(f)
    })
    try {
      const base64 = await toBase64(file)
      const resp = await fetch("/api/ai/scan-receipt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      })
      if (!resp.ok) throw new Error("Error al escanear")
      setScanResult(await resp.json()); setScanState("result")
    } catch (e) { setScanError(e instanceof Error ? e.message : "Error desconocido"); setScanState("error") }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) processImage(file); e.target.value = ""
  }

  const handleSaveScan = async () => {
    if (!scanResult) return
    setSavingScan(true)
    setScanError(null)
    try {
      const saved = scanResult.categoria === "gasto_fijo"
        ? await addFixedExpense({ nombre: scanResult.establecimiento, monto: scanResult.montoTotal, fechaCorte: scanResult.fecha })
        : scanResult.categoria === "deuda"
          ? await addDebt({ nombre: scanResult.establecimiento, montoTotal: scanResult.montoTotal, cuotaPeriodo: scanResult.montoTotal, diasPago: '1' })
          : await addFixedExpense({ nombre: `${scanResult.establecimiento} (${scanResult.fecha})`, monto: scanResult.montoTotal, fechaCorte: scanResult.fecha })

      if (!saved) {
        setScanError("No se pudo guardar. Intenta de nuevo.")
        return
      }
      setScanModalOpen(false); resetScan()
    } catch { setScanError("No se pudo guardar. Intenta de nuevo.") }
    finally { setSavingScan(false) }
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  // El payload tiene que calzar con ProactiveCoachInputSchema (src/ai/flows/
  // proactive-coach-flow.ts) — antes se mandaban nombres de campo distintos
  // (mensaje/ingresoMensual/totalDeudas/...) que no calzaban con NINGUNO de
  // los campos que el flow espera (nombreUsuario/ingresoActual/historial/
  // deudasActivas/...). Como el flow nunca valida el input con zod en runtime,
  // esto no fallaba con un error claro: `input.historial.map(...)` explotaba
  // con `historial` undefined, la ruta atrapaba esa excepción y devolvía el
  // mensaje genérico "No pude conectar con el coach ahora mismo" — SIEMPRE,
  // para cualquier pregunta. El chat nunca llegó a llamar a Gemini de verdad.
  const buildCoachInput = (mensajeUsuario?: string): ProactiveCoachInput => {
    const totalExtraIncome = extraIncomes.reduce((a, e) => a + e.monto, 0)
    const totalIncome = income + totalExtraIncome
    const totalObligations = debts.reduce((a, d) => a + d.cuotaPeriodo, 0) +
                             fixedExpenses.reduce((a, f) => a + f.monto, 0)
    const allocation = totalIncome > 0 ? calculateBudgetAllocation(totalIncome, totalObligations) : null

    const deudasActivas = debts
      .filter(d => d.estado === "activa" && d.cuotaPeriodo > 0)
      .map(d => ({
        nombre: d.nombre,
        montoTotal: d.montoTotal,
        cuotaPeriodo: d.cuotaPeriodo,
        mesesRestantes: d.cuotaPeriodo > 0 ? Math.ceil(d.montoTotal / d.cuotaPeriodo) : 99,
      }))

    const historialChat = messages.slice(-6).map(m => ({
      rol: (m.role === "assistant" ? "coach" : "usuario") as "usuario" | "coach",
      mensaje: m.content,
    }))

    return {
      nombreUsuario: user.nombre || "amigo",
      ingresoActual: totalIncome,
      frecuencia: incomeFrequency,
      obligacionesPct: allocation ? Math.round(allocation.obligationsPct) : 0,
      ahorroPct: allocation ? Math.round(allocation.savingsPct) : 0,
      capacidadLibre: allocation?.debtCapacityAmount ?? 0,
      metaAhorro,
      ahorroAcumulado: totalAhorrado,
      streakSemanas: streakActual,
      historial: buildCoachHistorial(savingsHistory, totalIncome, totalObligations),
      deudasActivas,
      mensajeUsuario,
      historialChat: historialChat.length > 0 ? historialChat : undefined,
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() }
    setMessages(p => [...p, userMsg]); setInput(""); setLoading(true)
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCoachInput(userMsg.content)),
      })
      const data = await res.json()
      setMessages(p => [...p, { id: (Date.now() + 1).toString(), role: "assistant", content: data.respuesta || "No pude procesar tu consulta." }])
    } catch { setMessages(p => [...p, { id: (Date.now() + 1).toString(), role: "assistant", content: "Error de conexión." }]) }
    finally { setLoading(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }

  return (
    <>
      {/* ══════════════════════════════════════════
          FAB principal + satélites
      ══════════════════════════════════════════ */}
      {!isOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col items-center gap-3",
            "bottom-24 right-5 lg:bottom-8 lg:right-8"
          )}
          onMouseEnter={handleFabMouseEnter}
          onMouseLeave={handleFabMouseLeave}
        >
          {/* ── Satélites (arriba del FAB) — solo desktop ── */}
          <div className={cn(
            "flex flex-col items-center gap-3 transition-all duration-300 ease-out",
            "hidden lg:flex",
            showSatellites
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-4 pointer-events-none"
          )}>
            {/* Satélite: Escáner */}
            <div className="relative group/sat">
              <button
                onClick={handleScanSatellite}
                className={cn(
                  "h-12 w-12 rounded-full bg-cyclon-periwinkle text-white shadow-lg shadow-cyclon-periwinkle/30",
                  "flex items-center justify-center transition-all duration-200",
                  "hover:scale-110 hover:shadow-xl active:scale-95",
                  showSatellites && "animate-[satellite-enter_0.3s_ease-out_0.1s_both]"
                )}
                aria-label="Escanear recibo"
              >
                <ScanLine className="h-5 w-5" />
              </button>
              <span className={cn(
                "absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap",
                "bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-lg",
                "opacity-0 group-hover/sat:opacity-100 transition-opacity duration-150 pointer-events-none"
              )}>
                Escanear recibo
              </span>
            </div>

            {/* Satélite: Simulador */}
            <div className="relative group/sat">
              <button
                onClick={handleSimSatellite}
                className={cn(
                  "h-12 w-12 rounded-full bg-cyclon-lavender text-white shadow-lg shadow-cyclon-lavender/30",
                  "flex items-center justify-center transition-all duration-200",
                  "hover:scale-110 hover:shadow-xl active:scale-95",
                  showSatellites && "animate-[satellite-enter_0.3s_ease-out_0.05s_both]"
                )}
                aria-label="Simulador de escenarios"
              >
                <Calculator className="h-5 w-5" />
              </button>
              <span className={cn(
                "absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap",
                "bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-lg",
                "opacity-0 group-hover/sat:opacity-100 transition-opacity duration-150 pointer-events-none"
              )}>
                Simulador
              </span>
            </div>

            {/* Satélite: Voz inteligente */}
            <div className="relative group/sat">
              <button
                onClick={handleVoiceSatellite}
                className={cn(
                  "h-12 w-12 rounded-full bg-kiri-emerald text-white shadow-lg shadow-kiri-emerald/30",
                  "flex items-center justify-center transition-all duration-200",
                  "hover:scale-110 hover:shadow-xl active:scale-95",
                  showSatellites && "animate-[satellite-enter_0.3s_ease-out_0s_both]"
                )}
                aria-label="Dictar datos por voz"
              >
                <Mic className="h-5 w-5" />
              </button>
              <span className={cn(
                "absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap",
                "bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-lg",
                "opacity-0 group-hover/sat:opacity-100 transition-opacity duration-150 pointer-events-none"
              )}>
                Dictar datos
              </span>
            </div>
          </div>

          {/* ── FAB principal ── */}
          <div className="relative">
            <button
              onClick={() => setIsOpen(true)}
              onTouchEnd={(e) => { e.preventDefault(); handleFabTouchEnd() }}
              className={cn(
                "relative h-14 w-14 lg:h-16 lg:w-16 rounded-full bg-kiri-emerald",
                "shadow-lg shadow-kiri-emerald/30 flex items-center justify-center",
                "transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95",
                showSatellites && "scale-95 shadow-xl"
              )}
              aria-label="Abrir Kiri Coach"
            >
              <svg viewBox="0 0 40 40" className="h-9 w-9 lg:h-10 lg:w-10" fill="none">
                <rect x="13" y="26" width="14" height="10" rx="3" fill="#D8F3DC" />
                <path d="M20 26 C20 20 20 18 20 14" stroke="#B7E4C7" strokeWidth="2.5" strokeLinecap="round" />
                <ellipse cx="16" cy="14" rx="4" ry="6" fill="#52B788" transform="rotate(-20 16 14)" />
                <ellipse cx="24" cy="12" rx="4" ry="5.5" fill="#40916C" transform="rotate(15 24 12)" />
                <circle cx="17" cy="30" r="1.2" fill="#2D6A4F" />
                <circle cx="23" cy="30" r="1.2" fill="#2D6A4F" />
                <path d="M18 33 Q20 35 22 33" stroke="#2D6A4F" strokeWidth="1" strokeLinecap="round" fill="none" />
              </svg>
            </button>
            <div className="absolute inset-0 rounded-full bg-kiri-emerald/40 animate-ping pointer-events-none" />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          SIMULADOR (renderizado fuera del FAB)
      ══════════════════════════════════════════ */}
      {simOpen && (
        <DebtSimulator
          debtCapacity={debtCapacityAmount}
          incomeFrequency={incomeFrequency}
          forceOpen
          onClose={() => setSimOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════
          MODAL: Voz inteligente
      ══════════════════════════════════════════ */}
      <Dialog open={voiceModalOpen} onOpenChange={v => { if (!v) closeVoiceModal() }}>
        <DialogContent>
          <VoiceDictationPanel
            phase={voicePhase}
            transcript={voiceTranscript}
            error={extractError}
            resumenKiri={extractResult?.resumenKiri}
            confianza={extractResult?.confianza}
            draftItems={draftItems}
            saving={savingExtract}
            savedCount={savedCount}
            onStartOrRetry={handleVoiceExtractStart}
            onStopListening={() => recognitionRef.current?.stop()}
            onDiscardItem={id => setDraftItems(prev => prev.filter(i => i.id !== id))}
            onUpdateItem={(id, patch) => setDraftItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))}
            onConfirm={handleConfirmExtract}
            onDictateMore={handleVoiceSatellite}
            onCancel={closeVoiceModal}
            onClose={closeVoiceModal}
          />
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          MODAL: Escáner de recibos
      ══════════════════════════════════════════ */}
      <Dialog open={scanModalOpen} onOpenChange={v => { if (!v) { setScanModalOpen(false); resetScan() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-cyclon-periwinkle" /> Escanear Recibo
            </DialogTitle>
            <DialogDescription>Sube o toma una foto de tu recibo. Gemini extrae los datos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Idle */}
            {scanState === "idle" && (
              <div className="space-y-3">
                {scanPreview && (
                  <div className="relative rounded-2xl overflow-hidden border border-border">
                    <img src={scanPreview} alt="Preview" className="w-full max-h-48 object-cover" />
                    <button onClick={() => setScanPreview(null)} className="absolute top-2 right-2 h-7 w-7 bg-black/50 rounded-full flex items-center justify-center text-white"><X className="h-4 w-4" /></button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-cyclon-periwinkle/30 hover:border-cyclon-periwinkle/60 hover:bg-cyclon-periwinkle/5 transition-colors">
                    <Camera className="h-7 w-7 text-cyclon-periwinkle" />
                    <span className="text-xs font-bold text-cyclon-periwinkle">Tomar Foto</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-muted hover:border-muted-foreground/30 transition-colors">
                    <Upload className="h-7 w-7 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground">Subir Imagen</span>
                  </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
              </div>
            )}
            {/* Scanning */}
            {scanState === "scanning" && (
              <div className="flex flex-col items-center gap-4 py-6">
                {scanPreview && <div className="relative rounded-2xl overflow-hidden w-full max-h-32"><img src={scanPreview} alt="" className="w-full max-h-32 object-cover opacity-50" /></div>}
                <Loader2 className="h-10 w-10 text-cyclon-periwinkle animate-spin" />
                <p className="text-sm font-bold">Analizando recibo...</p>
              </div>
            )}
            {/* Result */}
            {scanState === "result" && scanResult && (
              <div className="space-y-3">
                <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold",
                  scanResult.confianza === "alta" ? "bg-cyclon-mint/20 text-cyclon-periwinkle" : scanResult.confianza === "media" ? "bg-yellow-50 text-yellow-700" : "bg-cyclon-pink/10 text-cyclon-pink")}>
                  {scanResult.confianza === "alta" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  Confianza {scanResult.confianza}
                </div>
                <Card className="border-none bg-card shadow-sm rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    {[
                      { icon: <Store className="h-4 w-4" />, label: "Establecimiento", val: scanResult.establecimiento, bold: false },
                      { icon: <Calendar className="h-4 w-4" />, label: "Fecha", val: scanResult.fecha, bold: false },
                      { icon: <DollarSign className="h-4 w-4" />, label: "Monto Total", val: formatAmount(scanResult.montoTotal), bold: true },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">{row.icon}</div>
                        <div><p className="text-[10px] text-muted-foreground">{row.label}</p><p className={cn("text-sm", row.bold ? "font-black text-cyclon-periwinkle" : "font-bold")}>{row.val}</p></div>
                      </div>
                    ))}
                    <div className="border-t border-dashed border-border pt-2 flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Categoría:</span>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", CAT_STYLES[scanResult.categoria]?.color)}>
                        {CAT_STYLES[scanResult.categoria]?.label}
                      </span>
                    </div>
                    {scanResult.items && scanResult.items.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-dashed border-border">
                        {scanResult.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs"><span className="text-muted-foreground truncate flex-1">{item.descripcion}</span><span className="font-bold ml-2">{formatAmount(item.monto)}</span></div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {scanError && (
                  <p className="text-xs text-destructive font-bold bg-destructive/10 rounded-lg p-2 text-center">{scanError}</p>
                )}
              </div>
            )}
            {/* Error */}
            {scanState === "error" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <p className="text-sm font-bold text-destructive text-center">{scanError}</p>
                <Button size="sm" variant="outline" onClick={resetScan} className="rounded-xl">Intentar de nuevo</Button>
              </div>
            )}
          </div>
          {scanState === "result" && scanResult && (
            <DialogFooter className="gap-2 pt-3 border-t border-border">
              <Button variant="ghost" onClick={resetScan}>Escanear otro</Button>
              <Button onClick={handleSaveScan} disabled={savingScan} className="bg-cyclon-periwinkle text-white font-bold rounded-xl px-6 gap-2">
                {savingScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {savingScan ? "Guardando..." : "Guardar gasto"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          PANEL CHAT (cuando isOpen)
      ══════════════════════════════════════════ */}
      {isOpen && (
        <div className={cn(
          "fixed z-[60] bg-card border border-border shadow-2xl shadow-black/10 flex flex-col overflow-hidden",
          "inset-x-0 top-0 bottom-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[380px] sm:rounded-2xl lg:bottom-8 lg:right-8 lg:top-auto lg:w-[400px] lg:h-[600px] lg:rounded-2xl"
        )}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:pt-3 border-b border-border bg-kiri-emerald/5">
            <div className="h-10 w-10 bg-kiri-emerald rounded-xl flex items-center justify-center shrink-0">
              <svg viewBox="0 0 40 40" className="h-6 w-6" fill="none">
                <rect x="13" y="26" width="14" height="10" rx="3" fill="#D8F3DC" />
                <path d="M20 26 C20 20 20 18 20 14" stroke="#B7E4C7" strokeWidth="2.5" strokeLinecap="round" />
                <ellipse cx="16" cy="14" rx="4" ry="6" fill="#52B788" transform="rotate(-20 16 14)" />
                <ellipse cx="24" cy="12" rx="4" ry="5.5" fill="#40916C" transform="rotate(15 24 12)" />
                <circle cx="17" cy="30" r="1.2" fill="#fff" />
                <circle cx="23" cy="30" r="1.2" fill="#fff" />
                <path d="M18 33 Q20 35 22 33" stroke="#fff" strokeWidth="1" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <div className="flex-1"><p className="text-sm font-bold">Kiri Coach</p><p className="text-[10px] text-muted-foreground">Tu mentor financiero con IA</p></div>
            {/* Accesos rápidos en el header del chat */}
            <button onClick={handleVoiceExtractStart} title="Dictado inteligente"
              className="h-8 w-8 rounded-lg bg-kiri-emerald/10 text-kiri-emerald hover:bg-kiri-emerald/20 flex items-center justify-center transition-colors mr-0.5">
              <Mic className="h-4 w-4" />
            </button>
            <button onClick={() => { setIsOpen(false); setScanModalOpen(true); resetScan() }} title="Escanear recibo"
              className="h-8 w-8 rounded-lg bg-cyclon-periwinkle/10 text-cyclon-periwinkle hover:bg-cyclon-periwinkle/20 flex items-center justify-center transition-colors mr-1">
              <ScanLine className="h-4 w-4" />
            </button>
            <button onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                <div className="h-20 w-20 bg-kiri-mint/30 rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 40 40" className="h-12 w-12" fill="none">
                    <rect x="13" y="26" width="14" height="10" rx="3" fill="#D8F3DC" />
                    <path d="M20 26 C20 20 20 18 20 14" stroke="#B7E4C7" strokeWidth="2.5" strokeLinecap="round" />
                    <ellipse cx="16" cy="14" rx="4" ry="6" fill="#52B788" transform="rotate(-20 16 14)" />
                    <ellipse cx="24" cy="12" rx="4" ry="5.5" fill="#40916C" transform="rotate(15 24 12)" />
                    <circle cx="17" cy="30" r="1.2" fill="#2D6A4F" /><circle cx="23" cy="30" r="1.2" fill="#2D6A4F" />
                    <path d="M18 33 Q20 35 22 33" stroke="#2D6A4F" strokeWidth="1" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold">¡Hola! Soy Kiri 🌱</p>
                  <p className="text-sm text-muted-foreground mt-1">Pregúntame sobre tus finanzas o usa los botones de arriba para dictar o escanear.</p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                  <button onClick={handleVoiceExtractStart} className="flex items-center gap-2 text-left text-xs bg-kiri-emerald/10 hover:bg-kiri-emerald/20 px-3 py-2.5 rounded-xl text-kiri-emerald font-bold transition-colors">
                    <Mic className="h-4 w-4 shrink-0" /> Dictar mis datos por voz
                  </button>
                  <button onClick={() => { setIsOpen(false); setScanModalOpen(true); resetScan() }} className="flex items-center gap-2 text-left text-xs bg-cyclon-periwinkle/10 hover:bg-cyclon-periwinkle/20 px-3 py-2.5 rounded-xl text-cyclon-periwinkle font-bold transition-colors">
                    <ScanLine className="h-4 w-4 shrink-0" /> Escanear un recibo
                  </button>
                  {["¿Cómo puedo ahorrar más?", "Analiza mis gastos", "¿Debería pagar esta deuda primero?"].map(q => (
                    <button key={q} onClick={() => setInput(q)} className="text-left text-xs bg-muted/50 hover:bg-kiri-mint/20 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user" ? "bg-kiri-emerald text-white rounded-br-md" : "bg-muted rounded-bl-md")}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-kiri-emerald animate-spin" />
                  <span className="text-xs text-muted-foreground">Kiri está pensando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border px-4 py-3 flex items-center gap-2">
            <button onClick={toggleVoice}
              className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                isListening ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted")}>
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={isListening ? "Escuchando..." : "Pregúntale a Kiri..."}
              className="flex-1 h-10 rounded-xl bg-muted/40 border-none text-sm" disabled={loading || isListening} />
            <Button onClick={handleSend} disabled={!input.trim() || loading} size="icon"
              className="h-10 w-10 rounded-xl bg-kiri-emerald hover:bg-kiri-sage text-white shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Helper: construir historial de 3 meses para el contexto del coach ────────
// Mismo cálculo que usaba el componente AiCoachChat (ahora reemplazado por
// esta integración directa en el FAB) — el flow de IA espera 3 meses de
// tendencia, así que se simulan variaciones sobre el ingreso/obligaciones
// actuales cuando no hay más historial real disponible.
function buildCoachHistorial(savingsHistory: SavingsEntry[], currentIncome: number, currentObligations: number) {
  const now = new Date()
  const meses = []

  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mesNombre = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" })

    const ahorroDelMes = savingsHistory
      .filter(s => s.tipo === "ahorro" && s.periodo.toLowerCase().includes(d.toLocaleDateString("es-ES", { month: "long" })))
      .reduce((acc, s) => acc + s.monto, 0)

    const variacion = i === 0 ? 1 : (0.95 + Math.random() * 0.1)
    const ingresoMes = Math.round(currentIncome * variacion)
    const obligacionesMes = Math.round(currentObligations * (0.9 + Math.random() * 0.2))

    meses.push({
      mes: mesNombre,
      ingresoTotal: ingresoMes,
      totalObligaciones: obligacionesMes,
      totalAhorro: ahorroDelMes || Math.round(ingresoMes * 0.15),
      gastoLibre: Math.max(0, ingresoMes - obligacionesMes - (ahorroDelMes || ingresoMes * 0.15)),
      deudasActivas: Math.max(1, Math.floor(Math.random() * 4) + 1),
    })
  }

  return meses
}
