import * as THREE from "three"
import { WATER_Y } from "./terreno"
import { glowTex, lienzo, rng } from "./utilidades"

/** Renderer, cámara, cielo, luces, océano y nubes lejanas. */
export function crearEscena(canvas: HTMLCanvasElement, mobile: boolean) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2))
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(new THREE.Color("#bcd9dc"), 26, 80)
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300)

  const skyU = { top: { value: new THREE.Color("#3a86b8") }, bottom: { value: new THREE.Color("#cfe6e4") } }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 14), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false,
    vertexShader: "varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "uniform vec3 top;uniform vec3 bottom;varying float h;void main(){float k=smoothstep(-0.02,0.38,h);gl_FragColor=vec4(mix(bottom,top,k),1.0);}",
  }))
  scene.add(sky)
  const sunDir = new THREE.Vector3(0.5, 0.62, 0.6).normalize()
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,240,200,1)", "rgba(255,240,200,0)"), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }))
  sunGlow.scale.set(60, 60, 1); sunGlow.position.copy(sunDir).multiplyScalar(100); scene.add(sunGlow)

  const hemi = new THREE.HemisphereLight(0xdcecf2, 0x56482f, 0.62); scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff0d2, 1.05)
  sun.position.copy(sunDir).multiplyScalar(22); sun.castShadow = true
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048)
  const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 11; sc.bottom = -5; sc.near = 4; sc.far = 50
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035
  scene.add(sun); scene.add(sun.target)
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0.28); rim.position.set(-8, 6, -10); scene.add(rim)

  const world = new THREE.Group(); scene.add(world)

  /* océano tranquilo alrededor de la isla, se funde con el horizonte */
  const oceanU = { uTime: { value: 0 }, uSky: skyU.bottom, uBright: { value: 1 }, uSun: { value: sunDir.clone() } }
  const ocean = new THREE.Mesh(new THREE.CircleGeometry(200, 96), new THREE.ShaderMaterial({
    uniforms: oceanU, depthWrite: true,
    vertexShader: "varying vec3 wp;void main(){vec4 w=modelMatrix*vec4(position,1.0);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
    fragmentShader: [
      "uniform float uTime;uniform vec3 uSky;uniform float uBright;uniform vec3 uSun;varying vec3 wp;",
      "void main(){vec2 p=wp.xz;float t=uTime;",
      " vec3 nr=normalize(vec3(0.05*cos(p.x*0.9+t*0.8)+0.035*cos((p.x+p.y)*0.55+t*0.5)+0.02*cos(p.x*2.3-p.y*1.7+t*1.3),1.0,0.05*cos(p.y*1.1-t*0.6)+0.03*cos((p.x-p.y)*0.8-t*0.7)+0.02*cos(p.y*2.1+p.x*1.4-t*1.1)));",
      " vec3 V=normalize(cameraPosition-wp);float fr=pow(1.0-max(dot(nr,V),0.0),4.0);",
      " float d=length(p-vec2(0.2,-0.1));",
      " vec3 shallow=vec3(0.42,0.82,0.83),deep=vec3(0.13,0.53,0.66);",
      " vec3 col=mix(shallow,deep,smoothstep(5.0,38.0,d));",
      " col=mix(col,uSky,clamp(fr*0.8,0.0,0.8));",
      " vec3 H=normalize(normalize(uSun)+V);float sp=pow(max(dot(nr,H),0.0),220.0);",
      " col+=vec3(1.0,0.97,0.9)*sp*0.8*uBright;",
      " col*=mix(0.74,1.0,smoothstep(1.5,6.2,d));col*=uBright;",
      " float dist=length(cameraPosition-wp);col=mix(col,uSky,smoothstep(45.0,175.0,dist));",
      " gl_FragColor=vec4(col,1.0);}"].join("\n"),
  }))
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = WATER_Y; ocean.renderOrder = -1; scene.add(ocean)

  /* nubes suaves en el fondo */
  const puffTex = (() => {
    const { c, g } = lienzo(256, 128), r = rng(55)
    for (let i = 0; i < 26; i++) {
      const x = 40 + r() * 176, y = 60 + r() * 30 - Math.abs(x - 128) * 0.12, rad = 18 + r() * 30, gr = g.createRadialGradient(x, y, 0, x, y, rad)
      gr.addColorStop(0, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    return new THREE.CanvasTexture(c)
  })()
  const farClouds: THREE.Sprite[] = []
  for (const q of [[-0.9, 62, 18, 34], [0.35, 80, 26, 44], [1.6, 70, 14, 30], [2.6, 90, 30, 52], [-2.2, 85, 22, 40], [3.6, 75, 12, 28]]) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, fog: false, opacity: 0.95, toneMapped: false }))
    m.position.set(Math.sin(q[0]) * q[1], q[2], -Math.abs(Math.cos(q[0])) * q[1] * 0.6 - q[1] * 0.4); m.scale.set(q[3], q[3] * 0.5, 1); m.renderOrder = -2
    scene.add(m); farClouds.push(m)
  }

  return { renderer, scene, camera, world, skyU, sunDir, sunGlow, hemi, sun, oceanU, puffTex, farClouds }
}

export type Escena = ReturnType<typeof crearEscena>
