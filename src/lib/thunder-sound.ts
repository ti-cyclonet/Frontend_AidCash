/**
 * Trueno sintetizado con Web Audio (sin archivos): un chasquido corto de ruido
 * blanco + un retumbo de ruido "café" filtrado que se apaga despacio. Si el
 * navegador bloquea el audio (sin interacción previa), simplemente no suena.
 */
let ctx: AudioContext | null = null

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx ??= new AC()
  if (ctx.state === "suspended") ctx.resume().catch(() => {})
  return ctx
}

/** Desbloquea el audio con el primer toque del usuario (políticas de autoplay). */
export function prepararAudio() {
  contexto()
}

export function tocarTrueno(intensidad = 1) {
  const ac = contexto()
  if (!ac || ac.state !== "running") return
  try {
    const t = ac.currentTime
    const dur = 2.8
    const sr = ac.sampleRate

    // Retumbo: ruido café (browniano) con paso bajo que se va cerrando
    const buf = ac.createBuffer(1, Math.floor(sr * dur), sr)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    const rumble = ac.createBufferSource()
    rumble.buffer = buf
    const lp = ac.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.setValueAtTime(700, t)
    lp.frequency.exponentialRampToValueAtTime(90, t + dur)
    const g = ac.createGain()
    const pico = 0.9 * intensidad
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(pico, t + 0.06)
    g.gain.exponentialRampToValueAtTime(pico * 0.45, t + 0.5)
    g.gain.linearRampToValueAtTime(pico * 0.7, t + 1.0)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    rumble.connect(lp).connect(g).connect(ac.destination)
    rumble.start(t)
    rumble.stop(t + dur)

    // Chasquido inicial
    const crackBuf = ac.createBuffer(1, Math.floor(sr * 0.25), sr)
    const cd = crackBuf.getChannelData(0)
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / cd.length)
    const crack = ac.createBufferSource()
    crack.buffer = crackBuf
    const hp = ac.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.value = 1200
    const cg = ac.createGain()
    cg.gain.setValueAtTime(0.35 * intensidad, t)
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    crack.connect(hp).connect(cg).connect(ac.destination)
    crack.start(t)
  } catch {
    // Audio no disponible — la tormenta sigue siendo visual
  }
}

// ─── Sonidos del minijuego del árbol ─────────────────────────────────────────
// Tonos cortos sintetizados: notas que suben (se siente como "ganar"), sin archivos.

function notas(frecuencias: number[], { paso = 0.07, dur = 0.16, tipo = "sine" as OscillatorType, volumen = 0.18 } = {}) {
  const ac = contexto()
  if (!ac || ac.state !== "running") return
  try {
    const t0 = ac.currentTime
    frecuencias.forEach((f, i) => {
      const t = t0 + i * paso
      const osc = ac.createOscillator()
      const g = ac.createGain()
      osc.type = tipo
      osc.frequency.setValueAtTime(f, t)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(volumen, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.connect(g).connect(ac.destination)
      osc.start(t)
      osc.stop(t + dur + 0.02)
    })
  } catch {
    // sin audio: el juego sigue siendo visual
  }
}

/** Cosechar un fruto ("pop" + campanita; el dorado suena más brillante). */
export function tocarCosecha(dorado = false) {
  notas(dorado ? [880, 1175, 1568, 2093] : [660, 990], { paso: 0.06, dur: dorado ? 0.22 : 0.14, tipo: "triangle" })
}

/** Toque del árbol: más agudo mientras más largo el combo. */
export function tocarToque(combo: number) {
  notas([330 + Math.min(combo, 12) * 45], { dur: 0.08, tipo: "sine", volumen: 0.1 })
}

/** Premio de la sacudida o subir de nivel: arpegio de fanfarria. */
export function tocarPremio() {
  notas([523, 659, 784, 1047, 1319], { paso: 0.08, dur: 0.28, tipo: "triangle", volumen: 0.2 })
}

/** Riego: gotitas. */
export function tocarRiego() {
  notas([1400, 1100, 1250, 950], { paso: 0.09, dur: 0.09, tipo: "sine", volumen: 0.08 })
}
