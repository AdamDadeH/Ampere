import { describe, it, expect } from 'vitest'
import { musicAdapter, MUSIC_FEATURE_GROUPS } from '../../../shared/adapters/music'
import type { MediaTypeConfig, FeatureGroup } from '../../../shared/media-adapter'

/**
 * Generic validator for any adapter's feature extractor config.
 * Any future adapter (comics, papers) must also pass these checks.
 */
function validateFeatureGroups(config: MediaTypeConfig): void {
  const extractor = config.featureExtractor
  if (!extractor) return

  const { dimensions, featureGroups } = extractor

  it('has feature groups that cover all dimensions without gaps or overlaps', () => {
    // Sort by start position
    const sorted = [...featureGroups].sort((a, b) => a.start - b.start)

    // Check first group starts at 0
    expect(sorted[0].start).toBe(0)

    // Check last group ends at dimensions
    expect(sorted[sorted.length - 1].end).toBe(dimensions)

    // Check contiguous: each group.end === next.start
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].end).toBe(sorted[i + 1].start)
    }
  })

  it('has start < end for every group', () => {
    for (const group of featureGroups) {
      expect(group.start).toBeLessThan(group.end)
    }
  })

  it('has dimensions matching total span of groups', () => {
    const totalSpan = featureGroups.reduce((sum, g) => sum + (g.end - g.start), 0)
    expect(totalSpan).toBe(dimensions)
  })

  it('has non-empty pos and neg labels for every group', () => {
    for (const group of featureGroups) {
      expect(group.pos.length).toBeGreaterThan(0)
      expect(group.neg.length).toBeGreaterThan(0)
    }
  })

  it('has unique group names', () => {
    const names = featureGroups.map(g => g.name)
    expect(new Set(names).size).toBe(names.length)
  })
}

describe('Music adapter feature groups', () => {
  validateFeatureGroups(musicAdapter)

  it('has exactly 5 groups for 56 dimensions', () => {
    expect(MUSIC_FEATURE_GROUPS).toHaveLength(5)
    expect(musicAdapter.featureExtractor?.dimensions).toBe(56)
  })
})

describe('Music adapter config', () => {
  it('has required fields', () => {
    expect(musicAdapter.id).toBe('music')
    expect(musicAdapter.label).toBe('Music')
    expect(musicAdapter.extensions.size).toBeGreaterThan(0)
    expect(musicAdapter.columns.length).toBeGreaterThan(0)
    expect(musicAdapter.entities.length).toBeGreaterThan(0)
  })

  it('has unique column keys', () => {
    const keys = musicAdapter.columns.map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has unique entity keys', () => {
    const keys = musicAdapter.entities.map(e => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('extensions include common audio formats', () => {
    expect(musicAdapter.extensions.has('.mp3')).toBe(true)
    expect(musicAdapter.extensions.has('.flac')).toBe(true)
    expect(musicAdapter.extensions.has('.m4a')).toBe(true)
  })
})
