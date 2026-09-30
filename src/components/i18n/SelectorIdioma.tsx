"use client"

import { useEffect, useState } from "react"
import { cambiarIdioma, idioma, IDIOMAS, type Idioma } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * ES | EN para las pantallas sin sesión (entrar, registrarse, restablecer).
 * Con sesión el idioma se cambia desde Perfil y queda guardado en la cuenta.
 */
export function SelectorIdioma({ className }: { className?: string }) {
  // Se lee al montar (en el servidor no hay idioma del navegador)
  const [actual, setActual] = useState<Idioma | null>(null)
  useEffect(() => { setActual(idioma()) }, [])
  if (!actual) return null
  return (
    <div className={cn("fixed top-3 right-3 z-50 flex rounded-full bg-background/80 backdrop-blur border border-border p-0.5 text-[11px] font-bold shadow-sm", className)}
      role="group" aria-label="Idioma / Language">
      {IDIOMAS.map(i => (
        <button key={i.v} type="button" onClick={() => cambiarIdioma(i.v)} aria-pressed={actual === i.v}
          className={cn("px-2.5 py-1 rounded-full transition-colors", actual === i.v ? "bg-kiri-emerald text-white" : "text-muted-foreground hover:text-foreground")}>
          {i.v.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
