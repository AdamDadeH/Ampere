import { useState, useEffect, useRef, useCallback } from 'react'
import type { CompactSkin } from '../../themes/types'
import type { PlayerState } from '../../../../../preload/index'
import { EQMAIN_SPRITES, spriteStyle } from '../../themes/sprite-constants'
import { gainToY, yToGain, clampSliderY, EQ_SLIDER } from '../../themes/eq-math'

interface ClassicEQProps {
  skin: CompactSkin
  state: PlayerState
  sendCommand: (cmd: string, ...args: unknown[]) => void
}

const EQ_WIDTH = 275
const EQ_HEIGHT = 116

// The classic layout uses transform: scale(2), so getBoundingClientRect()
// returns screen-space (2x) dimensions. Divide mouse coords by this to
// convert back to the 1x coordinate space our constants use.
const CSS_SCALE = 2

function EQSlider({
  x, gain, thumbUrl, onGainChange,
}: {
  x: number
  gain: number
  thumbUrl: string
  onGainChange: (gain: number) => void
}): React.JSX.Element {
  const [dragging, setDragging] = useState(false)
  const [localGain, setLocalGain] = useState(gain)
  const sliderRef = useRef<HTMLDivElement>(null)

  // Sync from prop when not dragging
  useEffect(() => {
    if (!dragging) setLocalGain(gain)
  }, [gain, dragging])

  const displayGain = dragging ? localGain : gain
  const thumbY = gainToY(displayGain)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    const rect = sliderRef.current!.getBoundingClientRect()

    const updateFromEvent = (ev: MouseEvent): void => {
      // Convert screen-space mouse position to 1x element-space
      const relY = (ev.clientY - rect.top) / CSS_SCALE
      const clampedY = clampSliderY(relY - EQ_SLIDER.THUMB_H / 2)
      const newGain = Math.round(yToGain(clampedY) * 10) / 10
      setLocalGain(newGain)
      onGainChange(newGain)
    }

    updateFromEvent(e.nativeEvent)

    const onMove = (ev: MouseEvent): void => updateFromEvent(ev)
    const onUp = (): void => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [onGainChange])

  return (
    <div
      ref={sliderRef}
      className="classic-eq-slider-track"
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width: EQ_SLIDER.BAND_COL_W,
        height: EQ_HEIGHT,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Thumb sprite — centered horizontally in the 14px column */}
      <div style={{
        position: 'absolute',
        left: Math.round((EQ_SLIDER.BAND_COL_W - EQ_SLIDER.THUMB_W) / 2),
        top: thumbY,
        ...spriteStyle(thumbUrl, dragging ? EQMAIN_SPRITES.thumbPressed : EQMAIN_SPRITES.thumb),
      }} />
    </div>
  )
}

// 4-state EQ button (off/on × normal/pressed)
function EQButton({
  eqBmp, active, x, y,
  spriteOff, spriteOffPressed, spriteOn, spriteOnPressed,
  onClick, title,
}: {
  eqBmp: string
  active: boolean
  x: number
  y: number
  spriteOff: typeof EQMAIN_SPRITES.onOff
  spriteOffPressed: typeof EQMAIN_SPRITES.onOffPressed
  spriteOn: typeof EQMAIN_SPRITES.onOn
  spriteOnPressed: typeof EQMAIN_SPRITES.onOnPressed
  onClick: () => void
  title: string
}): React.JSX.Element {
  const [pressed, setPressed] = useState(false)
  const sprite = active
    ? (pressed ? spriteOnPressed : spriteOn)
    : (pressed ? spriteOffPressed : spriteOff)

  return (
    <button
      className="classic-no-drag"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        ...spriteStyle(eqBmp, sprite),
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        backgroundColor: 'transparent',
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      title={title}
    />
  )
}

export function ClassicEQ({ skin, state, sendCommand }: ClassicEQProps): React.JSX.Element {
  const sprites = skin.sprites!
  const eqBmp = sprites.eqmainBmp

  // Use EQ state from PlayerState broadcast
  const eqEnabled = state.eqEnabled
  const eqPreamp = state.eqPreamp
  const eqBands = state.eqBands

  // Fallback: if no EQMAIN.BMP, render a simple panel
  if (!eqBmp) {
    return (
      <div style={{
        width: EQ_WIDTH,
        height: EQ_HEIGHT,
        background: '#3a3a3e',
        position: 'relative',
        borderTop: '1px solid #555',
      }}>
        <div style={{
          position: 'absolute',
          top: 4, left: 10,
          color: '#aaa',
          fontSize: 8,
          fontFamily: "'Tahoma', sans-serif",
        }}>
          EQUALIZER
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'relative',
      width: EQ_WIDTH,
      height: EQ_HEIGHT,
      backgroundImage: `url(${eqBmp})`,
      backgroundPosition: `-${EQMAIN_SPRITES.background.x}px -${EQMAIN_SPRITES.background.y}px`,
      backgroundSize: 'auto',
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated',
      overflow: 'hidden',
    }}>
      {/* Titlebar overlay — active/inactive based on EQ enabled state */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        ...spriteStyle(eqBmp, EQMAIN_SPRITES.titlebarActive),
      }} />

      {/* ON/OFF button (4-state) */}
      <EQButton
        eqBmp={eqBmp}
        active={eqEnabled}
        x={14}
        y={18}
        spriteOff={EQMAIN_SPRITES.onOff}
        spriteOffPressed={EQMAIN_SPRITES.onOffPressed}
        spriteOn={EQMAIN_SPRITES.onOn}
        spriteOnPressed={EQMAIN_SPRITES.onOnPressed}
        onClick={() => sendCommand('set-eq-enabled', !eqEnabled)}
        title={eqEnabled ? 'EQ On' : 'EQ Off'}
      />

      {/* AUTO button (visual only, no presets support yet) */}
      <EQButton
        eqBmp={eqBmp}
        active={false}
        x={40}
        y={18}
        spriteOff={EQMAIN_SPRITES.autoOff}
        spriteOffPressed={EQMAIN_SPRITES.autoOffPressed}
        spriteOn={EQMAIN_SPRITES.autoOn}
        spriteOnPressed={EQMAIN_SPRITES.autoOnPressed}
        onClick={() => {}}
        title="Auto (not implemented)"
      />

      {/* Preamp slider */}
      <EQSlider
        x={EQ_SLIDER.PREAMP_X}
        gain={eqPreamp}
        thumbUrl={eqBmp}
        onGainChange={(g) => sendCommand('set-eq-preamp', g)}
      />

      {/* 10 band sliders */}
      {eqBands.map((gain, i) => (
        <EQSlider
          key={i}
          x={EQ_SLIDER.BAND_START_X + i * EQ_SLIDER.BAND_SPACING}
          gain={gain}
          thumbUrl={eqBmp}
          onGainChange={(g) => sendCommand('set-eq-band', i, g)}
        />
      ))}
    </div>
  )
}
