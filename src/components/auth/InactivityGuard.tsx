"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAppContext } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout"

/**
 * Componente invisible que vigila la inactividad del usuario.
 * Si se excede el tiempo configurado, cierra sesión automáticamente.
 * Si el timeout es "never", no hace nada.
 */
export function InactivityGuard() {
  const { inactivityTimeout } = useAppContext()
  const { signOut } = useAuth()
  const router = useRouter()

  const handleTimeout = useCallback(async () => {
    await signOut()
    router.replace("/login")
  }, [signOut, router])

  useInactivityTimeout(inactivityTimeout, handleTimeout)

  return null // No renderiza nada
}
