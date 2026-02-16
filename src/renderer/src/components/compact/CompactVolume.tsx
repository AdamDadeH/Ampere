import { useCallback } from 'react'
import type { CompactSkin } from '../../themes/types'

interface CompactVolumeProps {
  volume: number
  onVolumeChange: (volume: number) => void
  skin: CompactSkin
}

export function CompactVolume({ volume, onVolumeChange, skin }: CompactVolumeProps): React.JSX.Element {
  const v = skin.volume

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    onVolumeChange(Math.max(0, Math.min(1, pct)))
  }, [onVolumeChange])

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
