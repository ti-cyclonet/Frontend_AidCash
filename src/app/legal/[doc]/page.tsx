import Link from "next/link"
import { notFound } from "next/navigation"
import { Sprout } from "lucide-react"
import { LegalDocumentView } from "@/components/legal/LegalDocumentView"
import { KIRI_HABEAS_DATA, KIRI_TERMS, legalDocument } from "@/lib/legal/kiri-legal"

/** Páginas públicas: /legal/terminos y /legal/datos (se pueden abrir sin sesión). */
export function generateStaticParams() {
  return [{ doc: "terminos" }, { doc: "datos" }]
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  const doc = legalDocument((await params).doc)
  return { title: doc ? `${doc.key === "terminos" ? "Términos y Condiciones" : "Tratamiento de datos"} · Kiri Finance` : "Kiri Finance" }
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const doc = legalDocument((await params).doc)
  if (!doc) notFound()
  const otro = doc.key === "terminos" ? KIRI_HABEAS_DATA : KIRI_TERMS

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-kiri-forest px-6 py-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kiri-sage/30">
            <Sprout className="h-5 w-5 text-kiri-cream" strokeWidth={1.5} />
          </div>
          <span className="font-bold text-white">Kiri Finance</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <LegalDocumentView doc={doc} />
        <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm">
          <Link href={`/legal/${otro.key}`} className="font-bold text-kiri-emerald hover:underline">{otro.title}</Link>
          <Link href="/register" className="text-muted-foreground hover:underline">Crear cuenta</Link>
          <Link href="/login" className="text-muted-foreground hover:underline">Iniciar sesión</Link>
        </nav>
      </main>
    </div>
  )
}
