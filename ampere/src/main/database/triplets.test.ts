import { describe, it, expect } from 'vitest'
import { cosine, sampleTriplet, agreement } from './triplets'

/** Deterministic stand-in for Math.random, cycling a fixed sequence. */
const seq = (...values: number[]): (() => number) => {
  let i = 0
  return () => values[i++ % values.length]
}

/** Unit vector at a given angle in the plane, so cosines are exactly cos(Δθ). */
const at = (deg: number): number[] => {
  const r = (deg * Math.PI) / 180
  return [Math.cos(r), Math.sin(r)]
}

describe('cosine', () => {
  it('is 1 for identical unit vectors and 0 for orthogonal ones', () => {
    expect(cosine(at(0), at(0))).toBeCloseTo(1)
    expect(cosine(at(0), at(90))).toBeCloseTo(0)
    expect(cosine(at(0), at(180))).toBeCloseTo(-1)
  })
})

describe('sampleTriplet', () => {
  it('returns nothing when there is not enough to compare', () => {
    expect(sampleTriplet(new Map(), seq(0))).toBeNull()
    expect(sampleTriplet(new Map([['a', at(0)], ['b', at(10)]]), seq(0))).toBeNull()
  })

  it('never offers the anchor as one of its own candidates', () => {
    const vectors = new Map([['a', at(0)], ['b', at(5)], ['c', at(10)], ['d', at(80)]])
    for (let i = 0; i < 4; i++) {
      const t = sampleTriplet(vectors, seq(i / 4, 0, 0))
      expect(t).not.toBeNull()
      expect(t!.a.trackId).not.toBe(t!.anchorId)
      expect(t!.b.trackId).not.toBe(t!.anchorId)
      expect(t!.a.trackId).not.toBe(t!.b.trackId)
    }
  })

  it('prefers near-ties, because a lopsided question teaches nothing', () => {
    // b and c sit at nearly the same distance from a; d is far away. A useful
    // question pits b against c, not either against d.
    const vectors = new Map([
      ['a', at(0)], ['b', at(20)], ['c', at(20.5)], ['d', at(85)]
    ])
    const t = sampleTriplet(vectors, seq(0, 0, 0.9), { maxMargin: 0.02 })
    expect(t).not.toBeNull()
    expect([t!.a.trackId, t!.b.trackId].sort()).toEqual(['b', 'c'])
    expect(t!.margin).toBeLessThan(0.02)
  })

  it('still produces a question when the neighbourhood has no tie', () => {
    // Sparse anchors must not dead-end the sampler.
    const vectors = new Map([['a', at(0)], ['b', at(20)], ['c', at(85)]])
    const t = sampleTriplet(vectors, seq(0, 0, 0), { maxMargin: 0.0001 })
    expect(t).not.toBeNull()
  })

  it('varies which side the closer candidate appears on', () => {
    // Otherwise the answer could encode "the model's favourite was on the
    // left" rather than a judgement about the music.
    const vectors = new Map([['a', at(0)], ['b', at(20)], ['c', at(20.5)], ['d', at(60)]])
    const left = sampleTriplet(vectors, seq(0, 0, 0.1))!
    const right = sampleTriplet(vectors, seq(0, 0, 0.9))!
    expect(left.a.trackId).not.toBe(right.a.trackId)
  })

  it('reports the margin of the question it asked', () => {
    const vectors = new Map([['a', at(0)], ['b', at(20)], ['c', at(20.5)], ['d', at(60)]])
    const t = sampleTriplet(vectors, seq(0, 0, 0))!
    expect(t.margin).toBeCloseTo(Math.abs(t.a.cosine - t.b.cosine), 10)
  })
})

describe('agreement', () => {
  const row = (chosen: string, cos_a: number, cos_b: number) => ({ chosen, cos_a, cos_b })

  it('counts a match with the metric as agreement', () => {
    const r = agreement([row('a', 0.9, 0.8), row('b', 0.7, 0.85)])
    expect(r.agreed).toBe(2)
    expect(r.rate).toBe(1)
  })

  it('counts a mismatch as disagreement', () => {
    const r = agreement([row('b', 0.9, 0.8), row('a', 0.7, 0.85)])
    expect(r.agreed).toBe(0)
    expect(r.rate).toBe(0)
  })

  it('excludes unsure from the rate but keeps it in the total', () => {
    // A genuine tie says the two really are alike; it is not evidence the
    // metric is wrong, and folding it in either direction would bias the rate.
    const r = agreement([row('a', 0.9, 0.8), row('unsure', 0.9, 0.9)])
    expect(r.total).toBe(2)
    expect(r.unsure).toBe(1)
    expect(r.rate).toBe(1)
  })

  it('reports NaN rather than a number when nothing has been decided', () => {
    expect(agreement([row('unsure', 0.9, 0.9)]).rate).toBeNaN()
    expect(agreement([]).rate).toBeNaN()
  })

  it('averages the margin so question difficulty is visible', () => {
    const r = agreement([row('a', 0.9, 0.8), row('b', 0.5, 0.5)])
    expect(r.meanMargin).toBeCloseTo(0.05)
  })
})
