import { useState, useEffect, useCallback, useRef } from 'react'
import { CompactTitleBar } from './CompactTitleBar'
import { CompactLCD } from './CompactLCD'
import { CompactTransport } from './CompactTransport'
import { CompactSeekBar } from './CompactSeekBar'
import { CompactVolume } from './CompactVolume'
import { ClassicWinampLayout } from './ClassicWinampLayout'
import { useCompactSkin, useThemeStore } from '../../stores/theme'
import { importWszSkin } from '../../themes'
import type { PlayerState } from '../../../../../preload/index'
import './compact.css'

const initialState: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  trackTitle: null,
  trackArtist: null,
  trackAlbum: null,
  artworkPath: null,
  bitrate: null,
  sampleRate: null,
  codec: null,
  queueIndex: -1,
  queueLength: 0,
  shuffle: false,
  repeatMode: 'off',
  frequencyData: [],
  eqEnabled: false,
  eqPreamp: 0,
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  queueTracks: [],
}

const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']

export function CompactPlayer(): React.JSX.Element {
  const [state, setState] = useState<PlayerState>(initialState)
  const [easterEgg, setEasterEgg] = useState(true) // show on first render
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const konamiIdx = useRef(0)
  const skin = useCompactSkin()
  const hasCustomSkin = useThemeStore((s) => s.customCompactSkin !== null)
  const setCustomSkin = useThemeStore((s) => s.setCustomCompactSkin)

  // Startup splash — auto-dismiss after 3s
  useEffect(() => {
    if (!easterEgg) return
    const timer = setTimeout(() => setEasterEgg(false), 3000)
    return () => clearTimeout(timer)
  }, [easterEgg])

  // Konami code listener
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === KONAMI[konamiIdx.current]) {
        konamiIdx.current++
        if (konamiIdx.current === KONAMI.length) {
          konamiIdx.current = 0
          setEasterEgg(true)
        }
      } else {
        konamiIdx.current = 0
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.onPlayerStateUpdate((newState) => {
      setState(newState)
    })
    return unsubscribe
  }, [])

  const sendCommand = useCallback((cmd: string, ...args: unknown[]) => {
    window.api.remotePlayerCommand(cmd, ...args)
  }, [])

  const handleSwitchToLibrary = useCallback(() => {
    sendCommand('switch-to-library')
  }, [sendCommand])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleLoadSkin = useCallback(async () => {
    setContextMenu(null)
    const buffer = await window.api.selectWszSkin()
    if (!buffer) return
    try {
      const skin = await importWszSkin(buffer)
      setCustomSkin(skin)
    } catch (err) {
      console.error('Failed to import Winamp skin:', err)
    }
  }, [setCustomSkin])

  const handleClearSkin = useCallback(() => {
    setContextMenu(null)
    setCustomSkin(null)
  }, [setCustomSkin])

  // Dismiss context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (): void => setContextMenu(null)
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu])

  const hasSprites = !!skin.sprites?.mainBmp

  // Restore Ampere size when sprites are cleared
  useEffect(() => {
    if (!hasSprites) window.api.setCompactSize(400, 150)
  }, [hasSprites])

  // Classic Winamp layout when sprites are loaded
  if (hasSprites) {
    return (
      <div onContextMenu={handleContextMenu}>
        <ClassicWinampLayout skin={skin} state={state} sendCommand={sendCommand} />
        {contextMenu && (
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'linear-gradient(180deg, #3a3a3e 0%, #2a2a2e 100%)',
              border: '1px solid #555',
              borderRadius: '4px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              zIndex: 9999,
              padding: '4px 0',
              minWidth: '180px',
              fontFamily: "'Tahoma', 'Arial', sans-serif",
              fontSize: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{ padding: '6px 14px', color: '#e0e0e0', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              onClick={handleLoadSkin}
            >
              Load Winamp Skin...
            </div>
            {hasCustomSkin && (
              <div
                style={{ padding: '6px 14px', color: '#e0e0e0', cursor: 'pointer' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                onClick={handleClearSkin}
              >
                Clear Custom Skin
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const shellStyle: React.CSSProperties = {
    background: skin.shell.background,
    borderTop: skin.shell.borderTop,
    borderLeft: skin.shell.borderLeft,
    borderRight: skin.shell.borderRight,
    borderBottom: skin.shell.borderBottom,
    boxShadow: skin.shell.boxShadow,
    borderRadius: skin.shell.borderRadius,
    fontFamily: skin.shell.fontFamily,
  }

  return (
    <div className="compact-shell" style={shellStyle} onContextMenu={handleContextMenu}>
      <CompactTitleBar onSwitchToLibrary={handleSwitchToLibrary} skin={skin} />
      <div className="compact-body">
        <CompactLCD
          title={state.trackTitle}
          artist={state.trackArtist}
          currentTime={state.currentTime}
          duration={state.duration}
          bitrate={state.bitrate}
          sampleRate={state.sampleRate}
          codec={state.codec}
          isPlaying={state.isPlaying}
          frequencyData={state.frequencyData}
          easterEgg={easterEgg}
          skin={skin}
        />
        <div className="compact-feedback" style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '2px 0' }}>
          <button
            onClick={() => sendCommand('loving-this')}
            title="Loving this"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '2px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#4ade80' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#888' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
          <button
            onClick={() => sendCommand('like-not-now')}
            title="Like, not now"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '2px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#888' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 1.5-.5 2.87-1.35 4h-2.9c1.25-1.1 2.25-2.4 2.25-4 0-2.22-1.78-3.5-3.5-3.5-1.17 0-2.28.63-3 1.57-.72-.94-1.83-1.57-3-1.57C5.78 5 4 6.28 4 8.5c0 3.08 3.08 5.74 8 10.18l.35-.32" />
              <path d="M17 13l4 4M17 17l4-4" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => sendCommand('not-feeling-it')}
            title="Not feeling it"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '2px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#888' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
            </svg>
          </button>
        </div>
        <div className="compact-controls">
          <CompactTransport
            isPlaying={state.isPlaying}
            shuffle={state.shuffle}
            repeatMode={state.repeatMode}
            onPrev={() => sendCommand('prev')}
            onPlay={() => sendCommand('toggle-play-pause')}
            onPause={() => sendCommand('toggle-play-pause')}
            onStop={() => sendCommand('stop')}
            onNext={() => sendCommand('next')}
            onToggleShuffle={() => sendCommand('toggle-shuffle')}
            onCycleRepeat={() => sendCommand('cycle-repeat')}
            skin={skin}
          />
          <CompactSeekBar
            currentTime={state.currentTime}
            duration={state.duration}
            onSeek={(time) => sendCommand('seek', time)}
            skin={skin}
          />
          <CompactVolume
            volume={state.volume}
            onVolumeChange={(vol) => sendCommand('set-volume', vol)}
            skin={skin}
          />
        </div>
      </div>
      <div className="compact-scanlines" style={{ background: skin.scanlines, borderRadius: skin.shell.borderRadius }} />
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'linear-gradient(180deg, #3a3a3e 0%, #2a2a2e 100%)',
            border: '1px solid #555',
            borderRadius: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            zIndex: 9999,
            padding: '4px 0',
            minWidth: '180px',
            fontFamily: "'Tahoma', 'Arial', sans-serif",
            fontSize: '12px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '6px 14px',
              color: '#e0e0e0',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            onClick={handleLoadSkin}
          >
            Load Winamp Skin...
          </div>
          {hasCustomSkin && (
            <div
              style={{
                padding: '6px 14px',
                color: '#e0e0e0',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              onClick={handleClearSkin}
            >
              Clear Custom Skin
            </div>
          )}
        </div>
      )}
    </div>
  )
}
