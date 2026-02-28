import { useRef, useEffect } from 'react'
import { useLibraryStore } from '../stores/library'
import { audioSignalProcessor, type AudioSignal } from '../audio/signal-processor'
import { createProgram, createFullscreenTriangle, createFBO, resizeFBO, deleteFBO, FULLSCREEN_VERT, type FBO } from './gl-utils'
import { fragmentSource as plasmaFrag } from './shaders/plasma'
import { fragmentSource as starfieldFrag } from './shaders/starfield'
import { fragmentSource as oceanFrag } from './shaders/ocean'
import { fragmentSource as creationFrag } from './shaders/creation'
import { fragmentSource as voronoiFrag } from './shaders/voronoi'
import { fragmentSource as deadMallFrag } from './shaders/dead-mall'
import { fragmentSource as deadOfficeFrag } from './shaders/dead-office'
import { fragmentSource as thunderstormFrag } from './shaders/thunderstorm'
import { fragmentSource as deepPoolFrag } from './shaders/deep-pool'
import { fragmentSource as terrainFrag } from './shaders/terrain'
import { fragmentSource as auroraFrag } from './shaders/aurora'
import { fragmentSource as solarFrag } from './shaders/solar'
import { fragmentSource as desertFrag } from './shaders/desert'
import { fragmentSource as forestFrag } from './shaders/forest'
import { fragmentSource as nebulaFrag } from './shaders/nebula'
import { fragmentSource as crystalCaveFrag } from './shaders/crystal-cave'
import { fragmentSource as bioluminescentFrag } from './shaders/bioluminescent'
import { fragmentSource as warpFrag } from './shaders/warp'
import { fragmentSource as glacierFrag } from './shaders/glacier'
import { fragmentSource as sandstormFrag } from './shaders/sandstorm'
import { fragmentSource as eventHorizonFrag } from './shaders/event-horizon'
import { fragmentSource as fogPeaksFrag } from './shaders/fog-peaks'
import { fragmentSource as frozenDunesFrag } from './shaders/frozen-dunes'
import { fragmentSource as infiniteCorridorFrag } from './shaders/infinite-corridor'
import { fragmentSource as neonRainFrag } from './shaders/neon-rain'
import { fragmentSource as backroomsFrag } from './shaders/backrooms'
import { fragmentSource as causticPoolFrag } from './shaders/caustic-pool'
import { fragmentSource as electricNoiseFrag } from './shaders/electric-noise'
import { fragmentSource as interiorLightFrag } from './shaders/interior-light'
import { fragmentSource as deepStarsFrag } from './shaders/deep-stars'
import { fragmentSource as hyperloopFrag } from './shaders/hyperloop'
import { fragmentSource as infiniteArcsFrag } from './shaders/infinite-arcs'
import { fragmentSource as electricStormFrag } from './shaders/electric-storm'
import { fragmentSource as plasmaOrbFrag } from './shaders/plasma-orb'
import { fragmentSource as organicCellsFrag } from './shaders/organic-cells'
import { fragmentSource as nightDriveFrag } from './shaders/night-drive'
import { fragmentSource as heartfeltFrag } from './shaders/heartfelt'
import { fragmentSource as waveGridFrag } from './shaders/wave-grid'
import { fragmentSource as sineFieldFrag } from './shaders/sine-field'
import { fragmentSource as clockworkFrag } from './shaders/clockwork'
import { fragmentSource as particleGlowFrag } from './shaders/particle-glow'
import { fragmentSource as dotGridFrag } from './shaders/dot-grid'
import { fragmentSource as chromeBlobsFrag } from './shaders/chrome-blobs'
import { fragmentSource as latticeTunnelFrag } from './shaders/lattice-tunnel'
import { fragmentSource as linescapeFrag } from './shaders/linescape'
import { fragmentSource as glassTowersFrag } from './shaders/glass-towers'
import { fragmentSource as fractalVoxelFrag } from './shaders/fractal-voxel'
import { fragmentSource as tokyoRainFrag } from './shaders/tokyo-rain'
import { fragmentSource as kaliIslandFrag } from './shaders/kali-island'
import { fragmentSource as kaliVoyageFrag } from './shaders/kali-voyage'
import { fragmentSource as parametricCurvesFrag } from './shaders/parametric-curves'
import { fragmentSource as topologicaFrag } from './shaders/topologica'
import { fragmentSource as waveInterferenceFrag } from './shaders/wave-interference'
import { fragmentSource as beatCirclesFrag } from './shaders/beat-circles'
import { fragmentSource as retroTerrainFrag } from './shaders/retro-terrain'
import { fragmentSource as topologicaBlueFrag } from './shaders/topologica-blue'
import { fragmentSource as dataGatesFrag } from './shaders/data-gates'
import { fragmentSource as diamondTerrainFrag } from './shaders/diamond-terrain'
import { fragmentSource as crtFrag } from './shaders/crt'
import { createScroller, drawScroller, setScrollerText, resizeScroller, type ScrollerState } from './overlays/scroller'
import { createPresetState, updatePresets, cyclePreset, switchCategory, currentPresetInfo, type PresetState, type ShaderName, type FeedbackParams } from './presets'

interface ShaderProgram {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation | null>
}

/** Crossfade mix shader — blends two FBO textures */
const CROSSFADE_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uMix;
void main() {
  vec4 a = texture(uTexA, vUV);
  vec4 b = texture(uTexB, vUV);
  fragColor = mix(a, b, uMix);
}
`

/** Feedback shader — reads previous frame with warp + decay, composites with fresh effect */
const FEEDBACK_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uPrevFrame;
uniform sampler2D uNewFrame;
uniform float uDecay;
uniform float uZoom;
uniform float uRotation;

void main() {
  // Warp UVs for feedback: zoom toward center + rotation
  vec2 center = vec2(0.5);
  vec2 uv = center + (vUV - center) * uZoom;

  float c = cos(uRotation);
  float s = sin(uRotation);
  vec2 d = uv - center;
  uv = center + vec2(d.x * c - d.y * s, d.x * s + d.y * c);

  vec4 prev = texture(uPrevFrame, uv) * uDecay;
  vec4 fresh = texture(uNewFrame, vUV);

  // Blend: previous frame provides trails, fresh provides new detail
  fragColor = max(prev, fresh * (1.0 - uDecay * 0.3));
}
`

function compileEffect(gl: WebGL2RenderingContext, fragSrc: string): ShaderProgram {
  const program = createProgram(gl, FULLSCREEN_VERT, fragSrc)
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
  const uniforms: Record<string, WebGLUniformLocation | null> = {}
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i)
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name)
  }
  return { program, uniforms }
}

function setSignalUniforms(
  gl: WebGL2RenderingContext,
  sp: ShaderProgram,
  signal: AudioSignal,
  w: number,
  h: number,
): void {
  const u = sp.uniforms
  if (u.uTime != null) gl.uniform1f(u.uTime, signal.time)
  if (u.uResolution != null) gl.uniform2f(u.uResolution, w, h)
  if (u.uBass != null) gl.uniform1f(u.uBass, signal.bands.bass)
  if (u.uMid != null) gl.uniform1f(u.uMid, signal.bands.mid)
  if (u.uTreble != null) gl.uniform1f(u.uTreble, signal.bands.treble)
  if (u.uBeat != null) gl.uniform1f(u.uBeat, signal.beat)
  if (u.uPhaseBass != null) gl.uniform1f(u.uPhaseBass, signal.phase.bass)
  if (u.uPhaseMid != null) gl.uniform1f(u.uPhaseMid, signal.phase.mid)
  if (u.uPhaseTreble != null) gl.uniform1f(u.uPhaseTreble, signal.phase.treble)
}

export function DemosceneVisualizer(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const stateRef = useRef<{
    shaders: Record<ShaderName, ShaderProgram>
    crt: ShaderProgram
    crossfade: ShaderProgram
    feedback: ShaderProgram
    vao: WebGLVertexArrayObject
    fboA: FBO           // render effect A
    fboB: FBO           // render effect B (during crossfade)
    fboMixed: FBO       // crossfade result
    fboPing: FBO        // feedback ping-pong A
    fboPong: FBO        // feedback ping-pong B
    pingIsCurrent: boolean
    scroller: ScrollerState
    presets: PresetState
    lastTime: number
    lastTrackId: string | null
  } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // WebGL canvas
    const glCanvas = document.createElement('canvas')
    glCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    container.appendChild(glCanvas)

    // Scroller overlay canvas
    const scrollCanvas = document.createElement('canvas')
    scrollCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
    container.appendChild(scrollCanvas)

    const gl = glCanvas.getContext('webgl2', { alpha: false, antialias: false })
    if (!gl) {
      console.error('WebGL2 not supported')
      return
    }
    glRef.current = gl

    // Compile all shaders
    const shaders: Record<ShaderName, ShaderProgram> = {
      plasma: compileEffect(gl, plasmaFrag),
      starfield: compileEffect(gl, starfieldFrag),
      ocean: compileEffect(gl, oceanFrag),
      creation: compileEffect(gl, creationFrag),
      voronoi: compileEffect(gl, voronoiFrag),
      deadMall: compileEffect(gl, deadMallFrag),
      deadOffice: compileEffect(gl, deadOfficeFrag),
      thunderstorm: compileEffect(gl, thunderstormFrag),
      deepPool: compileEffect(gl, deepPoolFrag),
      terrain: compileEffect(gl, terrainFrag),
      aurora: compileEffect(gl, auroraFrag),
      solar: compileEffect(gl, solarFrag),
      desert: compileEffect(gl, desertFrag),
      forest: compileEffect(gl, forestFrag),
      nebula: compileEffect(gl, nebulaFrag),
      crystalCave: compileEffect(gl, crystalCaveFrag),
      bioluminescent: compileEffect(gl, bioluminescentFrag),
      warp: compileEffect(gl, warpFrag),
      glacier: compileEffect(gl, glacierFrag),
      sandstorm: compileEffect(gl, sandstormFrag),
      eventHorizon: compileEffect(gl, eventHorizonFrag),
      fogPeaks: compileEffect(gl, fogPeaksFrag),
      frozenDunes: compileEffect(gl, frozenDunesFrag),
      infiniteCorridor: compileEffect(gl, infiniteCorridorFrag),
      neonRain: compileEffect(gl, neonRainFrag),
      backrooms: compileEffect(gl, backroomsFrag),
      causticPool: compileEffect(gl, causticPoolFrag),
      electricNoise: compileEffect(gl, electricNoiseFrag),
      interiorLight: compileEffect(gl, interiorLightFrag),
      deepStars: compileEffect(gl, deepStarsFrag),
      hyperloop: compileEffect(gl, hyperloopFrag),
      infiniteArcs: compileEffect(gl, infiniteArcsFrag),
      electricStorm: compileEffect(gl, electricStormFrag),
      plasmaOrb: compileEffect(gl, plasmaOrbFrag),
      organicCells: compileEffect(gl, organicCellsFrag),
      nightDrive: compileEffect(gl, nightDriveFrag),
      heartfelt: compileEffect(gl, heartfeltFrag),
      waveGrid: compileEffect(gl, waveGridFrag),
      sineField: compileEffect(gl, sineFieldFrag),
      clockwork: compileEffect(gl, clockworkFrag),
      particleGlow: compileEffect(gl, particleGlowFrag),
      dotGrid: compileEffect(gl, dotGridFrag),
      chromeBlobs: compileEffect(gl, chromeBlobsFrag),
      latticeTunnel: compileEffect(gl, latticeTunnelFrag),
      linescape: compileEffect(gl, linescapeFrag),
      glassTowers: compileEffect(gl, glassTowersFrag),
      fractalVoxel: compileEffect(gl, fractalVoxelFrag),
      tokyoRain: compileEffect(gl, tokyoRainFrag),
      kaliIsland: compileEffect(gl, kaliIslandFrag),
      kaliVoyage: compileEffect(gl, kaliVoyageFrag),
      parametricCurves: compileEffect(gl, parametricCurvesFrag),
      topologica: compileEffect(gl, topologicaFrag),
      waveInterference: compileEffect(gl, waveInterferenceFrag),
      beatCircles: compileEffect(gl, beatCirclesFrag),
      retroTerrain: compileEffect(gl, retroTerrainFrag),
      topologicaBlue: compileEffect(gl, topologicaBlueFrag),
      dataGates: compileEffect(gl, dataGatesFrag),
      diamondTerrain: compileEffect(gl, diamondTerrainFrag),
    }
    const crt = compileEffect(gl, crtFrag)
    const crossfade = compileEffect(gl, CROSSFADE_FRAG)
    const feedback = compileEffect(gl, FEEDBACK_FRAG)

    const vao = createFullscreenTriangle(gl)
    const w = glCanvas.width || 1
    const h = glCanvas.height || 1
    const fboA = createFBO(gl, w, h)
    const fboB = createFBO(gl, w, h)
    const fboMixed = createFBO(gl, w, h)
    const fboPing = createFBO(gl, w, h)
    const fboPong = createFBO(gl, w, h)

    const scroller = createScroller(scrollCanvas)
    const presets = createPresetState()

    stateRef.current = {
      shaders,
      crt,
      crossfade,
      feedback,
      vao,
      fboA,
      fboB,
      fboMixed,
      fboPing,
      fboPong,
      pingIsCurrent: true,
      scroller,
      presets,
      lastTime: performance.now() / 1000,
      lastTrackId: null,
    }

    // Sizing
    const resize = (): void => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.floor(rect.width * dpr)
      const h = Math.floor(rect.height * dpr)
      glCanvas.width = w
      glCanvas.height = h
      gl.viewport(0, 0, w, h)

      const s = stateRef.current
      if (s) {
        for (const fbo of [s.fboA, s.fboB, s.fboMixed, s.fboPing, s.fboPong]) {
          resizeFBO(gl, fbo, w, h)
        }
        resizeScroller(s.scroller, Math.floor(rect.width), Math.floor(rect.height))
      }
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(container)

    // --- OSD (on-screen display) for preset name ---
    const osd = document.createElement('div')
    osd.style.cssText = 'position:absolute;top:16px;right:16px;color:rgba(255,255,255,0.85);font:600 14px/1 monospace;pointer-events:none;opacity:0;transition:opacity 0.3s;text-shadow:0 1px 4px rgba(0,0,0,0.8);z-index:10;text-align:right'
    container.appendChild(osd)
    let osdTimer = 0
    const showOSD = (text: string): void => {
      osd.textContent = text
      osd.style.opacity = '1'
      clearTimeout(osdTimer)
      osdTimer = window.setTimeout(() => { osd.style.opacity = '0' }, 2000)
    }

    // Show initial preset on load
    {
      const info = currentPresetInfo(presets)
      showOSD(`[${info.category}] ${info.position} ${info.name}`)
    }

    // --- Keyboard controls ---
    // [ / ] = switch category (demoscene / liminal / seeds)
    // , / . = cycle through ALL presets (prev / next)
    const onKeyDown = (e: KeyboardEvent): void => {
      const s = stateRef.current
      if (!s) return

      if (e.key === '[' || e.key === ']') {
        const dir = e.key === ']' ? 1 : -1
        switchCategory(s.presets, dir as 1 | -1)
        const info = currentPresetInfo(s.presets)
        showOSD(`[${info.category}] ${info.position} ${info.name}`)
      } else if (e.key === ',' || e.key === '.') {
        const dir = e.key === '.' ? 1 : -1
        cyclePreset(s.presets, dir as 1 | -1)
        const info = currentPresetInfo(s.presets)
        showOSD(`[${info.category}] ${info.position} ${info.name}`)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    // --- Render loop ---
    const frame = (): void => {
      const s = stateRef.current
      if (!s) return

      const now = performance.now() / 1000
      const dt = now - s.lastTime
      s.lastTime = now

      // Update audio signal processor (once per frame, shared with any consumer)
      audioSignalProcessor.update(dt)
      const signal = audioSignalProcessor.signal

      // Track change detection
      const currentTrack = useLibraryStore.getState().currentTrack
      const trackId = currentTrack?.id ?? null
      const trackChanged = trackId !== null && trackId !== s.lastTrackId
      s.lastTrackId = trackId

      if (trackChanged && currentTrack) {
        const parts: string[] = []
        if (currentTrack.title) parts.push(currentTrack.title)
        if (currentTrack.artist) parts.push(`by ${currentTrack.artist}`)
        if (currentTrack.album) parts.push(`from "${currentTrack.album}"`)
        setScrollerText(s.scroller, parts.join(' ... ') || currentTrack.file_name)
      }

      // Preset transitions
      const preset = updatePresets(s.presets, dt, signal.beat, trackChanged)

      const w = glCanvas.width
      const h = glCanvas.height

      gl.bindVertexArray(s.vao)

      // 1. Render current effect → fboA
      renderEffect(gl, s.shaders[preset.current], s.fboA, signal, w, h)

      let effectFBO: FBO
      if (preset.next !== null && preset.mix > 0) {
        // Render next effect → fboB, crossfade → fboMixed
        renderEffect(gl, s.shaders[preset.next], s.fboB, signal, w, h)
        renderCrossfade(gl, s.crossfade, s.fboA, s.fboB, s.fboMixed, preset.mix, w, h)
        effectFBO = s.fboMixed
      } else {
        effectFBO = s.fboA
      }

      // 2. Feedback: composite previous accumulated frame + fresh effect
      const prevFBO = s.pingIsCurrent ? s.fboPing : s.fboPong
      const destFBO = s.pingIsCurrent ? s.fboPong : s.fboPing
      renderFeedback(gl, s.feedback, prevFBO, effectFBO, destFBO, preset.feedback, dt, w, h)
      s.pingIsCurrent = !s.pingIsCurrent

      // 3. CRT post-process → screen
      renderCRT(gl, s.crt, destFBO, signal, w, h)

      // 4. Scroller overlay
      drawScroller(s.scroller, signal.time, signal.energy, signal.beat)

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    // Cleanup
    return () => {
      cancelAnimationFrame(rafRef.current)
      observer.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      clearTimeout(osdTimer)

      const s = stateRef.current
      if (s && gl) {
        for (const sp of Object.values(s.shaders)) gl.deleteProgram(sp.program)
        gl.deleteProgram(s.crt.program)
        gl.deleteProgram(s.crossfade.program)
        gl.deleteProgram(s.feedback.program)
        gl.deleteVertexArray(s.vao)
        for (const fbo of [s.fboA, s.fboB, s.fboMixed, s.fboPing, s.fboPong]) {
          deleteFBO(gl, fbo)
        }
      }
      stateRef.current = null
      glRef.current = null

      while (container.firstChild) container.removeChild(container.firstChild)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex-1 relative bg-black overflow-hidden"
    />
  )
}

// --- Render helpers ---

function renderEffect(
  gl: WebGL2RenderingContext,
  sp: ShaderProgram,
  fbo: FBO,
  signal: AudioSignal,
  w: number,
  h: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer)
  gl.viewport(0, 0, w, h)
  gl.useProgram(sp.program)
  setSignalUniforms(gl, sp, signal, w, h)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function renderCrossfade(
  gl: WebGL2RenderingContext,
  sp: ShaderProgram,
  fboA: FBO,
  fboB: FBO,
  dest: FBO,
  mix: number,
  w: number,
  h: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, dest.framebuffer)
  gl.viewport(0, 0, w, h)
  gl.useProgram(sp.program)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, fboA.texture)
  if (sp.uniforms.uTexA != null) gl.uniform1i(sp.uniforms.uTexA, 0)
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, fboB.texture)
  if (sp.uniforms.uTexB != null) gl.uniform1i(sp.uniforms.uTexB, 1)
  if (sp.uniforms.uMix != null) gl.uniform1f(sp.uniforms.uMix, mix)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function renderFeedback(
  gl: WebGL2RenderingContext,
  sp: ShaderProgram,
  prevFBO: FBO,
  effectFBO: FBO,
  destFBO: FBO,
  fb: FeedbackParams,
  dt: number,
  w: number,
  h: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, destFBO.framebuffer)
  gl.viewport(0, 0, w, h)
  gl.useProgram(sp.program)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, prevFBO.texture)
  if (sp.uniforms.uPrevFrame != null) gl.uniform1i(sp.uniforms.uPrevFrame, 0)

  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, effectFBO.texture)
  if (sp.uniforms.uNewFrame != null) gl.uniform1i(sp.uniforms.uNewFrame, 1)

  if (sp.uniforms.uDecay != null) gl.uniform1f(sp.uniforms.uDecay, fb.decay)
  if (sp.uniforms.uZoom != null) gl.uniform1f(sp.uniforms.uZoom, fb.zoom)
  if (sp.uniforms.uRotation != null) gl.uniform1f(sp.uniforms.uRotation, fb.rotation * dt)

  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function renderCRT(
  gl: WebGL2RenderingContext,
  sp: ShaderProgram,
  sourceFBO: FBO,
  signal: AudioSignal,
  w: number,
  h: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, w, h)
  gl.useProgram(sp.program)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, sourceFBO.texture)
  if (sp.uniforms.uScene != null) gl.uniform1i(sp.uniforms.uScene, 0)
  if (sp.uniforms.uResolution != null) gl.uniform2f(sp.uniforms.uResolution, w, h)
  if (sp.uniforms.uTime != null) gl.uniform1f(sp.uniforms.uTime, signal.time)
  if (sp.uniforms.uBass != null) gl.uniform1f(sp.uniforms.uBass, signal.bands.bass)
  if (sp.uniforms.uBeat != null) gl.uniform1f(sp.uniforms.uBeat, signal.beat)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}
