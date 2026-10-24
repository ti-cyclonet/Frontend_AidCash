import * as THREE from "three"

/** Utilidades numéricas del árbol 3D (mismas fórmulas del prototipo). */

export type Rng = () => number

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x) }
export const backOut = (x: number) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }

/** Generador pseudoaleatorio con semilla: la escena sale idéntica en cada carga. */
export function rng(seed: number): Rng {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}

export function vnoise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz
  const a = hash3(ix, iz, 1.3), b = hash3(ix + 1, iz, 1.3), c = hash3(ix, iz + 1, 1.3), d = hash3(ix + 1, iz + 1, 1.3)
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz)
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz)
}

/** Interpolación por tramos suave. */
export function piece(x: number, xs: number[], ys: number[]) {
  if (x <= xs[0]) return ys[0]
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const u = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
      return lerp(ys[i - 1], ys[i], lerp(u, smooth(u), 0.5))
    }
  }
  return ys[ys.length - 1]
}

export function glowTex(inner: string, outer: string) {
  const c = document.createElement("canvas"); c.width = c.height = 128
  const g = c.getContext("2d")!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, inner); gr.addColorStop(1, outer)
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export function lienzo(w: number, h = w) {
  const c = document.createElement("canvas"); c.width = w; c.height = h
  return { c, g: c.getContext("2d")! }
}
