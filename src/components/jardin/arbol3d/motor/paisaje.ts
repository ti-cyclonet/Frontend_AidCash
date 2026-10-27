import * as THREE from "three"
import { WATER_Y } from "./terreno"
import { glowTex, rng } from "./utilidades"

/**
 * Lo que rodea la isla: islitas en el horizonte, un velero que pasa despacio,
 * gaviotas que cruzan el cielo y las estrellas de la noche. Usa su propio
 * generador (no el de la isla) para que la escena principal no cambie.
 */
export function crearPaisaje(scene: THREE.Scene) {
  const R = rng(3131)
  const grupo = new THREE.Group(); scene.add(grupo)

  /* --- islitas lejanas: se ven como siluetas entre la neblina --- */
  const tierra = new THREE.MeshLambertMaterial({ color: 0x5f8f6a }), roca = new THREE.MeshLambertMaterial({ color: 0x8a9a8c }), copa = new THREE.MeshLambertMaterial({ color: 0x3f7a4c })
  for (const [ang, dist, esc] of [[-0.55, 62, 1.25], [0.62, 70, 0.9], [2.55, 66, 1.1], [-2.35, 74, 0.8]] as const) {
    const isla = new THREE.Group()
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 1.2, 9), roca); base.position.y = -0.2; isla.add(base)
    const loma = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), tierra); loma.scale.y = 0.55; loma.position.y = 0.35; isla.add(loma)
    const n = 3 + Math.floor(R() * 3)
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, r = R() * 1.6, h = 0.9 + R() * 0.9
      const arbol = new THREE.Mesh(new THREE.ConeGeometry(0.42 + R() * 0.2, h * 1.6, 6), copa)
      arbol.position.set(Math.cos(a) * r, 0.9 + h * 0.6, Math.sin(a) * r); isla.add(arbol)
    }
    isla.position.set(Math.sin(ang) * dist, WATER_Y + 0.3, -Math.cos(ang) * dist); isla.scale.setScalar(esc)
    grupo.add(isla)
  }

  /* --- velero: cruza el horizonte de lado a lado, cabeceando con las olas --- */
  const velero = new THREE.Group()
  const casco = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.5), new THREE.MeshLambertMaterial({ color: 0x8a4b2a })); velero.add(casco)
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.9, 6), new THREE.MeshLambertMaterial({ color: 0x5a3a20 })); mastil.position.y = 1.05; velero.add(mastil)
  const velaGeo = new THREE.BufferGeometry(); velaGeo.setAttribute("position", new THREE.Float32BufferAttribute([0.06, 0.25, 0, 0.06, 1.95, 0, 0.95, 0.3, 0], 3)); velaGeo.computeVertexNormals()
  const vela = new THREE.Mesh(velaGeo, new THREE.MeshLambertMaterial({ color: 0xfaf6ea, side: THREE.DoubleSide })); velero.add(vela)
  const farol = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,214,140,1)", "rgba(255,190,90,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }))
  farol.scale.setScalar(1.6); farol.position.set(0, 2.05, 0); velero.add(farol)
  velero.scale.setScalar(1.3); grupo.add(velero)

  /* --- gaviotas: una "V" que aletea; cruzan cada tanto --- */
  const alaGeo = new THREE.BoxGeometry(0.55, 0.03, 0.12), alaMat = new THREE.MeshBasicMaterial({ color: 0x3d4652 })
  const gaviotas = Array.from({ length: 3 }, () => {
    const g = new THREE.Group()
    const izq = new THREE.Mesh(alaGeo, alaMat), der = new THREE.Mesh(alaGeo, alaMat)
    izq.geometry.translate(0, 0, 0); izq.position.x = -0.26; der.position.x = 0.26
    g.add(izq, der); g.visible = false; grupo.add(g)
    return { g, izq, der, t: -1, dur: 0, y: 0, z: 0, dir: 1, ph: R() * 6 }
  })
  let proximaBandada = 6

  /* --- estrellas: puntos en la mitad alta del cielo, solo de noche y sin nubes --- */
  const N = 420, pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const u = R(), v = 0.08 + R() * 0.92, th = u * Math.PI * 2, y = v, r = Math.sqrt(1 - y * y)
    pos[i * 3] = Math.cos(th) * r * 105; pos[i * 3 + 1] = y * 105; pos[i * 3 + 2] = Math.sin(th) * r * 105
  }
  const estGeo = new THREE.BufferGeometry(); estGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  const estMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })
  const estrellas = new THREE.Points(estGeo, estMat); estrellas.renderOrder = -3; scene.add(estrellas)

  return {
    /** noche: 0 día → 1 noche; nubes: cuánto cubren el cielo (0–1). */
    tick(dt: number, t: number, noche: number, nubes: number) {
      /* velero: va y viene en ~3 minutos */
      const k = (t / 190) % 1, ida = k < 0.5, s = ida ? k * 2 : (1 - k) * 2
      velero.position.set(-58 + s * 116, WATER_Y + 0.1 + Math.sin(t * 1.3) * 0.08, -46)
      velero.rotation.set(Math.sin(t * 1.1) * 0.05, ida ? 0 : Math.PI, Math.sin(t * 0.9) * 0.06)
      farol.material.opacity = noche * 0.9
      /* gaviotas */
      proximaBandada -= dt
      if (proximaBandada <= 0) {
        proximaBandada = 18 + Math.random() * 22
        const dir = Math.random() < 0.5 ? 1 : -1, y = 9 + Math.random() * 5, z = -20 - Math.random() * 12
        gaviotas.forEach((gv, i) => { gv.t = -i * 0.6; gv.dur = 16; gv.dir = dir; gv.y = y + i * 0.8; gv.z = z - i * 1.5 })
      }
      for (const gv of gaviotas) {
        if (gv.dur === 0) continue
        gv.t += dt
        if (gv.t < 0) { gv.g.visible = false; continue }
        if (gv.t > gv.dur) { gv.dur = 0; gv.g.visible = false; continue }
        const p = gv.t / gv.dur
        gv.g.visible = noche < 0.85
        gv.g.position.set(gv.dir * (-45 + p * 90), gv.y + Math.sin(gv.t * 1.5 + gv.ph) * 0.4, gv.z)
        gv.g.rotation.y = gv.dir > 0 ? -Math.PI / 2 : Math.PI / 2
        const aleteo = Math.sin(gv.t * 9 + gv.ph) * 0.5
        gv.izq.rotation.z = 0.35 + aleteo; gv.der.rotation.z = -0.35 - aleteo
      }
      estMat.opacity = Math.max(0, noche - 0.15) * (1 - nubes) * 1.1
      estrellas.rotation.y = t * 0.003
    },
  }
}
