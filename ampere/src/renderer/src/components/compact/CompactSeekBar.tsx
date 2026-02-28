import { useCallback, useState } from 'react'
import type { CompactSkin } from '../../themes/types'
import { POSBAR_SPRITES, spriteStyleScaled } from '../../themes/sprite-constants'

interface CompactSeekBarProps {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  skin: CompactSkin
}

const POSBAR_SHEET_W = 307
const POSBAR_SHEET_H = 10
const GROOVE_H = 12 // display height for the groove
const THUMB_W = 29
const THUMB_H = 12

export function CompactSeekBar({ currentTime, duration, onSeek, skin }: CompactSeekBarProps): React.JSX.Element {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const s = skin.seekbar
  const sprites = skin.sprites
  const hasPosbar = !!sprites?.posbarBmp
  const [thumbPressed, setThumbPressed] = useState(false)

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    onSeek(Math.max(0, Math.min(1, pct)) * duration)
  }, [duration, onSeek])

  // --- Sprite render path ---
  if (hasPosbar) {
    const dataUrl = sprites!.posbarBmp!
    const thumbRegion = thumbPressed ? POSBAR_SPRITES.thumbPressed : POSBAR_SPRITES.thumb
    const thumbStyle = spriteStyleScaled(dataUrl, thumbRegion, THUMB_W, THUMB_H, POSBAR_SHEET_W, POSBAR_SHEET_H)

    return (
      <div
        className="compact-seekbar"
        onClick={handleClick}
        onMouseDown={() => setThumbPressed(true)}
        onMouseUp={() => setThumbPressed(false)}
        onMouseLeave={() => setThumbPressed(false)}
      >
        <div
          className="compact-sprite"
          style={{
            height: GROOVE_H,
            position: 'relative',
            overflow: 'visible',
            backgroundImage: `url(${dataUrl})`,
            backgroundPosition: `-${POSBAR_SPRITES.track.x}px -${POSBAR_SPRITES.track.y}px`,
            backgroundSize: `${POSBAR_SHEET_W * (1)}px ${GROOVE_H}px`,
            backgroundRepeat: 'repeat-x',
          }}
        >
          {/* Thumb positioned at current progress */}
          <div
            className="compact-sprite"
            style={{
              ...thumbStyle,
              position: 'absolute',
              left: `calc(${progress}% - ${THUMB_W / 2}px)`,
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>
    )
  }

  // --- Fallback render path ---
  return (
    <div className="compact-seekbar" onClick={handleClick}>
      <div className="compact-seekbar-groove" style={{
        background: s.grooveBg,
        borderTop: s.borderTop,
        borderLeft: s.borderLeft,
        borderRight: s.borderRight,
        borderBottom: s.borderBottom,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
      }}>
        <div className="compact-seekbar-fill" style={{
          width: `${progress}%`,
          background: s.fillBg,
          boxShadow: s.fillGlow,
        }}>
          <div className="compact-seekbar-thumb" style={{
            background: s.thumbBg,
            borderTop: `1px solid ${s.thumbBorderLight}`,
            borderLeft: `1px solid ${s.thumbBorderLight}`,
            borderRight: `1px solid ${s.thumbBorderDark}`,
            borderBottom: `1px solid ${s.thumbBorderDark}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }} />
        </div>
      </div>
    </div>
  )
}
