const DECAY_HALF_LIFE_MS = 5 * 60 * 1000 // weight halves every 5 min without interaction

let lastInteractionTime = Date.now()
let isForeground = true

export function recordInteraction(): void {
  lastInteractionTime = Date.now()
}

export function setForeground(fg: boolean): void {
  isForeground = fg
}

export function getAttentionWeight(): number {
  const elapsed = Date.now() - lastInteractionTime
  // Exponential decay: weight halves every DECAY_HALF_LIFE_MS
  let weight = Math.pow(0.5, elapsed / DECAY_HALF_LIFE_MS)
  // Halve when app is in background
  if (!isForeground) weight *= 0.5
  // Clamp to [0.05, 1.0]
  return Math.max(0.05, Math.min(1.0, weight))
}
