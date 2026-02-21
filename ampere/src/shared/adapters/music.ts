import type { MediaTypeConfig, FeatureGroup } from '../media-adapter'

/** Audio file extensions supported by the music adapter */
export const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac', '.wma', '.opus', '.aiff', '.alac'
])

/** Feature groups within the 56-dim audio feature vector */
export const MUSIC_FEATURE_GROUPS: FeatureGroup[] = [
  { name: 'brightness', start: 0,  end: 2,  pos: 'Brighter',  neg: 'Darker' },
  { name: 'timbre',     start: 2,  end: 28, pos: 'Crisper',   neg: 'Warmer' },
  { name: 'energy',     start: 28, end: 30, pos: 'Heavier',   neg: 'Softer' },
  { name: 'harmony',    start: 30, end: 54, pos: 'Richer',    neg: 'Sparser' },
  { name: 'texture',    start: 54, end: 56, pos: 'Rougher',   neg: 'Smoother' },
]

function formatDuration(value: unknown): string {
  const seconds = typeof value === 'number' ? value : 0
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const musicAdapter: MediaTypeConfig = {
  id: 'music',
  label: 'Music',
  extensions: AUDIO_EXTENSIONS,
  columns: [
    { key: 'track_number', label: '#', width: 'w-10' },
    { key: 'title', label: 'Title' },
    { key: 'artist', label: 'Artist' },
    { key: 'album', label: 'Album' },
    { key: 'duration', label: 'Time', align: 'right', format: formatDuration },
    { key: 'rating', label: 'Rating', align: 'center' },
    { key: 'play_count', label: 'Plays', align: 'right' },
  ],
  entities: [
    { key: 'album_artist', label: 'Album Artists', query: 'builtin-junction', field: 'album_artist' },
    { key: 'artist', label: 'Track Artists', query: 'builtin-junction', field: 'artist' },
  ],
  featureExtractor: {
    label: 'Audio Features',
    dimensions: 56,
    featureGroups: MUSIC_FEATURE_GROUPS,
  }
}
