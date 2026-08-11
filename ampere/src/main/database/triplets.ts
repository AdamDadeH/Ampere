/**
 * Sampling similarity triplets — "is the anchor closer to A or to B?"
 *
 * Asked blind and answered by listening, which is what makes arbitrary tracks
 * eligible. Shown the titles, the answer would become "both of these are indie
 * folk" — a judgement about labels, which would teach the metric to reproduce
 * genre tags rather than perceived sound. Listening also removes any need for
 * familiarity, so the whole embedded library can be sampled instead of the few
 * hundred tracks that would be recognisable by name.
 *
 * Sampling favours near ties. A triplet where one candidate is obviously
 * closer teaches nothing — the metric already agrees. The useful questions are
 * the ones where the current cosine cannot separate the candidates, so the
 * answer genuinely constrains the metric.
 *
 * Similarity is the only question that can be asked this way. "Which should
 * come next" needs a real session behind it — a track actually just heard and
 * an actual reaction to it — so it belongs with playback, not here.
 *
 * Pure except for the vectors handed in; the database layer supplies those.
 */

export interface TripletCandidate {
  trackId: string
  cosine: number
}

export interface SampledTriplet {
  anchorId: string
  a: TripletCandidate
  b: TripletCandidate
  /** How close the two candidates were under the current metric — 0 is a tie. */
  margin: number
}

/** Cosine similarity. Vectors are L2-normalized CLAP, so this is a dot product. */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let sum = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) sum += a[i] * b[i]
  return sum
}

/**
 * Pick a triplet the current metric finds hard.
 *
 * Candidates are restricted to the anchor's nearest `neighbourhood` tracks:
 * comparing against something wholly unrelated is easy and uninformative, and
 * the interesting disagreements live among things that are all somewhat close.
 *
 * `random` is injected so sampling is deterministic under test.
 */
export function sampleTriplet(
  vectors: ReadonlyMap<string, number[]>,
  random: () => number,
  opts: { neighbourhood?: number; maxMargin?: number } = {}
): SampledTriplet | null {
  const neighbourhood = opts.neighbourhood ?? 40
  const maxMargin = opts.maxMargin ?? 0.02

  const ids = Array.from(vectors.keys())
  if (ids.length < 3) return null

  const anchorId = ids[Math.floor(random() * ids.length)]
  const anchorVec = vectors.get(anchorId)
  if (!anchorVec) return null

  const scored: TripletCandidate[] = []
  for (const [trackId, vec] of Array.from(vectors.entries())) {
    if (trackId === anchorId) continue
    scored.push({ trackId, cosine: cosine(anchorVec, vec) })
  }
  if (scored.length < 2) return null

  scored.sort((x, y) => y.cosine - x.cosine)
  const pool = scored.slice(0, Math.min(neighbourhood, scored.length))

  // Adjacent pairs in the sorted pool are the closest ties available.
  const ties: [TripletCandidate, TripletCandidate][] = []
  for (let i = 0; i + 1 < pool.length; i++) {
    if (Math.abs(pool[i].cosine - pool[i + 1].cosine) <= maxMargin) {
      ties.push([pool[i], pool[i + 1]])
    }
  }

  // No near-tie in the neighbourhood — fall back to any two from it rather
  // than returning nothing, so sampling never dead-ends on a sparse anchor.
  const [a, b] = ties.length > 0
    ? ties[Math.floor(random() * ties.length)]
    : [pool[0], pool[Math.min(1, pool.length - 1)]]

  // Randomise presentation order so the answer cannot encode "the model's
  // favourite was on the left".
  const flip = random() < 0.5
  const first = flip ? b : a
  const second = flip ? a : b

  return {
    anchorId,
    a: first,
    b: second,
    margin: Math.abs(a.cosine - b.cosine)
  }
}

export interface TripletAgreement {
  total: number
  /** Answers where the listener picked the candidate the metric scored higher. */
  agreed: number
  unsure: number
  /** Agreement over decided answers only; NaN when nothing has been decided. */
  rate: number
  /** Mean margin of the questions asked, for judging how hard they were. */
  meanMargin: number
}

/**
 * How often the listener's choice matched the metric's.
 *
 * Only decided answers count toward the rate — an "unsure" is evidence the two
 * really are alike, not evidence the metric is wrong. Chance is 50%, so the
 * number to compare against is 50, not 0.
 */
export function agreement(
  rows: readonly { chosen: string; cos_a: number; cos_b: number }[]
): TripletAgreement {
  let agreed = 0
  let unsure = 0
  let decided = 0
  let marginSum = 0

  for (const r of rows) {
    marginSum += Math.abs(r.cos_a - r.cos_b)
    if (r.chosen !== 'a' && r.chosen !== 'b') { unsure++; continue }
    decided++
    const metricPrefersA = r.cos_a >= r.cos_b
    if ((r.chosen === 'a') === metricPrefersA) agreed++
  }

  return {
    total: rows.length,
    agreed,
    unsure,
    rate: decided > 0 ? agreed / decided : NaN,
    meanMargin: rows.length > 0 ? marginSum / rows.length : NaN
  }
}
