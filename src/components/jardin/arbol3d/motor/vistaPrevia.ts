import * as THREE from "three"
import { crearPiezasFruta } from "./arbol"
import { crearModeloRegadera, estiloCerca } from "./accesorios3d"
import { ACCESORIOS, type AspectoHormiguero } from "./especies"
import { construirMonticulo } from "./hormigas"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Vista previa de los accesorios de la tienda
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Arma cada accesorio con los MISMOS modelos de la isla (accesorios3d.ts y el
 * hormiguero de hormigas.ts), lo dibuja en un renderizador aparte, fuera de la
 * pantalla, y guarda la imagen. Las imágenes se piden de a una para no trabar la
 * tienda, y quedan en memoria mientras la app está abierta.
 */
export type TipoVista = "hormiguero" | "cerca" | "regadera" | "frutos"

const LADO = 220
const cache = new Map<string, string>()
const pendientes = new Map<string, Promise<string | null>>()
let cola: Promise<unknown> = Promise.resolve()
let renderer: THREE.WebGLRenderer | null = null

function obtenerRenderer() {
  if (renderer) return renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(LADO, LADO, false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95
  renderer.setClearColor(0x000000, 0)
  return renderer
}

function escenaBase() {
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xeaf4f8, 0x5a4a30, 0.85))
  const sol = new THREE.DirectionalLight(0xfff2d8, 1.35); sol.position.set(3, 5, 4); scene.add(sol)
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0.35); rim.position.set(-4, 3, -4); scene.add(rim)
  return scene
}

/** Disco de pasto bajo el accesorio (para el hormiguero y la cerca). */
function pasto(radio: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio * 1.04, 0.06, 40), new THREE.MeshStandardMaterial({ color: 0x8cc35a, roughness: 0.95 }))
  m.position.y = -0.03; return m
}

/** Cámara mirando el objeto desde (dirección), con margen. */
function encuadrar(obj: THREE.Object3D, dir: THREE.Vector3, margen = 1.25, centro?: THREE.Vector3, tam?: number) {
  const caja = new THREE.Box3().setFromObject(obj)
  const c = centro ?? caja.getCenter(new THREE.Vector3())
  const s = tam ?? caja.getSize(new THREE.Vector3()).length() * 0.55
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100)
  const d = (s / Math.tan((30 * Math.PI) / 360)) * margen
  cam.position.copy(c).addScaledVector(dir.clone().normalize(), d); cam.lookAt(c)
  return cam
}

function armar(tipo: TipoVista, clave: string) {
  const scene = escenaBase(), raiz = new THREE.Group(); scene.add(raiz)
  let cam: THREE.PerspectiveCamera
  switch (tipo) {
    case "hormiguero": {
      const g = new THREE.Group(); raiz.add(g)
      const m = construirMonticulo(g)
      m.ponerAspecto((ACCESORIOS.hormiguero as Record<string, AspectoHormiguero>)[clave] ?? ACCESORIOS.hormiguero.arena)
      raiz.add(pasto(1.15))
      /* se mira de frente a la boca (mira hacia +x+z, como en la isla) */
      cam = encuadrar(raiz, new THREE.Vector3(0.55, 0.36, 0.62), 1.05, new THREE.Vector3(0, 0.42, 0), 1.0)
      break
    }
    case "cerca": {
      const e = estiloCerca(clave), paso = 0.27, n = 6
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * paso
        if (i % e.cadaN === 0) { const p = new THREE.Mesh(e.poste.geo, e.poste.mat); p.position.x = x; raiz.add(p) }
        if (e.riel && i < n - 1) for (const h of e.alturasRiel) { const r = new THREE.Mesh(e.riel.geo, e.riel.mat); r.position.set(x + paso / 2, h, 0); r.scale.x = paso; raiz.add(r) }
      }
      /* la cerca es continua: también los extremos */
      if (e.riel) for (const h of e.alturasRiel) for (const lado of [-1, 1]) { const r = new THREE.Mesh(e.riel.geo, e.riel.mat); r.position.set(lado * ((n - 1) / 2 + 0.5) * paso, h, 0); r.scale.x = paso; raiz.add(r) }
      const suelo = pasto(0.95); suelo.scale.z = 0.45; raiz.add(suelo)
      cam = encuadrar(raiz, new THREE.Vector3(0.15, 0.32, 1), 0.95, new THREE.Vector3(0, 0.22, 0), 0.78)
      break
    }
    case "regadera": {
      const r = crearModeloRegadera(clave); r.g.rotation.y = -0.45; raiz.add(r.g)
      cam = encuadrar(raiz, new THREE.Vector3(0.2, 0.35, 1), 1.0)
      break
    }
    case "frutos": {
      /* tres frutos colgando de una ramita (se ven las variantes de color) */
      const fruta = crearPiezasFruta(); fruta.ponerModelo(clave)
      const rama = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.95, 8), new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.9 }))
      rama.rotation.z = Math.PI / 2 + 0.06; rama.position.y = 0.36; raiz.add(rama)
      ;[-0.3, 0, 0.3].forEach((x, i) => { const f = fruta.nuevo(); f.position.set(x, i === 1 ? 0.06 : 0.12, 0); f.rotation.y = (i - 1) * 0.5; raiz.add(f) })
      cam = encuadrar(raiz, new THREE.Vector3(0, 0.12, 1), 0.95, new THREE.Vector3(0, 0.17, 0), 0.5)
      break
    }
  }
  return { scene, cam }
}

/** Imagen (data URL) del accesorio; null si el dispositivo no tiene WebGL. */
export function vistaPrevia(tipo: TipoVista, clave: string): Promise<string | null> {
  const k = `${tipo}:${clave}`
  const hecho = cache.get(k); if (hecho) return Promise.resolve(hecho)
  const en = pendientes.get(k); if (en) return en
  const p = cola.then(() => new Promise<string | null>(res => {
    /* de a una y cuando el navegador está libre: la tienda no se traba */
    const hacer = () => {
      try {
        const r = obtenerRenderer(), { scene, cam } = armar(tipo, clave)
        r.render(scene, cam)
        const url = r.domElement.toDataURL("image/png")
        cache.set(k, url); res(url)
      } catch { res(null) }
    }
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback
    if (ric) ric(hacer); else window.setTimeout(hacer, 16)
  }))
  cola = p; pendientes.set(k, p)
  return p
}
