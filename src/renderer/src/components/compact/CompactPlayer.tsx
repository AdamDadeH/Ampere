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
