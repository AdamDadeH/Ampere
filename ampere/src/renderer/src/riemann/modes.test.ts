import { describe, it, expect } from 'vitest'
import { NAV_MODES, isNavMode, selectNext, createDriftState } from './modes'
import { buildNavData, normalizeToNodes, CoordRow, SCALE_RANGE } from './nav-data'
import { KNNGraph } from './navigation'
import { NavData } from './nav-data'

const knnOf = (pairs: Record<string, string[]>): KNNGraph => ({
  neighbors: new Map(Object.entries(pairs))
})

const dataWith = (over: Partial<NavData>): NavData => ({
  nodes: [],
  trackIdToIndex: new Map(),
  knn: knnOf({}),
  semanticIndex: null,
  featureMap: new Map(),
  ...over
})

const coord = (id: string, x: number, y: number, z: number, sid?: [number, number, number]): CoordRow => ({
  track_id: id, features_json: '[1,2]', umap_x: x, umap_y: y, umap_z: z,
  sid_0: sid?.[0], sid_1: sid?.[1], sid_2: sid?.[2]
})

describe('isNavMode', () => {
  it('separates graph walks from queue orders', () => {
    expect(isNavMode('drift')).toBe(true)
    expect(isNavMode('journey')).toBe(true)
    expect(isNavMode('linear')).toBe(false)
    expect(isNavMode('random')).toBe(false)
  })
})

// Unit vectors with known angles: b is close to a (cos 0.9), c is orthogonal
// to a. Nearest-neighbour order from a is therefore b, then c.
const vecs = new Map<string, number[]>([
  ['a', [1, 0]],
  ['b', [0.9, Math.sqrt(1 - 0.81)]],
  ['c', [0, 1]]
])

describe('drift mode', () => {
  const data = dataWith({ featureMap: vecs })

  it('steps to the nearest track in embedding space and tags provenance', () => {
    const step = selectNext('drift', { data, state: createDriftState('a'), currentTrackId: 'a', coherence: 0.7 })
    expect(step).toEqual({ trackId: 'b', source: 'drift', tier: null })
  })

  it('prefers unheard tracks as the walk proceeds', () => {
    const state = createDriftState('a')
    expect(selectNext('drift', { data, state, currentTrackId: 'a', coherence: 0.7 })?.trackId).toBe('b')
    // From b the nearest is a, but a has been played — so it must move to c.
    expect(selectNext('drift', { data, state, currentTrackId: 'b', coherence: 0.7 })?.trackId).toBe('c')
  })

  it('revisits the nearest track rather than stalling once all are heard', () => {
    const state = createDriftState('a')
    state.visited.add('b')
    state.visited.add('c')
    expect(selectNext('drift', { data, state, currentTrackId: 'a', coherence: 0.7 })?.trackId).toBe('b')
  })

  it('returns null for a track with no embedding', () => {
    const step = selectNext('drift', { data, state: createDriftState('z'), currentTrackId: 'z', coherence: 0.7 })
    expect(step).toBeNull()
  })

  it('does not depend on the UMAP-derived graph', () => {
    // The projection is unseeded and refits as the library grows; drift must
    // be a function of the embeddings alone so its metrics stay comparable.
    const noGraph = dataWith({ featureMap: vecs, knn: knnOf({}) })
    expect(NAV_MODES.drift.isAvailable(noGraph)).toBe(true)
    expect(selectNext('drift', { data: noGraph, state: createDriftState('a'), currentTrackId: 'a', coherence: 0.7 })?.trackId).toBe('b')
  })

  it('is unavailable with no embeddings', () => {
    expect(NAV_MODES.drift.isAvailable(dataWith({}))).toBe(false)
  })
})

describe('buildNavData', () => {
  const rows = [
    coord('a', 0, 0, 0, [1, 2, 3]),
    coord('b', 1, 1, 1, [1, 2, 4]),
    coord('c', 2, 2, 2, [5, 6, 7])
  ]

  it('indexes every track and builds a walkable graph', () => {
    const data = buildNavData(rows, rows.map(r => ({ track_id: r.track_id, features_json: r.features_json })))
    expect(data.nodes).toHaveLength(3)
    expect(data.trackIdToIndex.get('b')).toBe(1)
    expect(data.knn.neighbors.size).toBe(3)
    expect(data.featureMap.get('a')).toEqual([1, 2])
  })

  it('builds a semantic index only when Semantic IDs are present', () => {
    const withSids = buildNavData(rows, [])
    expect(withSids.semanticIndex).not.toBeNull()

    const meydaRows = rows.map(r => coord(r.track_id, r.umap_x, r.umap_y, r.umap_z))
    expect(buildNavData(meydaRows, []).semanticIndex).toBeNull()
  })

  it('leaves a single-node graph empty rather than throwing', () => {
    const data = buildNavData([coord('solo', 0, 0, 0)], [])
    expect(data.knn.neighbors.size).toBe(0)
  })
})

describe('normalizeToNodes', () => {
  it('maps coords into the ±SCALE_RANGE cube', () => {
    const nodes = normalizeToNodes([coord('a', 0, 0, 0), coord('b', 10, 10, 10)])
    expect(nodes[0].x).toBeCloseTo(-SCALE_RANGE)
    expect(nodes[1].x).toBeCloseTo(SCALE_RANGE)
  })

  it('survives a degenerate axis where every value is identical', () => {
    const nodes = normalizeToNodes([coord('a', 5, 0, 0), coord('b', 5, 10, 0)])
    expect(Number.isNaN(nodes[0].x)).toBe(false)
    expect(nodes[0].x).toBeCloseTo(-SCALE_RANGE)
  })

  it('carries the level-0 semantic code through for colouring', () => {
    const nodes = normalizeToNodes([coord('a', 0, 0, 0, [7, 1, 2])])
    expect(nodes[0].c0).toBe(7)
  })
})
