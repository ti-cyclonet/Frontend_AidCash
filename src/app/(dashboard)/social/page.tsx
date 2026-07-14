"use client"

import { useState, useEffect, useCallback } from "react"
import { Users, PiggyBank, Coins } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useSocket } from "@/lib/socket-context"
import { connectionsApi } from "@/lib/api-client"
import { ConnectionsTab } from "@/components/social/connections-tab"
import { SharedPocketsTab } from "@/components/social/shared-pockets-tab"
import { LoansTab } from "@/components/social/loans-tab"
import type { Connection } from "@/lib/types"
import { TutorialSlider, useTutorialFirstTime } from "@/components/tutorial/TutorialSlider"

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "connections",    label: "Conexiones",  icon: Users },
  { id: "pockets",        label: "Ahorros",     icon: PiggyBank },
  { id: "loans",          label: "Préstamos",   icon: Coins },
] as const

type TabId = typeof TABS[number]["id"]

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const { showTutorial, dismissTutorial } = useTutorialFirstTime("social")
  const { user: authUser } = useAuth()
  const { connected, unreadCount } = useSocket()

  const [activeTab, setActiveTab] = useState<TabId>("connections")
  const [acceptedConnections, setAcceptedConnections] = useState<Connection[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
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
      <div className="grid grid-cols-3 gap-1.5 bg-muted/50 p-1.5 rounded-2xl">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          const showBadge = tab.id === "connections" && unreadCount > 0

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold transition-all",
                isActive
                  ? "bg-card shadow-sm text-cyclon-lavender"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              <span className="truncate">{tab.label}</span>
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
      </div>
    </div>
    </>
  )
}
