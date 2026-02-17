import JSZip from 'jszip'
import type { CompactSkin, WinampSprites, PleditColors } from './types'
import { buildCompactSkin } from './compact-builder'

// Track active blob URLs so we can revoke them when loading a new skin
let activeBlobUrls: string[] = []

function revokeActiveBlobUrls(): void {
  for (const url of activeBlobUrls) {
    URL.revokeObjectURL(url)
  }
  activeBlobUrls = []
}

/** Case-insensitive file lookup in a JSZip instance */
function findFile(zip: JSZip, name: string): JSZip.JSZipObject | null {
  const lower = name.toLowerCase()
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry.dir && path.toLowerCase() === lower) return entry
    // Also match without directory prefix (some skins nest files)
    const basename = path.split('/').pop()?.toLowerCase()
    if (basename === lower) return entry
  }
  return null
}

/** Convert raw image data to a blob URL */
function imageToBlobUrl(data: ArrayBuffer, ext: string): string {
  const mime = ext === '.png' ? 'image/png' : 'image/bmp'
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  activeBlobUrls.push(url)
  return url
}

/** Load a blob URL as an HTMLImageElement */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

/** Sample average RGB from a region of an image */
function sampleRegion(
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): [number, number, number] {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const imageData = ctx.getImageData(x, y, Math.min(w, img.width - x), Math.min(h, img.height - y))
  const pixels = imageData.data
  let rSum = 0, gSum = 0, bSum = 0
  const count = pixels.length / 4

  for (let i = 0; i < pixels.length; i += 4) {
    rSum += pixels[i]
    gSum += pixels[i + 1]
    bSum += pixels[i + 2]
  }

  return [
    Math.round(rSum / count),
    Math.round(gSum / count),
    Math.round(bSum / count),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
}

/** Relative luminance (WCAG formula) — 0 = black, 1 = white */
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** Contrast ratio between two colors (1:1 = identical, 21:1 = max) */
function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = luminance(...rgb1)
  const l2 = luminance(...rgb2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Ensure a foreground color is visible against a background. Returns adjusted RGB. */
function ensureContrast(
  fg: [number, number, number],
  bg: [number, number, number],
  minRatio = 3
): [number, number, number] {
  if (contrastRatio(fg, bg) >= minRatio) return fg
  // Determine whether to lighten or darken based on background luminance
  const bgLum = luminance(...bg)
  if (bgLum > 0.5) {
    // Dark foreground on light background — not typical, but handle it
    return [
      Math.max(0, fg[0] - 100),
      Math.max(0, fg[1] - 100),
      Math.max(0, fg[2] - 100),
    ]
  }
  // Light foreground on dark background — brighten until visible
  const boost = [fg[0], fg[1], fg[2]] as [number, number, number]
  for (let i = 0; i < 10; i++) {
    if (contrastRatio(boost, bg) >= minRatio) break
    boost[0] = Math.min(255, boost[0] + 30)
    boost[1] = Math.min(255, boost[1] + 30)
    boost[2] = Math.min(255, boost[2] + 30)
  }
  return boost
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

/** Parse VISCOLOR.TXT — 24 lines of "R,G,B // comment" */
function parseViscolor(text: string): [number, number, number][] {
  const colors: [number, number, number][] = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const cleaned = line.split('//')[0].trim()
    if (!cleaned) continue
    const parts = cleaned.split(',').map((s) => parseInt(s.trim(), 10))
    if (parts.length >= 3 && parts.every((n) => !isNaN(n))) {
      colors.push([parts[0], parts[1], parts[2]])
    }
  }
  return colors
}

/** Parse PLEDIT.TXT — INI-style file with [Text] section containing color values */
function parsePledit(text: string): PleditColors {
  const colors: PleditColors = {
    normal: '#00FF00',
    current: '#FFFFFF',
    normBg: '#000000',
    selectBg: '#0000FF',
  }
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(/^(\w+)=#?([0-9A-Fa-f]{6})/)
    if (!match) continue
    const [, key, hex] = match
    const color = `#${hex}`
    switch (key.toLowerCase()) {
      case 'normal': colors.normal = color; break
      case 'current': colors.current = color; break
      case 'normbg': colors.normBg = color; break
      case 'selectedbg': colors.selectBg = color; break
    }
  }
  return colors
}

/** Try to extract an image file, checking for both BMP and PNG variants */
async function extractImage(
  zip: JSZip,
  baseName: string
): Promise<{ url: string; img: HTMLImageElement } | null> {
  // Try the exact name first, then alternate extension
  const bmpFile = findFile(zip, baseName + '.bmp')
  const pngFile = findFile(zip, baseName + '.png')
  const file = bmpFile || pngFile
  if (!file) return null

  const ext = pngFile && !bmpFile ? '.png' : '.bmp'
  const data = await file.async('arraybuffer')
  const url = imageToBlobUrl(data, ext)
  const img = await loadImage(url)
  return { url, img }
}

/** Replace magenta (#FF00FF) pixels with transparent and return a PNG data URL */
function processTransparency(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 255) {
      pixels[i + 3] = 0
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Extract a sprite sheet as a PNG data URL with magenta transparency */
async function extractSpriteDataUrl(zip: JSZip, baseName: string): Promise<string | undefined> {
  const result = await extractImage(zip, baseName)
  if (!result) return undefined
  return processTransparency(result.img)
}

/**
 * Import a Winamp .wsz skin and produce a CompactSkin.
 * Only MAIN.BMP is required — all other files are optional.
 */
export async function importWszSkin(buffer: ArrayBuffer): Promise<CompactSkin> {
  // Revoke any previous blob URLs
  revokeActiveBlobUrls()

  const zip = await JSZip.loadAsync(buffer)

  // --- Extract MAIN.BMP (required) ---
  const main = await extractImage(zip, 'main')
  if (!main) {
    throw new Error('Skin does not contain MAIN.BMP — not a valid Winamp skin')
  }

  // Sample colors from the main background image (275x116 standard Winamp size)
  const shellRgb = sampleRegion(main.img, 0, 0, main.img.width, main.img.height)
  const shellHex = rgbToHex(...shellRgb)

  // LCD region is roughly y:24-60 in the standard 275x116 layout
  const lcdY = Math.round(main.img.height * 0.2)
  const lcdH = Math.round(main.img.height * 0.31)
  const displayRgb = sampleRegion(main.img, 10, lcdY, main.img.width - 20, lcdH)
  const displayHex = rgbToHex(...displayRgb)

  // --- Extract TITLEBAR.BMP (optional) ---
  const titlebar = await extractImage(zip, 'titlebar')

  // --- Parse VISCOLOR.TXT (optional) ---
  let spectrumRgb: [number, number, number] = [...shellRgb] as [number, number, number]
  let accentRgb: [number, number, number] = [...shellRgb] as [number, number, number]
  const viscolorFile = findFile(zip, 'viscolor.txt')
  if (viscolorFile) {
    const visText = await viscolorFile.async('string')
    const visColors = parseViscolor(visText)
    if (visColors.length > 2) {
      // Lines 2-17 are spectrum bar colors, peak (bright) to base (dim).
      // Pick the peak color (line 2, index 1) for maximum visibility.
      spectrumRgb = visColors[1]
      // Line 23 (index 22) or last available is the oscilloscope peak/accent
      const peakIdx = Math.min(22, visColors.length - 1)
      accentRgb = visColors[peakIdx]
    } else if (visColors.length > 0) {
      spectrumRgb = visColors[0]
      accentRgb = visColors[visColors.length - 1]
    }
  } else {
    // No viscolor: brighten the shell color for spectrum visibility
    spectrumRgb = [
      Math.min(255, shellRgb[0] + 80),
      Math.min(255, shellRgb[1] + 80),
      Math.min(255, shellRgb[2] + 80),
    ]
    accentRgb = [...spectrumRgb] as [number, number, number]
  }

  // Ensure spectrum bar color is visible against the display background
  spectrumRgb = ensureContrast(spectrumRgb, displayRgb, 3)
  accentRgb = ensureContrast(accentRgb, displayRgb, 2.5)

  const spectrumHex = rgbToHex(...spectrumRgb)
  const accentHex = rgbToHex(...accentRgb)

  // --- Build CompactSkin via the existing factory ---
  const skin = buildCompactSkin({
    shell: shellHex,
    display: displayHex,
    text: spectrumHex,
    accent: accentHex,
    style: 'beveled',
    spectrum: 'bars',
    shellBackground: `url(${main.url}) center/cover no-repeat`,
    displayBackground: `linear-gradient(180deg, ${displayHex} 0%, ${rgbToHex(
      Math.max(0, displayRgb[0] - 20),
      Math.max(0, displayRgb[1] - 20),
      Math.max(0, displayRgb[2] - 20)
    )} 100%)`,
  })

  // Override titlebar background with the titlebar BMP if available
  if (titlebar) {
    skin.titlebar.background = `url(${titlebar.url}) left top/auto 100% no-repeat, ${skin.titlebar.background}`
  }

  // --- Extract all sprite sheets as data URLs with magenta transparency ---
  const [
    mainBmp, cButtonsBmp, titlebarBmp, posbarBmp, volumeBmp,
    shufrepBmp, monosterBmp, playpausBmp, numbersBmp, textBmp,
    eqmainBmp, pleditBmp, balanceBmp,
  ] = await Promise.all([
    Promise.resolve(processTransparency(main.img)),
    extractSpriteDataUrl(zip, 'cbuttons'),
    extractSpriteDataUrl(zip, 'titlebar'),
    extractSpriteDataUrl(zip, 'posbar'),
    extractSpriteDataUrl(zip, 'volume'),
    extractSpriteDataUrl(zip, 'shufrep'),
    extractSpriteDataUrl(zip, 'monoster'),
    extractSpriteDataUrl(zip, 'playpaus'),
    extractSpriteDataUrl(zip, 'numbers'),
    extractSpriteDataUrl(zip, 'text'),
    extractSpriteDataUrl(zip, 'eqmain'),
    extractSpriteDataUrl(zip, 'pledit'),
    extractSpriteDataUrl(zip, 'balance'),
  ])

  const sprites: WinampSprites = {}
  if (mainBmp) sprites.mainBmp = mainBmp
  if (cButtonsBmp) sprites.cButtonsBmp = cButtonsBmp
  if (titlebarBmp) sprites.titlebarBmp = titlebarBmp
  if (posbarBmp) sprites.posbarBmp = posbarBmp
  if (volumeBmp) sprites.volumeBmp = volumeBmp
  if (shufrepBmp) sprites.shufrepBmp = shufrepBmp
  if (monosterBmp) sprites.monosterBmp = monosterBmp
  if (playpausBmp) sprites.playpausBmp = playpausBmp
  if (numbersBmp) sprites.numbersBmp = numbersBmp
  if (textBmp) sprites.textBmp = textBmp
  if (eqmainBmp) sprites.eqmainBmp = eqmainBmp
  if (pleditBmp) sprites.pleditBmp = pleditBmp
  if (balanceBmp) sprites.balanceBmp = balanceBmp

  skin.sprites = sprites

  // --- Parse PLEDIT.TXT for playlist colors ---
  const pleditFile = findFile(zip, 'pledit.txt')
  if (pleditFile) {
    const pleditText = await pleditFile.async('string')
    skin.pleditColors = parsePledit(pleditText)
  }

  return skin
}
