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
  byContentHash?(hash: string): string | undefined
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
export function resolveTrackIdentity(
  candidate: IdentityCandidate,
  lookups: IdentityLookups
): IdentityMatch {
  if (candidate.contentHash && lookups.byContentHash) {
    const hit = lookups.byContentHash(candidate.contentHash)
    if (hit) return { trackId: hit, strategy: 'content-hash' }
  }

  if (candidate.embeddedId) {
    const hit = lookups.byEmbeddedId(candidate.embeddedId)
    if (hit) return { trackId: hit, strategy: 'embedded-id' }
  }

  const byPath = lookups.byFilePath(candidate.filePath)
  if (byPath) return { trackId: byPath, strategy: 'file-path' }

  return { trackId: null, strategy: 'none' }
}
