import { describe, it, expect } from 'vitest'
import { gainToY, yToGain, clampSliderY, bandX, EQ_SLIDER } from './eq-math'

// ─── Constants validation against Winamp 2.x spec ───────────────────────

describe('EQ_SLIDER constants (Winamp spec)', () => {
  it('slider track starts at y=38', () => {
    expect(EQ_SLIDER.TOP).toBe(38)
  })

  it('slider track height is 63px', () => {
    expect(EQ_SLIDER.HEIGHT).toBe(63)
  })

  it('thumb is 11x11 pixels', () => {
    expect(EQ_SLIDER.THUMB_H).toBe(11)
    expect(EQ_SLIDER.THUMB_W).toBe(11)
  })

  it('band column is 14px wide', () => {
    expect(EQ_SLIDER.BAND_COL_W).toBe(14)
  })

  it('preamp slider at x=21', () => {
    expect(EQ_SLIDER.PREAMP_X).toBe(21)
  })

  it('first band at x=78', () => {
    expect(EQ_SLIDER.BAND_START_X).toBe(78)
  })

  it('band spacing is 18px', () => {
    expect(EQ_SLIDER.BAND_SPACING).toBe(18)
  })

  it('gain range is -12 to +12 dB', () => {
    expect(EQ_SLIDER.MIN_GAIN).toBe(-12)
    expect(EQ_SLIDER.MAX_GAIN).toBe(12)
  })

  it('thumb travel range is HEIGHT - THUMB_H = 52px', () => {
    expect(EQ_SLIDER.HEIGHT - EQ_SLIDER.THUMB_H).toBe(52)
  })

  it('slider bottom edge is at y=101 (38 + 63)', () => {
    expect(EQ_SLIDER.TOP + EQ_SLIDER.HEIGHT).toBe(101)
  })

  it('maximum thumb Y is 90 (38 + 63 - 11)', () => {
    expect(EQ_SLIDER.TOP + EQ_SLIDER.HEIGHT - EQ_SLIDER.THUMB_H).toBe(90)
  })
})

// ─── Band X positions (per Winamp spec) ─────────────────────────────────

describe('bandX positions', () => {
  // From the Winamp spec (Webamp source):
  // Band positions: 78, 96, 114, 132, 150, 168, 186, 204, 222, 240
  const expectedPositions = [78, 96, 114, 132, 150, 168, 186, 204, 222, 240]

  expectedPositions.forEach((expectedX, i) => {
    it(`band ${i} (${['60Hz','170Hz','310Hz','600Hz','1kHz','3kHz','6kHz','12kHz','14kHz','16kHz'][i]}) at x=${expectedX}`, () => {
      expect(bandX(i)).toBe(expectedX)
    })
  })

  it('all 10 bands fit within EQ width (275px) with their 14px columns', () => {
    for (let i = 0; i < 10; i++) {
      const x = bandX(i)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x + EQ_SLIDER.BAND_COL_W).toBeLessThanOrEqual(275)
    }
  })

  it('band columns do not overlap', () => {
    for (let i = 0; i < 9; i++) {
      const endOfBand = bandX(i) + EQ_SLIDER.BAND_COL_W
      const startOfNext = bandX(i + 1)
      expect(startOfNext).toBeGreaterThanOrEqual(endOfBand)
    }
  })

  it('preamp column does not overlap first band', () => {
    expect(EQ_SLIDER.PREAMP_X + EQ_SLIDER.BAND_COL_W).toBeLessThanOrEqual(bandX(0))
  })
})

// ─── gainToY / yToGain conversion ───────────────────────────────────────

describe('gainToY', () => {
  it('+12 dB maps to top of slider (y=38)', () => {
    expect(gainToY(12)).toBe(38)
  })

  it('-12 dB maps to bottom of slider (y=90)', () => {
    expect(gainToY(-12)).toBe(90)
  })

  it('0 dB maps to middle (y=64)', () => {
    expect(gainToY(0)).toBe(64)
  })

  it('+6 dB maps to quarter from top (y=51)', () => {
    expect(gainToY(6)).toBe(51)
  })

  it('-6 dB maps to quarter from bottom (y=77)', () => {
    expect(gainToY(-6)).toBe(77)
  })

  it('output is always within valid thumb range [38, 90]', () => {
    for (let g = -12; g <= 12; g += 0.5) {
      const y = gainToY(g)
      expect(y).toBeGreaterThanOrEqual(38)
      expect(y).toBeLessThanOrEqual(90)
    }
  })

  it('is monotonically decreasing (higher gain = lower Y)', () => {
    let prevY = gainToY(12)
    for (let g = 11; g >= -12; g--) {
      const y = gainToY(g)
      expect(y).toBeGreaterThan(prevY)
      prevY = y
    }
  })
})

describe('yToGain', () => {
  it('top of slider (y=38) maps to +12 dB', () => {
    expect(yToGain(38)).toBe(12)
  })

  it('bottom of slider (y=90) maps to -12 dB', () => {
    expect(yToGain(90)).toBe(-12)
  })

  it('middle (y=64) maps to 0 dB', () => {
    expect(yToGain(64)).toBe(0)
  })

  it('is monotonically decreasing (lower Y = higher gain)', () => {
    let prevGain = yToGain(38)
    for (let y = 39; y <= 90; y++) {
      const gain = yToGain(y)
      expect(gain).toBeLessThan(prevGain)
      prevGain = gain
    }
  })
})

describe('gainToY and yToGain are inverses', () => {
  it('yToGain(gainToY(g)) === g for integer gains', () => {
    for (let g = -12; g <= 12; g++) {
      const roundTrip = yToGain(gainToY(g))
      expect(roundTrip).toBeCloseTo(g, 10)
    }
  })

  it('gainToY(yToGain(y)) === y for integer Y positions', () => {
    for (let y = 38; y <= 90; y++) {
      const roundTrip = gainToY(yToGain(y))
      expect(roundTrip).toBeCloseTo(y, 10)
    }
  })

  it('round-trip preserves 0.1 dB precision', () => {
    for (let g = -12; g <= 12; g += 0.1) {
      const roundTrip = yToGain(gainToY(g))
      expect(roundTrip).toBeCloseTo(g, 5)
    }
  })
})

// ─── clampSliderY ───────────────────────────────────────────────────────

describe('clampSliderY', () => {
  it('passes through values within range', () => {
    expect(clampSliderY(50)).toBe(50)
    expect(clampSliderY(38)).toBe(38)
    expect(clampSliderY(90)).toBe(90)
    expect(clampSliderY(64)).toBe(64)
  })

  it('clamps values below minimum to 38', () => {
    expect(clampSliderY(0)).toBe(38)
    expect(clampSliderY(37)).toBe(38)
    expect(clampSliderY(-100)).toBe(38)
  })

  it('clamps values above maximum to 90', () => {
    expect(clampSliderY(91)).toBe(90)
    expect(clampSliderY(116)).toBe(90)
    expect(clampSliderY(1000)).toBe(90)
  })

  it('clamped values always produce valid gains', () => {
    for (let y = -50; y <= 200; y++) {
      const clamped = clampSliderY(y)
      const gain = yToGain(clamped)
      expect(gain).toBeGreaterThanOrEqual(-12)
      expect(gain).toBeLessThanOrEqual(12)
    }
  })
})
