"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, Wallet } from "lucide-react"
import { ProyeccionesTab } from "@/components/gestion/ProyeccionesTab"
import { BilleteraTab } from "@/components/gestion/BilleteraTab"

type GestionTab = "proyecciones" | "billetera"

export default function GestionPage() {
  const [activeTab, setActiveTab] = useState<GestionTab>("billetera")

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setActiveTab("billetera")}
          className={cn(
            "flex items-center justify-center gap-2 h-11 rounded-2xl text-sm font-bold border-2 transition-colors",
            activeTab === "billetera"
              ? "bg-cyclon-lavender text-white border-cyclon-lavender shadow-lg shadow-cyclon-lavender/25"
              : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
          )}
        >
          <Wallet className="h-4 w-4" /> Billetera
        </button>
        <button
          onClick={() => setActiveTab("proyecciones")}
          className={cn(
            "flex items-center justify-center gap-2 h-11 rounded-2xl text-sm font-bold border-2 transition-colors",
            activeTab === "proyecciones"
              ? "bg-cyclon-lavender text-white border-cyclon-lavender shadow-lg shadow-cyclon-lavender/25"
              : "border-muted text-muted-foreground hover:border-cyclon-lavender/40"
          )}
        >
          <TrendingUp className="h-4 w-4" /> Proyecciones
        </button>
      </div>

      {activeTab === "billetera" && <BilleteraTab />}
      {activeTab === "proyecciones" && <ProyeccionesTab />}
    </div>
  )
}
