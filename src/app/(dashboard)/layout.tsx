import { BottomNav } from "@/components/navigation/bottom-nav"
import { Sidebar } from "@/components/navigation/sidebar"
import { TopBar } from "@/components/navigation/top-bar"
import { CoachFab } from "@/components/navigation/coach-fab"
import { InactivityGuard } from "@/components/auth/InactivityGuard"
import { SmartAlertsProvider } from "@/components/providers/smart-alerts-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Sidebar — solo desktop */}
      <Sidebar />

      {/* TopBar — solo móvil */}
      <TopBar />

      <div className="flex-1 min-w-0">
        <main className="min-h-screen">
          <div className="max-w-4xl mx-auto px-5 pt-20 pb-28 lg:pt-8 lg:px-8 lg:pb-8">
            {children}
          </div>
        </main>
      </div>

      {/* BottomNav — solo móvil */}
      <div className="lg:hidden">
        <BottomNav />
      </div>

      <CoachFab />
      <InactivityGuard />
      <SmartAlertsProvider />
    </div>
  )
}
