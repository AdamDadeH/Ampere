import { extractFeatures } from './extract-features'

export async function extractAllFeatures(
  onProgress: (done: number, total: number, currentFile?: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const tracks = await window.api.getTracksWithoutFeatures()
  const total = tracks.length

  if (total === 0) return

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) return

    const track = tracks[i]
    const fileName = track.file_path.split('/').pop() || track.file_path
    onProgress(i, total, fileName)

    try {
      const vector = await extractFeatures(track.file_path)
      await window.api.upsertTrackFeatures(track.id, JSON.stringify(vector.values))
    } catch (err) {
      console.warn(`Feature extraction failed for ${track.file_path}:`, err)
      // Skip and continue to next track
    }
  }

  onProgress(total, total)
}
