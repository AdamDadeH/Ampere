import { useState, useEffect, useRef, useCallback } from 'react'
import type { CompactSkin } from '../../themes/types'
import type { PlayerState } from '../../../../../preload/index'
import {
  WINAMP_LAYOUT as L,
  CBUTTONS_SPRITES,
  POSBAR_SPRITES,
  VOLUME_SPRITES,
  SHUFREP_SPRITES,
  TITLEBAR_SPRITES,
  PLAYPAUS_SPRITES,
  MONOSTER_SPRITES,
  NUMBERS_CHAR_MAP,
  TEXT_CHAR_MAP,
  spriteStyle,
  volumeFrame,
  type SpriteRegion,
} from '../../themes/sprite-constants'
import { ClassicEQ } from './ClassicEQ'
import { ClassicPlaylist } from './ClassicPlaylist'

const SCALE = 2

interface ClassicWinampLayoutProps {
  skin: CompactSkin
  state: PlayerState
  sendCommand: (cmd: string, ...args: unknown[]) => void
}

// --- Small sprite button at 1x native size ---
function ClassicSpriteBtn({
  dataUrl, normal, pressed, onClick, style: extraStyle, title,
}: {
  dataUrl: string
  normal: SpriteRegion
  pressed: SpriteRegion
  onClick: () => void
  style?: React.CSSProperties
  title?: string
}): React.JSX.Element {
  const [isPressed, setIsPressed] = useState(false)
  const region = isPressed ? pressed : normal
  const s = spriteStyle(dataUrl, region)
  return (
    <button
      className="classic-no-drag"
      onClick={onClick}
      title={title}
      style={{
        ...s,
        ...extraStyle,
        position: 'absolute' as const,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        backgroundColor: 'transparent',
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    />
  )
}

// --- 4-state toggle button (off/pressed, on/pressed) ---
function ClassicToggleBtn({
  dataUrl, active, normalOff, pressedOff, normalOn, pressedOn, onClick, style: extraStyle, title,
}: {
  dataUrl: string
  active: boolean
  normalOff: SpriteRegion
  pressedOff: SpriteRegion
  normalOn: SpriteRegion
  pressedOn: SpriteRegion
  onClick: () => void
  style?: React.CSSProperties
  title?: string
}): React.JSX.Element {
  const [isPressed, setIsPressed] = useState(false)
  const region = active
    ? (isPressed ? pressedOn : normalOn)
    : (isPressed ? pressedOff : normalOff)
  const s = spriteStyle(dataUrl, region)
  return (
    <button
      className="classic-no-drag"
      onClick={onClick}
      title={title}
      style={{
        ...s,
        ...extraStyle,
        position: 'absolute' as const,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        backgroundColor: 'transparent',
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    />
  )
}

// --- Bitmap number digits at 1x ---
function ClassicDigits({ text, dataUrl }: { text: string; dataUrl: string }): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex' }}>
      {text.split('').map((ch, i) => {
        if (ch === ':') {
          return <span key={i} style={{ display: 'inline-block', width: 5, height: 13 }} />
        }
        const region = NUMBERS_CHAR_MAP[ch]
        if (!region) return <span key={i} style={{ display: 'inline-block', width: 9, height: 13 }} />
        return <span key={i} style={spriteStyle(dataUrl, region)} />
      })}
    </span>
  )
}

// --- Bitmap text marquee at 1x ---
function ClassicMarquee({ text, dataUrl, containerWidth }: {
  text: string; dataUrl: string; containerWidth: number
}): React.JSX.Element {
  const [offset, setOffset] = useState(0)
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef(0)
  const upper = text.toUpperCase()
  const charW = 5
  const textWidth = upper.length * charW

  useEffect(() => {
    if (textWidth <= containerWidth) {
      setOffset(0)
      return
    }
    const animate = (ts: number): void => {
      if (!lastTimeRef.current) lastTimeRef.current = ts
      const dt = ts - lastTimeRef.current
      lastTimeRef.current = ts
      setOffset(prev => {
        const next = prev - dt * 0.03
        if (Math.abs(next) > textWidth + 20) return containerWidth
        return next
      })
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [textWidth, containerWidth])

  return (
    <div style={{ overflow: 'hidden', width: containerWidth, height: 6 }}>
      <div style={{ display: 'flex', transform: `translateX(${offset}px)`, willChange: 'transform' }}>
        {upper.split('').map((ch, i) => {
          const region = TEXT_CHAR_MAP[ch]
          if (!region) return <span key={i} style={{ display: 'inline-block', width: charW, height: 6 }} />
          return <span key={i} style={spriteStyle(dataUrl, region)} />
        })}
      </div>
    </div>
  )
}

// --- Spectrum canvas at native 76x16 ---
function ClassicSpectrum({ data, barColorRgb }: {
  data: number[]; barColorRgb: [number, number, number]
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 76, 16)
    if (!data || data.length === 0) return
    const bins = Math.min(data.length, 19)
    const barW = 3
    const gap = 1
    for (let i = 0; i < bins; i++) {
      const val = data[i] / 255
      const h = val * 16
      const x = i * (barW + gap)
      const brightness = 0.5 + val * 0.5
      ctx.fillStyle = `rgba(${barColorRgb[0]}, ${barColorRgb[1]}, ${barColorRgb[2]}, ${brightness})`
      ctx.fillRect(x, 16 - h, barW, h)
    }
  }, [data, barColorRgb])

  return (
    <canvas
      ref={canvasRef}
      width={76}
      height={16}
      style={{ width: 76, height: 16, imageRendering: 'pixelated' as const }}
    />
  )
}

export function ClassicWinampLayout({ skin, state, sendCommand }: ClassicWinampLayoutProps): React.JSX.Element {
  const [eqVisible, setEqVisible] = useState(false)
  const [plVisible, setPlVisible] = useState(false)
  const [seekDragging, setSeeking] = useState(false)
  const [seekPos, setSeekPos] = useState(0)
  const [volDragging, setVolDragging] = useState(false)
  const [volPos, setVolPos] = useState(state.volume)
  const seekBarRef = useRef<HTMLDivElement>(null)
  const volBarRef = useRef<HTMLDivElement>(null)
  const sprites = skin.sprites!

  const totalH = L.height + (eqVisible ? 116 : 0) + (plVisible ? 116 : 0)

  // Resize window when panels toggle
  useEffect(() => {
    window.api.setCompactSize(L.width * SCALE, totalH * SCALE)
  }, [totalH])

  // Sync volume position from state when not dragging
  useEffect(() => {
    if (!volDragging) setVolPos(state.volume)
  }, [state.volume, volDragging])

  // --- Seek bar interaction ---
  const seekProgress = seekDragging ? seekPos : (state.duration > 0 ? state.currentTime / state.duration : 0)

  const handleSeekMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const bar = seekBarRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setSeekPos(pct)
    setSeeking(true)

    const onMove = (ev: MouseEvent): void => {
      const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      setSeekPos(p)
    }
    const onUp = (ev: MouseEvent): void => {
      const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      sendCommand('seek', p * state.duration)
      setSeeking(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [state.duration, sendCommand])

  // --- Volume interaction ---
  const handleVolMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const bar = volBarRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setVolPos(pct)
    setVolDragging(true)
    sendCommand('set-volume', pct)

    const onMove = (ev: MouseEvent): void => {
      const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      setVolPos(p)
      sendCommand('set-volume', p)
    }
    const onUp = (): void => {
      setVolDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sendCommand])

  // --- Time display ---
  const mins = Math.floor(state.currentTime / 60)
  const secs = Math.floor(state.currentTime % 60)
  const timeStr = `${mins.toString().padStart(2, ' ')}${secs.toString().padStart(2, '0')}`

  // --- Seek thumb position ---
  const seekThumbX = L.seekbar.x + Math.round(seekProgress * (L.seekbar.w - 29))

  // --- Volume frame ---
  const volFrameIdx = Math.min(27, Math.round(volPos * 27))
  const volThumbX = L.volume.x + Math.round(volPos * (L.volume.w - 14))

  // --- Bitrate/kHz text ---
  const kbpsStr = state.bitrate ? `${Math.round(state.bitrate / 1000)}` : ''
  const khzStr = state.sampleRate ? `${Math.round(state.sampleRate / 1000)}` : ''

  // --- Display text ---
  const displayText = [state.trackArtist, state.trackTitle].filter(Boolean).join(' - ') || 'No track'

  return (
    <div
      className="classic-winamp-outer"
      style={{
        width: L.width,
        height: totalH,
        transform: `scale(${SCALE})`,
        transformOrigin: 'top left',
      }}
    >
      {/* ===== MAIN WINDOW ===== */}
      <div style={{
        position: 'relative',
        width: L.width,
        height: L.height,
        backgroundImage: `url(${sprites.mainBmp})`,
        backgroundSize: `${L.width}px ${L.height}px`,
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
      }}>
        {/* --- Titlebar --- */}
        {sprites.titlebarBmp && (
          <div style={{
            position: 'absolute',
            left: L.titlebar.x,
            top: L.titlebar.y,
            width: L.titlebar.w,
            height: L.titlebar.h,
            ...spriteStyle(sprites.titlebarBmp, TITLEBAR_SPRITES.active),
            display: 'block',
          }}>
            <div className="classic-titlebar-drag" style={{ position: 'absolute', inset: 0 }} />
            {/* Minimize */}
            <ClassicSpriteBtn
              dataUrl={sprites.titlebarBmp}
              normal={TITLEBAR_SPRITES.minimize}
              pressed={TITLEBAR_SPRITES.minimizePressed}
              onClick={() => window.api.windowMinimize()}
              style={{ right: 18, top: 3 }}
              title="Minimize"
            />
            {/* Shade */}
            <ClassicSpriteBtn
              dataUrl={sprites.titlebarBmp}
              normal={TITLEBAR_SPRITES.shade}
              pressed={TITLEBAR_SPRITES.shadePressed}
              onClick={() => {}}
              style={{ right: 9, top: 3 }}
              title="Shade"
            />
            {/* Close */}
            <ClassicSpriteBtn
              dataUrl={sprites.titlebarBmp}
              normal={TITLEBAR_SPRITES.close}
              pressed={TITLEBAR_SPRITES.closePressed}
              onClick={() => window.api.windowClose()}
              style={{ right: 0, top: 3 }}
              title="Close"
            />
          </div>
        )}
        {!sprites.titlebarBmp && (
          <div className="classic-titlebar-drag" style={{
            position: 'absolute',
            left: 0, top: 0,
            width: L.width, height: L.titlebar.h,
          }} />
        )}

        {/* --- Play status indicator --- */}
        {sprites.playpausBmp && (
          <div style={{
            position: 'absolute',
            left: L.playpaus.x,
            top: L.playpaus.y,
            ...spriteStyle(sprites.playpausBmp,
              state.isPlaying ? PLAYPAUS_SPRITES.playing :
              PLAYPAUS_SPRITES.stopped
            ),
          }} />
        )}

        {/* --- Mono/Stereo indicator --- */}
        {sprites.monosterBmp && (
          <div style={{ position: 'absolute', left: L.monoster.x, top: L.monoster.y }}>
            <span style={{
              ...spriteStyle(sprites.monosterBmp, MONOSTER_SPRITES.monoInactive),
              position: 'absolute',
              left: 29, top: 0,
            }} />
            <span style={spriteStyle(sprites.monosterBmp, MONOSTER_SPRITES.stereoActive)} />
          </div>
        )}

        {/* --- Time display --- */}
        {sprites.numbersBmp && (
          <div style={{ position: 'absolute', left: L.time.x, top: L.time.y }}>
            <ClassicDigits text={timeStr} dataUrl={sprites.numbersBmp} />
          </div>
        )}

        {/* --- Marquee text --- */}
        {sprites.textBmp && (
          <div style={{ position: 'absolute', left: L.marquee.x, top: L.marquee.y }}>
            <ClassicMarquee text={displayText} dataUrl={sprites.textBmp} containerWidth={L.marquee.w} />
          </div>
        )}

        {/* --- Kbps / kHz text --- */}
        {sprites.textBmp && (
          <>
            <div style={{ position: 'absolute', left: L.kbps.x, top: L.kbps.y }}>
              {kbpsStr.split('').map((ch, i) => {
                const region = TEXT_CHAR_MAP[ch]
                if (!region) return <span key={i} style={{ display: 'inline-block', width: 5, height: 6 }} />
                return <span key={i} style={spriteStyle(sprites.textBmp!, region)} />
              })}
            </div>
            <div style={{ position: 'absolute', left: L.khz.x, top: L.khz.y }}>
              {khzStr.split('').map((ch, i) => {
                const region = TEXT_CHAR_MAP[ch]
                if (!region) return <span key={i} style={{ display: 'inline-block', width: 5, height: 6 }} />
                return <span key={i} style={spriteStyle(sprites.textBmp!, region)} />
              })}
            </div>
          </>
        )}

        {/* --- Spectrum analyzer --- */}
        <div style={{ position: 'absolute', left: L.spectrum.x, top: L.spectrum.y }}>
          <ClassicSpectrum data={state.frequencyData} barColorRgb={skin.spectrum.barColorRgb} />
        </div>

        {/* --- Seek bar --- */}
        {sprites.posbarBmp && (
          <div
            ref={seekBarRef}
            style={{
              position: 'absolute',
              left: L.seekbar.x,
              top: L.seekbar.y,
              width: L.seekbar.w,
              height: L.seekbar.h,
              ...spriteStyle(sprites.posbarBmp, POSBAR_SPRITES.track),
              cursor: 'pointer',
            }}
            onMouseDown={handleSeekMouseDown}
          >
            {/* Seek thumb */}
            <div style={{
              position: 'absolute',
              left: seekThumbX - L.seekbar.x,
              top: 0,
              ...spriteStyle(sprites.posbarBmp, seekDragging ? POSBAR_SPRITES.thumbPressed : POSBAR_SPRITES.thumb),
            }} />
          </div>
        )}

        {/* --- Transport buttons --- */}
        {sprites.cButtonsBmp && (
          <>
            <ClassicSpriteBtn
              dataUrl={sprites.cButtonsBmp}
              normal={CBUTTONS_SPRITES.previous}
              pressed={CBUTTONS_SPRITES.previousPressed}
              onClick={() => sendCommand('prev')}
              style={{ left: L.prev.x, top: L.prev.y }}
              title="Previous"
            />
            <ClassicSpriteBtn
              dataUrl={sprites.cButtonsBmp}
              normal={CBUTTONS_SPRITES.play}
              pressed={CBUTTONS_SPRITES.playPressed}
              onClick={() => sendCommand('toggle-play-pause')}
              style={{ left: L.play.x, top: L.play.y }}
              title="Play"
            />
            <ClassicSpriteBtn
              dataUrl={sprites.cButtonsBmp}
              normal={CBUTTONS_SPRITES.pause}
              pressed={CBUTTONS_SPRITES.pausePressed}
              onClick={() => sendCommand('toggle-play-pause')}
              style={{ left: L.pause.x, top: L.pause.y }}
              title="Pause"
            />
            <ClassicSpriteBtn
              dataUrl={sprites.cButtonsBmp}
              normal={CBUTTONS_SPRITES.stop}
              pressed={CBUTTONS_SPRITES.stopPressed}
              onClick={() => sendCommand('stop')}
              style={{ left: L.stop.x, top: L.stop.y }}
              title="Stop"
            />
            <ClassicSpriteBtn
              dataUrl={sprites.cButtonsBmp}
              normal={CBUTTONS_SPRITES.next}
              pressed={CBUTTONS_SPRITES.nextPressed}
              onClick={() => sendCommand('next')}
              style={{ left: L.next.x, top: L.next.y }}
              title="Next"
            />
            <ClassicSpriteBtn
              dataUrl={sprites.cButtonsBmp}
              normal={CBUTTONS_SPRITES.eject}
              pressed={CBUTTONS_SPRITES.ejectPressed}
              onClick={() => {}}
              style={{ left: L.eject.x, top: L.eject.y }}
              title="Eject"
            />
          </>
        )}

        {/* --- Volume slider --- */}
        {sprites.volumeBmp && (
          <div
            ref={volBarRef}
            style={{
              position: 'absolute',
              left: L.volume.x,
              top: L.volume.y,
              width: L.volume.w,
              height: L.volume.h,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
            onMouseDown={handleVolMouseDown}
          >
            {/* Volume frame background */}
            <div style={{
              position: 'absolute',
              left: 0, top: 0,
              ...spriteStyle(sprites.volumeBmp, volumeFrame(volFrameIdx)),
            }} />
            {/* Volume thumb */}
            <div style={{
              position: 'absolute',
              left: volThumbX - L.volume.x,
              top: 1,
              ...spriteStyle(sprites.volumeBmp, volDragging ? VOLUME_SPRITES.thumbPressed : VOLUME_SPRITES.thumb),
            }} />
          </div>
        )}

        {/* --- Shuffle / Repeat --- */}
        {sprites.shufrepBmp && (
          <>
            <ClassicToggleBtn
              dataUrl={sprites.shufrepBmp}
              active={state.shuffle}
              normalOff={SHUFREP_SPRITES.shuffleOff}
              pressedOff={SHUFREP_SPRITES.shuffleOffPressed}
              normalOn={SHUFREP_SPRITES.shuffleOn}
              pressedOn={SHUFREP_SPRITES.shuffleOnPressed}
              onClick={() => sendCommand('toggle-shuffle')}
              style={{ left: L.shuffle.x, top: L.shuffle.y }}
              title="Shuffle"
            />
            <ClassicToggleBtn
              dataUrl={sprites.shufrepBmp}
              active={state.repeatMode !== 'off'}
              normalOff={SHUFREP_SPRITES.repeatOff}
              pressedOff={SHUFREP_SPRITES.repeatOffPressed}
              normalOn={SHUFREP_SPRITES.repeatOn}
              pressedOn={SHUFREP_SPRITES.repeatOnPressed}
              onClick={() => sendCommand('cycle-repeat')}
              style={{ left: L.repeat.x, top: L.repeat.y }}
              title={`Repeat: ${state.repeatMode}`}
            />
            {/* EQ toggle */}
            <ClassicToggleBtn
              dataUrl={sprites.shufrepBmp}
              active={eqVisible}
              normalOff={SHUFREP_SPRITES.eqOff}
              pressedOff={SHUFREP_SPRITES.eqOff}
              normalOn={SHUFREP_SPRITES.eqOn}
              pressedOn={SHUFREP_SPRITES.eqOn}
              onClick={() => setEqVisible(v => !v)}
              style={{ left: L.eqBtn.x, top: L.eqBtn.y }}
              title="Equalizer"
            />
            {/* PL toggle */}
            <ClassicToggleBtn
              dataUrl={sprites.shufrepBmp}
              active={plVisible}
              normalOff={SHUFREP_SPRITES.plOff}
              pressedOff={SHUFREP_SPRITES.plOff}
              normalOn={SHUFREP_SPRITES.plOn}
              pressedOn={SHUFREP_SPRITES.plOn}
              onClick={() => setPlVisible(v => !v)}
              style={{ left: L.plBtn.x, top: L.plBtn.y }}
              title="Playlist"
            />
          </>
        )}
      </div>

      {/* ===== EQ PANEL ===== */}
      {eqVisible && (
        <ClassicEQ
          skin={skin}
          state={state}
          sendCommand={sendCommand}
        />
      )}

      {/* ===== PLAYLIST PANEL ===== */}
      {plVisible && (
        <ClassicPlaylist
          skin={skin}
          state={state}
          sendCommand={sendCommand}
        />
      )}
    </div>
  )
}
