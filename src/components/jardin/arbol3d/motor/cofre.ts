import * as THREE from "three"
import { Hgt } from "./terreno"
import { backOut, glowTex, smooth } from "./utilidades"

/**
 * Cofre 3D en la isla (a la derecha, fuera de la cerca). Caja de tablas con
 * esquineros y bandas, tapa abovedada con bisagra y cerradura. Mientras espera
 * da saltitos; al tocarlo tiembla hasta que el servidor sortea el premio, y
 * entonces la tapa se abre, sale brillo y saltan monedas. El premio nunca se
 * decide aquí: este módulo solo anima.
 */
export type TipoCofre3D = "comun" | "raro" | "legendario"

const ASPECTO: Record<TipoCofre3D, { body: number; band: number; glow: string }> = {
  comun: { body: 0x9a6534, band: 0xd8a93a, glow: "rgba(255,214,120," },
  raro: { body: 0x3a68c9, band: 0xeef3fb, glow: "rgba(150,200,255," },
  legendario: { body: 0xd99a12, band: 0xfff1b3, glow: "rgba(255,230,120," },
}

const POS = new THREE.Vector3(2.5, 0, 0.65)
POS.y = Hgt(POS.x, POS.z)

export function crearCofre(world: THREE.Group, estallido: (x: number, y: number, z: number, n: number) => void) {
  const g = new THREE.Group(); g.position.copy(POS); g.rotation.y = -0.5; g.visible = false; world.add(g)
  const body = new THREE.MeshStandardMaterial({ color: 0x9a6534, roughness: 0.7, side: THREE.DoubleSide })
  const band = new THREE.MeshStandardMaterial({ color: 0xd8a93a, roughness: 0.3, metalness: 0.55, emissive: 0x2a1a00, side: THREE.DoubleSide })
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.9 }), line = new THREE.MeshStandardMaterial({ color: 0x6e4220, roughness: 0.85 })
  const hit: THREE.Mesh[] = []
  const W = 0.62, H = 0.34, D = 0.42, R = D / 2
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); hit.push(m); return m
  }
  /* caja con tablas, bandas y esquineros */
  add(new THREE.BoxGeometry(W, H, D), body, 0, H / 2, 0)
  for (const y of [0.11, 0.23]) add(new THREE.BoxGeometry(W + 0.004, 0.012, D + 0.004), line, 0, y, 0)
  add(new THREE.BoxGeometry(W + 0.03, 0.035, D + 0.03), band, 0, 0.0175, 0)
  add(new THREE.BoxGeometry(W + 0.03, 0.03, D + 0.03), band, 0, H - 0.015, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.05, H, 0.05), band, sx * (W / 2 - 0.01), H / 2, sz * (D / 2 - 0.01))
  /* tapa abovedada: medio cilindro con tapas, bisagra atrás */
  const lid = new THREE.Group(); lid.position.set(0, H, -D / 2); g.add(lid)
  const dome = new THREE.CylinderGeometry(R, R, W, 24, 1, false, 0, Math.PI); dome.rotateZ(Math.PI / 2)
  add(dome, body, 0, 0, R, lid)
  const domeBand = new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.06, 24, 1, true, 0, Math.PI); domeBand.rotateZ(Math.PI / 2)
  for (const x of [-W / 2 + 0.06, 0, W / 2 - 0.06]) add(domeBand, band, x, 0, R, lid)
  /* cerradura */
  add(new THREE.BoxGeometry(0.11, 0.13, 0.03), band, 0, H - 0.02, D / 2 + 0.01)
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.035, 8), dark, 0, H - 0.01, D / 2 + 0.02).rotation.x = Math.PI / 2
  /* interior dorado y brillo */
  const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.02, D - 0.06), new THREE.MeshBasicMaterial({ color: 0xffe08a })); inner.position.y = H - 0.03; g.add(inner)
  const brillo = (k: TipoCofre3D) => glowTex(ASPECTO[k].glow + "1)", ASPECTO[k].glow + "0)")
  const glowTexs: Record<TipoCofre3D, THREE.Texture> = { comun: brillo("comun"), raro: brillo("raro"), legendario: brillo("legendario") }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexs.comun, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }))
  glow.scale.set(1.7, 1.7, 1); glow.position.y = 0.3; g.add(glow)

  /* monedas que saltan al abrir */
  const coinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.015, 14); coinGeo.rotateX(Math.PI / 2)
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xf2b71f, metalness: 0.6, roughness: 0.3, emissive: 0x5a3c00 })
  const monedas = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(coinGeo, coinMat); m.visible = false; world.add(m); return { m, t: 0, on: false, v: new THREE.Vector3() } })

  /* 0 = escondido, 1 = esperando el toque, 3 = esperando al servidor, 2 = abriéndose */
  let estado = 0, tipo: TipoCofre3D | null = null, pedido: TipoCofre3D | null = null, t = 0, estallo = false, espera = 0
  const p = new THREE.Vector3()

  function aparecer(k: TipoCofre3D) {
    tipo = k; estado = 1; t = 0; estallo = false
    const A = ASPECTO[k]; body.color.set(A.body); band.color.set(A.band); glow.material.map = glowTexs[k]; glow.material.needsUpdate = true
    g.visible = true; g.scale.setScalar(0.0001); lid.rotation.x = 0
  }

  return {
    /** Qué cofre debería estar en la isla (null = ninguno). Si hay uno abriéndose, espera a que termine. */
    mostrar(k: TipoCofre3D | null) {
      pedido = k
      if (estado === 2 || estado === 3) return
      if (!k) { estado = 0; g.visible = false; tipo = null; return }
      if (estado === 0 || tipo !== k) espera = 0.4
    },
    /** true si el toque cayó en el cofre (lo deja temblando hasta que llegue el premio). */
    tocar(ray: THREE.Raycaster): TipoCofre3D | null {
      if (estado !== 1 || !g.visible || !ray.intersectObjects(hit, false).length) return null
      estado = 3; t = 0
      return tipo
    },
    /** El servidor ya sorteó el premio: se abre la tapa. */
    abrir() { if (estado === 3) { estado = 2; t = 0 } },
    /** No se pudo abrir (sin red, error): vuelve a esperar el toque. */
    cancelar() { if (estado === 3) { estado = 1; t = 0 } },
    /** `puede` = la intro ya terminó y la escena está quieta para mostrarlo. */
    tick(dt: number, puede: boolean) {
      for (const c of monedas) {
        if (!c.on) continue
        c.t += dt; c.v.y -= 7 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.y += dt * 9
        const gy = Hgt(c.m.position.x, c.m.position.z) + 0.03
        if (c.m.position.y < gy) { c.m.position.y = gy; c.v.multiplyScalar(0.3); c.v.y = Math.abs(c.v.y) * 0.4 }
        if (c.t > 1.6) { const s = Math.max(0, 1 - (c.t - 1.6) / 0.4); c.m.scale.setScalar(Math.max(0.0001, s)); if (s <= 0) { c.on = false; c.m.visible = false } }
      }
      if (estado === 0 || (estado === 1 && tipo !== pedido)) {
        if (!pedido || !puede) { if (estado === 1) { estado = 0; g.visible = false } return }
        espera -= dt; if (espera <= 0) aparecer(pedido)
        if (estado === 0) return
      }
      t += dt
      if (estado === 1 || estado === 3) {
        const s = Math.min(1, t / 0.45), fuerte = estado === 3
        if (estado === 1) g.scale.setScalar(Math.max(0.0001, 1.35 * backOut(s)))
        const hop = fuerte ? 0 : Math.max(0, Math.sin(t * 2.2)), tiembla = fuerte || Math.sin(t * 1.1) > 0.75 ? 1 : 0
        g.position.y = POS.y + hop * hop * 0.08
        g.rotation.z = Math.sin(t * (fuerte ? 26 : 14)) * (fuerte ? 0.06 : 0.04) * tiembla
        lid.rotation.x = -(fuerte ? 0.09 : 0.05) * Math.max(0, Math.sin(t * 14)) * tiembla
        glow.material.opacity = 0.35 + 0.2 * Math.sin(t * 3)
        return
      }
      /* abriéndose */
      lid.rotation.x = -1.95 * backOut(Math.min(1, t / 0.45)); g.position.y = POS.y; g.rotation.z = 0
      glow.material.opacity = 0.95 * (1 - smooth((t - 0.8) / 0.9))
      if (t > 0.3 && !estallo) {
        estallo = true; g.updateMatrixWorld(true)
        world.worldToLocal(g.localToWorld(p.set(0, 0.42, 0)))
        estallido(p.x, p.y, p.z, 46)
        for (const c of monedas) {
          const a = Math.random() * 6.28, r = 0.6 + Math.random() * 1.2
          c.on = true; c.t = 0; c.m.visible = true; c.m.scale.setScalar(1); c.m.position.copy(p); c.v.set(Math.cos(a) * r, 2.6 + Math.random() * 1.6, Math.sin(a) * r)
        }
      }
      if (t > 2.4) {
        g.scale.setScalar(Math.max(0.0001, 1.35 * (1 - smooth((t - 2.4) / 0.4))))
        /* si quedan más cofres pendientes, aparece el siguiente */
        if (t > 2.8) { g.visible = false; estado = 0; tipo = null; espera = 0.5 }
      }
    },
  }
}
