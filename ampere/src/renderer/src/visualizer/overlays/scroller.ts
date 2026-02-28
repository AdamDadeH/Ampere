/**
 * Sine-wave text scroller — Canvas 2D overlay composited on top of WebGL.
 * Chunky pixel font, copper/raster bar background, cracktro aesthetics.
 */

export interface ScrollerState {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  offset: number
  text: string
  charWidth: number
}

const FONT_SIZE = 28
const BASE_SPEED = 2.5
const RASTER_HEIGHT = 80

// Copper bar gradient colors (classic Amiga)
const COPPER_COLORS = [
  '#000000', '#220022', '#440044', '#660066',
  '#880088', '#aa00aa', '#cc00cc', '#ff00ff',
  '#cc00cc', '#aa00aa', '#880088', '#660066',
  '#440044', '#220022', '#000000',
]

export function createScroller(canvas: HTMLCanvasElement): ScrollerState {
  const ctx = canvas.getContext('2d')!
  ctx.font = `bold ${FONT_SIZE}px "Courier New", monospace`
  const charWidth = ctx.measureText('M').width

  return {
    canvas,
    ctx,
    offset: canvas.width,
    text: '     WELCOME TO PROTONMUSIC ... THE DEMOSCENE VISUALIZER     ',
    charWidth,
  }
}

export function setScrollerText(state: ScrollerState, text: string): void {
  state.text = `     ${text}     `
  // Reset offset if text changed significantly
  const totalWidth = state.text.length * state.charWidth
  if (state.offset < -totalWidth) {
    state.offset = state.canvas.width
  }
}

export function drawScroller(
  state: ScrollerState,
  time: number,
  energy: number,
  beat: number
): void {
  const { canvas, ctx, text, charWidth } = state
  const width = canvas.width
  const height = canvas.height

  // Clear scroller region (bottom portion)
  const scrollerY = height - RASTER_HEIGHT - 20
  ctx.clearRect(0, scrollerY - FONT_SIZE, width, RASTER_HEIGHT + FONT_SIZE + 40)

  // Draw copper/raster bars behind text
  const barHeight = RASTER_HEIGHT / COPPER_COLORS.length
  for (let i = 0; i < COPPER_COLORS.length; i++) {
    const yOff = Math.sin(time * 2.0 + i * 0.3) * 3
    ctx.fillStyle = COPPER_COLORS[i]
    ctx.globalAlpha = 0.6 + beat * 0.3
    ctx.fillRect(0, scrollerY - RASTER_HEIGHT / 2 + i * barHeight + yOff, width, barHeight + 1)
  }
  ctx.globalAlpha = 1.0

  // Draw text as a single line, no vertical wave
  ctx.font = `bold ${FONT_SIZE}px "Courier New", monospace`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 2
  ctx.fillText(text, state.offset, scrollerY)

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // Scroll speed reacts to energy
  const speed = BASE_SPEED * (1.0 + energy * 1.5) + beat * 4.0
  state.offset -= speed

  // Loop when fully scrolled off
  const totalWidth = text.length * charWidth
  if (state.offset < -totalWidth) {
    state.offset = width
  }
}

export function resizeScroller(state: ScrollerState, width: number, height: number): void {
  // Canvas resize resets context state
  state.canvas.width = width
  state.canvas.height = height
  state.ctx.font = `bold ${FONT_SIZE}px "Courier New", monospace`
  state.charWidth = state.ctx.measureText('M').width
}
