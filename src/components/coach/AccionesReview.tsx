"use client"

import { useState } from "react"
import { X, AlertCircle, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { useAppContext } from "@/lib/app-context"
import { useFinanceData } from "@/hooks/use-finance-data"
import { DESTINOS, etiquetaTipo, faltantes, type Accion, type Destinos, type TipoAccion } from "@/lib/kiri-acciones"
import { tr } from "@/lib/i18n"

/**
 * Tarjetas editables de lo que Kiri propone registrar (chat, voz o recibo).
 * Cada una deja cambiar a dónde va el monto, el nombre, el valor y el
 * destino concreto (categoría, obligación, bolsillo, persona…). Si la IA
 * leyó un valor pero no entendió a qué corresponde, la tarjeta pide elegirlo.
 */

const ICONOS_CAT: Record<string, string> = {
  utensils: "🍽️", car: "🚗", gamepad: "🎮", dumbbell: "🏋️", heart: "❤️", shopping: "🛍️", wifi: "📶",
  education: "🎓", paw: "🐾", home: "🏠", baby: "👶", plane: "✈️", gift: "🎁", tools: "🔧", more: "🏷️",
}

export function AccionesReview({ acciones, destinos, onChange, onRemove, errores, compacto }: {
  acciones: Accion[]
  destinos: Destinos
  onChange: (id: string, patch: Partial<Accion>) => void
  onRemove: (id: string) => void
  errores?: Record<string, string>
  compacto?: boolean
}) {
  if (acciones.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">{tr("No quedó nada por guardar.")}</p>
  }
  return (
    <div className="space-y-2">
      {acciones.map(a => (
        <AccionCard key={a.id} accion={a} destinos={destinos} error={errores?.[a.id]} compacto={compacto}
          onChange={patch => onChange(a.id, patch)} onRemove={() => onRemove(a.id)} />
      ))}
    </div>
  )
}

function AccionCard({ accion: a, destinos, onChange, onRemove, error, compacto }: {
  accion: Accion
  destinos: Destinos
  onChange: (patch: Partial<Accion>) => void
  onRemove: () => void
  error?: string
  compacto?: boolean
}) {
  const { formatAmount } = useAppContext()
  const { debts, fixedExpenses } = useFinanceData()
  const [eligiendo, setEligiendo] = useState(a.tipo === "sin_destino")
  const meta = etiquetaTipo(a.tipo)
  const falta = faltantes(a)

  const cambiarTipo = (tipo: TipoAccion) => {
    setEligiendo(false)
    const patch: Partial<Accion> = { tipo }
    // Nombre por defecto si venía vacío (ej. recibo sin nombre claro)
    if (!a.nombre.trim()) patch.nombre = tipo === "gasto" ? "Gasto" : tipo === "ingreso" ? "Ingreso" : ""
    if (tipo === "ingreso" && !a.tipoIngreso) patch.tipoIngreso = "extra"
    if (tipo === "ahorro" && !a.bolsilloId && destinos.bolsillos.length === 1) patch.bolsilloId = destinos.bolsillos[0].id
    onChange(patch)
  }

  const elegirObligacion = (valor: string) => {
    const [tipo, id] = valor.split(":")
    if (!id) { onChange({ obligacionId: null, obligacionTipo: null }); return }
    const d = tipo === "deuda" ? debts.find(x => x.id === id) : null
    const f = tipo === "fijo" ? fixedExpenses.find(x => x.id === id) : null
    const cuota = d ? d.cuotaPeriodo : f ? (f.frecuencia === "quincenal" ? Math.round(f.monto / 2) : f.monto) : 0
    onChange({
      obligacionId: id, obligacionTipo: tipo as "deuda" | "fijo",
      nombre: d?.nombre ?? f?.nombre ?? a.nombre,
      monto: a.monto > 0 ? a.monto : cuota,
    })
  }

  return (
    <div className={cn("bg-card border rounded-2xl p-3 space-y-2", falta.length > 0 || error ? "border-amber-400/60" : "border-border")}>
      {/* Tipo (a dónde va) */}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setEligiendo(v => !v)}
          className={cn("flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors",
            a.tipo === "sin_destino" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted/60 hover:bg-muted")}>
          <span>{meta.emoji}</span> {meta.label} <ChevronDown className={cn("h-3 w-3 transition-transform", eligiendo && "rotate-180")} />
        </button>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label={tr("Quitar")}><X className="h-3.5 w-3.5" /></button>
      </div>

      {eligiendo && (
        <div className="grid grid-cols-2 gap-1.5">
          {DESTINOS.map(d => (
            <button key={d.tipo} type="button" onClick={() => cambiarTipo(d.tipo)}
              className={cn("text-left px-2 py-1.5 rounded-lg border text-[10px] leading-tight transition-colors",
                a.tipo === d.tipo ? "border-kiri-emerald bg-kiri-emerald/10" : "border-border hover:border-kiri-emerald/40")}>
              <span className="font-bold block">{d.emoji} {d.label}</span>
              {!compacto && <span className="text-muted-foreground">{d.ayuda}</span>}
            </button>
          ))}
        </div>
      )}

      {a.tipo === "sin_destino" && !eligiendo && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">{tr("Leí {0} pero no sé a qué corresponde: toca arriba y elige a dónde va.", [formatAmount(a.monto)])}</p>
      )}

      {/* Nombre + monto */}
      {a.tipo !== "sin_destino" && (
        <div className="flex gap-2">
          <Input value={a.nombre} onChange={e => onChange({ nombre: e.target.value })}
            placeholder={a.tipo === "me_deben" ? tr("Concepto (opcional)") : tr("Nombre")} className="flex-1 min-w-0 h-8 text-xs rounded-lg" />
          <MoneyInput showCurrency={false} value={a.monto ? String(a.monto) : ""} onChange={v => onChange({ monto: Number(v) || 0 })} className="w-28 shrink-0 h-8 text-xs rounded-lg" placeholder="$0" />
        </div>
      )}
      {a.tipo === "sin_destino" && (
        <MoneyInput showCurrency={false} value={a.monto ? String(a.monto) : ""} onChange={v => onChange({ monto: Number(v) || 0 })} className="h-8 text-xs rounded-lg" placeholder="$0" />
      )}

      {/* Detalles según el tipo */}
      {a.tipo === "gasto" && (
        <div className="space-y-1.5">
          <Chips
            label={tr("Categoría")}
            opciones={[
              ...destinos.categorias.map(c => ({ id: c.id, label: `${ICONOS_CAT[c.icono] ?? "🏷️"} ${c.nombre}` })),
              ...(a.categoriaNueva ? [{ id: "__nueva", label: tr("✨ {0} (nueva)", [a.categoriaNueva]) }] : []),
            ]}
            valor={a.categoriaNueva ? "__nueva" : a.categoriaId ?? null}
            onElegir={id => onChange(id === "__nueva" ? {} : { categoriaId: id, categoriaNueva: null })}
            vacio={tr("Sin categoría")}
          />
          {destinos.hogar && destinos.hogar.categorias.length > 0 && (
            <Chips
              label={tr("Del hogar (con {0})", [destinos.hogar.pareja])}
              opciones={destinos.hogar.categorias.map(c => ({ id: c.id, label: `${c.icono} ${c.nombre}` }))}
              valor={a.hogarCategoriaId ?? null}
              onElegir={id => onChange({ hogarCategoriaId: id })}
              vacio={tr("No")}
              rosa
            />
          )}
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={a.esHormiga === true} onChange={e => onChange({ esHormiga: e.target.checked })} className="accent-kiri-emerald" />{tr("Es gasto hormiga 🐜")}{" "}{a.esHormiga == null && <span className="opacity-70">{tr("(si no marcas, Kiri decide)")}</span>}
          </label>
        </div>
      )}

      {a.tipo === "ingreso" && (
        <Chips label={tr("Tipo")} opciones={[{ id: "salario", label: tr("💼 Mi sueldo") }, { id: "extra", label: tr("✨ Ingreso extra") }]}
          valor={a.tipoIngreso ?? "extra"} onElegir={id => onChange({ tipoIngreso: (id ?? "extra") as "salario" | "extra" })} />
      )}

      {a.tipo === "pago_obligacion" && (
        <div className="space-y-1.5">
          <Select label={tr("¿Qué pagaste?")} value={a.obligacionId ? `${a.obligacionTipo}:${a.obligacionId}` : ""} onChange={elegirObligacion}
            opciones={[
              ...debts.filter(d => d.estado !== "saldada").map(d => ({ v: `deuda:${d.id}`, t: tr("💳 {0} · cuota {1}", [d.nombre, formatAmount(d.cuotaPeriodo)]) })),
              ...fixedExpenses.map(f => ({ v: `fijo:${f.id}`, t: `📅 ${f.nombre} · ${formatAmount(f.monto)}` })),
            ]} />
          {/* Recibos de servicios, cuotas con seguro, etc. cambian de valor: si
              el recibo trae menos que la cuota registrada, el usuario decide si
              con eso quedó pagada (igual que "¿Pagaste otro valor?" en Obligaciones) */}
          {(() => {
            if (!a.obligacionId || !(a.monto > 0)) return null
            const d = a.obligacionTipo === "deuda" ? debts.find(x => x.id === a.obligacionId) : null
            const f = a.obligacionTipo === "fijo" ? fixedExpenses.find(x => x.id === a.obligacionId) : null
            const cuota = d ? d.cuotaPeriodo : f ? (f.frecuencia === "quincenal" ? Math.round(f.monto / 2) : f.monto) : 0
            const falta = Math.max(0, cuota - ((d ?? f)?.montoPagadoEstePeriodo ?? 0))
            if (!(falta > 0) || a.monto >= falta) return null
            return (
              <label className="flex items-start gap-2 text-[10px] text-muted-foreground cursor-pointer rounded-lg bg-muted/40 p-2">
                <input type="checkbox" checked={!!a.cuotaCompleta} onChange={e => onChange({ cuotaCompleta: e.target.checked })} className="accent-kiri-emerald mt-0.5 h-4 w-4 shrink-0" />
                <span><span className="font-bold text-foreground">{tr("Con este valor quedó pagada la cuota")}</span>{" "}{tr("(la cuota registrada es {0}; si no la marcas queda pendiente {1})", [formatAmount(falta), formatAmount(falta - a.monto)])}</span>
              </label>
            )
          })()}
        </div>
      )}

      {a.tipo === "ahorro" && (
        destinos.bolsillos.length > 0 ? (
          <Chips label={tr("Bolsillo")} opciones={destinos.bolsillos.map(b => ({ id: b.id, label: `🐷 ${b.nombre}` }))}
            valor={a.bolsilloId ?? null} onElegir={id => onChange({ bolsilloId: id })} />
        ) : (
          <button type="button" onClick={() => onChange({ tipo: "crear_bolsillo" })} className="text-[11px] text-kiri-emerald font-bold">{tr("No tienes bolsillos: crear una meta de ahorro con este monto →")}</button>
        )
      )}

      {a.tipo === "crear_deuda" && (() => {
        const tipoD = a.esCreditoCompras ? "compras" : a.esTarjeta ? "tarjeta" : "prestamo"
        const esLinea = tipoD !== "prestamo"
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-muted/40">
              {([["tarjeta", tr("Tarjeta")], ["compras", tr("Crédito compras")], ["prestamo", tr("Préstamo")]] as const).map(([v, t]) => (
                <button key={v} type="button" onClick={() => onChange({ esTarjeta: v === "tarjeta", esCreditoCompras: v === "compras" })}
                  className={cn("h-7 rounded-md text-[10px] font-bold transition-colors", tipoD === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {esLinea && <Campo label={tr("Cupo")}><MoneyInput showCurrency={false} value={a.cupo ? String(a.cupo) : ""} onChange={v => onChange({ cupo: Number(v) || null })} className="h-8 text-xs rounded-lg" placeholder="$0" /></Campo>}
              <Campo label={esLinea ? tr("Pago mensual") : tr("Cuota")}><MoneyInput showCurrency={false} value={a.cuota ? String(a.cuota) : ""} onChange={v => onChange({ cuota: Number(v) || null })} className="h-8 text-xs rounded-lg" placeholder="$0" /></Campo>
              <Campo label={esLinea ? tr("Día (opcional)") : tr("Día de pago")}><Input inputMode="numeric" value={a.diaPago ?? ""} onChange={e => onChange({ diaPago: Math.min(31, Number(e.target.value.replace(/\D/g, "")) || 0) || null })} className="h-8 text-xs rounded-lg" placeholder={esLinea ? tr("Fin de mes") : "1"} /></Campo>
              {!esLinea && <Campo label={tr("Tasa mensual %")}><Input inputMode="decimal" value={a.tasaMensual ?? ""} onChange={e => onChange({ tasaMensual: Number(e.target.value.replace(",", ".")) || null })} className="h-8 text-xs rounded-lg" placeholder={tr("Opcional")} /></Campo>}
            </div>
            {esLinea && <p className="text-[10px] text-muted-foreground">{tr("El monto es lo que tienes ocupado hoy (puede ser $0). Tiene cupo y nunca se termina.")}</p>}
          </div>
        )
      })()}

      {a.tipo === "crear_gasto_fijo" && (
        <div className="grid grid-cols-2 gap-2">
          <Campo label={tr("Día de pago")}><Input inputMode="numeric" value={a.diaPago ?? ""} onChange={e => onChange({ diaPago: Math.min(31, Number(e.target.value.replace(/\D/g, "")) || 0) || null })} className="h-8 text-xs rounded-lg" placeholder="1" /></Campo>
          <Campo label={tr("Cada cuánto")}>
            <select value={a.frecuencia ?? "mensual"} onChange={e => onChange({ frecuencia: e.target.value as Accion["frecuencia"] })} className="h-8 w-full text-xs rounded-lg border border-input bg-background px-2">
              <option value="mensual">{tr("Mensual")}</option><option value="quincenal">{tr("Quincenal")}</option><option value="semanal">{tr("Semanal")}</option><option value="anual">{tr("Anual")}</option>
            </select>
          </Campo>
        </div>
      )}

      {a.tipo === "crear_categoria" && (
        <div className="space-y-1">
          <Campo label={tr("El límite es")}>
            <select value={a.frecuencia === "quincenal" ? "quincenal" : "mensual"} onChange={e => onChange({ frecuencia: e.target.value as Accion["frecuencia"] })} className="h-8 w-full text-xs rounded-lg border border-input bg-background px-2">
              <option value="mensual">{tr("Para todo el mes")}</option><option value="quincenal">{tr("Por quincena")}</option>
            </select>
          </Campo>
          <p className="text-[10px] text-muted-foreground">{tr("El monto es el límite de la categoría (0 = sin límite).")}</p>
        </div>
      )}
      {a.tipo === "crear_bolsillo" && <p className="text-[10px] text-muted-foreground">{tr("El monto es la meta del bolsillo.")}</p>}

      {a.tipo === "me_deben" && (
        <div className="grid grid-cols-2 gap-2">
          <Campo label={tr("¿A quién?")}><Input value={a.persona ?? ""} onChange={e => onChange({ persona: e.target.value })} className="h-8 text-xs rounded-lg" placeholder={tr("Nombre")} /></Campo>
          <Campo label={tr("Te paga el")}><Input type="date" value={a.fechaCompromiso ?? ""} onChange={e => onChange({ fechaCompromiso: e.target.value || null })} className="h-8 text-xs rounded-lg" /></Campo>
        </div>
      )}

      {a.tipo === "abono_me_deben" && (
        destinos.meDeben.length > 0 ? (
          <Chips label={tr("¿Quién te pagó?")} opciones={destinos.meDeben.map(l => ({ id: l.id, label: tr("{0} · debe {1}", [l.persona, formatAmount(l.saldoPendiente)]) }))}
            valor={a.meDebenId ?? null} onElegir={id => onChange({ meDebenId: id })} />
        ) : <p className="text-[11px] text-muted-foreground">{tr("No tienes a nadie en \"Me deben\".")}</p>
      )}

      {(falta.length > 0 || error) && (
        <p className="flex items-start gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3 w-3 shrink-0 mt-px" /> {error ?? falta[0]}
        </p>
      )}
    </div>
  )
}

function Chips({ label, opciones, valor, onElegir, vacio, rosa }: {
  label: string
  opciones: { id: string; label: string }[]
  valor: string | null
  onElegir: (id: string | null) => void
  vacio?: string
  rosa?: boolean
}) {
  const activo = rosa ? "border-pink-500 bg-pink-500/10 text-pink-600 dark:text-pink-400" : "border-kiri-emerald bg-kiri-emerald/10 text-kiri-emerald"
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {vacio && (
          <button type="button" onClick={() => onElegir(null)}
            className={cn("px-2 py-1 rounded-lg border text-[10px] font-bold", valor === null ? activo : "border-border text-muted-foreground")}>{vacio}</button>
        )}
        {opciones.map(o => (
          <button key={o.id} type="button" onClick={() => onElegir(o.id)}
            className={cn("px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1", valor === o.id ? activo : "border-border text-muted-foreground hover:border-kiri-emerald/40")}>
            {valor === o.id && <Check className="h-2.5 w-2.5" />}{o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Select({ label, value, onChange, opciones }: { label: string; value: string; onChange: (v: string) => void; opciones: { v: string; t: string }[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <select value={value} onChange={e => onChange(e.target.value)} className="h-8 w-full text-xs rounded-lg border border-input bg-background px-2">
        <option value="">{tr("Elige…")}</option>
        {opciones.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
