import { describe, it, expect } from 'vitest'
import { buildSemanticIndex, semanticDriftNext, type Sid } from './semantic-drift'
import { createDriftState } from './navigation'

// A tiny library: two genres, each with two subtypes, each with two textures.
function makeNodes(): { trackId: string; sid: Sid }[] {
  const nodes: { trackId: string; sid: Sid }[] = []
  for (let c0 = 0; c0 < 2; c0++)
    for (let c1 = 0; c1 < 2; c1++)
      for (let c2 = 0; c2 < 2; c2++)
        for (let dup = 0; dup < 3; dup++)
          nodes.push({ trackId: `t-${c0}-${c1}-${c2}-${dup}`, sid: [c0, c1, c2] })
  return nodes
}

describe('buildSemanticIndex', () => {
  it('groups tracks by sid prefixes', () => {
    const idx = buildSemanticIndex(makeNodes())
    expect(idx.all.length).toBe(2 * 2 * 2 * 3)
    expect(idx.bySid.get('0:0:0')!.length).toBe(3)
    expect(idx.byC0C1.get('0:0')!.length).toBe(6) // 2 textures × 3 dups
    expect(idx.byC0.get(0)!.length).toBe(12) // 2 subtypes × 2 textures × 3 dups
    expect(idx.sidOf.get('t-1-1-1-0')).toEqual([1, 1, 1])
  })
})

describe('semanticDriftNext', () => {
  it('with coherence=1 stays inside the same (c0,c1,c2) pocket while it has room', () => {
    const idx = buildSemanticIndex(makeNodes())
    const start = 't-0-0-0-0'
    const state = createDriftState(start)
    // The 0:0:0 bucket has 3 tracks; from the start we can reach the other 2.
    const a = semanticDriftNext(state, idx, start, { coherence: 1 })
    const b = semanticDriftNext(state, idx, a!.trackId, { coherence: 1 })
    expect(a!.tier).toBe('texture')
    expect(b!.tier).toBe('texture')
    expect(idx.sidOf.get(a!.trackId)).toEqual([0, 0, 0])
    expect(idx.sidOf.get(b!.trackId)).toEqual([0, 0, 0])
  })

  it('falls through to a looser tier once the tight bucket is exhausted', () => {
    const idx = buildSemanticIndex(makeNodes())
    const start = 't-0-0-0-0'
    const state = createDriftState(start)
    // Exhaust the 0:0:0 bucket (2 remaining), then the next step must leave it.
    semanticDriftNext(state, idx, start, { coherence: 1 })
    const second = semanticDriftNext(state, idx, state.trajectory.at(-1)!, { coherence: 1 })
    const third = semanticDriftNext(state, idx, second!.trackId, { coherence: 1 })
    // The third move can no longer be 'texture' within 0:0:0 — it climbs.
    expect(third!.tier).not.toBe('texture')
    expect(idx.sidOf.get(third!.trackId)![0]).toBe(0) // still same genre
  })

  it('never revisits a track and eventually returns null when all visited', () => {
    const idx = buildSemanticIndex(makeNodes())
    const start = idx.all[0]
    const state = createDriftState(start)
    const seen = new Set([start])
    let current = start
    for (let i = 0; i < idx.all.length + 5; i++) {
      const step = semanticDriftNext(state, idx, current, { coherence: 0.5 })
      if (!step) break
      expect(seen.has(step.trackId)).toBe(false)
      seen.add(step.trackId)
      current = step.trackId
    }
    expect(seen.size).toBe(idx.all.length)
    expect(semanticDriftNext(state, idx, current, { coherence: 0.5 })).toBeNull()
  })

  it('leaps when the current track has no known sid', () => {
    const idx = buildSemanticIndex(makeNodes())
    const state = createDriftState('unknown')
    const step = semanticDriftNext(state, idx, 'unknown', { coherence: 1 })
    expect(step).not.toBeNull()
    expect(step!.tier).toBe('leap')
  })
})
