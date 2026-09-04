"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, AlertCircle, Sprout, CheckCircle2 } from "lucide-react"
import Link from "next/link"

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Reset Password — página a la que apunta el enlace del correo de
 * "¿Olvidaste tu contraseña?" (/auth/forgot-password en el backend). Antes
 * este link llevaba a una página que no existía — el correo, aunque llegara,
 * terminaba en un 404.
 * ═══════════════════════════════════════════════════════════════════════════
 */
function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const email = params.get("email") ?? ""

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const linkInvalid = !token || !email

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: email, token, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "No se pudo restablecer la contraseña.")
        return
      }
      setDone(true)
    } catch {
      setError("Error de conexión. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-kiri-forest flex-col items-center justify-center gap-8 p-12">
        <div className="h-28 w-28 bg-kiri-sage/30 backdrop-blur-sm rounded-[2rem] shadow-2xl flex items-center justify-center">
          <Sprout className="h-14 w-14 text-kiri-cream" strokeWidth={1.5} />
        </div>
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-white">Kiri Finance</h1>
          <p className="text-white/50 text-base max-w-sm">
            Tu jardín financiero crece con tus buenos hábitos. Organiza, ahorra y prospera.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="lg:hidden bg-kiri-forest px-6 pt-14 pb-12 flex flex-col items-center gap-4">
          <div className="h-20 w-20 bg-kiri-sage/30 backdrop-blur-sm rounded-[1.5rem] shadow-xl flex items-center justify-center">
            <Sprout className="h-10 w-10 text-kiri-cream" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Kiri Finance</h1>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-8 lg:px-12">
          <div className="w-full max-w-sm space-y-6">
            {linkInvalid ? (
              <div className="text-center space-y-3">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                <h2 className="text-xl font-bold text-foreground">Enlace inválido</h2>
                <p className="text-muted-foreground text-sm">
                  Este enlace de restablecimiento no es válido. Solicita uno nuevo desde la pantalla de inicio de sesión.
                </p>
                <Link href="/login" className="inline-block text-kiri-emerald text-sm font-bold hover:underline pt-2">
                  Volver a iniciar sesión
                </Link>
              </div>
            ) : done ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-kiri-emerald mx-auto" />
                <h2 className="text-xl font-bold text-foreground">¡Contraseña actualizada!</h2>
                <p className="text-muted-foreground text-sm">Ya puedes iniciar sesión con tu nueva contraseña.</p>
                <Button onClick={() => router.replace("/login")} className="w-full h-12 rounded-xl bg-kiri-emerald hover:bg-kiri-sage text-white font-bold mt-2">
                  Ir a iniciar sesión
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Elige tu nueva contraseña</h2>
                  <p className="text-muted-foreground text-sm mt-1">Para la cuenta {email}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Nueva contraseña</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="h-12 rounded-xl pr-12"
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Confirmar nueva contraseña</Label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Repite la nueva contraseña"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="h-12 rounded-xl"
                      autoComplete="new-password"
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-xl p-3">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !newPassword || !confirmPassword}
                    className="w-full h-12 rounded-xl bg-kiri-emerald hover:bg-kiri-sage text-white font-bold"
                  >
                    {loading ? "Guardando..." : "Restablecer contraseña"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
