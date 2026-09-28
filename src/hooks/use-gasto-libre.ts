"use client"

import { useEffect, useMemo, useState } from "react"
import { userApi, type WalletState } from "@/lib/api-client"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { calcularDistribucionReal, getDisplayAmount } from "@/lib/distribucion-billetera"

/**
 * "Gasto libre" con EXACTAMENTE el mismo cálculo que la tarjeta de Billetera
 * (saldo real − obligaciones pendientes del periodo − ahorro sugerido). Se
 * recalcula cuando cambia la billetera (evento kiri:wallet-updated).
 */
export function useGastoLibre() {
  const [wallet, setWallet] = useState<WalletState | null>(null)
  useEffect(() => {
    const refresh = () => { userApi.getWallet().then(({ data }) => { if (data) setWallet(data.wallet) }) }
    refresh()
    window.addEventListener("kiri:wallet-updated", refresh)
    return () => window.removeEventListener("kiri:wallet-updated", refresh)
  }, [])

  const { periodData } = usePeriodBudget()
  const obligaciones = useMemo(
    () => periodData.periodDebts.reduce((a, d) => a + getDisplayAmount(d), 0) + periodData.periodFixed.reduce((a, f) => a + getDisplayAmount(f), 0),
    [periodData.periodDebts, periodData.periodFixed],
  )

  const total = wallet?.cashBalance ?? 0
  const dist = calcularDistribucionReal(total, obligaciones)
  return {
    loaded: wallet !== null,
    wallet,
    /** Saldo real (cashBalance). */
    total,
    /** Libre + capacidad de endeudamiento — el número de la tarjeta "Gasto libre". */
    gastoLibre: Math.round(dist.freeAmount + dist.debtCapAmount),
    distribucion: dist,
  }
}
