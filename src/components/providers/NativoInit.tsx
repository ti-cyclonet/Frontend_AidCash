"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { iniciarNativo } from "@/lib/nativo"

/** Conecta la app nativa (barra de estado, botón atrás, enlaces). En la web no hace nada. */
export function NativoInit() {
  const router = useRouter()
  useEffect(() => { iniciarNativo({ back: () => router.back(), push: r => router.push(r) }) }, [router])
  return null
}
