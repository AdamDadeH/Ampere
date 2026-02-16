import { useCallback } from 'react'
import type { CompactSkin } from '../../themes/types'

interface CompactSeekBarProps {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  skin: CompactSkin
}

export function CompactSeekBar({ currentTime, duration, onSeek, skin }: CompactSeekBarProps): React.JSX.Element {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const s = skin.seekbar

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    onSeek(Math.max(0, Math.min(1, pct)) * duration)
  }, [duration, onSeek])

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
