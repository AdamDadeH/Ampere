import { describe, it, expect } from 'vitest'
import { zScoreNormalize } from './umap-projection'

describe('zScoreNormalize', () => {
  it('produces mean~0 and std~1 per dimension', () => {
    const data = [
      [10, 100, 1000],
      [20, 200, 2000],
      [30, 300, 3000],
      [40, 400, 4000],
    ]
    const result = zScoreNormalize(data)

    // Verify per-dimension
    for (let d = 0; d < 3; d++) {
      const col = result.map(row => row[d])
      const mean = col.reduce((a, b) => a + b, 0) / col.length
      const std = Math.sqrt(col.reduce((a, v) => a + (v - mean) ** 2, 0) / col.length)

      expect(mean).toBeCloseTo(0, 10)
      expect(std).toBeCloseTo(1, 10)
    }
  })

  it('returns zeros for single-row input (std=0 clamped to 1)', () => {
    const data = [[5, 10, 15]]
    const result = zScoreNormalize(data)

    expect(result).toHaveLength(1)
    // (val - mean) / 1 = 0 since mean === val for single row
    for (const val of result[0]) {
      expect(val).toBe(0)
    }
  })

  it('returns zeros for all-identical values', () => {
    const data = [
      [7, 7, 7],
      [7, 7, 7],
      [7, 7, 7],
    ]
    const result = zScoreNormalize(data)

    for (const row of result) {
      for (const val of row) {
        expect(val).toBe(0)
      }
    }
  })

  it('returns empty array for empty input', () => {
    const result = zScoreNormalize([])
    expect(result).toEqual([])
  })

  it('preserves relative ordering within a dimension', () => {
    const data = [
      [1, 100],
      [2, 200],
      [3, 300],
    ]
    const result = zScoreNormalize(data)

    // Within each dimension, order should be preserved
    expect(result[0][0]).toBeLessThan(result[1][0])
    expect(result[1][0]).toBeLessThan(result[2][0])
    expect(result[0][1]).toBeLessThan(result[1][1])
    expect(result[1][1]).toBeLessThan(result[2][1])
  })

  it('normalizes dimensions with different scales to comparable ranges', () => {
    const data = [
      [0, 0],
      [1, 1000],
    ]
    const result = zScoreNormalize(data)

    // After normalization, both dimensions should span the same range
    const range0 = Math.abs(result[1][0] - result[0][0])
    const range1 = Math.abs(result[1][1] - result[0][1])
    expect(range0).toBeCloseTo(range1, 10)
  })
})
