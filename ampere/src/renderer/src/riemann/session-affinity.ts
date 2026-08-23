/**
 * Session-local preference scoring.
 *
 * The premise: taste is contextual. A global model says what you like in
 * general; within a session you are in some particular mood, and the tracks
 * you sustain or bail on right now say which part of your taste is live.
 *
 * Design constraints came from the data, not from taste in algorithms:
 *
 * - A median session is ~8 distinct tracks, so there is no fitting a model
 *   here. Scoring is similarity to recent signals, which is about all 8
 *   labels can support.
 * - Only 10% of sessions contain an explicit button press, so implicit
 *   sustained-listen-vs-skip carries the signal and explicit sharpens it.
 * - Recency weighting rather than a session centroid: interests are
 *   multi-modal, and the mean of a session that moved between two moods
 *   lands between them — the emptiest region, the worst possible pick.
 *
 * Vectors are the L2-normalized CLAP embeddings, so cosine similarity is a
 * plain dot product. CLAP lost the global-preference contest to Meyda but
 * beat it at the smallest sample sizes, which is the regime a session lives
 * in — that is why it is used here and not there.
 */

/** Fraction played at or above which a listen counts as sustained. */
export const SUSTAINED_THRESHOLD = 0.7
/** Fraction played below which a listen counts as a rejection. */
export const REJECTED_THRESHOLD = 0.3
/** Signals back at which recency weight halves. */
export const RECENCY_HALF_LIFE = 3
/**
 * Signal count at which session evidence and the global model carry equal
 * weight. Below it the global model dominates, which is what handles the
 * cold start at the top of a session.
 */
export const EVIDENCE_MIDPOINT = 3

/**
 * Days over which a played track recovers most of its eligibility.
 *
 * `visited` is a scratchpad, not memory: it holds one walk and resets on every
 * mode switch, so without this the same tracks resurface the moment you change
 * modes or restart. `last_played` is the durable record, and recency is graded
 * where a visited-set is binary — something heard an hour ago and something
 * heard last spring are not the same kind of repeat.
 *
 * A guess, not a tuned value. At 7 days a track played yesterday recovers to
 * ~13% eligibility, one from a fortnight ago ~75%, one from a month ago ~99%.
 */
export const RECENCY_RECOVERY_DAYS = 7

export interface SessionEvent {
  track_id: string
  event_type: string
  event_value: number | null
}

export interface SessionSignal {
  trackId: string
  /** Positive means "more like this", negative means "less". */
  strength: number
}

/**
 * Reduce a session's raw events to signed preference signals, oldest first.
 *
 * Partial listens between the two thresholds are dropped rather than scored
 * as weak evidence — a half-played track is genuinely ambiguous, and reading
 * intent into it would manufacture signal the data does not contain.
 */
export function sessionSignals(events: readonly SessionEvent[]): SessionSignal[] {
  const signals: SessionSignal[] = []
  for (const e of events) {
    switch (e.event_type) {
      case 'explicit_positive':
        signals.push({ trackId: e.track_id, strength: 1.5 })
        break
      case 'explicit_negative':
        signals.push({ trackId: e.track_id, strength: -1.5 })
        break
      case 'explicit_positive_not_now':
        // The button already means "good track, wrong moment" — exactly the
        // global/session split, so it reads as negative for this session only.
        signals.push({ trackId: e.track_id, strength: -1 })
        break
      case 'track_completed':
      case 'track_skipped': {
        if (e.event_value == null) break
        if (e.event_value >= SUSTAINED_THRESHOLD) signals.push({ trackId: e.track_id, strength: 1 })
        else if (e.event_value < REJECTED_THRESHOLD) signals.push({ trackId: e.track_id, strength: -1 })
        break
      }
    }
  }
  return signals
}

/** Exponential recency weights, most recent signal weighted 1. */
export function recencyWeights(count: number, halfLife = RECENCY_HALF_LIFE): number[] {
  const weights: number[] = []
  for (let i = 0; i < count; i++) {
    const stepsBack = count - 1 - i
    weights.push(Math.pow(0.5, stepsBack / halfLife))
  }
  return weights
}

function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) sum += a[i] * b[i]
  return sum
}

/**
 * Collapse the session's signals into a single direction vector.
 *
 * Affinity is linear in the candidate:
 *   Σ wᵢ·sᵢ·⟨c, vᵢ⟩ / Σ wᵢ  =  ⟨c, Σ wᵢ·sᵢ·vᵢ / Σ wᵢ⟩
 * so the signals can be summed once per step instead of re-walked for every
 * candidate. That turns scoring the library from O(candidates × signals × dim)
 * into O(candidates × dim) — exact, not an approximation.
 *
 * Returns null when no signal has a usable vector.
 */
export function sessionDirection(
  signals: readonly SessionSignal[],
  vectors: ReadonlyMap<string, number[]>
): number[] | null {
  if (signals.length === 0) return null
  const weights = recencyWeights(signals.length)

  let direction: number[] | null = null
  let totalWeight = 0
  for (let i = 0; i < signals.length; i++) {
    const vec = vectors.get(signals[i].trackId)
    if (!vec) continue
    const w = weights[i] * Math.abs(signals[i].strength) * Math.sign(signals[i].strength)
    if (!direction) direction = new Array(vec.length).fill(0)
    for (let d = 0; d < vec.length && d < direction.length; d++) direction[d] += w * vec[d]
    totalWeight += Math.abs(w)
  }
  if (!direction || totalWeight === 0) return null
  for (let d = 0; d < direction.length; d++) direction[d] /= totalWeight
  return direction
}

/**
 * How well a candidate matches the session's live direction, in [-1, 1].
 *
 * Returns 0 when no signal has a usable vector — neutral, so the caller falls
 * back to the global model rather than treating absence as dislike.
 */
export function sessionAffinity(
  candidate: readonly number[],
  signals: readonly SessionSignal[],
  vectors: ReadonlyMap<string, number[]>
): number {
  const direction = sessionDirection(signals, vectors)
  return direction ? dot(candidate, direction) : 0
}

/**
 * How much to trust the session over the global model, in [0, 1).
 * Ramps with accumulated evidence so an empty session leans global.
 */
export function evidenceWeight(signalCount: number, midpoint = EVIDENCE_MIDPOINT): number {
  return signalCount / (signalCount + midpoint)
}

export interface Candidate {
  trackId: string
  /** Global preference, already normalized to [0, 1]. */
  globalPreference: number
  /**
   * Epoch ms this track was last played, or null if never. Drives the recency
   * penalty; omit to disable it.
   */
  lastPlayedMs?: number | null
}

/**
 * How eligible a track is given how recently it played, in [0, 1].
 *
 * Never-played tracks are fully eligible, which is what pushes a walk into the
 * unheard majority of a library rather than circling the same few hundred
 * tracks. Frequently-played favourites are not thereby buried: play count
 * feeds the inferred rating, so they carry a higher global preference and
 * recover their standing as the penalty decays.
 */
export function freshness(
  lastPlayedMs: number | null | undefined,
  nowMs: number,
  recoveryDays: number = RECENCY_RECOVERY_DAYS
): number {
  if (lastPlayedMs == null) return 1
  const days = (nowMs - lastPlayedMs) / 86_400_000
  if (days <= 0) return 0
  return 1 - Math.exp(-days / recoveryDays)
}

export interface ScoredCandidate extends Candidate {
  score: number
  affinity: number
  /** Recency multiplier applied, 1 when never played or when disabled. */
  freshness: number
}

/**
 * Blend global preference with session affinity.
 * Affinity is mapped from [-1, 1] onto [0, 1] so both terms share a scale.
 */
export function scoreCandidates(
  candidates: readonly Candidate[],
  signals: readonly SessionSignal[],
  vectors: ReadonlyMap<string, number[]>,
  nowMs?: number,
  recoveryDays?: number
): ScoredCandidate[] {
  const beta = evidenceWeight(signals.length)
  const direction = sessionDirection(signals, vectors)   // computed once, not per candidate
  return candidates.map(c => {
    const vec = vectors.get(c.trackId)
    const affinity = vec && direction ? dot(vec, direction) : 0
    const preference = (1 - beta) * c.globalPreference + beta * ((affinity + 1) / 2)
    // Recency multiplies rather than adds: a track played minutes ago should
    // be unreachable however well it matches, not merely ranked lower.
    const fresh = nowMs === undefined ? 1 : freshness(c.lastPlayedMs, nowMs, recoveryDays)
    return { ...c, score: preference * fresh, affinity, freshness: fresh }
  })
}

/**
 * Highest-scoring candidate, excluding anything already visited.
 * Ties break toward the earlier candidate, so the result is deterministic.
 */
export function pickBest(
  candidates: readonly Candidate[],
  signals: readonly SessionSignal[],
  vectors: ReadonlyMap<string, number[]>,
  visited: ReadonlySet<string>,
  nowMs?: number,
  recoveryDays?: number
): ScoredCandidate | null {
  let best: ScoredCandidate | null = null
  for (const scored of scoreCandidates(candidates, signals, vectors, nowMs, recoveryDays)) {
    if (visited.has(scored.trackId)) continue
    if (!best || scored.score > best.score) best = scored
  }
  return best
}
