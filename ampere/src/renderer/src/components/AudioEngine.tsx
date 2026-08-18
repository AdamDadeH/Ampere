import { useRef, useEffect, useCallback } from 'react'
import { useLibraryStore } from '../stores/library'
import { analyserBridge } from '../audio/analyser-bridge'
import { runBroadcastTick } from '../audio/player-broadcast'
import { recordInteraction, setForeground } from '../stores/attention'

const SPECTRUM_BINS = 128
const emptyFrequencyData: number[] = new Array(SPECTRUM_BINS).fill(0)

// Standard 10-band Winamp EQ frequencies
const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]

/** Consecutive unplayable tracks before advancing stops, so a bad run cannot spin. */
const MAX_CONSECUTIVE_SKIPS = 5

export function AudioEngine(): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const playCountedRef = useRef(false)
  const broadcastIntervalRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const frequencyArrayRef = useRef<Uint8Array | null>(null)
  const audioInitRef = useRef(false)
  // The compact (Winamp) window is the only consumer of broadcast frames.
  // When it's closed we skip the whole 4Hz loop (frequency extraction + IPC).
  const compactOpenRef = useRef(false)

  // Pause-abandon tracking
  const pauseTimestampRef = useRef<number | null>(null)
  const pausedTrackIdRef = useRef<string | null>(null)

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

  // Send an immediate broadcast to the compact window (no-op if it's closed)
  const broadcastNow = useCallback(() => {
    runBroadcastTick({
      compactOpen: compactOpenRef.current,
      state: useLibraryStore.getState(),
      getFrequencyData,
      send: (s) => window.api.sendPlayerState(s),
    })
  }, [getFrequencyData])

  // Load track when the track *identity* changes (not when metadata like rating updates)
  const currentTrackId = currentTrack?.id ?? null
  const consecutiveFailuresRef = useRef(0)
  const failedTrackRef = useRef<string | null>(null)

  /**
   * Move past a track that cannot be played.
   *
   * Advances with no reason argument, so nothing is written to the feedback
   * log. A file that failed to load is not a skip the listener performed, and
   * recording it as one would put fabricated rejections into the data the
   * recommender learns from.
   *
   * Stops after a run of failures rather than racing through the library: if
   * a whole album is unreadable, the listener should see the error, not watch
   * the player churn.
   */
  const skipUnplayable = useCallback((trackId: string) => {
    if (failedTrackRef.current === trackId) return
    failedTrackRef.current = trackId
    consecutiveFailuresRef.current += 1
    if (consecutiveFailuresRef.current > MAX_CONSECUTIVE_SKIPS) return

    setTimeout(() => {
      const store = useLibraryStore.getState()
      if (store.currentTrack?.id !== trackId) return
      store.nextTrack()
    }, 700)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrackId) return

    playCountedRef.current = false
    setCurrentTime(0)
    setDuration(0)

    const store = useLibraryStore.getState()
    store.clearPlaybackError()

    // Every branch below either plays or reports. Silence is what made a
    // moved file look like the player hanging.
    const fail = (reason: string): void => {
      if (useLibraryStore.getState().currentTrack?.id !== currentTrackId) return
      useLibraryStore.setState({ downloadingTrackId: null })
      useLibraryStore.getState().reportPlaybackError(currentTrackId, reason)
      skipUnplayable(currentTrackId)
    }

    const start = (url: string): void => {
      audio.src = url
      audio.play().then(() => {
        consecutiveFailuresRef.current = 0
        failedTrackRef.current = null
        initAudioChain()
      }).catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)))
      setTimeout(broadcastNow, 50)
    }

    window.api.getTrackPath(currentTrackId).then(async (result: {
      url: string; available: boolean; missing?: boolean; unplayable?: boolean
    } | null) => {
      if (!result) { fail('Track is no longer in the library'); return }
      if (result.missing) { fail('File not found on disk'); return }
      if (result.unplayable) { fail('File contains no playable audio'); return }

      if (result.available) {
        start(result.url)
        return
      }

      useLibraryStore.setState({ downloadingTrackId: currentTrackId })
      const ready = await window.api.requestTrackDownload(currentTrackId)
      if (useLibraryStore.getState().currentTrack?.id !== currentTrackId) return
      useLibraryStore.setState({ downloadingTrackId: null })

      if (ready) start(result.url)
      else fail('Could not download from cloud storage')
    }).catch((err) => fail(String(err?.message ?? err)))
  }, [currentTrackId, setCurrentTime, setDuration, initAudioChain, broadcastNow])

  // Prefetch upcoming tracks after current track starts loading
  useEffect(() => {
    if (!currentTrackId) return
    const timer = setTimeout(() => {
      const ids = useLibraryStore.getState().getUpcomingTrackIds(3)
      if (ids.length > 0) {
        window.api.prefetchTracks(ids).catch(console.error)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [currentTrackId])

  // Play/pause sync + pause-abandon tracking
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrackId) return

    if (isPlaying) {
      // Check for pause-abandon: was a different track playing when we paused > 30s ago?
      if (pauseTimestampRef.current && pausedTrackIdRef.current) {
        const pauseDuration = (Date.now() - pauseTimestampRef.current) / 1000
        if (pauseDuration > 30 && pausedTrackIdRef.current !== currentTrackId) {
          const store = useLibraryStore.getState()
          store.recordFeedback(pausedTrackIdRef.current, 'pause_abandon', pauseDuration, null)
        }
      }
      pauseTimestampRef.current = null
      pausedTrackIdRef.current = null
      audio.play().catch(console.error)
    } else {
      pauseTimestampRef.current = Date.now()
      pausedTrackIdRef.current = currentTrackId
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
    const { repeatMode } = useLibraryStore.getState()

    if (repeatMode === 'one') {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(console.error)
      }
      return
    }

    // nextTrack handles shuffle, sequential, and repeat-all wrap
    nextTrack('auto_advance')
  }, [nextTrack])

  // Broadcast player state to compact window at 4Hz — only while it's open
  useEffect(() => {
    broadcastIntervalRef.current = window.setInterval(() => {
      runBroadcastTick({
        compactOpen: compactOpenRef.current,
        state: useLibraryStore.getState(),
        getFrequencyData,
        send: (s) => window.api.sendPlayerState(s),
      })
    }, 250)

    return () => {
      if (broadcastIntervalRef.current !== null) {
        clearInterval(broadcastIntervalRef.current)
      }
    }
  }, [getFrequencyData])

  // Track compact-window presence; broadcast immediately when it opens so it
  // doesn't wait up to 250ms for its first frame.
  useEffect(() => {
    const unsubscribe = window.api.onCompactPresence((open: boolean) => {
      compactOpenRef.current = open
      if (open) broadcastNow()
    })
    return unsubscribe
  }, [broadcastNow])

  // Listen for remote commands from compact window
  useEffect(() => {
    const unsubscribe = window.api.onPlayerCommand((command: string, ...args: unknown[]) => {
      const store = useLibraryStore.getState()
      // The command came from the compact window, so that is the surface the
      // user acted from — not whatever view this renderer happens to show.
      store.setActiveSurface('compact')
      switch (command) {
        case 'toggle-play-pause':
          store.togglePlayPause()
          break
        case 'next':
          store.nextTrack('manual_skip')
          break
        case 'loving-this':
          store.lovingThis()
          break
        case 'like-not-now':
          store.likeNotNow()
          break
        case 'not-feeling-it':
          store.notFeelingIt()
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

  // Listen for inferred rating updates from main process
  useEffect(() => {
    const unsubscribe = window.api.onInferredRatingsUpdated((ratings) => {
      useLibraryStore.getState().applyInferredRatings(ratings)
    })
    return unsubscribe
  }, [])

  // Attention tracking: record user interactions and foreground state
  useEffect(() => {
    const onInteraction = (): void => recordInteraction()
    const onFocus = (): void => setForeground(true)
    const onBlur = (): void => setForeground(false)

    window.addEventListener('click', onInteraction)
    window.addEventListener('keydown', onInteraction)
    window.addEventListener('wheel', onInteraction)
    window.addEventListener('mousedown', onInteraction)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('click', onInteraction)
      window.removeEventListener('keydown', onInteraction)
      window.removeEventListener('wheel', onInteraction)
      window.removeEventListener('mousedown', onInteraction)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
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
