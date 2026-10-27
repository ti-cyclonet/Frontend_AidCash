import * as THREE from "three"

/** Utilidades del árbol 3D. Las numéricas viven en matematica.ts (sin Three.js). */
export { backOut, clamp, hash3, lerp, piece, rng, smooth, vnoise, type Rng } from "./matematica"

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
