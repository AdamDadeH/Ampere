import { useRef, useEffect, useState, useCallback } from 'react'
import type { CompactSkin, CompactSpectrumStyle } from '../../themes/types'

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

const EASTER_EGG_TEXT = 'ProtonMusic v1.0 \u2014 it really whips the llama\'s ass!'

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

export function CompactLCD({
  title, artist, currentTime, duration, bitrate, sampleRate, codec, isPlaying,
  frequencyData, easterEgg, skin
}: CompactLCDProps): React.JSX.Element {
  const marqueeRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [offset, setOffset] = useState(0)
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const d = skin.display
  const sp = skin.spectrum

  const displayText = easterEgg
    ? EASTER_EGG_TEXT
    : [artist, title].filter(Boolean).join(' - ') || 'No track'

  const animate = useCallback((timestamp: number) => {
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

    animFrameRef.current = requestAnimationFrame(animate)
  }, [])

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
        <div className="compact-lcd-marquee" ref={marqueeRef}>
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
        </div>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="compact-lcd-spectrum"
        />
        <div className="compact-lcd-bottom">
          <div className="compact-lcd-badges">
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
          <div className="compact-lcd-time" style={{ fontFamily: d.fontFamily, color: d.textColor, textShadow: d.textShadow }}>
            {formatTime(currentTime)}
            <span className="compact-lcd-time-sep" style={{ color: d.textDimColor }}>/</span>
            {formatTime(duration)}
          </div>
        </div>
        <div className="compact-lcd-scanlines" style={{ background: d.scanlines }} />
      </div>
    </div>
  )
}
