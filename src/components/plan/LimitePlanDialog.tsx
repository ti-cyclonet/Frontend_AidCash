"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sparkles, Crown, Lock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { LimitePlanEvento } from "@/lib/api-client"
import { tr } from "@/lib/i18n"

/**
 * Aviso global cuando el backend dice que el plan no alcanza: límite de
 * cantidad (403 LIMITE), función de otro plan (403 FUNCION) o cuota mensual
 * de IA agotada (429 CUOTA_IA). Lo dispara api() con el evento 'kiri:limite'.
 */
export function LimitePlanDialog() {
  const router = useRouter()
  const pathname = usePathname()
  const [aviso, setAviso] = useState<LimitePlanEvento | null>(null)

  useEffect(() => {
    const h = (e: Event) => setAviso((e as CustomEvent<LimitePlanEvento>).detail)
    window.addEventListener("kiri:limite", h)
    return () => window.removeEventListener("kiri:limite", h)
  }, [])

  if (!aviso) return null
  const destino = aviso.mejora?.plan
  const esPro = destino?.includes("PRO")
  const titulo = aviso.codigo === "CUOTA_IA"
    ? tr("Se acabó tu cuota de IA de este mes")
    : aviso.codigo === "FUNCION"
      ? tr("Disponible en {0}", [destino ?? tr("otro plan")])
      : tr("Llegaste al límite de tu plan")

  return (
    <Dialog open onOpenChange={(o) => { if (!o) setAviso(null) }}>
      <DialogContent className="max-w-sm rounded-3xl z-[80]">
        <DialogHeader className="items-center text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${esPro ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10"}`}>
            {aviso.codigo === "FUNCION"
              ? <Lock className={`w-7 h-7 ${esPro ? "text-amber-600" : "text-primary"}`} />
              : esPro ? <Crown className="w-7 h-7 text-amber-600" /> : <Sparkles className="w-7 h-7 text-primary" />}
          </div>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {aviso.mensaje}
            {aviso.plan && <span className="block mt-1 text-xs">{tr("Tu plan actual: {0}", [aviso.plan])}</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          {pathname !== "/mi-plan" && (
            <Button className="gap-2 rounded-xl" onClick={() => { setAviso(null); window.dispatchEvent(new Event("kiri:ir-mi-plan")); router.push("/mi-plan#planes") }}>
              <Sparkles className="w-4 h-4" />
              {destino ? tr("Ver {0}", [destino]) : tr("Ver planes")}
            </Button>
          )}
          <Button variant="ghost" className="rounded-xl" onClick={() => setAviso(null)}>{tr("Ahora no")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
