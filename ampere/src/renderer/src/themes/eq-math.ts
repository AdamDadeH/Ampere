// EQ slider geometry constants (per Winamp 2.x specification)
export const EQ_SLIDER = {
  TOP: 38,           // Y where slider track begins
  HEIGHT: 63,        // Total slider track height
  THUMB_H: 11,       // Thumb sprite height
  THUMB_W: 11,       // Thumb sprite width
  BAND_COL_W: 14,    // Interaction column width per band
  PREAMP_X: 21,      // Preamp slider X position
  BAND_START_X: 78,  // First band slider X position
  BAND_SPACING: 18,  // X spacing between bands
  MIN_GAIN: -12,     // Minimum gain in dB
  MAX_GAIN: 12,      // Maximum gain in dB
} as const

/** Convert gain (-12 to +12 dB) to slider Y position in the EQ window */
export function gainToY(gain: number): number {
  const pct = 1 - (gain - EQ_SLIDER.MIN_GAIN) / (EQ_SLIDER.MAX_GAIN - EQ_SLIDER.MIN_GAIN)
  return EQ_SLIDER.TOP + pct * (EQ_SLIDER.HEIGHT - EQ_SLIDER.THUMB_H)
}

/** Convert slider Y position to gain (-12 to +12 dB) */
export function yToGain(y: number): number {
  const pct = (y - EQ_SLIDER.TOP) / (EQ_SLIDER.HEIGHT - EQ_SLIDER.THUMB_H)
  return EQ_SLIDER.MAX_GAIN - pct * (EQ_SLIDER.MAX_GAIN - EQ_SLIDER.MIN_GAIN)
}

/** Clamp a Y position to the valid slider range */
export function clampSliderY(y: number): number {
  const min = EQ_SLIDER.TOP
  const max = EQ_SLIDER.TOP + EQ_SLIDER.HEIGHT - EQ_SLIDER.THUMB_H
  return Math.max(min, Math.min(max, y))
}

/** Get X position for a given band index (0-9) */
export function bandX(index: number): number {
  return EQ_SLIDER.BAND_START_X + index * EQ_SLIDER.BAND_SPACING
}
