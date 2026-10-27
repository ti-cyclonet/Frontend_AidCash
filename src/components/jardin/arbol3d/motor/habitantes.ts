import * as THREE from "three"
import { Hgt } from "./terreno"
import { clamp, lerp, lienzo, smooth } from "./utilidades"

/**
 * Habitantes de la isla: personajes y objetos con vida que se compran en la
 * tienda y reaccionan a las finanzas REALES del usuario. La isla funciona como
 * un tablero que se entiende sin leer números:
 *  - Chanchito (alcancía): engorda con el ahorro del mes; cada ahorro le cae una moneda.
 *  - Don Gnomo: carga la racha en un cartel; si la racha está en cero, se duerme.
 *  - Casita de pájaros: al registrar un ingreso los pájaros vuelan cantando alrededor del árbol.
 * Solo anima: nada de esto da XP ni monedas.
 */
export type ClaveHabitante = "chanchito" | "gnomo" | "pajaros"

export interface FinanzasIsla {
  /** Ahorro del mes contra su meta (0–1; más de 1 = meta cumplida) */
  ahorroPct: number
  /** Días de racha */
  racha: number
}

interface EstadoVivo { fin: FinanzasIsla; ingreso: boolean; regando: boolean }

interface Contexto {
  world: THREE.Group
  chispas: (x: number, y: number, z: number, n: number) => void
  /** Altura de la copa (los pájaros vuelan a su alrededor) */
  alturaArbol: () => number
  fuente: string
}

interface Habitante {
  g: THREE.Group
  hit: THREE.Object3D[]
  tick: (dt: number, t: number, s: EstadoVivo) => void
  tocar: () => void
  extra?: THREE.Object3D[]
}

/* ---------- piezas comunes ---------- */
const M = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra })
function malla(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, padre?: THREE.Object3D) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true
  padre?.add(m); return m
}
const esfera = (r: number, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs)
/** Pone el grupo sobre el terreno mirando hacia (mx, mz). */
function ubicar(g: THREE.Group, x: number, z: number, mx: number, mz: number) {
  g.position.set(x, Hgt(x, z), z); g.rotation.y = Math.atan2(mx - x, mz - z)
}
/* hacia dónde mira la cámara de frente (los personajes saludan al usuario) */
const CAM: [number, number] = [0.6, 9]

function spriteTexto(txt: string, color: string, fuente: string, escala = 0.32) {
  const { c, g } = lienzo(128, 128)
  g.font = `900 92px ${fuente}`; g.textAlign = "center"; g.textBaseline = "middle"
  g.lineWidth = 10; g.strokeStyle = "rgba(255,255,255,0.9)"; g.strokeText(txt, 64, 70)
  g.fillStyle = color; g.fillText(txt, 64, 70)
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }))
  s.scale.setScalar(escala); return s
}

/* =================================================================== */
/* Chanchito: alcancía que engorda con el ahorro del mes                */
/* =================================================================== */
function chanchito(cx: Contexto): Habitante {
  const g = new THREE.Group(); ubicar(g, 3.0, 1.95, CAM[0], CAM[1]); g.scale.setScalar(0.8)
  const rosa = M(0xf3a1b4), rosaO = M(0xe07f98), negro = M(0x2a1d22, { roughness: 0.35 })
  const oro = M(0xf2b71f, { metalness: 0.6, roughness: 0.3, emissive: 0x4a3200 })
  const cuerpo = new THREE.Group(); cuerpo.position.y = 0.3; g.add(cuerpo)
  const panza = malla(esfera(0.27, 20, 16), rosa, 0, 0, 0, cuerpo); panza.scale.set(1, 0.92, 1.18)
  const hocico = malla(new THREE.CylinderGeometry(0.1, 0.11, 0.08, 18), rosaO, 0, 0.02, 0.33, cuerpo); hocico.rotation.x = Math.PI / 2
  for (const s of [-1, 1]) malla(esfera(0.018, 8, 6), negro, s * 0.036, 0.03, 0.372, cuerpo)
  for (const s of [-1, 1]) malla(esfera(0.03, 10, 8), negro, s * 0.11, 0.12, 0.25, cuerpo)
  for (const s of [-1, 1]) { const o = malla(new THREE.ConeGeometry(0.07, 0.13, 4), rosaO, s * 0.14, 0.25, 0.08, cuerpo); o.rotation.set(0.35, 0, -s * 0.45) }
  for (const [x, z] of [[-0.14, 0.16], [0.14, 0.16], [-0.14, -0.16], [0.14, -0.16]]) malla(new THREE.CylinderGeometry(0.05, 0.056, 0.15, 10), rosaO, x, -0.22, z, cuerpo)
  const cola = malla(new THREE.TorusGeometry(0.045, 0.013, 6, 14, Math.PI * 1.6), rosaO, 0, 0.06, -0.33, cuerpo)
  malla(new THREE.BoxGeometry(0.13, 0.012, 0.03), negro, 0, 0.248, -0.02, cuerpo)
  /* la pila de monedas de al lado crece con el ahorro del mes */
  const pila = new THREE.Group(); pila.position.set(0.42, 0, 0.06); g.add(pila)
  const moneda = new THREE.CylinderGeometry(0.07, 0.07, 0.022, 18)
  const monedas = Array.from({ length: 6 }, (_, i) => { const m = malla(moneda, oro, (i % 2) * 0.014, 0.012 + i * 0.024, 0, pila); m.visible = false; return m })
  const cae = malla(moneda, oro, 0, 2.2, 0, g); cae.visible = false; cae.rotation.x = Math.PI / 2
  let gordura = 0.9, salto = 0, caida = -1, regandoAntes = false
  return {
    g, hit: [panza, hocico],
    tocar() { salto = 1 },
    tick(dt, t, s) {
      gordura = lerp(gordura, 0.85 + 0.4 * clamp(s.fin.ahorroPct), 1 - Math.exp(-dt * 2))
      cuerpo.scale.set(gordura, gordura * (1 + Math.sin(t * 2.2) * 0.015), gordura)
      const n = Math.round(clamp(s.fin.ahorroPct) * 6); monedas.forEach((m, i) => { m.visible = i < n })
      if (s.regando && !regandoAntes) caida = 0
      regandoAntes = s.regando
      if (caida >= 0) {
        caida += dt; const k = Math.min(1, caida / 0.75)
        cae.visible = k < 1; cae.position.set(0, 0.3 + 0.25 * gordura + 2 * (1 - k * k), -0.02); cae.rotation.y += dt * 12
        if (k >= 1) { caida = -1; salto = 1; cx.chispas(g.position.x, g.position.y + 0.6, g.position.z, 12) }
      }
      if (salto > 0) {
        salto = Math.max(0, salto - dt * 1.8); const k = 1 - salto
        cuerpo.position.y = 0.3 + Math.sin(k * Math.PI) * 0.18; cuerpo.rotation.z = Math.sin(k * Math.PI * 2) * 0.12
      } else { cuerpo.position.y = 0.3; cuerpo.rotation.z = 0 }
      cola.rotation.z = Math.sin(t * 6) * 0.3
    },
  }
}

/* =================================================================== */
/* Don Gnomo: la racha en su cartel                                     */
/* =================================================================== */
/* Estilo tierno (cabeza grande, ojos con brillo, cachetes y barba de algodón);
 * vive a la izquierda de la isla, con su cartel grande para que la racha se lea. */
function gnomo(cx: Contexto): Habitante {
  const g = new THREE.Group(); ubicar(g, -2.95, -0.55, CAM[0], CAM[1]); g.scale.setScalar(1.55)
  const rojo = M(0xe8574a, { roughness: 0.55 }), rojoOsc = M(0xc4413a, { roughness: 0.6 }), azul = M(0x4f94dc, { roughness: 0.6 })
  const piel = M(0xffd8bf, { roughness: 0.65 }), crema = M(0xfff6e8, { roughness: 0.95 }), cafe = M(0x8a5a34)
  const blanco = M(0xffffff, { roughness: 0.25 }), negro = M(0x2b1d17, { roughness: 0.25 }), rubor = M(0xff9fb0, { roughness: 0.8 })
  const oro = M(0xf5c542, { metalness: 0.4, roughness: 0.4 })
  const cuerpo = new THREE.Group(); g.add(cuerpo)
  /* cuerpo redondito con cinturón y botas */
  malla(esfera(0.14, 20, 16), azul, 0, 0.15, 0, cuerpo).scale.set(1, 0.95, 0.92)
  const cinturon = malla(new THREE.TorusGeometry(0.126, 0.017, 8, 28), cafe, 0, 0.13, 0, cuerpo); cinturon.rotation.x = Math.PI / 2
  malla(new THREE.BoxGeometry(0.05, 0.04, 0.02), oro, 0, 0.13, 0.128, cuerpo)
  for (const s of [-1, 1]) {
    malla(esfera(0.055, 12, 10), cafe, s * 0.065, 0.028, 0.045, cuerpo).scale.set(1, 0.65, 1.3)
    malla(esfera(0.045, 12, 10), azul, s * 0.135, 0.17, 0.02, cuerpo)
    malla(esfera(0.034, 12, 10), piel, s * 0.15, 0.115, 0.05, cuerpo)
  }
  /* cabeza grande: ojos con brillo, cachetes, nariz de botón y barba esponjosa */
  const cabezaG = new THREE.Group(); cabezaG.position.y = 0.35; cuerpo.add(cabezaG)
  const cabeza = malla(esfera(0.135, 22, 18), piel, 0, 0, 0, cabezaG)
  const barba: THREE.Mesh[] = []
  for (const [x, y, z, r] of [[0, -0.075, 0.085, 0.072], [-0.065, -0.05, 0.07, 0.058], [0.065, -0.05, 0.07, 0.058], [0, -0.125, 0.06, 0.06], [-0.04, -0.115, 0.055, 0.05], [0.04, -0.115, 0.055, 0.05]]) barba.push(malla(esfera(r, 14, 10), crema, x, y, z, cabezaG))
  malla(esfera(0.03, 14, 10), M(0xffaf96), 0, -0.005, 0.135, cabezaG)
  const ojos = [-1, 1].map(s => {
    const o = new THREE.Group(); o.position.set(s * 0.052, 0.035, 0.115); cabezaG.add(o)
    malla(esfera(0.027, 14, 10), blanco, 0, 0, 0, o).scale.z = 0.55
    malla(esfera(0.018, 12, 10), negro, 0, -0.003, 0.011, o).scale.z = 0.6
    malla(esfera(0.0065, 8, 6), blanco, 0.007, 0.007, 0.022, o)
    return o
  })
  for (const s of [-1, 1]) malla(esfera(0.024, 12, 10), rubor, s * 0.088, -0.012, 0.1, cabezaG).scale.set(1, 0.55, 0.5)
  /* gorro rojo con ala y pompón, un poco ladeado */
  const ala = malla(new THREE.TorusGeometry(0.13, 0.024, 10, 28), rojoOsc, 0, 0.07, 0, cabezaG); ala.rotation.x = Math.PI / 2
  const gorro = malla(new THREE.ConeGeometry(0.138, 0.27, 22), rojo, 0.012, 0.2, -0.012, cabezaG); gorro.rotation.set(-0.14, 0, -0.16)
  malla(esfera(0.036, 12, 10), crema, 0.05, 0.33, -0.045, cabezaG)
  /* cartel con los días de racha */
  const cartel = new THREE.Group(); cartel.position.set(0.56, 0, 0.05); g.add(cartel)
  malla(new THREE.BoxGeometry(0.038, 0.68, 0.038), cafe, 0, 0.34, 0, cartel)
  /* lienzo al doble de resolución: el número se lee nítido aunque el cartel sea pequeño en pantalla */
  const { c, g: ctx } = lienzo(512, 320), tex = new THREE.CanvasTexture(c)
  const madera = M(0xc89a63), frente = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
  const tabla = malla(new THREE.BoxGeometry(0.8, 0.5, 0.032), [madera, madera, madera, madera, frente, madera], 0, 0.88, 0.02, cartel)
  let rachaPintada = -1
  function pintar(n: number) {
    rachaPintada = n
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    ctx.fillStyle = "#ecc994"; ctx.fillRect(0, 0, 256, 160); ctx.strokeStyle = "#8a5a30"; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 246, 150)
    /* llamita */
    ctx.fillStyle = n > 0 ? "#f07a1a" : "#a9927a"
    ctx.beginPath(); ctx.moveTo(62, 128); ctx.bezierCurveTo(22, 120, 26, 70, 58, 30); ctx.bezierCurveTo(62, 62, 82, 62, 80, 44); ctx.bezierCurveTo(104, 76, 106, 120, 62, 128); ctx.fill()
    ctx.fillStyle = n > 0 ? "#ffd34d" : "#cdbba6"; ctx.beginPath(); ctx.ellipse(64, 106, 13, 19, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = "#5a3418"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.font = `900 ${n > 99 ? 70 : 96}px ${cx.fuente}`; ctx.fillText(String(n), 170, 66)
    ctx.font = `800 32px ${cx.fuente}`; ctx.fillText(n === 1 ? "día" : "días", 170, 128)
    tex.needsUpdate = true
  }
  const zetas = [0, 1, 2].map(i => { const z = spriteTexto("z", "#5b6ea8", cx.fuente, 0.14 + i * 0.03); z.visible = false; g.add(z); return z })
  let baile = 0, rachaAntes = -1, sueno = 0, parpadeo = 2.5
  return {
    g, hit: [cabeza, gorro, tabla, ...barba], extra: zetas,
    tocar() { baile = 1 },
    tick(dt, t, s) {
      const racha = Math.max(0, Math.round(s.fin.racha))
      if (racha !== rachaPintada) pintar(racha)
      if (rachaAntes >= 0 && racha > rachaAntes) baile = 1
      rachaAntes = racha
      /* con la racha en cero se queda dormido (se despierta al tocarlo) */
      sueno = lerp(sueno, racha === 0 && baile === 0 ? 1 : 0, 1 - Math.exp(-dt * 2.5))
      cuerpo.rotation.z = 0.2 * sueno
      /* parpadea de vez en cuando; dormido, ojos cerrados */
      parpadeo -= dt; if (parpadeo < 0) parpadeo = 2.5 + Math.random() * 3
      const abierto = parpadeo < 0.12 ? 0.12 : 1
      for (const o of ojos) o.scale.y = Math.max(0.08, abierto * (1 - 0.92 * sueno))
      zetas.forEach((z, i) => {
        z.visible = sueno > 0.5
        const k = ((t * 0.45 + i / 3) % 1)
        z.position.set(0.1 + k * 0.18, 0.66 + k * 0.4, 0.05); z.material.opacity = Math.sin(k * Math.PI)
      })
      cartel.rotation.z = Math.sin(t * 1.3) * 0.04
      cabezaG.rotation.z = Math.sin(t * 1.1) * 0.05 * (1 - sueno)
      if (baile > 0) {
        baile = Math.max(0, baile - dt / 1.3); const k = 1 - baile
        cuerpo.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.12; cuerpo.rotation.y = smooth(k) * Math.PI * 2
      } else { cuerpo.position.y = Math.abs(Math.sin(t * 2)) * 0.01; cuerpo.rotation.y = 0 }
    },
  }
}


/* =================================================================== */
/* Casita de pájaros: cantan alrededor del árbol cuando entra un ingreso */
/* =================================================================== */
function pajaros(cx: Contexto): Habitante {
  const g = new THREE.Group(); ubicar(g, 1.95, -1.05, CAM[0], CAM[1])
  const madera = M(0xd9a86c), techoM = M(0xc8513e), oscuro = M(0x2a1c12)
  malla(new THREE.CylinderGeometry(0.022, 0.03, 0.9, 8), M(0x7a5532), 0, 0.45, 0, g)
  const casa = malla(new THREE.BoxGeometry(0.24, 0.22, 0.22), madera, 0, 1.0, 0, g)
  for (const s of [-1, 1]) { const r = malla(new THREE.BoxGeometry(0.18, 0.022, 0.28), techoM, s * 0.075, 1.15, 0, g); r.rotation.z = -s * 0.62 }
  const hueco = new THREE.Mesh(new THREE.CircleGeometry(0.045, 18), oscuro); hueco.position.set(0, 1.02, 0.111); g.add(hueco)
  const percha = malla(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), madera, 0, 0.95, 0.14, g); percha.rotation.x = Math.PI / 2
  /* dos pajaritos que viven en el techo y salen a volar */
  const colores: [number, number][] = [[0x4da3e0, 0xdcefff], [0xf5c542, 0xfff4cf]]
  const aves = colores.map(([c1, c2], i) => {
    const a = new THREE.Group(); cx.world.add(a)
    const cuerpoAve = malla(esfera(0.055, 12, 10), M(c1), 0, 0, 0, a); cuerpoAve.scale.set(1, 0.9, 1.3)
    malla(esfera(0.04, 10, 8), M(c2), 0, -0.01, 0.03, a).scale.set(0.9, 0.8, 0.9)
    malla(esfera(0.04, 12, 10), M(c1), 0, 0.05, 0.05, a)
    const pico = malla(new THREE.ConeGeometry(0.012, 0.035, 6), M(0xf08a24), 0, 0.045, 0.1, a); pico.rotation.x = Math.PI / 2
    for (const s of [-1, 1]) malla(esfera(0.008, 6, 4), M(0x111111), s * 0.022, 0.065, 0.08, a)
    const alas = [-1, 1].map(s => { const w = malla(esfera(0.04, 8, 6), M(c1), s * 0.05, 0.01, -0.005, a); w.scale.set(0.35, 0.18, 0.9); return w })
    malla(new THREE.BoxGeometry(0.04, 0.008, 0.06), M(c1), 0, 0.01, -0.08, a)
    return { a, alas, lado: i === 0 ? -1 : 1, fase: i * Math.PI, ph: Math.random() * 10 }
  })
  const notas = Array.from({ length: 6 }, (_, i) => { const n = spriteTexto(i % 2 ? "♪" : "♫", i % 2 ? "#3a7bd5" : "#e08a00", cx.fuente, 0.24); n.visible = false; cx.world.add(n); return { n, t: 9 } })
  const percheP = new THREE.Vector3(), tmp = new THREE.Vector3()
  let vuelo = 0, ingresoAntes = false, notaT = 0
  return {
    g, hit: [casa, hueco], extra: [...aves.map(v => v.a), ...notas.map(n => n.n)],
    tocar() { vuelo = Math.max(vuelo, 3.5) },
    tick(dt, t, s) {
      if (s.ingreso && !ingresoAntes) vuelo = 9
      ingresoAntes = s.ingreso
      vuelo = Math.max(0, vuelo - dt)
      const alto = Math.max(1.6, cx.alturaArbol() * 0.75 + 0.4)
      for (const v of aves) {
        g.localToWorld(percheP.set(v.lado * 0.06, 1.2, 0.02)); cx.world.worldToLocal(percheP)
        if (vuelo > 0) {
          const a = t * 1.25 + v.fase, R = 1.45 + 0.25 * Math.sin(t * 0.7 + v.fase)
          tmp.set(Math.cos(a) * R, alto + Math.sin(t * 2 + v.fase) * 0.25, Math.sin(a) * R)
          /* entra y sale del círculo suavemente */
          const k = smooth(Math.min(1, (9 - vuelo) / 0.8)) * smooth(Math.min(1, vuelo / 0.9))
          v.a.position.lerpVectors(percheP, tmp, k)
          v.a.rotation.set(0, a + Math.PI, 0.25)
          for (const w of v.alas) w.rotation.z = Math.sin(t * 34 + v.ph) * 0.9 * (w.position.x > 0 ? 1 : -1)
        } else {
          const salto = Math.max(0, Math.sin(t * 2.6 + v.ph)) ** 8 * 0.05
          v.a.position.set(percheP.x, percheP.y + salto, percheP.z)
          v.a.rotation.set(0, g.rotation.y + Math.sin(t * 0.9 + v.ph) * 0.8, 0)
          for (const w of v.alas) w.rotation.z = 0
        }
      }
      /* notas musicales mientras vuelan */
      notaT -= dt
      if (vuelo > 0.8 && notaT <= 0) {
        notaT = 0.45; const libre = notas.find(n => n.t >= 1.6)
        if (libre) { const v = aves[Math.floor(Math.random() * aves.length)]; libre.t = 0; libre.n.position.copy(v.a.position); libre.n.visible = true }
      }
      for (const n of notas) {
        if (n.t >= 1.6) { n.n.visible = false; continue }
        n.t += dt; n.n.position.y += dt * 0.35; n.n.material.opacity = Math.sin(Math.min(1, n.t / 1.6) * Math.PI)
      }
    },
  }
}

const FABRICAS: Record<ClaveHabitante, (cx: Contexto) => Habitante> = { chanchito, gnomo, pajaros }

/** Crea los habitantes bajo demanda (solo los que el usuario tiene en su isla). */
export function crearHabitantes(cx: Contexto) {
  const vivos = new Map<ClaveHabitante, Habitante>()
  let visibles = new Set<ClaveHabitante>()
  const hit: THREE.Object3D[] = [], dueno = new Map<THREE.Object3D, ClaveHabitante>()
  /* los extras (pájaros, notas, zetas) los vuelve a esconder su propio tick si no tocan */
  function mostrar(h: Habitante, v: boolean) { h.g.visible = v; for (const e of h.extra ?? []) e.visible = v }
  return {
    poner(lista: string[]) {
      visibles = new Set(lista.filter((k): k is ClaveHabitante => k in FABRICAS))
      for (const k of visibles) {
        if (vivos.has(k)) continue
        const h = FABRICAS[k](cx)
        if (!h.g.parent) cx.world.add(h.g)
        vivos.set(k, h)
        for (const o of h.hit) { hit.push(o); dueno.set(o, k) }
      }
      for (const [k, h] of vivos) mostrar(h, visibles.has(k))
    },
    /** Clave del habitante tocado (o null). */
    tocar(ray: THREE.Raycaster): ClaveHabitante | null {
      const golpes = ray.intersectObjects(hit.filter(o => visibles.has(dueno.get(o)!)), false)
      if (!golpes.length) return null
      const k = dueno.get(golpes[0].object)!
      vivos.get(k)?.tocar()
      return k
    },
    tick(dt: number, t: number, s: EstadoVivo) {
      for (const [k, h] of vivos) if (visibles.has(k)) h.tick(dt, t, s)
    },
  }
}
