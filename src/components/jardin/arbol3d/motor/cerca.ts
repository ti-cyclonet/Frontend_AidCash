import * as THREE from "three"
import { estiloCerca } from "./accesorios3d"
import type { Brizna } from "./isla"
import { Hgt, HILL_XZ } from "./terreno"
import { backOut, clamp } from "./utilidades"

/**
 * Cerca del fondo de emergencia: 40 puestos alrededor de la cama del árbol.
 * El % del fondo decide cuántos están levantados. Se arma desde el lado opuesto
 * al hormiguero, así que el hueco que mira al hormiguero es lo último que se
 * cierra: mientras no esté completa, las hormigas siguen entrando por ahí.
 *
 * Cada estilo de la tienda (tablitas, troncos, bambú, púas, piedra, seto, reja,
 * dorada) cambia la pieza de cada puesto, los travesaños y cada cuántos puestos
 * va un poste (accesorios3d.ts → estiloCerca).
 */
export const RADIO_CERCA = 1.72
const N = 40, MAX_RIELES = 3

export function crearCerca(world: THREE.Group, bd: Brizna[], chispas: (x: number, y: number, z: number, n: number) => void) {
  const inicial = estiloCerca("blanca")
  const pickets = new THREE.InstancedMesh(inicial.poste.geo, inicial.poste.mat, N)
  const rails = new THREE.InstancedMesh(inicial.riel!.geo, inicial.riel!.mat, N * MAX_RIELES)
  pickets.castShadow = true; pickets.receiveShadow = true; rails.castShadow = true
  world.add(pickets); world.add(rails)
  let estilo = inicial

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
  /** Sin animación: cada puesto queda directamente arriba o abajo (al cargar). */
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
    const alturas = estilo.riel ? estilo.alturasRiel : []
    for (let i = 0; i < N; i++) {
      const p = tablas[i], s = p.s > 0 ? backOut(p.s) : 0
      /* en cercas de alambre o troncos el poste va solo cada n puestos; el resto lo cubren los travesaños */
      const conPoste = i % estilo.cadaN === 0
      dummy.position.set(p.x, p.y - 0.02, p.z); dummy.rotation.set(0, -p.a + Math.PI / 2, 0); dummy.scale.set(1, conPoste ? Math.max(0.0001, s) : 0.0001, 1); dummy.updateMatrix(); pickets.setMatrixAt(i, dummy.matrix)
      const q = tablas[(i + 1) % N], ambas = Math.min(p.s, q.s), mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, len = Math.hypot(q.x - p.x, q.z - p.z), ya = -Math.atan2(q.z - p.z, q.x - p.x)
      for (let r = 0; r < MAX_RIELES; r++) {
        const h = alturas[r]
        dummy.position.set(mx, (p.y + q.y) / 2 + (h ?? 0) * Math.max(0.0001, ambas), mz); dummy.rotation.set(0, ya, 0)
        dummy.scale.set(h !== undefined && ambas > 0.6 ? len : 0.0001, h !== undefined ? 1 : 0.0001, h !== undefined ? 1 : 0.0001)
        dummy.updateMatrix(); rails.setMatrixAt(i * MAX_RIELES + r, dummy.matrix)
      }
    }
    pickets.instanceMatrix.needsUpdate = true; rails.instanceMatrix.needsUpdate = true
  }

  return {
    ponerFondo, fijar, tick,
    completa: () => meta >= N,
    /** Cambia el estilo de la cerca (clave de la tienda). */
    ponerAspecto(clave: string) {
      estilo = estiloCerca(clave)
      pickets.geometry = estilo.poste.geo; pickets.material = estilo.poste.mat
      rails.visible = !!estilo.riel
      if (estilo.riel) { rails.geometry = estilo.riel.geo; rails.material = estilo.riel.mat }
      sucio = true
    },
  }
}
