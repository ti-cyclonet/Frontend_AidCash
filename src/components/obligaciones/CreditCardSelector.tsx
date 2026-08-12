"use client"

import { CreditCard } from "lucide-react"
import { useFinanceData } from "@/hooks/use-finance-data"
import { useAppContext } from "@/lib/app-context"
import type { Debt } from "@/lib/types"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CreditCardSelector — Select para vincular un gasto fijo a una tarjeta de crédito
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Cuando un gasto fijo se paga con tarjeta de crédito, al marcarlo como pagado:
 *   - NO se descuenta del cashBalance (la TC paga por ti)
 *   - SE suma al saldo de la tarjeta (tu deuda con el banco crece)
 *   - Al final del ciclo pagas todo junto al banco
 */

interface Props {
  value?: string | null
  onChange: (tarjetaId: string | null) => void
}

/**
 * Determina si una deuda es una tarjeta de crédito.
 * Usa el campo `tipoDeuda` del modelo, con fallback a detección por nombre.
 */
function isCreditCard(debt: Debt): boolean {
  // Priorizar el campo del modelo
  if (debt.tipoDeuda === 'TARJETA_CREDITO') return true

  // Fallback: detección por nombre (para datos legacy sin tipoDeuda)
  const lower = debt.nombre.toLowerCase()
  return (
    lower.includes('tarjeta') ||
    lower.includes('tc ') ||
    lower.includes('visa') ||
    lower.includes('mastercard') ||
    lower.includes('amex')
  )
}

export function CreditCardSelector({ value, onChange }: Props) {
  const { debts } = useFinanceData()
  const { formatAmount } = useAppContext()

  // Filtrar solo deudas tipo tarjeta de crédito activas
  const tarjetas = debts.filter(d => d.estado === 'activa' && isCreditCard(d))

  if (tarjetas.length === 0) return null

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
        <CreditCard className="h-3 w-3" /> ¿Se paga con tarjeta de crédito?
      </label>
      <select
        value={value ?? ""}
        onChange={e => onChange(e.target.value || null)}
        className="w-full h-10 rounded-xl bg-muted/30 border border-border px-3 text-sm font-medium appearance-none cursor-pointer"
      >
        <option value="">No, pago directo</option>
        {tarjetas.map(t => (
          <option key={t.id} value={t.id}>
            {t.nombre} (Saldo: {formatAmount(t.saldoRestante)})
          </option>
        ))}
      </select>
      {value && (
        <p className="text-[8px] text-amber-500 flex items-center gap-1">
          <CreditCard className="h-3 w-3" />
          Al pagar, se sumará al saldo de tu tarjeta sin descontar de tu disponible.
        </p>
      )}
    </div>
  )
}
