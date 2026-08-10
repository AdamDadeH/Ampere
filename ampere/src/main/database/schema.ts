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

-- Derived audio-feature table from the standalone vq pipeline (CLAP embeddings
-- + RQ-VAE Semantic IDs). Purely audio-derived and fully recomputable by
-- re-running vq's export + the importer — never load-bearing, never user data.
-- clap = raw little-endian float32 bytes (embedding_dim recorded in semantic_meta).
CREATE TABLE IF NOT EXISTS track_semantic (
  track_id    TEXT PRIMARY KEY,
  clap        BLOB NOT NULL,
  sid_0       INTEGER NOT NULL,
  sid_1       INTEGER NOT NULL,
  sid_2       INTEGER NOT NULL,
  umap_x      REAL,
  umap_y      REAL,
  umap_z      REAL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_track_semantic_sid ON track_semantic(sid_0, sid_1, sid_2);

-- Human-readable labels for each (level, code), imported from vq's code_names.
CREATE TABLE IF NOT EXISTS semantic_code_names (
  level INTEGER NOT NULL,
  code  INTEGER NOT NULL,
  name  TEXT NOT NULL,
  alts  TEXT NOT NULL,
  PRIMARY KEY (level, code)
);

-- Provenance/config for the semantic index (embedding_dim, num_levels, etc.).
CREATE TABLE IF NOT EXISTS semantic_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS storage_sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  root_path TEXT NOT NULL,
  label TEXT,
  proton_email TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS track_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_value REAL,
  attention_weight REAL NOT NULL DEFAULT 1.0,
  source TEXT,
  -- UI surface the play decision was made from (main list, riemann, compact...).
  -- Not derivable after the fact: nav modes like drift used to imply the 3D
  -- view, but once a mode runs on more than one surface that inference breaks.
  -- Needed to compare navigation modes without confounding them with context.
  surface TEXT,
  -- Feature values the policy actually used when it chose this track, as JSON.
  -- Recorded rather than reconstructed: once a feature drives selection, any
  -- later reconstruction has to reproduce exactly what the scorer saw, and it
  -- silently stops matching the moment a definition changes. Free-form because
  -- the feature set is expected to keep moving.
  context_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedback_track ON track_feedback(track_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON track_feedback(created_at);

-- Which index artifacts were active when, so per-mode performance can be
-- scoped to a comparable period.
--
-- Drift and session are functions of the CLAP model; journey additionally
-- depends on the RQ-VAE codebook. Change either and the same mode becomes a
-- different mode, so pooling its statistics across the change is invalid.
--
-- A log rather than a column on track_feedback: these change rarely, so an
-- event's version is whichever row was active at its created_at. That also
-- means history recorded before this table existed is still attributable.
--
-- The UMAP projection is deliberately absent. It is unseeded and refits
-- whenever the library grows, but no navigation mode depends on it any more —
-- it positions the 3D view and nothing else.
CREATE TABLE IF NOT EXISTS index_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  embedding_version TEXT NOT NULL,
  codebook_version TEXT NOT NULL,
  n_tracks INTEGER,
  activated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_index_versions_activated ON index_versions(activated_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

// Bump this when derived tables (track_artists, track_album_artists) need rebuilding.
// Compared against SQLite user_version pragma — if the DB is behind, junction tables
// are cleared and repopulated from source columns on next launch.
export const SCHEMA_VERSION = 5
