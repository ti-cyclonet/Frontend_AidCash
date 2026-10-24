import * as THREE from "three"
import type { Arbol } from "./arbol"
import type { Isla } from "./isla"
import { Hgt, HILL_XZ } from "./terreno"
import { backOut, clamp, hash3, lerp, rng, smooth, vnoise } from "./utilidades"

/** Hormiguero, hormigas de plastilina y lo que cargan por cada gasto hormiga. */

export interface GastoHormiga3D { nombre: string; monto: number }

const HILL = new THREE.Vector3(HILL_XZ[0], 0, HILL_XZ[1])
const HOLE_DIR = new THREE.Vector3(0.55, 0, 0.62).normalize() /* la boca mira al frente, hacia el árbol */
const HS = 1.05, ANT_S = 0.39

interface DatosHormiga { legs: { g: THREE.Group; ph: number }[]; head: THREE.Group; body: THREE.Group; carry: THREE.Group; info?: GastoHormiga3D }
type Hormiga = THREE.Group & { userData: DatosHormiga }

/* --- objetos que cargan (arcilla simple) --- */
const M = (c: number, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r })
function part(grp: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; grp.add(m); return m
}
const ITEMS: Record<string, () => THREE.Group> = {
  cafe: () => {
    const g = new THREE.Group()
    part(g, new THREE.CylinderGeometry(0.15, 0.11, 0.36, 18), M(0xf3ebdd), 0, 0.18, 0)
    part(g, new THREE.CylinderGeometry(0.143, 0.13, 0.13, 18), M(0xa8673a), 0, 0.17, 0)
    part(g, new THREE.CylinderGeometry(0.165, 0.165, 0.05, 18), M(0xf0f0ea), 0, 0.38, 0)
    part(g, new THREE.CylinderGeometry(0.11, 0.15, 0.06, 18), M(0xe8742f), 0, 0.43, 0); return g
  },
  hamburguesa: () => {
    const g = new THREE.Group(), bun = M(0xe39b4a, 0.6)
    const b0 = part(g, new THREE.SphereGeometry(0.21, 18, 10, 0, 6.283, Math.PI / 2, Math.PI / 2), bun, 0, 0.08, 0); b0.scale.set(1, 0.45, 1)
    part(g, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18), M(0x5b3420, 0.8), 0, 0.1, 0)
    part(g, new THREE.BoxGeometry(0.36, 0.02, 0.36), M(0xf5c43a), 0, 0.14, 0, 0, 0.6, 0)
    const le = part(g, new THREE.CylinderGeometry(0.235, 0.235, 0.03, 10), M(0x6fbf4a), 0, 0.165, 0); le.scale.set(1, 1, 0.95)
    const b1 = part(g, new THREE.SphereGeometry(0.22, 18, 12, 0, 6.283, 0, Math.PI / 2), bun, 0, 0.17, 0); b1.scale.set(1, 0.8, 1)
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.05 + 0.1 * ((i * 37) % 10) / 10; part(g, new THREE.SphereGeometry(0.014, 6, 4), M(0xfff6dc), Math.cos(a) * r, 0.17 + 0.17 * Math.sqrt(Math.max(0, 1 - (r / 0.22) * (r / 0.22))), Math.sin(a) * r) }
    return g
  },
  carro: () => {
    const g = new THREE.Group(), y = M(0xf2c230, 0.45), w = M(0x2a2a2e, 0.7), gl = M(0x9fd4f0, 0.2)
    part(g, new THREE.BoxGeometry(0.52, 0.14, 0.27), y, 0, 0.12, 0)
    part(g, new THREE.BoxGeometry(0.28, 0.13, 0.24), y, -0.02, 0.25, 0)
    part(g, new THREE.BoxGeometry(0.3, 0.08, 0.245), gl, -0.02, 0.25, 0)
    part(g, new THREE.BoxGeometry(0.1, 0.04, 0.06), M(0xfaf3d0), -0.02, 0.335, 0)
    part(g, new THREE.BoxGeometry(0.53, 0.03, 0.275), M(0x222222), 0, 0.115, 0)
    ;[[0.16, 0.13], [-0.16, 0.13], [0.16, -0.13], [-0.16, -0.13]].forEach(p => { part(g, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14), w, p[0], 0.06, p[1], Math.PI / 2) })
    return g
  },
  gaseosa: () => {
    const g = new THREE.Group()
    part(g, new THREE.CylinderGeometry(0.1, 0.1, 0.3, 18), M(0xd8343a, 0.35), 0, 0.16, 0)
    part(g, new THREE.CylinderGeometry(0.103, 0.103, 0.08, 18), M(0xffffff, 0.35), 0, 0.17, 0)
    part(g, new THREE.CylinderGeometry(0.085, 0.1, 0.03, 18), M(0xc9ccd2, 0.3), 0, 0.325, 0); return g
  },
  helado: () => {
    const g = new THREE.Group()
    part(g, new THREE.ConeGeometry(0.11, 0.3, 14), M(0xd9a35f, 0.7), 0, 0.15, 0, Math.PI)
    part(g, new THREE.SphereGeometry(0.13, 16, 12), M(0xf6a3c0, 0.5), 0, 0.33, 0)
    part(g, new THREE.SphereGeometry(0.03, 8, 6), M(0xd8343a, 0.4), 0.02, 0.47, 0); return g
  },
  domicilio: () => {
    const g = new THREE.Group()
    part(g, new THREE.BoxGeometry(0.34, 0.28, 0.3), M(0xd9a066, 0.75), 0, 0.14, 0)
    part(g, new THREE.BoxGeometry(0.345, 0.285, 0.07), M(0xc78a4f, 0.75), 0, 0.14, 0)
    part(g, new THREE.BoxGeometry(0.12, 0.01, 0.12), M(0xfaf3e6, 0.8), 0.06, 0.285, 0.06); return g
  },
  boleta: () => {
    const g = new THREE.Group()
    part(g, new THREE.BoxGeometry(0.42, 0.22, 0.05), M(0xe2484a, 0.5), 0, 0.13, 0)
    const tr = new THREE.Shape(); tr.moveTo(-0.04, -0.05); tr.lineTo(0.06, 0); tr.lineTo(-0.04, 0.05); tr.closePath()
    part(g, new THREE.ShapeGeometry(tr), M(0xffffff, 0.5), 0, 0.13, 0.027); return g
  },
  pizza: () => {
    const g = new THREE.Group(), s = new THREE.Shape(); s.moveTo(0, -0.2); s.lineTo(0.17, 0.16); s.quadraticCurveTo(0, 0.22, -0.17, 0.16); s.closePath()
    part(g, new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }), M(0xf3c64a, 0.6), 0, 0.2, -0.02)
    part(g, new THREE.BoxGeometry(0.36, 0.05, 0.05), M(0xd08a3c, 0.7), 0, 0.37, 0.0)
    ;[[0.04, 0.06], [-0.05, 0.1], [0, -0.05]].forEach(p => { part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.01, 12), M(0xc23a2c, 0.5), p[0], 0.2 + p[1], 0.025, Math.PI / 2) })
    return g
  },
}

const norm = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
/** Qué objeto carga la hormiga según el nombre del gasto. */
export function objetoParaGasto(nombre: string) {
  const n = norm(nombre), has = (l: string[]) => l.some(k => new RegExp("(^|[^a-z])" + k).test(n))
  if (has(["domicilio", "rappi", "ifood", "uber eats", "didi food"])) return "domicilio"
  if (has(["cafe", "tinto", "starbucks", "capuchino", "latte", "espresso", "juan valdez"])) return "cafe"
  if (has(["pizza"])) return "pizza"
  if (has(["hamburguesa", "almuerzo", "desayuno", "perro", "sandwich", "arepa", "empanada", "comida", "bunuelo"])) return "hamburguesa"
  if (has(["uber", "indriver", "in driver", "didi", "cabify", "picap", "taxi", "bus", "transmilenio", "metro", "pasaje", "parqueadero", "peaje", "gasolina"])) return "carro"
  if (has(["gaseosa", "jugo", "cerveza", "trago", "agua", "bebida", "coca"])) return "gaseosa"
  if (has(["helado", "postre", "dulce", "chocolate", "galleta", "chicle", "golosina", "snack", "papas", "antojo"])) return "helado"
  if (has(["cine", "boleta", "cover", "netflix", "spotify", "juego"])) return "boleta"
  return "domicilio"
}

export interface OpcionesHormigas {
  formatear: (monto: number) => string
  fuente: string
  pop: () => void
  alTerminar: (total: number) => void
}

export function crearHormigas(world: THREE.Group, isla: Isla, arbol: Arbol, flowerSp: THREE.InstancedMesh, op: OpcionesHormigas) {
  const { bd, flw, stems, mound } = isla
  const hillG = new THREE.Group(); hillG.position.copy(HILL); hillG.scale.setScalar(HS); world.add(hillG)
  {
    /* montículo arenoso con bultos */
    const prof = [[0.92, 0], [0.84, 0.05], [0.7, 0.15], [0.55, 0.29], [0.4, 0.43], [0.27, 0.54], [0.14, 0.61], [0.0, 0.635]].map(p => new THREE.Vector2(p[0], p[1]))
    const g = new THREE.LatheGeometry(prof, 40); const p = g.attributes.position as THREE.BufferAttribute, cols: number[] = []
    const ca = new THREE.Color(0xc98d4f), cb = new THREE.Color(0x9a6233), cc = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z)
      if (r > 0.01 && y > 0.01) { const k = 1 + (vnoise(x * 4.2 + 3, z * 4.2 + y * 3) - 0.5) * 0.22; p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, y * (1 + (vnoise(z * 5, x * 5) - 0.5) * 0.12)) }
      cc.copy(ca).lerp(cb, clamp(0.25 + (hash3(x * 9, y * 9, z * 9) - .5) * 0.6 + (0.4 - y) * 0.3)); cols.push(cc.r, cc.g, cc.b)
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals()
    const hill = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }))
    hill.castShadow = true; hill.receiveShadow = true; hillG.add(hill)
    /* boca: túnel oscuro + labio */
    const a = Math.atan2(HOLE_DIR.x, HOLE_DIR.z)
    const mouth = new THREE.Group(); mouth.rotation.y = a; hillG.add(mouth)
    const tunMat = new THREE.MeshBasicMaterial({ color: 0x140b05, polygonOffset: true, polygonOffsetFactor: -2 })
    const tun = new THREE.Mesh(new THREE.CircleGeometry(1, 24), tunMat)
    tun.scale.set(0.19, 0.16, 1); tun.position.set(0, 0.165, 0.7); tun.rotation.x = -0.5; tun.renderOrder = 3; mouth.add(tun)
    const lip = new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 8, 24, Math.PI * 1.15), new THREE.MeshStandardMaterial({ color: 0xb67a42, roughness: 1 }))
    lip.scale.set(0.21, 0.19, 0.2); lip.position.set(0, 0.165, 0.675); lip.rotation.set(-0.55, 0, -0.07 * Math.PI); lip.castShadow = true; mouth.add(lip)
    /* piedritas y granos */
    const pb = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 70)
    const d = new THREE.Object3D(), rr = rng(919), holeAng = Math.atan2(HOLE_DIR.z, HOLE_DIR.x)
    for (let i = 0; i < 70; i++) {
      const ang = rr() * 6.283, onHill = i < 42, rad = onHill ? 0.15 + rr() * 0.7 : 0.85 + rr() * 0.55
      const y = onHill ? Math.max(0.02, 0.63 * (1 - Math.pow(rad / 0.92, 1.3))) : 0.015
      d.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad); d.rotation.set(rr() * 3, rr() * 3, rr() * 3); const s = onHill ? 0.025 + rr() * 0.035 : 0.015 + rr() * 0.03; d.scale.set(s, s * 0.75, s)
      if (Math.abs(Math.atan2(Math.sin(ang - holeAng), Math.cos(ang - holeAng))) < 0.4 && onHill && rad < 0.75) d.scale.setScalar(0.0001)
      d.updateMatrix(); pb.setMatrixAt(i, d.matrix); pb.setColorAt(i, new THREE.Color().setHSL(0.07 + rr() * 0.03, 0.35 + rr() * 0.2, 0.38 + rr() * 0.25))
    }
    pb.instanceColor!.needsUpdate = true; pb.castShadow = true; hillG.add(pb)
    /* mancha de tierra suelta alrededor */
    const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d")!, gr = x.createRadialGradient(64, 64, 10, 64, 64, 64)
    gr.addColorStop(0, "rgba(150,100,55,.95)"); gr.addColorStop(.6, "rgba(150,100,55,.55)"); gr.addColorStop(1, "rgba(150,100,55,0)"); x.fillStyle = gr; x.fillRect(0, 0, 128, 128)
    const sp = new THREE.Mesh(new THREE.CircleGeometry(1.45, 32), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, roughness: 1 }))
    sp.rotation.x = -Math.PI / 2; sp.position.y = 0.012; sp.receiveShadow = true; hillG.add(sp)
    /* despejar pasto y flores encima del hormiguero */
    const near = (px: number, pz: number, r: number) => Math.hypot(px - HILL.x, pz - HILL.z) < r
    for (let i = 0; i < bd.length; i++) if (near(bd[i].x, bd[i].z, 1.0 * HS)) bd[i].h = 0.0001
    const z0 = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let i = 0; i < flw.length; i++) if (near(flw[i].x, flw[i].z, 1.25 * HS)) { flowerSp.setMatrixAt(i, z0); stems.setMatrixAt(i, z0) }
    flowerSp.instanceMatrix.needsUpdate = true; stems.instanceMatrix.needsUpdate = true
  }

  /* --- la hormiga de arcilla --- */
  const antStripe = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d")!
    g.fillStyle = "#8f5434"; g.fillRect(0, 0, 64, 128); g.fillStyle = "rgba(70,36,18,.55)"; for (let i = 0; i < 5; i++) g.fillRect(0, 14 + i * 24, 64, 7)
    return new THREE.CanvasTexture(c)
  })()
  const antMat = new THREE.MeshStandardMaterial({ color: 0x8f5434, roughness: 0.55 })
  const antBelly = new THREE.MeshStandardMaterial({ map: antStripe, roughness: 0.55 })
  const antDark = new THREE.MeshStandardMaterial({ color: 0x4a2814, roughness: 0.6 })
  const antEye = new THREE.MeshStandardMaterial({ color: 0x140a04, roughness: 0.25 })
  const antCheek = new THREE.MeshStandardMaterial({ color: 0xd98a78, roughness: 0.7 })
  const antHL = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const antHit: THREE.Mesh[] = []
  function makeAnt(): Hormiga {
    const g = new THREE.Group() as Hormiga, body = new THREE.Group(); g.add(body)
    function sph(r: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, m: THREE.Material) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); s.position.set(x, y, z); s.scale.set(sx, sy, sz); s.castShadow = true; body.add(s); antHit.push(s); s.userData.ant = g; return s
    }
    const abd = sph(0.3, 0, 0.33, -0.44, 0.9, 0.82, 1.12, antBelly); abd.rotation.x = 0.25
    sph(0.075, 0, 0.3, -0.13, 1, 1, 1, antMat)
    sph(0.15, 0, 0.31, 0.03, 0.85, 0.85, 1.25, antMat)
    const head = new THREE.Group(); head.position.set(0, 0.45, 0.3); body.add(head)
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), antMat); hm.castShadow = true; head.add(hm); antHit.push(hm); hm.userData.ant = g
    ;[-1, 1].forEach(s => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), antEye); e.position.set(s * 0.085, 0.04, 0.205); e.scale.set(0.85, 1.15, 0.6); head.add(e)
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), antHL); hl.position.set(s * 0.085 + 0.012, 0.058, 0.232); head.add(hl)
      const ck = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), antCheek); ck.position.set(s * 0.15, -0.035, 0.165); ck.scale.set(1, 0.6, 0.5); head.add(ck)
      const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.06, 0.2, 0.05), new THREE.Vector3(s * 0.12, 0.36, 0.08), new THREE.Vector3(s * 0.2, 0.45, 0.2)])
      head.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 10, 0.016, 5, false), antDark))
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), antMat); tip.position.set(s * 0.2, 0.45, 0.2); head.add(tip)
    })
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 5, 12, Math.PI * 0.9), antDark); smile.position.set(0, -0.05, 0.215); smile.rotation.set(0.25, 0, Math.PI * 1.05); head.add(smile)
    /* 6 patas en dos tramos, marcha en trípode */
    const legs: DatosHormiga["legs"] = []
    ;[0.12, 0.03, -0.07].forEach((z, row) => {
      [-1, 1].forEach(s => {
        const lp = new THREE.Group(); lp.position.set(s * 0.1, 0.28, z); body.add(lp)
        const sw = [0.5, 0, -0.5][row], cv = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.2, 0.1, sw * 0.12), new THREE.Vector3(s * 0.36, -0.28, sw * 0.28)])
        lp.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 10, 0.022, 5, false), antDark))
        legs.push({ g: lp, ph: ((row + (s > 0 ? 1 : 0)) % 2) * Math.PI })
      })
    })
    const carry = new THREE.Group(); carry.position.set(0, 0.74, 0.12); body.add(carry)
    g.userData = { legs, head, body, carry }; g.visible = false; g.scale.setScalar(ANT_S); world.add(g); return g
  }
  function quitarHormiga(m: Hormiga) {
    world.remove(m)
    m.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
    for (let h = antHit.length - 1; h >= 0; h--) if (antHit[h].userData.ant === m) antHit.splice(h, 1)
  }

  function priceTag(txt: string) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 80; const g = c.getContext("2d")!
    g.fillStyle = "rgba(255,255,255,.96)"; g.beginPath(); g.moveTo(40, 8); g.arcTo(248, 8, 248, 72, 32); g.arcTo(248, 72, 8, 72, 32); g.arcTo(8, 72, 8, 8, 32); g.arcTo(8, 8, 248, 8, 32); g.closePath(); g.fill()
    let size = 40; g.font = `800 ${size}px ${op.fuente}`
    while (g.measureText(txt).width > 220 && size > 18) { size -= 2; g.font = `800 ${size}px ${op.fuente}` }
    g.fillStyle = "#d83a3a"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 128, 42)
    const t = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(2.1, 0.66, 1); s.renderOrder = 20; return s
  }

  /* --- ruta: boca del hormiguero → base del tronco → sube → baja → vuelve --- */
  interface Viaje { m: Hormiga; g: GastoHormiga3D; type: string; t: number; s: number; wait: number; item: THREE.Group | null; step: number; a: number; side: THREE.Vector3; wig: number; B: THREE.Vector3; uTop: number; L0: number; L1: number; L2: number }
  const ants: Viaje[] = [], antQueue: GastoHormiga3D[] = []
  let antTotal = 0, antPending = 0, antSpawnT = 0
  const AV = new THREE.Vector3(), AN = new THREE.Vector3(), AF = new THREE.Vector3(), AX = new THREE.Vector3(), AP = new THREE.Vector3(), AM = new THREE.Matrix4()
  const T1 = new THREE.Vector3(), T2 = new THREE.Vector3()
  const mouthP = HILL.clone().addScaledVector(HOLE_DIR, 0.8 * HS)
  function groundY(x: number, z: number) {
    const r = Math.hypot(x - mound.position.x, z - mound.position.z), sx = mound.scale.x; let y = Hgt(x, z)
    if (r < sx) y = mound.scale.y * Math.sqrt(1 - (r / sx) * (r / sx)) + mound.position.y
    const rh = Math.hypot(x - HILL.x, z - HILL.z); if (rh < 0.95 * HS) y = Math.max(y, 0.6 * HS * (1 - Math.pow(Math.min(1, rh / (0.92 * HS)), 1.3)))
    return Math.max(0, y)
  }
  function antPath(A: Viaje, s: number, out: THREE.Vector3, nrm: THREE.Vector3) {
    /* tramo 0: salir del hormiguero; 1: suelo hasta el tronco; 2: tronco */
    const { L0, L1, L2 } = A
    if (s < L0) { const k = s / L0; out.copy(HILL).lerp(mouthP, 0.55 + 0.45 * k); out.y = lerp(0.03, 0.02, k); nrm.set(0, 1, 0); return out }
    s -= L0
    if (s < L1 || L2 <= 0.01) {
      const k = clamp(s / L1)
      out.copy(mouthP).lerp(A.B, k); out.x += A.side.x * Math.sin(Math.PI * k) * A.wig; out.z += A.side.z * Math.sin(Math.PI * k) * A.wig
      out.y = groundY(out.x, out.z); nrm.set(0, 1, 0)
      if (L2 > 0.01 && s > L1 - 0.18) { const e = smooth((s - (L1 - 0.18)) / 0.18); arbol.trunkPoint(A.a, 0.01, T1, T2); nrm.lerp(T2, e * 0.6).normalize() }
      return out
    }
    s -= L1; const u = 0.01 + (A.uTop - 0.01) * clamp(s / L2); arbol.trunkPoint(A.a, u, out, T2)
    nrm.set(0, 1, 0).lerp(T2, smooth(s / 0.25)).normalize(); return out
  }
  function layoutAnt(A: Viaje) {
    /* recalcula la ruta según el tamaño actual del árbol */
    arbol.root.updateMatrixWorld(true)
    const vis = arbol.root.visible && arbol.root.scale.x > 0.12 && arbol.branches[0].pivot.visible
    if (vis) { arbol.trunkPoint(A.a, 0.01, AV, AN); A.B = AV.clone().addScaledVector(AN, 0.04); A.B.y = 0; A.uTop = 0.62; arbol.trunkPoint(A.a, A.uTop, AP); A.L2 = AP.distanceTo(AV) }
    else { A.B = new THREE.Vector3(Math.cos(A.a) * 0.42, 0, Math.sin(A.a) * 0.42); A.L2 = 0; A.uTop = 0 }
    A.L0 = 0.5; A.L1 = mouthP.distanceTo(A.B)
  }
  function orientAnt(A: Viaje, s: number, dirSign: number) {
    antPath(A, s, AV, AN); antPath(A, clamp(s + 0.08 * dirSign, 0, A.L0 + A.L1 + A.L2), AP, AX)
    AF.copy(AP).sub(AV); if (AF.lengthSq() < 1e-6) AF.set(0, 0, dirSign); AF.normalize()
    AN.addScaledVector(AF, -AN.dot(AF)).normalize(); AX.crossVectors(AN, AF).normalize()
    AM.makeBasis(AX, AN, AF); A.m.quaternion.setFromRotationMatrix(AM); A.m.position.copy(AV)
  }
  function spawnAnt(g: GastoHormiga3D) {
    const m = makeAnt(); m.userData.info = g
    /* sube por la cara del tronco que da al hormiguero y a la cámara (el ángulo va en
       coordenadas del tronco, que está girado con el árbol) para que se vea trepar */
    const haciaHormiguero = Math.atan2(mouthP.z, mouthP.x), haciaCamara = Math.atan2(Math.cos(0.28), Math.sin(0.28))
    const a = haciaHormiguero * 0.55 + haciaCamara * 0.45 + arbol.root.rotation.y + (Math.random() - .5) * 0.5
    const A: Viaje = { m, g, type: objetoParaGasto(g.nombre), t: 0, s: 0, wait: 0, item: null, step: 0, a, side: new THREE.Vector3(-mouthP.z, 0, mouthP.x).normalize(), wig: (Math.random() - .5) * 0.6, B: new THREE.Vector3(), uTop: 0, L0: 0.5, L1: 1, L2: 0 }
    ants.push(A); return A
  }
  function gastoHormiga(lista: GastoHormiga3D[]) {
    if (antPending <= 0 && !antQueue.length) antTotal = 0
    lista.forEach(g => antQueue.push({ nombre: g.nombre || "Gasto", monto: +g.monto || 0 }))
  }

  /* el valor del gasto aparece sobre el hormiguero cuando la hormiga entra */
  const pops: { s: THREE.Sprite; t: number; y0: number }[] = []
  function popTag(txt: string) {
    const sp = priceTag(txt); sp.scale.set(1.15, 0.36, 1); const y0 = Hgt(HILL.x, HILL.z) + 0.63 * HS + 0.35
    sp.position.set(HILL.x + (Math.random() - .5) * 0.25, y0, HILL.z); sp.material.opacity = 0; world.add(sp); pops.push({ s: sp, t: 0, y0 })
  }
  function animarPatas(u: DatosHormiga, ph: number, t: number) {
    for (const L of u.legs) { L.g.rotation.y = Math.sin(ph + L.ph) * 0.42; L.g.rotation.z = Math.max(0, Math.cos(ph + L.ph)) * 0.25 * (L.g.position.x > 0 ? 1 : -1) }
    u.body.position.y = Math.abs(Math.sin(ph)) * 0.03; u.head.rotation.z = Math.sin(t * 3) * 0.08
  }
  function tickAnts(dt: number) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.t += dt; const k = p.t / 2.2
      p.s.position.y = p.y0 + 0.9 * smooth(k); p.s.material.opacity = Math.min(1, p.t / 0.25) * (1 - smooth((k - 0.65) / 0.35))
      const sc = 1 + 0.25 * Math.max(0, 1 - p.t / 0.3); p.s.scale.set(1.15 * sc, 0.36 * sc, 1)
      if (k >= 1) { world.remove(p.s); p.s.material.map?.dispose(); p.s.material.dispose(); pops.splice(i, 1) }
    }
    antSpawnT -= dt
    if (antQueue.length && antSpawnT <= 0) { const A = spawnAnt(antQueue.shift()!); layoutAnt(A); antPending++; antSpawnT = 0.85 }
    for (let i = ants.length - 1; i >= 0; i--) {
      const A = ants[i], m = A.m, u = m.userData, Ltot = A.L0 + A.L1 + A.L2; A.t += dt
      const spd = 0.95; let moving = true
      if (A.step === 0) { /* sale y sube al tronco */ m.visible = true; A.s = Math.min(Ltot, A.s + spd * dt); m.scale.setScalar(ANT_S * Math.max(0.0001, smooth(A.t / 0.5))); if (A.s >= Ltot) { A.step = 1; A.wait = 0 } }
      else if (A.step === 1) {
        /* arriba: toma el gasto */ moving = false; A.wait += dt
        if (!A.item) { A.item = ITEMS[A.type](); A.item.scale.setScalar(0.0001); u.carry.add(A.item); op.pop() }
        A.item.scale.setScalar(Math.max(0.0001, backOut(A.wait / 0.45) * 1.05))
        if (A.wait > 0.75) A.step = 2
      }
      else if (A.step === 2) { /* baja y vuelve cargando */ A.s = Math.max(0, A.s - spd * 0.85 * dt); if (A.s <= 0) { A.step = 3; A.wait = 0 } }
      else {
        /* entra al hormiguero */ moving = false; A.wait += dt; const k = 1 - smooth(A.wait / 0.5); m.scale.setScalar(Math.max(0.0001, ANT_S * k))
        if (A.wait > 0.5) {
          quitarHormiga(m); ants.splice(i, 1); antPending--; antTotal += A.g.monto; popTag("-" + op.formatear(A.g.monto))
          if (antPending <= 0 && !antQueue.length) op.alTerminar(antTotal)
          continue
        }
      }
      layoutAnt(A); A.s = Math.min(A.s, A.L0 + A.L1 + A.L2)
      orientAnt(A, A.s, A.step >= 2 ? -1 : 1)
      const ph = A.t * 13 * (moving ? 1 : 0.15)
      animarPatas(u, ph, A.t)
      if (A.item) A.item.rotation.z = Math.sin(ph) * 0.06
    }
  }

  /* hormigas que pasean al tocar el hormiguero */
  const strolls: { m: Hormiga; curve: THREE.CatmullRomCurve3; len: number; s: number; t: number }[] = []
  function strollAnt() {
    if (strolls.length >= 6) return
    const m = makeAnt(); m.visible = true; m.scale.setScalar(0.0001)
    const out = HOLE_DIR.clone(), side = new THREE.Vector3(-out.z, 0, out.x), R0 = 0.42 + Math.random() * 0.18, c = mouthP.clone().addScaledVector(out, R0 + 0.12), sg = Math.random() < .5 ? 1 : -1, pts = [mouthP.clone()]
    for (let k = 0; k < 7; k++) { const a = Math.PI + sg * (k + 1) / 8 * Math.PI * 2, rr = R0 * (0.85 + Math.random() * 0.3); pts.push(c.clone().addScaledVector(out, Math.cos(a) * rr).addScaledVector(side, Math.sin(a) * rr * 1.15)) }
    pts.push(mouthP.clone())
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal")
    strolls.push({ m, curve, len: curve.getLength(), s: 0, t: 0 }); m.userData.info = { nombre: "", monto: 0 }
  }
  function tickStrolls(dt: number) {
    for (let i = strolls.length - 1; i >= 0; i--) {
      const S = strolls[i], m = S.m, u = m.userData; S.t += dt
      S.s = Math.min(1, S.s + 0.45 * dt / S.len)
      const k = S.s, fade = Math.min(smooth(S.t / 0.4), smooth((1 - k) * S.len / 0.15)); m.scale.setScalar(Math.max(0.0001, ANT_S * fade))
      S.curve.getPointAt(k, AV); S.curve.getPointAt(Math.min(1, k + 0.01), AP)
      AV.y = groundY(AV.x, AV.z); AP.y = groundY(AP.x, AP.z)
      AF.copy(AP).sub(AV); if (AF.lengthSq() < 1e-8) AF.copy(HOLE_DIR).negate(); AF.normalize(); AN.set(0, 1, 0); AX.crossVectors(AN, AF).normalize(); AN.crossVectors(AF, AX)
      AM.makeBasis(AX, AN, AF); m.quaternion.setFromRotationMatrix(AM); m.position.copy(AV)
      animarPatas(u, S.t * 13, S.t)
      if (k >= 1) { quitarHormiga(m); strolls.splice(i, 1) }
    }
  }
  const hillHit: THREE.Mesh[] = []; hillG.traverse(o => { if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh)) hillHit.push(o) })

  /** Devuelve el gasto de la hormiga tocada (las que pasean no tienen gasto). */
  function tocarHormiga(ray: THREE.Raycaster): GastoHormiga3D | null | undefined {
    const h = ray.intersectObjects(antHit, false); if (!h.length) return undefined
    const info = (h[0].object.userData.ant as Hormiga).userData.info
    return info && info.nombre ? info : null
  }
  function tocarHormiguero(ray: THREE.Raycaster) { if (!ray.intersectObjects(hillHit, false).length) return false; strollAnt(); return true }

  return { gastoHormiga, tick(dt: number) { tickAnts(dt); tickStrolls(dt) }, tocarHormiga, tocarHormiguero, groundY, hayHormigas: () => ants.length > 0 || antQueue.length > 0 }
}

