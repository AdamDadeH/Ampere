import { parseFile } from 'music-metadata'
import { createHash } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join, basename } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { TrackUpsertData } from '../database'
import { ensureEmbeddedId } from './tagger'
import { computeContentId } from './content-id'
import { parseArtists } from './artist-parser'
import type { MetadataExtractor, SourceContext } from './index'
import { isFileMaterialized, isProtonDrivePath } from '../storage/proton-drive'

export class MusicMetadataExtractor implements MetadataExtractor {
  private artworkDir: string

  constructor() {
    this.artworkDir = join(app.getPath('userData'), 'artwork')
  }

  async init(): Promise<void> {
    await mkdir(this.artworkDir, { recursive: true })
  }

  async extract(filePath: string, fileName: string, fileSize: number, source?: SourceContext): Promise<{
    track: TrackUpsertData
    entities: { type: string; names: string[] }[]
  }> {
    // duration:true makes music-metadata scan frames when the header carries no
    // duration, which headerless VBR MP3s do not. Costs nothing on files that
    // do — it only falls back to scanning when there is no other way to know.
    const metadata = await parseFile(filePath, { duration: true })
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
      sync_status: this.resolveSyncStatus(filePath, source, format),
      cloud_path: this.resolveCloudPath(filePath, source),
      source_id: source?.sourceId ?? null,
      // Identity from the audio itself, so this file stays recognisable
      // however it is later renamed, moved or retagged.
      content_hash: null as string | null,
      content_bytes: null as number | null
    }

    const contentId = computeContentId(filePath)
    if (contentId) {
      track.content_hash = contentId.hash
      track.content_bytes = contentId.payloadBytes
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

  private resolveSyncStatus(
    filePath: string,
    source?: SourceContext,
    format?: { container?: string; duration?: number }
  ): string {
    const isCloud = source?.sourceType === 'proton-drive' || isProtonDrivePath(filePath)
    if (!isCloud) return 'local'

    // isFileMaterialized checks allocation, not content: a file a failed sync
    // gave disk blocks but never filled looks identical to a real one — not
    // SF_DATALESS, not sparse, full size, and entirely zeros inside. Parsing
    // knows better, and no recognisable container means no audio was found.
    //
    // Not 'cloud-only': reading such a file through to the end returns zeros
    // and does not trigger materialisation, so the bytes are not merely
    // absent, they are not coming. Marking it fetchable would retry a download
    // forever and stall the player every time. 'unplayable' says what is true
    // and lets playback and navigation skip it.
    const parsedNoAudio = format != null && !format.container && !(format.duration && format.duration > 0)
    if (parsedNoAudio) return 'unplayable'

    return isFileMaterialized(filePath) ? 'cached' : 'cloud-only'
  }

  private resolveCloudPath(filePath: string, source?: SourceContext): string | null {
    if (source?.sourceType === 'proton-drive' || isProtonDrivePath(filePath)) {
      return filePath
    }
    return null
  }
}
