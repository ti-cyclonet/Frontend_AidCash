/**
 * Íconos y pantallas de inicio de la app nativa (Play Store / App Store), a partir
 * del mismo logo de la PWA. Deja los originales en nativo/assets y después
 * @capacitor/assets genera todos los tamaños dentro de android/ e ios/:
 *
 *   node scripts/generar-assets-nativos.mjs
 *   npx @capacitor/assets generate --assetPath nativo/assets --android --ios
 */
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destino = resolve(raiz, 'nativo/assets')
mkdirSync(destino, { recursive: true })

const VERDE = '#1B4332', VERDE2 = '#2D6A4F', HOJA = '#D8F3DC'
/* el brote del logo, en un cuadro de 512 (igual que public/icons/icon-512x512.svg) */
const brote = `<g stroke="${HOJA}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="translate(150, 130)">
    <line x1="0" y1="230" x2="212" y2="230"/>
    <path d="M106 230 C106 188 106 158 106 120"/>
    <path d="M106 152 C85 133 53 125 53 100 C53 76 75 68 96 78 C106 83 106 98 106 120"/>
    <path d="M106 120 C127 101 159 96 159 71 C159 47 137 40 116 52 C106 57 106 72 106 94"/>
  </g>`
const svg = (cuerpo, fondo = true) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${fondo ? `<rect width="512" height="512" fill="${VERDE}"/>` : ''}${cuerpo}</svg>`)

/* App Store exige un cuadrado sin transparencia (el sistema redondea las esquinas) */
await sharp(svg(`<rect x="86" y="86" width="340" height="340" rx="85" fill="${VERDE2}"/>${brote}`)).resize(1024, 1024).flatten({ background: VERDE }).png().toFile(resolve(destino, 'icon-only.png'))
/* Android adaptable: primer plano (con margen de zona segura) y fondo liso */
await sharp(svg(`<g transform="translate(76.8,76.8) scale(0.7)"><rect x="86" y="86" width="340" height="340" rx="85" fill="${VERDE2}"/>${brote}</g>`, false)).resize(1024, 1024).png().toFile(resolve(destino, 'icon-foreground.png'))
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: VERDE } }).png().toFile(resolve(destino, 'icon-background.png'))
/* pantalla de inicio: logo centrado sobre el verde de Kiri */
const logo = await sharp(svg(`<rect x="86" y="86" width="340" height="340" rx="85" fill="${VERDE2}"/>${brote}`, false)).resize(620, 620).png().toBuffer()
for (const nombre of ['splash.png', 'splash-dark.png']) {
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: VERDE } }).composite([{ input: logo, gravity: 'center' }]).png().toFile(resolve(destino, nombre))
}
console.log('Listo: nativo/assets (icon-only, icon-foreground, icon-background, splash, splash-dark)')
