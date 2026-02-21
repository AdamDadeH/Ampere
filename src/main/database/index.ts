import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema'
import { parseArtists, isBrowsableArtist } from '../scanner/artist-parser'

export interface Track {
  id: string
  embedded_id: string | null
  file_path: string
  file_name: string
  file_size: number
  title: string | null
  artist: string | null
  album: string | null
  album_artist: string | null
  genre: string | null
  year: number | null
  track_number: number | null
  disc_number: number | null
  duration: number
  bitrate: number | null
  sample_rate: number | null
  codec: string | null
  artwork_path: string | null
  play_count: number
  last_played: string | null
  rating: number
  date_added: string
  date_modified: string
  sync_status: string
  cloud_path: string | null
  last_accessed: string | null
  pinned: number
  source_id: string | null
  inferred_rating: number | null
}

export interface ArtistInfo {
  artist: string
  track_count: number
  album_count: number
}

export interface AlbumInfo {
  album: string
  artist: string | null
  album_artist: string | null
  track_count: number
  artwork_path: string | null
  year: number | null
}

export interface LibraryStats {
  total_tracks: number
  total_artists: number
  total_album_artists: number
  total_albums: number
  total_duration: number
}

export type TrackUpsertData = Omit<Track, 'play_count' | 'last_played' | 'rating' | 'date_added' | 'date_modified' | 'last_accessed' | 'pinned'>

export class LibraryDatabase {
  private db: Database.Database

  constructor() {
    const userDataPath = app.getPath('userData')
    mkdirSync(userDataPath, { recursive: true })
    const dbPath = join(userDataPath, 'library.db')
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.init()
  }

  private init(): void {
    this.ensureSchema()
    this.refreshDerivedTables()
  }

  private ensureSchema(): void {
    // Handles both fresh installs and existing databases
    this.db.exec(SCHEMA_SQL)

    // Legacy databases created before embedded_id existed
    try {
      this.db.exec('ALTER TABLE tracks ADD COLUMN embedded_id TEXT')
      this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_embedded_id ON tracks(embedded_id)')
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_file_path ON tracks(file_path)')
    } catch {
      // Column already exists
    }

    // Cloud-first columns: last_accessed for LRU eviction, pinned for keep-local,
    // source_id to link tracks to their storage source
    const addColumnSafe = (sql: string): void => {
      try { this.db.exec(sql) } catch { /* column already exists */ }
    }
    addColumnSafe('ALTER TABLE tracks ADD COLUMN last_accessed TEXT')
    addColumnSafe('ALTER TABLE tracks ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0')
    addColumnSafe('ALTER TABLE tracks ADD COLUMN source_id TEXT')
    addColumnSafe('ALTER TABLE tracks ADD COLUMN inferred_rating REAL DEFAULT NULL')
  }

  private refreshDerivedTables(): void {
    const currentVersion = (this.db.pragma('user_version', { simple: true }) as number) || 0

    if (currentVersion < SCHEMA_VERSION) {
      // Junction tables are derived data — safe to clear and rebuild
      this.db.exec('DELETE FROM track_artists')
      this.db.exec('DELETE FROM track_album_artists')
      this.db.pragma(`user_version = ${SCHEMA_VERSION}`)
    }

    this.backfillIfNeeded()
  }

  /**
   * Smart upsert: matches by embedded_id first (survives renames),
   * then falls back to file_path. Updates metadata and path on match.
   */
  upsertTrack(track: TrackUpsertData): string {
    // Strategy 1: Match by embedded_id (strongest — survives rename/move)
    if (track.embedded_id) {
      const existing = this.db.prepare(
        'SELECT id, play_count, rating, last_played, date_added FROM tracks WHERE embedded_id = ?'
      ).get(track.embedded_id) as Pick<Track, 'id' | 'play_count' | 'rating' | 'last_played' | 'date_added'> | undefined

      if (existing) {
        // Update everything (including file_path which may have changed)
        this.db.prepare(`
          UPDATE tracks SET
            file_path = ?, file_name = ?, file_size = ?,
            title = ?, artist = ?, album = ?, album_artist = ?,
            genre = ?, year = ?, track_number = ?, disc_number = ?,
            duration = ?, bitrate = ?, sample_rate = ?, codec = ?,
            artwork_path = ?, sync_status = ?, cloud_path = ?, source_id = ?,
            date_modified = datetime('now')
          WHERE id = ?
        `).run(
          track.file_path, track.file_name, track.file_size,
          track.title, track.artist, track.album, track.album_artist,
          track.genre, track.year, track.track_number, track.disc_number,
          track.duration, track.bitrate, track.sample_rate, track.codec,
          track.artwork_path, track.sync_status, track.cloud_path, track.source_id,
          existing.id
        )
        return existing.id
      }
    }

    // Strategy 2: Match by file_path (fallback for files without embedded ID)
    const existingByPath = this.db.prepare(
      'SELECT id FROM tracks WHERE file_path = ?'
    ).get(track.file_path) as { id: string } | undefined

    if (existingByPath) {
      this.db.prepare(`
        UPDATE tracks SET
          embedded_id = ?, file_name = ?, file_size = ?,
          title = ?, artist = ?, album = ?, album_artist = ?,
          genre = ?, year = ?, track_number = ?, disc_number = ?,
          duration = ?, bitrate = ?, sample_rate = ?, codec = ?,
          artwork_path = ?, sync_status = ?, cloud_path = ?, source_id = ?,
          date_modified = datetime('now')
        WHERE id = ?
      `).run(
        track.embedded_id, track.file_name, track.file_size,
        track.title, track.artist, track.album, track.album_artist,
        track.genre, track.year, track.track_number, track.disc_number,
        track.duration, track.bitrate, track.sample_rate, track.codec,
        track.artwork_path, track.sync_status, track.cloud_path, track.source_id,
        existingByPath.id
      )
      return existingByPath.id
    }

    // Strategy 3: New track — insert
    this.db.prepare(`
      INSERT INTO tracks (id, embedded_id, file_path, file_name, file_size,
        title, artist, album, album_artist, genre, year, track_number, disc_number,
        duration, bitrate, sample_rate, codec, artwork_path, sync_status, cloud_path, source_id)
      VALUES (@id, @embedded_id, @file_path, @file_name, @file_size,
        @title, @artist, @album, @album_artist, @genre, @year, @track_number, @disc_number,
        @duration, @bitrate, @sample_rate, @codec, @artwork_path, @sync_status, @cloud_path, @source_id)
    `).run(track)
    return track.id
  }

  upsertTracks(tracks: TrackUpsertData[]): void {
    const transaction = this.db.transaction((items: typeof tracks) => {
      for (const track of items) {
        this.upsertTrack(track)
      }
    })
    transaction(tracks)
  }

  getTrackByPath(filePath: string): { id: string; sync_status: string } | undefined {
    return this.db.prepare('SELECT id, sync_status FROM tracks WHERE file_path = ?').get(filePath) as { id: string; sync_status: string } | undefined
  }

  hasTrackByPath(filePath: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM tracks WHERE file_path = ?').get(filePath)
    return row !== undefined
  }

  getExistingPaths(): Set<string> {
    const rows = this.db.prepare('SELECT file_path FROM tracks').all() as { file_path: string }[]
    return new Set(rows.map(r => r.file_path))
  }

  getExistingPathsWithSize(): Map<string, number> {
    const rows = this.db.prepare('SELECT file_path, file_size FROM tracks').all() as { file_path: string; file_size: number }[]
    return new Map(rows.map(r => [r.file_path, r.file_size]))
  }

  removeOrphanTracks(validPaths: Set<string>): number {
    const allPaths = this.db.prepare('SELECT file_path FROM tracks').all() as { file_path: string }[]
    const orphanPaths = allPaths.filter(r => !validPaths.has(r.file_path)).map(r => r.file_path)
    if (orphanPaths.length === 0) return 0
    const del = this.db.prepare('DELETE FROM tracks WHERE file_path = ?')
    const transaction = this.db.transaction((paths: string[]) => {
      for (const p of paths) del.run(p)
    })
    transaction(orphanPaths)
    return orphanPaths.length
  }

  getExistingEmbeddedIds(): Set<string> {
    const rows = this.db.prepare('SELECT embedded_id FROM tracks WHERE embedded_id IS NOT NULL').all() as { embedded_id: string }[]
    return new Set(rows.map(r => r.embedded_id))
  }

  getTrack(id: string): Track | undefined {
    return this.db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as Track | undefined
  }

  getAllTracks(): Track[] {
    return this.db.prepare(
      'SELECT * FROM tracks ORDER BY album_artist, album, disc_number, track_number, title'
    ).all() as Track[]
  }

  getArtists(): ArtistInfo[] {
    return this.db.prepare(`
      SELECT
        ta.artist_name as artist,
        COUNT(DISTINCT ta.track_id) as track_count,
        COUNT(DISTINCT t.album) as album_count
      FROM track_artists ta
      JOIN tracks t ON t.id = ta.track_id
      GROUP BY ta.artist_name
      ORDER BY ta.artist_name COLLATE NOCASE
    `).all() as ArtistInfo[]
  }

  getAlbumArtists(): ArtistInfo[] {
    return this.db.prepare(`
      SELECT
        taa.artist_name as artist,
        COUNT(DISTINCT taa.track_id) as track_count,
        COUNT(DISTINCT t.album) as album_count
      FROM track_album_artists taa
      JOIN tracks t ON t.id = taa.track_id
      GROUP BY taa.artist_name
      ORDER BY taa.artist_name COLLATE NOCASE
    `).all() as ArtistInfo[]
  }

  getTracksByAlbumArtist(artist: string): Track[] {
    return this.db.prepare(`
      SELECT DISTINCT t.* FROM tracks t
      JOIN track_album_artists taa ON taa.track_id = t.id
      WHERE taa.artist_name = ?
      ORDER BY t.album, t.disc_number, t.track_number
    `).all(artist) as Track[]
  }

  getAlbumsByAlbumArtist(artist: string): AlbumInfo[] {
    return this.db.prepare(`
      SELECT
        COALESCE(t.album, 'Unknown Album') as album,
        t.artist,
        t.album_artist,
        COUNT(*) as track_count,
        MAX(t.artwork_path) as artwork_path,
        MAX(t.year) as year
      FROM tracks t
      JOIN track_album_artists taa ON taa.track_id = t.id
      WHERE taa.artist_name = ?
      GROUP BY COALESCE(t.album, 'Unknown Album')
      ORDER BY year DESC, album
    `).all(artist) as AlbumInfo[]
  }

  getAlbums(artist?: string): AlbumInfo[] {
    if (artist) {
      return this.db.prepare(`
        SELECT
          COALESCE(t.album, 'Unknown Album') as album,
          t.artist,
          t.album_artist,
          COUNT(*) as track_count,
          MAX(t.artwork_path) as artwork_path,
          MAX(t.year) as year
        FROM tracks t
        JOIN track_artists ta ON ta.track_id = t.id
        WHERE ta.artist_name = ?
        GROUP BY COALESCE(t.album, 'Unknown Album')
        ORDER BY year DESC, album
      `).all(artist) as AlbumInfo[]
    }
    return this.db.prepare(`
      SELECT
        COALESCE(album, 'Unknown Album') as album,
        MAX(artist) as artist,
        album_artist,
        COUNT(*) as track_count,
        MAX(artwork_path) as artwork_path,
        MAX(year) as year
      FROM tracks
      GROUP BY COALESCE(album, 'Unknown Album'), album_artist
      ORDER BY album_artist, year DESC, album
    `).all() as AlbumInfo[]
  }

  getTracksByArtist(artist: string): Track[] {
    return this.db.prepare(`
      SELECT DISTINCT t.* FROM tracks t
      JOIN track_artists ta ON ta.track_id = t.id
      WHERE ta.artist_name = ?
      ORDER BY t.album, t.disc_number, t.track_number
    `).all(artist) as Track[]
  }

  getTracksByAlbum(album: string, artist?: string): Track[] {
    if (artist) {
      return this.db.prepare(
        'SELECT * FROM tracks WHERE album = ? AND (artist = ? OR album_artist = ?) ORDER BY disc_number, track_number'
      ).all(album, artist, artist) as Track[]
    }
    return this.db.prepare(
      'SELECT * FROM tracks WHERE album = ? ORDER BY disc_number, track_number'
    ).all(album) as Track[]
  }

  incrementPlayCount(trackId: string): void {
    this.db.prepare(
      "UPDATE tracks SET play_count = play_count + 1, last_played = datetime('now') WHERE id = ?"
    ).run(trackId)
  }

  updateLastPlayed(trackId: string): void {
    this.db.prepare(
      "UPDATE tracks SET last_played = datetime('now') WHERE id = ?"
    ).run(trackId)
  }

  setRating(trackId: string, rating: number): void {
    this.db.prepare('UPDATE tracks SET rating = ? WHERE id = ?').run(rating, trackId)
  }

  searchTracks(query: string): Track[] {
    const pattern = `%${query}%`
    return this.db.prepare(`
      SELECT * FROM tracks
      WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ?
      ORDER BY artist, album, track_number
    `).all(pattern, pattern, pattern, pattern) as Track[]
  }

  getLibraryStats(): LibraryStats {
    const trackStats = this.db.prepare(`
      SELECT
        COUNT(*) as total_tracks,
        COUNT(DISTINCT COALESCE(album, 'Unknown')) as total_albums,
        COALESCE(SUM(duration), 0) as total_duration
      FROM tracks
    `).get() as { total_tracks: number; total_albums: number; total_duration: number }

    const artistCount = this.db.prepare(
      'SELECT COUNT(DISTINCT artist_name) as total_artists FROM track_artists'
    ).get() as { total_artists: number }

    const albumArtistCount = this.db.prepare(
      'SELECT COUNT(DISTINCT artist_name) as total_album_artists FROM track_album_artists'
    ).get() as { total_album_artists: number }

    return {
      total_tracks: trackStats.total_tracks,
      total_artists: artistCount.total_artists,
      total_album_artists: albumArtistCount.total_album_artists,
      total_albums: trackStats.total_albums,
      total_duration: trackStats.total_duration
    }
  }

  setTrackArtists(trackId: string, artistNames: string[]): void {
    this.db.prepare('DELETE FROM track_artists WHERE track_id = ?').run(trackId)
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO track_artists (track_id, artist_name) VALUES (?, ?)'
    )
    for (const name of artistNames) {
      if (isBrowsableArtist(name)) {
        insert.run(trackId, name)
      }
    }
  }

  setTrackAlbumArtists(trackId: string, artistNames: string[]): void {
    this.db.prepare('DELETE FROM track_album_artists WHERE track_id = ?').run(trackId)
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO track_album_artists (track_id, artist_name) VALUES (?, ?)'
    )
    for (const name of artistNames) {
      if (isBrowsableArtist(name)) {
        insert.run(trackId, name)
      }
    }
  }

  bulkSetTrackArtists(entries: { trackId: string; trackArtists: string[]; albumArtists: string[] }[]): void {
    const transaction = this.db.transaction((items: typeof entries) => {
      const delTrack = this.db.prepare('DELETE FROM track_artists WHERE track_id = ?')
      const insTrack = this.db.prepare(
        'INSERT OR IGNORE INTO track_artists (track_id, artist_name) VALUES (?, ?)'
      )
      const delAlbum = this.db.prepare('DELETE FROM track_album_artists WHERE track_id = ?')
      const insAlbum = this.db.prepare(
        'INSERT OR IGNORE INTO track_album_artists (track_id, artist_name) VALUES (?, ?)'
      )
      for (const { trackId, trackArtists, albumArtists } of items) {
        delTrack.run(trackId)
        for (const name of trackArtists) {
          if (isBrowsableArtist(name)) insTrack.run(trackId, name)
        }
        delAlbum.run(trackId)
        for (const name of albumArtists) {
          if (isBrowsableArtist(name)) insAlbum.run(trackId, name)
        }
      }
    })
    transaction(entries)
  }

  isTrackArtistsPopulated(): boolean {
    const row = this.db.prepare('SELECT 1 FROM track_artists LIMIT 1').get()
    return row !== undefined
  }

  backfillTrackArtists(): void {
    const tracks = this.db.prepare('SELECT id, artist, album_artist FROM tracks').all() as { id: string; artist: string | null; album_artist: string | null }[]
    const entries = tracks.map((t) => ({
      trackId: t.id,
      trackArtists: parseArtists(t.artist),
      albumArtists: parseArtists(t.album_artist)
    }))
    this.bulkSetTrackArtists(entries)
    console.log(`Backfilled track_artists and track_album_artists for ${entries.length} tracks`)
  }

  private isTrackAlbumArtistsPopulated(): boolean {
    const row = this.db.prepare('SELECT 1 FROM track_album_artists LIMIT 1').get()
    return row !== undefined
  }

  private backfillIfNeeded(): void {
    const hasData = this.db.prepare('SELECT COUNT(*) as c FROM tracks').get() as { c: number }
    if (hasData.c > 0 && (!this.isTrackArtistsPopulated() || !this.isTrackAlbumArtistsPopulated())) {
      this.backfillTrackArtists()
    }
  }

  resolveTrackId(track: TrackUpsertData): string | null {
    if (track.embedded_id) {
      const row = this.db.prepare('SELECT id FROM tracks WHERE embedded_id = ?').get(track.embedded_id) as { id: string } | undefined
      if (row) return row.id
    }
    const row = this.db.prepare('SELECT id FROM tracks WHERE file_path = ?').get(track.file_path) as { id: string } | undefined
    return row?.id ?? null
  }

  upsertTrackFeatures(trackId: string, featuresJson: string): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO track_features (track_id, features_json) VALUES (?, ?)'
    ).run(trackId, featuresJson)
  }

  setUmapCoords(trackId: string, x: number, y: number, z: number): void {
    this.db.prepare(
      'UPDATE track_features SET umap_x = ?, umap_y = ?, umap_z = ? WHERE track_id = ?'
    ).run(x, y, z, trackId)
  }

  bulkSetUmapCoords(coords: { trackId: string; x: number; y: number; z: number }[]): void {
    const stmt = this.db.prepare(
      'UPDATE track_features SET umap_x = ?, umap_y = ?, umap_z = ? WHERE track_id = ?'
    )
    const transaction = this.db.transaction((items: typeof coords) => {
      for (const { trackId, x, y, z } of items) {
        stmt.run(x, y, z, trackId)
      }
    })
    transaction(coords)
  }

  getTrackFeatures(): { track_id: string; features_json: string }[] {
    return this.db.prepare(
      'SELECT track_id, features_json FROM track_features'
    ).all() as { track_id: string; features_json: string }[]
  }

  getTrackFeaturesWithCoords(): { track_id: string; features_json: string; umap_x: number; umap_y: number; umap_z: number }[] {
    return this.db.prepare(
      'SELECT track_id, features_json, umap_x, umap_y, umap_z FROM track_features WHERE umap_x IS NOT NULL'
    ).all() as { track_id: string; features_json: string; umap_x: number; umap_y: number; umap_z: number }[]
  }

  getTracksWithoutFeatures(): { id: string; file_path: string }[] {
    return this.db.prepare(
      'SELECT t.id, t.file_path FROM tracks t LEFT JOIN track_features tf ON t.id = tf.track_id WHERE tf.track_id IS NULL'
    ).all() as { id: string; file_path: string }[]
  }

  getFeatureCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM track_features').get() as { count: number }
    return row.count
  }

  // --- Storage Sources ---

  addStorageSource(source: { id: string; type: string; root_path: string; label?: string; proton_email?: string }): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO storage_sources (id, type, root_path, label, proton_email) VALUES (?, ?, ?, ?, ?)'
    ).run(source.id, source.type, source.root_path, source.label || null, source.proton_email || null)
  }

  getStorageSources(): { id: string; type: string; root_path: string; label: string | null; proton_email: string | null; added_at: string }[] {
    return this.db.prepare('SELECT * FROM storage_sources').all() as {
      id: string; type: string; root_path: string; label: string | null; proton_email: string | null; added_at: string
    }[]
  }

  getStorageSource(id: string): { id: string; type: string; root_path: string; label: string | null; proton_email: string | null } | undefined {
    return this.db.prepare('SELECT * FROM storage_sources WHERE id = ?').get(id) as {
      id: string; type: string; root_path: string; label: string | null; proton_email: string | null
    } | undefined
  }

  removeStorageSource(id: string): void {
    this.db.prepare('DELETE FROM storage_sources WHERE id = ?').run(id)
  }

  findStorageSourceByPath(rootPath: string): { id: string; type: string; root_path: string } | undefined {
    return this.db.prepare('SELECT * FROM storage_sources WHERE root_path = ?').get(rootPath) as {
      id: string; type: string; root_path: string
    } | undefined
  }

  // --- Cache Management ---

  updateLastAccessed(trackId: string): void {
    this.db.prepare("UPDATE tracks SET last_accessed = datetime('now') WHERE id = ?").run(trackId)
  }

  pinTrack(trackId: string): void {
    this.db.prepare('UPDATE tracks SET pinned = 1 WHERE id = ?').run(trackId)
  }

  unpinTrack(trackId: string): void {
    this.db.prepare('UPDATE tracks SET pinned = 0 WHERE id = ?').run(trackId)
  }

  isPinned(trackId: string): boolean {
    const row = this.db.prepare('SELECT pinned FROM tracks WHERE id = ?').get(trackId) as { pinned: number } | undefined
    return row?.pinned === 1
  }

  /**
   * Get eviction candidates: cached PD tracks that aren't pinned, ordered by least recently accessed.
   */
  getEvictionCandidates(): { id: string; file_path: string; file_size: number; last_accessed: string | null }[] {
    return this.db.prepare(`
      SELECT id, file_path, file_size, last_accessed FROM tracks
      WHERE sync_status = 'cached' AND pinned = 0
      ORDER BY last_accessed ASC NULLS FIRST
    `).all() as { id: string; file_path: string; file_size: number; last_accessed: string | null }[]
  }

  /**
   * Get cache statistics for UI display.
   */
  getCacheStats(): { totalTracks: number; cachedTracks: number; cloudOnlyTracks: number; pinnedTracks: number; cachedBytes: number; pinnedBytes: number } {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as totalTracks,
        SUM(CASE WHEN sync_status = 'cached' THEN 1 ELSE 0 END) as cachedTracks,
        SUM(CASE WHEN sync_status = 'cloud-only' THEN 1 ELSE 0 END) as cloudOnlyTracks,
        SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) as pinnedTracks,
        COALESCE(SUM(CASE WHEN sync_status = 'cached' THEN file_size ELSE 0 END), 0) as cachedBytes,
        COALESCE(SUM(CASE WHEN pinned = 1 THEN file_size ELSE 0 END), 0) as pinnedBytes
      FROM tracks
    `).get() as { totalTracks: number; cachedTracks: number; cloudOnlyTracks: number; pinnedTracks: number; cachedBytes: number; pinnedBytes: number }
    return row
  }

  updateSyncStatus(trackId: string, status: string): void {
    this.db.prepare('UPDATE tracks SET sync_status = ? WHERE id = ?').run(status, trackId)
  }

  /**
   * Bulk update sync_status for tracks within a Proton Drive source path.
   * Used during the one-time migration from 'local' to 'cached' for existing PD tracks.
   */
  migrateProtonDriveSyncStatus(pdRootPath: string, sourceId: string): number {
    const result = this.db.prepare(`
      UPDATE tracks SET sync_status = 'cached', source_id = ?
      WHERE file_path LIKE ? AND sync_status = 'local'
    `).run(sourceId, pdRootPath + '%')
    return result.changes
  }

  // --- Feedback ---

  recordFeedback(trackId: string, eventType: string, eventValue: number | null, attentionWeight: number, source: string | null): void {
    this.db.prepare(
      'INSERT INTO track_feedback (track_id, event_type, event_value, attention_weight, source) VALUES (?, ?, ?, ?, ?)'
    ).run(trackId, eventType, eventValue, attentionWeight, source)
  }

  getTrackFeedback(trackId: string): { id: number; track_id: string; event_type: string; event_value: number | null; attention_weight: number; source: string | null; created_at: string }[] {
    return this.db.prepare(
      'SELECT * FROM track_feedback WHERE track_id = ? ORDER BY created_at DESC'
    ).all(trackId) as { id: number; track_id: string; event_type: string; event_value: number | null; attention_weight: number; source: string | null; created_at: string }[]
  }

  // --- Inferred rating: learned model with heuristic fallback ---

  private static readonly FEEDBACK_EVENT_TYPES = [
    'track_completed', 'track_skipped', 'track_started',
    'seek_backward', 'seek_forward', 'pause_abandon',
    'explicit_positive', 'explicit_positive_not_now', 'explicit_negative'
  ] as const

  private static readonly MIN_TRAINING_SAMPLES = 15

  /**
   * Aggregate raw feedback events into a feature vector per track.
   * Features (12-dim): 9 attention-weighted event counts,
   * avg completion %, avg skip completion %, log2(total_events+1).
   */
  private aggregateFeedbackFeatures(): Map<string, number[]> {
    const rows = this.db.prepare(
      'SELECT track_id, event_type, event_value, attention_weight FROM track_feedback'
    ).all() as { track_id: string; event_type: string; event_value: number | null; attention_weight: number }[]

    const trackData = new Map<string, {
      weightedCounts: number[]
      completionSum: number; completionCount: number
      skipCompletionSum: number; skipCompletionCount: number
      totalEvents: number
    }>()

    for (const row of rows) {
      let data = trackData.get(row.track_id)
      if (!data) {
        data = {
          weightedCounts: new Array(9).fill(0),
          completionSum: 0, completionCount: 0,
          skipCompletionSum: 0, skipCompletionCount: 0,
          totalEvents: 0
        }
        trackData.set(row.track_id, data)
      }

      const idx = (LibraryDatabase.FEEDBACK_EVENT_TYPES as readonly string[]).indexOf(row.event_type)
      if (idx >= 0) data.weightedCounts[idx] += row.attention_weight

      if (row.event_type === 'track_completed' && row.event_value != null) {
        data.completionSum += row.event_value
        data.completionCount++
      }
      if (row.event_type === 'track_skipped' && row.event_value != null) {
        data.skipCompletionSum += row.event_value
        data.skipCompletionCount++
      }
      data.totalEvents++
    }

    const features = new Map<string, number[]>()
    for (const [trackId, data] of trackData) {
      features.set(trackId, [
        ...data.weightedCounts,
        data.completionCount > 0 ? data.completionSum / data.completionCount : 0,
        data.skipCompletionCount > 0 ? data.skipCompletionSum / data.skipCompletionCount : 0,
        Math.log2(data.totalEvents + 1)
      ])
    }
    return features
  }

  /**
   * Fit a ridge regression from feedback features → explicit star ratings.
   * Returns model weights + normalization params, or null if insufficient data.
   */
  private fitRatingModel(features: Map<string, number[]>): {
    weights: number[]; means: number[]; stds: number[]; trainingSize: number
  } | null {
    const ratedTracks = this.db.prepare(
      'SELECT id, rating FROM tracks WHERE rating > 0'
    ).all() as { id: string; rating: number }[]

    const X: number[][] = []
    const y: number[] = []
    for (const track of ratedTracks) {
      const feat = features.get(track.id)
      if (feat) {
        X.push(feat)
        y.push(track.rating)
      }
    }

    if (X.length < LibraryDatabase.MIN_TRAINING_SAMPLES) return null

    const dim = X[0].length

    // Z-score normalization
    const means = new Array(dim).fill(0)
    const stds = new Array(dim).fill(0)
    for (let j = 0; j < dim; j++) {
      let sum = 0
      for (let i = 0; i < X.length; i++) sum += X[i][j]
      means[j] = sum / X.length
    }
    for (let j = 0; j < dim; j++) {
      let sumSq = 0
      for (let i = 0; i < X.length; i++) sumSq += (X[i][j] - means[j]) ** 2
      stds[j] = Math.sqrt(sumSq / X.length) || 1
    }

    // Normalize + add bias column
    const Xnorm = X.map(row => {
      const normed = row.map((v, j) => (v - means[j]) / stds[j])
      normed.push(1) // bias
      return normed
    })

    const weights = this.solveRidge(Xnorm, y, 1.0)
    if (!weights) return null

    return { weights, means, stds, trainingSize: X.length }
  }

  /**
   * Ridge regression via normal equation: w = (X^T X + λI)^{-1} X^T y
   * λ applied to feature weights only, not bias.
   */
  private solveRidge(X: number[][], y: number[], lambda: number): number[] | null {
    const n = X.length
    const p = X[0].length

    // X^T X
    const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0))
    for (let i = 0; i < p; i++) {
      for (let j = i; j < p; j++) {
        let sum = 0
        for (let k = 0; k < n; k++) sum += X[k][i] * X[k][j]
        XtX[i][j] = sum
        XtX[j][i] = sum
      }
    }
    // Ridge penalty on features, not bias
    for (let i = 0; i < p - 1; i++) XtX[i][i] += lambda

    // X^T y
    const Xty: number[] = new Array(p).fill(0)
    for (let i = 0; i < p; i++) {
      let sum = 0
      for (let k = 0; k < n; k++) sum += X[k][i] * y[k]
      Xty[i] = sum
    }

    return this.gaussianSolve(XtX, Xty)
  }

  /** Gaussian elimination with partial pivoting. */
  private gaussianSolve(A: number[][], b: number[]): number[] | null {
    const n = A.length
    const aug = A.map((row, i) => [...row, b[i]])

    for (let col = 0; col < n; col++) {
      let maxRow = col
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
      }
      ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
      if (Math.abs(aug[col][col]) < 1e-10) return null

      for (let row = col + 1; row < n; row++) {
        const factor = aug[row][col] / aug[col][col]
        for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j]
      }
    }

    const x = new Array(n).fill(0)
    for (let i = n - 1; i >= 0; i--) {
      x[i] = aug[i][n]
      for (let j = i + 1; j < n; j++) x[i] -= aug[i][j] * x[j]
      x[i] /= aug[i][i]
    }
    return x
  }

  /**
   * Heuristic fallback: hand-tuned event scores with sigmoid mapping.
   * Used when fewer than MIN_TRAINING_SAMPLES rated tracks have feedback.
   */
  private applyHeuristicRatings(): void {
    const scoreMap: Record<string, (ev: number | null, src: string | null) => number> = {
      'track_completed': () => 0.3,
      'track_skipped': (ev) => -0.1 - 0.6 * (1 - (ev ?? 0)),
      'track_started': (_ev, src) => {
        if (src === 'search_play') return 0.5
        if (src === 'intentional_select') return 0.2
        return 0.0
      },
      'seek_backward': () => 0.4,
      'seek_forward': () => -0.1,
      'pause_abandon': () => -0.3,
      'explicit_positive': () => 1.0,
      'explicit_positive_not_now': () => 0.7,
      'explicit_negative': () => -1.0,
    }

    const rows = this.db.prepare(
      'SELECT track_id, event_type, event_value, attention_weight, source FROM track_feedback'
    ).all() as { track_id: string; event_type: string; event_value: number | null; attention_weight: number; source: string | null }[]

    const trackScores = new Map<string, { total: number; count: number }>()
    for (const row of rows) {
      const scorer = scoreMap[row.event_type]
      if (!scorer) continue
      const weighted = scorer(row.event_value, row.source) * row.attention_weight
      const existing = trackScores.get(row.track_id)
      if (existing) {
        existing.total += weighted
        existing.count++
      } else {
        trackScores.set(row.track_id, { total: weighted, count: 1 })
      }
    }

    const update = this.db.prepare('UPDATE tracks SET inferred_rating = ? WHERE id = ?')
    const clear = this.db.prepare(
      'UPDATE tracks SET inferred_rating = NULL WHERE id NOT IN (SELECT DISTINCT track_id FROM track_feedback)'
    )
    const transaction = this.db.transaction(() => {
      clear.run()
      for (const [trackId, { total, count }] of trackScores) {
        const normalized = total / Math.log2(count + 1)
        const inferred = 5.0 / (1.0 + Math.exp(-normalized * 2))
        update.run(Math.round(inferred * 100) / 100, trackId)
      }
    })
    transaction()
  }

  /**
   * Recompute inferred_rating for all tracks with feedback.
   * Tries to fit a ridge regression from rated tracks' feedback → rating.
   * Falls back to hand-tuned heuristic when training data is insufficient.
   */
  recomputeInferredRatings(): void {
    const features = this.aggregateFeedbackFeatures()
    if (features.size === 0) {
      this.db.prepare('UPDATE tracks SET inferred_rating = NULL').run()
      return
    }

    const model = this.fitRatingModel(features)
    if (model) {
      const { weights, means, stds, trainingSize } = model
      const update = this.db.prepare('UPDATE tracks SET inferred_rating = ? WHERE id = ?')
      const clear = this.db.prepare(
        'UPDATE tracks SET inferred_rating = NULL WHERE id NOT IN (SELECT DISTINCT track_id FROM track_feedback)'
      )
      const transaction = this.db.transaction(() => {
        clear.run()
        for (const [trackId, feat] of features) {
          const normed = feat.map((v, j) => (v - means[j]) / stds[j])
          normed.push(1) // bias
          let predicted = 0
          for (let j = 0; j < weights.length; j++) predicted += normed[j] * weights[j]
          const clamped = Math.round(Math.max(0, Math.min(5, predicted)) * 100) / 100
          update.run(clamped, trackId)
        }
      })
      transaction()
      console.log(`Inferred ratings: learned model (${trainingSize} training pairs, ${features.size} predictions)`)
    } else {
      this.applyHeuristicRatings()
      console.log(`Inferred ratings: heuristic fallback (${features.size} tracks, <${LibraryDatabase.MIN_TRAINING_SAMPLES} rated pairs)`)
    }
  }

  close(): void {
    this.db.close()
  }
}
