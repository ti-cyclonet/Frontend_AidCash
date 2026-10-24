import * as THREE from "three"
import { crearArbol, crearPiezasFruta, GX, treeTop } from "./arbol"
import { crearCamara } from "./camara"
import { climaActual, crearLluvia, crearNubes, crearRayos, WX, type ClimaWX } from "./clima"
import { crearEfectos } from "./efectos"
import { crearEscena } from "./escena"
import { crearMariposas } from "./fauna"
import { crearHormigas, type GastoHormiga3D } from "./hormigas"
import { consumirBordillo, consumirColinas, crearDetallesIsla, crearIsla } from "./isla"
import { Hgt } from "./terreno"
import { clamp, lerp, piece, rng, smooth } from "./utilidades"

/**
 * Motor del árbol Kiri 3D (Three.js). Solo dibuja y anima: el nivel, el
 * progreso, el clima y los frutos llegan desde la app, y la XP la decide el
 * servidor. Port del prototipo docs/arbol-3d/arbol-kiri-3d.html.
 */

export type { GastoHormiga3D }
export type ClimaArbol = "sol" | "nubes" | "tormenta"

export interface EstadoArbol3D {
  /** 1–6 */
  nivel: number
  /** Progreso dentro del nivel, 0–1 */
  progreso: number
  /** Nivel que se está previsualizando (null = el real) */
  vistaPrevia: number | null
  clima: ClimaArbol
  /** Tormenta pasajera de un gasto hormiga */
  tormentaHormiga: boolean
  /** Regadera visible y echando agua */
  regando: boolean
  /** Ingreso registrado: luz dorada que nutre el árbol */
  ingreso: boolean
  /** Salud del jardín 0–100: con salud baja las hojas se secan */
  salud: number
  /** Manzanas colgando: se caen con la sacudida del día y vuelven al día siguiente */
  manzanasArbol: boolean
}

export interface FrutoArbol3D { indice: number; dorado: boolean; cosechado: boolean }

export interface SonidosArbol {
  hojas: () => void
  trueno: (retrasoSeg: number) => void
  golpe: () => void
  pop: () => void
  riego: () => void
  lluvia: (intensidad: number) => void
}

export interface OpcionesMotor {
  estado: EstadoArbol3D
  sonidos: SonidosArbol
  formatearMonto: (monto: number) => string
  alTocarArbol: () => void
  alTocarNubes: () => void
  alCosechar: (indice: number, dorado: boolean, x: number, y: number) => void
  alTocarHormiga: (gasto: GastoHormiga3D | null) => void
  alTerminarHormigas: (total: number) => void
}

export interface MotorArbol3D {
  actualizar: (e: Partial<EstadoArbol3D>) => void
  /** Toque normal (fuerte = false) o sacudida del combo, que tumba las manzanas */
  sacudir: (fuerte: boolean) => void
  gastoHormiga: (lista: GastoHormiga3D[]) => void
  rayo: () => void
  subirNivel: () => void
  ponerFrutos: (frutos: FrutoArbol3D[] | null) => void
  destruir: () => void
}

const WX_DE: Record<ClimaArbol, ClimaWX> = { sol: "clear", nubes: "rain", tormenta: "storm" }

export function crearMotorArbol(canvas: HTMLCanvasElement, op: OpcionesMotor): MotorArbol3D {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, motion = reduce ? 0.5 : 1
  const mobile = matchMedia("(pointer:coarse)").matches || innerWidth < 700
  const R = rng(7741)
  const est: EstadoArbol3D = { ...op.estado }

  /* misma secuencia de construcción que el prototipo (comparten el generador R) */
  const esc = crearEscena(canvas, mobile)
  const { renderer, scene, camera, world, skyU, sunGlow, hemi, sun, oceanU, farClouds } = esc
  const isla = crearIsla(esc, R)
  consumirColinas(R)
  const { cloudMat, clouds, cloudHit } = crearNubes(scene, R)
  const fruta = crearPiezasFruta()
  const arbol = crearArbol(world, R, fruta)
  const { root, roots, branches, leaves, apples, seedG, halfR, halfL, leafU, toqueFacil } = arbol
  const flies = crearMariposas(scene)
  consumirBordillo(R)
  const detalles = crearDetallesIsla(esc, isla, arbol.flowerTex, arbol.barkMat, R)
  const fuente = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"
  const hormigas = crearHormigas(world, isla, arbol, detalles.flowerSp, {
    formatear: op.formatearMonto, fuente, pop: () => op.sonidos.pop(), alTerminar: total => op.alTerminarHormigas(total),
  })
  const { sprouts, fallU, mist } = detalles.completar()
  arbol.orientarBrote()
  arbol.ramaExtra()
  const efectos = crearEfectos(scene, arbol.leafTex, arbol.flowerTex, leafU.uSeco, fruta)
  efectos.setSuelo(hormigas.groundY)
  const lluvia = crearLluvia(scene)
  const rayos = crearRayos(scene)
  const { blades, bd, NB, NF, stems, grassMat, grassDry, grassWet, soilMat, soilDry, soilWet, contact, waterTex } = isla
  const flowerSp = detalles.flowerSp

  /* ---------- estado ---------- */
  const climaWX = () => est.tormentaHormiga ? "storm" : WX_DE[est.clima]
  let weather: ClimaWX = climaWX()
  const cur = climaActual(weather)
  let windS = .35, wet = 0, flash = 0, nextBolt = 1.4, shakeAmp = 0, popV = 0, pop = 0
  let treeS = 0.4, Gd = 0, sView = 0.4, t = 0, audAcc = 0, instant = true, intro = true
  let seco = 0, secoAcc = 0, ingresoK = 0, ultimoGolpe = 0
  const tmpA = new THREE.Color(), tmpB = new THREE.Color(), WHITE = new THREE.Color(0xdfe8ff), GOLD = new THREE.Color(0xffc861)
  const vTmp = new THREE.Vector3(), sTmp = new THREE.Vector3()
  const dummy = new THREE.Object3D()
  const timers = new Set<number>()
  const despues = (ms: number, fn: () => void) => { const id = window.setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id) }
  apples.forEach(a => { a.grow = est.manzanasArbol ? 1 : 0 })
  const golpe = () => { if (t - ultimoGolpe > 0.07) { ultimoGolpe = t; op.sonidos.golpe() } }

  function strike() {
    flash = reduce ? 0.3 : 1; despues(130, () => { flash = Math.max(flash, reduce ? 0.2 : 0.7) })
    rayos.golpe()
    const dl = 0.35 + Math.random() * 0.9; op.sonidos.trueno(dl); despues(dl * 1000, () => { shakeAmp = Math.max(shakeAmp, 0.25) })
  }

  /* ---------- sacudir ---------- */
  function sueltaHojas(n: number, petalos: boolean) {
    let tries = 0, done = 0
    while (done < n && tries < 90) {
      tries++
      const L = leaves[Math.floor(Math.random() * leaves.length)]
      if (L.s * L.branch.vis < 0.35) continue
      L.g.getWorldPosition(vTmp); const k = L.r * root.scale.x * L.s
      efectos.spawnLeaf(vTmp.x + (Math.random() - .5) * k, vTmp.y + (Math.random() - .5) * k * .6, vTmp.z + (Math.random() - .5) * k, petalos && Math.random() < .25); done++
    }
  }
  function shake(strength: number, fuerte: boolean) {
    shakeAmp = Math.min(1.6, shakeAmp + strength)
    root.updateMatrixWorld(true)
    /* la semilla todavía no tiene hojas: ni hojas que caigan ni sonido de hojas */
    if (sView < 1.2) return
    op.sonidos.hojas()
    sueltaHojas(Math.floor(4 + strength * 7 * Math.min(1, treeS * 1.5)), Gd > 8.4)
    /* la sacudida del día tumba todas las manzanas; vuelven al día siguiente */
    if (fuerte && Gd > 7.6) {
      for (const a of apples) {
        if (a.grow < 0.95) continue
        a.mesh.getWorldPosition(vTmp); a.mesh.getWorldScale(sTmp); efectos.spawnApple(vTmp.x, vTmp.y, vTmp.z, sTmp.x); a.grow = 0
      }
    }
  }

  /* ---------- cámara y toques ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const camara = crearCamara(canvas, camera, (cx, cy) => {
    const rc = canvas.getBoundingClientRect(); ndc.set(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(ndc, camera)
    const fruto = efectos.tocarFruto(ray)
    if (fruto) { op.alCosechar(fruto.indice, fruto.dorado, cx, cy); return }
    if (weather !== "clear" && ray.intersectObjects(cloudHit, false).length) { clouds.forEach(c => { c.userData.bump = 1 }); op.alTocarNubes(); return }
    const hormiga = hormigas.tocarHormiga(ray)
    if (hormiga !== undefined) { op.alTocarHormiga(hormiga); return }
    if (hormigas.tocarHormiguero(ray)) { op.sonidos.pop(); return }
    const blancos = Gd < 3.8 ? [...arbol.hitMeshes, toqueFacil] : arbol.hitMeshes
    if (ray.intersectObjects(blancos, false).length) { shake(1, false); op.alTocarArbol() }
  })

  function resize() {
    const p = canvas.parentElement; if (!p) return
    const w = Math.max(1, p.clientWidth), h = Math.max(1, p.clientHeight)
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize); if (canvas.parentElement) ro.observe(canvas.parentElement); resize()

  function targetS() {
    const L = est.vistaPrevia ?? est.nivel
    const p = est.vistaPrevia && est.vistaPrevia !== est.nivel ? 0.55 : (L >= 6 ? 0.9 : clamp(est.progreso))
    return clamp((L - 1) + p, 0, 6)
  }

  /* ---------- bucle ---------- */
  let last = performance.now(), raf = 0, enVista = true, vivo = true
  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt

    /* clima */
    const w = climaWX()
    if (w !== weather) { if (w === "storm") nextBolt = 1.4; weather = w }
    const W = WX[weather], k = 1 - Math.exp(-dt * (instant ? 40 : 1.5))
    cur.top.lerp(W.cTop, k); cur.bottom.lerp(W.cBot, k); cur.cloud.lerp(W.cCloud, k); cur.sunCol.lerp(W.cSun, k)
    cur.sun = lerp(cur.sun, W.sun, k); cur.hemi = lerp(cur.hemi, W.hemi, k); cur.wind = lerp(cur.wind, W.wind, k)
    cur.rain = lerp(cur.rain, W.rain, k); cur.glow = lerp(cur.glow, W.glow, k); cur.cover = lerp(cur.cover, W.cover, k)
    const gust = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.91 + 2)
    windS = cur.wind * (0.72 + 0.5 * gust)
    if (weather === "storm") { nextBolt -= dt; if (nextBolt <= 0) { strike(); nextBolt = 5 + Math.random() * 4 } }
    flash = Math.max(0, flash - dt * 3.4)
    rayos.tick(dt, t)
    ingresoK = lerp(ingresoK, est.ingreso ? 1 : 0, 1 - Math.exp(-dt * 2))
    tmpA.copy(cur.top).lerp(WHITE, flash * 0.5); tmpB.copy(cur.bottom).lerp(WHITE, flash * 0.55)
    skyU.top.value.copy(tmpA); skyU.bottom.value.copy(tmpB); (scene.fog as THREE.Fog).color.copy(tmpB)
    hemi.intensity = cur.hemi + flash * 1.3 + ingresoK * 0.12; sun.intensity = cur.sun + flash * 0.35 + ingresoK * 0.45; sun.color.copy(cur.sunCol).lerp(GOLD, ingresoK * 0.55)
    sunGlow.material.opacity = Math.max(cur.glow, ingresoK); sunGlow.scale.setScalar(60 * (1 + 0.3 * ingresoK * (1 + 0.08 * Math.sin(t * 2.2))))
    cloudMat.color.copy(cur.cloud); cloudMat.emissive.copy(cur.cloud).multiplyScalar(0.42)

    /* crecimiento suavizado */
    let sT = targetS(); if (intro) { if (t < 1.3) sT = 0.4; else if (Math.abs(sT - sView) < 0.01) intro = false }
    sView += intro ? Math.sign(sT - sView) * Math.min(Math.abs(sT - sView), dt * (0.35 + 0.9 * Math.min(1, Math.abs(sT - sView)))) : (sT - sView) * (1 - Math.exp(-dt * (instant ? 40 : 2.4)))
    if (Math.abs(sT - sView) < 0.0008) sView = sT
    const G = sView >= 1 ? piece(sView, [1, 2, 3, 4, 5, 6], GX) : 0
    Gd = G
    const emerge = smooth((sView - 0.8) / 0.35)
    treeS = piece(G, [0, 1.9, 3.8, 6.2, 10], [.74, .72, .76, .88, 1])
    /* salud baja: hojas cafés y menos copa, sin quedar pelado; se recupera si la salud sube */
    const secoObj = est.salud < 65 ? clamp((65 - est.salud) / 40) : 0
    seco = lerp(seco, secoObj, 1 - Math.exp(-dt * 0.8))
    leafU.uSeco.value = seco
    arbol.applyGrowth(G, seco)
    popV += (-95 * pop - 9 * popV) * dt; pop += popV * dt
    shakeAmp *= Math.exp(-dt * 2.1); if (shakeAmp < 0.002) shakeAmp = 0
    root.visible = emerge > 0.01; root.scale.setScalar(Math.max(0.0001, treeS * emerge * (1 + pop * 0.14)))
    roots.scale.setScalar(Math.max(0.0001, smooth((G - 1.6) / 2.2)))
    root.rotation.z = -(windS * 0.014) + Math.sin(t * 22) * shakeAmp * 0.01; root.rotation.x = Math.cos(t * 19 + 1) * shakeAmp * 0.007
    leafU.uTime.value = t; leafU.uWind.value = windS * motion + shakeAmp * 1.2

    /* semilla: dos mitades que se abren */
    const open = smooth((sView - 0.7) / 0.55), gone = smooth((sView - 1.6) / 0.8)
    seedG.visible = gone < 0.999; seedG.scale.setScalar(Math.max(0.0001, 1.75 * (1 - gone * 0.9)))
    const wob = (sView < 0.9 ? Math.sin(t * (2 + sView * 5)) * 0.02 * smooth((sView - 0.4) / 0.4) : 0) + shakeAmp * Math.sin(t * 30) * 0.06
    halfR.rotation.z = -(0.03 + open * 0.95) + wob; halfL.rotation.z = (0.03 + open * 0.95) - wob; halfR.position.x = open * 0.1; halfL.position.x = -open * 0.1
    /* zona de toque fácil para semilla y brote */
    const alto = treeTop(G) * Math.max(.5, Math.min(1, emerge + .3))
    toqueFacil.scale.setScalar(Math.max(0.8, alto * 0.55)); toqueFacil.position.y = Math.max(0.45, alto * 0.45)

    contact.scale.setScalar(1.5 + treeS * 2.8 * Math.max(emerge, 0.25)); (contact.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.32 * clamp(cur.sun / 1.05)
    /* humedad */
    wet = clamp(wet + ((cur.rain > 0.3 || est.regando) ? 0.35 : -0.025) * dt, 0, 1)
    soilMat.color.copy(soilDry).lerp(soilWet, wet); grassMat.color.copy(grassDry).lerp(grassWet, wet)

    /* ramas */
    const gm = (0.5 + windS * 1.0) * motion
    for (const b of branches) {
      const d = b.depth; if (!b.pivot.visible) continue
      const amp = (0.004 + 0.006 * d) * gm
      const sh = shakeAmp * Math.sin(t * (23 + d) + d * 0.7 + b.phase * .3) * (0.012 + 0.011 * d)
      b.pivot.rotation.x = b.base.x + Math.sin(t * (1.15 + 0.12 * d) + b.phase) * amp + sh
      b.pivot.rotation.z = b.base.z + Math.cos(t * (0.95 + 0.1 * d) + b.phase * 1.3) * amp + sh * 0.6
    }
    for (const L of leaves) {
      if (L.s <= 0.002 || !L.branch.pivot.visible) { L.g.visible = false; L.g.scale.setScalar(0.0001); continue }
      L.g.visible = true; L.g.scale.setScalar(L.s * (1 + shakeAmp * 0.07 * Math.sin(t * 31 + L.seed)))
    }
    /* manzanas: crecen solas mientras hoy no se haya sacudido el árbol */
    for (const a of apples) { if (!est.manzanasArbol) a.grow = 0; else if (a.grow < 1) a.grow = Math.min(1, a.grow + dt / 22) }
    /* árbol seco: de vez en cuando se le cae una hoja café */
    if (seco > 0.15 && G >= 1.9 && !intro) {
      secoAcc += dt; if (secoAcc > 2.6 - 1.4 * seco) { secoAcc = 0; root.updateMatrixWorld(true); sueltaHojas(1 + (Math.random() < seco ? 1 : 0), false) }
    }

    /* jardín según el nivel */
    const Lv = est.vistaPrevia ?? est.nivel, idx = clamp(Lv, 1, 6) - 1
    const nb = Math.min(NB, [0.3, 0.42, 0.58, 0.74, 0.88, 1][idx] * NB | 0), nf = Math.min(NF, [0, 6, 14, 24, 40, 60][idx])
    blades.count = nb; stems.count = nf; flowerSp.count = nf
    const lean = windS * 0.06
    for (let i = 0; i < nb; i++) {
      const b = bd[i]; dummy.position.set(b.x, b.y || 0, b.z)
      dummy.rotation.set(Math.cos(t * 1.3 + b.ph) * 0.06 * windS * motion, b.yaw, -(lean * 1.5 + Math.sin(t * (1.6 + b.f) + b.ph) * 0.08 * (0.4 + windS) * motion), "ZXY")
      dummy.scale.set(b.w || 1, b.h * (1 - 0.15 * wet), b.w || 1); dummy.updateMatrix(); blades.setMatrixAt(i, dummy.matrix)
    }
    blades.instanceMatrix.needsUpdate = true
    for (const f of flies) {
      const u = f.userData, on = Lv === 6 && weather !== "storm" && cur.rain < 0.7; f.visible = on; if (!on) continue
      const fp = (tt: number) => { const a = tt * 0.5 * u.sp + u.ph; return [Math.cos(a) * u.R, u.h + Math.sin(tt * 1.3 + u.ph) * 0.4 + Math.sin(a * 2) * 0.3, Math.sin(a * 1.3) * u.R * 0.8] }
      const lift = u.low ? 0 : treeTop(G) * 0.25, dip = -1.4 * smooth((Math.sin(t * 0.27 + u.ph * 1.7) - 0.55) / 0.45)
      const p = fp(t), q2 = fp(t + 0.06); f.position.set(p[0], Math.max(0.55 + Hgt(p[0], p[2]), p[1] + lift + dip), p[2])
      f.rotation.set(0, Math.atan2(q2[0] - p[0], q2[2] - p[2]), (q2[1] - p[1]) * -2)
      const fl = 0.2 + 0.95 * Math.sin(t * 22 + u.ph); u.wr.rotation.z = fl; u.wl.rotation.z = -fl
    }

    /* nubes */
    const baseY = Math.max(3.2, treeTop(G) * Math.max(.55, Math.min(1, emerge + .4))) + 0.6
    clouds.forEach((c, i) => {
      const u = c.userData, cv = cur.cover
      c.position.x = lerp(u.clearX, u.stormX, cv) + Math.sin(t * u.sp + u.ph) * (0.5 + windS * 0.4)
      c.position.z = lerp(u.clearZ, u.stormZ, cv)
      c.position.y = baseY + lerp(u.clearY, u.stormY, cv) + Math.sin(t * 0.6 + u.ph) * 0.12
      u.bump = Math.max(0, u.bump - dt * 1.6)
      c.scale.setScalar(lerp(0.75, 0.8, cv) * u.sc * (1 + u.bump * 0.18 * Math.sin(u.bump * 14)))
      c.visible = cv > 0.03 || i < 2
    })

    lluvia.tick(dt, cur.rain, windS, baseY + 0.4)
    efectos.tick({ dt, t, windS, holding: est.regando, ingreso: est.ingreso, altura: treeTop(G) * 0.8 + 0.6, golpe, alRegar: () => op.sonidos.riego() })

    sprouts.visible = Lv >= 3
    fallU.uTime.value = t; { const ms = 1 + 0.06 * Math.sin(t * 2.3); mist.scale.set(2.6 * ms, 1.2 * ms, 1) }
    hormigas.tick(dt); waterTex.offset.y -= dt * 0.08; waterTex.offset.x += dt * 0.01
    oceanU.uTime.value = t; oceanU.uBright.value = 0.55 + 0.45 * clamp(cur.sun / 1.05) + flash * 0.3
    for (const fc of farClouds) { fc.material.color.copy(cur.cloud); fc.material.opacity = 0.95 * (1 - cur.cover * 0.5) }

    /* cámara: encuadra el árbol según su tamaño */
    camara.encuadrar(dt, alto + 0.4, intro, instant)

    audAcc += dt; if (audAcc > 0.25) { audAcc = 0; op.sonidos.lluvia(cur.rain) }
    instant = false
    renderer.render(scene, camera)
  }

  /* el bucle se pausa fuera de pantalla o con la pestaña oculta */
  function reanudar() { if (!vivo || raf || !enVista || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(frame) }
  function pausar() { if (raf) { cancelAnimationFrame(raf); raf = 0 } op.sonidos.lluvia(0) }
  const io = new IntersectionObserver(e => { enVista = e[0]?.isIntersecting ?? true; if (enVista) reanudar(); else pausar() })
  io.observe(canvas)
  const vis = () => { if (document.hidden) pausar(); else reanudar() }
  document.addEventListener("visibilitychange", vis)
  reanudar()

  return {
    actualizar(e) {
      if (e.vistaPrevia !== undefined && e.vistaPrevia !== est.vistaPrevia) { efectos.clearFalls(); intro = false }
      Object.assign(est, e)
    },
    sacudir(fuerte) { shake(fuerte ? 1.6 : 1, fuerte) },
    gastoHormiga(lista) { hormigas.gastoHormiga(lista) },
    rayo() { strike() },
    subirNivel() { popV = 4; efectos.burstSparks(Math.max(treeS, .3)) },
    ponerFrutos(frutos) { efectos.ponerFrutos(frutos) },
    destruir() {
      vivo = false; pausar(); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", vis)
      timers.forEach(id => window.clearTimeout(id)); timers.clear()
      camara.destruir(); rayos.quitar()
      const texturas = new Set<THREE.Texture>()
      scene.traverse(o => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
        for (const mat of mats) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) texturas.add(v)
          mat.dispose()
        }
      })
      texturas.forEach(tx => tx.dispose())
      renderer.dispose(); renderer.forceContextLoss()
    },
  }
}
