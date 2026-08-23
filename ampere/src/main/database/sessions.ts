/**
 * Listening sessions, derived from timestamped feedback events.
 *
 * Sessions are deliberately NOT stored. `track_feedback.created_at` already
 * timestamps every event, so a session is a pure function over that stream —
 * which means the gap threshold can be retuned and re-applied to all history,
 * where a stamped session_id column would have frozen the first guess.
 *
 * Nothing here touches the database; `LibraryDatabase` supplies the rows.
 */

/** Idle time that separates one listening session from the next. */
export const SESSION_GAP_MS = 30 * 60 * 1000

export interface FeedbackEvent {
  track_id: string
  event_type: string
  event_value: number | null
  attention_weight: number
  source: string | null
  /** UI surface the event came from; null for events predating the column. */
  surface?: string | null
  created_at: string
}

export interface Session<E extends FeedbackEvent = FeedbackEvent> {
  /** Position in the returned array — oldest session is 0. Not stable across re-derivation. */
  index: number
  /** Epoch ms of the first and last event, inclusive. */
  startedAt: number
  endedAt: number
  events: E[]
}

/**
 * Parse a SQLite `datetime('now')` timestamp to epoch ms.
 *
 * SQLite writes UTC as `YYYY-MM-DD HH:MM:SS` with a space and no zone suffix.
 * `new Date()` reads that shape as *local* time, which would shift every
 * session boundary by the machine's UTC offset — so the zone is made explicit
 * here rather than left to the engine. Already-ISO strings pass through.
 *
 * Returns NaN when the input is unparseable.
 */
export function parseSqliteUtc(ts: string): number {
  if (!ts) return NaN
  const trimmed = ts.trim()
  // Already carries a zone (trailing Z or ±HH:MM) — trust it as-is.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) return new Date(trimmed).getTime()
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  return new Date(`${normalized}Z`).getTime()
}

/**
 * Split events into sessions on idle gaps. Input need not be sorted.
 *
 * Events with unparseable timestamps are dropped — they cannot be placed on
 * the timeline, and guessing a position would silently invent history.
 */
export function sessionize<E extends FeedbackEvent>(
  events: readonly E[],
  gapMs: number = SESSION_GAP_MS
): Session<E>[] {
  const timed: { at: number; event: E }[] = []
  for (const event of events) {
    const at = parseSqliteUtc(event.created_at)
    if (!Number.isNaN(at)) timed.push({ at, event })
  }
  if (timed.length === 0) return []

  timed.sort((a, b) => a.at - b.at)

  const sessions: Session<E>[] = []
  let current: Session<E> = { index: 0, startedAt: timed[0].at, endedAt: timed[0].at, events: [timed[0].event] }

  for (let i = 1; i < timed.length; i++) {
    const { at, event } = timed[i]
    // A gap exactly equal to the threshold stays in the same session; only a
    // strictly longer silence starts a new one.
    if (at - current.endedAt > gapMs) {
      sessions.push(current)
      current = { index: sessions.length, startedAt: at, endedAt: at, events: [event] }
    } else {
      current.endedAt = at
      current.events.push(event)
    }
  }
  sessions.push(current)
  return sessions
}

/**
 * The session still in progress, or null if the last one has gone idle past
 * the gap. `nowMs` is injected so callers can evaluate historical state.
 */
export function currentSession<E extends FeedbackEvent>(
  sessions: readonly Session<E>[],
  nowMs: number,
  gapMs: number = SESSION_GAP_MS
): Session<E> | null {
  if (sessions.length === 0) return null
  const last = sessions[sessions.length - 1]
  return nowMs - last.endedAt > gapMs ? null : last
}
