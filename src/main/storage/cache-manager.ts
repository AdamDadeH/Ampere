import { LibraryDatabase } from '../database'
import { isFileMaterialized, evictFiles, isProtonDrivePath } from './proton-drive'

const DEFAULT_MAX_SIZE = 8 * 1024 * 1024 * 1024 // 8 GB default cache limit (~old iPod's worth)
const EVICTION_INTERVAL = 5 * 60 * 1000 // 5 minutes

export class CacheManager {
  private db: LibraryDatabase
  private maxSizeBytes: number
  private timer: ReturnType<typeof setInterval> | null = null

  // In-memory path→trackId index for fast audio-server touchByPath lookups
  private pathIndex: Map<string, string> | null = null

  constructor(db: LibraryDatabase, maxSizeBytes?: number) {
    this.db = db
    this.maxSizeBytes = maxSizeBytes ?? DEFAULT_MAX_SIZE

    // Periodic eviction check
    this.timer = setInterval(() => {
      this.evict().catch(err => console.error('Cache eviction error:', err))
    }, EVICTION_INTERVAL)
  }

  setMaxSize(bytes: number): void {
    this.maxSizeBytes = bytes
  }

  /**
   * Record that a file was accessed (for LRU ordering).
   * Called from the audio server when serving a file.
   */
  touch(trackId: string): void {
    this.db.updateLastAccessed(trackId)
  }

  /**
   * Touch by file path — used from audio server hot path.
   * Builds a path→trackId index on first call for O(1) lookups.
   */
  touchByPath(filePath: string): void {
    if (!this.pathIndex) {
      this.rebuildPathIndex()
    }
    const trackId = this.pathIndex?.get(filePath)
    if (trackId) {
      this.db.updateLastAccessed(trackId)
    }
  }

  private rebuildPathIndex(): void {
    // Build index from all tracks — this is called lazily and rarely
    const existingPaths = this.db.getExistingPathsWithSize()
    // We need trackIds too, so we'll use a different approach
    this.pathIndex = new Map()
    // Use the eviction candidates + a broader query for all PD tracks
    try {
      const tracks = this.db.getAllTracks()
      for (const t of tracks) {
        if (isProtonDrivePath(t.file_path)) {
          this.pathIndex.set(t.file_path, t.id)
        }
      }
    } catch {
      this.pathIndex = new Map()
    }
  }

  /** Invalidate path index when library changes (e.g., after scan) */
  invalidatePathIndex(): void {
    this.pathIndex = null
  }

  /**
   * Run LRU eviction: remove least-recently-accessed cached PD files until under budget.
   * Only evicts files with sync_status='cached' and pinned=0.
   * Returns count and bytes freed.
   */
  async evict(): Promise<{ evicted: number; freedBytes: number }> {
    const stats = this.db.getCacheStats()

    // If we're under budget, nothing to do
    if (stats.cachedBytes <= this.maxSizeBytes) {
      return { evicted: 0, freedBytes: 0 }
    }

    const candidates = this.db.getEvictionCandidates()
    let freedBytes = 0
    let evicted = 0
    let currentCachedBytes = stats.cachedBytes

    // Collect files to evict, split into already-cloud-only vs needs-eviction
    const toEvict: { id: string; file_path: string; file_size: number }[] = []

    for (const candidate of candidates) {
      if (currentCachedBytes <= this.maxSizeBytes) break

      if (!isFileMaterialized(candidate.file_path)) {
        // Already cloud-only, just fix DB status
        this.db.updateSyncStatus(candidate.id, 'cloud-only')
        currentCachedBytes -= candidate.file_size
        freedBytes += candidate.file_size
        evicted++
      } else {
        toEvict.push(candidate)
        currentCachedBytes -= candidate.file_size
        freedBytes += candidate.file_size
        evicted++
      }
    }

    // Batch evict all materialized files via fp-evict, verify before updating DB
    if (toEvict.length > 0) {
      const BATCH_SIZE = 50
      let verifiedEvicted = 0
      for (let i = 0; i < toEvict.length; i += BATCH_SIZE) {
        const batch = toEvict.slice(i, i + BATCH_SIZE)
        await evictFiles(batch.map(c => c.file_path))
        // Verify each file was actually evicted before updating DB
        for (const c of batch) {
          if (!isFileMaterialized(c.file_path)) {
            this.db.updateSyncStatus(c.id, 'cloud-only')
            verifiedEvicted++
          } else {
            // fp-evict failed silently for this file — don't lie in DB
            freedBytes -= c.file_size
            evicted--
          }
        }
      }
    }

    if (evicted > 0) {
      console.log(`Cache eviction: freed ${(freedBytes / 1024 / 1024).toFixed(1)} MB (${evicted} files)`)
      this.invalidatePathIndex()
    }

    return { evicted, freedBytes }
  }

  getStats(): { totalTracks: number; cachedTracks: number; cloudOnlyTracks: number; pinnedTracks: number; cachedBytes: number; pinnedBytes: number; maxSizeBytes: number } {
    return {
      ...this.db.getCacheStats(),
      maxSizeBytes: this.maxSizeBytes
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
