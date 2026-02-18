/**
 * Navigation modes for walking the library manifold.
 *
 * Drift mode uses UMAP coordinates for KNN so that neighbors are always
 * visually local in the 3D scene. Future directed-walk modes may use the
 * original 56-dim feature vectors for semantic direction navigation.
 */

export interface KNNGraph {
  /** For each track ID, ordered list of nearest neighbor track IDs */
  neighbors: Map<string, string[]>
}

export interface DriftState {
  visited: Set<string>
  trajectory: string[] // ordered track IDs as visited
}

/**
 * Compute k-nearest neighbors for every track in z-score normalized 56-dim feature space.
 * O(N²) brute force — fine for libraries up to ~10k tracks.
 */
export function computeKNN(
  features: { track_id: string; features_json: string }[],
  k: number
): KNNGraph {
  const n = features.length
  const trackIds = features.map(f => f.track_id)
  const vectors = features.map(f => JSON.parse(f.features_json) as number[])

  if (n === 0 || vectors[0].length === 0) {
    return { neighbors: new Map() }
  }

  // Z-score normalize
  const dims = vectors[0].length
  const means = new Float64Array(dims)
  const stds = new Float64Array(dims)

  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dims; d++) {
      means[d] += vectors[i][d]
    }
  }
  for (let d = 0; d < dims; d++) means[d] /= n

  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dims; d++) {
      const diff = vectors[i][d] - means[d]
      stds[d] += diff * diff
    }
  }
  for (let d = 0; d < dims; d++) {
    stds[d] = Math.sqrt(stds[d] / n)
    if (stds[d] === 0) stds[d] = 1
  }

  const normalized: number[][] = vectors.map(row =>
    row.map((val, d) => (val - means[d]) / stds[d])
  )

  // Compute pairwise distances and find k nearest
  const neighbors = new Map<string, string[]>()

  for (let i = 0; i < n; i++) {
    const distances: { idx: number; dist: number }[] = []
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      let dist = 0
      for (let d = 0; d < dims; d++) {
        const diff = normalized[i][d] - normalized[j][d]
        dist += diff * diff
      }
      distances.push({ idx: j, dist })
    }
    distances.sort((a, b) => a.dist - b.dist)
    neighbors.set(trackIds[i], distances.slice(0, k).map(d => trackIds[d.idx]))
  }

  return { neighbors }
}

/**
 * Compute k-nearest neighbors from UMAP coordinates (3D scene positions).
 * Ensures drift neighbors are always visually local.
 */
export function computeKNNFromCoords(
  nodes: { trackId: string; x: number; y: number; z: number }[],
  k: number
): KNNGraph {
  const n = nodes.length
  if (n === 0) return { neighbors: new Map() }

  const neighbors = new Map<string, string[]>()

  for (let i = 0; i < n; i++) {
    const distances: { idx: number; dist: number }[] = []
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const dx = nodes[i].x - nodes[j].x
      const dy = nodes[i].y - nodes[j].y
      const dz = nodes[i].z - nodes[j].z
      distances.push({ idx: j, dist: dx * dx + dy * dy + dz * dz })
    }
    distances.sort((a, b) => a.dist - b.dist)
    neighbors.set(nodes[i].trackId, distances.slice(0, k).map(d => nodes[d.idx].trackId))
  }

  return { neighbors }
}

/**
 * Create a fresh drift state starting from a track.
 */
export function createDriftState(startTrackId: string): DriftState {
  return {
    visited: new Set([startTrackId]),
    trajectory: [startTrackId]
  }
}

/**
 * Pick the next track in a drift walk.
 * Prefers the nearest unvisited neighbor. If all neighbors are visited,
 * picks the nearest neighbor anyway (allows loops over revisiting).
 */
export function driftNext(state: DriftState, knn: KNNGraph, currentTrackId: string): string | null {
  const neighbors = knn.neighbors.get(currentTrackId)
  if (!neighbors || neighbors.length === 0) return null

  // Prefer unvisited
  const unvisited = neighbors.find(id => !state.visited.has(id))
  const next = unvisited ?? neighbors[0]

  state.visited.add(next)
  state.trajectory.push(next)
  return next
}
