import { useCallback, useState } from 'react'
import type { CompactSkin } from '../../themes/types'
import { volumeFrame, VOLUME_SPRITES, spriteStyleScaled } from '../../themes/sprite-constants'

interface CompactVolumeProps {
  volume: number
  onVolumeChange: (volume: number) => void
  skin: CompactSkin
}

const VOLUME_SHEET_W = 68
const VOLUME_SHEET_H = 433
const VOL_DISPLAY_W = 68
const VOL_DISPLAY_H = 15
const THUMB_W = 14
const THUMB_H = 11

export function CompactVolume({ volume, onVolumeChange, skin }: CompactVolumeProps): React.JSX.Element {
  const v = skin.volume
  const sprites = skin.sprites
  const hasVolume = !!sprites?.volumeBmp
  const [thumbPressed, setThumbPressed] = useState(false)

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    onVolumeChange(Math.max(0, Math.min(1, pct)))
  }, [onVolumeChange])

  // --- Sprite render path ---
  if (hasVolume) {
    const dataUrl = sprites!.volumeBmp!
    const frameIdx = Math.round(volume * 27)
    const frame = volumeFrame(frameIdx)
    const frameStyle = spriteStyleScaled(dataUrl, frame, VOL_DISPLAY_W, VOL_DISPLAY_H, VOLUME_SHEET_W, VOLUME_SHEET_H)

    const thumbRegion = thumbPressed ? VOLUME_SPRITES.thumbPressed : VOLUME_SPRITES.thumb
    const thumbStyle = spriteStyleScaled(dataUrl, thumbRegion, THUMB_W, THUMB_H, VOLUME_SHEET_W, VOLUME_SHEET_H)

    return (
      <div className="compact-volume" style={{ width: VOL_DISPLAY_W + 8 }}>
        <div
          className="compact-sprite"
          style={{
            ...frameStyle,
            position: 'relative',
            cursor: 'pointer',
            flex: 1,
          }}
          onClick={handleClick}
          onMouseDown={() => setThumbPressed(true)}
          onMouseUp={() => setThumbPressed(false)}
          onMouseLeave={() => setThumbPressed(false)}
        >
          {/* Thumb overlay */}
          <div
            className="compact-sprite"
            style={{
              ...thumbStyle,
              position: 'absolute',
              left: `calc(${volume * 100}% - ${THUMB_W / 2}px)`,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    )
  }

  // --- Fallback render path ---
  return (
    <div className="compact-volume">
      <svg className="compact-volume-icon" viewBox="0 0 16 16" width="12" height="12" style={{ color: v.iconColor }}>
        <path d="M2 5.5v5h3l4 4V1.5L5 5.5H2z" fill="currentColor" />
        {volume > 0.3 && <path d="M11 4.5c1 .8 1.5 2 1.5 3.5s-.5 2.7-1.5 3.5" stroke="currentColor" fill="none" strokeWidth="1.2" />}
        {volume > 0.6 && <path d="M13 2.5c1.5 1.3 2.5 3.3 2.5 5.5s-1 4.2-2.5 5.5" stroke="currentColor" fill="none" strokeWidth="1.2" />}
      </svg>
      <div className="compact-volume-track" onClick={handleClick}>
        <div className="compact-volume-groove" style={{
          background: v.grooveBg,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
        }}>
          <div className="compact-volume-fill" style={{
            width: `${volume * 100}%`,
            background: v.fillBg,
            boxShadow: v.fillGlow,
          }}>
            <div className="compact-volume-thumb" style={{
              background: v.thumbBg,
              borderTop: `1px solid ${v.thumbBorderLight}`,
              borderLeft: `1px solid ${v.thumbBorderLight}`,
              borderRight: `1px solid ${v.thumbBorderDark}`,
              borderBottom: `1px solid ${v.thumbBorderDark}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}
