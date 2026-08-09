import Database from 'better-sqlite3'
import { existsSync } from 'fs'

/**
 * Imports the standalone vq Semantic Index (produced by
 * `vq/scripts/export_ampere.py` → `ampere_index.sqlite`) into the derived
 * `track_semantic` / `semantic_code_names` / `semantic_meta` tables.
 *
 * The vq index keys tracks by absolute file path; we join that to Ampere's
 * `tracks.file_path` to resolve the real `tracks.id` FK. This only ever writes
 * to derived tables — no source column on `tracks` is touched. Rollback is
 * `DELETE FROM track_semantic` (or dropping the table); the data is fully
 * recomputable by re-running vq + this import.
 */
export interface SemanticImportReport {
  vqTracks: number
  matched: number
  unmatchedInVq: number
  codeNames: number
  embeddingDim: number | null
  numLevels: number | null
  codebookSize: number | null
}

export function importSemanticIndex(db: Database.Database, vqDbPath: string): SemanticImportReport {
  if (!existsSync(vqDbPath)) {
    throw new Error(`vq index not found at ${vqDbPath} — run vq/scripts/export_ampere.py first.`)
  }

  db.prepare('ATTACH DATABASE ? AS vq').run(vqDbPath)
  try {
    // Sanity-check the attached index has the expected shape before writing.
    const vqTables = db
      .prepare("SELECT name FROM vq.sqlite_master WHERE type='table'")
      .all()
      .map((r) => (r as { name: string }).name)
    if (!vqTables.includes('clap_index')) {
      throw new Error(`attached vq index has no clap_index table (found: ${vqTables.join(', ')})`)
    }

    const vqTracks = (
      db.prepare('SELECT COUNT(*) AS n FROM vq.clap_index').get() as { n: number }
    ).n

    const report = db.transaction((): SemanticImportReport => {
      // Full rebuild — derived table, cheap to repopulate.
      db.exec('DELETE FROM track_semantic')
      const inserted = db.prepare(`
        INSERT OR REPLACE INTO track_semantic (track_id, clap, sid_0, sid_1, sid_2, computed_at)
        SELECT t.id, v.embedding, v.sid_0, v.sid_1, v.sid_2, datetime('now')
        FROM vq.clap_index v
        JOIN tracks t ON t.file_path = v.path
      `).run()
      const matched = inserted.changes

      db.exec('DELETE FROM semantic_code_names')
      if (vqTables.includes('code_names')) {
        db.exec(`
          INSERT OR REPLACE INTO semantic_code_names (level, code, name, alts)
          SELECT level, code, name, alts FROM vq.code_names
        `)
      }
      const codeNames = (
        db.prepare('SELECT COUNT(*) AS n FROM semantic_code_names').get() as { n: number }
      ).n

      db.exec('DELETE FROM semantic_meta')
      if (vqTables.includes('meta')) {
        db.exec('INSERT OR REPLACE INTO semantic_meta (key, value) SELECT key, value FROM vq.meta')
      }
      const meta = (key: string): string | null =>
        (db.prepare('SELECT value FROM semantic_meta WHERE key = ?').get(key) as
          | { value: string }
          | undefined)?.value ?? null
      const num = (key: string): number | null => {
        const v = meta(key)
        return v == null ? null : Number(v)
      }

      return {
        vqTracks,
        matched,
        unmatchedInVq: vqTracks - matched,
        codeNames,
        embeddingDim: num('embedding_dim'),
        numLevels: num('num_levels'),
        codebookSize: num('codebook_size')
      }
    })()

    return report
  } finally {
    db.prepare('DETACH DATABASE vq').run()
  }
}
