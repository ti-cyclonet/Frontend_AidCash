"use client"

import { useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"

const PUBLIC_ROUTES = ['/', '/login', '/register']
// Enlaces de invitación (app/invitacion/[code]) y documentos legales
// (app/legal/[doc]): se abren con o sin sesión
const PUBLIC_PREFIXES = ['/invitacion/', '/legal/']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

    if (!user && !isPublicRoute) {
      router.replace('/login')
      return
    }

    if (user && (pathname === '/' || pathname === '/login' || pathname === '/register')) {
      // Entró a iniciar sesión desde un enlace de invitación: volver a él
      // para que se conecte con quien lo invitó.
      let invitacion: string | null = null
      try { invitacion = localStorage.getItem('kiri_invitacion') } catch { /* sin storage */ }
      if (invitacion && pathname === '/login') { router.replace(`/invitacion/${invitacion}`); return }
      router.replace(user.onboardingDone ? '/dashboard' : '/onboarding')
    }
  }, [user, loading, pathname, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
