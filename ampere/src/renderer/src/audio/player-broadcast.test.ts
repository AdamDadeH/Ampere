import { describe, it, expect, vi } from 'vitest'
import { buildPlayerState, runBroadcastTick, type BroadcastState } from './player-broadcast'

function makeTrack(over: Partial<BroadcastState['currentTrack']> = {}): NonNullable<BroadcastState['currentTrack']> {
  return {
    title: 'Title',
    file_name: 'title.flac',
    artist: 'Artist',
    album: 'Album',
    artwork_path: null,
    bitrate: 1000,
    sample_rate: 44100,
    codec: 'flac',
    duration: 200,
    ...over,
  }
}

function makeState(over: Partial<BroadcastState> = {}): BroadcastState {
  const track = makeTrack()
  return {
    isPlaying: true,
    currentTime: 5,
    duration: 200,
    volume: 0.8,
    currentTrack: track,
    queue: [track],
    queueIndex: 0,
    shuffle: false,
    repeatMode: 'off',
    eqEnabled: false,
    eqPreamp: 0,
    eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ...over,
  }
}

describe('player broadcast — #4 hot-path gating', () => {
  it('does no work when the compact window is closed', () => {
    const send = vi.fn()
    const getFrequencyData = vi.fn(() => [])
    const sent = runBroadcastTick({ compactOpen: false, state: makeState(), getFrequencyData, send })

    expect(sent).toBe(false)
    expect(send).not.toHaveBeenCalled()
    // The expensive part (reading the analyser) must be skipped too.
    expect(getFrequencyData).not.toHaveBeenCalled()
  })

  it('does nothing when no track is loaded', () => {
    const send = vi.fn()
    const sent = runBroadcastTick({
      compactOpen: true,
      state: makeState({ currentTrack: null }),
      getFrequencyData: () => [],
      send,
    })
    expect(sent).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('sends exactly one frame when the compact window is open with a track', () => {
    const send = vi.fn()
    const sent = runBroadcastTick({
      compactOpen: true,
      state: makeState(),
      getFrequencyData: () => [1, 2, 3],
      send,
    })
    expect(sent).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({ trackTitle: 'Title', frequencyData: [1, 2, 3] })
  })

  it('reuses the projected queueTracks until the queue reference changes', () => {
    const state = makeState()
    const a = buildPlayerState(state, [])
    const b = buildPlayerState(state, [])
    // Same queue array reference → cached projection reused (no per-tick map()).
    expect(b.queueTracks).toBe(a.queueTracks)

    const next = makeState({ queue: [makeTrack({ title: 'Other' })] })
    const c = buildPlayerState(next, [])
    expect(c.queueTracks).not.toBe(a.queueTracks)
    expect(c.queueTracks[0].title).toBe('Other')
  })

  it('falls back to file_name when a track has no title', () => {
    const track = makeTrack({ title: null, file_name: 'song.flac' })
    const state = makeState({ currentTrack: track, queue: [track] })
    const out = buildPlayerState(state, [])
    expect(out.trackTitle).toBe('song.flac')
    expect(out.queueTracks[0].title).toBe('song.flac')
  })
})
