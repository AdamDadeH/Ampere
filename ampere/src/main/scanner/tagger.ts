import {
  File as TagFile,
  ReadStyle,
  TagTypes,
  Id3v2Tag,
  Id3v2UniqueFileIdentifierFrame,
  XiphComment,
  Mpeg4AppleTag,
  ByteVector,
  StringType
} from 'node-taglib-sharp'
import { v4 as uuidv4 } from 'uuid'

const OWNER = 'ampere'
const XIPH_KEY = 'AMPERE_ID'
const ITUNES_MEAN = 'com.ampere'
const ITUNES_NAME = 'id'

/**
 * Reads the embedded AMPERE_ID from a file's tags.
 * Returns the ID if found, null otherwise.
 */
export function readEmbeddedId(filePath: string): string | null {
  let file: TagFile | null = null
  try {
    file = TagFile.createFromPath(filePath, undefined, ReadStyle.None)

    // Try ID3v2 (MP3, AIFF, etc.)
    const id3v2 = file.getTag(TagTypes.Id3v2, false) as Id3v2Tag | undefined
    if (id3v2) {
      const ufidFrames = id3v2.getFramesByClassType<Id3v2UniqueFileIdentifierFrame>(
        7 // FrameClassType.UniqueFileIdentifierFrame
      )
      const frame = Id3v2UniqueFileIdentifierFrame.find(ufidFrames, OWNER)
      if (frame?.identifier) {
        return frame.identifier.toString()
      }
    }

    // Try Xiph Comment (FLAC, OGG, Opus)
    const xiph = file.getTag(TagTypes.Xiph, false) as XiphComment | undefined
    if (xiph) {
      const value = xiph.getFieldFirstValue(XIPH_KEY)
      if (value) return value
    }

    // Try Apple Tag (M4A, AAC)
    const apple = file.getTag(TagTypes.Apple, false) as Mpeg4AppleTag | undefined
    if (apple) {
      const data = apple.getFirstQuickTimeData(
        ByteVector.fromString('----', StringType.UTF8)
      )
      // Try iTunes-style custom tag
      // Apple tags use mean/name pairs, read via getItunesStrings would be ideal
      // but we'll check via the general approach
    }

    return null
  } catch (err) {
    console.error(`Failed to read embedded ID from ${filePath}:`, err)
    return null
  } finally {
    file?.dispose()
  }
}

/**
 * Writes a AMPERE_ID into the file's tags.
 * Returns the ID that was written.
 * If the file already has an ID, returns it without writing.
 */
export function ensureEmbeddedId(filePath: string): string | null {
  let file: TagFile | null = null
  try {
    file = TagFile.createFromPath(filePath, undefined, ReadStyle.None)

    // First, try to read existing ID
    const existingId = readIdFromFile(file)
    if (existingId) {
      file.dispose()
      return existingId
    }

    // Generate new ID
    const newId = uuidv4()

    // Write to the appropriate tag format
    let written = false

    // ID3v2 (MP3, AIFF, WAV)
    const id3v2 = file.getTag(TagTypes.Id3v2, true) as Id3v2Tag | undefined
    if (id3v2) {
      // Remove any existing broken UFID frames (null owner) that would crash on save
      const existingUfids = id3v2.getFramesByClassType<Id3v2UniqueFileIdentifierFrame>(
        7 // FrameClassType.UniqueFileIdentifierFrame
      )
      for (const ufid of existingUfids) {
        if (!ufid.owner) {
          id3v2.removeFrame(ufid)
        }
      }

      const frame = Id3v2UniqueFileIdentifierFrame.fromData(
        OWNER,
        ByteVector.fromString(newId, StringType.UTF8)
      )
      id3v2.addFrame(frame)
      written = true
    }

    // Xiph Comment (FLAC, OGG, Opus)
    if (!written) {
      const xiph = file.getTag(TagTypes.Xiph, true) as XiphComment | undefined
      if (xiph) {
        xiph.setFieldAsStrings(XIPH_KEY, newId)
        written = true
      }
    }

    // Apple Tag (M4A, AAC)
    if (!written) {
      const apple = file.getTag(TagTypes.Apple, true) as Mpeg4AppleTag | undefined
      if (apple) {
        apple.setItunesStrings(ITUNES_MEAN, ITUNES_NAME, newId)
        written = true
      }
    }

    if (written) {
      file.save()
      file.dispose()
      return newId
    }

    file.dispose()
    return null
  } catch (err) {
    console.error(`Failed to write embedded ID to ${filePath}:`, err)
    file?.dispose()
    return null
  }
}

/**
 * Reads the AMPERE_ID from an already-opened TagFile.
 */
function readIdFromFile(file: TagFile): string | null {
  // Try ID3v2
  const id3v2 = file.getTag(TagTypes.Id3v2, false) as Id3v2Tag | undefined
  if (id3v2) {
    const ufidFrames = id3v2.getFramesByClassType<Id3v2UniqueFileIdentifierFrame>(
      7 // FrameClassType.UniqueFileIdentifierFrame
    )
    const frame = Id3v2UniqueFileIdentifierFrame.find(ufidFrames, OWNER)
    if (frame?.identifier) {
      return frame.identifier.toString()
    }
  }

  // Try Xiph
  const xiph = file.getTag(TagTypes.Xiph, false) as XiphComment | undefined
  if (xiph) {
    const value = xiph.getFieldFirstValue(XIPH_KEY)
    if (value) return value
  }

  // Try Apple
  const apple = file.getTag(TagTypes.Apple, false) as Mpeg4AppleTag | undefined
  if (apple) {
    // Read iTunes-style custom tag
    // This is read via the same mean/name pair
    // Unfortunately the AppleTag API doesn't have a direct getItunesStrings
    // We'll rely on ID3v2 or Xiph for now, Apple support can be refined later
  }

  return null
}
