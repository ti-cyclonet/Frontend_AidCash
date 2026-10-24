import * as THREE from "three"
import { lerp, rng, smooth, type Rng } from "./utilidades"

/** Clima del jardín: nubes tocables, presets de cielo/luz, lluvia y rayos. */

export type ClimaWX = "clear" | "rain" | "storm"

interface PresetWX { top: string; bottom: string; cloud: string; sunCol: string; sun: number; hemi: number; wind: number; rain: number; glow: number; cover: number }
const BASE: Record<ClimaWX, PresetWX> = {
  clear: { top: "#4a9bd4", bottom: "#d6ecee", cloud: "#ffffff", sunCol: "#fff0d2", sun: 1.05, hemi: .7, wind: .35, rain: 0, glow: 1, cover: 0 },
  rain: { top: "#76909f", bottom: "#b6c6cb", cloud: "#aab6bc", sunCol: "#dfe7ee", sun: .32, hemi: .6, wind: .8, rain: .65, glow: .08, cover: .75 },
  /* más clara que en el prototipo: con la tormenta el árbol tiene que seguir viéndose */
  storm: { top: "#3c4c5a", bottom: "#76868f", cloud: "#59626b", sunCol: "#c9d4e0", sun: .42, hemi: .82, wind: 1.9, rain: .85, glow: 0, cover: 1 },
}
export interface WXColores { cTop: THREE.Color; cBot: THREE.Color; cCloud: THREE.Color; cSun: THREE.Color; sun: number; hemi: number; wind: number; rain: number; glow: number; cover: number }
export const WX = Object.fromEntries((Object.keys(BASE) as ClimaWX[]).map(k => {
  const w = BASE[k]
  return [k, { cTop: new THREE.Color(w.top), cBot: new THREE.Color(w.bottom), cCloud: new THREE.Color(w.cloud), cSun: new THREE.Color(w.sunCol), sun: w.sun, hemi: w.hemi, wind: w.wind, rain: w.rain, glow: w.glow, cover: w.cover }]
})) as Record<ClimaWX, WXColores>

/** Estado actual del clima, que se acerca suavemente al preset objetivo. */
export function climaActual(w: ClimaWX) {
  const p = WX[w]
  return { top: p.cTop.clone(), bottom: p.cBot.clone(), cloud: p.cCloud.clone(), sunCol: p.cSun.clone(), sun: p.sun, hemi: p.hemi, wind: p.wind, rain: p.rain, glow: p.glow, cover: p.cover }
}
export type ClimaActual = ReturnType<typeof climaActual>

export interface Nube extends THREE.Group {
  userData: { clearX: number; clearZ: number; clearY: number; stormX: number; stormZ: number; stormY: number; sp: number; ph: number; sc: number; bump: number }
}

/** Nubes de clima: detrás y arriba del árbol para no taparlo; en tormenta bajan y se oscurecen. */
export function crearNubes(scene: THREE.Scene, R: Rng) {
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x777777 })
  const cloudsRoot = new THREE.Group(); scene.add(cloudsRoot)
  const clouds: Nube[] = [], cloudHit: THREE.Mesh[] = []
  const cloudGeo = new THREE.SphereGeometry(1, 18, 12)
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group() as Nube, n = 5 + Math.floor(R() * 3)
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(cloudGeo, cloudMat); const s = 0.4 + R() * 0.45; m.scale.set(s * 1.3, s * .85, s); m.position.set((k - n / 2) * 0.6 + R() * .25, R() * .3, (R() - .5) * .6); g.add(m); cloudHit.push(m) }
    g.userData = { clearX: (i % 2 ? 1 : -1) * (5.5 + R() * 3), clearZ: -4 - R() * 6, clearY: 1.2 + R() * 3.2, stormX: (i - 2) * 2.4, stormZ: -2.5 - R() * 2.5, stormY: -0.2 + (i % 2) * .6, sp: 0.2 + R() * 0.3, ph: R() * 6.28, sc: 0.8 + R() * 0.5, bump: 0 }
    cloudsRoot.add(g); clouds.push(g)
  }
  /* anillo de nubes sobre la isla para que en tormenta la rodeen por todos lados
     (generador propio para no mover el sorteo de R); las que quedan del lado de
     la cámara van más altas y más lejos para no tapar el árbol */
  const r2 = rng(909), N = 11, haciaCamara = Math.atan2(Math.cos(0.28), Math.sin(0.28))
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group() as Nube, n = 5 + Math.floor(r2() * 3)
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(cloudGeo, cloudMat); const s = 0.45 + r2() * 0.45; m.scale.set(s * 1.3, s * .85, s); m.position.set((k - n / 2) * 0.6 + r2() * .25, r2() * .3, (r2() - .5) * .6); g.add(m); cloudHit.push(m) }
    const a = i / N * Math.PI * 2 + (r2() - .5) * 0.35
    const dif = Math.abs(Math.atan2(Math.sin(a - haciaCamara), Math.cos(a - haciaCamara))), frente = smooth(1 - dif / 1.3)
    const rad = lerp(5.6, 8, frente) + r2() * 0.8
    g.rotation.y = -a + Math.PI / 2
    g.userData = { clearX: Math.cos(a) * 15, clearZ: Math.sin(a) * 15, clearY: 3 + r2() * 2, stormX: Math.cos(a) * rad, stormZ: Math.sin(a) * rad, stormY: lerp(0.2, 3.4, frente) + r2() * 0.6, sp: 0.15 + r2() * 0.25, ph: r2() * 6.28, sc: 0.85 + r2() * 0.45, bump: 0 }
    cloudsRoot.add(g); clouds.push(g)
  }
  return { cloudMat, clouds, cloudHit }
}

/** Lluvia en líneas, que cae alrededor de toda la isla. */
export function crearLluvia(scene: THREE.Scene) {
  const RN = 1300, rainHead = new Float32Array(RN * 3), rainSpd = new Float32Array(RN), rainPos = new Float32Array(RN * 6)
  for (let i = 0; i < RN; i++) { rainHead[i * 3] = (Math.random() - .5) * 20; rainHead[i * 3 + 1] = Math.random() * 16; rainHead[i * 3 + 2] = (Math.random() - .5) * 20; rainSpd[i] = 17 + Math.random() * 9 }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3))
  const rainMat = new THREE.LineBasicMaterial({ color: 0xdcecff, transparent: true, opacity: .45, depthWrite: false })
  const rainLines = new THREE.LineSegments(rainGeo, rainMat); rainLines.frustumCulled = false; rainLines.visible = false; scene.add(rainLines)

  function tick(dt: number, rain: number, windS: number, techo: number) {
    const rv = rain > 0.02; rainLines.visible = rv
    if (!rv) return
    const sl = windS * 0.28, fall = 0.85 + rain * 0.4
    for (let i = 0; i < RN; i++) {
      let y = rainHead[i * 3 + 1] - rainSpd[i] * dt * fall, x = rainHead[i * 3] + windS * 2 * dt
      if (y < 0) y += techo; if (y > techo) y = y % techo
      if (x > 10) x -= 20
      rainHead[i * 3] = x; rainHead[i * 3 + 1] = y; const z = rainHead[i * 3 + 2], o = i * 6
      rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x - sl; rainPos[o + 4] = y + 0.8; rainPos[o + 5] = z
    }
    rainGeo.attributes.position.needsUpdate = true; rainGeo.setDrawRange(0, Math.floor(RN * rain * 0.62) * 2); rainMat.opacity = 0.18 + 0.2 * rain
  }
  return { tick }
}

/** Rayos: un tubo quebrado que cae lejos, detrás de la isla. */
export function crearRayos(scene: THREE.Scene) {
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xf3f0ff, fog: false })
  let boltMesh: THREE.Mesh | null = null, boltLife = 0
  function quitar() { if (boltMesh) { scene.remove(boltMesh); boltMesh.geometry.dispose(); boltMesh = null } }
  function golpe() {
    const a = (Math.random() < .5 ? -1 : 1) * (0.5 + Math.random() * 0.9), d = 7 + Math.random() * 5, bx = Math.sin(a) * d, bz = -Math.abs(Math.cos(a)) * d - 1, pts: THREE.Vector3[] = []
    for (let i = 0; i <= 11; i++) { const k = i / 11; pts.push(new THREE.Vector3(bx + (i % 2 ? 1 : -1) * Math.random() * 1.0 * (k < 1 ? 1 : 0), 16 * (1 - k) + 0.1, bz + (Math.random() - .5) * .8)) }
    quitar()
    boltMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.07, 4, false), boltMat); scene.add(boltMesh); boltLife = 0.2
  }
  function tick(dt: number, t: number) {
    if (boltLife <= 0) return
    boltLife -= dt; if (boltMesh) boltMesh.visible = Math.sin(t * 120) > -0.4
    if (boltLife <= 0) quitar()
  }
  return { golpe, tick, quitar }
}
