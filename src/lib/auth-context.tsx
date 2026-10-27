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
import { hidratarGuias } from "@/lib/guias"


interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, nombre: string, documentType?: string, documentNumber?: string, firstName?: string, secondName?: string, firstSurname?: string, secondSurname?: string, aceptaDocumentos?: boolean) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/*
 * Usuario recordado en el dispositivo: la app arranca al instante con él (antes cada
 * apertura esperaba /auth/me para mostrar algo) y lo confirma con el servidor detrás.
 */
const CLAVE_USUARIO = "kiri_auth_user"
function leerUsuarioGuardado(): AuthUser | null {
  try {
    const u = JSON.parse(localStorage.getItem(CLAVE_USUARIO) ?? "null") as AuthUser | null
    return u && u.id === getUserId() ? u : null
  } catch { return null }
}
function guardarUsuario(u: AuthUser | null) {
  try { if (u) localStorage.setItem(CLAVE_USUARIO, JSON.stringify(u)); else localStorage.removeItem(CLAVE_USUARIO) } catch { /* sin storage */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay sesión activa al montar
    if (!isAuthenticated()) {
      setLoading(false)
      return
    }

    const guardado = leerUsuarioGuardado()
    if (guardado) { setUser(guardado); setLoading(false) }

    // Se confirma con el servidor. SOLO un 401 cierra la sesión: sin red, con el
    // servidor caído o con "demasiadas solicitudes" la sesión sigue siendo válida
    // (antes cualquier error borraba los tokens y sacaba al usuario).
    let cancelado = false
    const validar = async (intento = 0) => {
      const { data, status } = await authApi.me()
      if (cancelado) return
      if (data) {
        const u = data.user
        hidratarGuias(u.id as string, u.guiasVistas)
        const actual = { id: u.id as string, nombre: u.nombre as string, correo: u.correo as string, onboardingDone: u.onboardingDone as boolean }
        setUser(actual); guardarUsuario(actual); setLoading(false)
        return
      }
      if (status === 401) { clearTokens(); guardarUsuario(null); setUser(null); setLoading(false); return }
      if (intento < 3) { window.setTimeout(() => validar(intento + 1), [1500, 4000, 8000][intento]); return }
      setLoading(false)
    }
    validar()
    return () => { cancelado = true }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await authApi.login(email, password)
    if (error) return { error }
    if (data) {
      hidratarGuias(data.user.id, (data.user as unknown as { guiasVistas?: string[] }).guiasVistas)
      setUser(data.user); guardarUsuario(data.user)
    }
    return { error: null }
  }

  const signUp = async (email: string, password: string, nombre: string, documentType?: string, documentNumber?: string, firstName?: string, secondName?: string, firstSurname?: string, secondSurname?: string, aceptaDocumentos = false) => {
    const { data, error } = await authApi.register(nombre, email, password, documentType, documentNumber, firstName, secondName, firstSurname, secondSurname, aceptaDocumentos)
    if (error) return { error }
    // If verification is required, do NOT log the user in
    const verificationRequired = (data as any)?.verificationRequired
    if (data && !verificationRequired) {
      setUser(data.user); guardarUsuario(data.user)
    }
    return { error: null, verificationRequired }
  }

  const signOut = async () => {
    // Capturar el userId ANTES de que logout() borre los tokens de los que
    // sale — si no, clearAvatar ya no sabría qué slot de IndexedDB limpiar.
    const userId = getUserId()
    await authApi.logout()
    setUser(null); guardarUsuario(null)
    if (userId) clearAvatar(userId).catch(() => {})
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
