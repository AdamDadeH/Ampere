import { parseFile } from 'music-metadata'
import { createHash } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join, basename } from 'path'
import { app, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { StorageProvider } from '../storage/provider'
import { LibraryDatabase, TrackUpsertData } from '../database'
import { ensureEmbeddedId } from './tagger'
import { parseArtists, isBrowsableArtist } from './artist-parser'

export interface ScanProgress {
  phase: 'discovering' | 'scanning' | 'complete' | 'error'
  current: number
  total: number
  currentFile?: string
  error?: string
}

export class FolderScanner {
  private db: LibraryDatabase
  private provider: StorageProvider
  private artworkDir: string

  constructor(db: LibraryDatabase, provider: StorageProvider) {
    this.db = db
    this.provider = provider
    this.artworkDir = join(app.getPath('userData'), 'artwork')
  }

  async scan(rootPath: string, window: BrowserWindow): Promise<void> {
    await mkdir(this.artworkDir, { recursive: true })

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
    const existingEmbeddedIds = this.db.getExistingEmbeddedIds()

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

    // Phase 3: Extract metadata and write embedded IDs
    const batchSize = 20
    const batch: { track: TrackUpsertData; parsedTrackArtists: string[]; parsedAlbumArtists: string[] }[] = []

    const flushBatch = (items: typeof batch): void => {
      for (const { track, parsedTrackArtists, parsedAlbumArtists } of items) {
        const resolvedId = this.db.upsertTrack(track)
        this.db.setTrackArtists(resolvedId, parsedTrackArtists)
        this.db.setTrackAlbumArtists(resolvedId, parsedAlbumArtists)
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
        const { track, parsedTrackArtists, parsedAlbumArtists } = await this.extractMetadata(file.path, file.name, file.size)

        // Try to read or write the embedded PROTONMUSIC_ID
        const embeddedId = ensureEmbeddedId(file.path)
        if (embeddedId) {
          track.embedded_id = embeddedId
          // If this embedded ID already exists in DB, the upsert will
          // update the existing record (preserving play count, ratings, etc.)
          // instead of creating a duplicate
        }

        batch.push({ track, parsedTrackArtists, parsedAlbumArtists })

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

  private async extractMetadata(
    filePath: string,
    fileName: string,
    fileSize: number
  ): Promise<{ track: TrackUpsertData; parsedTrackArtists: string[]; parsedAlbumArtists: string[] }> {
    const metadata = await parseFile(filePath)
    const { common, format } = metadata

    let artworkPath: string | null = null
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0]
      const hash = createHash('md5').update(pic.data).digest('hex')
      const ext = pic.format?.includes('png') ? '.png' : '.jpg'
      artworkPath = join(this.artworkDir, `${hash}${ext}`)
      try {
        await writeFile(artworkPath, pic.data)
      } catch {
        artworkPath = null
      }
    }

    const titleFromName = basename(fileName, fileName.substring(fileName.lastIndexOf('.')))

    // Parse track artists and album artists separately — they are distinct fields
    const artistString = common.artist || null
    const artistsArray = common.artists
    const parsedTrackArtists = parseArtists(artistString, artistsArray)

    const albumArtistString = common.albumartist || null
    const parsedAlbumArtists = parseArtists(albumArtistString)

    const track: TrackUpsertData = {
      id: uuidv4(),
      embedded_id: null, // Will be set by ensureEmbeddedId
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      title: common.title || titleFromName,
      artist: artistString,
      album: common.album || null,
      album_artist: common.albumartist || null,
      genre: common.genre?.[0] || null,
      year: common.year || null,
      track_number: common.track?.no || null,
      disc_number: common.disk?.no || null,
      duration: format.duration || 0,
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
      sample_rate: format.sampleRate || null,
      codec: format.codec || null,
      artwork_path: artworkPath,
      sync_status: 'local',
      cloud_path: null
    }

    return { track, parsedTrackArtists, parsedAlbumArtists }
  }

  private sendProgress(window: BrowserWindow, progress: ScanProgress): void {
    if (!window.isDestroyed()) {
      window.webContents.send('scan-progress', progress)
    }
  }
}
