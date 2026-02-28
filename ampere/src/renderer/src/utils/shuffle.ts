/**
 * Seeded deterministic shuffle utilities.
 *
 * mulberry32 PRNG + DJB2 seed computation + Fisher-Yates permutation.
 * Pure functions, no dependencies.
 */

/** Session key — captured once at module load. Same session = same shuffle order for the same queue. */
const SESSION_KEY = Date.now()

/** Mulberry32: fast 32-bit PRNG. Returns values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** DJB2 hash over queue track IDs + session key to produce a deterministic seed. */
export function computeShuffleSeed(queueIds: string[]): number {
  let hash = 5381
  // Mix in session key
  hash = ((hash << 5) + hash + (SESSION_KEY & 0xffff)) | 0
  hash = ((hash << 5) + hash + ((SESSION_KEY >>> 16) & 0xffff)) | 0
  // Mix in each track ID
  for (const id of queueIds) {
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0
    }
  }
  return hash >>> 0
}

/** Fisher-Yates shuffle producing a full index permutation of [0..length-1]. */
export function generatePermutation(length: number, rng: () => number): number[] {
  const perm = Array.from({ length }, (_, i) => i)
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = perm[i]
    perm[i] = perm[j]
    perm[j] = tmp
  }
  return perm
}

/**
 * Generate a shuffle permutation for the given queue, placing `currentIndex`
 * at position 0 so the currently playing track stays put.
 */
export function buildShufflePermutation(queueLength: number, currentIndex: number, queueIds: string[]): number[] {
  const seed = computeShuffleSeed(queueIds)
  const rng = mulberry32(seed)
  const perm = generatePermutation(queueLength, rng)

  // Move currentIndex to position 0
  const pos = perm.indexOf(currentIndex)
  if (pos > 0) {
    perm[pos] = perm[0]
    perm[0] = currentIndex
  }

  return perm
}
