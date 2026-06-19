// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useLibraryStore } from '../stores/library'
import { makeTracks } from '../test/factories'

/**
 * Headless performance harness for the track list.
 *
 * Each row of TrackList renders exactly one <AlbumArt> (the title cell), so a
 * mocked AlbumArt that increments a counter on every render is an exact,
 * deterministic probe for "how many rows (re)rendered". No real browser, no
 * wall-clock timing — pure render-count / DOM-node assertions that map 1:1 to
 * the four performance fixes.
 */
const probe = vi.hoisted(() => ({ rowRenders: 0 }))
vi.mock('./AlbumArt', () => ({
  AlbumArt: () => {
    probe.rowRenders++
    return null
  },
}))

// Behaviour metrics (#1, #2) are N-independent — keep N small so the loop is
// fast. The virtualization metric (#3) needs a large list to be meaningful.
const N_BEHAVIOUR = 600
const N_LARGE = 3000

let TrackList: typeof import('./TrackList').TrackList

beforeAll(async () => {
  // Components touch window.api only on user interaction (play, pin…), never on
  // render — but stub it so nothing can throw if that changes.
  ;(window as unknown as Record<string, unknown>).api = new Proxy(
    {},
    { get: () => () => Promise.resolve(undefined) },
  )
  TrackList = (await import('./TrackList')).TrackList
})

function resetStore(tracks = makeTracks(N_BEHAVIOUR)): void {
  act(() => {
    useLibraryStore.setState({
      tracks,
      currentView: 'all-tracks',
      searchQuery: '',
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    })
  })
}

beforeEach(() => {
  probe.rowRenders = 0
})

afterEach(() => {
  cleanup()
})

describe('TrackList performance', () => {
  it('#1 — a currentTime tick must not re-render the track list', () => {
    resetStore()
    render(<TrackList />)
    const onMount = probe.rowRenders
    expect(onMount).toBeGreaterThan(0) // sanity: rows actually rendered

    probe.rowRenders = 0
    // Simulate one playback tick (handleTimeUpdate → setCurrentTime, ~4Hz).
    act(() => useLibraryStore.setState({ currentTime: 1.23 }))

    const onTick = probe.rowRenders
    console.log(`[perf #1] rows on mount=${onMount}  rows per currentTime tick=${onTick}`)
    expect(onTick).toBe(0)
  })

  it('#2 — switching the current track re-renders only the affected rows', () => {
    const tracks = makeTracks(N_BEHAVIOUR)
    resetStore(tracks)
    render(<TrackList />)

    act(() => useLibraryStore.setState({ currentTrack: tracks[5], isPlaying: true }))
    probe.rowRenders = 0
    // A "skip": current row goes inactive, next row goes active → 2 rows change.
    act(() => useLibraryStore.setState({ currentTrack: tracks[6] }))

    const onSwitch = probe.rowRenders
    console.log(`[perf #2] rows re-rendered on track switch=${onSwitch} (target ~2)`)
    expect(onSwitch).toBeLessThanOrEqual(5)
  })

  it('#3 — a large library mounts only a windowed set of rows', () => {
    resetStore(makeTracks(N_LARGE))
    const { container } = render(<TrackList />)

    const domRows = container.querySelectorAll('tbody tr').length
    console.log(`[perf #3] library=${N_LARGE}  rows in DOM=${domRows}  rows rendered=${probe.rowRenders}`)
    // Windowed list should mount far fewer rows than the library size.
    expect(domRows).toBeLessThan(150)
  })
})
