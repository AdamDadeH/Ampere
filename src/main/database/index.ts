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

export type TrackUpsertData = Omit<Track, 'play_count' | 'last_played' | 'rating' | 'date_added' | 'date_modified'>

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
            artwork_path = ?, sync_status = ?, cloud_path = ?,
            date_modified = datetime('now')
          WHERE id = ?
        `).run(
          track.file_path, track.file_name, track.file_size,
          track.title, track.artist, track.album, track.album_artist,
          track.genre, track.year, track.track_number, track.disc_number,
          track.duration, track.bitrate, track.sample_rate, track.codec,
          track.artwork_path, track.sync_status, track.cloud_path,
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
          artwork_path = ?, sync_status = ?, cloud_path = ?,
          date_modified = datetime('now')
        WHERE id = ?
      `).run(
        track.embedded_id, track.file_name, track.file_size,
        track.title, track.artist, track.album, track.album_artist,
        track.genre, track.year, track.track_number, track.disc_number,
        track.duration, track.bitrate, track.sample_rate, track.codec,
        track.artwork_path, track.sync_status, track.cloud_path,
        existingByPath.id
      )
      return existingByPath.id
    }

    // Strategy 3: New track — insert
    this.db.prepare(`
      INSERT INTO tracks (id, embedded_id, file_path, file_name, file_size,
        title, artist, album, album_artist, genre, year, track_number, disc_number,
        duration, bitrate, sample_rate, codec, artwork_path, sync_status, cloud_path)
      VALUES (@id, @embedded_id, @file_path, @file_name, @file_size,
        @title, @artist, @album, @album_artist, @genre, @year, @track_number, @disc_number,
        @duration, @bitrate, @sample_rate, @codec, @artwork_path, @sync_status, @cloud_path)
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

  close(): void {
    this.db.close()
  }
}
