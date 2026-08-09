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
  featureMap: Map<string, number[]>
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

  return { nodes, trackIdToIndex, knn, semanticIndex, featureMap }
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
