import type { LegalDocument } from "@/lib/legal/kiri-legal"

/** Texto completo de un documento legal de Kiri (página pública y diálogo). */
export function LegalDocumentView({ doc, compact = false }: { doc: LegalDocument; compact?: boolean }) {
  return (
    <article className="space-y-5 text-sm leading-relaxed text-foreground/90">
      {!compact && (
        <header className="space-y-1">
          <h1 className="text-2xl font-black text-foreground">{doc.title}</h1>
          <p className="text-xs text-muted-foreground">Actualizado el {doc.updated} · versión {doc.version}</p>
        </header>
      )}
      <p>{doc.intro}</p>
      {doc.sections.map(section => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-base font-bold text-foreground">{section.heading}</h2>
          {section.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
          {section.items && (
            <ul className="list-disc space-y-1.5 pl-5 marker:text-kiri-emerald">
              {section.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          )}
        </section>
      ))}
      {compact && <p className="text-[11px] text-muted-foreground">Actualizado el {doc.updated} · versión {doc.version}</p>}
    </article>
  )
}
