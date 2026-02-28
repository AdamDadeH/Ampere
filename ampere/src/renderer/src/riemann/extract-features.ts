import Meyda from 'meyda'

export interface FeatureVector {
  dimensions: number // 56
  values: number[]
}

const SAMPLE_RATE = 22050
const BUFFER_SIZE = 2048
const HOP_SIZE = 1024
const NUM_MFCC = 13
const NUM_CHROMA = 12
// Features per frame: spectralCentroid(1) + mfcc(13) + rms(1) + chroma(12) + zcr(1) = 28
// Mean + stddev = 56 dimensions

function mixdownToMono(audioBuffer: AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0)
  }
  const length = audioBuffer.length
  const mono = new Float32Array(length)
  const numChannels = audioBuffer.numberOfChannels
  for (let ch = 0; ch < numChannels; ch++) {
    const channel = audioBuffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      mono[i] += channel[i]
    }
  }
  const scale = 1 / numChannels
  for (let i = 0; i < length; i++) {
    mono[i] *= scale
  }
  return mono
}

function computeMeanStd(values: number[]): [number, number] {
  if (values.length === 0) return [0, 0]
  const n = values.length
  let sum = 0
  for (let i = 0; i < n; i++) sum += values[i]
  const mean = sum / n
  let sqSum = 0
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean
    sqSum += d * d
  }
  const std = Math.sqrt(sqSum / n)
  return [mean, std]
}

export async function extractFeatures(filePath: string): Promise<FeatureVector> {
  // Read raw audio file from main process
  const arrayBuffer = await window.api.readAudioFile(filePath)

  // Decode to audio at 22050Hz mono using OfflineAudioContext
  const offlineCtx = new OfflineAudioContext(1, 1, SAMPLE_RATE)
  const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer)

  const mono = mixdownToMono(audioBuffer)

  // Configure Meyda
  Meyda.bufferSize = BUFFER_SIZE
  Meyda.sampleRate = SAMPLE_RATE
  Meyda.numberOfMFCCCoefficients = NUM_MFCC

  // Accumulate per-frame features
  const centroidFrames: number[] = []
  const mfccFrames: number[][] = Array.from({ length: NUM_MFCC }, () => [])
  const rmsFrames: number[] = []
  const chromaFrames: number[][] = Array.from({ length: NUM_CHROMA }, () => [])
  const zcrFrames: number[] = []

  // Slide through audio in frames
  for (let start = 0; start + BUFFER_SIZE <= mono.length; start += HOP_SIZE) {
    const frame = mono.slice(start, start + BUFFER_SIZE)

    const features = Meyda.extract(
      ['spectralCentroid', 'mfcc', 'rms', 'chroma', 'zcr'],
      frame
    )
    if (!features) continue

    if (typeof features.spectralCentroid === 'number' && isFinite(features.spectralCentroid)) {
      centroidFrames.push(features.spectralCentroid)
    }

    if (features.mfcc) {
      for (let i = 0; i < NUM_MFCC; i++) {
        if (isFinite(features.mfcc[i])) {
          mfccFrames[i].push(features.mfcc[i])
        }
      }
    }

    if (typeof features.rms === 'number' && isFinite(features.rms)) {
      rmsFrames.push(features.rms)
    }

    if (features.chroma) {
      for (let i = 0; i < NUM_CHROMA; i++) {
        if (isFinite(features.chroma[i])) {
          chromaFrames[i].push(features.chroma[i])
        }
      }
    }

    if (typeof features.zcr === 'number' && isFinite(features.zcr)) {
      zcrFrames.push(features.zcr)
    }
  }

  // Aggregate: mean + stddev per feature → 56-dim vector
  const values: number[] = []

  // Spectral centroid: 2 dims
  const [cMean, cStd] = computeMeanStd(centroidFrames)
  values.push(cMean, cStd)

  // MFCC (13 coefficients): 26 dims
  for (let i = 0; i < NUM_MFCC; i++) {
    const [m, s] = computeMeanStd(mfccFrames[i])
    values.push(m, s)
  }

  // RMS: 2 dims
  const [rMean, rStd] = computeMeanStd(rmsFrames)
  values.push(rMean, rStd)

  // Chroma (12 bins): 24 dims
  for (let i = 0; i < NUM_CHROMA; i++) {
    const [m, s] = computeMeanStd(chromaFrames[i])
    values.push(m, s)
  }

  // ZCR: 2 dims
  const [zMean, zStd] = computeMeanStd(zcrFrames)
  values.push(zMean, zStd)

  return { dimensions: 56, values }
}
