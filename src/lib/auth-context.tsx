"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import {
  authApi,
  getUserId,
  isAuthenticated,
  clearTokens,
  AuthUser,
} from "@/lib/api-client"
import { clearAvatar } from "@/lib/avatar-storage"

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, nombre: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay sesión activa al montar
    if (!isAuthenticated()) {
      setLoading(false)
      return
    }

    // Obtener datos del usuario actual
    authApi.me().then(({ data, error }) => {
      if (error || !data) {
        clearTokens()
        setUser(null)
      } else {
        const u = data.user
        setUser({
          id: u.id as string,
          nombre: u.nombre as string,
          correo: u.correo as string,
          onboardingDone: u.onboardingDone as boolean,
        })
      }
      setLoading(false)
    })
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await authApi.login(email, password)
    if (error) return { error }
    if (data) {
      setUser(data.user)
    }
    return { error: null }
  }

  const signUp = async (email: string, password: string, nombre: string) => {
    const { data, error } = await authApi.register(nombre, email, password)
    if (error) return { error }
    if (data) {
      setUser(data.user)
    }
    return { error: null }
  }

  const signOut = async () => {
    await authApi.logout()
    setUser(null)
    clearAvatar().catch(() => {})
    // Limpiar TODO el caché del perfil
    localStorage.removeItem("kiri_income")
    localStorage.removeItem("kiri_frequency")
    localStorage.removeItem("kiri_onboarding_done")
    localStorage.removeItem("kiri_user")
    localStorage.removeItem("kiri_meta_ahorro")
    localStorage.removeItem("kiri_currency")
    localStorage.removeItem("kiri_dark")
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
