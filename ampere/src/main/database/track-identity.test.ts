import { describe, it, expect } from 'vitest'
import { resolveTrackIdentity, IdentityLookups } from './track-identity'

/** A library holding one known track, indexed the way the database indexes it. */
const library = (t: { id: string; embeddedId?: string | null; path: string; contentHash?: string | null }): IdentityLookups => ({
  byEmbeddedId: (id) => (t.embeddedId && id === t.embeddedId ? t.id : undefined),
  byFilePath: (p) => (p === t.path ? t.id : undefined),
  byContentHash: (h) => (t.contentHash && h === t.contentHash ? t.id : undefined)
})

const known = {
  id: 'track-1',
  embeddedId: 'ampere-uuid-1',
  path: '/music/Artist/Album/01 Song.mp3',
  contentHash: 'sha-of-audio'
}

describe('resolveTrackIdentity', () => {
  it('recognises an unchanged file by path', () => {
    const m = resolveTrackIdentity({ filePath: known.path, embeddedId: known.embeddedId, contentHash: known.contentHash }, library(known))
    expect(m.trackId).toBe('track-1')
  })

  it('recognises a renamed file, preferring the audio over the tag', () => {
    const m = resolveTrackIdentity(
      { filePath: '/music/Artist/Album/01 - Song (Remastered).mp3', embeddedId: known.embeddedId, contentHash: known.contentHash },
      library(known)
    )
    expect(m).toEqual({ trackId: 'track-1', strategy: 'content-hash' })
  })

  it('still falls back to the embedded id when the audio no longer matches', () => {
    // Re-encoded at a different bitrate: new audio bytes, our tag carried over.
    const m = resolveTrackIdentity(
      { filePath: '/music/Artist/Album/01 Song.flac', embeddedId: known.embeddedId, contentHash: 'different-after-transcode' },
      library(known)
    )
    expect(m).toEqual({ trackId: 'track-1', strategy: 'embedded-id' })
  })

  it('recognises a file whose whole directory was reorganised', () => {
    const m = resolveTrackIdentity(
      { filePath: '/music/Correct Artist/Correct Album/01 Song.mp3', embeddedId: known.embeddedId, contentHash: known.contentHash },
      library(known)
    )
    expect(m.trackId).toBe('track-1')
  })

  // The regression. A third-party tagger rewrote the tags — stripping our
  // embedded id — and moved the file. Nothing about the audio changed.
  it('recognises a file that was retagged AND renamed', () => {
    const m = resolveTrackIdentity(
      { filePath: '/music/Correct Artist/Correct Album/01 Song.mp3', embeddedId: null, contentHash: known.contentHash },
      library(known)
    )
    expect(m.trackId).toBe('track-1')
  })

  it('recognises a format we never managed to tag, once moved', () => {
    // m4a never had an embedded id written at all.
    const m4a = { id: 'track-2', embeddedId: null, path: '/music/old/song.m4a', contentHash: 'sha-of-m4a' }
    const m = resolveTrackIdentity(
      { filePath: '/music/new/Correct Name.m4a', embeddedId: null, contentHash: 'sha-of-m4a' },
      library(m4a)
    )
    expect(m.trackId).toBe('track-2')
  })

  it('refuses to match on an ambiguous hash', () => {
    // The same audio exists on more than one row — a library with duplicates.
    // Picking one arbitrarily would rewrite the wrong track's path and
    // misattribute its ratings, so an ambiguous hash must not match at all.
    const ambiguous: IdentityLookups = {
      byEmbeddedId: () => undefined,
      byFilePath: () => undefined,
      byContentHash: () => undefined // the db reports ambiguity as no match
    }
    const m = resolveTrackIdentity(
      { filePath: '/music/new/path.mp3', embeddedId: null, contentHash: 'shared-by-two-rows' },
      ambiguous
    )
    expect(m).toEqual({ trackId: null, strategy: 'none' })
  })

  it('prefers a unique embedded id over an ambiguous hash', () => {
    const lookups: IdentityLookups = {
      byEmbeddedId: (id) => (id === 'ampere-uuid-1' ? 'track-1' : undefined),
      byFilePath: () => undefined,
      byContentHash: () => undefined // ambiguous, so the db declines to answer
    }
    const m = resolveTrackIdentity(
      { filePath: '/music/new/path.mp3', embeddedId: 'ampere-uuid-1', contentHash: 'shared-by-two-rows' },
      lookups
    )
    expect(m).toEqual({ trackId: 'track-1', strategy: 'embedded-id' })
  })

  it('treats genuinely new audio as new', () => {
    const m = resolveTrackIdentity(
      { filePath: '/music/Other/New.mp3', embeddedId: 'different-uuid', contentHash: 'different-audio' },
      library(known)
    )
    expect(m).toEqual({ trackId: null, strategy: 'none' })
  })
})
