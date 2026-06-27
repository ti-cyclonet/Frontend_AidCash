"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Coffee, Plus, AlertTriangle, Trash2, ShoppingBag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useRouter } from "next/navigation"
import { ImpulseCategory } from "@/lib/types"

const CATEGORIES: { value: ImpulseCategory; label: string; emoji: string }[] = [
  { value: 'cafe',       label: 'Café',       emoji: '☕' },
  { value: 'comida',     label: 'Comida',     emoji: '🍔' },
  { value: 'transporte', label: 'Transporte', emoji: '🚕' },
  { value: 'antojo',     label: 'Antojo',     emoji: '🍫' },
  { value: 'salida',     label: 'Salida',     emoji: '🎉' },
  { value: 'otro',       label: 'Otro',       emoji: '💸' },
]

interface Props {
  /** Monto del gasto libre blindado según el presupuesto actual */
  dailyFreeAmount: number
}

export function ImpulseTracker({ dailyFreeAmount }: Props) {
  const router = useRouter()
  const { formatAmount } = useAppContext()
  const {
    impulseThisPeriod, totalImpulseThisPeriod,
    addImpulseExpense, removeImpulseExpense,
  } = useFinanceData()

  const [addOpen, setAddOpen] = useState(false)
  const [warningOpen, setWarningOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [monto, setMonto] = useState("")
  const [categoria, setCategoria] = useState<ImpulseCategory>('cafe')
  const [saving, setSaving] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  const remaining = Math.max(0, dailyFreeAmount - totalImpulseThisPeriod)
  const usagePct = dailyFreeAmount > 0
    ? Math.min(100, Math.round((totalImpulseThisPeriod / dailyFreeAmount) * 100))
    : 0
  const isOver = totalImpulseThisPeriod > dailyFreeAmount

  const handleAdd = async () => {
    if (!nombre || !monto || Number(monto) <= 0) return
    setSaving(true)
    const result = await addImpulseExpense({
      nombre,
      monto: Number(monto),
      categoria,
    })
    setSaving(false)
    setAddOpen(false)
    setNombre("")
    setMonto("")
    setCategoria('cafe')

    // Verifica si se pasó del presupuesto blindado
    if (result) {
      setLastAddedId(result.id)
      const newTotal = totalImpulseThisPeriod + Number(monto)
      if (newTotal > dailyFreeAmount) {
        setWarningOpen(true)
      }
    }
  }

  const handleCancel = async () => {
    // Revierte el último gasto
    if (lastAddedId) {
      await removeImpulseExpense(lastAddedId)
      setLastAddedId(null)
    }
    setWarningOpen(false)
  }

  const handleRedirect = () => {
    setWarningOpen(false)
    router.push('/obligaciones')
  }

  return (
    <>
      {/* ── Card principal de gastos hormiga ── */}
      <Card className={cn(
        "border-none shadow-sm rounded-3xl overflow-hidden",
        isOver ? "bg-red-500/5 ring-1 ring-red-500/20" : "bg-card"
      )}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0",
                isOver ? "bg-red-500/10 text-red-500" : "bg-cyclon-pink/10 text-cyclon-pink"
              )}>
                <Coffee className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Gastos Hormiga</h3>
                <p className="text-[10px] text-muted-foreground">Café, antojos, día a día</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="h-8 rounded-xl bg-cyclon-pink/10 text-cyclon-pink hover:bg-cyclon-pink/20 border-none font-bold gap-1 px-3"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar
            </Button>
          </div>

          {/* Barra de progreso */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold">
              <span className={isOver ? "text-red-500" : "text-muted-foreground"}>
                Gastado: {formatAmount(totalImpulseThisPeriod)}
              </span>
              <span className="text-muted-foreground">
                Libre: {formatAmount(remaining)}
              </span>
            </div>
            <Progress
              value={usagePct}
              className="h-2"
              indicatorClassName={cn(
                usagePct >= 100 ? "bg-red-500" : usagePct >= 75 ? "bg-yellow-500" : "bg-cyclon-pink"
              )}
            />
            <p className="text-[9px] text-muted-foreground text-right">
              de {formatAmount(dailyFreeAmount)} blindado
            </p>
          </div>

          {/* Lista de gastos recientes */}
          {impulseThisPeriod.length > 0 && (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {impulseThisPeriod.slice(0, 5).map(item => {
                const cat = CATEGORIES.find(c => c.value === item.categoria)
                return (
                  <div key={item.id} className="flex items-center gap-2 text-xs">
                    <span>{cat?.emoji ?? '💸'}</span>
                    <span className="flex-1 truncate text-muted-foreground">{item.nombre}</span>
                    <span className="font-bold shrink-0">{formatAmount(item.monto)}</span>
                    <button
                      onClick={() => removeImpulseExpense(item.id)}
                      className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
              {impulseThisPeriod.length > 5 && (
                <p className="text-[9px] text-muted-foreground text-center">
                  +{impulseThisPeriod.length - 5} más este periodo
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Modal: Agregar gasto hormiga ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-cyclon-pink" />
              Gasto hormiga
            </DialogTitle>
            <DialogDescription>¿En qué gastaste?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción</Label>
              <Input
                placeholder="Ej: Café en Starbucks"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="h-10 rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto</Label>
              <MoneyInput
                value={monto}
                onChange={v => setMonto(v)}
                className="h-12 text-lg font-bold rounded-xl"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Categoría</Label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategoria(cat.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-colors text-center",
                      categoria === cat.value
                        ? "border-cyclon-pink bg-cyclon-pink/5 text-cyclon-pink"
                        : "border-muted text-muted-foreground hover:border-cyclon-pink/30"
                    )}
                  >
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="text-[9px] font-bold">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Warning inline si ya está cerca del límite */}
            {dailyFreeAmount > 0 && Number(monto) > 0 && (totalImpulseThisPeriod + Number(monto)) > dailyFreeAmount * 0.8 && (
              <div className={cn(
                "flex items-start gap-2 p-2.5 rounded-xl text-xs",
                (totalImpulseThisPeriod + Number(monto)) > dailyFreeAmount
                  ? "bg-red-500/10 text-red-500"
                  : "bg-yellow-500/10 text-yellow-600"
              )}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {(totalImpulseThisPeriod + Number(monto)) > dailyFreeAmount
                    ? "Este gasto excede tu presupuesto blindado."
                    : "Estás usando más del 80% de tu gasto libre."}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAdd}
              disabled={saving || !nombre || !monto || Number(monto) <= 0}
              className="bg-cyclon-pink text-white font-bold rounded-xl px-6"
            >
              {saving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Advertencia de presupuesto excedido ── */}
      <Dialog open={warningOpen} onOpenChange={v => !v && setWarningOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Te pasaste del presupuesto blindado
            </DialogTitle>
            <DialogDescription>
              Tus gastos hormiga superaron el monto asignado para tu día a día. ¿Tuviste que endeudarte para cubrir este gasto?
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <Card className="border-none bg-red-500/5 rounded-2xl">
              <CardContent className="p-4 space-y-2 text-center">
                <p className="text-xs text-muted-foreground">Presupuesto blindado</p>
                <p className="text-lg font-black">{formatAmount(dailyFreeAmount)}</p>
                <p className="text-xs text-red-500 font-bold">
                  Gastaste: {formatAmount(totalImpulseThisPeriod)} (+{formatAmount(totalImpulseThisPeriod - dailyFreeAmount)} extra)
                </p>
              </CardContent>
            </Card>
          </div>
          <DialogFooter className="flex flex-col gap-2 pt-2">
            <Button
              onClick={handleRedirect}
              className="w-full bg-cyclon-periwinkle text-white font-bold rounded-xl h-12"
            >
              Registrar nueva obligación
            </Button>
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="w-full text-muted-foreground"
            >
              Cancelar (eliminar último gasto)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
