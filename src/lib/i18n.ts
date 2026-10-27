/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Idioma de la app (español / inglés)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * El texto de la app se escribe en español y se pasa por `tr()`:
 *
 *   tr("Registrar ingreso")                  → "Register income" en inglés
 *   tr("Te quedan {0} días", [dias])         → "You have {0} days left"
 *
 * El español ES la clave: si una frase no está en el diccionario inglés
 * (lib/i18n-en.ts) se muestra en español, nunca se rompe nada.
 *
 * El idioma se lee una sola vez al cargar (localStorage → navegador) y al
 * cambiarlo la app se recarga: así también se traducen las constantes que se
 * arman al importar un módulo (guías, filtros, pasos del test…). El idioma de
 * la cuenta vive en el backend (User.idioma); ver `sincronizarIdioma`.
 *
 * El diccionario inglés pesa ~80 KB comprimido y antes lo descargaba TODO el
 * mundo. Ahora solo se pide en inglés y queda guardado en el navegador (clave
 * con el hash del diccionario, que calcula next.config.ts): desde la segunda
 * visita se lee al instante. La primera vez llega después de pintar y la app se
 * recarga una sola vez para que también las constantes queden en inglés.
 */

export type Idioma = "es" | "en"
export const IDIOMAS: { v: Idioma; nombre: string; bandera: string }[] = [
  { v: "es", nombre: "Español", bandera: "🇨🇴" },
  { v: "en", nombre: "English", bandera: "🇺🇸" },
]

const CLAVE = "kiri_idioma"

function idiomaInicial(): Idioma {
  if (typeof window === "undefined") return "es"
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === "es" || guardado === "en") return guardado
  } catch { /* sin storage */ }
  return (navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es"
}

let idiomaActual: Idioma = idiomaInicial()
if (typeof document !== "undefined") document.documentElement.lang = idiomaActual

let EN: Record<string, string> = {}
const CLAVE_EN = `kiri_en_${process.env.KIRI_EN_HASH || "dev"}`

/** Descarga el diccionario inglés y lo deja guardado. true si quedó guardado en el navegador. */
async function descargarIngles(): Promise<boolean> {
  const m = await import("@/lib/i18n-en")
  EN = m.EN
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith("kiri_en_") && k !== CLAVE_EN) localStorage.removeItem(k)
    }
    localStorage.setItem(CLAVE_EN, JSON.stringify(m.EN))
    return true
  } catch { return false }
}

if (typeof window !== "undefined" && idiomaActual === "en") {
  let enCache = false
  try { const s = localStorage.getItem(CLAVE_EN); if (s) { EN = JSON.parse(s); enCache = true } } catch { /* sin storage */ }
  if (!enCache) {
    descargarIngles().then(guardado => {
      // Una sola recarga (sessionStorage evita un bucle si el navegador no guarda nada)
      try {
        if (guardado && !sessionStorage.getItem("kiri_en_recargado")) { sessionStorage.setItem("kiri_en_recargado", "1"); window.location.reload(); return }
      } catch { /* sin storage */ }
      window.dispatchEvent(new Event("kiri:idioma-listo"))
    }).catch(() => { /* sin red: se queda en español */ })
  }
}

export const idioma = (): Idioma => idiomaActual

/** Locale para fechas y horas ("es-CO" / "en-US"). */
export const localeFecha = (): string => (idiomaActual === "en" ? "en-US" : "es-CO")

/**
 * Traduce un texto escrito en español. `vars` reemplaza {0}, {1}… (o {nombre}
 * si se pasa un objeto) en el texto ya traducido.
 */
export function tr(es: string, vars?: unknown[] | Record<string, unknown>): string {
  const base = idiomaActual === "en" ? (EN[es] ?? es) : es
  if (!vars) return base
  return base.replace(/\{(\w+)\}/g, (m, k) => {
    const v = Array.isArray(vars) ? vars[Number(k)] : vars[k]
    // Igual que React: false/true/null/undefined no se muestran
    return v === undefined || v === null || typeof v === "boolean" ? "" : String(v)
  })
}

/** Cambia el idioma y recarga la app (así todo, incluso las constantes, queda en el nuevo). */
export function cambiarIdioma(nuevo: Idioma, recargar = true) {
  try { localStorage.setItem(CLAVE, nuevo) } catch { /* sin storage */ }
  if (nuevo === idiomaActual) return
  idiomaActual = nuevo
  if (!recargar || typeof window === "undefined") return
  // Al pasar a inglés se descarga el diccionario ANTES de recargar (una sola recarga)
  if (nuevo === "en") descargarIngles().catch(() => false).finally(() => window.location.reload())
  else window.location.reload()
}

/**
 * Al cargar el perfil: si la cuenta tiene otro idioma que este navegador, se
 * adopta el de la cuenta (una sola recarga). Devuelve true si va a recargar.
 */
export function sincronizarIdioma(deLaCuenta: string | null | undefined): boolean {
  if (deLaCuenta !== "es" && deLaCuenta !== "en") return false
  if (deLaCuenta === idiomaActual) {
    try { localStorage.setItem(CLAVE, deLaCuenta) } catch { /* sin storage */ }
    return false
  }
  cambiarIdioma(deLaCuenta)
  return true
}
