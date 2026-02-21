import { useRef, useEffect, useCallback } from 'react'
import { useLibraryStore } from '../stores/library'
import type { PlayerState } from '../../../../preload/index'
import { analyserBridge } from '../audio/analyser-bridge'

const SPECTRUM_BINS = 128
const emptyFrequencyData: number[] = new Array(SPECTRUM_BINS).fill(0)

// Standard 10-band Winamp EQ frequencies
const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]

// Cache queueTracks to avoid recomputing on every broadcast
let cachedQueueRef: unknown[] = []
let cachedQueueTracks: { title: string; artist: string | null; duration: number }[] = []

function buildPlayerState(state: ReturnType<typeof useLibraryStore.getState>, frequencyData: number[]): PlayerState {
  // Only recompute queueTracks when the queue array reference changes
  if (state.queue !== cachedQueueRef) {
    cachedQueueRef = state.queue
    cachedQueueTracks = state.queue.map(t => ({
      title: t.title || t.file_name,
      artist: t.artist,
      duration: t.duration,
    }))
  }

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
    frequencyData,
    eqEnabled: state.eqEnabled,
    eqPreamp: state.eqPreamp,
    eqBands: state.eqBands,
    queueTracks: cachedQueueTracks,
  }
}

export function AudioEngine(): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const playCountedRef = useRef(false)
  const broadcastIntervalRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const frequencyArrayRef = useRef<Uint8Array | null>(null)
  const audioInitRef = useRef(false)

  // Web Audio EQ chain refs
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const preampGainRef = useRef<GainNode | null>(null)
  const eqFiltersRef = useRef<BiquadFilterNode[]>([])

  const {
    currentTrack, isPlaying, volume, queue, queueIndex,
    seekTarget, nextTrack, updatePlayCount, setCurrentTime, setDuration,
    shuffle, repeatMode, eqEnabled, eqPreamp, eqBands
  } = useLibraryStore()

  // Initialize full Web Audio chain:
  // <audio> → MediaElementSource → preampGain → band[0] → ... → band[9] → destination
  //                                                                       ↘ analyser
  const initAudioChain = useCallback(() => {
    const audio = audioRef.current
    if (!audio || audioInitRef.current) return
    try {
      const ctx = new AudioContext()
      if (ctx.state === 'suspended') ctx.resume()

      const source = ctx.createMediaElementSource(audio)
      const preamp = ctx.createGain()
      source.connect(preamp)

      // Build 10-band peaking EQ filter chain
      const filters: BiquadFilterNode[] = []
      let prevNode: AudioNode = preamp
      for (let i = 0; i < 10; i++) {
        const filter = ctx.createBiquadFilter()
        filter.type = 'peaking'
        filter.frequency.value = EQ_FREQUENCIES[i]
        filter.Q.value = 1.4
        filter.gain.value = 0
        prevNode.connect(filter)
        filters.push(filter)
        prevNode = filter
      }

      // Connect last filter to destination
      prevNode.connect(ctx.destination)

      // Connect last filter to analyser too
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      prevNode.connect(analyser)

      audioCtxRef.current = ctx
      sourceRef.current = source
      preampGainRef.current = preamp
      eqFiltersRef.current = filters
      analyserRef.current = analyser
      analyserBridge.node = analyser
      frequencyArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
      audioInitRef.current = true
    } catch (e) {
      console.error('Audio chain init failed (non-fatal):', e)
    }
  }, [])

  // Sync EQ enabled/bands/preamp to Web Audio nodes
  useEffect(() => {
    const preamp = preampGainRef.current
    const filters = eqFiltersRef.current
    if (!preamp || filters.length === 0) return

    // Preamp gain: convert dB to linear
    preamp.gain.value = eqEnabled ? Math.pow(10, eqPreamp / 20) : 1

    // Band gains: set to 0 when disabled (flat response)
    for (let i = 0; i < filters.length && i < eqBands.length; i++) {
      filters[i].gain.value = eqEnabled ? eqBands[i] : 0
    }
  }, [eqEnabled, eqPreamp, eqBands])

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

  // Load track when the track *identity* changes (not when metadata like rating updates)
  const currentTrackId = currentTrack?.id ?? null
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrackId) return

    playCountedRef.current = false
    setCurrentTime(0)
    setDuration(0)

    window.api.getTrackPath(currentTrackId).then(url => {
      if (url) {
        audio.src = url
        audio.play().then(() => {
          initAudioChain()
        }).catch(console.error)
        // Immediately broadcast the new track info to compact window
        setTimeout(broadcastNow, 50)
      }
    })
  }, [currentTrackId, setCurrentTime, setDuration, initAudioChain, broadcastNow])

  // Play/pause sync
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrackId) return

    if (isPlaying) {
      audio.play().catch(console.error)
    } else {
      audio.pause()
    }
  }, [isPlaying, currentTrackId])

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
        case 'set-eq-enabled': {
          const enabled = args[0] as boolean
          store.setEqEnabled(enabled)
          break
        }
        case 'set-eq-band': {
          const index = args[0] as number
          const gain = args[1] as number
          store.setEqBand(index, gain)
          break
        }
        case 'set-eq-preamp': {
          const gain = args[0] as number
          store.setEqPreamp(gain)
          break
        }
        case 'queue-jump': {
          const index = args[0] as number
          if (index >= 0 && index < store.queue.length) {
            useLibraryStore.setState({
              currentTrack: store.queue[index],
              queueIndex: index,
              isPlaying: true,
            })
          }
          break
        }
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
