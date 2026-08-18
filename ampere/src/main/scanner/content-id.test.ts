import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { computeContentId } from './content-id'

/**
 * The invariant under test: identity depends on the audio and nothing else.
 * Not the filename, not the directory, not the tags. Everything here exists to
 * pin that down, because the alternative cost 3,325 tracks.
 */

let dir: string
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'content-id-')) })
afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

/** Deterministic stand-in for an audio payload. */
const payload = (seed: number, bytes = 400_000): Buffer => {
  const b = Buffer.alloc(bytes)
  let x = seed || 1
  for (let i = 0; i < bytes; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; b[i] = x & 0xff }
  return b
}

/** ID3v2 header declaring `size` bytes of tag body, syncsafe-encoded. */
const id3v2 = (size: number): Buffer => {
  const h = Buffer.alloc(10 + size)
  h.write('ID3', 0, 'latin1')
  h[3] = 3; h[4] = 0; h[5] = 0
  h[6] = (size >> 21) & 0x7f; h[7] = (size >> 14) & 0x7f
  h[8] = (size >> 7) & 0x7f;  h[9] = size & 0x7f
  h.fill(0x41, 10) // tag body; contents are irrelevant to identity
  return h
}

const id3v1 = (): Buffer => {
  const t = Buffer.alloc(128)
  t.write('TAG', 0, 'latin1')
  return t
}

const write = (name: string, ...parts: Buffer[]): string => {
  const p = join(dir, name)
  writeFileSync(p, Buffer.concat(parts))
  return p
}

describe('content identity ignores everything but the audio', () => {
  it('is unchanged when the file is renamed and moved', () => {
    const audio = payload(1)
    const a = write('01 - original name.mp3', id3v2(2048), audio)
    const b = write('totally different.mp3', id3v2(2048), audio)
    expect(computeContentId(a)!.hash).toBe(computeContentId(b)!.hash)
  })

  it('is unchanged when the tag is rewritten to a different size', () => {
    // Exactly what a tagger does: same audio, new tag block, new file size.
    const audio = payload(2)
    const before = write('before.mp3', id3v2(1024), audio)
    const after = write('after.mp3', id3v2(9000), audio)
    expect(computeContentId(before)!.hash).toBe(computeContentId(after)!.hash)
  })

  it('is unchanged when tags are added or removed entirely', () => {
    const audio = payload(3)
    const bare = write('bare.mp3', audio)
    const tagged = write('tagged.mp3', id3v2(4096), audio, id3v1())
    expect(computeContentId(bare)!.hash).toBe(computeContentId(tagged)!.hash)
  })

  it('is unchanged when a trailing ID3v1 tag appears', () => {
    const audio = payload(4)
    const without = write('no-v1.mp3', id3v2(512), audio)
    const with1 = write('with-v1.mp3', id3v2(512), audio, id3v1())
    expect(computeContentId(without)!.hash).toBe(computeContentId(with1)!.hash)
  })

  it('reports the payload length excluding tags', () => {
    const audio = payload(5, 123_456)
    const p = write('len.mp3', id3v2(3000), audio, id3v1())
    expect(computeContentId(p)!.payloadBytes).toBe(123_456)
  })

  it('differs for different audio, even with identical tags', () => {
    const a = write('a.mp3', id3v2(2048), payload(6))
    const b = write('b.mp3', id3v2(2048), payload(7))
    expect(computeContentId(a)!.hash).not.toBe(computeContentId(b)!.hash)
  })

  it('differs when the audio is truncated', () => {
    const audio = payload(8)
    const full = write('full.mp3', id3v2(1024), audio)
    const cut = write('cut.mp3', id3v2(1024), audio.subarray(0, audio.length - 50_000))
    expect(computeContentId(full)!.hash).not.toBe(computeContentId(cut)!.hash)
  })
})

describe('container handling', () => {
  it('locates the payload in a FLAC stream after its metadata blocks', () => {
    const audio = payload(9)
    const block = (last: boolean, len: number): Buffer => {
      const h = Buffer.alloc(4 + len)
      h[0] = (last ? 0x80 : 0) | 0
      h[1] = (len >> 16) & 0xff; h[2] = (len >> 8) & 0xff; h[3] = len & 0xff
      return h
    }
    const small = write('a.flac', Buffer.from('fLaC'), block(false, 34), block(true, 100), audio)
    const large = write('b.flac', Buffer.from('fLaC'), block(false, 34), block(true, 8000), audio)
    expect(computeContentId(small)!.hash).toBe(computeContentId(large)!.hash)
  })

  it('locates mdat in an MP4 regardless of where the tag atoms sit', () => {
    const audio = payload(10)
    const atom = (type: string, body: Buffer): Buffer => {
      const h = Buffer.alloc(8)
      h.writeUInt32BE(body.length + 8, 0)
      h.write(type, 4, 'latin1')
      return Buffer.concat([h, body])
    }
    const ftyp = atom('ftyp', Buffer.alloc(16))
    const mdat = atom('mdat', audio)
    const smallTags = write('a.m4a', ftyp, atom('moov', Buffer.alloc(500)), mdat)
    const bigTags = write('b.m4a', ftyp, atom('moov', Buffer.alloc(50_000)), mdat)
    expect(computeContentId(smallTags)!.hash).toBe(computeContentId(bigTags)!.hash)
  })

  it('returns null rather than a wrong answer when the payload is unusable', () => {
    expect(computeContentId(write('empty.mp3', Buffer.alloc(0)))).toBeNull()
    // ID3 header declaring a tag longer than the file leaves no payload.
    expect(computeContentId(write('hollow.mp3', id3v2(64)))).toBeNull()
    expect(computeContentId(join(dir, 'does-not-exist.mp3'))).toBeNull()
  })

  it('handles a payload shorter than one sample window', () => {
    const tiny = payload(11, 1000)
    const a = write('tiny-a.mp3', id3v2(100), tiny)
    const b = write('tiny-b.mp3', id3v2(9000), tiny)
    const idA = computeContentId(a)!
    expect(idA.payloadBytes).toBe(1000)
    expect(idA.hash).toBe(computeContentId(b)!.hash)
  })
})
