import { createHash } from 'crypto'
import { openSync, readSync, closeSync, statSync } from 'fs'

/**
 * Identity derived from the audio itself, not from a tag.
 *
 * The embedded AMPERE_ID was the only way a track survived being renamed, and
 * it lives in a tag that any third-party tagger also owns. When MusicBrainz
 * Picard reorganised the library, 3,325 files moved and ~1,900 of them arrived
 * with no usable id — the tag had been rewritten, and for m4a it had never been
 * written at all. Every one of those rows became a track that silently would
 * not play.
 *
 * Audio bytes do not change when tags do. Hashing only the payload gives an
 * identity that survives tag rewrites, renames, directory moves, and taggers
 * that strip frames they do not recognise — and it gives formats we never
 * managed to tag an identity for the first time.
 *
 * What it deliberately does not survive: transcoding, re-encoding, or trimming.
 * Those genuinely produce different audio, and treating them as the same track
 * would be worse than treating them as new.
 */

/** Bytes sampled from each of three positions in the payload. */
const SAMPLE_BYTES = 256 * 1024

export interface ContentId {
  /** Hex digest over sampled payload bytes plus the payload length. */
  hash: string
  /** Length of the audio payload in bytes, excluding tags. */
  payloadBytes: number
}

/** Byte range of the audio payload, tags excluded. Null when it can't be located. */
export function payloadRange(fd: number, size: number): { start: number; end: number } | null {
  const head = Buffer.alloc(16)
  if (size < 16) return null
  readSync(fd, head, 0, 16, 0)

  // FLAC: 'fLaC' then metadata blocks, each with a 4-byte header whose top bit
  // marks the last block. Audio frames follow.
  if (head.subarray(0, 4).toString('latin1') === 'fLaC') {
    let pos = 4
    for (;;) {
      const bh = Buffer.alloc(4)
      if (pos + 4 > size) return null
      readSync(fd, bh, 0, 4, pos)
      const last = (bh[0] & 0x80) !== 0
      const len = (bh[1] << 16) | (bh[2] << 8) | bh[3]
      pos += 4 + len
      if (last) break
      if (pos >= size) return null
    }
    return { start: pos, end: size }
  }

  // MP4/M4A: top-level atoms; the audio lives in 'mdat'. Tag atoms (moov/udta)
  // sit elsewhere and may be rewritten or moved without touching mdat.
  if (head.subarray(4, 8).toString('latin1') === 'ftyp') {
    let pos = 0
    while (pos + 8 <= size) {
      const ah = Buffer.alloc(8)
      readSync(fd, ah, 0, 8, pos)
      let boxSize = ah.readUInt32BE(0)
      const type = ah.subarray(4, 8).toString('latin1')
      let headerLen = 8
      if (boxSize === 1) {
        const ext = Buffer.alloc(8)
        readSync(fd, ext, 0, 8, pos + 8)
        boxSize = Number(ext.readBigUInt64BE(0))
        headerLen = 16
      } else if (boxSize === 0) {
        boxSize = size - pos
      }
      if (boxSize < headerLen) return null
      if (type === 'mdat') return { start: pos + headerLen, end: Math.min(pos + boxSize, size) }
      pos += boxSize
    }
    return null
  }

  // Everything else is treated as a framed stream wrapped in optional tags:
  // ID3v2 at the front, ID3v1 and/or APE at the back.
  let start = 0
  if (head.subarray(0, 3).toString('latin1') === 'ID3') {
    // ID3v2 size is a syncsafe integer in bytes 6..9.
    start = 10 + (((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f))
    if (head[5] & 0x10) start += 10 // footer present
  }
  let end = size
  if (end - start > 128) {
    const tail = Buffer.alloc(128)
    readSync(fd, tail, 0, 128, end - 128)
    if (tail.subarray(0, 3).toString('latin1') === 'TAG') end -= 128
  }
  if (end - start > 32) {
    const apeTail = Buffer.alloc(32)
    readSync(fd, apeTail, 0, 32, end - 32)
    if (apeTail.subarray(0, 8).toString('latin1') === 'APETAGEX') {
      const apeSize = apeTail.readUInt32LE(12)
      if (apeSize > 0 && apeSize < end - start) end -= apeSize + 32
    }
  }
  if (end <= start) return null
  return { start, end }
}

/**
 * Content identity for a file, or null if the payload can't be located or is
 * empty.
 *
 * Samples three windows rather than hashing everything: a full hash of ~11k
 * files means reading tens of gigabytes, and for a cloud-backed library that
 * means downloading them. Length plus three 256 KiB windows is far past the
 * point where an accidental collision is plausible in a personal library.
 */
export function computeContentId(filePath: string): ContentId | null {
  let fd: number | null = null
  try {
    const size = statSync(filePath).size
    fd = openSync(filePath, 'r')
    const range = payloadRange(fd, size)
    if (!range) return null

    const payloadBytes = range.end - range.start
    if (payloadBytes <= 0) return null

    const hash = createHash('sha256')
    // Length first: two different tracks that happen to share sampled windows
    // still differ here, and it costs nothing.
    hash.update(String(payloadBytes))

    const window = Math.min(SAMPLE_BYTES, payloadBytes)
    const offsets = [
      range.start,
      range.start + Math.floor((payloadBytes - window) / 2),
      range.end - window
    ]
    const buf = Buffer.alloc(window)
    let lastOffset = -1
    for (const off of offsets) {
      if (off === lastOffset) continue // short file: windows overlap exactly
      lastOffset = off
      const n = readSync(fd, buf, 0, window, off)
      hash.update(buf.subarray(0, n))
    }

    return { hash: hash.digest('hex'), payloadBytes }
  } catch {
    return null
  } finally {
    if (fd !== null) {
      try { closeSync(fd) } catch { /* already closed */ }
    }
  }
}
