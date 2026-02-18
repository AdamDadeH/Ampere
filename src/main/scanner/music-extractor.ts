import { parseFile } from 'music-metadata'
import { createHash } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join, basename } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { TrackUpsertData } from '../database'
import { ensureEmbeddedId } from './tagger'
import { parseArtists } from './artist-parser'
import type { MetadataExtractor } from './index'

export class MusicMetadataExtractor implements MetadataExtractor {
  private artworkDir: string

  constructor() {
    this.artworkDir = join(app.getPath('userData'), 'artwork')
  }

  async init(): Promise<void> {
    await mkdir(this.artworkDir, { recursive: true })
  }

  async extract(filePath: string, fileName: string, fileSize: number): Promise<{
    track: TrackUpsertData
    entities: { type: string; names: string[] }[]
  }> {
    const metadata = await parseFile(filePath)
    const { common, format } = metadata

    let artworkPath: string | null = null
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0]
      const hash = createHash('md5').update(pic.data).digest('hex')
      const ext = pic.format?.includes('png') ? '.png' : '.jpg'
      artworkPath = join(this.artworkDir, `${hash}${ext}`)
      try {
        await writeFile(artworkPath, pic.data)
      } catch {
        artworkPath = null
      }
    }

    const titleFromName = basename(fileName, fileName.substring(fileName.lastIndexOf('.')))

    // Parse track artists and album artists separately — they are distinct fields
    const artistString = common.artist || null
    const artistsArray = common.artists
    const parsedTrackArtists = parseArtists(artistString, artistsArray)

    const albumArtistString = common.albumartist || null
    const parsedAlbumArtists = parseArtists(albumArtistString)

    const track: TrackUpsertData = {
      id: uuidv4(),
      embedded_id: null,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      title: common.title || titleFromName,
      artist: artistString,
      album: common.album || null,
      album_artist: common.albumartist || null,
      genre: common.genre?.[0] || null,
      year: common.year || null,
      track_number: common.track?.no || null,
      disc_number: common.disk?.no || null,
      duration: format.duration || 0,
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
      sample_rate: format.sampleRate || null,
      codec: format.codec || null,
      artwork_path: artworkPath,
      sync_status: 'local',
      cloud_path: null
    }

    // Try to read or write the embedded AMPERE_ID
    const embeddedId = ensureEmbeddedId(filePath)
    if (embeddedId) {
      track.embedded_id = embeddedId
    }

    return {
      track,
      entities: [
        { type: 'artist', names: parsedTrackArtists },
        { type: 'album_artist', names: parsedAlbumArtists },
      ]
    }
  }
}
