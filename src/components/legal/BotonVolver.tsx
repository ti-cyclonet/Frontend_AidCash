"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { tr } from "@/lib/i18n"

/**
 * "Volver" de las páginas legales: regresa a donde estaba (Perfil, el registro,
 * el aviso de Términos…). Si la página se abrió sola (enlace directo, pestaña
 * nueva), no hay a dónde volver y lleva al inicio de la app.
 */
export function BotonVolver({ className }: { className?: string }) {
  const router = useRouter()
  const volver = () => {
    const vieneDeKiri = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin)
    if (vieneDeKiri && window.history.length > 1) router.back()
    else router.push("/")
  }
  return (
    <button type="button" onClick={volver} className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors", className)}>
      <ArrowLeft className="h-4 w-4" />{" "}{tr("Volver")}
    </button>
  )
}
