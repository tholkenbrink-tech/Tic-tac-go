/**
 * Generates the PWA icon PNGs with zero image dependencies: pixels are drawn
 * with plain math and encoded as PNG using node's zlib.
 *
 * Run: npm run icons  (outputs into public/)
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(rootDir, 'public')
mkdirSync(outDir, { recursive: true })

// ---- minimal PNG encoder -------------------------------------------------

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0 // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- drawing helpers -------------------------------------------------------

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = clamp01(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

/**
 * Draws the icon into an RGBA buffer. `inset` shrinks the glyphs toward the
 * center (used for the maskable icon's safe zone).
 */
function drawIcon(size, inset) {
  const rgba = Buffer.alloc(size * size * 4)
  const s = (v) => v * size // unit -> px
  const cx1 = 0.335 + inset * 0.05
  const cy1 = cx1
  const cx2 = 0.665 - inset * 0.05
  const cy2 = cx2
  const arm = s(0.135 * (1 - inset))
  const strokeX = s(0.062 * (1 - inset * 0.4))
  const ringR = s(0.145 * (1 - inset))
  const strokeO = s(0.06 * (1 - inset * 0.4))
  const aa = Math.max(1, size / 256)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Background: subtle vertical navy gradient.
      const g = y / size
      let r = 11 + g * 6
      let gr = 18 + g * 8
      let b = 32 + g * 14

      // Faint grid strokes to hint at the board.
      const gx = Math.min(
        Math.abs(x - s(1 / 3) - s(0.083)),
        Math.abs(x - s(2 / 3) + s(0.083)),
      )
      const gy = Math.min(
        Math.abs(y - s(1 / 3) - s(0.083)),
        Math.abs(y - s(2 / 3) + s(0.083)),
      )
      const grid = Math.max(smooth(s(0.012), 0, gx), smooth(s(0.012), 0, gy)) * 0.35
      r += grid * 40
      gr += grid * 56
      b += grid * 82

      // X glyph (cyan), top-left.
      const dX = Math.min(
        segmentDistance(x, y, s(cx1) - arm, s(cy1) - arm, s(cx1) + arm, s(cy1) + arm),
        segmentDistance(x, y, s(cx1) + arm, s(cy1) - arm, s(cx1) - arm, s(cy1) + arm),
      )
      const xA = smooth(strokeX + aa, strokeX - aa, dX)
      // Glow
      const xGlow = smooth(strokeX * 3.2, strokeX, dX) * 0.35

      // O glyph (coral ring), bottom-right.
      const dO = Math.abs(Math.hypot(x - s(cx2), y - s(cy2)) - ringR)
      const oA = smooth(strokeO + aa, strokeO - aa, dO)
      const oGlow = smooth(strokeO * 3.2, strokeO, dO) * 0.35

      r = r * (1 - xGlow) + 34 * xGlow
      gr = gr * (1 - xGlow) + 211 * xGlow
      b = b * (1 - xGlow) + 238 * xGlow
      r = r * (1 - oGlow) + 251 * oGlow
      gr = gr * (1 - oGlow) + 146 * oGlow
      b = b * (1 - oGlow) + 60 * oGlow

      r = r * (1 - xA) + 34 * xA
      gr = gr * (1 - xA) + 211 * xA
      b = b * (1 - xA) + 238 * xA
      r = r * (1 - oA) + 251 * oA
      gr = gr * (1 - oA) + 146 * oA
      b = b * (1 - oA) + 60 * oA

      const i = (y * size + x) * 4
      rgba[i] = Math.round(clamp01(r / 255) * 255)
      rgba[i + 1] = Math.round(clamp01(gr / 255) * 255)
      rgba[i + 2] = Math.round(clamp01(b / 255) * 255)
      rgba[i + 3] = 255
    }
  }
  return rgba
}

/** Splash screen: calm navy gradient with the two glyphs centered. */
function drawSplash(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const s = (v) => v * size
  const glyphR = s(0.045)
  const stroke = s(0.02)
  const cy = 0.5
  const cxX = 0.44
  const cxO = 0.56
  const aa = Math.max(1, size / 512)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const g = y / size
      let r = 10 + g * 5
      let gr = 17 + g * 7
      let b = 30 + g * 12

      const dX = Math.min(
        segmentDistance(x, y, s(cxX) - glyphR, s(cy) - glyphR, s(cxX) + glyphR, s(cy) + glyphR),
        segmentDistance(x, y, s(cxX) + glyphR, s(cy) - glyphR, s(cxX) - glyphR, s(cy) + glyphR),
      )
      const xA = smooth(stroke + aa, stroke - aa, dX)
      const dO = Math.abs(Math.hypot(x - s(cxO), y - s(cy)) - glyphR)
      const oA = smooth(stroke + aa, stroke - aa, dO)

      r = r * (1 - xA) + 34 * xA
      gr = gr * (1 - xA) + 211 * xA
      b = b * (1 - xA) + 238 * xA
      r = r * (1 - oA) + 251 * oA
      gr = gr * (1 - oA) + 146 * oA
      b = b * (1 - oA) + 60 * oA

      const i = (y * size + x) * 4
      rgba[i] = Math.round(clamp01(r / 255) * 255)
      rgba[i + 1] = Math.round(clamp01(gr / 255) * 255)
      rgba[i + 2] = Math.round(clamp01(b / 255) * 255)
      rgba[i + 3] = 255
    }
  }
  return rgba
}

const targets = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.28],
  ['apple-touch-icon.png', 180, 0],
]

for (const [name, size, inset] of targets) {
  writeFileSync(join(outDir, name), encodePng(size, size, drawIcon(size, inset)))
  console.log(`wrote public/${name}`)
}

// iOS asset catalog (only when the Capacitor iOS platform exists).
const iosAssets = join(rootDir, 'ios', 'App', 'App', 'Assets.xcassets')
if (existsSync(iosAssets)) {
  const appIcon = join(iosAssets, 'AppIcon.appiconset', 'AppIcon-512@2x.png')
  writeFileSync(appIcon, encodePng(1024, 1024, drawIcon(1024, 0)))
  console.log('wrote ios AppIcon (1024x1024)')

  const splash = encodePng(2732, 2732, drawSplash(2732))
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    writeFileSync(join(iosAssets, 'Splash.imageset', name), splash)
    console.log(`wrote ios ${name}`)
  }
}
