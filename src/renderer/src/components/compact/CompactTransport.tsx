import type { CompactSkin } from '../../themes/types'

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

export function CompactTransport({
  isPlaying, shuffle, repeatMode,
  onPrev, onPlay, onPause, onStop, onNext,
  onToggleShuffle, onCycleRepeat, skin
}: CompactTransportProps): React.JSX.Element {
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
