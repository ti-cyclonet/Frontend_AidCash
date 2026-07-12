"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, Wallet, PieChart } from "lucide-react"
import { ProyeccionesTab } from "@/components/gestion/ProyeccionesTab"
import { BilleteraTab } from "@/components/gestion/BilleteraTab"
import { PresupuestoTab } from "@/components/gestion/PresupuestoTab"

type GestionTab = "billetera" | "presupuesto" | "proyecciones"

export default function GestionPage() {
  const [activeTab, setActiveTab] = useState<GestionTab>("billetera")

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setActiveTab("billetera")}
          className={cn(
            "flex items-center justify-center gap-1.5 h-11 rounded-2xl text-xs font-bold border-2 transition-colors",
            activeTab === "billetera"
              ? "bg-cyclon-lavender text-white border-cyclon-lavender shadow-lg shadow-cyclon-lavender/25"
              : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
          )}
        >
          <Wallet className="h-4 w-4" /> Billetera
        </button>
        <button
          onClick={() => setActiveTab("presupuesto")}
          className={cn(
            "flex items-center justify-center gap-1.5 h-11 rounded-2xl text-xs font-bold border-2 transition-colors",
            activeTab === "presupuesto"
              ? "bg-cyclon-lavender text-white border-cyclon-lavender shadow-lg shadow-cyclon-lavender/25"
              : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
          )}
        >
          <PieChart className="h-4 w-4" /> Presupuesto
        </button>
        <button
          onClick={() => setActiveTab("proyecciones")}
          className={cn(
            "flex items-center justify-center gap-1.5 h-11 rounded-2xl text-xs font-bold border-2 transition-colors",
            activeTab === "proyecciones"
              ? "bg-cyclon-lavender text-white border-cyclon-lavender shadow-lg shadow-cyclon-lavender/25"
              : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
          )}
        >
          <TrendingUp className="h-4 w-4" /> Proyecciones
        </button>
      </div>

      {activeTab === "billetera" && <BilleteraTab />}
      {activeTab === "presupuesto" && <PresupuestoTab />}
      {activeTab === "proyecciones" && <ProyeccionesTab />}
    </div>
  )
}
