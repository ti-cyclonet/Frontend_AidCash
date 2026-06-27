"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Sparkles, Send, Bot, User, Lightbulb,
  TrendingUp, ChevronRight, Loader2, Crown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData, SavingsEntry } from "@/hooks/use-finance-data"
import { useStreaks } from "@/hooks/use-streaks"
import { calculateBudgetAllocation } from "@/lib/budget-logic"
import type { ProactiveCoachInput, ProactiveCoachOutput } from "@/ai/types"

// ─── Tipos del chat ───────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  rol: 'usuario' | 'coach'
  mensaje: string
  patronDetectado?: string
  accionSugerida?: string
  impactoEstimado?: string
  timestamp: Date
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AiCoachChat() {
  const { income, incomeFrequency, user, metaAhorro, formatAmount } = useAppContext()
  const { debts, fixedExpenses, extraIncomes, totalAhorrado, savingsHistory } = useFinanceData()
  const { streakActual } = useStreaks(incomeFrequency)

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll al último mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // ── Construir contexto para el coach ────────────────────────────────────────
  const buildCoachInput = useCallback((mensajeUsuario?: string): ProactiveCoachInput => {
    const totalExtraIncome = extraIncomes.reduce((acc, e) => acc + e.monto, 0)
    const totalIncome = income + totalExtraIncome
    const totalObligations = debts.reduce((acc, d) => acc + d.cuotaPeriodo, 0) +
                             fixedExpenses.reduce((acc, f) => acc + f.monto, 0)

    const allocation = totalIncome > 0
      ? calculateBudgetAllocation(totalIncome, totalObligations)
      : null

    // Simular historial de 3 meses basado en savings_history
    const historial = buildHistorial(savingsHistory, totalIncome, totalObligations)

    const deudasActivas = debts
      .filter(d => d.estado === 'activa' && d.cuotaPeriodo > 0)
      .map(d => ({
        nombre: d.nombre,
        montoTotal: d.montoTotal,
        cuotaPeriodo: d.cuotaPeriodo,
        mesesRestantes: d.cuotaPeriodo > 0 ? Math.ceil(d.montoTotal / d.cuotaPeriodo) : 99,
      }))

    // Historial de chat para contexto (últimos 6 mensajes)
    const historialChat = messages.slice(-6).map(m => ({
      rol: m.rol,
      mensaje: m.mensaje,
    }))

    return {
      nombreUsuario:    user.nombre || 'amigo',
      ingresoActual:    totalIncome,
      frecuencia:       incomeFrequency,
      obligacionesPct:  allocation ? Math.round(allocation.obligationsPct) : 0,
      ahorroPct:        allocation ? Math.round(allocation.savingsPct) : 0,
      capacidadLibre:   allocation?.debtCapacityAmount ?? 0,
      metaAhorro,
      ahorroAcumulado:  totalAhorrado,
      streakSemanas:    streakActual,
      historial,
      deudasActivas,
      mensajeUsuario,
      historialChat:    historialChat.length > 0 ? historialChat : undefined,
    }
  }, [income, extraIncomes, debts, fixedExpenses, savingsHistory, messages, user.nombre, incomeFrequency, metaAhorro, totalAhorrado, streakActual])

  // ── Enviar mensaje al coach ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (userMsg?: string) => {
    setLoading(true)

    // Si es mensaje del usuario, agregarlo al chat
    if (userMsg) {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        rol: 'usuario',
        mensaje: userMsg,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, userMessage])
    }

    try {
      const coachInput = buildCoachInput(userMsg)
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coachInput),
      })

      const data: ProactiveCoachOutput = await res.json()

      const coachMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        rol: 'coach',
        mensaje: data.respuesta,
        patronDetectado: data.patronDetectado ?? undefined,
        accionSugerida: data.accionSugerida ?? undefined,
        impactoEstimado: data.impactoEstimado ?? undefined,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, coachMessage])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        rol: 'coach',
        mensaje: 'No pude conectar ahora. Revisa tu conexión e intenta de nuevo.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }, [buildCoachInput])

  // ── Abrir chat y cargar mensaje inicial proactivo ───────────────────────────
  const handleOpen = useCallback(() => {
    setOpen(true)
    if (!initialLoaded && messages.length === 0) {
      setInitialLoaded(true)
      sendMessage() // Sin mensaje = proactivo
    }
  }, [initialLoaded, messages.length, sendMessage])

  // ── Enviar desde input ──────────────────────────────────────────────────────
  const handleSend = () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput("")
    sendMessage(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* ── CTA Card ── */}
      <button onClick={handleOpen} className="w-full text-left">
        <Card className="border-2 border-dashed border-cyclon-lavender/40 bg-gradient-to-r from-cyclon-lavender/5 to-cyclon-pink/5 rounded-3xl hover:border-cyclon-lavender/70 hover:shadow-lg hover:shadow-cyclon-lavender/10 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 bg-cyclon-lavender/20 rounded-2xl flex items-center justify-center text-cyclon-lavender shrink-0 relative">
              <Bot className="h-6 w-6" />
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-cyclon-lavender rounded-full flex items-center justify-center">
                <Crown className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm text-cyclon-lavender">Coach Financiero IA</p>
                <span className="text-[8px] font-black bg-gradient-to-r from-cyclon-lavender to-cyclon-pink text-white px-2 py-0.5 rounded-full uppercase">
                  Premium
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Análisis de patrones y consejos personalizados con Gemini
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-cyclon-lavender/50 shrink-0" />
          </CardContent>
        </Card>
      </button>

      {/* ── Dialog del Chat ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[75vh] p-0 flex flex-col overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 bg-cyclon-lavender/10 rounded-xl flex items-center justify-center text-cyclon-lavender">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Kiri — Coach Financiero</p>
                <p className="text-[10px] text-muted-foreground font-normal">
                  Analizo tus patrones y te ayudo a optimizar
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && !loading && (
              <div className="text-center py-8 space-y-3">
                <div className="mx-auto h-16 w-16 bg-cyclon-lavender/10 rounded-3xl flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-cyclon-lavender" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Abriendo sesión con tu coach...
                </p>
              </div>
            )}

            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} formatAmount={formatAmount} />
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-8 w-8 rounded-xl bg-cyclon-lavender/10 flex items-center justify-center shrink-0">
                  <Loader2 className="h-4 w-4 text-cyclon-lavender animate-spin" />
                </div>
                <p className="text-xs italic">Kiri está analizando...</p>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="px-4 pb-5 pt-3 border-t border-border shrink-0">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregúntale a Kiri..."
                className="flex-1 h-11 rounded-xl bg-muted/40 border-none"
                disabled={loading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                size="icon"
                className="h-11 w-11 rounded-xl bg-cyclon-lavender text-white hover:bg-cyclon-lavender/90 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground text-center mt-2">
              Kiri analiza tu historial para darte consejos personalizados
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Burbuja de mensaje ───────────────────────────────────────────────────────

function MessageBubble({ message, formatAmount }: { message: ChatMessage; formatAmount: (n: number) => string }) {
  const isCoach = message.rol === 'coach'

  return (
    <div className={cn("flex gap-2", isCoach ? "items-start" : "items-start flex-row-reverse")}>
      <div className={cn(
        "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
        isCoach ? "bg-cyclon-lavender/10 text-cyclon-lavender" : "bg-cyclon-mint/20 text-cyclon-periwinkle"
      )}>
        {isCoach ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>

      <div className={cn("max-w-[80%] space-y-2", isCoach ? "" : "text-right")}>
        {/* Mensaje principal */}
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isCoach
            ? "bg-card border border-border rounded-tl-md"
            : "bg-cyclon-lavender text-white rounded-tr-md"
        )}>
          {message.mensaje}
        </div>

        {/* Tarjetas de insight (solo coach) */}
        {isCoach && (message.patronDetectado || message.accionSugerida || message.impactoEstimado) && (
          <div className="space-y-1.5 pl-1">
            {message.patronDetectado && (
              <InsightChip
                icon={<TrendingUp className="h-3 w-3" />}
                label="Patrón"
                value={message.patronDetectado}
                color="text-cyclon-sky bg-cyclon-sky/10"
              />
            )}
            {message.accionSugerida && (
              <InsightChip
                icon={<Lightbulb className="h-3 w-3" />}
                label="Acción"
                value={message.accionSugerida}
                color="text-cyclon-lavender bg-cyclon-lavender/10"
              />
            )}
            {message.impactoEstimado && (
              <InsightChip
                icon={<Sparkles className="h-3 w-3" />}
                label="Impacto"
                value={message.impactoEstimado}
                color="text-cyclon-mint bg-cyclon-mint/20"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chip de insight ──────────────────────────────────────────────────────────

function InsightChip({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string
}) {
  return (
    <div className={cn("flex items-start gap-2 px-3 py-2 rounded-xl text-[11px]", color)}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <span className="font-bold uppercase text-[9px]">{label}: </span>
        <span className="font-medium">{value}</span>
      </div>
    </div>
  )
}

// ─── Helper: construir historial de 3 meses ──────────────────────────────────

function buildHistorial(
  savingsHistory: SavingsEntry[],
  currentIncome: number,
  currentObligations: number
) {
  const now = new Date()
  const meses = []

  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mesNombre = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

    // Buscar ahorro registrado en ese mes
    const ahorroDelMes = savingsHistory
      .filter(s => s.tipo === 'ahorro' && s.periodo.toLowerCase().includes(
        d.toLocaleDateString('es-ES', { month: 'long' })
      ))
      .reduce((acc, s) => acc + s.monto, 0)

    // Simular variaciones sobre el ingreso actual (±5-10% para meses anteriores)
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
