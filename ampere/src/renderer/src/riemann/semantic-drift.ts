/**
 * Hierarchical drift — navigation through the library by walking the RQ-VAE
 * Semantic ID hierarchy (c0 = genre, c1 = subtype, c2 = texture).
 *
 * At each step we pick a *tier* to move within, from tightest to loosest:
 *
 *   texture  — same (c0,c1,c2): the most similar pocket of sound
 *   subtype  — same (c0,c1):    same genre + subtype, different texture
 *   genre    — same  c0:        same broad genre, anywhere inside it
 *   leap     — anywhere:        jump to a different genre entirely
 *
 * A single `coherence` knob (0..1) biases the tier choice: high coherence hugs
 * the current sound, low coherence wanders. This is deliberately framed as a
 * sampling policy P(next_sid | current_sid): today it's a hand-written
 * distribution, but the trajectory it produces (`DriftState.trajectory`) is
 * exactly the training data for a learned next-token model — swap
 * `chooseTierOrder` for a trained generative sequence model and the same
 * machinery becomes generative playlist continuation.
 */
import type { DriftState } from './navigation'

export type Sid = [number, number, number]
export type DriftTier = 'texture' | 'subtype' | 'genre' | 'leap'

export interface SemanticIndex {
  bySid: Map<string, string[]> // "c0:c1:c2" -> trackIds
  byC0C1: Map<string, string[]> // "c0:c1" -> trackIds
  byC0: Map<number, string[]> // c0 -> trackIds
  sidOf: Map<string, Sid> // trackId -> sid
  all: string[]
}

export interface SemanticDriftParams {
  /** 0 = wander across genres freely, 1 = stay in the tightest pocket. */
  coherence: number
}

const sidKey = (c0: number, c1: number, c2: number): string => `${c0}:${c1}:${c2}`
const c0c1Key = (c0: number, c1: number): string => `${c0}:${c1}`

function push<K>(m: Map<K, string[]>, key: K, val: string): void {
  const arr = m.get(key)
  if (arr) arr.push(val)
  else m.set(key, [val])
}

export function buildSemanticIndex(nodes: { trackId: string; sid: Sid }[]): SemanticIndex {
  const bySid = new Map<string, string[]>()
  const byC0C1 = new Map<string, string[]>()
  const byC0 = new Map<number, string[]>()
  const sidOf = new Map<string, Sid>()
  const all: string[] = []
  for (const { trackId, sid } of nodes) {
    const [c0, c1, c2] = sid
    sidOf.set(trackId, sid)
    all.push(trackId)
    push(bySid, sidKey(c0, c1, c2), trackId)
    push(byC0C1, c0c1Key(c0, c1), trackId)
    push(byC0, c0, trackId)
  }
  return { bySid, byC0C1, byC0, sidOf, all }
}

function tierPool(index: SemanticIndex, tier: DriftTier, sid: Sid): string[] | undefined {
  const [c0, c1, c2] = sid
  switch (tier) {
    case 'texture':
      return index.bySid.get(sidKey(c0, c1, c2))
    case 'subtype':
      return index.byC0C1.get(c0c1Key(c0, c1))
    case 'genre':
      return index.byC0.get(c0)
    case 'leap':
      return index.all
  }
}

/**
 * Pick a tier ordering for this step, weighted by coherence. The first tier is
 * the intended move; the rest are fallbacks if it has no unvisited tracks left.
 */
function chooseTierOrder(coherence: number, rand: number): DriftTier[] {
  const coh = Math.max(0, Math.min(1, coherence))
  const pTexture = coh
  const pSubtype = (1 - coh) * 0.6
  const pGenre = (1 - coh) * 0.3
  // remainder → leap
  if (rand < pTexture) return ['texture', 'subtype', 'genre', 'leap']
  if (rand < pTexture + pSubtype) return ['subtype', 'genre', 'texture', 'leap']
  if (rand < pTexture + pSubtype + pGenre) return ['genre', 'subtype', 'texture', 'leap']
  return ['leap', 'genre', 'subtype', 'texture']
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/**
 * From a candidate pool, choose an unvisited track. Within tight tiers we pick
 * the sonically nearest (cosine on the CLAP vector) for a smooth glide; for a
 * 'leap' we pick randomly so it actually lands somewhere new.
 */
function pickFromPool(
  pool: string[],
  state: DriftState,
  currentTrackId: string,
  nearest: boolean,
  vectors?: Map<string, number[]>
): string | null {
  const cands = pool.filter((id) => id !== currentTrackId && !state.visited.has(id))
  if (cands.length === 0) return null
  if (nearest && vectors) {
    const anchor = vectors.get(currentTrackId)
    if (anchor) {
      let best: string | null = null
      let bestSim = -Infinity
      for (const id of cands) {
        const v = vectors.get(id)
        if (!v) continue
        const sim = dot(anchor, v) // CLAP vectors are L2-normalized → cosine
        if (sim > bestSim) {
          bestSim = sim
          best = id
        }
      }
      if (best) return best
    }
  }
  return cands[Math.floor(Math.random() * cands.length)]
}

/**
 * Choose the next track in a hierarchical drift. Returns the track and the tier
 * the move used (for UI feedback / trajectory coloring), or null if the whole
 * library has been visited.
 */
export function semanticDriftNext(
  state: DriftState,
  index: SemanticIndex,
  currentTrackId: string,
  params: SemanticDriftParams,
  vectors?: Map<string, number[]>
): { trackId: string; tier: DriftTier } | null {
  const sid = index.sidOf.get(currentTrackId)
  const order = sid
    ? chooseTierOrder(params.coherence, Math.random())
    : (['leap'] as DriftTier[])

  for (const tier of order) {
    const pool = sid ? tierPool(index, tier, sid) : index.all
    if (!pool) continue
    const next = pickFromPool(pool, state, currentTrackId, tier !== 'leap', vectors)
    if (next) {
      state.visited.add(next)
      state.trajectory.push(next)
      return { trackId: next, tier }
    }
  }
  return null
}
