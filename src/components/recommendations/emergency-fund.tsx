"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ShieldCheck, TrendingUp, CalendarCheck, Plus, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { analyzeEmergencyFund, EmergencyFundAnalysis } from "@/lib/recommendations"

interface Props {
  totalGastosFijos: number
  fondoActual: number
  aporteMensual: number
  onAporte: (monto: number) => Promise<void>
  onRetiro: (monto: number) => Promise<void>
}

export function EmergencyFundSection({ totalGastosFijos, fondoActual, aporteMensual, onAporte, onRetiro }: Props) {
  const { formatAmount } = useAppContext()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'aporte' | 'retiro'>('aporte')
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)

  const analysis: EmergencyFundAnalysis = analyzeEmergencyFund(totalGastosFijos, fondoActual, aporteMensual)

  const openModal = (type: 'aporte' | 'retiro') => {
    setModalType(type)
    setAmount("")
    setModalOpen(true)
  }

  const handleConfirm = async () => {
    const parsed = Number(amount)
    if (!parsed || parsed <= 0) return
    setSaving(true)
    if (modalType === 'aporte') {
      await onAporte(parsed)
    } else {
      await onRetiro(parsed)
    }
    setSaving(false)
    setModalOpen(false)
    setAmount("")
  }

  return (
    <div className="space-y-6">
      {/* ── Card principal ── */}
      <Card className="border-none bg-gradient-to-br from-cyclon-sky/10 to-cyclon-periwinkle/5 rounded-3xl shadow-none overflow-hidden relative">
        <div className="absolute top-[-20px] right-[-20px] h-32 w-32 bg-white/20 rounded-full blur-2xl" />
        <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="h-20 w-20 bg-card rounded-3xl shadow-xl shadow-cyclon-sky/10 flex items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-cyclon-periwinkle" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm font-medium tracking-wide">FONDO DE EMERGENCIA</p>
            <h2 className="text-4xl font-black text-cyclon-periwinkle mt-1">{formatAmount(fondoActual)}</h2>
          </div>

          {/* Progreso dual: mínimo y ideal */}
          <div className="w-full space-y-3 pt-2">
            {/* Meta mínima: 3 meses */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground">Mínimo (3 meses): {formatAmount(analysis.metaMinima)}</span>
                <span className={cn(
                  analysis.pctMinima >= 100 ? "text-cyclon-periwinkle" : "text-muted-foreground"
                )}>
                  {analysis.pctMinima}%
                </span>
              </div>
              <Progress
                value={analysis.pctMinima}
                className="h-2 bg-white/50"
                indicatorClassName={analysis.pctMinima >= 100 ? "bg-cyclon-periwinkle" : "bg-cyclon-sky"}
              />
            </div>
            {/* Meta ideal: 6 meses */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground">Ideal (6 meses): {formatAmount(analysis.metaIdeal)}</span>
                <span className={cn(
                  analysis.pctIdeal >= 100 ? "text-cyclon-periwinkle" : "text-muted-foreground"
                )}>
                  {analysis.pctIdeal}%
                </span>
              </div>
              <Progress
                value={analysis.pctIdeal}
                className="h-2 bg-white/50"
                indicatorClassName={analysis.pctIdeal >= 100 ? "bg-cyclon-periwinkle" : "bg-cyclon-lavender"}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="h-8 w-8 rounded-lg bg-cyclon-sky/10 flex items-center justify-center text-cyclon-sky">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2">Meta mínima en</p>
            <p className="text-base font-black truncate">
              {analysis.pctMinima >= 100 ? "✓ Alcanzada" : `${analysis.mesesParaMinima} meses`}
            </p>
            {analysis.pctMinima < 100 && (
              <p className="text-[10px] text-muted-foreground capitalize">{analysis.fechaMinima}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="h-8 w-8 rounded-lg bg-cyclon-lavender/10 flex items-center justify-center text-cyclon-lavender">
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2">Meta ideal en</p>
            <p className="text-base font-black truncate">
              {analysis.pctIdeal >= 100 ? "✓ Alcanzada" : `${analysis.mesesParaIdeal} meses`}
            </p>
            {analysis.pctIdeal < 100 && (
              <p className="text-[10px] text-muted-foreground capitalize">{analysis.fechaIdeal}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Explicación ── */}
      <Card className="border-none bg-card shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">¿Qué es esto?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            El Fondo de Emergencia es un colchón financiero separado de tus metas de ahorro.
            Cubre entre <strong>3 y 6 meses</strong> de tus gastos fijos para que puedas enfrentar imprevistos
            sin tocar tus deudas ni tu inversión libre.
          </p>
          {totalGastosFijos === 0 && (
            <p className="text-xs text-cyclon-pink font-bold">
              ⚠ Agrega gastos fijos en la sección Deudas para calcular tu meta.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Botones de acción ── */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => openModal('aporte')}
          className="h-14 rounded-2xl bg-cyclon-periwinkle text-white font-bold hover:bg-cyclon-periwinkle/90 shadow-lg shadow-cyclon-periwinkle/20 gap-2"
        >
          <Plus className="h-5 w-5" /> Aportar
        </Button>
        <Button
          variant="outline"
          onClick={() => openModal('retiro')}
          disabled={fondoActual <= 0}
          className="h-14 rounded-2xl border-2 border-dashed font-bold gap-2"
        >
          <Minus className="h-5 w-5" /> Retirar
        </Button>
      </div>

      {/* ── Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent >
          <DialogHeader>
            <DialogTitle>
              {modalType === 'aporte' ? '💰 Aportar al Fondo' : '📤 Retirar del Fondo'}
            </DialogTitle>
            <DialogDescription>
              {modalType === 'aporte'
                ? 'Agrega dinero a tu colchón de emergencias.'
                : 'Retira dinero en caso de necesidad.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Monto</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder="0"
                  className="pl-10 h-14 text-2xl font-bold bg-muted/30 border-none rounded-2xl"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  autoFocus
                />
              </div>
              {modalType === 'retiro' && Number(amount) > fondoActual && (
                <p className="text-xs text-destructive pl-1">No puedes retirar más de lo que tienes.</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={
                saving ||
                !amount ||
                Number(amount) <= 0 ||
                (modalType === 'retiro' && Number(amount) > fondoActual)
              }
              className={cn(
                "font-bold rounded-xl px-8",
                modalType === 'aporte'
                  ? "bg-cyclon-periwinkle text-white"
                  : "bg-destructive text-white"
              )}
            >
              {saving ? "Guardando..." : modalType === 'aporte' ? "Aportar" : "Retirar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
