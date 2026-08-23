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
import { sessionize, parseSqliteUtc, FeedbackEvent, Session } from './sessions'

/** Fraction played at or above which a listen counts as sustained. */
export const SUSTAINED_THRESHOLD = 0.7
/** Fraction played below which a listen counts as a rejection. */
export const REJECTED_THRESHOLD = 0.3

/**
 * Coarse session shape.
 *
 * Testing, sampling and settled listening are different activities, and the
 * same sustained-listen rate means opposite things in each: skipping fast is
 * correct behaviour when you are sampling and a failure when you are settled.
 * Pooling them measures neither, so every outcome carries the shape of the
 * session it happened in.
 */
export type SessionKind = 'sampling' | 'listening'

/**
 * Median seconds between events below which a session counts as sampling.
 * Derived from the observed split rather than chosen a priori: sessions below
 * this sustain ~44%, above it ~74%.
 */
export const SAMPLING_GAP_SECONDS = 20

/**
 * Classify by median inter-event gap.
 *
 * Deliberately not attention_weight, which looks like a much stronger
 * separator but is partly circular — a skip is itself a UI interaction, so it
 * resets the decay and skip events mechanically carry a high weight. Timing
 * between events is not defined in terms of the outcome being measured.
 */
export function classifySession(
  session: Session<FeedbackEvent>,
  samplingGapSeconds: number = SAMPLING_GAP_SECONDS
): SessionKind {
  const times = session.events
    .map(e => parseSqliteUtc(e.created_at))
    .sort((a, b) => a - b)
  if (times.length < 2) return 'listening'

  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / 1000)
  gaps.sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)]
  return median < samplingGapSeconds ? 'sampling' : 'listening'
}

export interface Outcome {
  /** Shape of the session this play happened in. */
  sessionKind: SessionKind
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
  gapMs?: number,
  samplingGapSeconds?: number
): Outcome[] {
  const outcomes: Outcome[] = []

  for (const session of sessionize(events, gapMs)) {
    const sessionKind = classifySession(session, samplingGapSeconds)
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

        // No recorded fraction means the duration was unknown, so how much was
        // played is unknown too. Dropping it keeps unmeasurable plays out of
        // the rates rather than counting them as rejections.
        if (next.event_value == null) break
        const completion = next.event_value
        outcomes.push({
          sessionKind,
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

/**
 * Aggregate outcomes by mode, most-played first.
 *
 * The thresholds are arguments rather than constants because where "sustained"
 * begins is a judgement that will move. Binarizing is where the opinion hides,
 * so callers choose it and `completionHistogram` shows what was binarized.
 */
export function summarize(
  outcomes: readonly Outcome[],
  sustainedThreshold: number = SUSTAINED_THRESHOLD,
  rejectedThreshold: number = REJECTED_THRESHOLD
): ModePerformance[] {
  const byMode = new Map<string, { n: number; sustained: number; rejected: number }>()

  for (const o of outcomes) {
    let acc = byMode.get(o.mode)
    if (!acc) { acc = { n: 0, sustained: 0, rejected: 0 }; byMode.set(o.mode, acc) }
    acc.n++
    if (o.completion >= sustainedThreshold) acc.sustained++
    if (o.completion < rejectedThreshold) acc.rejected++
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
 * Aggregate by mode within each session kind.
 *
 * This is the comparison that means something: a mode judged against how you
 * behave in that kind of session, not against a global average that mixes
 * sampling and listening together.
 */
export function summarizeByKind(
  outcomes: readonly Outcome[],
  sustainedThreshold?: number,
  rejectedThreshold?: number
): { kind: SessionKind; rows: ModePerformance[]; n: number }[] {
  const kinds: SessionKind[] = ['listening', 'sampling']
  return kinds.map(kind => {
    const subset = outcomes.filter(o => o.sessionKind === kind)
    return { kind, rows: summarize(subset, sustainedThreshold, rejectedThreshold), n: subset.length }
  })
}

/**
 * Raw completion distribution per mode, in deciles.
 *
 * The unreduced view. Any rate is a threshold applied to this, so seeing the
 * shape shows whether a difference between modes is broad or an artifact of
 * where the line was drawn.
 */
export function completionHistogram(
  outcomes: readonly Outcome[],
  buckets = 10
): { mode: string; counts: number[]; n: number }[] {
  const byMode = new Map<string, number[]>()
  for (const o of outcomes) {
    let counts = byMode.get(o.mode)
    if (!counts) { counts = new Array(buckets).fill(0); byMode.set(o.mode, counts) }
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(o.completion * buckets)))
    counts[idx]++
  }
  return Array.from(byMode.entries())
    .map(([mode, counts]) => ({ mode, counts, n: counts.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.n - a.n)
}

/**
 * Standard error of a rate, for judging whether a difference is real.
 * Included in the readout because at these sample sizes most differences
 * are not.
 */
export function rateStandardError(rate: number, n: number): number {
  return n > 0 ? Math.sqrt((rate * (1 - rate)) / n) : NaN
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
