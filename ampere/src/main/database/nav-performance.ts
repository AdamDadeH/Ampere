/**
 * Per-navigation-mode performance, measured from the feedback log.
 *
 * Every play records the mode that chose it (`source`) and the UI it was
 * chosen from (`surface`), so comparing modes is a matter of pairing each
 * start with what you then did with it.
 *
 * The metric is sustained-listen rate, not skip rate. Skip rate conflates
 * rejecting a track with browsing past it: clicking through a list logs a
 * start and an instant skip each time, which is not dislike. Requiring 70%
 * played separates listening from sampling.
 *
 * Comparisons are only valid within one index version — drift and journey are
 * functions of the embedding model and codebook, so a change to either makes
 * the same mode a different mode. See `index_versions`.
 */
import { sessionize, parseSqliteUtc, FeedbackEvent } from './sessions'

/** Fraction played at or above which a listen counts as sustained. */
export const SUSTAINED_THRESHOLD = 0.7
/** Fraction played below which a listen counts as a rejection. */
export const REJECTED_THRESHOLD = 0.3

export interface Outcome {
  /** Mode that chose the track: the `source` prefix before any ':' detail. */
  mode: string
  /** Full source string, retaining policy detail such as tier and coherence. */
  source: string
  surface: string | null
  /** Fraction of the track played. */
  completion: number
  startedAt: number
}

export interface ModePerformance {
  mode: string
  n: number
  sustained: number
  rejected: number
  sustainedRate: number
  rejectedRate: number
}

/**
 * Pair each `track_started` with the outcome of that same track.
 *
 * Pairing happens inside a session and forward in time, taking the first
 * completion or skip for the same track after the start. Starts with no
 * outcome are dropped — the track may still be playing, and assuming an
 * outcome would invent data.
 */
export function pairOutcomes(
  events: readonly FeedbackEvent[],
  gapMs?: number
): Outcome[] {
  const outcomes: Outcome[] = []

  for (const session of sessionize(events, gapMs)) {
    const ordered = session.events
      .map(e => ({ e, at: parseSqliteUtc(e.created_at) }))
      .sort((a, b) => a.at - b.at)

    for (let i = 0; i < ordered.length; i++) {
      const start = ordered[i].e
      if (start.event_type !== 'track_started' || !start.source) continue

      for (let j = i + 1; j < ordered.length; j++) {
        const next = ordered[j].e
        if (next.track_id !== start.track_id) continue
        if (next.event_type !== 'track_skipped' && next.event_type !== 'track_completed') continue

        // A completion with no recorded value means the track ran to the end.
        const completion = next.event_value ?? (next.event_type === 'track_completed' ? 1 : 0)
        outcomes.push({
          mode: start.source.split(':')[0],
          source: start.source,
          surface: start.surface ?? null,
          completion,
          startedAt: ordered[i].at
        })
        break
      }
    }
  }
  return outcomes
}

/** Aggregate outcomes by mode, most-played first. */
export function summarize(outcomes: readonly Outcome[]): ModePerformance[] {
  const byMode = new Map<string, { n: number; sustained: number; rejected: number }>()

  for (const o of outcomes) {
    let acc = byMode.get(o.mode)
    if (!acc) { acc = { n: 0, sustained: 0, rejected: 0 }; byMode.set(o.mode, acc) }
    acc.n++
    if (o.completion >= SUSTAINED_THRESHOLD) acc.sustained++
    if (o.completion < REJECTED_THRESHOLD) acc.rejected++
  }

  return Array.from(byMode.entries())
    .map(([mode, a]) => ({
      mode,
      n: a.n,
      sustained: a.sustained,
      rejected: a.rejected,
      sustainedRate: a.sustained / a.n,
      rejectedRate: a.rejected / a.n
    }))
    .sort((x, y) => y.n - x.n)
}

/**
 * Keep only outcomes from one UI surface.
 *
 * Modes behave differently by context — in the 3D view skipping is partly an
 * interaction with the visualiser rather than a judgement of the track — so
 * pooling surfaces measures the context as much as the mode.
 */
export function onSurface(outcomes: readonly Outcome[], surface: string): Outcome[] {
  return outcomes.filter(o => o.surface === surface)
}

/** Keep only outcomes recorded within a time window, for version scoping. */
export function inWindow(
  outcomes: readonly Outcome[],
  fromMs: number,
  toMs: number = Infinity
): Outcome[] {
  return outcomes.filter(o => o.startedAt >= fromMs && o.startedAt < toMs)
}
