import * as THREE from "three"
import { TEX } from "./isla"
import { backOut, clamp, hash3, lerp, lienzo, piece, rng, smooth, type Rng } from "./utilidades"

/** Contorno de la hoja en corazón (0,0 = base, 0,1 = punta). */
const HN = 13
export const LEAF_LP: [number, number][] = (() => {
  const pts: [number, number][] = []
  for (let i = 0; i <= HN; i++) {
    const th = i / HN * Math.PI, x = 16 * Math.pow(Math.sin(th), 3), y = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)
    pts.push([x / 22, (5 - y) / 22])
  }
  return pts
})()

function leafTexture() {
  const S = 256, { c, g } = lienzo(S)
  const X = (x: number) => (x + 0.75) / 1.5 * S, Y = (y: number) => (y + 0.36) / 1.4 * S
  function outline() {
    g.beginPath(); LEAF_LP.forEach((p, i) => { const px = X(p[0]), py = Y(p[1]); if (i) g.lineTo(px, py); else g.moveTo(px, py) })
    for (let i = LEAF_LP.length - 1; i >= 0; i--) g.lineTo(X(-LEAF_LP[i][0]), Y(LEAF_LP[i][1])); g.closePath()
  }
  outline(); const gr = g.createLinearGradient(0, Y(-0.3), 0, Y(1)); gr.addColorStop(0, "#78a855"); gr.addColorStop(1, "#4f803a"); g.fillStyle = gr; g.fill()
  g.save(); g.clip(); const r = rng(4)
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, rad = 10 + r() * 28, gg = g.createRadialGradient(x, y, 0, x, y, rad)
    gg.addColorStop(0, r() < .5 ? "rgba(52,92,40,.22)" : "rgba(170,200,110,.2)"); gg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  g.strokeStyle = "rgba(205,228,165,.38)"; g.lineCap = "round"; g.lineWidth = 3; g.beginPath(); g.moveTo(X(0), Y(0.02)); g.lineTo(X(0), Y(0.9)); g.stroke()
  g.lineWidth = 1.6
  ;[0.14, 0.3, 0.46, 0.62].forEach((y0, i) => {
    const reach = [0.62, 0.55, 0.42, 0.28][i]
    ;[1, -1].forEach(s => { g.beginPath(); g.moveTo(X(0), Y(y0)); g.quadraticCurveTo(X(s * reach * 0.55), Y(y0 + 0.03), X(s * reach), Y(y0 + 0.16)); g.stroke() })
  })
  g.restore(); outline(); g.lineWidth = 3; g.lineJoin = "round"; g.strokeStyle = "#3c6130"; g.stroke()
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t
}

function flowerTexture() {
  const S = 128, { c, g } = lienzo(S); g.translate(64, 64)
  for (let i = 0; i < 5; i++) { g.save(); g.rotate(i / 5 * Math.PI * 2); g.beginPath(); g.ellipse(0, -27, 17, 26, 0, 0, 6.3); g.fillStyle = "#fffdf4"; g.fill(); g.lineWidth = 2.5; g.strokeStyle = "#cfc8a8"; g.stroke(); g.restore() }
  g.beginPath(); g.arc(0, 0, 13, 0, 6.3); g.fillStyle = "#f7cf3d"; g.fill(); g.lineWidth = 2; g.strokeStyle = "#d99a1c"; g.stroke()
  g.fillStyle = "#e0a020"; [[-4, -3], [4, -2], [0, 5], [-5, 4], [5, 5]].forEach(p => { g.beginPath(); g.arc(p[0], p[1], 1.5, 0, 6.3); g.fill() })
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t
}

/**
 * Hojas secas: con la salud del jardín baja, el verde se vuelve café (uSeco 0–1).
 * Se inyecta en el shader para que funcione sobre la textura y el tinte de cada hoja.
 */
export function aplicarSequedad(mat: THREE.Material, uSeco: { value: number }, previo?: (sh: THREE.Shader) => void) {
  /* sin esto three reutiliza el mismo programa para las hojas del árbol (con viento) y las que caen */
  mat.customProgramCacheKey = () => previo ? "kiri-hoja-viento" : "kiri-hoja-seca"
  mat.onBeforeCompile = sh => {
    previo?.(sh)
    sh.uniforms.uSeco = uSeco
    sh.fragmentShader = "uniform float uSeco;\n" + sh.fragmentShader.replace("#include <color_fragment>",
      "#include <color_fragment>\nfloat lumSeca=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(lumSeca*1.2,lumSeca*0.78,lumSeca*0.4),uSeco);")
  }
}

/** Rama curva con corteza (UV según el grosor). */
function makeBranchGeo(len: number, rb: number, rt: number, bend: number, rad = 8, seg = 5) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], rx = Math.max(1, Math.round(2 * Math.PI * rb / 0.7))
  for (let j = 0; j <= seg; j++) {
    const u = j / seg, cx = bend * u * u, cy = u * len, rr = lerp(rb, rt, Math.pow(u, 0.85))
    for (let k = 0; k <= rad; k++) {
      const a = k / rad * Math.PI * 2, kk = k % rad, wob = 1 + (hash3(kk * 1.7, j * 3.1, len * 9.1) - .5) * 0.12
      pos.push(cx + Math.cos(a) * rr * wob, cy, Math.sin(a) * rr * wob); uv.push(k / rad * rx, u * len / 0.5)
    }
  }
  for (let j = 0; j < seg; j++) for (let k = 0; k < rad; k++) { const a = j * (rad + 1) + k, b = a + rad + 1; idx.push(a, b, a + 1, a + 1, b, b + 1) }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g
}

/* ---------- hojas en corazón ---------- */
export const UNIT = HN * 2 * 3
/** Vértices de un racimo en arreglos tipados (sin objetos temporales: hay ~7.800 hojas). */
interface Acum { pos: Float32Array; nrm: Float32Array; uv: Float32Array; col: Float32Array; fl: Float32Array; v: number }
const LEAF_TINTS = [[0.62, 0.72, 0.55], [0.78, 0.88, 0.66], [0.92, 1.0, 0.78], [1.0, 1.0, 0.72], [0.7, 0.82, 0.6]]
/* contorno de medio corazón como triángulos (centro, p0, p1), ya en el orden de las dos mitades */
const TRIS: number[] = []
for (let i = 0; i < HN; i++) { const p0 = LEAF_LP[i], p1 = LEAF_LP[i + 1]; TRIS.push(0, 0.38, p0[0], p0[1], p1[0], p1[1], 0, 0.38, -p1[0], p1[1], -p0[0], p0[1]) }
const QP = new Float64Array(9)
function pushHeart(A: Acum, bx: number, by: number, bz: number, ax: number, ay: number, az: number, roll: number, L: number, fold: number, curl: number, ao: number, ph: number, tint: number[]) {
  let l = Math.sqrt(ax * ax + ay * ay + az * az) || 1
  const yx = ax / l, yy = ay / l, yz = az / l
  /* sv = yv × arriba; si son paralelos se usa el eje x */
  let sx = -yz, sz = yx; l = sx * sx + sz * sz
  if (l < 1e-4) { sx = 1; sz = 0 } else { l = Math.sqrt(l); sx /= l; sz /= l }
  /* nv = sv × yv */
  let nx = -sz * yy, ny = sz * yx - sx * yz, nz = sx * yy; l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l
  const cr = Math.cos(roll), sr = Math.sin(roll)
  const s2x = sx * cr + nx * sr, s2y = ny * sr, s2z = sz * cr + nz * sr
  const n2x = nx * cr - sx * sr, n2y = ny * cr, n2z = nz * cr - sz * sr
  for (let t = 0; t < TRIS.length; t += 6) {
    for (let k = 0; k < 3; k++) {
      const x = TRIS[t + k * 2], y = TRIS[t + k * 2 + 1], z = (fold * Math.abs(x) - curl * y * y) * L
      QP[k * 3] = bx + s2x * x * L + yx * y * L + n2x * z
      QP[k * 3 + 1] = by + s2y * x * L + yy * y * L + n2y * z
      QP[k * 3 + 2] = bz + s2z * x * L + yz * y * L + n2z * z
    }
    /* normal de la cara: si apunta al revés de n2 se invierte el orden */
    const e1x = QP[3] - QP[0], e1y = QP[4] - QP[1], e1z = QP[5] - QP[2], e2x = QP[6] - QP[0], e2y = QP[7] - QP[1], e2z = QP[8] - QP[2]
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x
    const invertir = fx * n2x + fy * n2y + fz * n2z < 0
    for (let j = 0; j < 3; j++) {
      const k = invertir && j ? 3 - j : j
      const px = QP[k * 3], py = QP[k * 3 + 1], pz = QP[k * 3 + 2], x = TRIS[t + k * 2], y = TRIS[t + k * 2 + 1]
      const ol = Math.sqrt(px * px + py * py + pz * pz) || 1
      let mx = n2x * 0.38 + px / ol * 0.62, my = n2y * 0.38 + py / ol * 0.62, mz = n2z * 0.38 + pz / ol * 0.62
      const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1; mx /= ml; my /= ml; mz /= ml
      const v = A.v++, c = ao * (0.9 + 0.1 * Math.min(1, y))
      A.pos[v * 3] = px; A.pos[v * 3 + 1] = py; A.pos[v * 3 + 2] = pz
      A.nrm[v * 3] = mx; A.nrm[v * 3 + 1] = my; A.nrm[v * 3 + 2] = mz
      A.uv[v * 2] = (x + 0.75) / 1.5; A.uv[v * 2 + 1] = 1 - (y + 0.36) / 1.4
      A.col[v * 3] = c * tint[0]; A.col[v * 3 + 1] = c * tint[1]; A.col[v * 3 + 2] = c * tint[2]
      A.fl[v * 2] = ph; A.fl[v * 2 + 1] = clamp(y)
    }
  }
}
function makeCluster(seed: number, N: number, L0: number, spread: number) {
  const r = rng(seed), nv = N * UNIT
  const A: Acum = { pos: new Float32Array(nv * 3), nrm: new Float32Array(nv * 3), uv: new Float32Array(nv * 2), col: new Float32Array(nv * 3), fl: new Float32Array(nv * 2), v: 0 }
  for (let i = 0; i < N; i++) {
    const th = i * 2.399 + r() * 0.8, el = 0.05 + r() * 1.1, ce = Math.cos(el)
    const dx = ce * Math.cos(th), dy = Math.sin(el), dz = ce * Math.sin(th), pl = (0.2 + 0.26 * r()) * spread
    const ay = dy - (0.3 + 0.9 * r())
    const L = L0 * (0.82 + 0.36 * r()), ao = 0.72 + 0.28 * Math.min(1, (pl + L * 0.5) / 0.85)
    let tint = LEAF_TINTS[Math.floor(r() * LEAF_TINTS.length)]; if (dy < 0.05) tint = [tint[0] * 0.8, tint[1] * 0.82, tint[2] * 0.8]
    pushHeart(A, dx * pl, dy * pl, dz * pl, dx, ay, dz, (r() - .5) * 1.2, L, 0.04 + 0.1 * r(), 0.05 + 0.1 * r(), ao * (0.93 + 0.12 * r()), r() * 6.28, tint)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(A.pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(A.nrm, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(A.uv, 2)); g.setAttribute("color", new THREE.BufferAttribute(A.col, 3))
  g.setAttribute("aFl", new THREE.BufferAttribute(A.fl, 2)); return g
}

/* ---------- el árbol ---------- */
export const RAD = [0.62, 0.34, 0.19, 0.1, 0.05]
const LEN = [3.6, 2.5, 1.8, 1.3]
const LEAFR = [1.0, 1.15, 1.1, 1.0]
const NK = [5, 3, 2, 0]
const BSTART = [-0.9, 1.0, 3.0, 5.0], LSTART = [-1.2, 1.8, 3.8, 5.8]
export const GX = [0, 1.9, 3.8, 6.2, 8.4, 10]

export interface Rama { pivot: THREE.Group; mesh: THREE.Mesh; depth: number; len: number; bend: number; attX: number; base: THREE.Euler; phase: number; kids: Rama[]; vis: number; early?: boolean }
export interface Racimo { g: THREE.Group; mesh: THREE.Mesh; branch: Rama; mid: boolean; r: number; s: number; seed: number; N: number; n: number }
export interface Manzana { mesh: THREE.Mesh; L: Racimo; grow: number }

/** Geometrías de la manzana (las del árbol, las que caen y los frutos del minijuego). */
export function crearPiezasFruta() {
  const fruitGeo = (() => {
    const g = new THREE.SphereGeometry(0.16, 18, 14), p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z) / 0.16; p.setY(i, y * 0.92 - 0.035 * Math.pow(Math.max(0, 1 - r), 3) * Math.sign(y) * (y > 0 ? 1 : 0.6)) }
    g.computeVertexNormals(); return g
  })()
  const fruitStemGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.08, 5); fruitStemGeo.translate(0, 0.17, 0)
  const fruitLeafGeo = new THREE.SphereGeometry(1, 8, 5); fruitLeafGeo.scale(0.05, 0.008, 0.025); fruitLeafGeo.translate(0.04, 0.19, 0)
  const fruitStemMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: .9 }), fruitLeafMat = new THREE.MeshStandardMaterial({ color: 0x4f8a34, roughness: .8 })
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0xd23a22, roughness: .38, emissive: 0x2a0602 })
  const decorar = (m: THREE.Mesh) => { m.add(new THREE.Mesh(fruitStemGeo, fruitStemMat)); const l = new THREE.Mesh(fruitLeafGeo, fruitLeafMat); l.rotation.z = 0.3; m.add(l); return m }
  return { fruitGeo, fruitMat, decorar }
}
export type PiezasFruta = ReturnType<typeof crearPiezasFruta>

export function crearArbol(world: THREE.Group, R: Rng, fruta: PiezasFruta) {
  const loader = new THREE.TextureLoader()
  const barkTex = loader.load(TEX + "bark_brown_02_diff.jpg"), barkNor = loader.load(TEX + "bark_brown_02_nor_gl.jpg")
  barkTex.wrapS = barkTex.wrapT = barkNor.wrapS = barkNor.wrapT = THREE.RepeatWrapping; barkTex.anisotropy = 4
  const barkMat = new THREE.MeshStandardMaterial({ map: barkTex, normalMap: barkNor, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95 })
  const barkTint = new THREE.Color(0xa8d680), barkWhite = new THREE.Color(0xffffff)

  const leafTex = leafTexture(), flowerTex = flowerTexture()
  const leafU = { uTime: { value: 0 }, uWind: { value: 0.3 }, uSeco: { value: 0 } }
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, side: THREE.DoubleSide, roughness: .85, emissive: new THREE.Color(0x0c1a06) })
  aplicarSequedad(leafMat, leafU.uSeco, sh => {
    sh.uniforms.uTime = leafU.uTime; sh.uniforms.uWind = leafU.uWind
    sh.vertexShader = "attribute vec2 aFl;uniform float uTime;uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      "vec3 transformed=vec3(position);float wv=sin(uTime*(2.2+aFl.x*0.5)+aFl.x*5.0)*0.045*aFl.y*(0.35+uWind);transformed+=normal*wv;transformed.x+=sin(uTime*1.3+aFl.x*2.0)*0.02*aFl.y*uWind;")
  })
  const petalMatTree = new THREE.MeshLambertMaterial({ map: flowerTex, alphaTest: .5, side: THREE.DoubleSide, emissive: 0x555555 })

  let clSeed = 500
  /* racimos de hojas: 6 variantes por tamaño, giradas al azar en cada rama (antes ~115 distintos);
     los del mismo tamaño comparten densidad, así que también comparten el rango de dibujo */
  const VARIANTES = 6, racimos = new Map<number, THREE.BufferGeometry[]>()
  function racimo(N: number) {
    const lista = racimos.get(N) ?? []; racimos.set(N, lista)
    const seed = clSeed++
    if (lista.length < VARIANTES) { const g = makeCluster(seed, N, 0.2, 1.3); lista.push(g); return g }
    return lista[seed % VARIANTES]
  }
  const root = new THREE.Group(); world.add(root)
  const branches: Rama[] = [], leaves: Racimo[] = [], apples: Manzana[] = [], blossoms: { mesh: THREE.Mesh; L: Racimo }[] = [], hitMeshes: THREE.Object3D[] = []

  /* base del tronco y raíces anchas tipo contrafuerte */
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.66, 0.55, 12, 1), barkMat)
  flare.position.y = 0.18; flare.castShadow = true; flare.receiveShadow = true; root.add(flare)
  const roots = new THREE.Group(); root.add(roots)
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + R() * .5, len = 1.3 + R() * 0.3, g = makeBranchGeo(len, 0.3, 0.05, 0.0, 8, 5)
    const m = new THREE.Mesh(g, barkMat); m.castShadow = true; m.receiveShadow = true
    const holder = new THREE.Group(); holder.rotation.y = a; holder.add(m); m.rotation.set(0, 0, -(1.95 + R() * .2)); m.position.set(0.12, 0.42, 0); roots.add(holder)
  }

  function addCluster(pivot: THREE.Group, b: Rama, y: number, xOff: number, r: number, mid: boolean, N: number) {
    const g = new THREE.Group(); g.position.set(xOff, y, 0)
    const mesh = new THREE.Mesh(racimo(N), leafMat)
    mesh.scale.setScalar(r); mesh.rotation.y = R() * 6.28; mesh.castShadow = true; mesh.receiveShadow = true
    g.add(mesh); pivot.add(g); hitMeshes.push(mesh)
    const L: Racimo = { g, mesh, branch: b, mid, r, s: 0, seed: R() * 6.28, N, n: N }; leaves.push(L); return L
  }
  function addBranch(parent: THREE.Object3D, parentB: Rama | null, depth: number, tilt: number, yaw: number, tFrac: number, leader: boolean): Rama {
    const pivot = new THREE.Group(), len = LEN[depth] * (0.88 + R() * 0.24) * (leader ? 1.06 : 1), bend = (R() - .5) * len * (depth === 0 ? 0.1 : 0.3)
    pivot.rotation.set(tilt, yaw, 0, "YXZ"); let attX = 0
    if (parentB) { attX = parentB.bend * tFrac * tFrac; pivot.position.set(attX, parentB.len * tFrac, 0) } else pivot.position.y = 0.1
    const mesh = new THREE.Mesh(makeBranchGeo(len, RAD[depth], RAD[depth + 1], bend, 8, 5), barkMat)
    mesh.castShadow = true; mesh.receiveShadow = true; pivot.add(mesh); hitMeshes.push(mesh); parent.add(pivot)
    const b: Rama = { pivot, mesh, depth, len, bend, attX, base: pivot.rotation.clone(), phase: R() * 6.283, kids: [], vis: 0 }
    branches.push(b)
    addCluster(pivot, b, len, bend, LEAFR[depth], false, depth === 0 ? 36 : (depth === 1 ? 76 : 120))
    if (depth >= 2) { const f = 0.45 + R() * 0.2; addCluster(pivot, b, len * f, bend * f * f, LEAFR[depth] * 0.9, true, 76) }
    const n = NK[depth]
    for (let i = 0; i < n; i++) {
      const isLeader = i === n - 1 && depth <= 1, t = depth === 0 ? [0.66, 0.73, 0.8, 0.88, 0.99][i] : (isLeader ? 0.98 : 0.62 + 0.33 * (i / Math.max(1, n - 1)))
      const yawC = (i / n) * Math.PI * 2 + (depth === 0 ? R() * 0.35 : R() * 0.8) + depth * 1.1, tiltC = isLeader ? (depth === 0 ? 0.12 + R() * 0.2 : 0.3 + R() * 0.25) : (depth === 0 ? 0.72 + R() * 0.18 : (depth === 1 ? 0.6 + R() * 0.25 : 0.42 + R() * 0.22))
      const kb = addBranch(pivot, b, depth + 1, tiltC, yawC, t, isLeader); if (depth === 0 && i >= n - 2) kb.early = true; b.kids.push(kb)
    }
    return b
  }
  addBranch(root, null, 0, 0.02, 0, 0, false)

  /* flores de 5 pétalos (nivel 6) y frutos */
  const flowerGeoP = new THREE.PlaneGeometry(1, 1)
  {
    const tips = leaves.filter(l => !l.mid && l.branch.depth >= 3), pool = leaves.filter(l => l.branch.depth >= 2)
    for (let i = 0; i < 26; i++) {
      const L = tips[Math.floor(R() * tips.length)], m = fruta.decorar(new THREE.Mesh(fruta.fruitGeo, fruta.fruitMat)); m.castShadow = true
      m.position.set(R() - .5, -0.55 - R() * .4, R() - .5).normalize().multiplyScalar(L.r * 0.8); m.scale.setScalar(0.0001); L.g.add(m); apples.push({ mesh: m, L, grow: 1 })
    }
    for (let i = 0; i < 64; i++) {
      const L = pool[Math.floor(R() * pool.length)], m = new THREE.Mesh(flowerGeoP, petalMatTree), d = new THREE.Vector3(R() - .5, R() - .1, R() - .5).normalize()
      m.position.copy(d).multiplyScalar(L.r * 0.78); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); m.rotateZ(R() * 6.28); m.scale.setScalar(0.0001); L.g.add(m); blossoms.push({ mesh: m, L })
    }
    /* el nivel 6 florece de verdad: más flores, algunas rosadas (generador propio para no mover el sorteo de R) */
    const rf = rng(6060), petalMatRosa = new THREE.MeshLambertMaterial({ map: flowerTex, color: 0xffc9dd, alphaTest: .5, side: THREE.DoubleSide, emissive: 0x553344 })
    for (let i = 0; i < 110; i++) {
      const L = pool[Math.floor(rf() * pool.length)], m = new THREE.Mesh(flowerGeoP, rf() < 0.35 ? petalMatRosa : petalMatTree), d = new THREE.Vector3(rf() - .5, rf() - .05, rf() - .5).normalize()
      m.position.copy(d).multiplyScalar(L.r * (0.74 + rf() * 0.1)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); m.rotateZ(rf() * 6.28); m.scale.setScalar(0.0001); L.g.add(m); blossoms.push({ mesh: m, L })
    }
  }

  /* ---------- semilla: dos mitades que se abren (nivel 1 a 2) ---------- */
  const seedG = new THREE.Group(); world.add(seedG)
  const seedTex = (() => {
    const { c, g } = lienzo(256), r = rng(8)
    const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "#9a6a3c"); gr.addColorStop(.5, "#8a5a32"); gr.addColorStop(1, "#744826"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 26; i++) { const x = r() * 256, y = r() * 256, rad = 5 + r() * 10; g.fillStyle = "rgba(88,54,28," + (0.35 + r() * 0.3) + ")"; g.beginPath(); g.ellipse(x, y, rad, rad * 0.8, 0, 0, 6.3); g.fill() }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t
  })()
  const shellOut = new THREE.MeshStandardMaterial({ map: seedTex, roughness: .6 })
  const shellIn = new THREE.MeshStandardMaterial({ color: 0xcfa468, roughness: .9, side: THREE.BackSide })
  const cutOut = new THREE.MeshStandardMaterial({ color: 0xd8b073, roughness: 1, side: THREE.DoubleSide })
  const cutIn = new THREE.MeshStandardMaterial({ color: 0x7a5532, roughness: 1, side: THREE.DoubleSide })
  function makeHalf(sign: number) {
    const g = new THREE.Group(), m = new THREE.Group(); m.position.y = 0.4; g.add(m)
    const ps = sign > 0 ? Math.PI / 2 : -Math.PI / 2, geo = new THREE.SphereGeometry(1, 28, 16, ps, Math.PI)
    const o = new THREE.Mesh(geo, shellOut), i = new THREE.Mesh(geo, shellIn); o.scale.set(0.28, 0.4, 0.3); i.scale.set(0.275, 0.395, 0.295); o.castShadow = true; i.castShadow = true
    const c1 = new THREE.Mesh(new THREE.CircleGeometry(1, 28), cutOut), c2 = new THREE.Mesh(new THREE.CircleGeometry(0.78, 28), cutIn)
    ;[c1, c2].forEach((c, k) => { c.rotation.y = Math.PI / 2; c.position.x = k ? 0.003 * sign : 0 })
    c1.scale.set(0.3, 0.4, 1); c2.scale.set(0.3 * 0.78, 0.4 * 0.78, 1)
    m.add(o); m.add(i); m.add(c1); m.add(c2); hitMeshes.push(o); g.position.y = 0.04; seedG.add(g); return g
  }
  const halfR = makeHalf(1), halfL = makeHalf(-1)
  seedG.position.y = -0.17 /* semilla medio enterrada */

  /* zona de toque invisible: en semilla y brote la planta es pequeña y cuesta acertarle */
  const toqueFacil = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ visible: false }))
  toqueFacil.position.y = 0.45; world.add(toqueFacil)

  let thick = 0.25

  /** El brote mira de frente: sus dos ramitas se ven a los lados. */
  function orientarBrote() { const k = branches[0].kids, tw = k[k.length - 2]; root.rotation.y = 0.28 + Math.PI / 2 - tw.pivot.rotation.y }
  /** Una rama más hacia la derecha de la vista, para equilibrar la copa. */
  function ramaExtra() { const b0 = branches[0], th = 0.28, yaw = Math.PI / 2 + th - root.rotation.y + 0.15; const kb = addBranch(b0.pivot, b0, 1, 0.98, yaw, 0.74, false); b0.kids.push(kb) }

  /** Crecimiento continuo: G va de 0 (semilla) a 10 (jardín próspero). `seco` quita hojas sin dejar el árbol pelado. */
  function applyGrowth(G: number, seco: number) {
    thick = piece(G, GX, [.13, .3, .58, .82, .95, 1.05])
    barkMat.color.copy(barkTint).lerp(barkWhite, smooth(G / 1.8))
    const D = piece(G, GX, [.43, .47, .55, .8, 1, 1]) * (1 - 0.45 * seco)
    for (const b of branches) {
      b.vis = b.depth === 0 ? (0.3 + 0.7 * smooth(G / 4.6)) : (b.early ? Math.max(0.95 * smooth((G + 0.3) / 1.1), smooth((G - BSTART[1]) / 1.8)) : smooth((G - BSTART[b.depth]) / 1.8))
      b.pivot.scale.setScalar(Math.max(b.vis, 0.0001)); b.pivot.visible = b.vis > 0.002; b.mesh.scale.set(thick, 1, thick)
      if (b.depth > 0) b.pivot.position.x = b.attX * thick
    }
    flare.scale.set(thick, 1, thick)
    for (const L of leaves) {
      const b = L.branch; let s = backOut((G - (LSTART[b.depth] + (L.mid ? 0.5 : 0))) / 1.4)
      if (b.early && !L.mid) s = Math.max(s, backOut((G + 0.1) / 1.0) * lerp(1.7, 1, smooth((G - 1.5) / 2.5)))
      if (!L.mid && b.kids.length) s *= 1 - (b.depth === 0 ? 0.97 : 0.9) * b.kids[0].vis
      L.s = s; const n = Math.max(1, Math.round(L.N * D)); if (n !== L.n) { L.n = n; L.mesh.geometry.setDrawRange(0, n * UNIT) }
    }
    const fs = smooth((G - 7.4) / 0.9), bs = smooth((G - 8.15) / 0.25) /* florecido completo desde que empieza el nivel 6 (G 8.4) */
    for (const a of apples) { const s = fs * a.grow * 1.25; a.mesh.scale.setScalar(Math.max(s, 0.0001)); a.mesh.visible = s > 0.01 }
    for (const bl of blossoms) { const s = bs * 0.44;bl.mesh.scale.setScalar(Math.max(s, 0.0001)); bl.mesh.visible = bs > 0.01 }
  }

  const AQ = new THREE.Vector3()
  /** Punto sobre la corteza del tronco (ángulo a, altura relativa u) en coordenadas de la isla. */
  function trunkPoint(a: number, u: number, out: THREE.Vector3, nrm?: THREE.Vector3) {
    const b = branches[0], rr = lerp(RAD[0], RAD[1], Math.pow(u, 0.85)) * 1.04 + 0.012
    out.set(thick * (b.bend * u * u + Math.cos(a) * rr), u * b.len, thick * Math.sin(a) * rr)
    AQ.set(thick * b.bend * u * u, u * b.len, 0); b.pivot.localToWorld(out); b.pivot.localToWorld(AQ); world.worldToLocal(out); world.worldToLocal(AQ)
    if (nrm) nrm.copy(out).sub(AQ).setY(0).normalize()
    return out
  }

  return {
    barkMat, leafTex, flowerTex, leafU, root, roots, branches, leaves, apples, blossoms, hitMeshes, seedG, halfR, halfL, toqueFacil,
    orientarBrote, ramaExtra, applyGrowth, trunkPoint, get thick() { return thick },
  }
}

export type Arbol = ReturnType<typeof crearArbol>

export function treeTop(G: number) { return piece(G, GX, [0.6, 1.8, 4.0, 6.9, 7.9, 8.4]) }
