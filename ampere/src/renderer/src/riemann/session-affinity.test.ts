import { describe, it, expect } from 'vitest'
import {
  sessionSignals, recencyWeights, sessionAffinity, evidenceWeight,
  scoreCandidates, pickBest, sessionDirection, SUSTAINED_THRESHOLD, REJECTED_THRESHOLD
} from './session-affinity'

const ev = (track_id: string, event_type: string, event_value: number | null = null) =>
  ({ track_id, event_type, event_value })

// Orthonormal basis so similarities are exact and easy to reason about.
const X = [1, 0, 0]
const Y = [0, 1, 0]
const NEG_X = [-1, 0, 0]
const vectors = new Map([['x', X], ['y', Y], ['negx', NEG_X]])

describe('sessionSignals', () => {
  it('reads a sustained listen as positive and a quick bail as negative', () => {
    expect(sessionSignals([
      ev('a', 'track_completed', 1.0),
      ev('b', 'track_skipped', 0.02)
    ])).toEqual([
      { trackId: 'a', strength: 1 },
      { trackId: 'b', strength: -1 }
    ])
  })

  it('drops ambiguous partial listens instead of scoring them weakly', () => {
    expect(sessionSignals([ev('a', 'track_skipped', 0.5)])).toEqual([])
  })

  it('treats the threshold boundaries as specified', () => {
    expect(sessionSignals([ev('a', 'track_completed', SUSTAINED_THRESHOLD)])[0].strength).toBe(1)
    expect(sessionSignals([ev('b', 'track_skipped', REJECTED_THRESHOLD)])).toEqual([])
    expect(sessionSignals([ev('c', 'track_skipped', REJECTED_THRESHOLD - 0.01)])[0].strength).toBe(-1)
  })

  it('weights explicit presses above implicit behaviour', () => {
    const s = sessionSignals([ev('a', 'explicit_positive'), ev('b', 'track_completed', 1)])
    expect(Math.abs(s[0].strength)).toBeGreaterThan(Math.abs(s[1].strength))
  })

  it('reads "like, not now" as negative for this session only', () => {
    expect(sessionSignals([ev('a', 'explicit_positive_not_now')])).toEqual([
      { trackId: 'a', strength: -1 }
    ])
  })

  it('ignores events that carry no preference information', () => {
    expect(sessionSignals([ev('a', 'track_started'), ev('b', 'seek_forward', 5)])).toEqual([])
  })

  it('skips outcome events with no completion value', () => {
    expect(sessionSignals([ev('a', 'track_completed', null)])).toEqual([])
  })
})

describe('recencyWeights', () => {
  it('weights the most recent signal fully and halves at the half-life', () => {
    const w = recencyWeights(4, 3)
    expect(w[3]).toBeCloseTo(1)
    expect(w[0]).toBeCloseTo(Math.pow(0.5, 3 / 3))
  })

  it('increases monotonically toward the present', () => {
    const w = recencyWeights(6)
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeGreaterThan(w[i - 1])
  })
})

describe('sessionAffinity', () => {
  it('is neutral with no signals, so the global model decides', () => {
    expect(sessionAffinity(X, [], vectors)).toBe(0)
  })

  it('scores a candidate matching a liked track highly', () => {
    expect(sessionAffinity(X, [{ trackId: 'x', strength: 1 }], vectors)).toBeCloseTo(1)
  })

  it('scores the opposite of a liked track negatively', () => {
    expect(sessionAffinity(NEG_X, [{ trackId: 'x', strength: 1 }], vectors)).toBeCloseTo(-1)
  })

  it('inverts for a disliked track', () => {
    expect(sessionAffinity(X, [{ trackId: 'x', strength: -1 }], vectors)).toBeCloseTo(-1)
  })

  it('is neutral toward a direction the session says nothing about', () => {
    expect(sessionAffinity(Y, [{ trackId: 'x', strength: 1 }], vectors)).toBeCloseTo(0)
  })

  it('follows a mid-session mood change rather than averaging across it', () => {
    // Liked X early, likes Y now. A centroid would sit between them; recency
    // weighting must favour Y — this is the multi-modal case the design targets.
    const signals = [
      { trackId: 'x', strength: 1 },
      { trackId: 'y', strength: 1 },
      { trackId: 'y', strength: 1 }
    ]
    expect(sessionAffinity(Y, signals, vectors)).toBeGreaterThan(sessionAffinity(X, signals, vectors))
  })

  it('stays neutral when no signal has a usable vector', () => {
    expect(sessionAffinity(X, [{ trackId: 'unknown', strength: 1 }], vectors)).toBe(0)
  })
})

describe('evidenceWeight', () => {
  it('gives the session no say before anything has happened', () => {
    expect(evidenceWeight(0)).toBe(0)
  })

  it('reaches an even split at the midpoint and keeps climbing', () => {
    expect(evidenceWeight(3, 3)).toBeCloseTo(0.5)
    expect(evidenceWeight(12, 3)).toBeGreaterThan(0.75)
  })

  it('never fully discards the global model', () => {
    expect(evidenceWeight(1000)).toBeLessThan(1)
  })
})

describe('scoreCandidates', () => {
  const candidates = [
    { trackId: 'x', globalPreference: 0.2 },
    { trackId: 'y', globalPreference: 0.9 }
  ]

  it('defers entirely to the global model with no session evidence', () => {
    const scored = scoreCandidates(candidates, [], vectors)
    expect(scored.find(c => c.trackId === 'y')!.score).toBeGreaterThan(
      scored.find(c => c.trackId === 'x')!.score
    )
  })

  it('lets a strong session signal outweigh a global favourite', () => {
    const signals = Array.from({ length: 8 }, () => ({ trackId: 'x', strength: 1 }))
    const scored = scoreCandidates(candidates, signals, vectors)
    expect(scored.find(c => c.trackId === 'x')!.score).toBeGreaterThan(
      scored.find(c => c.trackId === 'y')!.score
    )
  })

  it('falls back to global preference for tracks with no vector', () => {
    const scored = scoreCandidates([{ trackId: 'novec', globalPreference: 0.5 }], [], vectors)
    expect(scored[0].affinity).toBe(0)
  })
})

describe('pickBest', () => {
  const candidates = [
    { trackId: 'x', globalPreference: 0.9 },
    { trackId: 'y', globalPreference: 0.5 }
  ]

  it('returns the highest scorer', () => {
    expect(pickBest(candidates, [], vectors, new Set())?.trackId).toBe('x')
  })

  it('will not revisit a played track', () => {
    expect(pickBest(candidates, [], vectors, new Set(['x']))?.trackId).toBe('y')
  })

  it('returns null when everything has been visited', () => {
    expect(pickBest(candidates, [], vectors, new Set(['x', 'y']))).toBeNull()
  })

  it('returns null for an empty candidate pool', () => {
    expect(pickBest([], [], vectors, new Set())).toBeNull()
  })
})

describe('sessionDirection', () => {
  it('matches a naive per-signal computation', () => {
    // Guards the linearity shortcut in scoreCandidates: collapsing the signals
    // into one vector must give the same answer as walking them per candidate.
    const dim = 16
    const mk = (seed: number): number[] => {
      const v = Array.from({ length: dim }, (_, i) => Math.sin(seed * 3.1 + i * 1.7))
      const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0))
      return v.map(x => x / n)
    }
    const vecs = new Map([['a', mk(1)], ['b', mk(2)], ['c', mk(3)], ['d', mk(4)]])
    const signals = [
      { trackId: 'a', strength: 1 },
      { trackId: 'b', strength: -1 },
      { trackId: 'c', strength: 1.5 }
    ]
    const weights = recencyWeights(signals.length)
    const cand = vecs.get('d')!

    let weighted = 0, total = 0
    signals.forEach((s, i) => {
      const w = weights[i] * Math.abs(s.strength)
      weighted += w * Math.sign(s.strength) * cand.reduce((acc, x, k) => acc + x * vecs.get(s.trackId)![k], 0)
      total += w
    })
    const naive = weighted / total

    expect(sessionAffinity(cand, signals, vecs)).toBeCloseTo(naive, 10)
  })

  it('stays within [-1, 1] for unit-norm inputs', () => {
    const signals = [{ trackId: 'x', strength: 1 }, { trackId: 'y', strength: -1 }]
    for (const v of [X, Y, NEG_X]) {
      const a = sessionAffinity(v, signals, vectors)
      expect(a).toBeGreaterThanOrEqual(-1)
      expect(a).toBeLessThanOrEqual(1)
    }
  })

  it('is null when the session has nothing usable', () => {
    expect(sessionDirection([], vectors)).toBeNull()
    expect(sessionDirection([{ trackId: 'missing', strength: 1 }], vectors)).toBeNull()
  })
})
