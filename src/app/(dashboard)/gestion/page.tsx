"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Wallet, PieChart } from "lucide-react"
import { BilleteraTab } from "@/components/gestion/BilleteraTab"
import { PresupuestoTab } from "@/components/gestion/PresupuestoTab"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"

type GestionTab = "billetera" | "presupuesto"

export default function GestionPage() {
  const [activeTab, setActiveTab] = useState<GestionTab>("billetera")
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("gestion")

  return (
    <>
      {showTutorial && <TutorialSlider module="gestion" onClose={dismissTutorial} />}
    <div className="space-y-5">

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2">
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
      </div>

      {activeTab === "billetera" && <BilleteraTab />}
      {activeTab === "presupuesto" && <PresupuestoTab />}
    </div>
    </>
  )
}
