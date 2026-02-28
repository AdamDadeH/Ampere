/**
 * Splits compound artist strings into individual artist names.
 *
 * Uses the multi-value `artists` array from music-metadata when available (>1 entry).
 * Otherwise splits on common featuring delimiters: feat. / ft. / featuring / slash.
 *
 * Does NOT split on "with", "&", or "and" — too many false positives
 * ("Sleeping With Sirens", "Simon & Garfunkel", "Florence and the Machine").
 */

const SPLIT_PATTERN = /\s+feat\.?\s+|\s+ft\.?\s+|\s+featuring\s+|\s*\/\s*/i

const META_ARTISTS = new Set([
  'various artists',
  'unknown artist',
  'unknown',
  'various'
])

export function parseArtists(artist: string | null, artists?: string[]): string[] {
  // If music-metadata gave us a multi-value array, use it directly
  if (artists && artists.length > 1) {
    return dedup(artists.map((a) => a.trim()).filter(Boolean))
  }

  if (!artist) return []

  const parts = artist.split(SPLIT_PATTERN)
  return dedup(parts.map((p) => p.trim()).filter(Boolean))
}

export function isBrowsableArtist(name: string): boolean {
  return !META_ARTISTS.has(name.toLowerCase().trim())
}

function dedup(names: string[]): string[] {
  const seen = new Map<string, string>()
  for (const name of names) {
    const key = name.toLowerCase()
    if (!seen.has(key)) {
      seen.set(key, name)
    }
  }
  return Array.from(seen.values())
}
