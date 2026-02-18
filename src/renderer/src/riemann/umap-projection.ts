import { UMAP } from 'umap-js'

export interface ProjectionResult {
  trackId: string
  x: number
  y: number
  z: number
}

export function zScoreNormalize(data: number[][]): number[][] {
  if (data.length === 0) return data
  const dims = data[0].length
  const means = new Float64Array(dims)
  const stds = new Float64Array(dims)

  // Compute means
  for (let i = 0; i < data.length; i++) {
    for (let d = 0; d < dims; d++) {
      means[d] += data[i][d]
    }
  }
  for (let d = 0; d < dims; d++) {
    means[d] /= data.length
  }

  // Compute stddevs
  for (let i = 0; i < data.length; i++) {
    for (let d = 0; d < dims; d++) {
      const diff = data[i][d] - means[d]
      stds[d] += diff * diff
    }
  }
  for (let d = 0; d < dims; d++) {
    stds[d] = Math.sqrt(stds[d] / data.length)
    if (stds[d] === 0) stds[d] = 1 // avoid division by zero
  }

  // Normalize
  return data.map(row =>
    row.map((val, d) => (val - means[d]) / stds[d])
  )
}

export interface UMAPParams {
  nComponents: 2 | 3
  minDist: number
  spread: number
}

export const DEFAULT_UMAP_PARAMS: UMAPParams = {
  nComponents: 3,
  minDist: 0.1,
  spread: 1.0
}

export async function projectToUMAP(
  features: { track_id: string; features_json: string }[],
  onProgress: (epoch: number, totalEpochs: number) => void,
  params: UMAPParams = DEFAULT_UMAP_PARAMS
): Promise<ProjectionResult[]> {
  if (features.length < 2) {
    // UMAP needs at least 2 points; place single point at origin
    return features.map(f => ({ trackId: f.track_id, x: 0, y: 0, z: 0 }))
  }

  // Parse feature vectors
  const trackIds = features.map(f => f.track_id)
  const rawData = features.map(f => JSON.parse(f.features_json) as number[])

  // Z-score normalize each dimension
  const normalizedData = zScoreNormalize(rawData)

  const nNeighbors = Math.min(15, Math.floor(features.length / 2))
  const nEpochs = 200

  const umap = new UMAP({
    nComponents: params.nComponents,
    nNeighbors: Math.max(2, nNeighbors),
    minDist: params.minDist,
    spread: params.spread,
    nEpochs
  })

  const embedding = await umap.fitAsync(normalizedData, (epochNumber) => {
    onProgress(epochNumber, nEpochs)
  })

  const results: ProjectionResult[] = trackIds.map((id, i) => ({
    trackId: id,
    x: embedding[i][0],
    y: embedding[i][1],
    z: params.nComponents === 3 ? embedding[i][2] : 0
  }))

  // Persist to database
  await window.api.bulkSetUmapCoords(results)

  return results
}
