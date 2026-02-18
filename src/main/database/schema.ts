export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  embedded_id TEXT UNIQUE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  artist TEXT,
  album TEXT,
  album_artist TEXT,
  genre TEXT,
  year INTEGER,
  track_number INTEGER,
  disc_number INTEGER,
  duration REAL NOT NULL DEFAULT 0,
  bitrate INTEGER,
  sample_rate INTEGER,
  codec TEXT,
  artwork_path TEXT,
  play_count INTEGER NOT NULL DEFAULT 0,
  last_played TEXT,
  rating INTEGER DEFAULT 0,
  date_added TEXT NOT NULL DEFAULT (datetime('now')),
  date_modified TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'local',
  cloud_path TEXT
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_sync_status ON tracks(sync_status);
CREATE INDEX IF NOT EXISTS idx_tracks_album_artist ON tracks(album_artist);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_embedded_id ON tracks(embedded_id);
CREATE INDEX IF NOT EXISTS idx_tracks_file_path ON tracks(file_path);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);

CREATE TABLE IF NOT EXISTS track_artists (
  track_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  PRIMARY KEY (track_id, artist_name),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist_name ON track_artists(artist_name);

CREATE TABLE IF NOT EXISTS track_album_artists (
  track_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  PRIMARY KEY (track_id, artist_name),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_track_album_artists_artist_name ON track_album_artists(artist_name);

CREATE TABLE IF NOT EXISTS track_features (
  track_id TEXT PRIMARY KEY,
  features_json TEXT NOT NULL,
  umap_x REAL,
  umap_y REAL,
  umap_z REAL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
`

// Bump this when derived tables (track_artists, track_album_artists) need rebuilding.
// Compared against SQLite user_version pragma — if the DB is behind, junction tables
// are cleared and repopulated from source columns on next launch.
export const SCHEMA_VERSION = 5
