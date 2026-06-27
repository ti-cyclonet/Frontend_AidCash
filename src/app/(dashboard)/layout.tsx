import { BottomNav } from "@/components/navigation/bottom-nav"
import { Sidebar } from "@/components/navigation/sidebar"
import { CoachFab } from "@/components/navigation/coach-fab"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background lg:flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <main className="min-h-screen">
          <div className="max-w-4xl mx-auto px-5 py-6 pb-28 lg:px-8 lg:py-8 lg:pb-8">
            {children}
          </div>
        </main>
      </div>
      <div className="lg:hidden">
        <BottomNav />
      </div>
      <CoachFab />
    </div>
  )
}
