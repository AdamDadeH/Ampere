import { useRef, useEffect, useCallback } from 'react'
import { useLibraryStore } from '../stores/library'
import type { PlayerState } from '../../../../preload/index'

const SPECTRUM_BINS = 32
const emptyFrequencyData: number[] = new Array(SPECTRUM_BINS).fill(0)

function buildPlayerState(state: ReturnType<typeof useLibraryStore.getState>, frequencyData: number[]): PlayerState {
  return {
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    duration: state.duration,
    volume: state.volume,
    trackTitle: state.currentTrack!.title || state.currentTrack!.file_name,
    trackArtist: state.currentTrack!.artist,
    trackAlbum: state.currentTrack!.album,
    artworkPath: state.currentTrack!.artwork_path,
    bitrate: state.currentTrack!.bitrate,
    sampleRate: state.currentTrack!.sample_rate,
    codec: state.currentTrack!.codec,
    queueIndex: state.queueIndex,
    queueLength: state.queue.length,
    shuffle: state.shuffle,
    repeatMode: state.repeatMode,
    frequencyData
  }
}

export function AudioEngine(): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const playCountedRef = useRef(false)
  const broadcastIntervalRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const frequencyArrayRef = useRef<Uint8Array | null>(null)
  const analyserInitRef = useRef(false)

  const {
    currentTrack, isPlaying, volume, queue, queueIndex,
    seekTarget, nextTrack, updatePlayCount, setCurrentTime, setDuration,
    shuffle, repeatMode
  } = useLibraryStore()

  // Initialize spectrum analyser using captureStream() — taps audio without rerouting it
  const initAnalyser = useCallback(() => {
    const audio = audioRef.current
    if (!audio || analyserInitRef.current) return
    try {
      // captureStream() creates a MediaStream from the audio element
      // Audio continues to play through speakers normally
      const stream = (audio as HTMLAudioElement & { captureStream(): MediaStream }).captureStream()
      const ctx = new AudioContext()
      if (ctx.state === 'suspended') ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      // Do NOT connect analyser to ctx.destination — audio element handles output
      analyserRef.current = analyser
      frequencyArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
      analyserInitRef.current = true
    } catch (e) {
      console.error('Spectrum analyser init failed (non-fatal):', e)
    }
  }, [])

  const getFrequencyData = useCallback((): number[] => {
    const analyser = analyserRef.current
    const arr = frequencyArrayRef.current
    if (!analyser || !arr) return emptyFrequencyData
    analyser.getByteFrequencyData(arr)
    return Array.from(arr)
  }, [])

  // Send an immediate broadcast to the compact window
  const broadcastNow = useCallback(() => {
    const state = useLibraryStore.getState()
    if (!state.currentTrack) return
    window.api.sendPlayerState(buildPlayerState(state, getFrequencyData()))
  }, [getFrequencyData])

  // Load track when currentTrack changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    playCountedRef.current = false
    setCurrentTime(0)
    setDuration(0)

    window.api.getTrackPath(currentTrack.id).then(url => {
      if (url) {
        audio.src = url
        audio.play().then(() => {
          initAnalyser()
        }).catch(console.error)
        // Immediately broadcast the new track info to compact window
        // (don't wait for the 250ms interval — the window may be throttled)
        setTimeout(broadcastNow, 50)
      }
    })
  }, [currentTrack, setCurrentTime, setDuration, initAnalyser, broadcastNow])

  // Play/pause sync
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    if (isPlaying) {
      audio.play().catch(console.error)
    } else {
      audio.pause()
    }
  }, [isPlaying, currentTrack])

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Seek handling
  useEffect(() => {
    const audio = audioRef.current
    if (seekTarget !== null && audio && audio.duration) {
      audio.currentTime = seekTarget
      useLibraryStore.setState({ seekTarget: null })
    }
  }, [seekTarget])

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    setCurrentTime(audio.currentTime)

    if (!playCountedRef.current) {
      const halfwayPoint = audio.duration * 0.5
      if (audio.currentTime >= 30 || audio.currentTime >= halfwayPoint) {
        playCountedRef.current = true
        updatePlayCount(currentTrack.id)
      }
    }
  }, [currentTrack, updatePlayCount, setCurrentTime])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }, [setDuration])

  const handleEnded = useCallback(() => {
    const { repeatMode, shuffle, queue, queueIndex } = useLibraryStore.getState()

    if (repeatMode === 'one') {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(console.error)
      }
      return
    }

    if (shuffle) {
      nextTrack()
      return
    }

    if (queueIndex < queue.length - 1) {
      nextTrack()
    } else if (repeatMode === 'all' && queue.length > 0) {
      useLibraryStore.setState({
        currentTrack: queue[0],
        queueIndex: 0,
        isPlaying: true
      })
    } else {
      useLibraryStore.setState({ isPlaying: false })
    }
  }, [nextTrack])

  // Broadcast player state to compact window at 4Hz
  useEffect(() => {
    broadcastIntervalRef.current = window.setInterval(() => {
      const state = useLibraryStore.getState()
      if (!state.currentTrack) return
      window.api.sendPlayerState(buildPlayerState(state, getFrequencyData()))
    }, 250)

    return () => {
      if (broadcastIntervalRef.current !== null) {
        clearInterval(broadcastIntervalRef.current)
      }
    }
  }, [getFrequencyData])

  // Listen for remote commands from compact window
  useEffect(() => {
    const unsubscribe = window.api.onPlayerCommand((command: string, ...args: unknown[]) => {
      const store = useLibraryStore.getState()
      switch (command) {
        case 'toggle-play-pause':
          store.togglePlayPause()
          break
        case 'next':
          store.nextTrack()
          break
        case 'prev':
          store.prevTrack()
          break
        case 'stop':
          store.stopPlayback()
          if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
          }
          break
        case 'seek': {
          const time = args[0] as number
          if (audioRef.current && audioRef.current.duration) {
            audioRef.current.currentTime = time
          }
          break
        }
        case 'set-volume': {
          const vol = args[0] as number
          store.setVolume(vol)
          break
        }
        case 'toggle-shuffle':
          store.toggleShuffle()
          break
        case 'cycle-repeat':
          store.cycleRepeat()
          break
        case 'switch-to-library':
          window.api.setWindowMode('library')
          break
      }
    })
    return unsubscribe
  }, [])

  return (
    <audio
      ref={audioRef}
      crossOrigin="anonymous"
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onEnded={handleEnded}
      onError={(e) => console.error('Audio error:', (e.target as HTMLAudioElement).error)}
    />
  )
}
