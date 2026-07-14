"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useToast } from "@/hooks/use-toast"

/**
 * PaydaySelector — Input libre para días de pago
 *
 * El usuario escribe directamente los días (ej: 14 y 29, o solo 30).
 * La app analiza el periodo automáticamente.
 */

interface Props {
  compact?: boolean
}

export function PaydaySelector({ compact }: Props) {
  const { incomeFrequency, diasCobro, setDiasCobro } = useAppContext()
  const { updateUserProfile } = useFinanceData()
  const { toast } = useToast()

  const currentDays = diasCobro ? diasCobro.split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d >= 1 && d <= 31) : []
  const maxDays = incomeFrequency === "quincenal" ? 2 : 1

  const [day1, setDay1] = useState(currentDays[0]?.toString() ?? "")
  const [day2, setDay2] = useState(currentDays[1]?.toString() ?? "")
  const [saving, setSaving] = useState(false)

  const parsedDays = [Number(day1), ...(maxDays === 2 ? [Number(day2)] : [])]
    .filter(d => d >= 1 && d <= 31)
    .sort((a, b) => a - b)

  const isValid = parsedDays.length === maxDays
  const hasChanged = parsedDays.join(",") !== currentDays.join(",")

  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)
    const diasStr = parsedDays.join(",")
    // Guardar en localStorage inmediatamente (funciona sin backend)
    setDiasCobro(diasStr)
    // Intentar guardar en backend (puede fallar si prisma client no está regenerado)
    try {
      await updateUserProfile({ diasPago: parsedDays })
    } catch { /* silencioso — se recupera del localStorage */ }
    setSaving(false)
    toast({ title: "Días de pago actualizados ✓" })
  }

  // Calcular periodo actual para mostrar al usuario
  const getPeriodLabel = () => {
    if (parsedDays.length === 0) return null
    const today = new Date().getDate()

    if (parsedDays.length === 1) {
      const d = parsedDays[0]
      return `Periodo actual: del ${d} al ${d - 1 === 0 ? 30 : d - 1} del siguiente mes`
    }

    // Quincenal: determinar en qué quincena estamos
    const [d1, d2] = parsedDays
    if (today >= d1 && today < d2) {
      // Estamos en el primer periodo (d1 hasta el día antes de d2)
      return `Periodo actual: del ${d1} al ${d2 - 1}`
    }
    // Estamos en el segundo periodo (d2 hasta el día antes de d1 del siguiente mes)
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    if (today >= d2) {
      return `Periodo actual: del ${d2} al ${d1 - 1 === 0 ? lastDay : d1 - 1}`
    }
    // today < d1 (inicio del mes, antes del primer día de pago)
    return `Periodo actual: del ${d2} al ${d1 - 1}`
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-kiri-emerald" />
        <p className="text-[10px] font-bold">¿Qué día{maxDays > 1 ? "s" : ""} te pagan?</p>
      </div>

      {/* Inputs para escribir los días */}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="1"
          max="31"
          placeholder="Día"
          value={day1}
          onChange={e => setDay1(e.target.value)}
          className="h-9 w-20 rounded-lg text-center text-sm font-bold"
        />
        {maxDays === 2 && (
          <>
            <span className="text-xs text-muted-foreground font-bold">y</span>
            <Input
              type="number"
              min="1"
              max="31"
              placeholder="Día"
              value={day2}
              onChange={e => setDay2(e.target.value)}
              className="h-9 w-20 rounded-lg text-center text-sm font-bold"
            />
          </>
        )}
        {hasChanged && isValid && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-9 rounded-lg bg-kiri-emerald text-white font-bold text-xs gap-1 px-3"
          >
            {saving ? "..." : <><Check className="h-3 w-3" /> Guardar</>}
          </Button>
        )}
      </div>

      {/* Info del periodo */}
      {isValid && (
        <p className="text-[9px] text-muted-foreground">
          {incomeFrequency === "quincenal"
            ? `Tu quincena cae los días ${parsedDays[0]} y ${parsedDays[1]} de cada mes`
            : `Tu sueldo cae el día ${parsedDays[0]} de cada mes`
          }
          {getPeriodLabel() && <span className="block text-kiri-emerald font-bold mt-0.5">{getPeriodLabel()}</span>}
        </p>
      )}
    </div>
  )
}
