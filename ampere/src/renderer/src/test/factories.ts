import type { Track } from '../stores/library'

/**
 * Build `n` synthetic tracks for performance/harness tests. Values are
 * deterministic (seeded by index) so tests are reproducible — no Date.now()
 * or Math.random(). Mirrors a real library row shape closely enough that the
 * real components render against it unmodified.
 */
export function makeTracks(n: number): Track[] {
  const tracks: Track[] = new Array(n)
  for (let i = 0; i < n; i++) {
    tracks[i] = {
      id: `track-${i}`,
      embedded_id: null,
      file_path: `/music/artist-${i % 200}/album-${i % 800}/track-${i}.flac`,
      file_name: `track-${i}.flac`,
      file_size: 30_000_000,
      title: `Track ${i}`,
      artist: `Artist ${i % 200}`,
      album: `Album ${i % 800}`,
      album_artist: `Artist ${i % 200}`,
      genre: 'Test',
      year: 2000 + (i % 25),
      track_number: (i % 12) + 1,
      disc_number: 1,
      duration: 180 + (i % 120),
      bitrate: 1000,
      sample_rate: 44100,
      codec: 'flac',
      artwork_path: i % 3 === 0 ? `/art/${i}.jpg` : null,
      play_count: i % 7,
      last_played: null,
      rating: i % 6,
      date_added: '2024-01-01T00:00:00.000Z',
      date_modified: '2024-01-01T00:00:00.000Z',
      sync_status: 'local',
      cloud_path: null,
      last_accessed: null,
      pinned: 0,
      source_id: null,
      inferred_rating: null,
    }
  }
  return tracks
}
