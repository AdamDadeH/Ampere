/**
 * Deciding whether an incoming file is a track we already know.
 *
 * Extracted from upsertTrack so the rules can be tested. The database layer
 * supplies the lookups; the ordering of strategies is the whole substance.
 */

export interface IdentityCandidate {
  embeddedId?: string | null
  filePath: string
  contentHash?: string | null
}

export interface IdentityLookups {
  byEmbeddedId(id: string): string | undefined
  byFilePath(path: string): string | undefined
  /** Must return undefined when the hash identifies more than one row. */
  byContentHash?(hash: string): string | undefined
  /** Path currently recorded for a track, used to tell a move from a copy. */
  currentPathOf?(trackId: string): string | undefined
  /** Whether a path still resolves to a file on disk. */
  fileExists?(path: string): boolean
}

export type MatchStrategy = 'content-hash' | 'embedded-id' | 'file-path' | 'none'

export interface IdentityMatch {
  trackId: string | null
  strategy: MatchStrategy
}

/**
 * Strategies run most-durable first.
 *
 * Content hash leads because it depends on the audio alone — it survives
 * retagging, renaming and directory reorganisation together, which is the
 * combination that previously orphaned thousands of rows. The embedded id
 * still helps when the audio was re-encoded but our tag survived, and path is
 * the last resort for files that have neither.
 */
/**
 * Whether this file is a second copy of a track that is still where it was.
 *
 * A move means the original is gone. If the matched row still points at a file
 * that exists, this is a duplicate rather than the same file relocated — and
 * adopting it would repoint that row at the copy, leaving its ratings and
 * listening history describing audio the listener never chose.
 *
 * Treating a copy as new costs a duplicate row, which can be merged later.
 * Getting it backwards corrupts history that cannot be reconstructed, so the
 * tie breaks toward not matching.
 */
function isDuplicateOfLivingTrack(
  trackId: string,
  incomingPath: string,
  lookups: IdentityLookups
): boolean {
  if (!lookups.currentPathOf || !lookups.fileExists) return false
  const recorded = lookups.currentPathOf(trackId)
  if (!recorded || recorded === incomingPath) return false
  return lookups.fileExists(recorded)
}

export function resolveTrackIdentity(
  candidate: IdentityCandidate,
  lookups: IdentityLookups
): IdentityMatch {
  if (candidate.contentHash && lookups.byContentHash) {
    const hit = lookups.byContentHash(candidate.contentHash)
    if (hit && !isDuplicateOfLivingTrack(hit, candidate.filePath, lookups)) {
      return { trackId: hit, strategy: 'content-hash' }
    }
  }

  if (candidate.embeddedId) {
    const hit = lookups.byEmbeddedId(candidate.embeddedId)
    if (hit) return { trackId: hit, strategy: 'embedded-id' }
  }

  const byPath = lookups.byFilePath(candidate.filePath)
  if (byPath) return { trackId: byPath, strategy: 'file-path' }

  return { trackId: null, strategy: 'none' }
}
