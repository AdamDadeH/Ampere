import { describe, it, expect } from 'vitest'
import {
  computeKNN,
  computeKNNFromCoords,
  createDriftState,
  driftNext,
  labelNeighbors,
  KNNGraph
} from './navigation'

// ── computeKNN ──────────────────────────────────────────────────────

describe('computeKNN', () => {
  it('returns neighbors sorted by distance', () => {
    // 3 tracks with known 2-dim feature vectors
    const features = [
      { track_id: 'a', features_json: JSON.stringify([0, 0]) },
      { track_id: 'b', features_json: JSON.stringify([1, 0]) },
      { track_id: 'c', features_json: JSON.stringify([10, 0]) },
    ]
    const knn = computeKNN(features, 2)

    // For 'a': b is closer than c
    expect(knn.neighbors.get('a')).toEqual(['b', 'c'])
    // For 'c': b is closer than a
    expect(knn.neighbors.get('c')).toEqual(['b', 'a'])
  })

  it('limits neighbors to k', () => {
    const features = [
      { track_id: 'a', features_json: JSON.stringify([0, 0]) },
      { track_id: 'b', features_json: JSON.stringify([1, 0]) },
      { track_id: 'c', features_json: JSON.stringify([2, 0]) },
      { track_id: 'd', features_json: JSON.stringify([3, 0]) },
    ]
    const knn = computeKNN(features, 2)

    for (const [, neighbors] of knn.neighbors) {
      expect(neighbors).toHaveLength(2)
    }
  })

  it('returns empty map for empty input', () => {
    const knn = computeKNN([], 5)
    expect(knn.neighbors.size).toBe(0)
  })

  it('returns empty neighbors for single track', () => {
    const features = [
      { track_id: 'only', features_json: JSON.stringify([1, 2, 3]) },
    ]
    const knn = computeKNN(features, 5)
    expect(knn.neighbors.get('only')).toEqual([])
  })

  it('handles identical feature vectors without error (std=0 case)', () => {
    const features = [
      { track_id: 'a', features_json: JSON.stringify([5, 5, 5]) },
      { track_id: 'b', features_json: JSON.stringify([5, 5, 5]) },
      { track_id: 'c', features_json: JSON.stringify([5, 5, 5]) },
    ]
    // Should not throw — std=0 is clamped to 1
    const knn = computeKNN(features, 2)
    expect(knn.neighbors.size).toBe(3)
    // All distances are 0, so any ordering is valid — just verify no crash
    for (const [, neighbors] of knn.neighbors) {
      expect(neighbors).toHaveLength(2)
    }
  })

  it('k greater than n-1 returns all available neighbors', () => {
    const features = [
      { track_id: 'a', features_json: JSON.stringify([0]) },
      { track_id: 'b', features_json: JSON.stringify([1]) },
    ]
    const knn = computeKNN(features, 10)
    expect(knn.neighbors.get('a')).toEqual(['b'])
    expect(knn.neighbors.get('b')).toEqual(['a'])
  })
})

// ── computeKNNFromCoords ────────────────────────────────────────────

describe('computeKNNFromCoords', () => {
  it('finds nearest neighbors in 3D space', () => {
    const nodes = [
      { trackId: 'origin', x: 0, y: 0, z: 0 },
      { trackId: 'near', x: 1, y: 0, z: 0 },
      { trackId: 'mid', x: 5, y: 0, z: 0 },
      { trackId: 'far', x: 100, y: 0, z: 0 },
    ]
    const knn = computeKNNFromCoords(nodes, 2)

    const originNeighbors = knn.neighbors.get('origin')!
    expect(originNeighbors[0]).toBe('near')
    expect(originNeighbors[1]).toBe('mid')
  })

  it('returns empty map for empty input', () => {
    const knn = computeKNNFromCoords([], 5)
    expect(knn.neighbors.size).toBe(0)
  })

  it('caps at available neighbors when k > n-1', () => {
    const nodes = [
      { trackId: 'a', x: 0, y: 0, z: 0 },
      { trackId: 'b', x: 1, y: 1, z: 1 },
    ]
    const knn = computeKNNFromCoords(nodes, 10)
    expect(knn.neighbors.get('a')).toEqual(['b'])
    expect(knn.neighbors.get('b')).toEqual(['a'])
  })

  it('handles diagonal distances correctly', () => {
    const nodes = [
      { trackId: 'center', x: 0, y: 0, z: 0 },
      { trackId: 'axis', x: 3, y: 0, z: 0 },       // dist² = 9
      { trackId: 'diagonal', x: 2, y: 2, z: 0 },    // dist² = 8
    ]
    const knn = computeKNNFromCoords(nodes, 2)
    // diagonal is closer than axis
    expect(knn.neighbors.get('center')![0]).toBe('diagonal')
  })
})

// ── createDriftState ────────────────────────────────────────────────

describe('createDriftState', () => {
  it('creates state with start track in visited and trajectory', () => {
    const state = createDriftState('track-1')
    expect(state.visited.has('track-1')).toBe(true)
    expect(state.visited.size).toBe(1)
    expect(state.trajectory).toEqual(['track-1'])
  })
})

// ── driftNext ───────────────────────────────────────────────────────

describe('driftNext', () => {
  function makeKNN(map: Record<string, string[]>): KNNGraph {
    return { neighbors: new Map(Object.entries(map)) }
  }

  it('prefers unvisited neighbors', () => {
    const knn = makeKNN({
      'a': ['b', 'c'],
      'b': ['a', 'c'],
      'c': ['a', 'b'],
    })
    const state = createDriftState('a')

    const next = driftNext(state, knn, 'a')
    expect(next).toBe('b') // first unvisited
    expect(state.visited.has('b')).toBe(true)
    expect(state.trajectory).toEqual(['a', 'b'])
  })

  it('falls back to nearest when all neighbors are visited', () => {
    const knn = makeKNN({ 'a': ['b', 'c'] })
    const state = createDriftState('a')
    state.visited.add('b')
    state.visited.add('c')

    const next = driftNext(state, knn, 'a')
    expect(next).toBe('b') // nearest neighbor even though visited
  })

  it('returns null when no neighbors exist', () => {
    const knn = makeKNN({ 'a': [] })
    const state = createDriftState('a')

    expect(driftNext(state, knn, 'a')).toBeNull()
  })

  it('returns null when track not in KNN graph', () => {
    const knn = makeKNN({})
    const state = createDriftState('unknown')

    expect(driftNext(state, knn, 'unknown')).toBeNull()
  })

  it('updates visited set and trajectory on each step', () => {
    const knn = makeKNN({
      'a': ['b', 'c'],
      'b': ['a', 'c'],
      'c': ['a', 'b'],
    })
    const state = createDriftState('a')

    driftNext(state, knn, 'a')  // -> b
    driftNext(state, knn, 'b')  // -> c (only unvisited)
    expect(state.visited).toEqual(new Set(['a', 'b', 'c']))
    expect(state.trajectory).toEqual(['a', 'b', 'c'])
  })
})

// ── labelNeighbors ──────────────────────────────────────────────────

describe('labelNeighbors', () => {
  // Feature groups from navigation.ts:
  // brightness: [0, 2), timbre: [2, 28), energy: [28, 30), harmony: [30, 54), texture: [54, 56)

  function makeZeroVector(): number[] {
    return new Array(56).fill(0)
  }

  it('labels neighbor by dominant feature difference', () => {
    const current = makeZeroVector()
    const neighbor = makeZeroVector()
    // Make brightness dims (0,1) differ significantly
    neighbor[0] = 10
    neighbor[1] = 10

    const featureMap = new Map([
      ['current', current],
      ['neighbor', neighbor],
    ])

    const labeled = labelNeighbors('current', ['neighbor'], featureMap)
    expect(labeled).toHaveLength(1)
    expect(labeled[0].label).toBe('Brighter')
    expect(labeled[0].group).toBe('brightness')
    expect(labeled[0].delta).toBeGreaterThan(0)
  })

  it('labels with neg direction when neighbor is lower', () => {
    const current = makeZeroVector()
    current[0] = 10
    current[1] = 10
    const neighbor = makeZeroVector()

    const featureMap = new Map([
      ['current', current],
      ['neighbor', neighbor],
    ])

    const labeled = labelNeighbors('current', ['neighbor'], featureMap)
    expect(labeled[0].label).toBe('Darker')
    expect(labeled[0].delta).toBeLessThan(0)
  })

  it('labels energy group correctly', () => {
    const current = makeZeroVector()
    const neighbor = makeZeroVector()
    // Energy dims are [28, 30)
    neighbor[28] = 20
    neighbor[29] = 20

    const featureMap = new Map([
      ['current', current],
      ['neighbor', neighbor],
    ])

    const labeled = labelNeighbors('current', ['neighbor'], featureMap)
    expect(labeled[0].label).toBe('Heavier')
    expect(labeled[0].group).toBe('energy')
  })

  it('returns empty array when current track not in feature map', () => {
    const featureMap = new Map<string, number[]>()
    const labeled = labelNeighbors('missing', ['a'], featureMap)
    expect(labeled).toEqual([])
  })

  it('returns "?" label for missing neighbor in feature map', () => {
    // Need at least 2 vectors in the map for z-score normalization to proceed
    const featureMap = new Map([
      ['current', makeZeroVector()],
      ['other', makeZeroVector()],
    ])
    const labeled = labelNeighbors('current', ['missing'], featureMap)
    expect(labeled).toHaveLength(1)
    expect(labeled[0].label).toBe('?')
    expect(labeled[0].group).toBe('unknown')
  })

  it('returns empty array when fewer than 2 total vectors', () => {
    const featureMap = new Map([
      ['only', makeZeroVector()],
    ])
    const labeled = labelNeighbors('only', ['other'], featureMap)
    expect(labeled).toEqual([])
  })

  it('handles uniform features (all same value across library)', () => {
    const vec = new Array(56).fill(5)
    const featureMap = new Map([
      ['a', [...vec]],
      ['b', [...vec]],
      ['c', [...vec]],
    ])
    // All identical — std=0 clamped to 1, deltas all 0
    const labeled = labelNeighbors('a', ['b', 'c'], featureMap)
    expect(labeled).toHaveLength(2)
    // With all-zero deltas, delta should be 0
    for (const n of labeled) {
      expect(n.delta).toBe(0)
    }
  })
})
