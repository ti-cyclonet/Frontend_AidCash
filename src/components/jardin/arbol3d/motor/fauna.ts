import * as THREE from "three"
import { lienzo } from "./utilidades"

/** Mariposas caricaturescas (mismo estilo que la hormiga de Kiri). */

function wingTex(cA: string, cB: string, spot: string) {
  const S = 256, { c, g } = lienzo(S)
  function path() { g.beginPath(); g.moveTo(8, 128); g.bezierCurveTo(30, 18, 190, -6, 248, 58); g.bezierCurveTo(262, 100, 226, 124, 176, 132); g.bezierCurveTo(232, 150, 250, 214, 196, 240); g.bezierCurveTo(130, 266, 44, 206, 8, 128); g.closePath() }
  path(); const gr = g.createRadialGradient(20, 128, 10, 170, 110, 170); gr.addColorStop(0, cA); gr.addColorStop(1, cB); g.fillStyle = gr; g.fill()
  g.save(); g.clip(); g.strokeStyle = "rgba(74,42,20,.5)"; g.lineWidth = 3; g.lineCap = "round"
  ;[[40, 100], [110, 40], [200, 70], [110, 215], [200, 200], [220, 130]].forEach(p => { g.beginPath(); g.moveTo(10, 128); g.quadraticCurveTo((10 + p[0]) / 2, (128 + p[1]) / 2 - 6, p[0] + 25, p[1]); g.stroke() })
  g.fillStyle = spot; [[205, 64, 15], [226, 98, 9], [200, 205, 14], [222, 172, 8], [150, 38, 9]].forEach(s => { g.beginPath(); g.arc(s[0], s[1], s[2], 0, 6.3); g.fill() })
  g.restore(); path(); g.lineWidth = 11; g.lineJoin = "round"; g.strokeStyle = "#4a2a14"; g.stroke()
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t
}

export interface Mariposa extends THREE.Group {
  userData: { wr: THREE.Group; wl: THREE.Group; ph: number; R: number; h: number; sp: number; low: boolean }
}

export function crearMariposas(scene: THREE.Scene) {
  const wingGeo = new THREE.PlaneGeometry(1, 1); wingGeo.translate(0.5, 0, 0)
  const dark = new THREE.MeshBasicMaterial({ color: 0x6e4222 }), hull = new THREE.MeshBasicMaterial({ color: 0x2e1a0c, side: THREE.BackSide }), white = new THREE.MeshBasicMaterial({ color: 0xffffff }), black = new THREE.MeshBasicMaterial({ color: 0x1a0f08 })
  function makeButterfly(cA: string, cB: string, spot: string) {
    const g = new THREE.Group() as Mariposa, wm = new THREE.MeshBasicMaterial({ map: wingTex(cA, cB, spot), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })
    function ball(r: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material, outl: boolean) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m)
      if (outl) { const h = new THREE.Mesh(new THREE.SphereGeometry(r * 1.16, 14, 10), hull); h.position.copy(m.position); h.scale.copy(m.scale); g.add(h) }
      return m
    }
    ball(0.07, 0, 0, -0.2, 1, 1, 2.2, dark, true); ball(0.075, 0, 0.01, 0.0, 1, 1, 1.2, dark, true); ball(0.1, 0, 0.03, 0.15, 1, 1, 1, dark, true)
    ;[-1, 1].forEach(s => {
      ball(0.05, s * 0.06, 0.05, 0.2, 1, 1.1, 0.8, white, true); ball(0.028, s * 0.068, 0.05, 0.235, 1, 1.1, 0.6, black, false); ball(0.01, s * 0.075, 0.068, 0.248, 1, 1, 1, white, false)
      const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.03, 0.11, 0.2), new THREE.Vector3(s * 0.09, 0.25, 0.3), new THREE.Vector3(s * 0.17, 0.33, 0.4)])
      g.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 8, 0.01, 5, false), hull)); ball(0.027, s * 0.17, 0.33, 0.4, 1, 1, 1, black, false)
    })
    const wr = new THREE.Group(), wl = new THREE.Group()
    ;[wr, wl].forEach(w => { w.position.set(0, 0.04, 0.02); const m = new THREE.Mesh(wingGeo, wm); m.rotation.x = Math.PI / 2; m.scale.set(0.62, 0.62, 0.62); w.add(m); g.add(w) })
    wl.scale.x = -1; g.visible = false; g.scale.setScalar(0.62); scene.add(g)
    g.userData = { wr, wl, ph: 0, R: 0, h: 0, sp: 0, low: false }
    return g
  }
  const flies = [makeButterfly("#ffd36b", "#f08a24", "#fff3d0"), makeButterfly("#c8f0d8", "#4fb585", "#ffffff"), makeButterfly("#ffe98a", "#f2b705", "#fff8d6")]
  flies.forEach((f, i) => { Object.assign(f.userData, { ph: i * 2.1, R: [4.3, 5.0, 3.6][i], h: [2.6, 4.2, 0.9][i], sp: 0.9 - i * 0.12, low: i === 2 }) })
  return flies
}
