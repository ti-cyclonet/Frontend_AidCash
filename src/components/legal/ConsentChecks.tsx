"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LegalDocumentView } from "@/components/legal/LegalDocumentView"
import { KIRI_HABEAS_DATA, KIRI_TERMS, type LegalDocument } from "@/lib/legal/kiri-legal"

/**
 * Las dos aceptaciones, por separado (la autorización de datos debe ser
 * expresa e independiente de los términos). Cada enlace abre el documento
 * completo sin salir del formulario.
 */
export function ConsentChecks({
  terms, datos, onTerms, onDatos,
}: { terms: boolean; datos: boolean; onTerms: (v: boolean) => void; onDatos: (v: boolean) => void }) {
  const [viendo, setViendo] = useState<LegalDocument | null>(null)

  const abrir = (doc: LegalDocument) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setViendo(doc)
  }

  return (
    <div className="space-y-2.5">
      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed">
        <input type="checkbox" checked={terms} onChange={e => onTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-kiri-emerald" />
        <span>
          Soy mayor de edad y acepto los{" "}
          <a href="/legal/terminos" onClick={abrir(KIRI_TERMS)} className="font-bold text-kiri-emerald underline underline-offset-2">Términos y Condiciones de Kiri Finance</a>.
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed">
        <input type="checkbox" checked={datos} onChange={e => onDatos(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-kiri-emerald" />
        <span>
          Autorizo a CycloNet S.A.S. el{" "}
          <a href="/legal/datos" onClick={abrir(KIRI_HABEAS_DATA)} className="font-bold text-kiri-emerald underline underline-offset-2">tratamiento de mis datos personales</a>
          , incluida mi información financiera, según la Ley 1581 de 2012.
        </span>
      </label>

      <Dialog open={!!viendo} onOpenChange={o => { if (!o) setViendo(null) }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="pr-6 text-base">{viendo?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(85vh-9rem)] overflow-y-auto px-6 py-4">
            {viendo && <LegalDocumentView doc={viendo} compact />}
          </div>
          <div className="flex justify-end gap-2 border-t px-6 py-3">
            <Button
              onClick={() => {
                if (viendo?.key === "terminos") onTerms(true)
                if (viendo?.key === "datos") onDatos(true)
                setViendo(null)
              }}
              className="bg-kiri-emerald text-white hover:bg-kiri-sage"
            >
              {viendo?.key === "terminos" ? "Acepto los términos" : "Autorizo el tratamiento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Campos que se envían al backend junto con la aceptación. */
export { LEGAL_VERSIONS } from "@/lib/legal/kiri-legal"
