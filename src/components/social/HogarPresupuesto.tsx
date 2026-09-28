"use client"

import { useCallback, useEffect, useState } from "react"
import { Heart, Plus, Pencil, Trash2, ReceiptText, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useSocket, SOCKET_EVENTS } from "@/lib/socket-context"
import { useToast } from "@/hooks/use-toast"
import { hogarApi, type HogarCategoria, type HogarResumen } from "@/lib/api-client"

/**
 * Presupuesto del hogar — categorías compartidas en pareja.
 *
 * Cada uno registra sus gastos (salen de su propia billetera) y los marca con
 * una categoría del hogar; el tope es compartido y por mes o por quincena
 * (lo cambia cualquiera de los dos, desde el selector). A la pareja le
 * llega el aviso de cada gasto, y a los dos al cruzar el 80% y el 100%.
 * También se puede elegir la categoría al registrar un gasto en Obligaciones.
 */

const SUGERIDAS = [
  { nombre: "Comida", icono: "🍽️", color: "#10b981" },
  { nombre: "Mercado", icono: "🛒", color: "#22c55e" },
  { nombre: "Salidas", icono: "🎉", color: "#8b5cf6" },
  { nombre: "Viajes", icono: "✈️", color: "#0ea5e9" },
  { nombre: "Renta", icono: "🏠", color: "#f97316" },
  { nombre: "Servicios", icono: "💡", color: "#eab308" },
]
const ICONOS = ["🍽️", "🛒", "🎉", "✈️", "🏠", "💡", "🚗", "🐶", "👶", "🎁", "💊", "📺"]
const COLORES = ["#10b981", "#22c55e", "#8b5cf6", "#0ea5e9", "#f97316", "#eab308", "#ec4899", "#ef4444"]

type Form = { id?: string; nombre: string; icono: string; color: string; monto: string }
const vacio = (): Form => ({ nombre: "", icono: "🏠", color: "#10b981", monto: "" })

export function HogarPresupuesto() {
  const { formatAmount } = useAppContext()
  const { addImpulseExpense } = useFinanceData()
  const { socket } = useSocket()
  const { toast } = useToast()
  const [data, setData] = useState<HogarResumen | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [gastoCat, setGastoCat] = useState<HogarCategoria | null>(null)
  const [gasto, setGasto] = useState({ nombre: "", monto: "" })
  // Cambio de periodo pendiente de confirmar (mensual ⇄ quincenal)
  const [nuevoPeriodo, setNuevoPeriodo] = useState<"mensual" | "quincenal" | null>(null)

  const cargar = useCallback(async () => {
    const { data: r } = await hogarApi.resumen()
    if (r) setData(r)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  // Se actualiza en vivo cuando la pareja registra un gasto o crea una categoría
  useEffect(() => {
    const refrescar = () => cargar()
    window.addEventListener("kiri:hogar-updated", refrescar)
    socket?.on(SOCKET_EVENTS.HOGAR_GASTO, refrescar)
    return () => {
      window.removeEventListener("kiri:hogar-updated", refrescar)
      socket?.off(SOCKET_EVENTS.HOGAR_GASTO, refrescar)
    }
  }, [socket, cargar])

  if (!data) {
    return <Card className="border-none bg-card shadow-sm rounded-2xl"><CardContent className="p-6"><div className="h-24 animate-pulse bg-muted/20 rounded-xl" /></CardContent></Card>
  }
  if (!data.conectado) return null

  const pareja = data.pareja?.nombre.split(" ")[0] ?? "tu pareja"
  const cats = data.categorias ?? []
  const total = data.total ?? { limite: 0, gastado: 0 }
  const pctTotal = total.limite > 0 ? Math.min(100, Math.round((total.gastado / total.limite) * 100)) : 0
  const quincenal = data.periodo === "quincenal"
  const porPeriodo = quincenal ? "por quincena" : "al mes"
  const estePeriodo = quincenal ? "esta quincena" : "este mes"

  const guardar = async () => {
    if (!form || !form.nombre.trim() || !(Number(form.monto) >= 0)) return
    setGuardando(true)
    const body = { nombre: form.nombre.trim(), icono: form.icono, color: form.color, montoLimite: Number(form.monto) || 0 }
    const { error } = form.id ? await hogarApi.actualizar(form.id, body) : await hogarApi.crear(body)
    setGuardando(false)
    if (error) { toast({ title: error, variant: "destructive" }); return }
    if (!form.id) toast({ title: `${form.icono} ${form.nombre} creada`, description: `Le avisamos a ${pareja}.` })
    setForm(null)
    cargar()
  }

  const eliminar = async () => {
    if (!form?.id) return
    setGuardando(true)
    await hogarApi.eliminar(form.id)
    setGuardando(false)
    setForm(null)
    cargar()
  }

  const cambiarPeriodo = async (convertirTopes: boolean) => {
    if (!nuevoPeriodo) return
    setGuardando(true)
    const { error } = await hogarApi.cambiarPeriodo(nuevoPeriodo, convertirTopes)
    setGuardando(false)
    if (error) { toast({ title: error, variant: "destructive" }); return }
    toast({ title: nuevoPeriodo === "quincenal" ? "🗓️ Ahora el presupuesto es por quincena" : "🗓️ Ahora el presupuesto es mensual", description: `Le avisamos a ${pareja}.` })
    setNuevoPeriodo(null)
    cargar()
  }

  const registrarGasto = async () => {
    if (!gastoCat || !gasto.nombre.trim() || !(Number(gasto.monto) > 0)) return
    setGuardando(true)
    const r = await addImpulseExpense({ nombre: gasto.nombre.trim(), monto: Number(gasto.monto), categoria: "otro", sharedCategoryId: gastoCat.id })
    setGuardando(false)
    if (!r) { toast({ title: "No se pudo registrar el gasto", variant: "destructive" }); return }
    setGastoCat(null)
    setGasto({ nombre: "", monto: "" })
    cargar()
  }

  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5"><Heart className="h-4 w-4 text-pink-500" /> Presupuesto del hogar</h3>
            <p className="text-[11px] text-muted-foreground">Con {pareja} · {data.etiquetaPeriodo}</p>
            {/* Mensual ⇄ quincenal: lo puede cambiar cualquiera de los dos */}
            <div className="mt-2 inline-flex rounded-lg bg-muted/50 p-0.5 text-[10px] font-bold">
              {(["mensual", "quincenal"] as const).map(p => (
                <button key={p} type="button"
                  onClick={() => { if ((data.periodo ?? "mensual") !== p) setNuevoPeriodo(p) }}
                  className={cn("px-2.5 py-1 rounded-md capitalize transition-colors",
                    (data.periodo ?? "mensual") === p ? "bg-background shadow-sm text-pink-600 dark:text-pink-400" : "text-muted-foreground hover:text-foreground")}
                >{p}</button>
              ))}
            </div>
          </div>
          <Button size="sm" onClick={() => setForm(vacio())} className="h-8 rounded-xl gap-1 text-xs font-bold bg-pink-500 hover:bg-pink-600 text-white">
            <Plus className="h-3.5 w-3.5" /> Categoría
          </Button>
        </div>

        {cats.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Definan cuánto van a destinar {porPeriodo} para las cosas del hogar. Empiecen con una:</p>
            <div className="flex flex-wrap gap-2">
              {SUGERIDAS.map(s => (
                <button key={s.nombre} onClick={() => setForm({ ...vacio(), ...s })}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold hover:border-pink-500/50 hover:bg-pink-500/5">
                  {s.icono} {s.nombre}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Total del periodo */}
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Llevan</span>
                <span><strong>{formatAmount(total.gastado)}</strong> <span className="text-muted-foreground">de {formatAmount(total.limite)}</span></span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div className={cn("h-full rounded-full", pctTotal >= 100 ? "bg-red-500" : pctTotal >= 80 ? "bg-amber-500" : "bg-pink-500")} style={{ width: `${pctTotal}%` }} />
              </div>
            </div>

            {/* Categorías */}
            <div className="space-y-3">
              {cats.map(c => {
                const ancho = (v: number) => c.montoLimite > 0 ? Math.min(100, (v / c.montoLimite) * 100) : 0
                return (
                  <div key={c.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg shrink-0">{c.icono}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold leading-tight break-words">{c.nombre}</p>
                        <p className={cn("text-[10px]", c.porcentaje >= 100 ? "text-red-500 font-bold" : "text-muted-foreground")}>
                          {formatAmount(c.gastado)} de {formatAmount(c.montoLimite)} · {c.porcentaje >= 100 ? `se pasaron por ${formatAmount(c.gastado - c.montoLimite)}` : `quedan ${formatAmount(c.disponible)}`}
                        </p>
                      </div>
                      <button onClick={() => setForm({ id: c.id, nombre: c.nombre, icono: c.icono, color: c.color, monto: String(c.montoLimite) })}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted" aria-label={`Editar ${c.nombre}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <Button size="sm" variant="ghost" onClick={() => { setGastoCat(c); setGasto({ nombre: "", monto: "" }) }}
                        className="h-7 px-2 rounded-lg gap-1 text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:bg-pink-500/10">
                        <ReceiptText className="h-3 w-3" /> Gasto
                      </Button>
                    </div>
                    {/* Barra: lo tuyo + lo de tu pareja, sobre el tope */}
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex">
                      <div className="h-full" style={{ width: `${ancho(c.gastadoYo)}%`, background: c.color }} />
                      <div className="h-full opacity-50" style={{ width: `${Math.max(0, Math.min(100 - ancho(c.gastadoYo), ancho(c.gastadoPareja)))}%`, background: c.color }} />
                    </div>
                    {(c.gastadoYo > 0 || c.gastadoPareja > 0) && (
                      <p className="text-[9px] text-muted-foreground">Tú {formatAmount(c.gastadoYo)} · {pareja} {formatAmount(c.gastadoPareja)}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Últimos gastos del hogar */}
            {(data.recientes ?? []).length > 0 && (
              <div className="pt-2 border-t border-border/50 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Últimos gastos</p>
                {(data.recientes ?? []).slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-[11px]">
                    <span className="truncate"><strong>{r.quien === "yo" ? "Tú" : pareja}</strong> · {r.nombre} <span className="text-muted-foreground">· {r.categoria}</span></span>
                    <span className="font-bold shrink-0 pl-2">{formatAmount(r.monto)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Crear / editar categoría */}
      <Dialog open={!!form} onOpenChange={v => { if (!v) setForm(null) }}>
        <DialogContent className="sm:max-w-sm [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar categoría del hogar" : "Nueva categoría del hogar"}</DialogTitle>
            <DialogDescription>Presupuesto {quincenal ? "quincenal" : "mensual"} compartido con {pareja}.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Nombre</Label>
                <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Comida, Salidas, Viajes…" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">¿Cuánto van a destinar {porPeriodo}?</Label>
                <MoneyInput value={form.monto} onChange={v => setForm({ ...form, monto: v })} className="h-11 text-lg font-bold rounded-xl" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Ícono</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ICONOS.map(i => (
                    <button key={i} type="button" onClick={() => setForm({ ...form, icono: i })}
                      className={cn("h-9 w-9 rounded-xl border text-lg", form.icono === i ? "border-pink-500 bg-pink-500/10" : "border-border")}>{i}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {COLORES.map(c => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} aria-label={`Color ${c}`}
                    className={cn("h-7 w-7 rounded-full border-2", form.color === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                {form.id && (
                  <Button variant="ghost" onClick={eliminar} disabled={guardando} className="rounded-xl text-destructive hover:text-destructive gap-1 text-xs">
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                )}
                <Button onClick={guardar} disabled={guardando || !form.nombre.trim() || !form.monto} className="flex-1 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold">
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? "Guardar" : "Crear"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar el cambio de periodo */}
      <Dialog open={!!nuevoPeriodo} onOpenChange={v => { if (!v) setNuevoPeriodo(null) }}>
        <DialogContent className="sm:max-w-sm [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>🗓️ Presupuesto {nuevoPeriodo === "quincenal" ? "por quincena" : "mensual"}</DialogTitle>
            <DialogDescription>
              {nuevoPeriodo === "quincenal"
                ? "Cada tope se cuenta del 1 al 15 y del 16 a fin de mes. Lo gastado vuelve a cero al empezar cada quincena."
                : "Cada tope se cuenta de todo el mes."} Le avisamos a {pareja}.
            </DialogDescription>
          </DialogHeader>
          {cats.length > 0 && (
            <div className="rounded-xl bg-muted/40 p-3 space-y-1 text-[11px]">
              {cats.slice(0, 4).map(c => (
                <div key={c.id} className="flex justify-between gap-2">
                  <span className="truncate">{c.icono} {c.nombre}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatAmount(c.montoLimite)} → <strong className="text-foreground">{formatAmount(Math.round(c.montoLimite * (nuevoPeriodo === "quincenal" ? 0.5 : 2)))}</strong>
                  </span>
                </div>
              ))}
              {cats.length > 4 && <p className="text-muted-foreground">y {cats.length - 4} más</p>}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={() => cambiarPeriodo(true)} disabled={guardando} className="w-full rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : cats.length > 0 ? (nuevoPeriodo === "quincenal" ? "Cambiar y dividir los topes" : "Cambiar y duplicar los topes") : "Cambiar"}
            </Button>
            {cats.length > 0 && (
              <Button variant="ghost" onClick={() => cambiarPeriodo(false)} disabled={guardando} className="w-full rounded-xl text-xs">
                Cambiar sin tocar los montos
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Registrar un gasto del hogar */}
      <Dialog open={!!gastoCat} onOpenChange={v => { if (!v) setGastoCat(null) }}>
        <DialogContent className="sm:max-w-sm [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>{gastoCat?.icono} Gasto en {gastoCat?.nombre}</DialogTitle>
            <DialogDescription>Sale de tu billetera y suma al presupuesto del hogar. Le avisamos a {pareja}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción</Label>
              <Input value={gasto.nombre} onChange={e => setGasto(g => ({ ...g, nombre: e.target.value }))} placeholder="Ej: Mercado de la semana" className="h-10 rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto</Label>
              <MoneyInput value={gasto.monto} onChange={v => setGasto(g => ({ ...g, monto: v }))} className="h-11 text-lg font-bold rounded-xl" placeholder="0" />
              {gastoCat && <p className="text-[10px] text-muted-foreground">Quedan {formatAmount(gastoCat.disponible)} de {formatAmount(gastoCat.montoLimite)} {estePeriodo}.</p>}
            </div>
            <Button onClick={registrarGasto} disabled={guardando || !gasto.nombre.trim() || !(Number(gasto.monto) > 0)} className="w-full rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar gasto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
