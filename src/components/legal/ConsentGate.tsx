"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ConsentChecks } from "@/components/legal/ConsentChecks"
import { legalApi } from "@/lib/api-client"
import { LEGAL_VERSIONS } from "@/lib/legal/kiri-legal"
import { useAuth } from "@/lib/auth-context"

/**
 * Cuentas creadas antes de que se exigieran los documentos (o cuando cambia su
 * versión): la app queda bloqueada hasta aceptarlos, o hasta cerrar sesión.
 */
export function ConsentGate() {
  const router = useRouter()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [actualizados, setActualizados] = useState(false)
  const [terms, setTerms] = useState(false)
  const [datos, setDatos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    legalApi.estado().then(({ data }) => {
      if (!data?.pendiente) return
      // Ya había aceptado una versión anterior: el texto cambió
      setActualizados(!!data.aceptadas?.terms || !!data.aceptadas?.habeasData)
      setOpen(true)
    })
  }, [])

  const aceptar = async () => {
    setError("")
    setEnviando(true)
    const { error: err } = await legalApi.aceptar()
    setEnviando(false)
    if (err) { setError(err); return }
    setOpen(false)
  }

  const salir = async () => {
    await signOut()
    router.replace("/login")
  }

  if (!open) return null

  return (
    <Dialog open onOpenChange={() => { /* no se cierra sin aceptar */ }}>
      <DialogContent
        className="[&>button:last-child]:hidden"
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-kiri-emerald/10">
            <ShieldCheck className="h-6 w-6 text-kiri-emerald" />
          </div>
          <DialogTitle>{actualizados ? "Actualizamos nuestros documentos" : "Antes de continuar"}</DialogTitle>
          <DialogDescription>
            {actualizados
              ? "Cambiaron los Términos y Condiciones o la autorización de tratamiento de datos de Kiri. Léelos y acéptalos para seguir usando la app."
              : "Para seguir usando Kiri necesitamos que aceptes los Términos y Condiciones y autorices el tratamiento de tus datos personales."}
          </DialogDescription>
        </DialogHeader>

        <ConsentChecks terms={terms} datos={datos} onTerms={setTerms} onDatos={setDatos} />
        {error && <p className="rounded-lg bg-destructive/10 p-2 text-xs font-bold text-destructive">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={salir} disabled={enviando}>Cerrar sesión</Button>
          <Button onClick={aceptar} disabled={!terms || !datos || enviando} className="gap-2 bg-kiri-emerald text-white hover:bg-kiri-sage">
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Aceptar y continuar
          </Button>
        </DialogFooter>
        <p className="text-[10px] text-muted-foreground">Versiones {LEGAL_VERSIONS.terms} y {LEGAL_VERSIONS.habeasData}.</p>
      </DialogContent>
    </Dialog>
  )
}
