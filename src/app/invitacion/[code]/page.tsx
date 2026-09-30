"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Sprout, Users, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/social/UserAvatar"
import { useAuth } from "@/lib/auth-context"
import { inviteLinksApi, INVITACION_KEY, type InvitacionPublica } from "@/lib/api-client"
import { tr } from "@/lib/i18n"

const ROLE_TEXTO = { FRIEND: "amigo", FAMILY: "familia", PARTNER: "pareja" } as const

/**
 * Destino del enlace de invitación. Sin sesión: guarda el código y lleva a
 * crear la cuenta (el registro lo manda al backend y quedan conectados en
 * Social). Con sesión: conecta de una con quien invitó.
 */
export default function InvitacionPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [info, setInfo] = useState<InvitacionPublica | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aceptando, setAceptando] = useState(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    inviteLinksApi.publico(code).then(({ data, error: err }) => {
      if (err || !data) { setError(err ?? tr("Este enlace de invitación no existe")); return }
      setInfo(data)
      try { localStorage.setItem(INVITACION_KEY, data.code) } catch { /* sin storage */ }
    })
  }, [code])

  const propio = !!(user && info && user.id === info.inviter.id)

  const aceptar = async () => {
    setAceptando(true)
    const { error: err } = await inviteLinksApi.aceptar(code)
    setAceptando(false)
    try { localStorage.removeItem(INVITACION_KEY) } catch { /* sin storage */ }
    if (err) { setError(err); return }
    setListo(true)
  }

  const nombre = info?.inviter.nombre.split(" ")[0] ?? ""

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="bg-kiri-forest px-6 pt-14 pb-10 flex flex-col items-center gap-3">
        <div className="h-16 w-16 bg-kiri-sage/30 rounded-[1.25rem] shadow-xl flex items-center justify-center">
          <Sprout className="h-8 w-8 text-kiri-cream" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-bold text-white">{tr("Kiri Finance")}</h1>
      </div>

      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center space-y-5">
          {error && !info ? (
            <>
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="text-sm font-bold">{error}</p>
              <Link href="/register" className="inline-block text-sm font-bold text-kiri-emerald hover:underline">{tr("Crear mi cuenta igual")}</Link>
            </>
          ) : !info || authLoading ? (
            <div className="h-8 w-8 mx-auto rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          ) : (
            <>
              <UserAvatar nombre={info.inviter.nombre} avatarUrl={info.inviter.avatarUrl} className="h-20 w-20 mx-auto ring-4 ring-kiri-emerald/20" fallbackClassName="text-xl" />
              <div className="space-y-1">
                <h2 className="text-2xl font-black">{tr("{0} te invitó a Kiri 🌱", [nombre])}</h2>
                <p className="text-sm text-muted-foreground">{tr("Organiza tu plata, ahorra y cuida tu jardín financiero. Quedarán conectados como")}{" "}<strong className="text-foreground">{ROLE_TEXTO[info.role]}</strong>.
                </p>
              </div>

              {listo ? (
                <div className="space-y-3">
                  <div className="h-11 w-11 rounded-full bg-kiri-emerald/10 flex items-center justify-center mx-auto"><Check className="h-5 w-5 text-kiri-emerald" /></div>
                  <p className="text-sm font-bold">{tr("¡Ya están conectados!")}</p>
                  <Button onClick={() => router.push("/social")} className="w-full h-12 rounded-2xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold gap-2"><Users className="h-4 w-4" />{" "}{tr("Ir a Social")}</Button>
                </div>
              ) : propio ? (
                <p className="text-sm text-muted-foreground">{tr("Este es tu propio enlace. Compártelo con quien quieras invitar.")}</p>
              ) : user ? (
                <div className="space-y-2">
                  <Button onClick={aceptar} disabled={aceptando} className="w-full h-12 rounded-2xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold">
                    {aceptando ? "Conectando…" : tr("Conectar con {0}", [nombre])}
                  </Button>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <Button onClick={() => router.push(`/register?invitacion=${info.code}`)} className="w-full h-12 rounded-2xl bg-kiri-emerald hover:bg-kiri-emerald/90 text-white font-bold">{tr("Crear mi cuenta gratis")}</Button>
                  <Button variant="outline" onClick={() => router.push("/login")} className="w-full h-11 rounded-2xl font-bold">{tr("Ya tengo cuenta")}</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
