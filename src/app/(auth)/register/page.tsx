"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Eye, EyeOff, AlertCircle, CheckCircle2, Sprout } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

export default function RegisterPage() {
  const router = useRouter()
  const { signUp } = useAuth()

  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthLabel = ["", "Débil", "Moderada", "Fuerte"]
  const strengthColor = ["", "bg-destructive", "bg-yellow-400", "bg-cyclon-mint"]

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return }
    setLoading(true)
    setError(null)
    const { error } = await signUp(email, password, nombre)
    if (error) {
      setError(error)
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex flex-col min-h-screen bg-background items-center justify-center px-6 gap-6">
        <div className="h-20 w-20 bg-kiri-mint/20 rounded-3xl flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-kiri-emerald" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black">¡Cuenta creada!</h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            Te enviamos un correo de confirmación a <strong>{email}</strong>. Confírmalo para activar tu cuenta.
          </p>
        </div>
        <Button
          onClick={() => router.replace("/login")}
          className="w-full h-14 rounded-2xl bg-kiri-emerald text-white font-bold shadow-xl shadow-kiri-emerald/30"
        >
          Ir a Iniciar Sesión
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="bg-kiri-forest px-6 pt-16 pb-10 flex flex-col items-center gap-4">
        <div className="h-20 w-20 bg-kiri-sage/30 backdrop-blur-sm rounded-[1.5rem] shadow-xl flex items-center justify-center">
          <Sprout className="h-10 w-10 text-kiri-cream" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Kiri Finance</h1>
          <p className="text-white/50 text-xs mt-1">Tu dinero, tu futuro, tu control</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex-1 flex justify-center overflow-y-auto">
        <div className="w-full max-w-md px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-foreground">Crear cuenta</h2>
          <p className="text-muted-foreground text-sm mt-1">Empieza a organizar tus finanzas hoy</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre completo</Label>
            <Input
              placeholder="Tu nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="h-12 rounded-2xl"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Correo electrónico</Label>
            <Input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-12 rounded-2xl"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Contraseña</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-12 rounded-2xl pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={cn("h-1 flex-1 rounded-full transition-all", i <= passwordStrength ? strengthColor[passwordStrength] : "bg-muted")}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Seguridad: {strengthLabel[passwordStrength]}</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Confirmar contraseña</Label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Repite tu contraseña"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={cn("h-12 rounded-2xl", confirm && confirm !== password && "border-destructive focus-visible:ring-destructive")}
              autoComplete="new-password"
            />
            {confirm && confirm !== password && (
              <p className="text-[10px] text-destructive">Las contraseñas no coinciden</p>
            )}
          </div>

          {error && (
            <Card className="border-destructive/20 bg-destructive/10 shadow-none rounded-2xl">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          <Button
            type="submit"
            disabled={loading || !nombre || !email || !password || !confirm}
            className="w-full h-14 rounded-2xl bg-kiri-emerald hover:bg-kiri-sage text-white font-bold text-base shadow-xl shadow-kiri-emerald/30 mt-2"
          >
            {loading ? "Creando cuenta..." : "Crear Cuenta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-bold text-kiri-emerald hover:underline">
            Inicia sesión
          </Link>
        </p>
        </div>
      </div>
    </div>
  )
}
