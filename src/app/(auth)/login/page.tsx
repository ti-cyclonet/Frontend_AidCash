"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Eye, EyeOff, AlertCircle, Sprout, Mail, CheckCircle2 } from "lucide-react"
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
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  const handleForgotPassword = async () => {
    if (!forgotEmail) return
    setForgotLoading(true)
    setForgotError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: forgotEmail }),
      })
      if (res.ok) {
        setForgotSent(true)
      } else {
        const data = await res.json()
        setForgotError(data.error || 'Error al enviar el correo')
      }
    } catch {
      setForgotError('Error de conexión')
    }
    setForgotLoading(false)
  }

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
            <p className="text-white/50 text-xs mt-1">Tu dinero, tu futuro, tu control</p>
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
                <div className="flex items-center justify-between">
                  <Label>Contraseña</Label>
                  <button type="button" onClick={() => { setForgotOpen(true); setForgotEmail(email); setForgotSent(false); setForgotError(null) }}
                    className="text-[11px] font-medium text-kiri-emerald hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
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

      {/* Modal Recuperar Contraseña */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-kiri-emerald" /> Recuperar contraseña
            </DialogTitle>
            <DialogDescription>
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </DialogDescription>
          </DialogHeader>

          {forgotSent ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <div className="h-14 w-14 bg-kiri-emerald/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-kiri-emerald" />
              </div>
              <p className="font-bold text-sm">¡Correo enviado!</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Revisa tu bandeja de entrada en <strong>{forgotEmail}</strong>. Si no lo ves, revisa la carpeta de spam.
              </p>
              <Button onClick={() => setForgotOpen(false)} className="mt-2 rounded-xl bg-kiri-emerald text-white font-bold">
                Entendido
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Correo electrónico</Label>
                  <Input
                    type="email"
                    placeholder="tu@correo.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    className="h-11 rounded-xl"
                    autoFocus
                  />
                </div>
                {forgotError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {forgotError}
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setForgotOpen(false)}>Cancelar</Button>
                <Button onClick={handleForgotPassword} disabled={forgotLoading || !forgotEmail}
                  className="bg-kiri-emerald text-white font-bold rounded-xl px-6">
                  {forgotLoading ? "Enviando..." : "Enviar enlace"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
