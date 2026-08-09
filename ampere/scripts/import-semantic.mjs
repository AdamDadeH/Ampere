#!/usr/bin/env node
/**
 * Headless import of the vq Semantic Index into Ampere's library.db.
 *
 *   npm run import-semantic              # default vq/cache/ampere_index.sqlite
 *   npm run import-semantic -- /path/to/ampere_index.sqlite
 *
 * Mirrors src/main/database/clap-import.ts but drives the system `sqlite3`
 * binary instead of better-sqlite3 — the native module is built against Electron
 * headers and won't load under plain node. Pure SQL, derived tables only; never
 * touches a source column on `tracks`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const libraryDb = join(homedir(), 'Library', 'Application Support', 'ampere', 'library.db')
const vqDb = resolve(process.argv[2] ?? join(here, '..', '..', 'vq', 'cache', 'ampere_index.sqlite'))

if (!existsSync(libraryDb)) {
  console.error(`library.db not found at ${libraryDb} — launch Ampere once to create it.`)
  process.exit(1)
}
if (!existsSync(vqDb)) {
  console.error(`vq index not found at ${vqDb} — run vq/scripts/export_ampere.py first.`)
  process.exit(1)
}

// IF NOT EXISTS so this works even if the app hasn't recreated the schema yet.
const sql = `
ATTACH DATABASE '${vqDb.replace(/'/g, "''")}' AS vq;
CREATE TABLE IF NOT EXISTS track_semantic (
  track_id TEXT PRIMARY KEY, clap BLOB NOT NULL,
  sid_0 INTEGER NOT NULL, sid_1 INTEGER NOT NULL, sid_2 INTEGER NOT NULL,
  umap_x REAL, umap_y REAL, umap_z REAL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS semantic_code_names (
  level INTEGER NOT NULL, code INTEGER NOT NULL, name TEXT NOT NULL, alts TEXT NOT NULL,
  PRIMARY KEY (level, code)
);
CREATE TABLE IF NOT EXISTS semantic_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
BEGIN;
DELETE FROM track_semantic;
INSERT OR REPLACE INTO track_semantic (track_id, clap, sid_0, sid_1, sid_2, computed_at)
  SELECT t.id, v.embedding, v.sid_0, v.sid_1, v.sid_2, datetime('now')
  FROM vq.clap_index v JOIN tracks t ON t.file_path = v.path;
DELETE FROM semantic_code_names;
INSERT OR REPLACE INTO semantic_code_names (level, code, name, alts)
  SELECT level, code, name, alts FROM vq.code_names;
DELETE FROM semantic_meta;
INSERT OR REPLACE INTO semantic_meta (key, value) SELECT key, value FROM vq.meta;
COMMIT;
SELECT 'vq_tracks=' || (SELECT COUNT(*) FROM vq.clap_index);
SELECT 'matched=' || (SELECT COUNT(*) FROM track_semantic);
SELECT 'code_names=' || (SELECT COUNT(*) FROM semantic_code_names);
`

console.log(`importing ${vqDb}\n      into ${libraryDb}`)
const res = spawnSync('sqlite3', [libraryDb], { input: sql, encoding: 'utf8' })
if (res.status !== 0) {
  console.error(res.stderr || 'sqlite3 failed')
  process.exit(res.status ?? 1)
}
console.log(res.stdout.trim())
console.log('done.')
