import type React from 'react'

export interface SpriteRegion {
  x: number
  y: number
  w: number
  h: number
}

// --- CBUTTONS.BMP (136x36) ---
export const CBUTTONS_SPRITES = {
  previous:        { x: 0,   y: 0,  w: 23, h: 18 },
  previousPressed: { x: 0,   y: 18, w: 23, h: 18 },
  play:            { x: 23,  y: 0,  w: 23, h: 18 },
  playPressed:     { x: 23,  y: 18, w: 23, h: 18 },
  pause:           { x: 46,  y: 0,  w: 23, h: 18 },
  pausePressed:    { x: 46,  y: 18, w: 23, h: 18 },
  stop:            { x: 69,  y: 0,  w: 23, h: 18 },
  stopPressed:     { x: 69,  y: 18, w: 23, h: 18 },
  next:            { x: 92,  y: 0,  w: 23, h: 18 },
  nextPressed:     { x: 92,  y: 18, w: 22, h: 18 },
  eject:           { x: 114, y: 0,  w: 22, h: 16 },
  ejectPressed:    { x: 114, y: 16, w: 22, h: 16 },
} as const

// --- POSBAR.BMP (307x10) ---
export const POSBAR_SPRITES = {
  track:        { x: 0,   y: 0, w: 248, h: 10 },
  thumb:        { x: 248, y: 0, w: 29,  h: 10 },
  thumbPressed: { x: 278, y: 0, w: 29,  h: 10 },
} as const

// --- VOLUME.BMP (68x433) ---
// 28 level frames at y = i*15, each 68x13
export function volumeFrame(index: number): SpriteRegion {
  return { x: 0, y: index * 15, w: 68, h: 13 }
}
export const VOLUME_SPRITES = {
  thumb:        { x: 15, y: 422, w: 14, h: 11 },
  thumbPressed: { x: 0,  y: 422, w: 14, h: 11 },
} as const

// --- SHUFREP.BMP (92x85) ---
export const SHUFREP_SPRITES = {
  repeatOff:        { x: 0,  y: 0,  w: 28, h: 15 },
  repeatOffPressed: { x: 0,  y: 15, w: 28, h: 15 },
  repeatOn:         { x: 0,  y: 30, w: 28, h: 15 },
  repeatOnPressed:  { x: 0,  y: 45, w: 28, h: 15 },
  shuffleOff:        { x: 28, y: 0,  w: 47, h: 15 },
  shuffleOffPressed: { x: 28, y: 15, w: 47, h: 15 },
  shuffleOn:         { x: 28, y: 30, w: 47, h: 15 },
  shuffleOnPressed:  { x: 28, y: 45, w: 47, h: 15 },
  eqOff:     { x: 0,  y: 61, w: 23, h: 12 },
  eqOn:      { x: 0,  y: 73, w: 23, h: 12 },
  plOff:     { x: 23, y: 61, w: 23, h: 12 },
  plOn:      { x: 23, y: 73, w: 23, h: 12 },
} as const

// --- TITLEBAR.BMP (275x58) ---
export const TITLEBAR_SPRITES = {
  active:           { x: 27, y: 0,  w: 275, h: 14 },
  inactive:         { x: 27, y: 15, w: 275, h: 14 },
  close:            { x: 18, y: 0,  w: 9,   h: 9 },
  closePressed:     { x: 18, y: 9,  w: 9,   h: 9 },
  minimize:         { x: 9,  y: 0,  w: 9,   h: 9 },
  minimizePressed:  { x: 9,  y: 9,  w: 9,   h: 9 },
  shade:            { x: 0,  y: 18, w: 9,   h: 9 },
  shadePressed:     { x: 9,  y: 18, w: 9,   h: 9 },
} as const

// --- PLAYPAUS.BMP (42x9) ---
export const PLAYPAUS_SPRITES = {
  playing: { x: 0,  y: 0, w: 9, h: 9 },
  paused:  { x: 9,  y: 0, w: 9, h: 9 },
  stopped: { x: 18, y: 0, w: 9, h: 9 },
} as const

// --- MONOSTER.BMP (56x24) ---
export const MONOSTER_SPRITES = {
  stereoActive:   { x: 0,  y: 0,  w: 29, h: 12 },
  stereoInactive: { x: 0,  y: 12, w: 29, h: 12 },
  monoActive:     { x: 29, y: 0,  w: 27, h: 12 },
  monoInactive:   { x: 29, y: 12, w: 27, h: 12 },
} as const

// --- NUMBERS.BMP (99x13) ---
// Digits 0-9 at x=i*9, blank at x=90
export const NUMBERS_CHAR_MAP: Record<string, SpriteRegion> = {}
for (let i = 0; i <= 9; i++) {
  NUMBERS_CHAR_MAP[String(i)] = { x: i * 9, y: 0, w: 9, h: 13 }
}
NUMBERS_CHAR_MAP[' '] = { x: 90, y: 0, w: 9, h: 13 }
NUMBERS_CHAR_MAP['-'] = { x: 90, y: 0, w: 9, h: 13 }

// --- TEXT.BMP (155x18) --- 5x6 per character
const TEXT_ROW_0 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ"@'
const TEXT_ROW_1 = '0123456789...:()-\'!_+\\/[]^&%,=$#'
const TEXT_ROW_2 = '\u00D6\u00C4\u00DC\u00F6\u00E4\u00FC?*'

export const TEXT_CHAR_MAP: Record<string, SpriteRegion> = {}

function buildTextMap(row: string, rowIndex: number): void {
  for (let i = 0; i < row.length; i++) {
    TEXT_CHAR_MAP[row[i]] = { x: i * 5, y: rowIndex * 6, w: 5, h: 6 }
  }
}
buildTextMap(TEXT_ROW_0, 0)
buildTextMap(TEXT_ROW_1, 1)
buildTextMap(TEXT_ROW_2, 2)
// Map lowercase to uppercase
for (let c = 65; c <= 90; c++) {
  TEXT_CHAR_MAP[String.fromCharCode(c + 32)] = TEXT_CHAR_MAP[String.fromCharCode(c)]
}
// Space character (index 11 in row 0 doesn't exist, so map to blank from row 1 if needed)
if (!TEXT_CHAR_MAP[' ']) {
  TEXT_CHAR_MAP[' '] = { x: 31 * 5, y: 0, w: 5, h: 6 } // past last char in row 0 = blank
}

// --- WINAMP CLASSIC LAYOUT (275x116) ---
export const WINAMP_LAYOUT = {
  width: 275,
  height: 116,
  titlebar: { x: 0, y: 0, w: 275, h: 14 },
  display:  { x: 24, y: 14, w: 248, h: 58 },
  marquee:  { x: 24, y: 15, w: 248, h: 15 },
  playpaus: { x: 26, y: 28, w: 9, h: 9 },
  monoster: { x: 212, y: 41, w: 56, h: 12 },
  time:     { x: 48, y: 26, w: 63, h: 13 },
  kbps:     { x: 111, y: 43, w: 30, h: 6 },
  khz:      { x: 156, y: 43, w: 30, h: 6 },
  spectrum: { x: 24, y: 43, w: 76, h: 16 },
  seekbar:  { x: 16, y: 72, w: 248, h: 10 },
  prev:     { x: 16, y: 88, w: 23, h: 18 },
  play:     { x: 39, y: 88, w: 23, h: 18 },
  pause:    { x: 62, y: 88, w: 23, h: 18 },
  stop:     { x: 85, y: 88, w: 23, h: 18 },
  next:     { x: 108, y: 88, w: 22, h: 18 },
  eject:    { x: 136, y: 89, w: 22, h: 16 },
  shuffle:  { x: 164, y: 89, w: 47, h: 15 },
  repeat:   { x: 211, y: 89, w: 28, h: 15 },
  eqBtn:    { x: 219, y: 72, w: 23, h: 12 },
  plBtn:    { x: 242, y: 72, w: 23, h: 12 },
  volume:   { x: 107, y: 57, w: 68, h: 13 },
  balance:  { x: 177, y: 57, w: 38, h: 13 },
} as const

// --- EQMAIN.BMP sprites ---
// Single background + separate active/inactive title bars (per Winamp spec)
export const EQMAIN_SPRITES = {
  background:         { x: 0, y: 0, w: 275, h: 116 },
  titlebarActive:     { x: 0, y: 134, w: 275, h: 14 },
  titlebarInactive:   { x: 0, y: 149, w: 275, h: 14 },
  // ON button — 4 states (off/on × normal/pressed)
  onOff:              { x: 10,  y: 119, w: 26, h: 12 },
  onOffPressed:       { x: 128, y: 119, w: 26, h: 12 },
  onOn:               { x: 69,  y: 119, w: 26, h: 12 },
  onOnPressed:        { x: 187, y: 119, w: 26, h: 12 },
  // AUTO button — 4 states
  autoOff:            { x: 36,  y: 119, w: 32, h: 12 },
  autoOffPressed:     { x: 154, y: 119, w: 32, h: 12 },
  autoOn:             { x: 95,  y: 119, w: 32, h: 12 },
  autoOnPressed:      { x: 213, y: 119, w: 32, h: 12 },
  // Presets button
  presets:            { x: 224, y: 164, w: 44, h: 12 },
  presetsPressed:     { x: 224, y: 176, w: 44, h: 12 },
  // Slider thumb
  thumb:              { x: 0, y: 164, w: 11, h: 11 },
  thumbPressed:       { x: 0, y: 176, w: 11, h: 11 },
  // Slider bar background (28 pre-rendered bar sprites in 14×2 grid, each 15×65 stride)
  sliderBg:           { x: 13, y: 164, w: 209, h: 129 },
  // EQ close/shade buttons
  close:              { x: 0, y: 116, w: 9, h: 9 },
  closePressed:       { x: 0, y: 125, w: 9, h: 9 },
} as const

// --- BALANCE.BMP (same layout as volume, 28 frames + thumb) ---
export const BALANCE_SPRITES = {
  thumb:        { x: 15, y: 422, w: 14, h: 11 },
  thumbPressed: { x: 0,  y: 422, w: 14, h: 11 },
} as const

export function balanceFrame(index: number): SpriteRegion {
  return { x: 9, y: index * 15, w: 38, h: 13 }
}

/** Build inline CSSProperties for a sprite region */
export function spriteStyle(
  dataUrl: string,
  region: SpriteRegion,
  scale = 1
): React.CSSProperties {
  return {
    display: 'inline-block',
    width: region.w * scale,
    height: region.h * scale,
    backgroundImage: `url(${dataUrl})`,
    backgroundPosition: `-${region.x * scale}px -${region.y * scale}px`,
    backgroundSize: `auto`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    ...(scale !== 1 ? { backgroundSize: `${scale * 100}%` } : {}),
  }
}

/** Build inline CSSProperties for a sprite region with explicit scaling from natural size */
export function spriteStyleScaled(
  dataUrl: string,
  region: SpriteRegion,
  displayW: number,
  displayH: number,
  sheetW: number,
  sheetH: number
): React.CSSProperties {
  const scaleX = displayW / region.w
  const scaleY = displayH / region.h
  return {
    display: 'inline-block',
    width: displayW,
    height: displayH,
    backgroundImage: `url(${dataUrl})`,
    backgroundPosition: `-${region.x * scaleX}px -${region.y * scaleY}px`,
    backgroundSize: `${sheetW * scaleX}px ${sheetH * scaleY}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  }
}
