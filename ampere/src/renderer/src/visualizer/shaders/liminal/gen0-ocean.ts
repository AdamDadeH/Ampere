/**
 * @liminal gen0-ocean
 * @generation 0
 * @parents SEED
 * @origin Seascape (Alexander Alekseev / TDM) — adapted for Ampere audio uniforms
 * @status ACTIVE
 * @notes The original. FBM ocean with raymarched water surface. The benchmark
 *        all liminal offspring are measured against. Lives in shaders/ocean.ts
 *        as a demoscene preset too — this copy is the liminal lineage reference.
 *
 * FBM ocean — layered wave octaves with raymarched water surface.
 * Technique from Seascape (Alexander Alekseev / TDM).
 * Multiple noise octaves at decreasing amplitude create realistic waves.
 */

// Re-export from the canonical ocean shader (shared with demoscene presets)
export { fragmentSource, defaultUniforms } from '../ocean'
