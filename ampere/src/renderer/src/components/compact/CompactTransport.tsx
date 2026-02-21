import { useState } from 'react'
import type { CompactSkin } from '../../themes/types'
import {
  CBUTTONS_SPRITES,
  SHUFREP_SPRITES,
  spriteStyleScaled,
  type SpriteRegion,
} from '../../themes/sprite-constants'

interface CompactTransportProps {
  isPlaying: boolean
  shuffle: boolean
  repeatMode: 'off' | 'one' | 'all'
  onPrev: () => void
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onNext: () => void
  onToggleShuffle: () => void
  onCycleRepeat: () => void
  skin: CompactSkin
}

// Winamp native button: 23x18, our slot: 28x22 → scale ~1.22
const BTN_W = 28
const BTN_H = 22
const CBUTTONS_SHEET_W = 136
const CBUTTONS_SHEET_H = 36

const TOGGLE_W = 24
const SHUFREP_SHEET_W = 92
const SHUFREP_SHEET_H = 85

function SpriteButton({
  dataUrl,
  normal,
  pressed,
  sheetW,
  sheetH,
  displayW,
  displayH,
  onClick,
  title,
  className,
}: {
  dataUrl: string
  normal: SpriteRegion
  pressed: SpriteRegion
  sheetW: number
  sheetH: number
  displayW: number
  displayH: number
  onClick: () => void
  title: string
  className: string
}): React.JSX.Element {
  const [isPressed, setIsPressed] = useState(false)
  const region = isPressed ? pressed : normal
  const style = spriteStyleScaled(dataUrl, region, displayW, displayH, sheetW, sheetH)

  return (
    <button
      className={`${className} compact-sprite-btn`}
      onClick={onClick}
      title={title}
      style={style}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    />
  )
}

export function CompactTransport({
  isPlaying, shuffle, repeatMode,
  onPrev, onPlay, onPause, onStop, onNext,
  onToggleShuffle, onCycleRepeat, skin
}: CompactTransportProps): React.JSX.Element {
  const sprites = skin.sprites
  const hasCButtons = !!sprites?.cButtonsBmp
  const hasShufRep = !!sprites?.shufrepBmp

  // --- Sprite render path ---
  if (hasCButtons) {
    const cb = sprites!.cButtonsBmp!
    const sr = sprites!.shufrepBmp

    return (
      <div className="compact-transport">
        {hasShufRep && sr ? (
          <ShufRepButton
            dataUrl={sr}
            active={shuffle}
            normalOff={SHUFREP_SPRITES.shuffleOff}
            pressedOff={SHUFREP_SPRITES.shuffleOffPressed}
            normalOn={SHUFREP_SPRITES.shuffleOn}
            pressedOn={SHUFREP_SPRITES.shuffleOnPressed}
            onClick={onToggleShuffle}
            title="Shuffle"
          />
        ) : (
          <FallbackToggle skin={skin} active={shuffle} onClick={onToggleShuffle} title="Shuffle" icon="shuffle" />
        )}
        <SpriteButton
          dataUrl={cb} normal={CBUTTONS_SPRITES.previous} pressed={CBUTTONS_SPRITES.previousPressed}
          sheetW={CBUTTONS_SHEET_W} sheetH={CBUTTONS_SHEET_H}
          displayW={BTN_W} displayH={BTN_H}
          onClick={onPrev} title="Previous" className="compact-transport-btn"
        />
        <SpriteButton
          dataUrl={cb} normal={CBUTTONS_SPRITES.play} pressed={CBUTTONS_SPRITES.playPressed}
          sheetW={CBUTTONS_SHEET_W} sheetH={CBUTTONS_SHEET_H}
          displayW={BTN_W} displayH={BTN_H}
          onClick={onPlay} title="Play" className="compact-transport-btn"
        />
        <SpriteButton
          dataUrl={cb} normal={CBUTTONS_SPRITES.pause} pressed={CBUTTONS_SPRITES.pausePressed}
          sheetW={CBUTTONS_SHEET_W} sheetH={CBUTTONS_SHEET_H}
          displayW={BTN_W} displayH={BTN_H}
          onClick={onPause} title="Pause" className="compact-transport-btn"
        />
        <SpriteButton
          dataUrl={cb} normal={CBUTTONS_SPRITES.stop} pressed={CBUTTONS_SPRITES.stopPressed}
          sheetW={CBUTTONS_SHEET_W} sheetH={CBUTTONS_SHEET_H}
          displayW={BTN_W} displayH={BTN_H}
          onClick={onStop} title="Stop" className="compact-transport-btn"
        />
        <SpriteButton
          dataUrl={cb} normal={CBUTTONS_SPRITES.next} pressed={CBUTTONS_SPRITES.nextPressed}
          sheetW={CBUTTONS_SHEET_W} sheetH={CBUTTONS_SHEET_H}
          displayW={BTN_W} displayH={BTN_H}
          onClick={onNext} title="Next" className="compact-transport-btn"
        />
        {hasShufRep && sr ? (
          <ShufRepButton
            dataUrl={sr}
            active={repeatMode !== 'off'}
            normalOff={SHUFREP_SPRITES.repeatOff}
            pressedOff={SHUFREP_SPRITES.repeatOffPressed}
            normalOn={SHUFREP_SPRITES.repeatOn}
            pressedOn={SHUFREP_SPRITES.repeatOnPressed}
            onClick={onCycleRepeat}
            title={`Repeat: ${repeatMode}`}
          />
        ) : (
          <FallbackToggle skin={skin} active={repeatMode !== 'off'} onClick={onCycleRepeat} title={`Repeat: ${repeatMode}`} icon="repeat" repeatMode={repeatMode} />
        )}
      </div>
    )
  }

  // --- Fallback render path (original SVG) ---
  const b = skin.buttons

  const btnBase: React.CSSProperties = {
    background: b.background,
    borderTop: `1px solid ${b.borderLight}`,
    borderLeft: `1px solid ${b.borderLight}`,
    borderRight: `1px solid ${b.borderDark}`,
    borderBottom: `1px solid ${b.borderDark}`,
    boxShadow: b.boxShadow,
    color: b.iconColor,
  }

  const activeStyle: React.CSSProperties = {
    background: b.activeBackground,
    borderTop: `1px solid ${b.borderDark}`,
    borderLeft: `1px solid ${b.borderDark}`,
    borderRight: `1px solid ${b.borderLight}`,
    borderBottom: `1px solid ${b.borderLight}`,
    boxShadow: `inset 0 1px 3px rgba(0,0,0,0.4)`,
    color: b.activeIconColor,
    textShadow: b.activeIconShadow,
  }

  const toggleActiveStyle: React.CSSProperties = {
    ...activeStyle,
    color: b.toggleActiveColor,
    textShadow: b.toggleActiveShadow,
  }

  return (
    <div className="compact-transport">
      <button
        className="compact-transport-btn compact-transport-toggle"
        onClick={onToggleShuffle}
        title="Shuffle"
        style={shuffle ? toggleActiveStyle : btnBase}
      >
        <svg viewBox="0 0 20 20" width="12" height="12">
          <path d="M3 5h2l3 4-3 4H3l3-4zm6 0h2l3 4-3 4h-2l3-4z" fill="currentColor" />
          <path d="M14 4l3 3-3 3M14 10l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      <button className="compact-transport-btn" onClick={onPrev} title="Previous" style={btnBase}>
        <svg viewBox="0 0 20 20" width="14" height="14">
          <rect x="2" y="3" width="3" height="14" fill="currentColor" />
          <polygon points="17,3 17,17 6,10" fill="currentColor" />
        </svg>
      </button>
      <button
        className="compact-transport-btn"
        onClick={onPlay}
        title="Play"
        style={isPlaying ? activeStyle : btnBase}
      >
        <svg viewBox="0 0 20 20" width="14" height="14">
          <polygon points="4,2 4,18 17,10" fill="currentColor" />
        </svg>
      </button>
      <button
        className="compact-transport-btn"
        onClick={onPause}
        title="Pause"
        style={!isPlaying ? activeStyle : btnBase}
      >
        <svg viewBox="0 0 20 20" width="14" height="14">
          <rect x="3" y="2" width="5" height="16" fill="currentColor" />
          <rect x="12" y="2" width="5" height="16" fill="currentColor" />
        </svg>
      </button>
      <button className="compact-transport-btn" onClick={onStop} title="Stop" style={btnBase}>
        <svg viewBox="0 0 20 20" width="14" height="14">
          <rect x="3" y="3" width="14" height="14" fill="currentColor" />
        </svg>
      </button>
      <button className="compact-transport-btn" onClick={onNext} title="Next" style={btnBase}>
        <svg viewBox="0 0 20 20" width="14" height="14">
          <polygon points="3,3 3,17 14,10" fill="currentColor" />
          <rect x="15" y="3" width="3" height="14" fill="currentColor" />
        </svg>
      </button>
      <button
        className="compact-transport-btn compact-transport-toggle"
        onClick={onCycleRepeat}
        title={`Repeat: ${repeatMode}`}
        style={repeatMode !== 'off' ? toggleActiveStyle : btnBase}
      >
        <svg viewBox="0 0 20 20" width="12" height="12">
          <path d="M4 7h10l-2-2M16 13H6l2 2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M4 7v6M16 13V7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          {repeatMode === 'one' && (
            <text x="10" y="12" textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="bold">1</text>
          )}
        </svg>
      </button>
    </div>
  )
}

// --- Shuffle/Repeat sprite button with 4-state logic ---
function ShufRepButton({
  dataUrl, active, normalOff, pressedOff, normalOn, pressedOn, onClick, title,
}: {
  dataUrl: string
  active: boolean
  normalOff: SpriteRegion
  pressedOff: SpriteRegion
  normalOn: SpriteRegion
  pressedOn: SpriteRegion
  onClick: () => void
  title: string
}): React.JSX.Element {
  const [isPressed, setIsPressed] = useState(false)
  const region = active
    ? (isPressed ? pressedOn : normalOn)
    : (isPressed ? pressedOff : normalOff)
  const style = spriteStyleScaled(dataUrl, region, TOGGLE_W, BTN_H, SHUFREP_SHEET_W, SHUFREP_SHEET_H)

  return (
    <button
      className="compact-transport-btn compact-transport-toggle compact-sprite-btn"
      onClick={onClick}
      title={title}
      style={style}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    />
  )
}

// --- Fallback toggle button (used when SHUFREP.BMP missing but CBUTTONS present) ---
function FallbackToggle({
  skin, active, onClick, title, icon, repeatMode,
}: {
  skin: CompactSkin
  active: boolean
  onClick: () => void
  title: string
  icon: 'shuffle' | 'repeat'
  repeatMode?: 'off' | 'one' | 'all'
}): React.JSX.Element {
  const b = skin.buttons
  const btnBase: React.CSSProperties = {
    background: b.background,
    borderTop: `1px solid ${b.borderLight}`,
    borderLeft: `1px solid ${b.borderLight}`,
    borderRight: `1px solid ${b.borderDark}`,
    borderBottom: `1px solid ${b.borderDark}`,
    boxShadow: b.boxShadow,
    color: b.iconColor,
  }
  const toggleActiveStyle: React.CSSProperties = {
    background: b.activeBackground,
    borderTop: `1px solid ${b.borderDark}`,
    borderLeft: `1px solid ${b.borderDark}`,
    borderRight: `1px solid ${b.borderLight}`,
    borderBottom: `1px solid ${b.borderLight}`,
    boxShadow: `inset 0 1px 3px rgba(0,0,0,0.4)`,
    color: b.toggleActiveColor,
    textShadow: b.toggleActiveShadow,
  }

  return (
    <button
      className="compact-transport-btn compact-transport-toggle"
      onClick={onClick}
      title={title}
      style={active ? toggleActiveStyle : btnBase}
    >
      {icon === 'shuffle' ? (
        <svg viewBox="0 0 20 20" width="12" height="12">
          <path d="M3 5h2l3 4-3 4H3l3-4zm6 0h2l3 4-3 4h-2l3-4z" fill="currentColor" />
          <path d="M14 4l3 3-3 3M14 10l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" width="12" height="12">
          <path d="M4 7h10l-2-2M16 13H6l2 2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M4 7v6M16 13V7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          {repeatMode === 'one' && (
            <text x="10" y="12" textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="bold">1</text>
          )}
        </svg>
      )}
    </button>
  )
}
