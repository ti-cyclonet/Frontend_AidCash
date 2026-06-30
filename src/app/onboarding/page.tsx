"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useAuth } from "@/lib/auth-context"
import { debtsApi, fixedExpensesApi } from "@/lib/api-client"
import {
  Wallet, ReceiptText, PiggyBank, Plus, Trash2,
  ChevronRight, SkipForward, Sparkles, AlertTriangle, Pencil, Mic, MicOff, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { VoiceExtractOutput } from "@/app/api/ai/voice-extract/route"

interface DebtDraft  { nombre: string; montoTotal: string; cuotaPeriodo: string; diasPago: string }
interface FixedDraft { nombre: string; monto: string; fechaCorte: string }

const STEPS = ["Bienvenida", "Ingresos", "Deudas", "Gastos Fijos"]

export default function OnboardingPage() {
  const router = useRouter()
  const { setIncome, setOnboardingDone, setUser, user, incomeFrequency } = useAppContext()
  const { addDebt, addFixedExpense, updateUserProfile } = useFinanceData()
  const { user: authUser } = useAuth()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Step 0 — nombre
  const [nombre, setNombre] = useState(user.nombre ?? "")

  // Step 1 — ingreso
  const [incomeValue, setIncomeValue] = useState("")
  const [incomeLocked, setIncomeLocked] = useState(false)

  // ── Micrófono inteligente en onboarding ───────────────────────────────────
  const [isListening, setIsListening] = useState(false)
  const [voiceExtracting, setVoiceExtracting] = useState(false)
  const [voiceResult, setVoiceResult] = useState<VoiceExtractOutput | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startVoiceOnboarding = () => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SR) { alert("Tu navegador no soporta reconocimiento de voz"); return }
    const r = new (SR as new () => SpeechRecognition)()
    r.lang = "es-ES"; r.continuous = false; r.interimResults = false
    r.onresult = async (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript
      setIsListening(false)
      setVoiceExtracting(true)
      try {
        const res = await fetch("/api/ai/voice-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcripcion: transcript }),
        })
        const data: VoiceExtractOutput = await res.json()
        setVoiceResult(data)
        // Auto-rellenar campos
        if (data.ingreso.monto) setIncomeValue(String(data.ingreso.monto))
        if (data.deudas.length > 0) {
          setDebts(data.deudas.map(d => ({
            nombre: d.nombre, montoTotal: String(d.monto),
            cuotaPeriodo: String(d.cuota ?? d.monto),
            diasPago: String(d.diaCorte ?? '1'),
          })))
        }
        if (data.gastosFijos.length > 0) {
          setFixed(data.gastosFijos.map(g => ({
            nombre: g.nombre, monto: String(g.monto),
            fechaCorte: g.fechaCorte ?? "",
          })))
        }
      } catch { /* silent */ }
      setVoiceExtracting(false)
    }
    r.onerror = () => setIsListening(false)
    r.onend = () => setIsListening(false)
    recognitionRef.current = r
    r.start()
    setIsListening(true)
  }

  // Step 2 — deudas
  const [debts, setDebts] = useState<DebtDraft[]>([
    { nombre: "", montoTotal: "", cuotaPeriodo: "", diasPago: "" },
  ])

  // Step 3 — gastos fijos
  const [fixed, setFixed] = useState<FixedDraft[]>([
    { nombre: "", monto: "", fechaCorte: "" },
  ])

  // ── Omitir ────────────────────────────────────────────────────────────────
  const handleSkip = async () => {
    // Marca onboarding como completado para que el middleware no vuelva a traer aquí
    await updateUserProfile({ onboarding_done: true })
    setOnboardingDone(true)
    router.replace("/dashboard")
  }

  // ── Finalizar ─────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true)
    setSaveError(null)

    const userId = authUser?.id
    if (!userId) {
      setSaveError("No se detectó sesión activa. Cierra sesión y vuelve a ingresar.")
      setSaving(false)
      return
    }

    try {
      const parsedIncome = Number(incomeValue) || 0

      // 1. Guardar perfil en el backend
      const { error: profileError } = await updateUserProfile({
        nombre:             nombre || undefined,
        ingreso_base:       parsedIncome,
        frecuencia_ingreso: incomeFrequency,
        onboarding_done:    true,
      })

      if (profileError) {
        setSaveError(`No se pudo guardar el perfil: ${profileError}`)
        setSaving(false)
        return
      }

      // 2. Sincroniza contexto local
      if (parsedIncome > 0) setIncome(parsedIncome)
      if (nombre) setUser({ ...user, nombre })
      setOnboardingDone(true)

      // 3. Guardar deudas vía API
      for (const d of debts) {
        if (!d.nombre || !d.montoTotal) continue
        await debtsApi.create({
          nombre:           d.nombre,
          montoTotal:       Number(d.montoTotal),
          cuotaPeriodo:     Number(d.cuotaPeriodo) || 0,
          diasPago:         d.diasPago || '1',
        })
      }

      // 4. Guardar gastos fijos vía API
      for (const f of fixed) {
        if (!f.nombre || !f.monto) continue
        await fixedExpensesApi.create({
          nombre:    f.nombre,
          monto:     Number(f.monto),
          fechaCorte: f.fechaCorte || new Date().toISOString().split('T')[0],
        })
      }

      router.replace("/dashboard")
    } catch (err) {
      console.error(err)
      setSaveError("Ocurrió un error inesperado. Intenta de nuevo.")
      setSaving(false)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addDebtRow    = () => setDebts(p => [...p, { nombre: "", montoTotal: "", cuotaPeriodo: "", diasPago: "" }])
  const removeDebtRow = (i: number) => setDebts(p => p.filter((_, idx) => idx !== i))
  const updateDebtRow = (i: number, field: keyof DebtDraft, val: string) =>
    setDebts(p => p.map((d, idx) => idx === i ? { ...d, [field]: val } : d))

  const addFixedRow    = () => setFixed(p => [...p, { nombre: "", monto: "", fechaCorte: "" }])
  const removeFixedRow = (i: number) => setFixed(p => p.filter((_, idx) => idx !== i))
  const updateFixedRow = (i: number, field: keyof FixedDraft, val: string) =>
    setFixed(p => p.map((f, idx) => idx === i ? { ...f, [field]: val } : f))

  const canNext = () => {
    if (step === 1) return !!incomeValue && Number(incomeValue) > 0
    return true
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-cyclon-lavender"
                  : i < step ? "w-2 bg-cyclon-lavender/40"
                  : "w-2 bg-muted"
              )}
            />
          ))}
        </div>
        <button
          onClick={handleSkip}
          className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Omitir
        </button>
      </div>

      {/* ── Contenido scrollable ── */}
      <div className="flex-1 overflow-y-auto px-6">

        {/* STEP 0: Bienvenida */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center gap-5 pt-6">
            <div className="h-24 w-24 bg-cyclon-lavender rounded-[2rem] rotate-12 shadow-2xl flex items-center justify-center">
              <div className="h-12 w-12 bg-white rounded-xl -rotate-12 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-cyclon-lavender" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-foreground">¡Bienvenido a Kiri!</h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                Configura tu perfil financiero en menos de 2 minutos.
              </p>
            </div>
            <div className="w-full space-y-2 pt-2 text-left">
              <Label>¿Cómo te llamas?</Label>
              <Input
                placeholder="Tu nombre"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>
        )}

        {/* STEP 1: Ingresos */}
        {step === 1 && (
          <div className="space-y-5 pt-4">
            <div className="space-y-1">
              <div className="h-10 w-10 bg-cyclon-lavender/10 rounded-xl flex items-center justify-center text-cyclon-lavender mb-3">
                <Wallet className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black">¿Cuánto ganas?</h2>
              <p className="text-muted-foreground text-sm">Ingresa tu sueldo o díselo a Kiri por voz.</p>
            </div>

            {/* ── Dos opciones: voz o manual ── */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startVoiceOnboarding}
                disabled={isListening || voiceExtracting}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-colors",
                  isListening
                    ? "border-kiri-emerald bg-kiri-emerald/10 text-kiri-emerald animate-pulse"
                    : "border-cyclon-lavender/40 bg-cyclon-lavender/5 text-cyclon-lavender hover:border-cyclon-lavender"
                )}
              >
                {voiceExtracting ? <Loader2 className="h-6 w-6 animate-spin" /> :
                  isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                <span className="text-xs font-bold">
                  {voiceExtracting ? "Procesando..." : isListening ? "Escuchando..." : "Dictar por voz"}
                </span>
                <span className="text-[9px] text-muted-foreground text-center">
                  "Gano 2000 al mes y pago 500 en luz el 15"
                </span>
              </button>
              <button
                onClick={() => setIncomeLocked(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-muted bg-muted/20 text-muted-foreground hover:border-cyclon-lavender/40 hover:text-cyclon-lavender transition-colors"
              >
                <Pencil className="h-6 w-6" />
                <span className="text-xs font-bold">Escribir manualmente</span>
                <span className="text-[9px] text-center">Ingresa los datos uno por uno</span>
              </button>
            </div>

            {/* Resultado de voz */}
            {voiceResult && (
              <div className="bg-kiri-emerald/5 rounded-2xl p-3 border border-kiri-emerald/20 space-y-1.5">
                <p className="text-xs font-bold text-kiri-emerald">✅ Kiri entendió:</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{voiceResult.resumenKiri}</p>
              </div>
            )}

            {/* Input manual */}
            <div className="space-y-2">
              <Label>Ingreso por periodo</Label>
              {incomeLocked ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-14 rounded-2xl bg-muted/30 flex items-center px-4">
                    <span className="text-2xl font-bold">${Number(incomeValue).toLocaleString()}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIncomeLocked(false)}
                    className="rounded-xl h-10 px-4 font-bold text-xs gap-1">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                </div>
              ) : (
                <MoneyInput value={incomeValue} onChange={v => setIncomeValue(v)}
                  className="h-14 text-2xl font-bold bg-muted/30 border-none rounded-2xl focus-visible:ring-cyclon-lavender"
                  placeholder="0" autoFocus />
              )}
            </div>
            {incomeValue && Number(incomeValue) > 0 && (
              <Card className="border-none bg-cyclon-lavender/5 rounded-2xl">
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Distribución 50/30/20</p>
                  {[
                    { label: "Necesidades", pct: 50, color: "bg-cyclon-periwinkle" },
                    { label: "Libre",       pct: 30, color: "bg-cyclon-sky" },
                    { label: "Ahorro",      pct: 20, color: "bg-cyclon-mint" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full", item.color)} />
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                      <span className="font-bold">${((Number(incomeValue) * item.pct) / 100).toLocaleString()}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* STEP 2: Deudas */}
        {step === 2 && (
          <div className="space-y-4 pt-4">
            <div className="space-y-1">
              <div className="h-10 w-10 bg-cyclon-pink/20 rounded-xl flex items-center justify-center text-cyclon-pink mb-3">
                <ReceiptText className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black">¿Tienes deudas?</h2>
              <p className="text-muted-foreground text-sm">Agrega tus compromisos. Puedes omitir.</p>
            </div>
            <div className="space-y-3">
              {debts.map((d, i) => (
                <Card key={i} className="border-none bg-muted/30 rounded-2xl">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Deuda {i + 1}</span>
                      {debts.length > 1 && (
                        <button onClick={() => removeDebtRow(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Input placeholder="Nombre (ej: TC Visa)" value={d.nombre} onChange={e => updateDebtRow(i, "nombre", e.target.value)} className="h-9 rounded-xl text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Monto total" value={d.montoTotal} onChange={e => updateDebtRow(i, "montoTotal", e.target.value)} className="h-9 rounded-xl text-sm" />
                      <Input type="number" placeholder="Cuota/periodo" value={d.cuotaPeriodo} onChange={e => updateDebtRow(i, "cuotaPeriodo", e.target.value)} className="h-9 rounded-xl text-sm" />
                    </div>
                    <Input type="date" value={d.diasPago} onChange={e => updateDebtRow(i, "diasPago", e.target.value)} className="h-9 rounded-xl text-sm" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button variant="outline" onClick={addDebtRow} className="w-full h-10 rounded-2xl border-dashed border-2 gap-2 font-bold text-sm">
              <Plus className="h-4 w-4" /> Agregar otra deuda
            </Button>
          </div>
        )}

        {/* STEP 3: Gastos Fijos */}
        {step === 3 && (
          <div className="space-y-4 pt-4">
            <div className="space-y-1">
              <div className="h-10 w-10 bg-cyclon-sky/20 rounded-xl flex items-center justify-center text-cyclon-sky mb-3">
                <PiggyBank className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black">Gastos fijos</h2>
              <p className="text-muted-foreground text-sm">Suscripciones, servicios, etc.</p>
            </div>
            <div className="space-y-3">
              {fixed.map((f, i) => (
                <Card key={i} className="border-none bg-muted/30 rounded-2xl">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Gasto {i + 1}</span>
                      {fixed.length > 1 && (
                        <button onClick={() => removeFixedRow(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Input placeholder="Nombre (ej: Netflix)" value={f.nombre} onChange={e => updateFixedRow(i, "nombre", e.target.value)} className="h-9 rounded-xl text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Monto mensual" value={f.monto} onChange={e => updateFixedRow(i, "monto", e.target.value)} className="h-9 rounded-xl text-sm" />
                      <Input type="date" value={f.fechaCorte} onChange={e => updateFixedRow(i, "fechaCorte", e.target.value)} className="h-9 rounded-xl text-sm" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button variant="outline" onClick={addFixedRow} className="w-full h-10 rounded-2xl border-dashed border-2 gap-2 font-bold text-sm">
              <Plus className="h-4 w-4" /> Agregar otro gasto
            </Button>
          </div>
        )}
      </div>

      {/* ── Footer fijo — SIEMPRE visible ── */}
      <div className="px-6 py-4 shrink-0 border-t border-border/50 bg-background space-y-2">
        {saveError && (
          <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-[11px] text-destructive">{saveError}</p>
          </div>
        )}

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => { if (step === 1) setIncomeLocked(true); setStep(s => s + 1) }}
            disabled={!canNext()}
            className="w-full h-12 rounded-2xl bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white font-bold text-sm shadow-lg shadow-cyclon-lavender/30 gap-2"
          >
            Continuar <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            disabled={saving}
            className="w-full h-12 rounded-2xl bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white font-bold text-sm shadow-lg shadow-cyclon-lavender/30 gap-2"
          >
            {saving ? "Guardando..." : "¡Listo, empezar! 🎉"}
          </Button>
        )}

        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Volver
          </button>
        )}
      </div>
    </div>
  )
}
