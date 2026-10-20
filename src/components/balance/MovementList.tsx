"use client"

import { useState } from "react"
import { ChevronRight, CreditCard, HandCoins, Home, PiggyBank, ReceiptText, Sparkles, Trash2, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatPeriodo } from "@/lib/payment-schedule"
import type { Movement, MovementType } from "@/lib/api-client"
import { tr, localeFecha } from "@/lib/i18n"

export const MOVEMENT_FILTERS: { value: "todos" | MovementType; label: string }[] = [
  { value: "todos", label: tr("Todos") },
  { value: "deudas", label: tr("Deudas") },
  { value: "gastos_fijos", label: tr("Gastos Fijos") },
  { value: "hormiga", label: tr("Hormiga") },
  { value: "ingresos", label: tr("Ingresos") },
  { value: "ahorros", label: tr("Ahorros") },
  { value: "prestamos", label: tr("Préstamos") },
]

// Color de acento (borde izquierdo + ícono) por tipo de movimiento.
export const MOVEMENT_META: Record<MovementType, { color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  ingresos: { color: "#22c55e", icon: TrendingUp },
  deudas: { color: "#f97362", icon: CreditCard },
  gastos_fijos: { color: "#3b82f6", icon: Home },
  hormiga: { color: "#a855f7", icon: Sparkles },
  ahorros: { color: "#22d3ee", icon: PiggyBank },
  prestamos: { color: "#f59e0b", icon: HandCoins },
}

/** Un movimiento suma al disponible (ingreso, retiro de ahorro, abono recibido). */
export const esEntrada = (m: Movement) => m.tipo === "ingresos" || m.direccion === "entrada"

/** Gastos registrados e ingresos: se pueden eliminar desde el historial (y se revierte todo). */
export const esGastoEliminable = (m: Movement) => m.tipo === "hormiga" || (m.tipo === "ingresos" && !m.id.startsWith("ir-"))

export function MovementList({ movements, formatAmount, vacio = tr("No hay movimientos que mostrar."), onEliminar }: {
  movements: Movement[]
  formatAmount: (n: number) => string
  vacio?: string
  /** Si viene, los gastos e ingresos registrados muestran un botón para eliminarlos (y revertir todo). */
  onEliminar?: (m: Movement) => void
}) {
  // Tocar un movimiento abre su detalle (fecha, con qué se pagó, categoría…)
  const [detalle, setDetalle] = useState<Movement | null>(null)

  if (movements.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <ReceiptText className="h-10 w-10 mx-auto opacity-20 mb-3" />
        <p className="text-sm">{vacio}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {movements.map(m => {
        const isIngreso = esEntrada(m)
        const meta = MOVEMENT_META[m.tipo]
        const Icon = meta.icon
        return (
          <Card
            key={m.id}
            role="button"
            tabIndex={0}
            aria-label={tr("Ver detalle de {0}", [m.nombre])}
            style={{ borderLeft: `3px solid ${meta.color}` }}
            className="border-y-0 border-r-0 bg-card shadow-sm rounded-2xl transition-all cursor-pointer hover:ring-1 hover:ring-cyclon-lavender/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyclon-lavender/50"
            onClick={() => setDetalle(m)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetalle(m) } }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}1a` }}>
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{m.nombre}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {m.tipoLabel}
                    {m.acreedor && ` · ${m.acreedor}`}
                    {m.tarjetaNombre && tr(" · 💳 pagado con {0}", [m.tarjetaNombre])}
                    {" · "}
                    {m.fecha ? new Date(m.fecha).toLocaleDateString(localeFecha(), { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-black", isIngreso ? "text-emerald-500" : m.tipo === "deudas" ? "text-red-500" : "text-foreground")}>
                    {isIngreso ? "+" : ""}{formatAmount(m.monto)}
                  </p>
                  {onEliminar && esGastoEliminable(m) && (
                    <button
                      onClick={e => { e.stopPropagation(); onEliminar(m) }}
                      className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground hover:text-red-500"
                      aria-label={tr("Eliminar {0}", [m.nombre])}
                    >
                      <Trash2 className="h-3 w-3" />{" "}{tr("Eliminar")}</button>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </div>
            </CardContent>
          </Card>
        )
      })}

      <MovimientoDetalle
        movimiento={detalle}
        onClose={() => setDetalle(null)}
        formatAmount={formatAmount}
        onEliminar={onEliminar ? (m => { setDetalle(null); onEliminar(m) }) : undefined}
      />
    </div>
  )
}

// ─── Detalle de un movimiento ────────────────────────────────────────────────

const CATEGORIA_GASTO: Record<string, string> = {
  cafe: tr("Café"), comida: tr("Comida"), transporte: tr("Transporte"), antojo: tr("Antojo"), salida: tr("Salida"), otro: tr("Otro"),
}

/** Con qué se pagó / de dónde salió o a dónde entró la plata. */
function medioDePago(m: Movement): string {
  if (m.tarjetaNombre) return tr("Tarjeta de crédito · {0}", [m.tarjetaNombre])
  if (m.noMueveBilletera) return tr("No movió tu billetera en Kiri")
  if (m.tipo === "ingresos") return tr("Entró a tu disponible")
  if (m.direccion === "entrada") return tr("Volvió a tu disponible")
  if (m.tipo === "ahorros") return tr("De tu disponible a tu ahorro")
  return tr("De tu disponible (efectivo o cuenta)")
}

function Fila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-bold text-right min-w-0 break-words">{children}</span>
    </div>
  )
}

export function MovimientoDetalle({ movimiento: m, onClose, formatAmount, onEliminar }: {
  movimiento: Movement | null
  onClose: () => void
  formatAmount: (n: number) => string
  onEliminar?: (m: Movement) => void
}) {
  const meta = m ? MOVEMENT_META[m.tipo] : null
  const Icon = meta?.icon
  const entrada = m ? esEntrada(m) : false
  const fecha = m?.fecha ? new Date(m.fecha) : null
  const r = m?.reparto
  const totalReparto = r ? r.ahorro + r.obligaciones + r.libre + r.endeudamiento : 0
  const categoria = m ? (m.categoriaNombre ?? (m.tipo === "hormiga" && m.categoria ? CATEGORIA_GASTO[m.categoria] ?? m.categoria : null)) : null
  return (
    <Dialog open={!!m} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        {m && meta && Icon && (
          <>
            <DialogHeader className="items-center text-center space-y-2">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${meta.color}1a` }}>
                <Icon className="h-7 w-7" style={{ color: meta.color }} />
              </div>
              <DialogTitle className="text-base font-black">{m.nombre}</DialogTitle>
              <p className={cn("text-3xl font-black tabular-nums", entrada ? "text-emerald-500" : m.tipo === "deudas" ? "text-red-500" : "text-foreground")}>
                {entrada ? "+" : m.noMueveBilletera ? "" : "−"}{formatAmount(m.monto)}
              </p>
              <span className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}>{m.tipoLabel}</span>
            </DialogHeader>

            <div className="rounded-2xl bg-muted/30 px-4 py-1">
              <Fila label={tr("Fecha")}>
                {fecha ? fecha.toLocaleDateString(localeFecha(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}
              </Fila>
              {fecha && <Fila label={tr("Hora")}>{fecha.toLocaleTimeString(localeFecha(), { hour: "numeric", minute: "2-digit" })}</Fila>}
              <Fila label={entrada ? tr("A dónde fue") : tr("Con qué se pagó")}>
                {m.tarjetaNombre && <CreditCard className="inline h-3 w-3 mr-1 -mt-0.5" />}{medioDePago(m)}
              </Fila>
              {m.tipo === "hormiga" && (
                <Fila label={tr("¿Gasto hormiga?")}>{m.esHormiga ? tr("Sí 🐜 · gasto pequeño que se repite") : tr("No · gasto variable")}</Fila>
              )}
              {(categoria || m.tipo === "hormiga" || m.tipo === "gastos_fijos") && (
                <Fila label={tr("Categoría")}>
                  {categoria ?? <span className="font-normal text-muted-foreground">{tr("Sin categoría")}</span>}
                  {m.categoriaNombre && m.tipo === "hormiga" && m.categoria && (
                    <span className="font-normal text-muted-foreground">{" · "}{CATEGORIA_GASTO[m.categoria] ?? m.categoria}</span>
                  )}
                </Fila>
              )}
              {m.acreedor && <Fila label={tr("Acreedor")}>{m.acreedor}</Fila>}
              {m.periodo && <Fila label={tr("Periodo que cubre")}>{formatPeriodo(m.periodo)}</Fila>}
              {m.nota && <Fila label={tr("Nota")}>{m.nota}</Fila>}
            </div>

            {/* Deudas: cuánto fue a capital y cuánto a intereses */}
            {m.tipo === "deudas" && m.abonoCapital != null && (
              <div className="rounded-2xl border border-border/60 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Así se repartió el pago")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-[9px] text-muted-foreground">{tr("Capital pagado")}</p><p className="text-sm font-black text-emerald-500">{formatAmount(m.abonoCapital)}</p></div>
                  <div><p className="text-[9px] text-muted-foreground">{tr("Intereses pagados")}</p><p className="text-sm font-black text-red-500">{formatAmount(m.pagoInteres ?? 0)}</p></div>
                  <div><p className="text-[9px] text-muted-foreground">{tr("Saldo anterior")}</p><p className="text-xs font-bold">{formatAmount(m.saldoAnterior ?? 0)}</p></div>
                  <div><p className="text-[9px] text-muted-foreground">{tr("Saldo después")}</p><p className="text-xs font-bold">{formatAmount(m.saldoPosterior ?? 0)}</p></div>
                </div>
                {m.tasaInteres && <p className="text-[10px] text-muted-foreground">{tr("Interés aplicado:")}{" "}<span className="font-bold text-amber-500">{m.tasaInteres}</span></p>}
              </div>
            )}

            {/* Ingresos: cómo se repartió en la billetera */}
            {r && totalReparto > 0 && (
              <div className="rounded-2xl border border-border/60 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Cómo se repartió en tu billetera")}</p>
                {([
                  [tr("Obligaciones"), r.obligaciones, "#3b82f6"],
                  [tr("Ahorro"), r.ahorro, "#22d3ee"],
                  [tr("Gasto libre"), r.libre, "#22c55e"],
                  [tr("Capacidad de deuda"), r.endeudamiento, "#f59e0b"],
                ] as const).filter(([, v]) => v > 0).map(([label, v, color]) => (
                  <div key={label} className="space-y-0.5">
                    <div className="flex justify-between text-[11px]"><span>{label}</span><span className="font-bold tabular-nums">{formatAmount(v)}</span></div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((v / totalReparto) * 100)}%`, backgroundColor: color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {onEliminar && esGastoEliminable(m) && (
              <button
                onClick={() => onEliminar(m)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />{" "}{m.tipo === "ingresos" ? tr("Eliminar este ingreso") : tr("Eliminar este gasto")}
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
