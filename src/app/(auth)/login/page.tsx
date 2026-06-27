"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Eye, EyeOff, AlertCircle, Sprout } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  const router = useRouter()
  const { signIn } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error)
      setLoading(false)
      return
    }
    router.replace("/dashboard")
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding (hidden on mobile) */}
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
        <div className="flex gap-2 mt-4">
          {["🌱", "🌿", "🌳"].map((e, i) => (
            <span key={i} className="text-3xl animate-bounce-slow" style={{ animationDelay: `${i * 200}ms` }}>{e}</span>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <div className="lg:hidden bg-kiri-forest px-6 pt-14 pb-12 flex flex-col items-center gap-4">
          <div className="h-20 w-20 bg-kiri-sage/30 backdrop-blur-sm rounded-[1.5rem] shadow-xl flex items-center justify-center">
            <Sprout className="h-10 w-10 text-kiri-cream" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Kiri Finance</h1>
            <p className="text-white/50 text-xs mt-1">Tus finanzas, en orden</p>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 lg:px-12">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Bienvenido de vuelta</h2>
              <p className="text-muted-foreground text-sm mt-1">Inicia sesión para continuar</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-12 rounded-xl"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label>Contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-12 rounded-xl pr-12"
                    autoComplete="current-password"
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

              {error && (
                <Card className="border-destructive/20 bg-destructive/10 shadow-none rounded-xl">
                  <CardContent className="p-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">{error}</p>
                  </CardContent>
                </Card>
              )}

              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full h-13 rounded-xl bg-kiri-emerald hover:bg-kiri-sage text-white font-semibold text-base shadow-lg shadow-kiri-emerald/20 mt-2 transition-all"
              >
                {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link href="/register" className="font-semibold text-kiri-emerald hover:underline">
                Regístrate gratis
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
