import { useRef, useEffect, useState, useCallback } from 'react'
import type { CompactSkin, CompactSpectrumStyle } from '../../themes/types'
import {
  NUMBERS_CHAR_MAP,
  TEXT_CHAR_MAP,
  PLAYPAUS_SPRITES,
  MONOSTER_SPRITES,
  spriteStyleScaled,
} from '../../themes/sprite-constants'

interface CompactLCDProps {
  title: string | null
  artist: string | null
  currentTime: number
  duration: number
  bitrate: number | null
  sampleRate: number | null
  codec: string | null
  isPlaying: boolean
  frequencyData: number[]
  easterEgg: boolean
  skin: CompactSkin
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const SPECTRUM_BARS = 32
const CANVAS_W = 372
const CANVAS_H = 20
const BAR_GAP = 1
const BAR_W = Math.floor((CANVAS_W - (SPECTRUM_BARS - 1) * BAR_GAP) / SPECTRUM_BARS)

const EASTER_EGG_TEXT = 'Ampere v1.0 \u2014 it really whips the llama\'s ass!'

// --- Spectrum drawing functions ---

function drawBars(
  ctx: CanvasRenderingContext2D, data: number[],
  rgb: [number, number, number], _glowAlpha: number
): void {
  for (let i = 0; i < SPECTRUM_BARS && i < data.length; i++) {
    const val = data[i] / 255
    const h = val * CANVAS_H
    const x = i * (BAR_W + BAR_GAP)
    const brightness = 0.47 + val * 0.53
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${brightness})`
    ctx.fillRect(x, CANVAS_H - h, BAR_W, h)
  }
}

function drawMirrored(
  ctx: CanvasRenderingContext2D, data: number[],
  rgb: [number, number, number], _glowAlpha: number
): void {
  const mid = CANVAS_H / 2
  for (let i = 0; i < SPECTRUM_BARS && i < data.length; i++) {
    const val = data[i] / 255
    const h = val * mid
    const x = i * (BAR_W + BAR_GAP)
    const brightness = 0.47 + val * 0.53
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${brightness})`
    ctx.fillRect(x, mid - h, BAR_W, h)
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${brightness * 0.6})`
    ctx.fillRect(x, mid, BAR_W, h)
  }
}

function drawDots(
  ctx: CanvasRenderingContext2D, data: number[],
  rgb: [number, number, number], _glowAlpha: number
): void {
  const dotSize = 2
  const cols = SPECTRUM_BARS
  const rows = Math.floor(CANVAS_H / (dotSize + 1))
  for (let i = 0; i < cols && i < data.length; i++) {
    const val = data[i] / 255
    const litRows = Math.round(val * rows)
    const x = i * (BAR_W + BAR_GAP) + BAR_W / 2 - dotSize / 2
    for (let r = 0; r < rows; r++) {
      const y = CANVAS_H - (r + 1) * (dotSize + 1)
      if (r < litRows) {
        const brightness = 0.5 + (r / rows) * 0.5
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${brightness})`
      } else {
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)`
      }
      ctx.fillRect(x, y, dotSize, dotSize)
    }
  }
}

function drawWaveform(
  ctx: CanvasRenderingContext2D, data: number[],
  rgb: [number, number, number], _glowAlpha: number
): void {
  const mid = CANVAS_H / 2
  ctx.beginPath()
  ctx.strokeStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
  ctx.lineWidth = 1.5
  for (let i = 0; i < SPECTRUM_BARS && i < data.length; i++) {
    const val = data[i] / 255
    const y = mid - (val - 0.5) * CANVAS_H
    const x = i * (BAR_W + BAR_GAP) + BAR_W / 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  // Glow pass
  ctx.beginPath()
  ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`
  ctx.lineWidth = 3
  for (let i = 0; i < SPECTRUM_BARS && i < data.length; i++) {
    const val = data[i] / 255
    const y = mid - (val - 0.5) * CANVAS_H
    const x = i * (BAR_W + BAR_GAP) + BAR_W / 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

const spectrumRenderers: Record<
  CompactSpectrumStyle,
  (ctx: CanvasRenderingContext2D, data: number[], rgb: [number, number, number], glowAlpha: number) => void
> = { bars: drawBars, mirrored: drawMirrored, dots: drawDots, waveform: drawWaveform }

function drawEasterEggSpectrum(
  ctx: CanvasRenderingContext2D, rgb: [number, number, number],
  style: CompactSpectrumStyle
): void {
  const now = Date.now() % 3000
  // Generate synthetic data from sine wave
  const synthData: number[] = []
  for (let i = 0; i < SPECTRUM_BARS; i++) {
    const phase = (i / SPECTRUM_BARS) * Math.PI * 2 + (now / 300)
    synthData.push(Math.abs(Math.sin(phase)) * 255)
  }
  spectrumRenderers[style](ctx, synthData, rgb, 0.5)
}

// --- Bitmap font rendering helpers ---

// NUMBERS.BMP digit rendering: native 9x13, display scaled ~1.5x
const NUM_SCALE = 1.5
const NUM_DISPLAY_W = Math.round(9 * NUM_SCALE)
const NUM_DISPLAY_H = Math.round(13 * NUM_SCALE)
const NUMBERS_SHEET_W = 99
const NUMBERS_SHEET_H = 13

// TEXT.BMP character rendering: native 5x6, display scaled ~2x
const TEXT_SCALE = 2
const TEXT_CHAR_W = Math.round(5 * TEXT_SCALE)
const TEXT_CHAR_H = Math.round(6 * TEXT_SCALE)
const TEXT_SHEET_W = 155
const TEXT_SHEET_H = 18

// PLAYPAUS.BMP: native 9x9, display scaled ~1.2x
const PLAYPAUS_DISPLAY = 11
const PLAYPAUS_SHEET_W = 42
const PLAYPAUS_SHEET_H = 9

// MONOSTER.BMP: display height ~12
const MONOSTER_DISPLAY_H = 12
const MONOSTER_SHEET_W = 56
const MONOSTER_SHEET_H = 24

function BitmapDigits({ text, dataUrl }: { text: string; dataUrl: string }): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {text.split('').map((ch, i) => {
        if (ch === ':') {
          // Render colon as a narrow separator
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: Math.round(NUM_DISPLAY_W * 0.5),
                height: NUM_DISPLAY_H,
                position: 'relative',
              }}
            >
              <span style={{
                position: 'absolute',
                left: '50%', top: '25%',
                transform: 'translate(-50%, 0)',
                width: 2, height: 2,
                borderRadius: '50%',
                background: 'currentColor',
              }} />
              <span style={{
                position: 'absolute',
                left: '50%', top: '60%',
                transform: 'translate(-50%, 0)',
                width: 2, height: 2,
                borderRadius: '50%',
                background: 'currentColor',
              }} />
            </span>
          )
        }
        const region = NUMBERS_CHAR_MAP[ch]
        if (!region) return <span key={i} style={{ display: 'inline-block', width: NUM_DISPLAY_W, height: NUM_DISPLAY_H }} />
        const style = spriteStyleScaled(dataUrl, region, NUM_DISPLAY_W, NUM_DISPLAY_H, NUMBERS_SHEET_W, NUMBERS_SHEET_H)
        return <span key={i} className="compact-sprite" style={style} />
      })}
    </span>
  )
}

function BitmapMarquee({
  text, dataUrl, offset,
}: {
  text: string
  dataUrl: string
  offset: number
}): React.JSX.Element {
  const upper = text.toUpperCase()
  return (
    <div style={{
      display: 'flex',
      transform: `translateX(${offset}px)`,
      willChange: 'transform',
    }}>
      {upper.split('').map((ch, i) => {
        const region = TEXT_CHAR_MAP[ch]
        if (!region) {
          // Unknown char → blank space
          return <span key={i} style={{ display: 'inline-block', width: TEXT_CHAR_W, height: TEXT_CHAR_H }} />
        }
        const style = spriteStyleScaled(dataUrl, region, TEXT_CHAR_W, TEXT_CHAR_H, TEXT_SHEET_W, TEXT_SHEET_H)
        return <span key={i} className="compact-sprite" style={style} />
      })}
    </div>
  )
}

export function CompactLCD({
  title, artist, currentTime, duration, bitrate, sampleRate, codec, isPlaying,
  frequencyData, easterEgg, skin
}: CompactLCDProps): React.JSX.Element {
  const marqueeRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const bitmapMarqueeRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [offset, setOffset] = useState(0)
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const d = skin.display
  const sp = skin.spectrum
  const sprites = skin.sprites

  const hasNumbers = !!sprites?.numbersBmp
  const hasText = !!sprites?.textBmp
  const hasPlaypaus = !!sprites?.playpausBmp
  const hasMonoster = !!sprites?.monosterBmp

  const displayText = easterEgg
    ? EASTER_EGG_TEXT
    : [artist, title].filter(Boolean).join(' - ') || 'No track'

  const animate = useCallback((timestamp: number) => {
    if (hasText) {
      // For bitmap marquee, measure using the container vs content width
      const container = bitmapMarqueeRef.current?.parentElement
      const content = bitmapMarqueeRef.current
      if (!container || !content) return

      const containerWidth = container.clientWidth
      const textWidth = content.scrollWidth

      if (textWidth <= containerWidth) {
        setOffset(0)
        return
      }

      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const delta = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      setOffset(prev => {
        const next = prev - delta * 0.03
        if (Math.abs(next) > textWidth + 40) return containerWidth
        return next
      })
    } else {
      if (!marqueeRef.current || !innerRef.current) return

      const containerWidth = marqueeRef.current.clientWidth
      const textWidth = innerRef.current.scrollWidth

      if (textWidth <= containerWidth) {
        setOffset(0)
        return
      }

      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const delta = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      setOffset(prev => {
        const next = prev - delta * 0.03
        if (Math.abs(next) > textWidth + 40) return containerWidth
        return next
      })
    }

    animFrameRef.current = requestAnimationFrame(animate)
  }, [hasText])

  useEffect(() => {
    if (isPlaying || easterEgg) {
      lastTimeRef.current = 0
      animFrameRef.current = requestAnimationFrame(animate)
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPlaying, easterEgg, animate, displayText])

  // Draw spectrum
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    if (easterEgg) return // handled by easter egg animation loop

    const data = frequencyData
    if (!data || data.length === 0) return

    spectrumRenderers[sp.style](ctx, data, sp.barColorRgb, sp.glowAlpha)
  }, [frequencyData, easterEgg, sp.style, sp.barColorRgb, sp.glowAlpha])

  // Easter egg animation loop
  useEffect(() => {
    if (!easterEgg) return
    let rafId: number
    const tick = (): void => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      drawEasterEggSpectrum(ctx, sp.barColorRgb, sp.style)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [easterEgg, sp.barColorRgb, sp.style])

  const kbps = bitrate ? `${Math.round(bitrate / 1000)}` : '--'
  const khz = sampleRate ? `${(sampleRate / 1000).toFixed(1)}` : '--'
  const timeStr = formatTime(currentTime)
  const durStr = formatTime(duration)

  const screenStyle: React.CSSProperties = {
    background: d.background,
    borderTop: d.borderTop,
    borderLeft: d.borderLeft,
    borderRight: d.borderRight,
    borderBottom: d.borderBottom,
    boxShadow: easterEgg
      ? `${d.boxShadow}, inset 0 0 20px ${skin.easterEgg.flickerColor}`
      : d.boxShadow,
    borderRadius: d.borderRadius,
  }

  return (
    <div className="compact-lcd">
      <div
        className={`compact-lcd-screen ${easterEgg ? 'easter-egg-active' : ''}`}
        style={screenStyle}
      >
        {/* Marquee: bitmap font or regular text */}
        <div className="compact-lcd-marquee" ref={marqueeRef}>
          {hasText ? (
            <div ref={bitmapMarqueeRef}>
              <BitmapMarquee
                text={displayText}
                dataUrl={sprites!.textBmp!}
                offset={offset}
              />
            </div>
          ) : (
            <span
              ref={innerRef}
              className={`compact-lcd-marquee-text ${easterEgg ? 'easter-egg-glitch' : ''}`}
              style={{
                transform: `translateX(${offset}px)`,
                fontFamily: d.fontFamily,
                color: d.textColor,
                textShadow: easterEgg ? skin.easterEgg.glitchShadow : d.textShadow,
              }}
            >
              {displayText}
            </span>
          )}
        </div>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="compact-lcd-spectrum"
        />
        <div className="compact-lcd-bottom">
          <div className="compact-lcd-badges">
            {/* Play/pause/stop indicator */}
            {hasPlaypaus && (
              <span
                className="compact-sprite"
                style={spriteStyleScaled(
                  sprites!.playpausBmp!,
                  isPlaying
                    ? PLAYPAUS_SPRITES.playing
                    : PLAYPAUS_SPRITES.stopped,
                  PLAYPAUS_DISPLAY, PLAYPAUS_DISPLAY,
                  PLAYPAUS_SHEET_W, PLAYPAUS_SHEET_H,
                )}
              />
            )}
            {/* Mono/stereo indicator */}
            {hasMonoster && (
              <span
                className="compact-sprite"
                style={spriteStyleScaled(
                  sprites!.monosterBmp!,
                  MONOSTER_SPRITES.stereoActive,
                  Math.round(29 * (MONOSTER_DISPLAY_H / 12)),
                  MONOSTER_DISPLAY_H,
                  MONOSTER_SHEET_W, MONOSTER_SHEET_H,
                )}
              />
            )}
            <span className="compact-lcd-badge" style={{ fontFamily: d.fontFamily, color: d.textDimColor, textShadow: d.textDimShadow }}>
              {kbps} kbps
            </span>
            <span className="compact-lcd-badge" style={{ fontFamily: d.fontFamily, color: d.textDimColor, textShadow: d.textDimShadow }}>
              {khz} kHz
            </span>
            {codec && (
              <span className="compact-lcd-badge" style={{ fontFamily: d.fontFamily, color: d.textDimColor, textShadow: d.textDimShadow }}>
                {codec.toUpperCase()}
              </span>
            )}
          </div>
          {/* Time display: bitmap digits or regular text */}
          {hasNumbers ? (
            <div className="compact-lcd-time" style={{ color: d.textColor }}>
              <BitmapDigits text={timeStr} dataUrl={sprites!.numbersBmp!} />
              <span className="compact-lcd-time-sep" style={{ color: d.textDimColor, margin: '0 2px' }}>/</span>
              <BitmapDigits text={durStr} dataUrl={sprites!.numbersBmp!} />
            </div>
          ) : (
            <div className="compact-lcd-time" style={{ fontFamily: d.fontFamily, color: d.textColor, textShadow: d.textShadow }}>
              {timeStr}
              <span className="compact-lcd-time-sep" style={{ color: d.textDimColor }}>/</span>
              {durStr}
            </div>
          )}
        </div>
        <div className="compact-lcd-scanlines" style={{ background: d.scanlines }} />
      </div>
    </div>
  )
}
