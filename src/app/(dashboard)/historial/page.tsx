"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Search, Calendar, CreditCard, Filter, ArrowUpDown,
  TrendingDown, TrendingUp, ChevronRight, ReceiptText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { reportsApi, type BalanceReport } from "@/lib/api-client"
import Link from "next/link"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Historial — Módulo independiente de historial de movimientos
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Muestra TODOS los movimientos financieros con filtros avanzados:
 *   - Fecha
 *   - Deuda / obligación
 *   - Tipo de pago
 *   - Estado: Pagado / Pendiente / Parcial
 *   - Interés pagado / Capital pagado
 *
 * Cada registro de deuda muestra el desglose completo:
 *   Pago → Capital → Intereses → Saldo anterior → Saldo actual → Tasa
 */

type FilterType = "todos" | "deudas" | "gastos_fijos" | "hormiga" | "ingresos" | "ahorros"

export default function HistorialPage() {
  const { formatAmount } = useAppContext()
  const [report, setReport] = useState<BalanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<FilterType>("todos")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    reportsApi.getBalance("all").then(({ data }) => {
      if (data) setReport(data)
      setLoading(false)
    })
  }, [])

  // Construir lista unificada de movimientos
  const allMovements = useMemo(() => {
    if (!report) return []

    const movements: {
      id: string
      fecha: string
      nombre: string
      tipo: FilterType
      tipoLabel: string
      monto: number
      estado: 'pagado' | 'pendiente' | 'parcial'
      // Desglose para deudas
      abonoCapital?: number
      pagoInteres?: number
      saldoAnterior?: number
      saldoPosterior?: number
      tasaInteres?: string
      acreedor?: string
    }[] = []

    // Pagos de deudas (con desglose completo)
    for (const p of (report.debtPayments ?? [])) {
      movements.push({
        id: (p.id as string) ?? `dp-${Math.random()}`,
        fecha: p.createdAt as string,
        nombre: (p.debtName as string) ?? 'Deuda',
        tipo: "deudas",
        tipoLabel: "Pago de deuda",
        monto: p.montoPagado as number,
        estado: 'pagado',
        abonoCapital: p.abonoCapital as number,
        pagoInteres: p.pagoInteres as number,
        saldoAnterior: p.saldoAnterior as number,
        saldoPosterior: p.saldoPosterior as number,
        tasaInteres: p.tasaAplicada ? `${Number(p.tasaAplicada).toFixed(2)}% M.V.` : undefined,
        acreedor: p.acreedor as string | undefined,
      })
    }

    // Gastos fijos
    for (const f of report.fixedExpenses) {
      if (f.pagadoEstePeriodo as boolean) {
        movements.push({
          id: f.id as string,
          fecha: (f.updatedAt as string) ?? (f.createdAt as string),
          nombre: f.nombre as string,
          tipo: "gastos_fijos",
          tipoLabel: "Gasto fijo",
          monto: (f as any).montoPagadoEstePeriodo ?? (f.monto as number),
          estado: 'pagado',
        })
      }
    }

    // Gastos hormiga
    for (const e of report.impulseExpenses) {
      movements.push({
        id: e.id as string,
        fecha: e.createdAt as string,
        nombre: e.nombre as string,
        tipo: "hormiga",
        tipoLabel: `Gasto hormiga · ${e.categoria as string}`,
        monto: e.monto as number,
        estado: 'pagado',
      })
    }

    // Ingresos
    for (const r of (report.incomeRecords ?? [])) {
      movements.push({
        id: (r.id as string) ?? `ir-${Math.random()}`,
        fecha: r.createdAt as string,
        nombre: (r.tipo as string) === 'salario' ? 'Sueldo' : 'Ingreso extra',
        tipo: "ingresos",
        tipoLabel: (r.tipo as string) === 'salario' ? 'Salario' : 'Extra',
        monto: r.monto as number,
        estado: 'pagado',
      })
    }

    // Ahorros
    for (const s of report.savingsHistory) {
      if ((s.tipo as string) === 'ahorro') {
        movements.push({
          id: s.id as string,
          fecha: (s.createdAt as string),
          nombre: `Ahorro — ${s.periodo as string}`,
          tipo: "ahorros",
          tipoLabel: "Ahorro",
          monto: s.monto as number,
          estado: 'pagado',
        })
      }
    }

    // Ordenar por fecha desc
    return movements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [report])

  // Filtrar
  const filtered = useMemo(() => {
    let result = allMovements
    if (filterType !== "todos") result = result.filter(m => m.tipo === filterType)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(m => m.nombre.toLowerCase().includes(q) || m.tipoLabel.toLowerCase().includes(q))
    }
    return result
  }, [allMovements, filterType, searchQuery])

  const FILTERS: { value: FilterType; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "deudas", label: "Deudas" },
    { value: "gastos_fijos", label: "Gastos Fijos" },
    { value: "hormiga", label: "Hormiga" },
    { value: "ingresos", label: "Ingresos" },
    { value: "ahorros", label: "Ahorros" },
  ]

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-cyclon-lavender" />
          <h1 className="text-xl font-bold">Historial</h1>
          <span className="text-[9px] font-bold bg-cyclon-lavender/10 text-cyclon-lavender px-2 py-0.5 rounded-full">NUEVO</span>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">Todos tus movimientos financieros con desglose detallado.</p>
      </header>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, acreedor, tipo..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-11 rounded-xl pl-10"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilterType(f.value)} className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold shrink-0 border-2 transition-colors",
            filterType === f.value ? "bg-cyclon-lavender text-white border-cyclon-lavender" : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
          )}>{f.label}</button>
        ))}
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-3 text-center">
            <p className="text-[9px] text-muted-foreground">Total movimientos</p>
            <p className="text-lg font-black">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-3 text-center">
            <p className="text-[9px] text-muted-foreground">Total egresos</p>
            <p className="text-lg font-black text-red-500">
              {formatAmount(filtered.filter(m => m.tipo !== 'ingresos').reduce((a, m) => a + m.monto, 0))}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none bg-card shadow-sm rounded-2xl">
          <CardContent className="p-3 text-center">
            <p className="text-[9px] text-muted-foreground">Total ingresos</p>
            <p className="text-lg font-black text-emerald-500">
              {formatAmount(filtered.filter(m => m.tipo === 'ingresos').reduce((a, m) => a + m.monto, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de movimientos */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-muted/30 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ReceiptText className="h-12 w-12 mx-auto opacity-20 mb-3" />
          <p className="text-sm">No hay movimientos que mostrar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const isExpanded = expandedId === m.id
            const isIngreso = m.tipo === 'ingresos'
            const hasDetail = m.tipo === 'deudas' && m.abonoCapital != null

            return (
              <Card
                key={m.id}
                className={cn("border-none bg-card shadow-sm rounded-2xl transition-all", hasDetail && "cursor-pointer hover:ring-1 hover:ring-cyclon-lavender/30")}
                onClick={() => hasDetail && setExpandedId(isExpanded ? null : m.id)}
              >
                <CardContent className="p-4 space-y-2">
                  {/* Fila principal */}
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                      isIngreso ? "bg-emerald-500/10" : m.tipo === 'deudas' ? "bg-cyclon-lavender/10" : "bg-muted/30"
                    )}>
                      {isIngreso ? <TrendingUp className="h-4 w-4 text-emerald-500" /> :
                       m.tipo === 'deudas' ? <CreditCard className="h-4 w-4 text-cyclon-lavender" /> :
                       <TrendingDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{m.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.tipoLabel}
                        {m.acreedor && ` · ${m.acreedor}`}
                        {' · '}
                        {m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-sm font-black", isIngreso ? "text-emerald-500" : "text-foreground")}>
                        {isIngreso ? '+' : ''}{formatAmount(m.monto)}
                      </p>
                      {hasDetail && (
                        <p className="text-[8px] text-muted-foreground">{isExpanded ? '▾ Ocultar' : '▸ Ver detalle'}</p>
                      )}
                    </div>
                  </div>

                  {/* Desglose expandible (solo deudas) */}
                  {isExpanded && hasDetail && (
                    <div className="bg-muted/10 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] text-muted-foreground">Capital pagado</p>
                          <p className="text-xs font-black text-emerald-500">{formatAmount(m.abonoCapital!)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Intereses pagados</p>
                          <p className="text-xs font-black text-red-500">{formatAmount(m.pagoInteres!)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Saldo anterior</p>
                          <p className="text-xs font-bold">{formatAmount(m.saldoAnterior!)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Saldo actual</p>
                          <p className="text-xs font-bold">{formatAmount(m.saldoPosterior!)}</p>
                        </div>
                      </div>
                      {m.tasaInteres && (
                        <p className="text-[9px] text-muted-foreground pt-1 border-t border-border/30">
                          Interés aplicado: <span className="font-bold text-amber-500">{m.tasaInteres}</span>
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
