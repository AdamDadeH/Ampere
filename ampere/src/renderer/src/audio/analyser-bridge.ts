/**
 * Module-level AnalyserNode bridge.
 * AudioEngine writes the node ref after init; any consumer reads directly.
 * Intentionally thin — all processing lives in signal-processor.ts.
 */
export const analyserBridge: { node: AnalyserNode | null } = { node: null }
