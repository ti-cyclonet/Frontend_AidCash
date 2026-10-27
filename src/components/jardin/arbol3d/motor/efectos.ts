import * as THREE from "three"
import { aplicarSequedad, LEAF_LP, type PiezasFruta } from "./arbol"
import type { AspectoRegadera } from "./especies"
import { Hgt } from "./terreno"
import { clamp, glowTex, smooth } from "./utilidades"

/** Regadera, partículas, hojas y manzanas que caen, frutos del minijuego y la luz dorada del ingreso. */

interface Particulas { p: THREE.Points; pos: Float32Array; col: Float32Array | null; vel: Float32Array; life: Float32Array; n: number; i: number }

export function crearEfectos(scene: THREE.Scene, leafTex: THREE.Texture, flowerTex: THREE.Texture, uSeco: { value: number }, fruta: PiezasFruta) {
  /* ---------- regadera ---------- */
  const can = new THREE.Group(); can.visible = false; scene.add(can)
  const canMats: { b?: THREE.MeshStandardMaterial; d?: THREE.MeshStandardMaterial } = {}
  {
    const bm = new THREE.MeshStandardMaterial({ color: 0x3aa0c0, roughness: .45, metalness: .2 })
    const dm = new THREE.MeshStandardMaterial({ color: 0x2a7a96, roughness: .45, metalness: .2 })
    canMats.b = bm; canMats.d = dm
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.52, 16), bm); body.castShadow = true; can.add(body)
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 16), dm); lid.position.y = 0.285; can.add(lid)
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.085, 0.72, 10), dm); sp.position.set(-0.5, 0.1, 0); sp.rotation.z = 0.9; sp.castShadow = true; can.add(sp)
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.06, 0.12, 12), bm); rose.position.set(-0.79, 0.37, 0); rose.rotation.z = 0.9; can.add(rose)
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.04, 8, 16, Math.PI), dm); h.position.set(0.36, 0.04, 0); h.rotation.z = -Math.PI / 2; can.add(h)
  }
  can.scale.setScalar(0.7)
  const canTip = new THREE.Object3D(); canTip.position.set(-0.86, 0.4, 0); can.add(canTip)
  const canHome = new THREE.Vector3(1.75, 1.25, 0.6), canAway = new THREE.Vector3(3.0, 2.2, 0.6)
  let canP = 0, pourAcc = 0, vertiendo = false, motaAcc = 0

  /* ---------- partículas ---------- */
  const dotTex = glowTex("rgba(255,255,255,1)", "rgba(255,255,255,0)")
  function makePoints(n: number, o: { size: number; color: number; colors?: boolean; additive?: boolean }): Particulas {
    const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos[i * 3 + 1] = -100
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    let col: Float32Array | null = null; if (o.colors) { col = new Float32Array(n * 3); geo.setAttribute("color", new THREE.BufferAttribute(col, 3)) }
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: o.size, map: dotTex, transparent: true, depthWrite: false, sizeAttenuation: true, color: o.color, vertexColors: !!o.colors, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending }))
    p.frustumCulled = false; scene.add(p)
    return { p, pos, col, vel: new Float32Array(n * 3), life: new Float32Array(n), n, i: 0 }
  }
  const drops = makePoints(260, { size: 0.15, color: 0x9bdcff })
  const sparks = makePoints(220, { size: 0.3, color: 0xffffff, colors: true, additive: true })
  const motas = makePoints(240, { size: 0.22, color: 0xffffff, colors: true, additive: true })
  const motaGiro = new Float32Array(motas.n * 3) /* ángulo, radio, vida inicial */
  function emit(S: Particulas, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
    const i = S.i; S.i = (S.i + 1) % S.n; S.pos[i * 3] = x; S.pos[i * 3 + 1] = y; S.pos[i * 3 + 2] = z; S.vel[i * 3] = vx; S.vel[i * 3 + 1] = vy; S.vel[i * 3 + 2] = vz; S.life[i] = life
  }

  /* ---------- hojas en corazón y manzanas que caen ---------- */
  const fallGeo = (() => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0)
    LEAF_LP.forEach(p => sh.lineTo(p[0], p[1])); for (let i = LEAF_LP.length - 1; i >= 0; i--) sh.lineTo(-LEAF_LP[i][0], LEAF_LP[i][1])
    const g = new THREE.ShapeGeometry(sh), p = g.attributes.position as THREE.BufferAttribute, uv: number[] = []
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); uv.push((x + 0.75) / 1.5, 1 - (y + 0.36) / 1.4) }
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.translate(0, -0.4, 0); g.scale(0.26, 0.26, 0.26); return g
  })()
  const fallMats = [0xb4c6a0, 0xd8e6c0, 0xf0ecb0, 0x9cb48c].map(c => { const m = new THREE.MeshStandardMaterial({ map: leafTex, color: c, side: THREE.DoubleSide, roughness: .85, emissive: 0x0c1a06 }); aplicarSequedad(m, uSeco); return m })
  const petalMat = new THREE.MeshLambertMaterial({ map: flowerTex, alphaTest: .5, side: THREE.DoubleSide, emissive: 0x555555 }); const petalGeo = new THREE.PlaneGeometry(0.2, 0.2)
  const leafFall: { m: THREE.Mesh; on: boolean; state: number; age: number; seed: number; v: THREE.Vector3; spin: THREE.Vector3 }[] = []
  const appleFall: { m: THREE.Mesh; on: boolean; landed: boolean; rest: number; v: THREE.Vector3 }[] = []
  for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(fallGeo, fallMats[i % 4]); m.visible = false; scene.add(m); leafFall.push({ m, on: false, state: 0, age: 0, seed: 0, v: new THREE.Vector3(), spin: new THREE.Vector3() }) }
  for (let i = 0; i < 30; i++) { const m = fruta.decorar(new THREE.Mesh(fruta.fruitGeo, fruta.fruitMat)); m.visible = false; m.castShadow = true; scene.add(m); appleFall.push({ m, on: false, landed: false, rest: 0, v: new THREE.Vector3() }) }

  function spawnLeaf(x: number, y: number, z: number, petal: boolean) {
    for (let i = 0; i < leafFall.length; i++) {
      const f = leafFall[i]; if (f.on) continue
      f.on = true; f.state = 0; f.age = 0; f.seed = Math.random() * 6.28; f.m.visible = true; f.m.scale.setScalar(1); f.m.material = petal ? petalMat : fallMats[i % 4]; f.m.geometry = petal ? petalGeo : fallGeo
      f.m.position.set(x, y, z); f.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      f.v.set((Math.random() - .5) * 0.7, -0.2, (Math.random() - .5) * 0.7); f.spin.set((Math.random() - .5) * 5, (Math.random() - .5) * 5, (Math.random() - .5) * 5); return
    }
  }
  function spawnApple(x: number, y: number, z: number, s: number) {
    for (const f of appleFall) {
      if (f.on) continue
      f.on = true; f.landed = false; f.rest = 0; f.m.visible = true; f.m.scale.setScalar(s); f.m.position.set(x, y, z); f.v.set((Math.random() - .5) * 1, 0, (Math.random() - .5) * 1); return
    }
  }
  function burstSparks(S: number) {
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * 6.28, r = (0.6 + Math.random() * 2) * (0.5 + S)
      emit(sparks, Math.cos(a) * r, 0.2 + Math.random() * 4.5 * S, Math.sin(a) * r, Math.cos(a) * .5, 1.2 + Math.random() * 1.8, Math.sin(a) * .5, 1 + Math.random() * .9)
    }
  }

  /* ---------- frutos del minijuego: caen al pie del árbol y se cosechan tocándolos ---------- */
  interface FrutoSuelo { indice: number; dorado: boolean; g: THREE.Group; hit: THREE.Mesh; brillo: THREE.Sprite | null; fase: "cae" | "quieto" | "cosecha"; t: number; y: number; vy: number; suelo: number; rot: number; rebotes: number }
  const frutosRoot = new THREE.Group(); scene.add(frutosRoot)
  const frutos = new Map<number, FrutoSuelo>()
  const doradoMat = new THREE.MeshStandardMaterial({ color: 0xf6c544, roughness: .28, metalness: .35, emissive: 0x7a4a00 })
  const brilloTex = glowTex("rgba(255,220,120,1)", "rgba(255,200,80,0)")
  const hitMat = new THREE.MeshBasicMaterial({ visible: false }), hitGeo = new THREE.SphereGeometry(0.42, 10, 8)
  /* delante del tronco, del lado de la cámara */
  const SLOTS = [[-0.95, 0.98], [0.55, 1.02], [-0.25, 0.82], [1.12, 0.9], [0.2, 1.12]]
  const FRENTE = Math.atan2(Math.cos(0.28), Math.sin(0.28))
  let sueloY: (x: number, z: number) => number = Hgt
  function crearFruto(indice: number, dorado: boolean) {
    const slot = SLOTS[indice % SLOTS.length], a = FRENTE + slot[0], r = slot[1]
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
    const m = fruta.decorar(new THREE.Mesh(fruta.fruitGeo, dorado ? doradoMat : fruta.fruitMat)); m.castShadow = true; m.scale.setScalar(1.5); g.add(m)
    const hit = new THREE.Mesh(hitGeo, hitMat); g.add(hit)
    let brillo: THREE.Sprite | null = null
    if (dorado) { brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8 })); brillo.scale.set(1.1, 1.1, 1); g.add(brillo) }
    const suelo = sueloY(g.position.x, g.position.z) + 0.2
    const F: FrutoSuelo = { indice, dorado, g, hit, brillo, fase: "cae", t: -(0.3 + indice * 0.12), y: suelo + 3.2, vy: 0, suelo, rot: (Math.random() - .5) * 2.4, rebotes: 0 }
    g.position.y = F.y; g.visible = false; frutosRoot.add(g); frutos.set(indice, F)
  }
  function quitarFruto(F: FrutoSuelo) {
    frutosRoot.remove(F.g); F.brillo?.material.dispose(); frutos.delete(F.indice)
  }
  function ponerFrutos(lista: { indice: number; dorado: boolean; cosechado: boolean }[] | null) {
    const vigentes = new Set<number>()
    for (const f of lista ?? []) {
      const F = frutos.get(f.indice)
      if (f.cosechado) { if (F && F.fase !== "cosecha") { F.fase = "cosecha"; F.t = 0 } continue }
      vigentes.add(f.indice)
      if (!F) crearFruto(f.indice, f.dorado)
    }
    for (const F of [...frutos.values()]) if (!vigentes.has(F.indice) && F.fase !== "cosecha") quitarFruto(F)
  }
  /** Fruto tocado: arranca la animación de cosecha al instante (el servidor confirma después). */
  function tocarFruto(ray: THREE.Raycaster) {
    const hits = [...frutos.values()].filter(F => F.fase !== "cosecha" && F.g.visible).map(F => F.hit)
    const h = ray.intersectObjects(hits, false); if (!h.length) return null
    const F = [...frutos.values()].find(x => x.hit === h[0].object)!
    F.fase = "cosecha"; F.t = 0
    return { indice: F.indice, dorado: F.dorado }
  }

  const vTmp = new THREE.Vector3()
  function tick(o: { dt: number; t: number; windS: number; holding: boolean; ingreso: boolean; altura: number; golpe: () => void; alRegar: () => void }) {
    const { dt, t, windS } = o
    /* regadera */
    canP += ((o.holding ? 1 : 0) - canP) * (1 - Math.exp(-dt * 7))
    can.visible = canP > 0.02
    if (can.visible) {
      can.position.lerpVectors(canAway, canHome, smooth(canP))
      can.rotation.z = 0.74 * smooth((canP - 0.6) / 0.4)
      if (o.holding && canP > 0.9) {
        if (!vertiendo) { vertiendo = true; o.alRegar() }
        pourAcc += dt * 90; can.updateMatrixWorld(true); canTip.getWorldPosition(vTmp)
        while (pourAcc >= 1) { pourAcc -= 1; emit(drops, vTmp.x + (Math.random() - .5) * .1, vTmp.y, vTmp.z + (Math.random() - .5) * .18, -1.4 - Math.random() * .6, -0.3 + Math.random() * .4, (Math.random() - .5) * .5, 1.4) }
      }
    }
    if (!o.holding) vertiendo = false
    for (let i = 0; i < drops.n; i++) {
      if (drops.life[i] <= 0) continue; drops.life[i] -= dt; drops.vel[i * 3 + 1] -= 18 * dt
      drops.pos[i * 3] += drops.vel[i * 3] * dt; drops.pos[i * 3 + 1] += drops.vel[i * 3 + 1] * dt; drops.pos[i * 3 + 2] += drops.vel[i * 3 + 2] * dt
      if (drops.pos[i * 3 + 1] < 0.05 || drops.life[i] <= 0) { drops.life[i] = 0; drops.pos[i * 3 + 1] = -100 }
    }
    drops.p.geometry.attributes.position.needsUpdate = true

    /* destellos */
    for (let i = 0; i < sparks.n; i++) {
      const l = sparks.life[i]; const col = sparks.col!
      if (l <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue }
      sparks.life[i] = l - dt; sparks.vel[i * 3 + 1] -= 1.2 * dt
      sparks.pos[i * 3] += sparks.vel[i * 3] * dt; sparks.pos[i * 3 + 1] += sparks.vel[i * 3 + 1] * dt; sparks.pos[i * 3 + 2] += sparks.vel[i * 3 + 2] * dt
      const f = clamp(l / 0.8); col[i * 3] = f; col[i * 3 + 1] = 0.82 * f; col[i * 3 + 2] = 0.3 * f
      if (sparks.life[i] <= 0) sparks.pos[i * 3 + 1] = -100
    }
    sparks.p.geometry.attributes.position.needsUpdate = true; sparks.p.geometry.attributes.color.needsUpdate = true

    /* ingreso: motas de luz dorada que suben de la tierra y nutren el árbol */
    if (o.ingreso) {
      motaAcc += dt * 55
      for (; motaAcc >= 1; motaAcc--) {
        const i = motas.i, life = 2.4 + Math.random() * 1.2
        emit(motas, 0, 0.05, 0, 0, 0.7 + Math.random() * 0.7, 0, life)
        motaGiro[i * 3] = Math.random() * 6.283; motaGiro[i * 3 + 1] = 0.35 + Math.random() * 1.15; motaGiro[i * 3 + 2] = life
      }
    }
    {
      const col = motas.col!, techo = Math.max(1.2, o.altura)
      for (let i = 0; i < motas.n; i++) {
        const l = motas.life[i]
        if (l <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue }
        motas.life[i] = l - dt
        motaGiro[i * 3] += dt * (1.1 + 0.6 * Math.sin(i)); motaGiro[i * 3 + 1] *= 1 - 0.12 * dt
        const y = Math.min(techo, motas.pos[i * 3 + 1] + motas.vel[i * 3 + 1] * dt)
        motas.pos[i * 3] = Math.cos(motaGiro[i * 3]) * motaGiro[i * 3 + 1]; motas.pos[i * 3 + 1] = y; motas.pos[i * 3 + 2] = Math.sin(motaGiro[i * 3]) * motaGiro[i * 3 + 1]
        const edad = motaGiro[i * 3 + 2] - l, f = Math.min(1, edad / 0.4) * clamp(l / 0.9) * (0.75 + 0.25 * Math.sin(t * 9 + i))
        col[i * 3] = f; col[i * 3 + 1] = 0.78 * f; col[i * 3 + 2] = 0.28 * f
        if (motas.life[i] <= 0) motas.pos[i * 3 + 1] = -100
      }
      motas.p.geometry.attributes.position.needsUpdate = true; motas.p.geometry.attributes.color.needsUpdate = true
    }

    /* hojas y manzanas que caen */
    for (const f of leafFall) {
      if (!f.on) continue; f.age += dt
      if (f.state === 0) {
        f.v.y = Math.max(f.v.y - 3 * dt, -1.2)
        f.m.position.x += (f.v.x + Math.sin(t * 3.2 + f.seed) * 0.6 + windS * 0.8) * dt; f.m.position.z += (f.v.z + Math.cos(t * 2.6 + f.seed) * 0.45) * dt; f.m.position.y += f.v.y * dt
        f.m.rotation.x += f.spin.x * dt; f.m.rotation.y += f.spin.y * dt; f.m.rotation.z += f.spin.z * dt
        const gy = Hgt(f.m.position.x, f.m.position.z) + 0.04; if (f.m.position.y <= gy) { f.m.position.y = gy; f.state = 1; f.age = 0; f.m.rotation.set(-Math.PI / 2, 0, f.seed) }
      } else if (f.age > 2.5) { const s = 1 - (f.age - 2.5) / 1.2; if (s <= 0) { f.on = false; f.m.visible = false } else f.m.scale.setScalar(s) }
    }
    for (const f of appleFall) {
      if (!f.on) continue; const rad = 0.16 * f.m.scale.x
      if (f.rest <= 0) {
        f.v.y -= 16 * dt; f.m.position.addScaledVector(f.v, dt)
        const gyA = Hgt(f.m.position.x, f.m.position.z) + rad
        if (f.m.position.y <= gyA) {
          f.m.position.y = gyA
          if (!f.landed) { f.landed = true; o.golpe(); for (let s = 0; s < 14; s++) emit(sparks, f.m.position.x, rad + .1, f.m.position.z, (Math.random() - .5) * 1.6, 1 + Math.random() * 1.6, (Math.random() - .5) * 1.6, .7 + Math.random() * .5) }
          f.v.y *= -0.38; f.v.x *= 0.6; f.v.z *= 0.6; if (Math.abs(f.v.y) < 0.8) { f.v.set(0, 0, 0); f.rest = 1.6 }
        }
      } else { f.rest -= dt; if (f.rest < 1) f.m.scale.multiplyScalar(Math.max(0, 1 - dt * 3)); if (f.rest <= 0 || f.m.scale.x < 0.02) { f.on = false; f.m.visible = false } }
    }

    /* frutos del minijuego */
    for (const F of [...frutos.values()]) {
      F.t += dt
      if (F.fase === "cae") {
        if (F.t < 0) continue
        F.g.visible = true
        F.vy -= 14 * dt; F.y += F.vy * dt
        if (F.y <= F.suelo) { F.y = F.suelo; F.vy = -F.vy * 0.38; F.rebotes++; if (F.rebotes === 1) o.golpe(); if (F.rebotes > 3 || Math.abs(F.vy) < 0.6) { F.vy = 0; F.fase = "quieto" } }
        F.g.position.y = F.y; F.g.rotation.z = F.rot * smooth(F.t / 0.6)
      } else if (F.fase === "quieto") {
        F.g.position.y = F.suelo + (F.dorado ? 0.03 * Math.sin(t * 3 + F.indice) : 0)
        if (F.brillo) { const k = 0.8 + 0.25 * Math.sin(t * 4 + F.indice); F.brillo.scale.set(k * 1.1, k * 1.1, 1); F.brillo.material.opacity = 0.55 + 0.3 * Math.sin(t * 4) }
      } else {
        const k = F.t / 0.45
        F.g.position.y = F.suelo + 0.6 * Math.sin(Math.min(1, k) * Math.PI * 0.7)
        F.g.scale.setScalar(Math.max(0.0001, (1 + 0.35 * Math.sin(Math.min(1, k) * Math.PI)) * (1 - smooth((k - 0.5) / 0.5))))
        if (k >= 1) quitarFruto(F)
      }
    }
  }

  return {
    spawnLeaf, spawnApple, burstSparks, ponerFrutos, tocarFruto, tick,
    chispas(x: number, y: number, z: number, n: number) { for (let k = 0; k < n; k++) emit(sparks, x, y, z, (Math.random() - .5) * 0.6, 0.8 + Math.random(), (Math.random() - .5) * 0.6, 0.6) },
    /** Chispas que salen hacia arriba y a los lados (el cofre al abrirse) */
    estallido(x: number, y: number, z: number, n: number) {
      for (let k = 0; k < n; k++) { const a = Math.random() * 6.28; emit(sparks, x, y, z, Math.cos(a) * 0.8, 1.4 + Math.random() * 1.6, Math.sin(a) * 0.8, 0.9 + Math.random() * 0.6) }
    },
    /** Las hojas que caen usan la misma textura (el mismo color) que el árbol */
    ponerTexturaHojas(tex: THREE.Texture) { fallMats.forEach((m, i) => { m.map = tex; m.color.setScalar([0.85, 1, 1.08, 0.78][i]) }) },
    ponerRegadera(a: AspectoRegadera) { canMats.b!.color.set(a.b); canMats.d!.color.set(a.d); canMats.b!.metalness = canMats.d!.metalness = a.metal ?? 0.2 },
    setSuelo(fn: (x: number, z: number) => number) { sueloY = fn },
  }
}
