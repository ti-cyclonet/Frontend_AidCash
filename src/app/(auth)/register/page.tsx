"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Eye, EyeOff, AlertCircle, CheckCircle2, Sprout, Sparkles } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { inviteLinksApi, INVITACION_KEY } from "@/lib/api-client"
import { ConsentChecks } from "@/components/legal/ConsentChecks"
import { tr } from "@/lib/i18n"

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" /></div>}>
      <RegisterContent />
    </Suspense>
  )
}

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planFromUrl = searchParams.get("plan")
  const { signUp } = useAuth()

  // Llegó con un enlace de invitación: se guarda el código (el registro lo
  // envía) y se muestra quién lo invitó.
  const [invitadoPor, setInvitadoPor] = useState<{ nombre: string; rol: string } | null>(null)
  useEffect(() => {
    let code = searchParams.get("invitacion")
    try {
      if (code) localStorage.setItem(INVITACION_KEY, code)
      else code = localStorage.getItem(INVITACION_KEY)
    } catch { /* sin storage */ }
    if (!code) return
    inviteLinksApi.publico(code).then(({ data }) => {
      if (data) setInvitadoPor({ nombre: data.inviter.nombre.split(" ")[0], rol: { FRIEND: "amigo", FAMILY: "familia", PARTNER: "pareja" }[data.role] })
    })
  }, [searchParams])

  const [nombre, setNombre] = useState("")
  const [secondName, setSecondName] = useState("")
  const [firstSurname, setFirstSurname] = useState("")
  const [secondSurname, setSecondSurname] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [documentType, setDocumentType] = useState("CC")
  const [documentNumber, setDocumentNumber] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [aceptaDatos, setAceptaDatos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthLabel = ["", tr("Débil"), "Moderada", "Fuerte"]
  const strengthColor = ["", "bg-destructive", "bg-yellow-400", "bg-cyclon-mint"]

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError(tr("El primer nombre es obligatorio.")); return }
    if (!firstSurname.trim()) { setError(tr("El primer apellido es obligatorio.")); return }
    if (password !== confirm) { setError(tr("Las contraseñas no coinciden.")); return }
    if (password.length < 6) { setError(tr("La contraseña debe tener al menos 6 caracteres.")); return }
    if (!documentNumber.trim()) { setError(tr("El número de documento es obligatorio.")); return }
    if (!aceptaTerminos || !aceptaDatos) { setError(tr("Debes aceptar los Términos y Condiciones y autorizar el tratamiento de tus datos.")); return }
    setLoading(true)
    setError(null)
    // Concatenar nombre completo para la BD de Kiri
    const fullName = [nombre, secondName, firstSurname, secondSurname].filter(Boolean).join(' ')
    const { error, verificationRequired } = await signUp(email, password, fullName, documentType, documentNumber, nombre, secondName, firstSurname, secondSurname, true) as any
    if (error) {
      setError(error)
      setLoading(false)
      return
    }
    if (verificationRequired) {
      setSuccess(true)
      setLoading(false)
      return
    }
    router.replace("/onboarding")
  }

  // Verification pending screen
  if (success) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="bg-kiri-forest px-6 pt-16 pb-10 flex flex-col items-center gap-4">
          <div className="h-20 w-20 bg-kiri-sage/30 backdrop-blur-sm rounded-[1.5rem] shadow-xl flex items-center justify-center">
            <Sprout className="h-10 w-10 text-kiri-cream" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">{tr("Kiri Finance")}</h1>
            <p className="text-white/50 text-xs mt-1">{tr("Tu dinero, tu futuro, tu control")}</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md text-center space-y-4">
            <div className="h-20 w-20 bg-kiri-emerald/10 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-kiri-emerald" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-black text-foreground">{tr("¡Revisa tu correo! 📧")}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">{tr("Te enviamos un enlace de verificación a")}{" "}<strong className="text-foreground">{email}</strong>{tr(". Confirma tu correo para activar tu cuenta y empezar a organizar tus finanzas.")}</p>
            <Link href="/login" className="inline-block mt-4 font-bold text-kiri-emerald hover:underline">{tr("Ir a Iniciar sesión")}</Link>
          </div>
        </div>
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
          <h1 className="text-2xl font-bold text-white">{tr("Kiri Finance")}</h1>
          <p className="text-white/50 text-xs mt-1">{tr("Tu dinero, tu futuro, tu control")}</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex-1 flex justify-center overflow-y-auto">
        <div className="w-full max-w-md px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-foreground">{tr("Crear cuenta")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{tr("Empieza a organizar tus finanzas hoy")}</p>
        </div>

        {invitadoPor && (
          <div className="flex items-center gap-3 rounded-2xl border border-kiri-emerald/30 bg-kiri-emerald/5 px-4 py-3">
            <span className="text-xl">💌</span>
            <p className="text-xs">
              <strong>{invitadoPor.nombre}</strong>{" "}{tr("te invitó a Kiri. Al crear tu cuenta quedarán conectados como")}{" "}<strong>{invitadoPor.rol}</strong>{". "}
              <strong className="text-amber-700 dark:text-amber-300">{tr("Tienes 14 días de KIRI PLUS gratis.")}</strong>
            </p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("Primer Nombre *")}</Label>
              <Input
                placeholder={tr("Primer nombre")}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="h-12 rounded-2xl"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("Segundo Nombre")}</Label>
              <Input
                placeholder={tr("Segundo nombre")}
                value={secondName}
                onChange={e => setSecondName(e.target.value)}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("Primer Apellido *")}</Label>
              <Input
                placeholder={tr("Primer apellido")}
                value={firstSurname}
                onChange={e => setFirstSurname(e.target.value)}
                className="h-12 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("Segundo Apellido")}</Label>
              <Input
                placeholder={tr("Segundo apellido")}
                value={secondSurname}
                onChange={e => setSecondSurname(e.target.value)}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{tr("Correo electrónico")}</Label>
            <Input
              type="email"
              placeholder={tr("tu@correo.com")}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-12 rounded-2xl"
              autoComplete="email"
            />
          </div>

          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("Tipo Doc. *")}</Label>
              <select
                value={documentType}
                onChange={e => setDocumentType(e.target.value)}
                className="h-12 rounded-2xl border border-input bg-background px-3 text-sm w-full"
              >
                <option value="CC">C.C.</option>
                <option value="CE">C.E.</option>
                <option value="PP">{tr("Pasaporte")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("Número de Documento *")}</Label>
              <Input
                placeholder={tr("Número de documento")}
                value={documentNumber}
                onChange={e => setDocumentNumber(e.target.value)}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{tr("Contraseña")}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={tr("Mínimo 6 caracteres")}
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
                <p className="text-[10px] text-muted-foreground">{tr("Seguridad: {0}", [strengthLabel[passwordStrength]])}</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{tr("Confirmar contraseña")}</Label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder={tr("Repite tu contraseña")}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={cn("h-12 rounded-2xl", confirm && confirm !== password && "border-destructive focus-visible:ring-destructive")}
              autoComplete="new-password"
            />
            {confirm && confirm !== password && (
              <p className="text-[10px] text-destructive">{tr("Las contraseñas no coinciden")}</p>
            )}
          </div>

          <ConsentChecks terms={aceptaTerminos} datos={aceptaDatos} onTerms={setAceptaTerminos} onDatos={setAceptaDatos} />

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
            disabled={loading || !nombre || !firstSurname || !email || !password || !confirm || !documentNumber || !aceptaTerminos || !aceptaDatos}
            className="w-full h-14 rounded-2xl bg-kiri-emerald hover:bg-kiri-sage text-white font-bold text-base shadow-xl shadow-kiri-emerald/30 mt-2"
          >
            {loading ? tr("Creando cuenta...") : tr("Crear Cuenta")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">{tr("¿Ya tienes cuenta?{0}", [" "])}<Link href="/login" className="font-bold text-kiri-emerald hover:underline">{tr("Inicia sesión")}</Link>
        </p>
        </div>
      </div>
    </div>
  )
}
