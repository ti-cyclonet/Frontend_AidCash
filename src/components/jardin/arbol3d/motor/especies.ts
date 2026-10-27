import { lerp, type Rng } from "./matematica"

/**
 * Catálogo visual del árbol: especies, colores de hojas y aspectos de los
 * accesorios. Las claves son las mismas que usa el servidor (precios, inventario
 * y lo equipado viven allá); aquí solo está cómo se ve cada cosa.
 */

export type ClaveEspecie = "kiri" | "pino" | "bonsai" | "palmera" | "cerezo"

/** Cómo nace cada rama hija: dónde se pega (t), hacia dónde mira y cuánto se inclina. */
export interface Hija { t: number; yaw: number; tilt: number; lenK: number; leader?: boolean }

export interface Especie {
  nombre: string
  /** Color de hojas propio ("Original") */
  paleta: ClaveColor
  semilla: number
  rad: number[]; len: number[]; leafr: number[]; nk: number[]
  leafL: number; leafW: number; spread: number
  /** Hojas por racimo según la profundidad (0, 1, 2+) */
  counts: number[]
  /** Racimo intermedio a lo largo de la rama, desde `midFrom` */
  mid: number; midFrom: number
  /** Palmera: frondas de hojuelas a lo largo de la rama */
  frond?: boolean; frondN?: number
  /** < 0.75: copas planas horizontales (bonsái, pino) */
  flat: number
  bend0: number
  /** Altura relativa a la del Kiri (la cámara la usa para encuadrar) */
  top: number
  fruta: { color: number; s: number }
  nFrutos?: number
  frutosEn?: "frondBase"
  /** Crecimiento (0–10) en que salen las flores, y cuántas */
  floresG: number; nFlores: number
  /** Kiri: flores extra del nivel 6, algunas rosadas */
  floresExtra?: number
  ramaExtra: boolean
  hija: (TR: Rng, d: number, i: number, n: number, leader: boolean) => Hija
}

const hijaKiri = (TR: Rng, d: number, i: number, n: number, leader: boolean): Hija => {
  const t = d === 0 ? [0.66, 0.73, 0.8, 0.88, 0.99][i] : (leader ? 0.98 : 0.62 + 0.33 * (i / Math.max(1, n - 1)))
  const yaw = (i / n) * Math.PI * 2 + (d === 0 ? TR() * 0.35 : TR() * 0.8) + d * 1.1
  const tilt = leader ? (d === 0 ? 0.12 + TR() * 0.2 : 0.3 + TR() * 0.25) : (d === 0 ? 0.72 + TR() * 0.18 : (d === 1 ? 0.6 + TR() * 0.25 : 0.42 + TR() * 0.22))
  return { t, yaw, tilt, lenK: 1 }
}

export const ESPECIES: Record<ClaveEspecie, Especie> = {
  kiri: {
    nombre: "Kiri", paleta: "verde", semilla: 500, rad: [0.62, 0.34, 0.19, 0.1, 0.05], len: [3.6, 2.5, 1.8, 1.3], leafr: [1.0, 1.15, 1.1, 1.0], nk: [5, 3, 2, 0],
    leafL: 0.2, leafW: 1, spread: 1.3, counts: [36, 76, 120], mid: 76, midFrom: 2, flat: 1, bend0: 0.1, top: 1,
    fruta: { color: 0xd23a22, s: 1 }, floresG: 8.4, nFlores: 64, floresExtra: 110, ramaExtra: true, hija: hijaKiri,
  },
  palmera: {
    nombre: "Palmera", paleta: "palma", semilla: 640, rad: [0.34, 0.07, 0.045, 0.025, 0.02], len: [6.6, 1.8, 1.9, 0.5], leafr: [0.7, 1.05, 0.95, 0.8], nk: [11, 1, 0, 0],
    leafL: 0.4, leafW: 0.2, spread: 0.95, counts: [0, 16, 22], mid: 0, midFrom: 9, frond: true, frondN: 26, flat: 0.9, bend0: 0.32, top: 1.3,
    fruta: { color: 0x6b4a26, s: 0.85 }, nFrutos: 7, frutosEn: "frondBase", floresG: 99, nFlores: 0, ramaExtra: false,
    hija: (TR, d, i, n) => d === 1
      ? { t: 0.98, yaw: 0, tilt: 1.3 + TR() * 0.35, lenK: 0.9 + TR() * 0.2, leader: false }
      : { t: 0.975 + TR() * 0.02, yaw: (i / n) * Math.PI * 2 + TR() * 0.25, tilt: 0.35 + TR() * 0.4, lenK: 0.9 + TR() * 0.25, leader: false },
  },
  cerezo: {
    nombre: "Cerezo", paleta: "sakura", semilla: 812, rad: [0.58, 0.32, 0.18, 0.1, 0.05], len: [3.2, 2.7, 1.9, 1.3], leafr: [1.05, 1.2, 1.15, 1.0], nk: [5, 3, 2, 0],
    leafL: 0.19, leafW: 1, spread: 1.35, counts: [30, 70, 110], mid: 70, midFrom: 2, flat: 0.85, bend0: 0.18, top: 0.95,
    fruta: { color: 0xa3122a, s: 0.55 }, floresG: 5.4, nFlores: 150, ramaExtra: true,
    hija: (TR, d, i, n, leader) => { const k = hijaKiri(TR, d, i, n, leader); if (!leader) k.tilt += 0.18; return k },
  },
  pino: {
    nombre: "Pino", paleta: "pino", semilla: 303, rad: [0.5, 0.12, 0.06, 0.03, 0.02], len: [6.6, 2.7, 1.0, 0.5], leafr: [1.1, 1.35, 1.1, 0.9], nk: [16, 2, 0, 0],
    leafL: 0.3, leafW: 0.2, spread: 1.35, counts: [90, 80, 60], mid: 80, midFrom: 1, flat: 0.7, bend0: 0.02, top: 1.0,
    fruta: { color: 0x3b2412, s: 0.7 }, floresG: 99, nFlores: 0, ramaExtra: false,
    hija: (TR, d, i, n) => {
      if (d === 0) {
        if (i === n - 1) return { t: 0.985, yaw: 0, tilt: 0.02, lenK: 0.55, leader: true }
        const t = 0.2 + 0.74 * (i / (n - 2))
        return { t, yaw: i * 2.399 + TR() * 0.3, tilt: 1.66 + TR() * 0.12, lenK: lerp(1.2, 0.22, (t - 0.2) / 0.74) }
      }
      return { t: 0.45 + 0.45 * i, yaw: (i ? 1 : -1) * 0.9 + TR() * 0.3, tilt: 0.8 + TR() * 0.2, lenK: 0.7 }
    },
  },
  bonsai: {
    nombre: "Bonsái", paleta: "verde", semilla: 921, rad: [0.74, 0.36, 0.17, 0.08, 0.04], len: [2.4, 2.1, 1.35, 0.9], leafr: [1.0, 1.3, 1.35, 1.2], nk: [3, 2, 2, 0],
    leafL: 0.15, leafW: 1, spread: 1.7, counts: [0, 70, 110], mid: 60, midFrom: 2, flat: 0.4, bend0: 0.2, top: 0.62,
    fruta: { color: 0xe8b23a, s: 0.45 }, nFrutos: 0, floresG: 99, nFlores: 0, ramaExtra: false,
    hija: (TR, d, i) => d === 0
      ? { t: [0.5, 0.74, 0.98][i], yaw: [0.3, 2.6, 4.6][i] + TR() * 0.2, tilt: [1.12, 1.0, 0.5][i], lenK: [1.05, 0.9, 0.75][i] }
      : { t: 0.55 + 0.4 * i, yaw: (i ? 1 : -1) * 1.1 + TR() * 0.4, tilt: 1.15 + TR() * 0.25, lenK: 0.85 },
  },
}

/** Colores de hojas: degradado de la textura (claro, oscuro, borde) y brillo propio. */
export const COLORES_HOJA = {
  verde: { nombre: "Verde Kiri", c: ["#78a855", "#4f803a", "#3c6130"], em: 0.14 },
  palma: { nombre: "Verde palma", c: ["#8cc94e", "#3f8a2e", "#2c6420"], em: 0.14 },
  pino: { nombre: "Verde pino", c: ["#4f7f4a", "#2f5a34", "#24452a"], em: 0.14 },
  esmeralda: { nombre: "Esmeralda", c: ["#45b877", "#1f7a4a", "#16583a"], em: 0.14 },
  otono: { nombre: "Otoño", c: ["#ffb347", "#e0602a", "#9c3a18"], em: 0.14 },
  sakura: { nombre: "Sakura", c: ["#ffb6d0", "#f2729f", "#c24a7c"], em: 0.14 },
  dorado: { nombre: "Dorado", c: ["#ffd862", "#d9a21e", "#a87a12"], em: 0.14 },
  lavanda: { nombre: "Lavanda", c: ["#cdb6ff", "#8f74e0", "#6a52b8"], em: 0.14 },
  blanco: { nombre: "Blanco", c: ["#ffffff", "#eef0ea", "#c4c9c0"], em: 0.42 },
  coral: { nombre: "Coral", c: ["#ffa48a", "#f0645a", "#b8403a"], em: 0.14 },
  turquesa: { nombre: "Turquesa", c: ["#6fe0d6", "#21a5a8", "#167478"], em: 0.14 },
  menta: { nombre: "Menta", c: ["#c4f2c8", "#7fd39a", "#4a9e68"], em: 0.22 },
  carmesi: { nombre: "Carmesí", c: ["#f05a5a", "#a8182c", "#6e0e1e"], em: 0.14 },
  morado: { nombre: "Morado", c: ["#b878e8", "#6a2fa8", "#4a1c78"], em: 0.14 },
  atardecer: { nombre: "Atardecer", c: ["#ffd25a", "#f0507a", "#a8305a"], em: 0.14 },
  bosque: { nombre: "Bosque oscuro", c: ["#4a7a3a", "#1f4422", "#142e16"], em: 0.14 },
  noche: { nombre: "Azul noche", c: ["#86b6ff", "#3f5fc8", "#2c4596"], em: 0.14 },
} satisfies Record<string, { nombre: string; c: [string, string, string]; em: number }>
export type ClaveColor = keyof typeof COLORES_HOJA
/** Los 15 de la tienda: "auto" es el color propio de cada especie. */
export const COLORES_TIENDA = ["auto", "esmeralda", "menta", "bosque", "otono", "coral", "turquesa", "sakura", "lavanda", "morado", "noche", "carmesi", "blanco", "atardecer", "dorado"] as const
export type ColorElegido = (typeof COLORES_TIENDA)[number]

/** Aspectos de los accesorios. El primero de cada grupo viene incluido. */
export const ACCESORIOS = {
  hormiguero: {
    arena: { nombre: "Arena", ic: "🏜️", a: 0xc98d4f, b: 0x9a6233, lip: 0xb67a42 },
    arcilla: { nombre: "Arcilla roja", ic: "🧱", a: 0xc4643c, b: 0x8a3a22, lip: 0xb0583a },
    piedra: { nombre: "Piedra", ic: "🪨", a: 0xb8b3a8, b: 0x7a756c, lip: 0x9a958c, peb: 0xd0d0d0 },
    musgo: { nombre: "Musgo", ic: "🌿", a: 0x7aa64e, b: 0x46743a, lip: 0x5d8a3e },
    hongo: { nombre: "Casita hongo", ic: "🍄", a: 0xc98d4f, b: 0x9a6233, lip: 0xb67a42, hongo: true },
  },
  cerca: {
    blanca: { nombre: "Blanca", ic: "🤍", c: 0xf1e4c8 },
    madera: { nombre: "Madera", ic: "🪵", c: 0xa8784a },
    bambu: { nombre: "Bambú", ic: "🎋", c: 0xc2cf6e },
    azul: { nombre: "Azul pastel", ic: "💙", c: 0x9cc4e8 },
    rosa: { nombre: "Rosa", ic: "🩷", c: 0xf2b6c8 },
    dorada: { nombre: "Dorada", ic: "✨", c: 0xe8c050, metal: 0.55 },
  },
  regadera: {
    azul: { nombre: "Azul", ic: "🔵", b: 0x3aa0c0, d: 0x2a7a96 },
    roja: { nombre: "Roja", ic: "🔴", b: 0xd94a3a, d: 0xa83228 },
    verde: { nombre: "Verde", ic: "🟢", b: 0x5fae4a, d: 0x3f8030 },
    rosa: { nombre: "Rosa", ic: "🌷", b: 0xf08ab0, d: 0xc25c86 },
    cobre: { nombre: "Cobre", ic: "🟠", b: 0xc97a46, d: 0x9a5630, metal: 0.6 },
    dorada: { nombre: "Dorada", ic: "🌟", b: 0xe8b82e, d: 0xb8901a, metal: 0.6 },
  },
  frutos: {
    auto: { nombre: "Los de la especie", ic: "🍎" },
    naranja: { nombre: "Naranjas", ic: "🍊", c: 0xf08a24 },
    durazno: { nombre: "Duraznos", ic: "🍑", c: 0xf7a07a },
    limon: { nombre: "Limones", ic: "🍋", c: 0xf2d93a },
    ciruela: { nombre: "Ciruelas", ic: "🫐", c: 0x5e2a78 },
    dorada: { nombre: "Manzanas doradas", ic: "🏅", c: 0xf2c230, metal: 0.5 },
  },
}
export type GrupoAccesorio = keyof typeof ACCESORIOS
export interface AspectoHormiguero { a: number; b: number; lip: number; peb?: number; hongo?: boolean }
export interface AspectoRegadera { b: number; d: number; metal?: number }
export interface AspectoFruto { c?: number; metal?: number }
export interface AspectoCerca { c: number; metal?: number }

/** Lo que el usuario tiene puesto en su árbol. */
export interface Equipado {
  especie: ClaveEspecie
  color: ColorElegido
  hormiguero: keyof typeof ACCESORIOS.hormiguero
  cerca: keyof typeof ACCESORIOS.cerca
  regadera: keyof typeof ACCESORIOS.regadera
  frutos: keyof typeof ACCESORIOS.frutos
}
export const EQUIPADO_INICIAL: Equipado = { especie: "kiri", color: "auto", hormiguero: "arena", cerca: "blanca", regadera: "azul", frutos: "auto" }
