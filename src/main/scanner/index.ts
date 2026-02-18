import { BrowserWindow } from 'electron'
import { StorageProvider } from '../storage/provider'
import { LibraryDatabase, TrackUpsertData } from '../database'

export interface ScanProgress {
  phase: 'discovering' | 'scanning' | 'complete' | 'error'
  current: number
  total: number
  currentFile?: string
  error?: string
}

/** Interface for domain-specific metadata extraction */
export interface MetadataExtractor {
  /** Called once before scanning starts (e.g., to create artwork directories) */
  init?(): Promise<void>

  /** Extract metadata from a file, return track data and entity associations */
  extract(filePath: string, fileName: string, fileSize: number): Promise<{
    track: TrackUpsertData
    entities: { type: string; names: string[] }[]
  }>
}

export class FolderScanner {
  private db: LibraryDatabase
  private provider: StorageProvider
  private extractor: MetadataExtractor

  constructor(db: LibraryDatabase, provider: StorageProvider, extractor: MetadataExtractor) {
    this.db = db
    this.provider = provider
    this.extractor = extractor
  }

  async scan(rootPath: string, window: BrowserWindow): Promise<void> {
    if (this.extractor.init) {
      await this.extractor.init()
    }

    // Phase 1: Discover files
    this.sendProgress(window, { phase: 'discovering', current: 0, total: 0 })
    const files: { path: string; name: string; size: number }[] = []
    for await (const entry of this.provider.scan(rootPath)) {
      files.push({ path: entry.path, name: entry.name, size: entry.size })
      this.sendProgress(window, {
        phase: 'discovering',
        current: files.length,
        total: 0,
        currentFile: entry.name
      })
    }

    // Phase 2: Smart filter — scan new files AND files whose size changed (metadata edited)
    const existingPathsWithSize = this.db.getExistingPathsWithSize()

    const filesToScan: typeof files = []
    let skipped = 0
    for (const f of files) {
      const existingSize = existingPathsWithSize.get(f.path)
      if (existingSize === undefined) {
        // New file — not in DB
        filesToScan.push(f)
      } else if (existingSize !== f.size) {
        // Existing file with changed size — metadata was edited
        filesToScan.push(f)
      } else {
        // Same path + same size — skip
        skipped++
      }
    }
    const newFiles = filesToScan

    console.log(`Scanner: ${files.length} files found, ${skipped} unchanged, ${newFiles.length} to scan (new or modified)`)

    // Phase 3: Extract metadata via the pluggable extractor
    const batchSize = 20
    const batch: { track: TrackUpsertData; entities: { type: string; names: string[] }[] }[] = []

    const flushBatch = (items: typeof batch): void => {
      for (const { track, entities } of items) {
        const resolvedId = this.db.upsertTrack(track)
        for (const entity of entities) {
          if (entity.type === 'artist') {
            this.db.setTrackArtists(resolvedId, entity.names)
          } else if (entity.type === 'album_artist') {
            this.db.setTrackAlbumArtists(resolvedId, entity.names)
          }
        }
      }
    }

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i]
      this.sendProgress(window, {
        phase: 'scanning',
        current: skipped + i + 1,
        total: files.length,
        currentFile: file.name
      })

      try {
        const result = await this.extractor.extract(file.path, file.name, file.size)
        batch.push(result)

        if (batch.length >= batchSize) {
          flushBatch(batch.splice(0))
        }
      } catch (err) {
        console.error(`Failed to process ${file.path}:`, err)
      }
    }

    // Flush remaining
    if (batch.length > 0) {
      flushBatch(batch)
    }

    // Phase 4: Remove orphaned tracks (files deleted from disk)
    const discoveredPaths = new Set(files.map(f => f.path))
    const removed = this.db.removeOrphanTracks(discoveredPaths)
    if (removed > 0) {
      console.log(`Scanner: removed ${removed} orphaned tracks (files no longer on disk)`)
    }

    this.sendProgress(window, {
      phase: 'complete',
      current: files.length,
      total: files.length
    })
  }

  private sendProgress(window: BrowserWindow, progress: ScanProgress): void {
    if (!window.isDestroyed()) {
      window.webContents.send('scan-progress', progress)
    }
  }
}
