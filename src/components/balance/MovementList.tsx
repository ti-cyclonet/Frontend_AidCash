"use client"

import { useState } from "react"
import { ChevronDown, CreditCard, HandCoins, Home, PiggyBank, ReceiptText, Sparkles, Trash2, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
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
  const [expanded, setExpanded] = useState<string | null>(null)

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
        const isExpanded = expanded === m.id
        const isIngreso = esEntrada(m)
        const hasDetail = m.tipo === "deudas" && m.abonoCapital != null
        const meta = MOVEMENT_META[m.tipo]
        const Icon = meta.icon
        return (
          <Card
            key={m.id}
            style={{ borderLeft: `3px solid ${meta.color}` }}
            className={cn("border-y-0 border-r-0 bg-card shadow-sm rounded-2xl transition-all", hasDetail && "cursor-pointer hover:ring-1 hover:ring-cyclon-lavender/30")}
            onClick={() => hasDetail && setExpanded(isExpanded ? null : m.id)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}1a` }}>
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{m.nombre}</p>
                  <p className="text-[10px] text-muted-foreground">
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
                  {hasDetail && (
                    <p className="text-[8px] text-muted-foreground flex items-center gap-0.5 justify-end">
                      <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", isExpanded && "rotate-180")} />
                      {isExpanded ? tr("Ocultar") : tr("Ver detalle")}
                    </p>
                  )}
                </div>
              </div>

              {isExpanded && hasDetail && (
                <div className="bg-muted/10 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] text-muted-foreground">{tr("Capital pagado")}</p>
                      <p className="text-xs font-black text-emerald-500">{formatAmount(m.abonoCapital!)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">{tr("Intereses pagados")}</p>
                      <p className="text-xs font-black text-red-500">{formatAmount(m.pagoInteres!)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">{tr("Saldo anterior")}</p>
                      <p className="text-xs font-bold">{formatAmount(m.saldoAnterior!)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">{tr("Saldo actual")}</p>
                      <p className="text-xs font-bold">{formatAmount(m.saldoPosterior!)}</p>
                    </div>
                  </div>
                  {m.tasaInteres && (
                    <p className="text-[9px] text-muted-foreground pt-1 border-t border-border/30">{tr("Interés aplicado:")}{" "}<span className="font-bold text-amber-500">{m.tasaInteres}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
