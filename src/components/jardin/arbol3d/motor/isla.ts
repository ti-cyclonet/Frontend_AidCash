import * as THREE from "three"
import type { Escena } from "./escena"
import { EDGEK, Hgt, HILL_XZ, inPatch, IR, ISL_D, PATCHES, POND, POND_R, ROCK_LIST, RT, WATER_Y } from "./terreno"
import { clamp, glowTex, lerp, lienzo, rng, smooth, vnoise, type Rng } from "./utilidades"

export const TEX = "/garden/3d/"

/** Un mechón de pasto instanciado. */
export interface Brizna { x: number; z: number; y: number; h: number; w: number; yaw: number; ph: number; f: number; c: [number, number, number] }
export interface Flor { x: number; z: number; y: number; h: number; c: number }

/**
 * Isla flotante: césped con lomas, borde de roca con musgo, estanque, tierra del
 * árbol, rocas, pasto y flores. Respeta el orden de llamadas a `R` del prototipo
 * para que todo quede exactamente en el mismo sitio.
 */
export function crearIsla(esc: Escena, R: Rng, imgTierra: HTMLImageElement | null) {
  const { world } = esc
  const loader = new THREE.TextureLoader()

  /* textura del suelo: manchas tonales, tierra descubierta, musgo y borde seco */
  /* con la tierra ya precargada el césped se pinta una sola vez; si no llegó a tiempo se repinta al cargar */
  let soilImg: HTMLImageElement | null = imgTierra
  const soilTex = imgTierra ? new THREE.Texture(imgTierra) : loader.load(TEX + "farm_soil_diff.jpg", t => { soilImg = t.image as HTMLImageElement; groundTex.redraw() })
  if (imgTierra) soilTex.needsUpdate = true
  soilTex.wrapS = soilTex.wrapT = THREE.RepeatWrapping; soilTex.repeat.set(1.07, 1.07); soilTex.anisotropy = 4
  const soilNor = loader.load(TEX + "farm_soil_nor_gl.jpg"); soilNor.wrapS = soilNor.wrapT = THREE.RepeatWrapping; soilNor.repeat.set(2, 2)

  const groundTex = (() => {
    const S = 1024, { c, g } = lienzo(S)
    const t = new THREE.CanvasTexture(c) as THREE.CanvasTexture & { redraw: () => void }
    t.anisotropy = 4
    const P = (x: number, z: number) => [(z / (2 * RT) + .5) * S, (1 - (x / (2 * RT) + .5)) * S]
    const blob = (x: number, y: number, rad: number, c0: string) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, c0); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2) }
    function draw() {
      const r = rng(31)
      g.globalCompositeOperation = "source-over"
      g.fillStyle = "#5f9140"; g.fillRect(0, 0, S, S)
      for (let i = 0; i < 60; i++) blob(r() * S, r() * S, 80 + r() * 170, r() < .5 ? "rgba(122,170,78,.32)" : "rgba(52,96,38,.3)")
      for (let i = 0; i < 160; i++) blob(r() * S, r() * S, 14 + r() * 40, r() < .33 ? "rgba(150,186,90,.22)" : (r() < .5 ? "rgba(46,86,34,.22)" : "rgba(120,150,70,.18)"))
      /* hierba fina: miles de trazos cortos en verdes naturales */
      const GC = ["78,124,52", "104,150,66", "130,170,82", "58,100,40", "150,180,96", "92,120,50"]
      /* agrupados por color, opacidad y grosor: unas pocas pinceladas en vez de 26.000 */
      g.lineCap = "round"
      const lotes = new Map<number, number[]>()
      for (let i = 0; i < 26000; i++) {
        const x = r() * S, y = r() * S, l = 2 + r() * 5, a = -1.57 + (r() - .5) * 1.4
        const ci = (r() * GC.length) | 0, ai = Math.min(3, (r() * 4) | 0), wi = Math.min(2, (r() * 3) | 0), key = ci * 12 + ai * 3 + wi
        let lote = lotes.get(key); if (!lote) lotes.set(key, lote = [])
        lote.push(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l)
      }
      lotes.forEach((seg, key) => {
        const ci = Math.floor(key / 12), ai = Math.floor(key / 3) % 4, wi = key % 3
        g.strokeStyle = "rgba(" + GC[ci] + "," + (0.35 + (ai + 0.5) * 0.1) + ")"; g.lineWidth = 0.8 + (wi + 0.5) * 0.37
        g.beginPath()
        for (let k = 0; k < seg.length; k += 4) { g.moveTo(seg[k], seg[k + 1]); g.lineTo(seg[k + 2], seg[k + 3]) }
        g.stroke()
      })
      /* algo de tierra que asoma entre la hierba */
      if (soilImg) {
        const tl = lienzo(160); tl.g.drawImage(soilImg, 0, 0, 160, 160)
        const sp = lienzo(S); sp.g.fillStyle = sp.g.createPattern(tl.c, "repeat")!; sp.g.fillRect(0, 0, S, S)
        const mk = lienzo(S)
        for (let i = 0; i < 55; i++) { const x = r() * S, y = r() * S, rad = 10 + r() * 34, gr = mk.g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, "rgba(0,0,0," + (0.35 + r() * 0.35) + ")"); gr.addColorStop(1, "rgba(0,0,0,0)"); mk.g.fillStyle = gr; mk.g.fillRect(x - rad, y - rad, rad * 2, rad * 2) }
        sp.g.globalCompositeOperation = "destination-in"; sp.g.drawImage(mk.c, 0, 0); g.drawImage(sp.c, 0, 0)
      }
      /* zonas despejadas: césped más claro y corto */
      PATCHES.forEach(p => { const q = P(p.x, p.z); blob(q[0], q[1], p.r / (2 * RT) * S * 1.4, "rgba(150,170,90,.35)") })
      /* tierra cálida alrededor del tronco, borde orgánico y transición suave */
      const c0 = P(0, 0), R0 = 1.2 / (2 * RT) * S
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * 6.283 + r() * 0.4, d = R0 * (0.25 + r() * 0.25), rad = R0 * (0.62 + r() * 0.25), x = c0[0] + Math.cos(a) * d, y = c0[1] + Math.sin(a) * d
        const gr = g.createRadialGradient(x, y, rad * 0.45, x, y, rad); gr.addColorStop(0, "rgba(158,108,66,.95)"); gr.addColorStop(0.75, "rgba(150,104,64,.6)"); gr.addColorStop(1, "rgba(150,104,64,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.3); g.fill()
      }
      blob(c0[0], c0[1], R0 * 0.8, "rgba(170,118,72,.9)")
      /* tierra de jardín con textura real (Poly Haven) dentro de la misma forma orgánica */
      if (soilImg) {
        const mk = lienzo(S), r2 = rng(31)
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * 6.283 + r2() * 0.4, d = R0 * (0.25 + r2() * 0.25), rad = R0 * (0.62 + r2() * 0.25), x = c0[0] + Math.cos(a) * d, y = c0[1] + Math.sin(a) * d
          const gr = mk.g.createRadialGradient(x, y, rad * 0.4, x, y, rad * 1.02); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.7, "rgba(0,0,0,.85)"); gr.addColorStop(1, "rgba(0,0,0,0)"); mk.g.fillStyle = gr; mk.g.beginPath(); mk.g.arc(x, y, rad * 1.02, 0, 6.3); mk.g.fill()
        }
        const m = lienzo(S), tile = lienzo(200); tile.g.drawImage(soilImg, 0, 0, 200, 200)
        m.g.fillStyle = m.g.createPattern(tile.c, "repeat")!; m.g.fillRect(0, 0, S, S)
        m.g.globalCompositeOperation = "multiply"; m.g.fillStyle = "rgba(196,150,112,1)"; m.g.fillRect(0, 0, S, S)
        m.g.globalCompositeOperation = "destination-in"; m.g.drawImage(mk.c, 0, 0); g.drawImage(m.c, 0, 0)
        /* borde: césped un poco más oscuro donde empieza la tierra */
        const rr = g.createRadialGradient(c0[0], c0[1], R0 * 0.95, c0[0], c0[1], R0 * 1.35); rr.addColorStop(0, "rgba(60,110,45,0)"); rr.addColorStop(0.45, "rgba(60,110,45,.28)"); rr.addColorStop(1, "rgba(60,110,45,0)")
        g.fillStyle = rr; g.beginPath(); g.arc(c0[0], c0[1], R0 * 1.35, 0, 6.3); g.fill()
      }
      /* verde más suave junto a las rocas (musgo) */
      ROCK_LIST.forEach(a => { const q = P(a[0], a[1]); blob(q[0], q[1], a[2] * 2.1 / (2 * RT) * S, "rgba(78,140,62,.45)") })
      const rg = g.createRadialGradient(S / 2, S / 2, S * .4, S / 2, S / 2, S * .5); rg.addColorStop(0, "rgba(70,100,40,0)"); rg.addColorStop(1, "rgba(70,100,40,.3)"); g.fillStyle = rg; g.fillRect(0, 0, S, S)
    }
    t.redraw = () => { draw(); t.needsUpdate = true }
    draw()
    return t
  })()
  const grassMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })
  const grassDry = new THREE.Color(0xffffff), grassWet = new THREE.Color(0xb4bfa8)

  /* isla flotante: césped con lomas, borde de roca y agua debajo */
  const NA = 128, NRr = 30
  {
    const pos: number[] = [], uv: number[] = [], idx: number[] = []
    pos.push(0, Hgt(0, 0), 0); uv.push(0.5, 0.5)
    for (let j = 1; j <= NRr; j++) for (let i = 0; i < NA; i++) {
      const a = i / NA * Math.PI * 2, rr = RT * EDGEK(a) * j / NRr, x = Math.cos(a) * rr, z = Math.sin(a) * rr
      let y = Hgt(x, z); if (j === NRr) y -= 0.05
      pos.push(x, y, z); uv.push(z / (2 * RT) + .5, x / (2 * RT) + .5)
    }
    for (let i = 0; i < NA; i++) idx.push(0, 1 + (i + 1) % NA, 1 + i)
    for (let j = 1; j < NRr; j++) for (let i = 0; i < NA; i++) { const a = 1 + (j - 1) * NA + i, b = 1 + (j - 1) * NA + (i + 1) % NA, c = 1 + j * NA + i, d = 1 + j * NA + (i + 1) % NA; idx.push(a, b, c, b, d, c) }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx); g.computeVertexNormals()
    const m = new THREE.Mesh(g, grassMat); m.receiveShadow = true; world.add(m)
  }
  const rockTex = loader.load(TEX + "cliff_side_diff_gris.jpg"), rockNor = loader.load(TEX + "cliff_side_nor_gl.jpg")
  ;[rockTex, rockNor].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4 })
  {
    const NV = 22, pos: number[] = [], uv: number[] = [], idx: number[] = [], col: number[] = []
    const cSoil = new THREE.Color(0x5b4330), cRock = new THREE.Color(0xd8d2c8), cDeep = new THREE.Color(0x8e877d), cMoss = new THREE.Color(0x4f7a32), cc = new THREE.Color()
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, ph = v * Math.PI / 2
      for (let i = 0; i <= NA; i++) {
        const a = i / NA * Math.PI * 2, k = EDGEK(a)
        const ex = Math.cos(a) * RT * k, ez = Math.sin(a) * RT * k, yt = Hgt(ex * 0.995, ez * 0.995) - 0.05
        const dep = ISL_D * (0.78 + 0.44 * vnoise(Math.cos(a) * 1.1 + 4, Math.sin(a) * 1.1 + 1))
        let rf = Math.pow(Math.cos(ph), 1.05) * (1 + 0.04 * Math.sin(Math.PI * Math.min(1, v * 2.6)))
        if (j > 0 && j < NV) rf *= 1 + (vnoise(a * 5 + j * 0.35, j * 0.7) - 0.5) * 0.16 * (0.3 + v) + Math.sin(a * 15 + vnoise(a * 2, j * 0.3) * 4) * 0.025 * v
        if (j === NV) rf = 0
        const lean = v * v, rad = RT * k * rf
        const y = yt - dep * Math.pow(v, 1.15) + (j > 0 ? (vnoise(a * 4, j * 0.9) - 0.5) * 0.16 * v : 0)
        pos.push(Math.cos(a) * rad + 0.4 * lean, y, Math.sin(a) * rad - 0.25 * lean); uv.push(i / NA * 10, y / 2.6)
        const n = vnoise(a * 6, j * 0.6), m = vnoise(a * 3.3 + 7, j * 0.45 + 2)
        cc.copy(cRock).lerp(cDeep, clamp(v * 0.75 + (n - .5) * 0.45))
        if (m > 0.58 && v < 0.7) cc.lerp(cMoss, smooth((m - 0.58) / 0.12) * (1 - v * 0.9))
        if (v < 0.1) cc.lerp(cSoil, 1 - smooth(v / 0.1))
        col.push(cc.r, cc.g, cc.b)
      }
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c) }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: rockTex, normalMap: rockNor, normalScale: new THREE.Vector2(1.3, 1.3), vertexColors: true, roughness: 0.93, emissive: 0x2c2a27, emissiveMap: rockTex }))
    m.castShadow = true; m.receiveShadow = true; world.add(m)
    /* labio de musgo que sobresale sobre la roca */
    const lp: number[] = [], li: number[] = [], lu: number[] = []
    for (let j = 0; j <= 2; j++) for (let i = 0; i <= NA; i++) {
      const a = i / NA * Math.PI * 2, k = EDGEK(a), ex = Math.cos(a) * RT * k, ez = Math.sin(a) * RT * k, yt = Hgt(ex * 0.995, ez * 0.995)
      const rr = RT * k * [0.985, 1.025, 1.0][j] + (j === 1 ? (vnoise(a * 7, 3) - 0.5) * 0.08 : 0), y = yt + [-0.04, -0.1, -0.2 - 0.12 * vnoise(a * 11, 5)][j]
      lp.push(Math.cos(a) * rr, y, Math.sin(a) * rr); lu.push(Math.sin(a) * rr / (2 * RT) + .5, Math.cos(a) * rr / (2 * RT) + .5)
    }
    for (let j = 0; j < 2; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; li.push(a, c, b, b, c, d) }
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute("uv", new THREE.Float32BufferAttribute(lu, 2)); lg.setIndex(li); lg.computeVertexNormals()
    const lm = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: 0x5c8c3b, roughness: 1, side: THREE.DoubleSide })); lm.receiveShadow = true; lm.castShadow = true; world.add(lm)
  }
  /* textura de agua para el estanque */
  const waterTex = (() => {
    const { c, g } = lienzo(256), r = rng(77)
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#bfe9f2"); gr.addColorStop(1, "#7cc6dc"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
    g.strokeStyle = "rgba(255,255,255,.45)"; g.lineCap = "round"
    for (let i = 0; i < 70; i++) { const x = r() * 256, y = r() * 256, l = 10 + r() * 40; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * 0.3, y + 4, x + l * 0.6, y - 4, x + l, y); g.stroke() }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t
  })()
  /* estanque arriba de la isla */
  const pond = (() => {
    const g = new THREE.CircleGeometry(1, 48), p = g.attributes.position as THREE.BufferAttribute
    for (let i = 1; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), a = Math.atan2(y, x), k = 1 + (vnoise(Math.cos(a) * 2 + 3, Math.sin(a) * 2 + 3) - 0.5) * 0.35; p.setXY(i, x * k, y * k) }
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: waterTex, color: 0x6fb3c6, roughness: 0.06, metalness: 0.2, emissive: 0x1d5f75, emissiveIntensity: 0.2 }))
    m.rotation.x = -Math.PI / 2; m.scale.set(POND_R * 0.92, POND_R * 0.8, 1); m.position.set(POND[0], -0.1, POND[1]); m.receiveShadow = true; world.add(m); return m
  })()

  const soilMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: soilTex, normalMap: soilNor, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95 })
  const soilDry = new THREE.Color(0xd2a47c), soilWet = new THREE.Color(0x8c6a50)
  const mound: THREE.Mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), soilMat)
  mound.scale.set(0.95, 0.07, 0.95); mound.receiveShadow = true; world.add(mound)

  /* rocas irregulares con musgo en la cara superior */
  function makeRock(seed: number) {
    const g = new THREE.SphereGeometry(1, 22, 14), p = g.attributes.position as THREE.BufferAttribute, cols: number[] = [], cc = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      const k = 1 + (vnoise(x * 1.3 + seed, z * 1.3 + y) - .5) * .22; x *= k * 1.1; y *= k * 0.62; z *= k; if (y < -0.28) y = -0.28; p.setXYZ(i, x, y, z)
    }
    g.computeVertexNormals()
    const base = new THREE.Color().setHSL(0.09 + ((seed * 7) % 5) * 0.008, 0.12, 0.6)
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); cc.copy(base).multiplyScalar(0.86 + 0.2 * clamp((y + 0.28) / 0.9)); cols.push(cc.r, cc.g, cc.b) }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); return g
  }
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  ROCK_LIST.forEach((a, i) => {
    const m = new THREE.Mesh(makeRock(i * 7.3 + 1), rockMat); m.position.set(a[0], Hgt(a[0], a[1]) + a[2] * 0.04, a[1])
    m.scale.set(a[2], a[2], a[2] * 0.9); m.rotation.y = R() * 6.28; m.castShadow = true; m.receiveShadow = true; world.add(m)
  })
  const dummy0 = new THREE.Object3D()
  const mossN = ROCK_LIST.length * 9, moss = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), mossN)
  ROCK_LIST.forEach((a, ri) => {
    for (let k = 0; k < 9; k++) {
      const an = R() * 6.28, rr = a[2] * (0.8 + R() * 0.55), x = a[0] + Math.cos(an) * rr, z = a[1] + Math.sin(an) * rr, s = 0.06 + R() * 0.09
      dummy0.position.set(x, Hgt(x, z) + 0.005, z); dummy0.rotation.set(0, R() * 6, 0); dummy0.scale.set(s * 1.4, s * 0.35, s); dummy0.updateMatrix()
      moss.setMatrixAt(ri * 9 + k, dummy0.matrix); moss.setColorAt(ri * 9 + k, new THREE.Color().setHSL(0.26 + R() * 0.03, 0.42, 0.36 + R() * 0.08))
    }
  })
  moss.instanceColor!.needsUpdate = true; moss.receiveShadow = true; world.add(moss)
  const NPB = 18, pebbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd3c8b6, roughness: 0.85 }), NPB)
  for (let i = 0; i < NPB; i++) {
    let x = 0, z = 0, t = 0
    do { const a = R() * 6.28, r = 1.3 + R() * (IR - 2); x = Math.cos(a) * r; z = Math.sin(a) * r; t++ } while (inPatch(x, z, 1.2) && t < 20)
    dummy0.position.set(x, Hgt(x, z) + 0.03, z); dummy0.rotation.set(R() * 3, R() * 3, R() * 3); dummy0.scale.set(0.7 + R() * 0.9, 0.5 + R() * 0.4, 0.7 + R() * 0.9); dummy0.updateMatrix(); pebbles.setMatrixAt(i, dummy0.matrix)
  }
  pebbles.castShadow = true; pebbles.receiveShadow = true; world.add(pebbles)

  /* pasto: mechones curvos de alturas variadas y pasto corto */
  const bladeGeo = (() => {
    /* un mechón = 10 hojitas de punta redondeada que se abren hacia afuera */
    const T = [0, .3, .58, .8, .93, 1], W = [1, 1.08, .98, .74, .42, 0], pos: number[] = [], col: number[] = [], nrm: number[] = [], rr = rng(12)
    for (let b = 0; b < 10; b++) {
      const ang = b / 10 * 6.283 + rr() * 0.6, ca = Math.cos(ang), sa = Math.sin(ang), lean = 0.06 + rr() * 0.16, h = 0.5 + rr() * 0.5, w = 0.032
      const P = (t: number, s: number) => { const o = lean * t * t * h * 1.4; return [ca * o - sa * s, t * h, sa * o + ca * s] }
      const nx = ca * 0.3, nz = sa * 0.3
      for (let k = 0; k < T.length - 1; k++) {
        const t0 = T[k], t1 = T[k + 1], w0 = W[k] * w, w1 = W[k + 1] * w
        const a = P(t0, -w0), bq = P(t0, w0), c = P(t1, w1), d = P(t1, -w1), c0 = 0.5 + 0.5 * t0, c1 = 0.5 + 0.5 * t1
        const quad: [number[], number][] = [[a, c0], [bq, c0], [c, c1], [a, c0], [c, c1], [d, c1], [a, c0], [c, c1], [bq, c0], [a, c0], [d, c1], [c, c1]]
        quad.forEach(q => { pos.push(q[0][0], q[0][1], q[0][2]); col.push(q[1], q[1], q[1]); nrm.push(nx, 0.9, nz) })
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3)); return g
  })()
  const bd: Brizna[] = []
  {
    let clumps = 0, guard = 0
    while (clumps < 90 && guard < 4000) {
      guard++
      const a = R() * 6.28, r = 0.95 + Math.sqrt(R()) * (IR - 1.35), x = Math.cos(a) * r, z = Math.sin(a) * r
      if (inPatch(x, z, 1.05) || vnoise(x * .9 + 3, z * .9 + 3) < 0.36) continue
      clumps++; const n = 1 + Math.floor(R() * 2), tall = 0.75 + R() * 0.5, hue = 0.25 + R() * 0.05
      for (let k = 0; k < n; k++) {
        const aa = R() * 6.28, rr = Math.sqrt(R()) * (0.1 + R() * 0.2)
        bd.push({ x: x + Math.cos(aa) * rr, z: z + Math.sin(aa) * rr, y: Hgt(x + Math.cos(aa) * rr, z + Math.sin(aa) * rr) - 0.02, h: (0.3 + R() * 0.14) * tall, w: 0.95 + R() * 0.3, yaw: R() * Math.PI, ph: R() * 6.28, f: R() * 0.8, c: [hue + (R() - .5) * .02, .42 + R() * .12, .36 + R() * .1] })
      }
    }
    let turf = 0; guard = 0
    while (turf < 300 && guard < 8000) {
      guard++
      const a = R() * 6.28, r = 0.8 + Math.sqrt(R()) * (IR - 1.1), x = Math.cos(a) * r, z = Math.sin(a) * r
      if (inPatch(x, z, .9) || vnoise(x * .7 + 11, z * .7 + 5) < 0.28) continue
      turf++; bd.push({ x, z, y: Hgt(x, z) - 0.02, h: (0.1 + R() * 0.08), w: 0.55 + R() * 0.25, yaw: R() * Math.PI, ph: R() * 6.28, f: R() * 0.8, c: [0.24 + R() * .05, .4 + R() * .12, .38 + R() * .08] })
    }
    for (let i = bd.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = bd[i]; bd[i] = bd[j]; bd[j] = t }
  }
  const NB = bd.length
  const blades = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), NB)
  blades.receiveShadow = true; blades.frustumCulled = false
  for (let i = 0; i < NB; i++) { const c = bd[i].c; blades.setColorAt(i, new THREE.Color().setHSL(c[0], c[1], c[2])) }
  blades.instanceColor!.needsUpdate = true; world.add(blades)

  /* flores en pequeños grupos */
  const NF = 60, flw: Flor[] = []
  {
    let g = 0
    while (flw.length < NF && g < 400) {
      g++
      const a = R() * 6.28, r = 1.3 + R() * (IR - 2), cx = Math.cos(a) * r, cz = Math.sin(a) * r; if (inPatch(cx, cz, 1)) continue
      const n = 3 + Math.floor(R() * 3), col = R() * 5 | 0
      for (let k = 0; k < n && flw.length < NF; k++) { const aa = R() * 6.28, rr = R() * 0.35; flw.push({ x: cx + Math.cos(aa) * rr, z: cz + Math.sin(aa) * rr, y: Hgt(cx + Math.cos(aa) * rr, cz + Math.sin(aa) * rr), h: 0.17 + R() * 0.2, c: col }) }
    }
  }
  while (flw.length < NF) flw.push({ x: 1 + flw.length * .05, z: -1, y: 0, h: .2, c: 0 })
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), new THREE.MeshStandardMaterial({ color: 0x3f7d3a }), NF)
  flw.forEach((f, i) => { dummy0.position.set(f.x, f.y + f.h / 2, f.z); dummy0.rotation.set(0, 0, 0); dummy0.scale.set(1, f.h, 1); dummy0.updateMatrix(); stems.setMatrixAt(i, dummy0.matrix) })
  world.add(stems)

  /* sombra de contacto bajo el árbol */
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex("rgba(0,0,0,.62)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false, opacity: .5 }))
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.03; contact.renderOrder = 1; world.add(contact)

  return { grassMat, grassDry, grassWet, soilMat, soilDry, soilWet, mound, waterTex, pond, pebbles, bd, NB, blades, flw, NF, stems, contact }
}

export type Isla = ReturnType<typeof crearIsla>

/** Las colinas lejanas del prototipo nunca se ven, pero consumían números de `R`. */
export function consumirColinas(R: Rng) {
  for (let ring = 0; ring < 2; ring++) { const n = ring ? 18 : 14; for (let i = 0; i < n; i++) { R(); R(); R(); R() } }
}
/** La corona de piedras del borde fue retirada en el prototipo; solo se consumen sus números. */
export function consumirBordillo(R: Rng) {
  for (let i = 0; i < 46 * 10; i++) R()
}
/** Las plantitas del piso quedaron ocultas en el prototipo; se replica su sorteo. */
export function consumirPlantitas(R: Rng) {
  let n = 0, g = 0
  while (n < 12 && g < 300) { g++; const a = R() * 6.28, r = 1.5 + R() * (IR - 2.4), x = Math.cos(a) * r, z = Math.sin(a) * r; if (inPatch(x, z, 1.1)) continue; R(); R(); R(); n++ }
}

/**
 * Detalles que van después del árbol: flores de 5 pétalos, raíces del borde,
 * tréboles, brotes, cama de tierra del árbol, arroyo con cascada y el claro
 * alrededor del tronco y del hormiguero.
 */
export function crearDetallesIsla(esc: Escena, isla: Isla, flowerTex: THREE.Texture, barkMat: THREE.MeshStandardMaterial, R: Rng) {
  const { world, puffTex } = esc
  const { flw, NF, bd, stems, mound, pebbles, pond } = isla
  const dummy0 = new THREE.Object3D()

  const flowerSp = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshLambertMaterial({ map: flowerTex, alphaTest: .5, side: THREE.DoubleSide, emissive: 0x444444 }), NF)
  const fSpC = [0xfff4dc, 0xffc9da, 0xffeaa0, 0xdccbff, 0xfff8ee]
  flw.forEach((f, i) => { dummy0.position.set(f.x, f.y + f.h + 0.05, f.z); dummy0.rotation.set(-0.85, R() * 6.28, 0, "YXZ"); dummy0.scale.set(0.8 + R() * 0.5, 0.8 + R() * 0.5, 1); dummy0.updateMatrix(); flowerSp.setMatrixAt(i, dummy0.matrix); flowerSp.setColorAt(i, new THREE.Color(fSpC[f.c % 5])) })
  flowerSp.instanceColor!.needsUpdate = true; world.add(flowerSp)
  consumirPlantitas(R)
  return { flowerSp, completar }

  /** Se llama después de crear el hormiguero (mismo orden del prototipo). */
  function completar() {
    /* raíces pequeñas que asoman por el borde de la isla */
    {
      const rr = rng(311), rootMat = barkMat.clone(); rootMat.color.set(0xffffff)
      for (let i = 0; i < 8; i++) {
        const a = rr() * 6.283, k = EDGEK(a), ex = Math.cos(a), ez = Math.sin(a), R0 = RT * k, y0 = Hgt(ex * R0 * 0.97, ez * R0 * 0.97) - 0.18
        const out = 0.18 + rr() * 0.18, drop = 0.55 + rr() * 0.7, sw = (rr() - .5) * 0.5
        const pts = [new THREE.Vector3(ex * R0 * 0.95, y0 + 0.05, ez * R0 * 0.95), new THREE.Vector3(ex * (R0 + out * 0.6) - ez * sw * 0.3, y0 - drop * 0.25, ez * (R0 + out * 0.6) + ex * sw * 0.3),
          new THREE.Vector3(ex * (R0 + out) - ez * sw * 0.6, y0 - drop * 0.65, ez * (R0 + out) + ex * sw * 0.6), new THREE.Vector3(ex * (R0 + out * 0.8) - ez * sw, y0 - drop, ez * (R0 + out * 0.8) + ex * sw)]
        const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.035 + rr() * 0.025, 6, false), rootMat); m.castShadow = true; world.add(m)
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), rootMat); tip.position.copy(pts[3]); world.add(tip)
      }
    }
    /* tréboles en grupitos y brotes junto a las raíces */
    const cloverGeo = (() => {
      const pos: number[] = [], nrm: number[] = [], N = 10
      for (let l = 0; l < 3; l++) {
        const a0 = l / 3 * 6.283, cx = Math.cos(a0) * 0.42, cz = Math.sin(a0) * 0.42
        for (let lobe = -1; lobe <= 1; lobe += 2) {
          const ox = cx + Math.cos(a0 + lobe * 1.2) * 0.14, oz = cz + Math.sin(a0 + lobe * 1.2) * 0.14
          for (let i = 0; i < N; i++) {
            const b0 = i / N * 6.283, b1 = (i + 1) / N * 6.283, r = 0.3
            ;[[ox, 0.08, oz], [ox + Math.cos(b1) * r, 0.04, oz + Math.sin(b1) * r], [ox + Math.cos(b0) * r, 0.04, oz + Math.sin(b0) * r]].forEach(p => { pos.push(p[0], p[1], p[2]); nrm.push(0, 1, 0) })
          }
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3)); return g
    })()
    const clovers = (() => {
      const N = 90, m = new THREE.InstancedMesh(cloverGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), N), d = new THREE.Object3D(), rr = rng(4242)
      let n = 0, guard = 0
      while (n < N && guard < 600) {
        guard++; const a = rr() * 6.283, r = 1.6 + rr() * (IR - 2.3), cx = Math.cos(a) * r, cz = Math.sin(a) * r; if (inPatch(cx, cz, 1.1)) continue
        const k = 4 + Math.floor(rr() * 6)
        for (let j = 0; j < k && n < N; j++) {
          const aa = rr() * 6.283, rd = rr() * 0.32, x = cx + Math.cos(aa) * rd, z = cz + Math.sin(aa) * rd
          d.position.set(x, Hgt(x, z) + 0.01, z); d.rotation.set((rr() - .5) * 0.3, rr() * 6.283, (rr() - .5) * 0.3); d.scale.setScalar(0.13 + rr() * 0.07); d.updateMatrix()
          m.setMatrixAt(n, d.matrix); m.setColorAt(n, new THREE.Color().setHSL(0.27 + rr() * 0.04, 0.48, 0.38 + rr() * 0.1)); n++
        }
      }
      m.count = n; m.instanceColor!.needsUpdate = true; m.receiveShadow = true; world.add(m); return m
    })()
    const sprouts = new THREE.Group(); world.add(sprouts)
    {
      const rr = rng(77), stemM = new THREE.MeshStandardMaterial({ color: 0x6aa84a, roughness: 0.9 }), lfM = new THREE.MeshStandardMaterial({ color: 0x8cc65e, roughness: 0.85, side: THREE.DoubleSide })
      const lg = new THREE.SphereGeometry(1, 10, 6)
      for (let i = 0; i < 9; i++) {
        const a = rr() * 6.283, r = 1.3 + rr() * 0.4, x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - HILL_XZ[0], z - HILL_XZ[1]) < 1.2) continue
        const g = new THREE.Group(); g.position.set(x, Hgt(x, z), z); g.rotation.y = rr() * 6.283; const s = 0.8 + rr() * 0.5; g.scale.setScalar(s)
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.14, 5), stemM); st.position.y = 0.07; g.add(st)
        ;[-1, 1].forEach(sd => { const l = new THREE.Mesh(lg, lfM); l.scale.set(0.045, 0.008, 0.025); l.position.set(sd * 0.04, 0.14, 0); l.rotation.z = sd * 0.45; g.add(l) })
        sprouts.add(g)
      }
    }
    /* tierra del árbol: cama de jardín con relieve suave y borde orgánico que se funde con el césped */
    {
      const NA2 = 72, NR2 = 10, pos: number[] = [], uv: number[] = [], idx: number[] = []
      pos.push(0, 1, 0); uv.push(0.5, 0.5)
      for (let j = 1; j <= NR2; j++) for (let i = 0; i < NA2; i++) {
        const a = i / NA2 * 6.283, ek = 1 + 0.1 * (vnoise(Math.cos(a) * 1.8 + 2, Math.sin(a) * 1.8 + 5) - 0.5) * 2, rr = j / NR2 * ek
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = j === NR2 ? -0.5 : Math.pow(1 - (j / NR2) * (j / NR2), 0.85) * (0.85 + 0.3 * vnoise(x * 4 + 1, z * 4 + 3))
        pos.push(x, y, z); uv.push(x * 0.5 + 0.5, z * 0.5 + 0.5)
      }
      for (let i = 0; i < NA2; i++) idx.push(0, 1 + (i + 1) % NA2, 1 + i)
      for (let j = 1; j < NR2; j++) for (let i = 0; i < NA2; i++) { const a = 1 + (j - 1) * NA2 + i, b2 = 1 + (j - 1) * NA2 + (i + 1) % NA2, c = 1 + j * NA2 + i, d = 1 + j * NA2 + (i + 1) % NA2; idx.push(a, b2, c, b2, d, c) }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
      mound.geometry.dispose(); mound.geometry = g; mound.scale.set(1.0, 0.075, 1.0)
    }
    /* arroyo del estanque y cascada que cae al mar */
    const fallU = { uTime: { value: 0 }, uOp: { value: 1 } }
    let mist: THREE.Sprite
    {
      const ux = POND[0] / 3.16, uz = POND[1] / 3.16, ang = Math.atan2(uz, ux), k = EDGEK(ang), R0 = RT * k
      /* cinta de agua del estanque al borde */
      const sp: number[] = [], si: number[] = [], su: number[] = [], N = 14, t0 = 0.55, t1 = R0 - 3.16 + 0.12
      for (let i = 0; i <= N; i++) {
        const tt = lerp(t0, t1, i / N), cx = POND[0] + ux * tt, cz = POND[1] + uz * tt, w = lerp(0.2, 0.24, i / N)
        ;[-1, 1].forEach(s => { sp.push(cx - uz * w * s, -0.13, cz + ux * w * s); su.push(s < 0 ? 0 : 1, i / N * 3) })
      }
      for (let i = 0; i < N; i++) { const a = i * 2; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
      const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute("uv", new THREE.Float32BufferAttribute(su, 2)); sg.setIndex(si); sg.computeVertexNormals()
      world.add(new THREE.Mesh(sg, pond.material))
      /* cascada: lámina que se curva hacia afuera y cae hasta el océano */
      const E = new THREE.Vector3(ux * (R0 + 0.05), -0.14, uz * (R0 + 0.05)), drop = E.y - WATER_Y, M = 40, fp: number[] = [], fi: number[] = [], fu: number[] = []
      for (let i = 0; i <= M; i++) {
        const v = i / M, out = 0.55 * Math.sqrt(v) + 0.25 * v, w = lerp(0.22, 0.42, v), cx = E.x + ux * out, cz = E.z + uz * out, y = E.y - drop * Math.pow(v, 1.25)
        ;[-1, 1].forEach(s => { fp.push(cx - uz * w * s, y, cz + ux * w * s); fu.push(s < 0 ? 0 : 1, v) })
      }
      for (let i = 0; i < M; i++) { const a = i * 2; fi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
      const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute("uv", new THREE.Float32BufferAttribute(fu, 2)); fg.setIndex(fi)
      const fall = new THREE.Mesh(fg, new THREE.ShaderMaterial({
        uniforms: fallU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: ["uniform float uTime;uniform float uOp;varying vec2 vUv;",
          "float h(float x){return fract(sin(x*91.7)*4375.85);}",
          "void main(){float x=vUv.x,y=vUv.y;float col=floor(x*14.0);float sp=0.8+h(col)*0.6;",
          " float st=fract(y*3.0*sp-uTime*1.6*sp+h(col+3.0));float streak=smoothstep(0.0,0.5,st)*smoothstep(1.0,0.6,st);",
          " float edge=smoothstep(0.0,0.22,x)*smoothstep(1.0,0.78,x);float fadeB=1.0-smoothstep(0.85,1.0,y);",
          " vec3 c=mix(vec3(0.78,0.93,0.97),vec3(1.0),streak*0.8);float a=(0.45+0.45*streak)*edge*fadeB*uOp;",
          " gl_FragColor=vec4(c,a);}"].join("\n"),
      }))
      fall.renderOrder = 5; world.add(fall)
      /* bruma donde cae el agua */
      mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.7, toneMapped: false }))
      mist.position.set(E.x + ux * 0.8, WATER_Y + 0.35, E.z + uz * 0.8); mist.scale.set(2.6, 1.2, 1); world.add(mist)
    }
    /* despejar la cama de tierra del árbol: nada de pasto, tréboles ni flores encima */
    {
      const CR = 1.22, z0 = new THREE.Matrix4().makeScale(0, 0, 0)
      for (let i = 0; i < bd.length; i++) if (Math.hypot(bd[i].x, bd[i].z) < CR) bd[i].h = 0.0001
      for (let i = 0; i < flw.length; i++) if (Math.hypot(flw[i].x, flw[i].z) < CR + 0.1) { flowerSp.setMatrixAt(i, z0); stems.setMatrixAt(i, z0) }
      flowerSp.instanceMatrix.needsUpdate = true; stems.instanceMatrix.needsUpdate = true
      const m = new THREE.Matrix4(), p = new THREE.Vector3()
      for (let i = 0; i < clovers.count; i++) { clovers.getMatrixAt(i, m); p.setFromMatrixPosition(m); if (Math.hypot(p.x, p.z) < CR) clovers.setMatrixAt(i, z0) }
      clovers.instanceMatrix.needsUpdate = true
      for (let i = 0; i < pebbles.count; i++) { pebbles.getMatrixAt(i, m); p.setFromMatrixPosition(m); if (Math.hypot(p.x, p.z) < CR) pebbles.setMatrixAt(i, z0) }
      pebbles.instanceMatrix.needsUpdate = true
    }
    return { sprouts, fallU, mist: mist! }
  }
}
