import { clamp, lerp, smooth, vnoise } from "./utilidades"

/** Forma de la isla: radio, lomas, estanque y hormiguero (todo en unidades de mundo). */

export const IR = 4.7
export const RT = IR + 0.1
export const HILL_XZ: [number, number] = [-2.55, 2.05]
export const POND: [number, number] = [1.55, 2.75]
export const POND_R = 0.95
export const WATER_Y = -4.2
export const ISL_D = 3.6

/** Claros de césped corto donde no crece pasto alto ni flores. */
export const PATCHES = [{ x: 1.7, z: 1.2, r: .55 }, { x: -2.1, z: -0.6, r: .7 }, { x: 0.7, z: -2.4, r: .5 }, { x: -1.2, z: 2.5, r: .45 }, { x: 2.7, z: -1.5, r: .38 }]
export const ROCK_LIST: [number, number, number][] = [[3.3, 1.0, .46], [-3.3, .9, .34], [1.9, -3.1, .4], [-3.2, -1.9, .3], [3.4, -0.7, .24]]

export function inPatch(x: number, z: number, k = 1) {
  if (Math.hypot(x - POND[0], z - POND[1]) < POND_R * 1.12) return true
  if (Math.hypot(x - HILL_XZ[0], z - HILL_XZ[1]) < 1.15) return true
  for (const p of PATCHES) {
    if (Math.hypot(x - p.x, z - p.z) < p.r * k * (0.85 + 0.3 * vnoise(x * 2.1, z * 2.1))) return true
  }
  return false
}

/** Altura del césped en (x, z): lomas suaves, el hueco del estanque y el cauce del arroyo. */
export function Hgt(x: number, z: number) {
  const r = Math.hypot(x, z)
  let h = 0.32 * Math.pow(vnoise(x * 0.3 + 7.1, z * 0.3 + 2.3), 1.4) + 0.04 * vnoise(x * 1.1 + 1, z * 1.1 + 9)
  h *= smooth((r - 1.5) / 1.7); h *= 1 - 0.6 * smooth((r - (IR - 1.0)) / 1.0)
  h *= smooth((Math.hypot(x - HILL_XZ[0], z - HILL_XZ[1]) - 0.85) / 0.75)
  const dp = Math.hypot(x - POND[0], z - POND[1]); h = lerp(-0.24, h, smooth((dp - POND_R * 0.72) / (POND_R * 0.55)))
  const ux = POND[0] / 3.16, uz = POND[1] / 3.16, tt = clamp((x - POND[0]) * ux + (z - POND[1]) * uz, 0, 2.2)
  const qx = POND[0] + ux * tt, qz = POND[1] + uz * tt, ds = Math.hypot(x - qx, z - qz)
  if (tt > 0) h = lerp(-0.2, h, smooth((ds - 0.2) / 0.22))
  return h
}

/** Borde irregular de la isla según el ángulo. */
export const EDGEK = (a: number) => 1 + 0.09 * (vnoise(Math.cos(a) * 2.4 + 9, Math.sin(a) * 2.4 + 9) - 0.5) + 0.02 * Math.sin(a * 7)
