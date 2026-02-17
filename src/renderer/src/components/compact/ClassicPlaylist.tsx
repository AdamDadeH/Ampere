import { useRef, useState, useCallback } from 'react'
import type { CompactSkin } from '../../themes/types'
import type { PlayerState } from '../../../../../preload/index'

interface ClassicPlaylistProps {
  skin: CompactSkin
  state: PlayerState
  sendCommand: (cmd: string, ...args: unknown[]) => void
}

const PL_WIDTH = 275
const PL_HEIGHT = 116
const ROW_HEIGHT = 13
const HEADER_HEIGHT = 20
const SCROLLBAR_W = 12
const VISIBLE_ROWS = Math.floor((PL_HEIGHT - HEADER_HEIGHT) / ROW_HEIGHT)

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function ClassicPlaylist({ skin, state, sendCommand }: ClassicPlaylistProps): React.JSX.Element {
  const [scrollOffset, setScrollOffset] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const pc = skin.pleditColors || {
    normal: '#00FF00',
    current: '#FFFFFF',
    normBg: '#000000',
    selectBg: '#0000FF',
  }

  const tracks = state.queueTracks || []
  const currentIdx = state.queueIndex
  const totalTracks = tracks.length
  const maxScroll = Math.max(0, totalTracks - VISIBLE_ROWS)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScrollOffset(prev => {
      const next = prev + (e.deltaY > 0 ? 3 : -3)
      return Math.max(0, Math.min(maxScroll, next))
    })
  }, [maxScroll])

  const handleTrackClick = useCallback((index: number) => {
    sendCommand('queue-jump', index)
  }, [sendCommand])

  // Scrollbar geometry
  const hasScrollbar = totalTracks > VISIBLE_ROWS
  const scrollbarTop = HEADER_HEIGHT
  const scrollbarH = PL_HEIGHT - HEADER_HEIGHT
  const thumbH = totalTracks > 0 ? Math.max(10, Math.round((VISIBLE_ROWS / totalTracks) * scrollbarH)) : scrollbarH
  const thumbY = maxScroll > 0 ? scrollbarTop + Math.round((scrollOffset / maxScroll) * (scrollbarH - thumbH)) : scrollbarTop

  const visibleTracks = tracks.slice(scrollOffset, scrollOffset + VISIBLE_ROWS)
  const textWidth = PL_WIDTH - 8 - (hasScrollbar ? SCROLLBAR_W : 0)

  return (
    <div
      style={{
        position: 'relative',
        width: PL_WIDTH,
        height: PL_HEIGHT,
        background: pc.normBg,
        overflow: 'hidden',
        imageRendering: 'pixelated',
      }}
      onWheel={handleWheel}
    >
      {/* Header */}
      <div style={{
        height: HEADER_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: `1px solid ${pc.current}22`,
      }}>
        <span style={{
          color: pc.normal,
          fontSize: 8,
          fontFamily: "'Tahoma', 'Arial', sans-serif",
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {totalTracks > 0 ? `${totalTracks} tracks` : 'Empty playlist'}
        </span>
      </div>

      {/* Track list */}
      <div ref={listRef} style={{ position: 'relative' }}>
        {visibleTracks.map((track, i) => {
          const absIdx = scrollOffset + i
          const isCurrent = absIdx === currentIdx
          return (
            <div
              key={absIdx}
              className="classic-playlist-row"
              style={{
                height: ROW_HEIGHT,
                width: textWidth,
                color: isCurrent ? pc.current : pc.normal,
                background: isCurrent ? pc.selectBg : 'transparent',
                display: 'flex',
                alignItems: 'center',
              }}
              onClick={() => handleTrackClick(absIdx)}
            >
              <span style={{ flexShrink: 0, marginRight: 3 }}>{absIdx + 1}.</span>
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {track.artist && <>{track.artist} - </>}
                {track.title}
              </span>
              <span style={{
                flexShrink: 0,
                marginLeft: 4,
                opacity: 0.7,
              }}>
                {formatDuration(track.duration)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Scrollbar */}
      {hasScrollbar && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: scrollbarTop,
          width: SCROLLBAR_W,
          height: scrollbarH,
          background: pc.normBg,
          borderLeft: `1px solid ${pc.normal}33`,
        }}>
          <div style={{
            position: 'absolute',
            top: thumbY - scrollbarTop,
            left: 2,
            width: SCROLLBAR_W - 4,
            height: thumbH,
            background: pc.normal,
            opacity: 0.5,
            borderRadius: 1,
          }} />
        </div>
      )}
    </div>
  )
}
