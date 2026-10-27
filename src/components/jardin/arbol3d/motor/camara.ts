import * as THREE from "three"
import { clamp, lerp, smooth } from "./utilidades"

/**
 * Cámara fija con vista lateral elevada: arrastrar gira solo a los lados
 * (±0,85 rad) y vuelve sola; pellizco o Ctrl+rueda acercan y vuelven tras ~1,2 s.
 * La rueda sola no hace zoom para no robarle el scroll a la página.
 */
export function crearCamara(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera, alTocar: (cx: number, cy: number) => void) {
  const cam = { drag: 0, r: 14, ty: 2.5, ph: 1.39, zoom: 1, zIdle: 0, pinch: 0 }
  const ptr = new Map<number, { x: number; y: number; sx: number; sy: number; moved: boolean }>()

  const down = (e: PointerEvent) => { try { canvas.setPointerCapture(e.pointerId) } catch { /* sin captura */ } ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }) }
  const move = (e: PointerEvent) => {
    const p = ptr.get(e.pointerId); if (!p) return
    if (ptr.size === 2) {
      p.x = e.clientX; p.y = e.clientY; const q2 = Array.from(ptr.values()), d = Math.hypot(q2[0].x - q2[1].x, q2[0].y - q2[1].y)
      if (cam.pinch > 0) cam.zoom = clamp(cam.zoom * cam.pinch / Math.max(1, d), 0.55, 1.6); cam.pinch = d; cam.zIdle = 0; q2.forEach(o => { o.moved = true }); return
    }
    const dx = e.clientX - p.x; p.x = e.clientX; p.y = e.clientY
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) p.moved = true
    if (p.moved && ptr.size === 1) cam.drag = clamp(cam.drag - dx * 0.005, -0.85, 0.85)
  }
  const end = (e: PointerEvent) => {
    const p = ptr.get(e.pointerId); if (!p) return
    ptr.delete(e.pointerId); if (ptr.size < 2) cam.pinch = 0
    if (!p.moved && e.type === "pointerup") alTocar(e.clientX, e.clientY)
  }
  const wheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(clamp(e.deltaY, -60, 60) * 0.004), 0.55, 1.6); cam.zIdle = 0
  }
  canvas.addEventListener("pointerdown", down)
  canvas.addEventListener("pointermove", move)
  canvas.addEventListener("pointerup", end)
  canvas.addEventListener("pointercancel", end)
  canvas.addEventListener("wheel", wheel, { passive: false })

  /** Encuadra el árbol según su altura: cerca en semilla y brote, lejos para que quepa el nivel 6. */
  function encuadrar(dt: number, top: number, intro: boolean, instant: boolean) {
    cam.drag *= Math.exp(-dt * (ptr.size ? 0 : 1.6))
    const aspect = camera.aspect, tanH = Math.tan(camera.fov * Math.PI / 360)
    const kk = clamp(top / 5), y0 = lerp(-3.9, -3.7, kk), y1 = top + lerp(0.9, 1.3, kk), visH = y1 - y0
    /* en semilla y brote la cámara se acerca un poco más */
    const cerca = 1 - smooth((top - 1.0) / 3.2)
    const ancho = lerp(lerp(12.4, 11.6, clamp(top / 7)), 10.2, cerca)
    const dH = visH / (2 * tanH), dW = ancho / (2 * tanH * aspect)
    const dT = Math.max(dH, dW, 5.6), kc = intro ? 1 : 1 - Math.exp(-dt * (instant ? 40 : 2.2))
    cam.zIdle += dt; if (cam.zIdle > 1.2 && !ptr.size) cam.zoom += (1 - cam.zoom) * (1 - Math.exp(-dt * 1.1))
    cam.r = lerp(cam.r, dT * cam.zoom, cam.zIdle < 0.05 ? 1 - Math.exp(-dt * 12) : kc)
    /* la isla va en la parte baja del cuadro (aunque la cascada no se vea entera);
       solo se sube si la copa no cabe arriba */
    const altoVista = dT * 2 * tanH
    cam.ty = lerp(cam.ty, Math.max(altoVista * 0.22, y1 - altoVista / 2 + 0.2), kc)
    /* un poco menos inclinada: más cielo y el mar más cerca */
    cam.ph = lerp(cam.ph, lerp(1.37, 1.41, kk), kc)
    const th = 0.28 + cam.drag, ph = cam.ph
    camera.position.set(cam.r * Math.sin(ph) * Math.sin(th), cam.ty + cam.r * Math.cos(ph), cam.r * Math.sin(ph) * Math.cos(th))
    camera.lookAt(0, cam.ty, 0)
  }

  function destruir() {
    canvas.removeEventListener("pointerdown", down)
    canvas.removeEventListener("pointermove", move)
    canvas.removeEventListener("pointerup", end)
    canvas.removeEventListener("pointercancel", end)
    canvas.removeEventListener("wheel", wheel)
  }
  return { encuadrar, destruir }
}
