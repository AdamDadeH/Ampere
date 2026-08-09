import { describe, it, expect } from 'vitest'
import { pairOutcomes, summarize, onSurface, inWindow } from './nav-performance'
import { FeedbackEvent } from './sessions'

let clock = 0
const at = (min: number): string => {
  clock = min
  return `2026-08-09 ${String(10 + Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`
}

const start = (min: number, track: string, source: string, surface: string | null = 'all-tracks'): FeedbackEvent => ({
  track_id: track, event_type: 'track_started', event_value: null,
  attention_weight: 1, source, surface, created_at: at(min)
})
const ended = (min: number, track: string, completion: number): FeedbackEvent => ({
  track_id: track, event_type: completion >= 1 ? 'track_completed' : 'track_skipped',
  event_value: completion, attention_weight: 1, source: null, surface: 'all-tracks', created_at: at(min)
})

describe('pairOutcomes', () => {
  it('pairs a start with the outcome of the same track', () => {
    const out = pairOutcomes([start(0, 'a', 'drift'), ended(3, 'a', 1)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ mode: 'drift', completion: 1, surface: 'all-tracks' })
  })

  it('keeps policy detail in source but groups on the prefix', () => {
    const out = pairOutcomes([start(0, 'a', 'journey:texture:0.70'), ended(1, 'a', 0.9)])
    expect(out[0].mode).toBe('journey')
    expect(out[0].source).toBe('journey:texture:0.70')
  })

  it('drops a start with no outcome rather than assuming one', () => {
    // The track may still be playing; inventing an outcome would fabricate data.
    expect(pairOutcomes([start(0, 'a', 'drift')])).toEqual([])
  })

  it('takes the first outcome after the start, not a later one', () => {
    const out = pairOutcomes([
      start(0, 'a', 'drift'), ended(1, 'a', 0.1),
      start(2, 'a', 'shuffle'), ended(3, 'a', 1)
    ])
    expect(out.map(o => [o.mode, o.completion])).toEqual([['drift', 0.1], ['shuffle', 1]])
  })

  it('does not pair a start with another track\'s outcome', () => {
    const out = pairOutcomes([start(0, 'a', 'drift'), ended(1, 'b', 1)])
    expect(out).toEqual([])
  })

  it('ignores starts with no recorded source', () => {
    const noSource = { ...start(0, 'a', 'drift'), source: null }
    expect(pairOutcomes([noSource, ended(1, 'a', 1)])).toEqual([])
  })

  it('does not pair across a session boundary', () => {
    // A start with no outcome before the gap stays unpaired, rather than
    // borrowing an outcome from hours later.
    const out = pairOutcomes([start(0, 'a', 'drift'), ended(120, 'a', 1)])
    expect(out).toEqual([])
  })

  it('treats a valueless completion as a full listen', () => {
    const done: FeedbackEvent = {
      track_id: 'a', event_type: 'track_completed', event_value: null,
      attention_weight: 1, source: null, surface: null, created_at: at(1)
    }
    expect(pairOutcomes([start(0, 'a', 'drift'), done])[0].completion).toBe(1)
  })
})

describe('summarize', () => {
  const events = [
    start(0, 'a', 'drift'), ended(1, 'a', 1.0),
    start(2, 'b', 'drift'), ended(3, 'b', 0.05),
    start(4, 'c', 'drift'), ended(5, 'c', 0.5),
    start(6, 'd', 'shuffle'), ended(7, 'd', 0.95)
  ]

  it('counts sustained and rejected against the thresholds', () => {
    const rows = summarize(pairOutcomes(events))
    const drift = rows.find(r => r.mode === 'drift')!
    expect(drift.n).toBe(3)
    expect(drift.sustained).toBe(1)
    expect(drift.rejected).toBe(1)
    // The 50% listen is neither — ambiguous, so it counts in n only.
    expect(drift.sustainedRate).toBeCloseTo(1 / 3)
  })

  it('orders by sample size so thin modes are visibly thin', () => {
    expect(summarize(pairOutcomes(events))[0].mode).toBe('drift')
  })

  it('returns nothing for an empty log', () => {
    expect(summarize([])).toEqual([])
  })
})

describe('scoping', () => {
  const mixed = pairOutcomes([
    { ...start(0, 'a', 'drift', 'riemann') }, ended(1, 'a', 1),
    { ...start(2, 'b', 'drift', 'all-tracks') }, ended(3, 'b', 1)
  ])

  it('filters to one surface, since context changes behaviour', () => {
    expect(onSurface(mixed, 'riemann')).toHaveLength(1)
    expect(onSurface(mixed, 'all-tracks')).toHaveLength(1)
  })

  it('filters to a version window', () => {
    const cutoff = mixed[1].startedAt
    expect(inWindow(mixed, cutoff)).toHaveLength(1)
    expect(inWindow(mixed, 0, cutoff)).toHaveLength(1)
  })
})
