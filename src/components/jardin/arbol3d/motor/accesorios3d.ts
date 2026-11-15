import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { lienzo, rng, vnoise } from "./utilidades"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Modelos 3D de los accesorios de la tienda (formas, no solo colores)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Los usa la isla (cerca, frutos y regadera) y también la vista previa de la
 * tienda (vistaPrevia.ts), así lo que se ve al comprar es exactamente lo que
 * sale en el árbol. Todo se arma con geometrías simples y texturas dibujadas en
 * un lienzo: nada se descarga.
 */

/* ---------- utilidades ---------- */
const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra })
/** Une geometrías; cada una usa el material `indices[i]` (por defecto, su posición). */
function unir(geos: THREE.BufferGeometry[], indices?: number[]): THREE.BufferGeometry {
  const limpias = geos.map(g => {
    const n = g.index ? g.toNonIndexed() : g
    for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") n.deleteAttribute(k)
    if (!n.attributes.uv) n.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2))
    return n
  })
  const g = mergeGeometries(limpias, true)!
  if (indices) g.groups.forEach((gr, i) => { gr.materialIndex = indices[i] ?? 0 })
  return g
}
function textura(w: number, h: number, dibujar: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const { c, g } = lienzo(w, h); dibujar(g, w, h)
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t
}
/** Hilito del que cuelga el fruto (de la rama al fruto). */
const hilo = (alto = 0.12, desde = 0.13) => { const g = new THREE.CylinderGeometry(0.004, 0.004, alto, 4); g.translate(0, desde + alto / 2, 0); return g }

/* =================================================================== */
/* Frutos                                                               */
/* =================================================================== */

export interface ModeloFruto {
  geo: THREE.BufferGeometry
  /** Materiales del fruto número i (algunos varían el color de uno a otro) */
  mats: (i: number) => THREE.Material[]
  /** Lleva el palito y la hojita de la manzana */
  tallo: boolean
}

const cacheFrutos = new Map<string, ModeloFruto>()

/** Modelo del fruto según la clave de la tienda ("auto" lo resuelve quien llama con la manzana). */
export function modeloFruto(clave: string): ModeloFruto | null {
  const hecho = cacheFrutos.get(clave); if (hecho) return hecho
  const m = crearModeloFruto(clave); if (m) cacheFrutos.set(clave, m)
  return m
}

function crearModeloFruto(clave: string): ModeloFruto | null {
  const hiloMat = std(0xf3efe2, { roughness: 0.9 })
  switch (clave) {
    case "navidad": {
      /* bola de Navidad brillante con tapita dorada y argolla */
      const bola = new THREE.SphereGeometry(0.145, 22, 16)
      const tapa = new THREE.CylinderGeometry(0.042, 0.046, 0.05, 14); tapa.translate(0, 0.15, 0)
      const argolla = new THREE.TorusGeometry(0.024, 0.0065, 6, 14); argolla.translate(0, 0.192, 0)
      const geo = unir([bola, tapa, argolla, hilo(0.1, 0.21)])
      const brillo = (c: number) => std(c, { metalness: 0.55, roughness: 0.18, emissive: new THREE.Color(c).multiplyScalar(0.12) })
      const bolas = [0xd8263a, 0x1f9a54, 0x2a64d8, 0xc9ccd6, 0xe9b52c, 0xb438c8].map(brillo)
      const oro = std(0xe8c050, { metalness: 0.85, roughness: 0.25 })
      return { geo, mats: i => [bolas[i % bolas.length], oro, oro, hiloMat], tallo: false }
    }
    case "dulces": {
      /* caramelo envuelto: cuerpo con rayas y dos envolturas a los lados */
      const cuerpo = new THREE.SphereGeometry(0.1, 18, 12); cuerpo.scale(1.35, 0.85, 0.85)
      const izq = new THREE.ConeGeometry(0.075, 0.09, 12); izq.rotateZ(-Math.PI / 2); izq.translate(-0.17, 0, 0)
      const der = new THREE.ConeGeometry(0.075, 0.09, 12); der.rotateZ(Math.PI / 2); der.translate(0.17, 0, 0)
      const geo = unir([cuerpo, izq, der, hilo(0.13, 0.08)])
      const rayas = (a: string, b: string) => textura(128, 64, (g, w, h) => {
        g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b
        for (let x = -h; x < w + h; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 11, 0); g.lineTo(x + 11 + h, h); g.lineTo(x + h, h); g.fill() }
      })
      const sabores = [["#ff5a8a", "#ffffff", 0xff8ab0], ["#3ec46a", "#ffffff", 0x9be8b0], ["#3a8cff", "#ffe14a", 0x8fc0ff], ["#ffb02e", "#ffffff", 0xffd08a]]
        .map(([a, b, env]) => [std(0xffffff, { map: rayas(a as string, b as string), roughness: 0.25 }), std(env as number, { roughness: 0.35, transparent: true, opacity: 0.92 })])
      return { geo, mats: i => { const [c, e] = sabores[i % sabores.length]; return [c, e, e, hiloMat] }, tallo: false }
    }
    case "estrella": {
      /* estrella de cinco puntas con relieve */
      const s = new THREE.Shape()
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.072 : 0.17, a = Math.PI / 2 + k * Math.PI / 5; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (k) s.lineTo(x, y); else s.moveTo(x, y) }
      s.closePath()
      const est = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.014, bevelSegments: 2 }); est.translate(0, 0, -0.02)
      const geo = unir([est, hilo(0.1, 0.18)])
      const oro = std(0xffd23a, { metalness: 0.5, roughness: 0.25, emissive: 0x6a4a00 })
      return { geo, mats: () => [oro, hiloMat], tallo: false }
    }
    case "balon": {
      /* balón de fútbol: pentágonos negros sobre blanco */
      const tex = textura(256, 128, (g, w, h) => {
        g.fillStyle = "#fbfbf6"; g.fillRect(0, 0, w, h); g.fillStyle = "#1d1d22"
        const pts: [number, number][] = [[0.5, 0.5], [0.1, 0.5], [0.3, 0.2], [0.7, 0.2], [0.9, 0.5], [0.3, 0.8], [0.7, 0.8], [0.5, 0.04], [0.5, 0.96]]
        for (const [px, py] of pts) {
          g.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5, x = px * w + Math.cos(a) * 17, y = py * h + Math.sin(a) * 15; if (k) g.lineTo(x, y); else g.moveTo(x, y) }
          g.closePath(); g.fill()
        }
        g.strokeStyle = "rgba(40,40,46,.35)"; g.lineWidth = 2
        for (const [px, py] of pts) for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; g.beginPath(); g.moveTo(px * w + Math.cos(a) * 17, py * h + Math.sin(a) * 15); g.lineTo(px * w + Math.cos(a) * 34, py * h + Math.sin(a) * 30); g.stroke() }
      })
      const geo = unir([new THREE.SphereGeometry(0.15, 22, 16), hilo(0.1, 0.14)])
      const piel = std(0xffffff, { map: tex, roughness: 0.45 })
      return { geo, mats: () => [piel, hiloMat], tallo: false }
    }
    case "llanta": {
      /* llanta colgada como columpio: caucho con labrado y rin plateado */
      const tex = textura(256, 32, (g, w, h) => {
        g.fillStyle = "#26262a"; g.fillRect(0, 0, w, h); g.fillStyle = "#3a3a40"
        for (let x = 0; x < w; x += 10) { g.fillRect(x, 4, 5, h - 8) }
      }); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1)
      const caucho = new THREE.TorusGeometry(0.11, 0.055, 12, 28)
      const rin = new THREE.CylinderGeometry(0.065, 0.065, 0.05, 18); rin.rotateX(Math.PI / 2)
      const cuerda = new THREE.CylinderGeometry(0.008, 0.008, 0.14, 5); cuerda.translate(0, 0.22, 0)
      const geo = unir([caucho, rin, cuerda])
      return { geo, mats: () => [std(0xffffff, { map: tex, roughness: 0.92 }), std(0xc8ccd4, { metalness: 0.8, roughness: 0.3 }), std(0xc9a46a, { roughness: 0.95 })], tallo: false }
    }
    case "patilla": {
      /* patilla (sandía) con rayas en zigzag */
      const tex = textura(256, 128, (g, w, h) => {
        g.fillStyle = "#79b84a"; g.fillRect(0, 0, w, h); g.fillStyle = "#2f6a24"
        for (let k = 0; k < 9; k++) {
          const x0 = (k / 9) * w; g.beginPath(); g.moveTo(x0, 0)
          for (let y = 0; y <= h; y += 8) g.lineTo(x0 + Math.sin(y * 0.4 + k) * 4, y)
          for (let y = h; y >= 0; y -= 8) g.lineTo(x0 + 11 + Math.sin(y * 0.4 + k + 1) * 4, y)
          g.closePath(); g.fill()
        }
      })
      const fruta = new THREE.SphereGeometry(0.15, 22, 16); fruta.scale(1.18, 0.92, 0.92)
      const palito = new THREE.CylinderGeometry(0.009, 0.014, 0.06, 6); palito.translate(0, 0.16, 0)
      return { geo: unir([fruta, palito]), mats: () => [std(0xffffff, { map: tex, roughness: 0.4 }), std(0x5a3a1e, { roughness: 0.9 })], tallo: false }
    }
    case "calabaza": {
      /* calabaza con gajos y tallito verde */
      const c = new THREE.SphereGeometry(0.15, 28, 16), p = c.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.09 * Math.cos(a * 8)
        p.setXYZ(i, x * k, y * 0.78 * (1 - 0.18 * Math.pow(Math.abs(y) / 0.15, 6)), z * k)
      }
      c.computeVertexNormals()
      const tallo = new THREE.CylinderGeometry(0.014, 0.024, 0.08, 6); tallo.rotateZ(0.35); tallo.translate(0.012, 0.135, 0)
      return { geo: unir([c, tallo]), mats: () => [std(0xf08a24, { roughness: 0.55, emissive: 0x2a1000 }), std(0x4f7a2a, { roughness: 0.8 })], tallo: false }
    }
    case "billete": {
      /* billete de Kiri con su "$", curvado como si colgara */
      const tex = textura(256, 120, (g, w, h) => {
        g.fillStyle = "#c8f5b4"; g.fillRect(0, 0, w, h)
        g.strokeStyle = "#1f6a2e"; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10)
        g.lineWidth = 2; g.strokeRect(16, 16, w - 32, h - 32)
        g.fillStyle = "#dff3d8"; g.beginPath(); g.ellipse(w / 2, h / 2, 34, 34, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = "#2f7a3e"; g.font = "900 54px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", w / 2, h / 2 + 3)
        g.font = "800 22px sans-serif"; g.fillText("100", 42, 32); g.fillText("100", w - 42, h - 30)
      })
      const b = new THREE.BoxGeometry(0.4, 0.19, 0.006, 16, 1, 1), p = b.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) + 0.035 * Math.cos((x / 0.2) * Math.PI / 2)) }
      b.computeVertexNormals()
      const geo = unir([b, hilo(0.1, 0.095)])
      /* claro y con algo de brillo propio: si no, el verde se pierde entre las hojas */
      const papel = std(0xffffff, { map: tex, roughness: 0.6, emissive: 0x2a4a22, side: THREE.DoubleSide })
      return { geo, mats: () => [papel, hiloMat], tallo: false }
    }
    case "moneda": {
      /* moneda de oro con "$" en relieve (las tapas del cilindro llevan el dibujo) */
      const tex = textura(128, 128, (g, w) => {
        const gr = g.createRadialGradient(w / 2, w / 2, 8, w / 2, w / 2, w / 2); gr.addColorStop(0, "#ffe27a"); gr.addColorStop(1, "#d9a21e")
        g.fillStyle = gr; g.fillRect(0, 0, w, w)
        g.strokeStyle = "#b07a10"; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 12, 0, Math.PI * 2); g.stroke()
        g.fillStyle = "#a8700c"; g.font = "900 70px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", w / 2, w / 2 + 4)
      })
      const geo = new THREE.CylinderGeometry(0.13, 0.13, 0.032, 30); geo.rotateX(Math.PI / 2)
      const canto = std(0xd9a21e, { metalness: 0.85, roughness: 0.28, emissive: 0x3a2400 }), cara = std(0xffffff, { map: tex, metalness: 0.7, roughness: 0.3, emissive: 0x2a1a00 })
      return { geo, mats: () => [canto, cara, cara], tallo: false }
    }
  }
  return null
}

/* =================================================================== */
/* Cerca del fondo de emergencia                                        */
/* =================================================================== */

export interface EstiloCerca {
  /** Pieza que se repite en cada puesto (tabla, poste, bloque, arbusto…) */
  poste: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] }
  /** Travesaño entre puestos (largo 1 en x; se estira) o null si es un muro continuo */
  riel: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] } | null
  alturasRiel: number[]
  /** Poste solo cada n puestos (cercas de alambre o de troncos) */
  cadaN: number
}

const cacheCercas = new Map<string, EstiloCerca>()
export function estiloCerca(clave: string): EstiloCerca {
  const hecho = cacheCercas.get(clave); if (hecho) return hecho
  const e = crearEstiloCerca(clave); cacheCercas.set(clave, e); return e
}

function tabla(color: number) {
  const s = new THREE.Shape(), w = 0.045, h = 0.44
  s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(w, h - 0.05); s.lineTo(0, h); s.lineTo(-w, h - 0.05); s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.028, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 }); g.translate(0, 0, -0.014)
  return { geo: g, mat: std(color, { roughness: 0.8 }) }
}
/** Travesaño de largo 1 en x. */
const rielCaja = (alto: number, fondo: number) => new THREE.BoxGeometry(1, alto, fondo)
const rielTubo = (r: number) => { const g = new THREE.CylinderGeometry(r, r, 1, 8); g.rotateZ(Math.PI / 2); return g }

function crearEstiloCerca(clave: string): EstiloCerca {
  switch (clave) {
    case "madera": {
      /* rústica: postes de tronco cada dos puestos y dos travesaños de rama */
      const tronco = new THREE.CylinderGeometry(0.042, 0.05, 0.48, 9); tronco.translate(0, 0.24, 0)
      const tapa = new THREE.CylinderGeometry(0.042, 0.042, 0.012, 9); tapa.translate(0, 0.485, 0)
      const madera = std(0x8a5a34, { roughness: 0.95 }), corte = std(0xd9b27a, { roughness: 0.9 })
      return { poste: { geo: unir([tronco, tapa]), mat: [madera, corte] }, riel: { geo: rielTubo(0.024), mat: std(0x9a6a3e, { roughness: 0.95 }) }, alturasRiel: [0.16, 0.36], cadaN: 2 }
    }
    case "bambu": {
      /* tres cañas de bambú con nudos, amarradas con dos cañas acostadas */
      const partes: THREE.BufferGeometry[] = []
      ;([[-0.035, 0.52], [0, 0.46], [0.035, 0.4]] as const).forEach(([x, h]) => {
        const c = new THREE.CylinderGeometry(0.019, 0.021, h, 8); c.translate(x, h / 2, 0); partes.push(c)
        for (let y = 0.13; y < h - 0.02; y += 0.13) { const n = new THREE.TorusGeometry(0.02, 0.005, 5, 10); n.rotateX(Math.PI / 2); n.translate(x, y, 0); partes.push(n) }
      })
      return { poste: { geo: unir(partes), mat: std(0xc2c45a, { roughness: 0.5 }) }, riel: { geo: rielTubo(0.016), mat: std(0xa8ac44, { roughness: 0.5 }) }, alturasRiel: [0.14, 0.32], cadaN: 1 }
    }
    case "puas": {
      /* alambre de púas: postes delgados y tres hilos con púas */
      const poste = new THREE.BoxGeometry(0.036, 0.46, 0.036); poste.translate(0, 0.23, 0)
      const alambre: THREE.BufferGeometry[] = [rielTubo(0.0045)]
      for (const x of [-0.3, 0, 0.3]) for (const r of [0.6, -0.6]) { const p = new THREE.CylinderGeometry(0.0035, 0.0035, 0.05, 4); p.rotateZ(r); p.rotateY(0.9); p.translate(x, 0, 0); alambre.push(p) }
      return { poste: { geo: poste, mat: std(0x7a6a58, { roughness: 0.95 }) }, riel: { geo: unir(alambre), mat: std(0x8a8f96, { metalness: 0.7, roughness: 0.35 }) }, alturasRiel: [0.12, 0.25, 0.38], cadaN: 2 }
    }
    case "piedra": {
      /* muro bajo de piedras: bloques irregulares unos sobre otros */
      const r = rng(77), partes: THREE.BufferGeometry[] = []
      ;([[0, 0.07, 0.3, 0.14], [-0.06, 0.2, 0.17, 0.12], [0.09, 0.2, 0.15, 0.12], [0.01, 0.31, 0.22, 0.1]] as const).forEach(([x, y, w, h]) => {
        const b = new THREE.BoxGeometry(w, h, 0.17, 2, 2, 2), p = b.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.9 + r() * 0.16), p.getY(i) * (0.85 + r() * 0.2), p.getZ(i) * (0.88 + r() * 0.18))
        b.translate(x, y, 0); partes.push(b)
      })
      return { poste: { geo: unir(partes), mat: std(0x9c978d, { roughness: 0.95, flatShading: true }) }, riel: null, alturasRiel: [], cadaN: 1 }
    }
    case "seto": {
      /* seto de arbustos redondos con florecitas */
      const b = new THREE.IcosahedronGeometry(0.2, 2), p = b.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.85 + vnoise(x * 9 + 2, y * 9 + z * 7) * 0.3; p.setXYZ(i, x * k * 0.95, y * k * 1.1, z * k * 0.8) }
      b.computeVertexNormals(); b.translate(0, 0.2, 0)
      const flores: THREE.BufferGeometry[] = []
      const rf = rng(31)
      for (let k = 0; k < 5; k++) { const a = rf() * 6.28, y = 0.12 + rf() * 0.24, f = new THREE.SphereGeometry(0.018, 6, 4); f.translate(Math.cos(a) * 0.17, y, Math.sin(a) * 0.14); flores.push(f) }
      return { poste: { geo: unir([b, ...flores], [0, ...flores.map(() => 1)]), mat: [std(0x4f8f3a, { roughness: 0.85, flatShading: true }), std(0xffc1d8, { roughness: 0.6, emissive: 0x3a1020 })] }, riel: null, alturasRiel: [], cadaN: 1 }
    }
    case "reja":
    case "dorada": {
      /* reja de barrotes con punta de lanza (la dorada, con esferas y brillo) */
      const dorada = clave === "dorada", partes: THREE.BufferGeometry[] = []
      for (const x of [-0.068, 0.068]) {
        const barra = new THREE.CylinderGeometry(0.011, 0.011, 0.46, 6); barra.translate(x, 0.23, 0); partes.push(barra)
        const punta = new THREE.ConeGeometry(0.024, 0.07, 6); punta.translate(x, 0.495, 0); partes.push(punta)
        if (dorada) { const bola = new THREE.SphereGeometry(0.02, 8, 6); bola.translate(x, 0.535, 0); partes.push(bola) }
      }
      const metal = dorada ? std(0xe8c050, { metalness: 0.85, roughness: 0.22, emissive: 0x3a2a00 }) : std(0x2c2d33, { metalness: 0.7, roughness: 0.4 })
      return { poste: { geo: unir(partes), mat: metal }, riel: { geo: rielCaja(0.022, 0.016), mat: metal }, alturasRiel: [0.08, 0.4], cadaN: 1 }
    }
  }
  /* blanca: la de tablitas de siempre */
  return { poste: tabla(0xf1e4c8), riel: { geo: rielCaja(0.035, 0.022), mat: std(0xf1e4c8, { roughness: 0.8 }) }, alturasRiel: [0.13, 0.3], cadaN: 1 }
}

/* =================================================================== */
/* Regadera (lo que aparece al regar el árbol)                          */
/* =================================================================== */

export interface ModeloRegadera {
  g: THREE.Group
  /** Por dónde sale el agua (o las monedas), en coordenadas del grupo */
  punta: THREE.Vector3
  /** Cuánto se inclina al verter (rad) */
  inclinar: number
  particula: "agua" | "monedas"
  /** Velocidad inicial del chorro (x hacia el árbol, y) */
  chorro: [number, number]
}

export function crearModeloRegadera(clave: string): ModeloRegadera {
  const g = new THREE.Group(), add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m }
  switch (clave) {
    case "vaso": {
      /* vaso de vidrio con agua */
      const vidrio = new THREE.MeshStandardMaterial({ color: 0xdff4ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
      add(new THREE.CylinderGeometry(0.22, 0.17, 0.5, 20, 1, true), vidrio)
      add(new THREE.CircleGeometry(0.17, 20).rotateX(Math.PI / 2), vidrio, 0, -0.25, 0)
      add(new THREE.CylinderGeometry(0.2, 0.165, 0.34, 20), std(0x5ab8f0, { roughness: 0.1, transparent: true, opacity: 0.75 }), 0, -0.07, 0)
      add(new THREE.TorusGeometry(0.22, 0.008, 6, 24).rotateX(Math.PI / 2), vidrio, 0, 0.25, 0)
      return { g, punta: new THREE.Vector3(-0.22, 0.25, 0), inclinar: 1.25, particula: "agua", chorro: [-0.8, -0.2] }
    }
    case "balde": {
      /* balde galvanizado con asa y agua adentro */
      const lata = std(0xa8b2bc, { metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide })
      add(new THREE.CylinderGeometry(0.32, 0.25, 0.44, 22, 1, true), lata)
      add(new THREE.CircleGeometry(0.25, 22).rotateX(-Math.PI / 2), lata, 0, -0.22, 0)
      for (const y of [0.22, -0.02, -0.2]) add(new THREE.TorusGeometry(y > 0 ? 0.32 : y > -0.1 ? 0.29 : 0.255, 0.012, 6, 28).rotateX(Math.PI / 2), lata, 0, y, 0)
      add(new THREE.CircleGeometry(0.3, 22).rotateX(-Math.PI / 2), std(0x4aa8e0, { roughness: 0.1, transparent: true, opacity: 0.85 }), 0, 0.15, 0)
      const asa = add(new THREE.TorusGeometry(0.33, 0.012, 6, 24, Math.PI), std(0x5a5f66, { metalness: 0.7, roughness: 0.4 }), 0, 0.2, 0); asa.rotation.y = Math.PI / 2
      return { g, punta: new THREE.Vector3(-0.32, 0.22, 0), inclinar: 1.0, particula: "agua", chorro: [-1.0, -0.1] }
    }
    case "pistola": {
      /* pistola de agua de juguete: cuerpo naranja, tanque transparente y chorro largo */
      const naranja = std(0xff8a2a, { roughness: 0.35 }), azul = std(0x2f7fe0, { roughness: 0.35 })
      add(new THREE.BoxGeometry(0.52, 0.17, 0.13), naranja, 0, 0, 0)
      add(new THREE.CylinderGeometry(0.035, 0.04, 0.34, 12).rotateZ(Math.PI / 2), azul, -0.42, 0.02, 0)
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12).rotateZ(Math.PI / 2), naranja, -0.6, 0.02, 0)
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 16).rotateZ(Math.PI / 2), std(0x7fd0ff, { roughness: 0.05, transparent: true, opacity: 0.6 }), 0.02, 0.15, 0)
      const mango = add(new THREE.BoxGeometry(0.12, 0.26, 0.11), azul, 0.17, -0.17, 0); mango.rotation.z = -0.35
      const gatillo = add(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI), azul, 0.04, -0.1, 0); gatillo.rotation.z = Math.PI
      return { g, punta: new THREE.Vector3(-0.63, 0.02, 0), inclinar: 0.28, particula: "agua", chorro: [-3.0, 0.5] }
    }
    case "cartera": {
      /* cartera de cuero abierta, con billetes asomados; al "regar" caen monedas */
      const cuero = std(0x7a4a26, { roughness: 0.7 }), borde = std(0x5a3418, { roughness: 0.75 })
      add(new THREE.BoxGeometry(0.52, 0.34, 0.07), cuero, 0, 0, -0.04)
      const tapa = add(new THREE.BoxGeometry(0.52, 0.34, 0.05), cuero, 0, 0.12, 0.12); tapa.rotation.x = -1.05
      add(new THREE.BoxGeometry(0.54, 0.02, 0.09), borde, 0, -0.17, -0.04)
      const billete = std(0x86c98a, { roughness: 0.8, side: THREE.DoubleSide })
      for (const [x, r] of [[-0.12, 0.08], [0.02, -0.05], [0.14, 0.12]] as const) { const b = add(new THREE.PlaneGeometry(0.17, 0.24), billete, x, 0.16, 0.01); b.rotation.z = r }
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16).rotateX(Math.PI / 2), std(0xe8c050, { metalness: 0.85, roughness: 0.25 }), 0, -0.05, 0.005)
      return { g, punta: new THREE.Vector3(-0.27, 0.12, 0.05), inclinar: 0.95, particula: "monedas", chorro: [-0.7, 0.1] }
    }
  }
  /* azul o dorada: la regadera clásica */
  const dorada = clave === "dorada"
  const bm = dorada ? std(0xe8b82e, { metalness: 0.75, roughness: 0.25, emissive: 0x3a2800 }) : std(0x3aa0c0, { roughness: 0.45, metalness: 0.2 })
  const dm = dorada ? std(0xb8901a, { metalness: 0.75, roughness: 0.3 }) : std(0x2a7a96, { roughness: 0.45, metalness: 0.2 })
  add(new THREE.CylinderGeometry(0.34, 0.3, 0.52, 16), bm)
  add(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 16), dm, 0, 0.285, 0)
  const sp = add(new THREE.CylinderGeometry(0.05, 0.085, 0.72, 10), dm, -0.5, 0.1, 0); sp.rotation.z = 0.9
  const rose = add(new THREE.CylinderGeometry(0.14, 0.06, 0.12, 12), bm, -0.79, 0.37, 0); rose.rotation.z = 0.9
  const h = add(new THREE.TorusGeometry(0.21, 0.04, 8, 16, Math.PI), dm, 0.36, 0.04, 0); h.rotation.z = -Math.PI / 2
  return { g, punta: new THREE.Vector3(-0.86, 0.4, 0), inclinar: 0.74, particula: "agua", chorro: [-1.4, -0.3] }
}
