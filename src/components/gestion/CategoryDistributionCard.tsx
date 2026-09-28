"use client"

import Link from "next/link"
import { useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useAppContext } from "@/lib/app-context"
import { useBudgetCategories, useCategoryResumen } from "@/hooks/use-budget-categories"

/**
 * "Distribución por categoría" — gasto del periodo actual por categoría de
 * presupuesto. Lee el resumen calculado en el servidor, así que el número es
 * el mismo en Dashboard, Balance y Presupuesto. `verMas` agrega el botón que
 * lleva a la pantalla con el detalle.
 */
export function CategoryDistributionCard({ verMas }: { verMas?: { href: string; label: string } }) {
  const { formatAmount } = useAppContext()
  const { budgetCategories } = useBudgetCategories()
  const { resumen, loading } = useCategoryResumen("periodo")

  const data = useMemo(
    () => (resumen?.categorias ?? []).map(c => ({ name: c.nombre, value: c.gastado, color: c.color })).filter(c => c.value > 0),
    [resumen],
  )
  const total = data.reduce((a, c) => a + c.value, 0)

  return (
    <Card className="border-none bg-card shadow-sm rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-bold text-sm">Distribución por categoría</h2>
          {verMas && (
            <Link href={verMas.href} className="text-[10px] font-bold text-kiri-emerald hover:underline flex items-center gap-1 shrink-0">
              {verMas.label} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        {loading ? (
          <div className="h-[150px] rounded-xl bg-muted/20 animate-pulse" />
        ) : data.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="h-[150px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} paddingAngle={3}>
                    {data.map((c, i) => <Cell key={i} fill={c.color} stroke="none" />)}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0]
                      return (
                        <div className="bg-card border border-border rounded-lg px-2 py-1.5 shadow-lg text-[10px]">
                          <p className="font-bold">{p.name}</p>
                          <p className="text-muted-foreground">{formatAmount(Number(p.value))}</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[8px] text-muted-foreground">Total</span>
                <span className="text-xs font-black">{formatAmount(total)}</span>
              </div>
            </div>
            <div className="space-y-2">
              {data.map(c => (
                <div key={c.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold truncate">{c.name}</p>
                    <p className="text-[9px] text-muted-foreground">{formatAmount(c.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : budgetCategories.length === 0 ? (
          <div className="h-[150px] flex flex-col items-center justify-center gap-2 text-center px-4">
            <p className="text-muted-foreground text-xs">Aún no has creado categorías de presupuesto.</p>
            <Link href="/gestion" className="text-[10px] font-bold text-kiri-emerald hover:underline">
              Crear una categoría →
            </Link>
          </div>
        ) : (
          <div className="h-[150px] flex items-center justify-center text-muted-foreground text-xs">
            Sin gasto registrado en tus categorías este periodo
          </div>
        )}
      </CardContent>
    </Card>
  )
}
