"use client"

import { useEffect, useState } from "react"
import { Briefcase, Shuffle, Loader2, Info } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useToast } from "@/hooks/use-toast"
import { diasDeQuincenas, type TipoIngreso } from "@/lib/ingresos"
import type { IncomeFrequency } from "@/lib/types"

/**
 * "¿Cómo recibes tu plata?" — reemplaza a "Editar sueldo base".
 *
 * Tres casos: sueldo fijo mensual; sueldo fijo quincenal (iguales o con un
 * monto distinto en cada quincena); o ingresos variables, sin sueldo fijo,
 * donde la estimación mensual es opcional (sin ella se usa el promedio real).
 */
export function ConfigIngresoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { tipoIngreso, incomeFrequency, ingresoEstimado, quincenas, diasCobro, ingresoPromedio, configurarIngreso, formatAmount } = useAppContext()
  const { toast } = useToast()

  const [tipo, setTipo] = useState<TipoIngreso>("fijo")
  const [frecuencia, setFrecuencia] = useState<IncomeFrequency>("mensual")
  const [iguales, setIguales] = useState(true)
  const [mensual, setMensual] = useState("")
  const [q1, setQ1] = useState("")
  const [q2, setQ2] = useState("")
  const [dia1, setDia1] = useState("")
  const [dia2, setDia2] = useState("")
  const [guardando, setGuardando] = useState(false)

  // Al abrir: lo que tiene hoy
  useEffect(() => {
    if (!open) return
    const [d1, d2] = diasDeQuincenas(diasCobro)
    const distintas = (quincenas[0] ?? 0) > 0 && (quincenas[1] ?? 0) > 0 && quincenas[0] !== quincenas[1]
    setTipo(tipoIngreso)
    setFrecuencia(incomeFrequency)
    setIguales(!distintas)
    setMensual(ingresoEstimado > 0 ? String(incomeFrequency === "quincenal" && !distintas ? Math.round(ingresoEstimado / 2) : ingresoEstimado) : "")
    setQ1(distintas ? String(quincenas[0]) : "")
    setQ2(distintas ? String(quincenas[1]) : "")
    const dias = diasCobro.split(",").map(x => x.trim()).filter(Boolean)
    setDia1(dias[0] ?? String(d1))
    setDia2(dias[1] ?? (incomeFrequency === "quincenal" ? String(d2) : ""))
  }, [open, tipoIngreso, incomeFrequency, ingresoEstimado, quincenas, diasCobro])

  const d1 = Number(dia1), d2 = Number(dia2)
  const diasOk = tipo === "variable" || (d1 >= 1 && d1 <= 31 && (frecuencia === "mensual" || (d2 >= 1 && d2 <= 31 && d2 !== d1)))
  const [diaA, diaB] = [Math.min(d1 || 15, d2 || 30), Math.max(d1 || 15, d2 || 30)]
  const montosOk = tipo === "variable"
    || (frecuencia === "quincenal" && !iguales ? Number(q1) > 0 && Number(q2) > 0 : Number(mensual) > 0)
  const puedeGuardar = diasOk && montosOk && !guardando

  const guardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    const quincenal = tipo === "fijo" && frecuencia === "quincenal"
    // q1 es lo del primer día de pago del mes (el menor), q2 lo del segundo
    const [m1, m2] = [Number(q1), Number(q2)]
    await configurarIngreso({
      tipo,
      frecuencia: tipo === "variable" ? "mensual" : frecuencia,
      ingresoBase: tipo === "variable" ? Number(mensual) || 0 : quincenal && iguales ? Number(mensual) * 2 : quincenal ? m1 + m2 : Number(mensual),
      quincena1: quincenal && !iguales ? m1 : null,
      quincena2: quincenal && !iguales ? m2 : null,
      diasCobro: tipo === "variable" ? "1" : quincenal ? [d1, d2].sort((a, b) => a - b).join(",") : String(d1),
    })
    setGuardando(false)
    onOpenChange(false)
    toast({ title: "Listo, Kiri ya sabe cómo recibes tu plata ✓" })
  }

  const Opcion = ({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} className={cn("h-10 rounded-xl font-bold text-sm transition-colors",
      activo ? "bg-kiri-emerald text-white" : "border-2 border-muted text-muted-foreground")}>{children}</button>
  )

  return (
    <Dialog open={open} onOpenChange={v => { if (!guardando) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>¿Cómo recibes tu plata?</DialogTitle>
          <DialogDescription>Con esto Kiri calcula cuánto te entra en cada periodo y te sugiere cuánto ahorrar y gastar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "fijo", icon: Briefcase, t: "Sueldo fijo", d: "Me pagan en fechas fijas" },
              { v: "variable", icon: Shuffle, t: "Ingresos variables", d: "Independiente, ventas, comisiones" },
            ] as const).map(o => (
              <button key={o.v} type="button" onClick={() => setTipo(o.v)}
                className={cn("rounded-2xl border-2 p-3 text-left transition-colors",
                  tipo === o.v ? "border-kiri-emerald bg-kiri-emerald/5" : "border-muted hover:border-kiri-emerald/40")}>
                <o.icon className={cn("h-5 w-5 mb-1", tipo === o.v ? "text-kiri-emerald" : "text-muted-foreground")} />
                <p className="text-sm font-bold">{o.t}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{o.d}</p>
              </button>
            ))}
          </div>

          {tipo === "fijo" ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">¿Cada cuánto te pagan?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Opcion activo={frecuencia === "quincenal"} onClick={() => setFrecuencia("quincenal")}>Quincenal</Opcion>
                  <Opcion activo={frecuencia === "mensual"} onClick={() => setFrecuencia("mensual")}>Mensual</Opcion>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{frecuencia === "quincenal" ? "¿Qué días te pagan?" : "¿Qué día te pagan?"}</Label>
                <div className="flex gap-2">
                  <Input inputMode="numeric" value={dia1} onChange={e => setDia1(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder={frecuencia === "quincenal" ? "15" : "30"} className="h-11 text-center font-bold" aria-label="Primer día de pago" />
                  {frecuencia === "quincenal" && (
                    <Input inputMode="numeric" value={dia2} onChange={e => setDia2(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="30" className="h-11 text-center font-bold" aria-label="Segundo día de pago" />
                  )}
                </div>
              </div>
              {frecuencia === "quincenal" && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">¿Te pagan lo mismo las dos quincenas?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Opcion activo={iguales} onClick={() => setIguales(true)}>Sí, igual</Opcion>
                    <Opcion activo={!iguales} onClick={() => setIguales(false)}>No, cambia</Opcion>
                  </div>
                </div>
              )}
              {frecuencia === "quincenal" && !iguales ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold">Lo que te pagan el día {diaA}</Label>
                    <MoneyInput value={q1} onChange={setQ1} className="h-12 text-lg font-bold bg-muted/30 border-none rounded-xl" placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold">Lo que te pagan el día {diaB}</Label>
                    <MoneyInput value={q2} onChange={setQ2} className="h-12 text-lg font-bold bg-muted/30 border-none rounded-xl" placeholder="0" />
                  </div>
                  {Number(q1) > 0 && Number(q2) > 0 && (
                    <p className="col-span-2 text-[11px] text-muted-foreground">Al mes: <strong className="text-foreground">{formatAmount(Number(q1) + Number(q2))}</strong>. Cada quincena Kiri te sugiere lo que corresponde a esa fecha.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{frecuencia === "quincenal" ? "Lo que te pagan cada quincena" : "Tu sueldo del mes"}</Label>
                  <MoneyInput value={mensual} onChange={setMensual} className="h-14 text-2xl font-bold bg-muted/30 border-none rounded-2xl" placeholder="0" />
                  {frecuencia === "quincenal" && Number(mensual) > 0 && (
                    <p className="text-[11px] text-muted-foreground">Al mes: <strong className="text-foreground">{formatAmount(Number(mensual) * 2)}</strong></p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-xl bg-muted/40 p-3 flex gap-2 text-[11px] text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 text-kiri-emerald" />
                <p>Registra cada ingreso cuando te llegue (Registrar ingreso o por voz). Kiri aprende tu promedio y organiza tus gastos con lo que de verdad entra: no necesitas un sueldo fijo.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">¿Cuánto te entra en un mes normal? (opcional)</Label>
                <MoneyInput value={mensual} onChange={setMensual} className="h-14 text-2xl font-bold bg-muted/30 border-none rounded-2xl" placeholder="No lo sé" />
                <p className="text-[11px] text-muted-foreground">
                  {Number(mensual) > 0
                    ? "Kiri planea con esta estimación. Déjala vacía para usar tu promedio real."
                    : ingresoPromedio > 0
                      ? <>Sin estimación Kiri usa tu promedio real: <strong className="text-foreground">{formatAmount(ingresoPromedio)}</strong> al mes.</>
                      : "Sin estimación, Kiri usará tu promedio real apenas registres tus primeros ingresos."}
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={!puedeGuardar} className="bg-kiri-emerald text-white font-bold rounded-xl px-6 gap-2">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
