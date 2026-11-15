"use client"

import { useEffect, useState } from "react"
import { userApi, type WalletState } from "@/lib/api-client"
import { usePeriodBudget } from "@/hooks/use-period-budget"
import { calcularDistribucionReal } from "@/lib/distribucion-billetera"

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
  // Lo pendiente del periodo por fecha real (incluye préstamos de Social que vencen)
  const obligaciones = periodData.totalObligations

  const total = wallet?.cashBalance ?? 0
  const dist = calcularDistribucionReal(total, obligaciones, wallet?.ahorradoPeriodo ?? 0)
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
