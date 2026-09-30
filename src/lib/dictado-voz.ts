/**
 * Utilidades del dictado por voz (Web Speech API).
 *
 * Chrome en Android, en modo continuo, manda cada frase final con lo anterior
 * incluido ("crea una" → "crea una categoría") y a veces repite la misma frase
 * al reanudar; al juntarlas todas salía "crea una categoria crea una
 * categorias crea una categoria". `unirFrases` quita esas versiones repetidas
 * sin tocar frases distintas que empiezan igual ("pagué el arriendo" y
 * "pagué el agua").
 */

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)
// "categoria" y "categorias" son la misma palabra oída dos veces
const mismaPalabra = (a: string, b: string) => a === b || a.replace(/s$/, "") === b.replace(/s$/, "")

/** ¿Una frase es otra versión (más corta o más larga) de la misma? */
function esOtraVersion(a: string[], b: string[]): boolean {
  const corta = a.length <= b.length ? a : b
  const larga = corta === a ? b : a
  if (!corta.length) return true
  return corta.every((w, i) => mismaPalabra(w, larga[i]))
}

/** Junta los pedazos que dio el reconocedor sin repetir frases. */
export function unirFrases(partes: string[]): string {
  const out: string[] = []
  for (const p of partes.map(s => s.trim()).filter(Boolean)) {
    const ultima = out[out.length - 1]
    if (ultima !== undefined && esOtraVersion(normalizar(ultima), normalizar(p))) {
      // Se queda la versión más completa (si empatan, la más reciente)
      if (normalizar(p).length >= normalizar(ultima).length) out[out.length - 1] = p
      continue
    }
    out.push(p)
  }
  return out.join(" ").replace(/\s+/g, " ").trim()
}

export function esIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export function esAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)
}
