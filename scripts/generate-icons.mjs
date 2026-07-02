import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ICONS_DIR = resolve(__dirname, '../public/icons')
const SVG_SOURCE = resolve(ICONS_DIR, 'icon-512x512.svg')

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

async function generate() {
  const svgBuffer = readFileSync(SVG_SOURCE)

  for (const size of SIZES) {
    const outputPath = resolve(ICONS_DIR, `icon-${size}x${size}.png`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)
    console.log(`✅ Generated: icon-${size}x${size}.png`)
  }

  // Apple touch icon (180x180)
  const applePath = resolve(ICONS_DIR, 'apple-touch-icon.png')
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(applePath)
  console.log('✅ Generated: apple-touch-icon.png')

  // Favicon 32x32
  const faviconPath = resolve(ICONS_DIR, 'favicon-32x32.png')
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(faviconPath)
  console.log('✅ Generated: favicon-32x32.png')

  // Favicon 16x16
  const favicon16Path = resolve(ICONS_DIR, 'favicon-16x16.png')
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile(favicon16Path)
  console.log('✅ Generated: favicon-16x16.png')

  console.log('\n🎉 All icons generated successfully!')
}

generate().catch(console.error)
