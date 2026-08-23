import { describe, it, expect } from 'vitest'
import { parseSqliteUtc, sessionize, currentSession, SESSION_GAP_MS, FeedbackEvent } from './sessions'

const ev = (created_at: string, track_id = 't', event_type = 'track_started'): FeedbackEvent => ({
  track_id, event_type, event_value: null, attention_weight: 1, source: null, created_at
})

const MIN = 60 * 1000

describe('parseSqliteUtc', () => {
  it('reads SQLite\'s space-separated form as UTC, not local time', () => {
    // The trap: new Date('2026-08-09 03:42:06') is local-time in JS.
    expect(parseSqliteUtc('2026-08-09 03:42:06')).toBe(Date.UTC(2026, 7, 9, 3, 42, 6))
  })

  it('is offset-independent — the same instant regardless of machine zone', () => {
    const viaUtc = parseSqliteUtc('2026-08-09 03:42:06')
    expect(viaUtc).toBe(new Date('2026-08-09T03:42:06Z').getTime())
  })

  it('passes through timestamps that already carry a zone', () => {
    expect(parseSqliteUtc('2026-08-09T03:42:06Z')).toBe(Date.UTC(2026, 7, 9, 3, 42, 6))
    expect(parseSqliteUtc('2026-08-09T05:42:06+02:00')).toBe(Date.UTC(2026, 7, 9, 3, 42, 6))
  })

  it('returns NaN for junk', () => {
    expect(parseSqliteUtc('')).toBeNaN()
    expect(parseSqliteUtc('not a date')).toBeNaN()
  })
})

describe('sessionize', () => {
  it('returns nothing for an empty stream', () => {
    expect(sessionize([])).toEqual([])
  })

  it('treats a single event as one session', () => {
    const s = sessionize([ev('2026-08-09 03:00:00')])
    expect(s).toHaveLength(1)
    expect(s[0].events).toHaveLength(1)
    expect(s[0].startedAt).toBe(s[0].endedAt)
  })

  it('keeps events closer together than the gap in one session', () => {
    const s = sessionize([
      ev('2026-08-09 03:00:00'), ev('2026-08-09 03:20:00'), ev('2026-08-09 03:45:00')
    ])
    expect(s).toHaveLength(1)
    expect(s[0].events).toHaveLength(3)
  })

  it('splits on a silence longer than the gap', () => {
    const s = sessionize([
      ev('2026-08-09 03:00:00'), ev('2026-08-09 03:10:00'),
      ev('2026-08-09 04:30:00'), ev('2026-08-09 04:35:00')
    ])
    expect(s).toHaveLength(2)
    expect(s[0].events).toHaveLength(2)
    expect(s[1].events).toHaveLength(2)
    expect(s[1].startedAt).toBe(Date.UTC(2026, 7, 9, 4, 30, 0))
  })

  it('measures the gap from the previous event, not the session start', () => {
    // 25-min steps across two hours: one continuous session despite the span.
    const s = sessionize([
      ev('2026-08-09 03:00:00'), ev('2026-08-09 03:25:00'),
      ev('2026-08-09 03:50:00'), ev('2026-08-09 04:15:00')
    ])
    expect(s).toHaveLength(1)
    expect(s[0].endedAt - s[0].startedAt).toBe(75 * MIN)
  })

  it('keeps a gap exactly at the threshold together, and splits just past it', () => {
    const exact = sessionize([ev('2026-08-09 03:00:00'), ev('2026-08-09 03:30:00')])
    expect(exact).toHaveLength(1)
    const over = sessionize([ev('2026-08-09 03:00:00'), ev('2026-08-09 03:30:01')])
    expect(over).toHaveLength(2)
  })

  it('sorts unordered input before splitting', () => {
    const s = sessionize([
      ev('2026-08-09 04:35:00'), ev('2026-08-09 03:00:00'),
      ev('2026-08-09 04:30:00'), ev('2026-08-09 03:10:00')
    ])
    expect(s).toHaveLength(2)
    expect(s[0].startedAt).toBe(Date.UTC(2026, 7, 9, 3, 0, 0))
    expect(s[1].startedAt).toBe(Date.UTC(2026, 7, 9, 4, 30, 0))
  })

  it('drops unplaceable events rather than inventing a position', () => {
    const s = sessionize([ev('2026-08-09 03:00:00'), ev('garbage'), ev('2026-08-09 03:05:00')])
    expect(s).toHaveLength(1)
    expect(s[0].events).toHaveLength(2)
  })

  it('honours a custom gap', () => {
    const events = [ev('2026-08-09 03:00:00'), ev('2026-08-09 03:10:00')]
    expect(sessionize(events, 5 * MIN)).toHaveLength(2)
    expect(sessionize(events, 15 * MIN)).toHaveLength(1)
  })

  it('numbers sessions oldest-first and preserves event order within one', () => {
    const s = sessionize([
      ev('2026-08-09 03:00:00', 'a'), ev('2026-08-09 03:01:00', 'b'),
      ev('2026-08-09 05:00:00', 'c')
    ])
    expect(s.map(x => x.index)).toEqual([0, 1])
    expect(s[0].events.map(e => e.track_id)).toEqual(['a', 'b'])
  })
})

describe('currentSession', () => {
  const sessions = sessionize([
    ev('2026-08-09 03:00:00'), ev('2026-08-09 03:10:00'),
    ev('2026-08-09 04:30:00'), ev('2026-08-09 04:35:00')
  ])

  it('returns the latest session while it is still live', () => {
    const now = Date.UTC(2026, 7, 9, 4, 50, 0)   // 15 min after the last event
    expect(currentSession(sessions, now)?.startedAt).toBe(Date.UTC(2026, 7, 9, 4, 30, 0))
  })

  it('returns null once the gap has elapsed', () => {
    const now = Date.UTC(2026, 7, 9, 5, 30, 0)   // 55 min after the last event
    expect(currentSession(sessions, now)).toBeNull()
  })

  it('stays live at exactly the gap boundary', () => {
    const now = Date.UTC(2026, 7, 9, 4, 35, 0) + SESSION_GAP_MS
    expect(currentSession(sessions, now)).not.toBeNull()
  })

  it('has no current session when there is no history', () => {
    expect(currentSession([], Date.UTC(2026, 7, 9, 4, 50, 0))).toBeNull()
  })
})
