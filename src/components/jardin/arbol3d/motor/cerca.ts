import * as THREE from "three"
import type { AspectoCerca } from "./especies"
import type { Brizna } from "./isla"
import { Hgt, HILL_XZ } from "./terreno"
import { backOut, clamp } from "./utilidades"

/**
 * Cerca del fondo de emergencia: 40 tablitas alrededor de la cama del árbol.
 * El % del fondo decide cuántas están levantadas. Se arma desde el lado opuesto
 * al hormiguero, así que el hueco que mira al hormiguero es lo último que se
 * cierra: mientras no esté completa, las hormigas siguen entrando por ahí.
 */
export const RADIO_CERCA = 1.72
const N = 40

export function crearCerca(world: THREE.Group, bd: Brizna[], chispas: (x: number, y: number, z: number, n: number) => void) {
  const picketGeo = (() => {
    const s = new THREE.Shape(), w = 0.045, h = 0.44
    s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(w, h - 0.05); s.lineTo(0, h); s.lineTo(-w, h - 0.05); s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.028, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 }); g.translate(0, 0, -0.014); return g
  })()
  const mat = new THREE.MeshStandardMaterial({ color: 0xf1e4c8, roughness: 0.8 })
  const pickets = new THREE.InstancedMesh(picketGeo, mat, N), rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.035, 0.022), mat, N * 2)
  pickets.castShadow = true; pickets.receiveShadow = true; rails.castShadow = true
  world.add(pickets); world.add(rails)

  const aHill = Math.atan2(HILL_XZ[1], HILL_XZ[0])
  const tablas = Array.from({ length: N }, (_, k) => {
    const a = aHill + Math.PI + (k / N) * Math.PI * 2, x = Math.cos(a) * RADIO_CERCA, z = Math.sin(a) * RADIO_CERCA
    const lejania = Math.abs(Math.atan2(Math.sin(a - aHill - Math.PI), Math.cos(a - aHill - Math.PI)))
    return { a, x, z, y: Hgt(x, z), orden: lejania + k * 1e-4, s: 0, on: false }
  })
  /* primero las del lado opuesto al hormiguero; las que lo miran, al final */
  const orden = tablas.map((_, i) => i).sort((i, j) => tablas[i].orden - tablas[j].orden)
  /* pasto bajito donde va la cerca, para que no la tape */
  for (const b of bd) if (Math.abs(Math.hypot(b.x, b.z) - RADIO_CERCA) < 0.12) b.h = Math.min(b.h, 0.06)

  let meta = 0, sucio = true
  const dummy = new THREE.Object3D()

  /** Fija el % del fondo (0–100). Devuelve true si con esto la cerca quedó completa. */
  function ponerFondo(pct: number) {
    const n = Math.round(clamp(pct / 100) * N), antes = meta
    meta = n
    for (let i = 0; i < N; i++) tablas[orden[i]].on = i < n
    sucio = true
    return n === N && antes < N
  }
  /** Sin animación: cada tabla queda directamente arriba o abajo (al cargar). */
  function fijar() { for (const p of tablas) p.s = p.on ? 1 : 0; sucio = true }

  function tick(dt: number, conChispas: boolean) {
    for (const p of tablas) {
      const tg = p.on ? 1 : 0
      if (p.s === tg) continue
      const antes = p.s
      p.s = tg ? Math.min(1, p.s + dt * 2.2) : Math.max(0, p.s - dt * 3)
      sucio = true
      if (tg && antes === 0 && conChispas) chispas(p.x, p.y + 0.3, p.z, 6)
    }
    if (!sucio) return
    sucio = false
    for (let i = 0; i < N; i++) {
      const p = tablas[i], s = p.s > 0 ? backOut(p.s) : 0
      dummy.position.set(p.x, p.y - 0.02, p.z); dummy.rotation.set(0, -p.a + Math.PI / 2, 0); dummy.scale.set(1, Math.max(0.0001, s), 1); dummy.updateMatrix(); pickets.setMatrixAt(i, dummy.matrix)
      const q = tablas[(i + 1) % N], ambas = Math.min(p.s, q.s), mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, len = Math.hypot(q.x - p.x, q.z - p.z), ya = -Math.atan2(q.z - p.z, q.x - p.x)
      for (let r = 0; r < 2; r++) {
        dummy.position.set(mx, (p.y + q.y) / 2 + [0.13, 0.3][r] * Math.max(0.0001, ambas), mz); dummy.rotation.set(0, ya, 0); dummy.scale.set(ambas > 0.6 ? len : 0.0001, 1, 1); dummy.updateMatrix(); rails.setMatrixAt(i * 2 + r, dummy.matrix)
      }
    }
    pickets.instanceMatrix.needsUpdate = true; rails.instanceMatrix.needsUpdate = true
  }

  return {
    ponerFondo, fijar, tick,
    completa: () => meta >= N,
    ponerAspecto(a: AspectoCerca) { mat.color.set(a.c); mat.metalness = a.metal ?? 0; mat.roughness = a.metal ? 0.35 : 0.8 },
  }
}
