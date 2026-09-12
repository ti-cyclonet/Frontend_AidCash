"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Users, PiggyBank, Coins, HandCoins } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useSocket } from "@/lib/socket-context"
import { connectionsApi } from "@/lib/api-client"
import { ConnectionsTab } from "@/components/social/connections-tab"
import { SharedPocketsTab } from "@/components/social/shared-pockets-tab"
import { LoansTab } from "@/components/social/loans-tab"
import { SocialDebtsTab } from "@/components/social/SocialDebtsTab"
import type { Connection } from "@/lib/types"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"
import { FeatureGate } from "@/components/plan/feature-gate"

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const BASE_TABS = [
  { id: "connections",    label: "Conexiones",  icon: Users },
  { id: "pockets",        label: "Ahorros",     icon: PiggyBank },
  { id: "loans",          label: "Préstamos",   icon: Coins },
] as const

// "Deudas" solo existe si el usuario tiene al menos una conexión de tipo
// pareja o familia — para amigos no aplica (ver SocialDebtsTab / POST /debts).
const DEBTS_TAB = { id: "debts", label: "Deudas", icon: HandCoins } as const

type TabId = typeof BASE_TABS[number]["id"] | typeof DEBTS_TAB["id"]

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SocialPage() {
  return (
    <FeatureGate feature="socialConnections">
      <SocialContent />
    </FeatureGate>
  )
}

function SocialContent() {
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("social")
  const { user: authUser } = useAuth()
  const { connected, unreadCount } = useSocket()
  const searchParams = useSearchParams()

  const [acceptedConnections, setAcceptedConnections] = useState<Connection[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)

  // "Deudas" solo aparece si hay al menos una conexión pareja/familia aceptada
  const hasPartnerOrFamily = acceptedConnections.some(c => c.role === "PARTNER" || c.role === "FAMILY")
  const TABS = useMemo(
    () => hasPartnerOrFamily ? [...BASE_TABS, DEBTS_TAB] : BASE_TABS,
    [hasPartnerOrFamily]
  )

  const initialTab = (TABS.find(t => t.id === searchParams.get("tab"))?.id ?? "connections") as TabId
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  // Cargar conexiones aceptadas para pasarlas a sub-tabs
  const loadAccepted = useCallback(async () => {
    const { data } = await connectionsApi.list()
    if (data) {
      setAcceptedConnections(data.accepted as unknown as Connection[])
    }
  }, [])

  useEffect(() => { loadAccepted() }, [loadAccepted])

  // Cuando el usuario cambia de tab, refrescar conexiones aceptadas
  useEffect(() => {
    if (activeTab !== "connections") loadAccepted()
  }, [activeTab, loadAccepted])

  // Si la pestaña activa deja de existir (ej. se elimina la única conexión
  // pareja/familia mientras se está viendo "Deudas"), volver a Conexiones.
  useEffect(() => {
    if (!TABS.some(t => t.id === activeTab)) setActiveTab("connections")
  }, [TABS, activeTab])

  const myId = authUser?.id ?? ""

  return (
    <>
      {showTutorial && <TutorialSlider module="social" onClose={dismissTutorial} />}
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-cyclon-lavender">Social</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Finanzas compartidas con las personas que importan.
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-kiri-emerald/40 text-kiri-emerald text-xs font-bold hover:bg-kiri-emerald/5 transition-colors shrink-0"
        >
          <Users className="h-4 w-4" /> Invitar usuario
        </button>
      </header>

      {/* ── Tabs ── */}
      <div className={cn("grid gap-1.5 bg-muted/50 p-1.5 rounded-2xl", TABS.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          const showBadge = tab.id === "connections" && unreadCount > 0

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center justify-center rounded-xl font-semibold transition-all",
                TABS.length === 4
                  // 4 pestañas (aparece "Deudas") no caben en una fila horizontal
                  // en pantallas chicas — ícono arriba, texto abajo, como un tab
                  // bar de fondo, en vez de truncar "Conexiones"/"Préstamos" a
                  // una o dos letras.
                  ? "flex-col gap-0.5 h-14 px-1 text-[10px]"
                  : "flex-row gap-1.5 h-10 px-3 text-sm",
                isActive
                  ? "bg-card shadow-sm text-cyclon-lavender"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              <span className="truncate max-w-full">{tab.label}</span>
              {showBadge && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-cyclon-pink rounded-full flex items-center justify-center text-[8px] font-black text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Contenido del tab ── */}
      <div>
        {activeTab === "connections" && (
          <ConnectionsTab myId={myId} showInviteModal={showInviteModal} onCloseInviteModal={() => setShowInviteModal(false)} />
        )}
        {activeTab === "pockets" && (
          <SharedPocketsTab myId={myId} acceptedConnections={acceptedConnections} />
        )}
        {activeTab === "loans" && (
          <LoansTab myId={myId} acceptedConnections={acceptedConnections} />
        )}
        {activeTab === "debts" && (
          <SocialDebtsTab myId={myId} acceptedConnections={acceptedConnections} />
        )}
      </div>
    </div>
    </>
  )
}
