"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  X, Send, Mic, MicOff, Loader2, Sparkles, CheckCircle2,
  AlertTriangle, ScanLine, Camera, Upload, Store, Calendar,
  DollarSign, Tag, Calculator,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { DebtSimulator } from "@/components/recommendations/debt-simulator"
import { getPeriodData } from "@/lib/period-filter"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import type { VoiceExtractOutput } from "@/app/api/ai/voice-extract/route"
import type { ReceiptScannerOutput } from "@/ai/flows/receipt-scanner-flow"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

// ─── Confirm panel para extracción de voz ────────────────────────────────────
function VoiceExtractConfirm({
  result, onConfirm, onCancel, formatAmount,
}: {
  result: VoiceExtractOutput
  onConfirm: () => void
  onCancel: () => void
  formatAmount: (n: number) => string
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-kiri-emerald/5 flex items-center gap-3">
        <div className="h-9 w-9 bg-kiri-emerald rounded-xl flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div><p className="text-sm font-bold">Kiri entendió esto</p><p className="text-[10px] text-muted-foreground">Confirma antes de guardar</p></div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="bg-kiri-mint/10 rounded-2xl p-3">
          <p className="text-xs text-foreground/85 leading-relaxed">{result.resumenKiri}</p>
          <span className={cn("mt-1.5 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full",
            result.confianza === "alta" ? "bg-kiri-emerald/20 text-kiri-emerald" :
            result.confianza === "media" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600")}>
            Confianza {result.confianza}
          </span>
        </div>
        {result.ingreso.monto && <ExtractItem icon="💰" label="Ingreso" value={`${formatAmount(result.ingreso.monto)} / ${result.ingreso.frecuencia ?? "mensual"}`} color="text-kiri-emerald" />}
        {result.deudas.map((d, i) => <ExtractItem key={i} icon="💳" label={`Deuda: ${d.nombre}`} value={`${formatAmount(d.monto)}${d.cuota ? ` · Cuota: ${formatAmount(d.cuota)}` : ""}${d.diaCorte ? ` · Día ${d.diaCorte}` : ""}`} color="text-cyclon-pink" />)}
        {result.gastosFijos.map((g, i) => <ExtractItem key={i} icon="📅" label={`Gasto fijo: ${g.nombre}`} value={`${formatAmount(g.monto)}${g.diaCorte ? ` · Día ${g.diaCorte}` : ""}`} color="text-cyclon-sky" />)}
        {result.gastosHormiga.map((h, i) => <ExtractItem key={i} icon="🐜" label={h.nombre} value={formatAmount(h.monto)} color="text-cyclon-pink" />)}
      </div>
      <div className="border-t border-border px-4 py-3 flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="flex-1 rounded-xl h-10 text-xs font-bold">Cancelar</Button>
        <Button size="sm" onClick={onConfirm} className="flex-1 rounded-xl h-10 bg-kiri-emerald text-white font-bold text-xs gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Guardar todo
        </Button>
      </div>
    </div>
  )
}

function ExtractItem({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-card rounded-xl p-3 shadow-sm">
      <span className="text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-muted-foreground truncate">{label}</p>
        <p className={cn("text-sm font-black truncate", color)}>{value}</p>
      </div>
    </div>
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
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

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

  const handleFabTouchStart = () => {
    // En móvil: tap simple abre el chat, no los satélites
    longPressTriggered.current = false
    if (!isMobile) {
      longPressTimer.current = setTimeout(() => {
        longPressTriggered.current = true
        setShowSatellites(true)
      }, 400)
    }
  }
  const handleFabTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    if (!longPressTriggered.current) setIsOpen(true)
  }

  // ── Modo voz inteligente ──────────────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState(false)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [extractResult, setExtractResult] = useState<VoiceExtractOutput | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)

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

  const { income, incomeFrequency, formatAmount, setIncome } = useAppContext()
  const { debts, fixedExpenses, extraIncomes, totalAhorrado, totalImpulseThisPeriod, addDebt, addFixedExpense, addImpulseExpense, refetch } = useFinanceData()

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
  const startListening = (onTranscript: (t: string) => void) => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SR) { alert("Tu navegador no soporta reconocimiento de voz"); return }
    const r = new (SR as new () => SpeechRecognition)()
    r.lang = "es-ES"; r.continuous = false; r.interimResults = false
    r.onresult = (e: SpeechRecognitionEvent) => { onTranscript(e.results[0][0].transcript); setIsListening(false) }
    r.onerror = () => setIsListening(false)
    r.onend = () => setIsListening(false)
    recognitionRef.current = r; r.start(); setIsListening(true)
  }

  const toggleVoice = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
    startListening(t => setInput(t))
  }

  // ── Satélite: Voz inteligente ─────────────────────────────────────────────
  const handleVoiceSatellite = () => {
    setShowSatellites(false)
    setVoiceModalOpen(true)
    setVoiceTranscript(""); setExtractResult(null); setExtractError(null)
    startListening(async t => {
      setVoiceTranscript(t); setExtracting(true); setExtractError(null)
      try {
        const res = await fetch("/api/ai/voice-extract", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcripcion: t }),
        })
        if (!res.ok) throw new Error("Error del servidor")
        setExtractResult(await res.json())
      } catch { setExtractError("No pude procesar el audio. Intenta de nuevo.") }
      finally { setExtracting(false) }
    })
  }

  const handleVoiceExtractStart = () => handleVoiceSatellite()

  const handleConfirmExtract = async () => {
    if (!extractResult) return
    try {
      if (extractResult.ingreso.monto) setIncome(extractResult.ingreso.monto)
      for (const d of extractResult.deudas)
        await addDebt({ nombre: d.nombre, montoTotal: d.monto, cuotaPeriodo: d.cuota ?? d.monto, fechaVencimiento: d.fechaVencimiento ?? new Date().toISOString().split("T")[0] })
      for (const g of extractResult.gastosFijos)
        await addFixedExpense({ nombre: g.nombre, monto: g.monto, fechaCorte: g.fechaCorte ?? new Date().toISOString().split("T")[0] })
      for (const h of extractResult.gastosHormiga)
        await addImpulseExpense({ nombre: h.nombre, monto: h.monto, categoria: h.categoria })
      refetch()
      setVoiceModalOpen(false); setExtractResult(null); setVoiceTranscript("")
    } catch { /* silent */ }
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
    try {
      if (scanResult.categoria === "gasto_fijo") await addFixedExpense({ nombre: scanResult.establecimiento, monto: scanResult.montoTotal, fechaCorte: scanResult.fecha })
      else if (scanResult.categoria === "deuda") await addDebt({ nombre: scanResult.establecimiento, montoTotal: scanResult.montoTotal, cuotaPeriodo: scanResult.montoTotal, fechaVencimiento: scanResult.fecha })
      else await addFixedExpense({ nombre: `${scanResult.establecimiento} (${scanResult.fecha})`, monto: scanResult.montoTotal, fechaCorte: scanResult.fecha })
      setScanModalOpen(false); resetScan()
    } catch { setScanError("No se pudo guardar. Intenta de nuevo.") }
    finally { setSavingScan(false) }
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() }
    setMessages(p => [...p, userMsg]); setInput(""); setLoading(true)
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: userMsg.content, ingresoMensual: income, frecuencia: incomeFrequency, totalDeudas: debts.reduce((a, d) => a + d.montoTotal, 0), totalGastosFijos: fixedExpenses.reduce((a, f) => a + f.monto, 0), ahorroAcumulado: totalAhorrado, gastosHormigaPeriodo: totalImpulseThisPeriod, historialConversacion: messages.slice(-6).map(m => ({ role: m.role, content: m.content })) }),
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
              onTouchStart={handleFabTouchStart}
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
      <Dialog open={voiceModalOpen} onOpenChange={v => { if (!v) { setVoiceModalOpen(false); setExtractResult(null); setVoiceTranscript("") } }}>
        <DialogContent>
          {extractResult ? (
            <VoiceExtractConfirm result={extractResult} formatAmount={formatAmount} onConfirm={handleConfirmExtract} onCancel={() => { setVoiceModalOpen(false); setExtractResult(null) }} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", isListening ? "bg-kiri-emerald/20 text-kiri-emerald animate-pulse" : "bg-muted/50 text-muted-foreground")}>
                    <Mic className="h-4 w-4" />
                  </div>
                  Dictado inteligente
                </DialogTitle>
                <DialogDescription>Habla y Kiri clasificará tus datos financieros automáticamente.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4 text-center">
                {isListening && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-kiri-emerald/20 flex items-center justify-center">
                      <Mic className="h-8 w-8 text-kiri-emerald animate-pulse" />
                    </div>
                    <p className="text-sm font-bold text-kiri-emerald">Escuchando...</p>
                    <p className="text-xs text-muted-foreground">Di algo como: "Gano 2000 al mes, pago 500 en luz el día 15"</p>
                  </div>
                )}
                {extracting && (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-kiri-emerald animate-spin" />
                    <p className="text-sm font-bold">Procesando...</p>
                    {voiceTranscript && <p className="text-xs text-muted-foreground italic">"{voiceTranscript}"</p>}
                  </div>
                )}
                {extractError && (
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                    <p className="text-sm text-destructive font-bold">{extractError}</p>
                    <Button size="sm" onClick={handleVoiceExtractStart} className="rounded-xl bg-kiri-emerald text-white">Intentar de nuevo</Button>
                  </div>
                )}
                {!isListening && !extracting && !extractError && !extractResult && (
                  <div className="flex flex-col items-center gap-3">
                    <button onClick={handleVoiceExtractStart} className="h-20 w-20 rounded-full bg-kiri-emerald/10 border-2 border-kiri-emerald/30 flex items-center justify-center hover:bg-kiri-emerald/20 transition-colors">
                      <Mic className="h-9 w-9 text-kiri-emerald" />
                    </button>
                    <p className="text-sm text-muted-foreground">Toca para hablar</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setVoiceModalOpen(false)} className="rounded-xl w-full">Cancelar</Button>
              </DialogFooter>
            </>
          )}
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
          "inset-0 lg:inset-auto lg:bottom-8 lg:right-8 lg:w-[400px] lg:h-[600px] lg:rounded-2xl"
        )}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-kiri-emerald/5">
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
