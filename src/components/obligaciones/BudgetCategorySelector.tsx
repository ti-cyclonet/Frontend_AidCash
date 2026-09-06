"use client"

import { Tag } from "lucide-react"
import { useBudgetCategories } from "@/hooks/use-budget-categories"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BudgetCategorySelector — Select para vincular una deuda/gasto fijo a una
 * categoría de presupuesto
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Al vincular, los pagos que se registren contra esta deuda/gasto fijo cuentan
 * como consumo de esa categoría (ver computeCategorySpend en
 * budget-category-spend.ts) — usando el monto REAL pagado cada periodo, no el
 * monto configurado completo.
 */

interface Props {
  value?: string | null
  onChange: (categoryId: string | null) => void
}

export function BudgetCategorySelector({ value, onChange }: Props) {
  const { budgetCategories } = useBudgetCategories()

  if (budgetCategories.length === 0) return null

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
        <Tag className="h-3 w-3" /> Categoría de presupuesto (opcional)
      </label>
      <select
        value={value ?? ""}
        onChange={e => onChange(e.target.value || null)}
        className="w-full h-10 rounded-xl bg-muted/30 border border-border px-3 text-sm font-medium appearance-none cursor-pointer"
      >
        <option value="">Sin categoría</option>
        {budgetCategories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  )
}
