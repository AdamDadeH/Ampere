/**
 * Navigation data: the graph the nav modes walk.
 *
 * Extracted from RiemannNavigator so that navigation no longer depends on a
 * mounted Three.js scene. Both the 3D view and the main player build their
 * graph through `buildNavData`, which is the point — if the two ever computed
 * neighbours differently, the same mode would pick different tracks depending
 * on which surface you happened to be looking at.
 *
 * Nothing here imports three.
 */
import { computeKNNFromCoords, KNNGraph } from './navigation'
import { buildSemanticIndex, SemanticIndex } from './semantic-drift'

/** Half-width of the normalized coordinate cube. Must match the 3D scene's scaling. */
export const SCALE_RANGE = 50
/** Neighbours per node in the KNN graph. */
export const KNN_K = 8

export type FeatureSource = 'meyda' | 'clap'

export type UmapCoords = { trackId: string; x: number; y: number; z: number }[]

/** Coord rows carry Semantic IDs on the CLAP source only; undefined for Meyda. */
export type CoordRow = {
  track_id: string
  features_json: string
  umap_x: number
  umap_y: number
  umap_z: number
  sid_0?: number
  sid_1?: number
  sid_2?: number
}

export interface TrackNode {
  trackId: string
  x: number
  y: number
  z: number
  c0?: number // Semantic-ID level-0 code (CLAP source only)
}

export interface NavData {
  nodes: TrackNode[]
  trackIdToIndex: Map<string, number>
  knn: KNNGraph
  /** Null on the Meyda source, which has no Semantic IDs. */
  semanticIndex: SemanticIndex | null
  /** Raw feature vectors, as stored. Used for labelling and journeys. */
  featureMap: Map<string, number[]>
  /**
   * Comparable unit vectors for similarity queries, so a dot product is a
   * cosine. Drift and session use these, never `featureMap` — see
   * `toUnitVectors` for why the two differ.
   */
  unitVectors: Map<string, number[]>
}

/**
 * Make vectors comparable so that dot product means cosine similarity.
 *
 * CLAP embeddings arrive L2-normalized and are passed through untouched.
 * Meyda vectors are raw measurements whose dimensions differ by orders of
 * magnitude — spectral centroid in the thousands next to zero-crossing rate
 * in [0,1] — so a dot product over them measures whichever dimension happens
 * to be largest, not similarity. Those are standardized per dimension first,
 * then normalized.
 *
 * Detection is by observed norm rather than by source name, so a future
 * feature set gets the right treatment without another branch here.
 */
export function toUnitVectors(vectors: ReadonlyMap<string, number[]>): Map<string, number[]> {
  const out = new Map<string, number[]>()
  if (vectors.size === 0) return out

  const rows = Array.from(vectors.values())
  const dim = rows[0].length

  const l2 = (v: readonly number[]): number => Math.sqrt(v.reduce((a, x) => a + x * x, 0))
  const meanNorm = rows.reduce((a, v) => a + l2(v), 0) / rows.length
  const alreadyUnit = Math.abs(meanNorm - 1) < 0.01

  let means: number[] = []
  let stds: number[] = []
  if (!alreadyUnit) {
    means = new Array(dim).fill(0)
    stds = new Array(dim).fill(0)
    for (let j = 0; j < dim; j++) {
      let sum = 0
      for (const v of rows) sum += v[j] ?? 0
      means[j] = sum / rows.length
    }
    for (let j = 0; j < dim; j++) {
      let sq = 0
      for (const v of rows) sq += ((v[j] ?? 0) - means[j]) ** 2
      stds[j] = Math.sqrt(sq / rows.length) || 1
    }
  }

  for (const [id, v] of vectors) {
    const scaled = alreadyUnit ? v.slice() : v.map((x, j) => (x - means[j]) / stds[j])
    const norm = l2(scaled) || 1
    out.set(id, scaled.map(x => x / norm))
  }
  return out
}

/** IPC surface for a feature source. */
export function featureApi(source: FeatureSource): {
  count: () => Promise<number>
  features: () => Promise<{ track_id: string; features_json: string }[]>
  withCoords: () => Promise<CoordRow[]>
  persist: (r: UmapCoords) => Promise<void>
} {
  if (source === 'clap') {
    return {
      count: () => window.api.getSemanticCount(),
      features: () => window.api.getSemanticFeatures(),
      withCoords: () => window.api.getSemanticFeaturesWithCoords(),
      persist: (r) => window.api.bulkSetSemanticUmapCoords(r)
    }
  }
  return {
    count: () => window.api.getFeatureCount(),
    features: () => window.api.getTrackFeatures(),
    withCoords: () => window.api.getTrackFeaturesWithCoords(),
    persist: (r) => window.api.bulkSetUmapCoords(r)
  }
}

/**
 * Map raw UMAP coords into the ±SCALE_RANGE cube.
 *
 * Each axis is min-maxed independently, so this is not a uniform scaling and
 * it does change relative distances. The KNN graph is built from the result,
 * so any caller wanting the same neighbours must normalize the same way —
 * which is why this lives here rather than inline in the scene setup.
 */
export function normalizeToNodes(coordData: readonly CoordRow[]): TrackNode[] {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const d of coordData) {
    if (d.umap_x < minX) minX = d.umap_x
    if (d.umap_x > maxX) maxX = d.umap_x
    if (d.umap_y < minY) minY = d.umap_y
    if (d.umap_y > maxY) maxY = d.umap_y
    if (d.umap_z < minZ) minZ = d.umap_z
    if (d.umap_z > maxZ) maxZ = d.umap_z
  }
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const rangeZ = maxZ - minZ || 1

  return coordData.map(d => ({
    trackId: d.track_id,
    x: ((d.umap_x - minX) / rangeX - 0.5) * SCALE_RANGE * 2,
    y: ((d.umap_y - minY) / rangeY - 0.5) * SCALE_RANGE * 2,
    z: ((d.umap_z - minZ) / rangeZ - 0.5) * SCALE_RANGE * 2,
    c0: d.sid_0
  }))
}

/**
 * Build the full navigation graph from coord rows.
 *
 * `allFeatures` is optional because coord rows already carry `features_json`;
 * passing it separately means shipping and parsing the same vectors twice.
 * Only supply it when the feature set genuinely differs from the coord set.
 */
export function buildNavData(
  coordData: readonly CoordRow[],
  allFeatures?: readonly { track_id: string; features_json: string }[]
): NavData {
  const featureMap = new Map<string, number[]>()
  for (const f of allFeatures ?? coordData) {
    featureMap.set(f.track_id, JSON.parse(f.features_json) as number[])
  }

  const nodes = normalizeToNodes(coordData)
  const trackIdToIndex = new Map<string, number>()
  nodes.forEach((n, i) => trackIdToIndex.set(n.trackId, i))

  const knn: KNNGraph = nodes.length >= 2
    ? computeKNNFromCoords(nodes, KNN_K)
    : { neighbors: new Map() }

  // Semantic-ID index for hierarchical journeys — CLAP source only.
  const sidNodes = coordData
    .filter((d) => d.sid_0 !== undefined)
    .map((d) => ({ trackId: d.track_id, sid: [d.sid_0!, d.sid_1!, d.sid_2!] as [number, number, number] }))
  const semanticIndex = sidNodes.length > 0 ? buildSemanticIndex(sidNodes) : null

  return { nodes, trackIdToIndex, knn, semanticIndex, featureMap, unitVectors: toUnitVectors(featureMap) }
}

/**
 * Load the graph for a source.
 *
 * One round trip: `withCoords` already includes the feature vectors, and at
 * ~10k tracks x 512 dims these payloads are large enough that fetching them
 * twice is the difference between a mode being usable and appearing dead.
 */
export async function loadNavData(source: FeatureSource): Promise<NavData | null> {
  const coordData = await featureApi(source).withCoords()
  if (coordData.length === 0) return null
  return buildNavData(coordData)
}

/**
 * Pick the richest feature source the library actually has.
 *
 * CLAP comes from the standalone vq pipeline, which most installs will never
 * run; Meyda is extracted in-app and needs nothing external. Preferring CLAP
 * but falling back keeps drift and session working on a plain install instead
 * of silently having no graph at all. Journey still requires Semantic IDs and
 * reports itself unavailable without them.
 */
export async function bestAvailableSource(): Promise<FeatureSource | null> {
  const [semantic, meyda] = await Promise.all([
    window.api.getSemanticCount().catch(() => 0),
    window.api.getFeatureCount().catch(() => 0)
  ])
  if (semantic > 0) return 'clap'
  if (meyda > 0) return 'meyda'
  return null
}
