import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { useLibraryStore } from '../stores/library'
import { extractAllFeatures } from './feature-worker'
import { projectToUMAP, UMAPParams, DEFAULT_UMAP_PARAMS } from './umap-projection'
import { labelNeighbors, KNNGraph, LabeledNeighbor } from './navigation'
import { SemanticIndex, DriftTier } from './semantic-drift'
import {
  SCALE_RANGE, TrackNode, FeatureSource, featureApi, buildNavData
} from './nav-data'
import { isNavMode, NavModeId, PlayMode } from './modes'
import { useNavigationStore } from '../stores/navigation'
import { musicAdapter } from '../../../shared/adapters/music'

type Phase = 'idle' | 'extracting' | 'projecting' | 'ready'

const COLOR_DEFAULT = new THREE.Color(0x00ccff)
const COLOR_RATED_HIGH = new THREE.Color(0x00ff88) // 4-5 stars
const COLOR_RATED_LOW = new THREE.Color(0xff4466)  // 1-2 stars
const COLOR_PLAYING = new THREE.Color(0xffffff)
const COLOR_HOVERED = new THREE.Color(0xff8800)
const COLOR_TRAIL = new THREE.Color(0x00ffaa)

function getBaseColor(rating: number): THREE.Color {
  if (rating >= 4) return COLOR_RATED_HIGH
  if (rating >= 1 && rating <= 2) return COLOR_RATED_LOW
  return COLOR_DEFAULT
}

// A distinct, vivid color per Semantic-ID level-0 code. Hues are spread by the
// golden ratio so adjacent code numbers don't get near-identical hues, and
// bright/saturated so they pop under bloom.
const GOLDEN_RATIO_CONJUGATE = 0.618033988749895
function semanticColor(code: number): THREE.Color {
  const hue = (code * GOLDEN_RATIO_CONJUGATE) % 1
  return new THREE.Color().setHSL(hue, 0.72, 0.6)
}

function computeNodeColors(
  nodes: TrackNode[],
  colorMode: ColorMode,
  ratingByTrack: Map<string, number>
): THREE.Color[] {
  if (colorMode === 'semantic') {
    return nodes.map((n) => (n.c0 !== undefined ? semanticColor(n.c0) : COLOR_DEFAULT))
  }
  return nodes.map((n) => getBaseColor(ratingByTrack.get(n.trackId) ?? 0))
}

function buildLegend(nodes: TrackNode[], codeNames: Map<number, string>): LegendEntry[] {
  const counts = new Map<number, number>()
  for (const n of nodes) {
    if (n.c0 === undefined) continue
    counts.set(n.c0, (counts.get(n.c0) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({
      code,
      name: codeNames.get(code) ?? `code ${code}`,
      hex: `#${semanticColor(code).getHexString()}`,
      count
    }))
}
const MAX_TRAJECTORY_POINTS = 500

const featureGroups = musicAdapter.featureExtractor?.featureGroups ?? []

// Color palette for feature groups — cycles through for any number of groups
const GROUP_COLOR_PALETTE = [
  'bg-amber-600/80 text-amber-100',
  'bg-purple-600/80 text-purple-100',
  'bg-red-600/80 text-red-100',
  'bg-blue-600/80 text-blue-100',
  'bg-emerald-600/80 text-emerald-100',
]
const GROUP_COLORS: Record<string, string> = Object.fromEntries(
  featureGroups.map((g, i) => [g.name, GROUP_COLOR_PALETTE[i % GROUP_COLOR_PALETTE.length]])
)

type ColorMode = 'semantic' | 'rating'

interface LegendEntry {
  code: number
  name: string
  hex: string
  count: number
}

// The navigator can project from two audio-derived feature sources, both fully
// recomputable and metadata-free:
//   'meyda' — 56-dim DSP features extracted in-app (track_features)
//   'clap'  — 512-dim CLAP embeddings imported from the vq pipeline (track_semantic)
// Each persists its own UMAP coords, so switching never clobbers the other map.
export function RiemannNavigator(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    composer: EffectComposer
    mesh: THREE.InstancedMesh | null
    nodes: TrackNode[]
    trackIdToIndex: Map<string, number>
    raycaster: THREE.Raycaster
    mouse: THREE.Vector2
    hoveredIndex: number
    playingIndex: number
    animationId: number
    dummy: THREE.Object3D
    clock: THREE.Clock
    trajectoryLine: THREE.Line | null
    trajectoryPositions: Float32Array
    trajectoryCount: number
    knn: KNNGraph | null
    semanticIndex: SemanticIndex | null
    featureMap: Map<string, number[]>
    baseColors: THREE.Color[]
    bloomPass: UnrealBloomPass
    _cleanup?: () => void
  } | null>(null)

  const tooltipRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [extractProgress, setExtractProgress] = useState({ done: 0, total: 0, file: '' })
  const [umapProgress, setUmapProgress] = useState({ epoch: 0, total: 200 })
  const [featureCount, setFeatureCount] = useState(0)
  const [totalTracks, setTotalTracks] = useState(0)
  const [source, setSource] = useState<FeatureSource>('meyda')
  const [semanticCount, setSemanticCount] = useState(0)
  const [colorMode, setColorMode] = useState<ColorMode>('semantic')
  const [legend, setLegend] = useState<LegendEntry[]>([])
  const [legendOpen, setLegendOpen] = useState(true)
  // c0 code → human-readable name (from semantic_code_names level 0)
  const codeNamesRef = useRef<Map<number, string>>(new Map())

  const { currentTrack, tracks, playTrack, setDriftNext } = useLibraryStore()

  const [hasCoords, setHasCoords] = useState(false)
  const [umapParams, setUmapParams] = useState<UMAPParams>({ ...DEFAULT_UMAP_PARAMS })
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Which nav mode is running is now global state — the same selector drives
  // the main player, so leaving this view no longer stops the walk.
  const playMode = useLibraryStore(s => s.playMode)
  const setPlayMode = useLibraryStore(s => s.setPlayMode)
  const drifting = isNavMode(playMode)
  const coherence = useNavigationStore(s => s.coherence)
  const setCoherence = useNavigationStore(s => s.setCoherence)
  const lastTier = useNavigationStore(s => s.lastTier) as DriftTier | null
  const [pickerNeighbors, setPickerNeighbors] = useState<LabeledNeighbor[]>([])
  const [pickerOpen, setPickerOpen] = useState(true)
  const [nodeScale, setNodeScale] = useState(0.4)
  const [bloomStrength, setBloomStrength] = useState(0.8)
  const nodeScaleRef = useRef(0.4)

  // Check initial state on mount
  useEffect(() => {
    let cancelled = false
    async function check(): Promise<void> {
      const [meydaCount, semCount, stats] = await Promise.all([
        window.api.getFeatureCount(),
        window.api.getSemanticCount(),
        window.api.getLibraryStats()
      ])
      if (cancelled) return
      const total = (stats as { total_tracks: number }).total_tracks
      setTotalTracks(total)
      setSemanticCount(semCount)

      // Cache c0 code labels for legend / coloring
      if (semCount > 0) {
        const names = await window.api.getSemanticCodeNames()
        if (cancelled) return
        const m = new Map<number, string>()
        for (const n of names) if (n.level === 0) m.set(n.code, n.name)
        codeNamesRef.current = m
      }

      // Prefer the richer CLAP map when it's been imported.
      const initialSource: FeatureSource = semCount > 0 ? 'clap' : 'meyda'
      setSource(initialSource)
      const count = initialSource === 'clap' ? semCount : meydaCount
      setFeatureCount(count)

      // If any coords exist for the chosen source, we can show a map
      if (count > 0) {
        const withCoords = await featureApi(initialSource).withCoords()
        if (!cancelled && withCoords.length > 0) {
          setHasCoords(true)
          setPhase('ready')
        }
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  // Run UMAP on whatever features exist for the active source and show the map
  const runProjection = useCallback(async (params?: UMAPParams) => {
    setPhase('projecting')
    const api = featureApi(source)
    const allFeatures = await api.features()
    if (allFeatures.length === 0) {
      setPhase('idle')
      return
    }
    await projectToUMAP(allFeatures, (epoch, totalEpochs) => {
      setUmapProgress({ epoch, total: totalEpochs })
    }, params || umapParams, api.persist)
    setFeatureCount(allFeatures.length)
    setHasCoords(true)
    setPhase('ready')
  }, [umapParams, source])

  // Switch feature source (Meyda DSP ↔ CLAP). Loads that source's existing map
  // if it has one, otherwise drops to idle so the user can project it.
  const selectSource = useCallback(async (next: FeatureSource) => {
    if (next === source) return
    setSource(next)
    const api = featureApi(next)
    const count = await api.count()
    setFeatureCount(count)
    const withCoords = count > 0 ? await api.withCoords() : []
    setHasCoords(withCoords.length > 0)
    setPhase(withCoords.length > 0 ? 'ready' : 'idle')
  }, [source])

  // Start analysis pipeline
  const startAnalysis = useCallback(async () => {
    const controller = new AbortController()
    abortRef.current = controller

    // Phase: extracting
    setPhase('extracting')
    await extractAllFeatures(
      (done, total, file) => {
        setExtractProgress({ done, total, file: file || '' })
      },
      controller.signal
    )

    // Whether aborted or complete, project whatever features we have
    const count = await window.api.getFeatureCount()
    setFeatureCount(count)
    if (count === 0) {
      setPhase('idle')
      return
    }

    setPhase('projecting')
    const allFeatures = await window.api.getTrackFeatures()
    await projectToUMAP(allFeatures, (epoch, totalEpochs) => {
      setUmapProgress({ epoch, total: totalEpochs })
    }, umapParams)

    setHasCoords(true)
    setPhase('ready')
  }, [umapParams])

  // Cancel on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      setDriftNext(null)
    }
  }, [setDriftNext])

  // Three.js scene setup and render loop — runs when phase === 'ready'
  useEffect(() => {
    if (phase !== 'ready' || !containerRef.current) return

    let disposed = false

    async function initScene(): Promise<void> {
      const container = containerRef.current!
      const width = container.clientWidth
      const height = container.clientHeight

      // Load data for the active feature source
      const api = featureApi(source)
      const [coordData, allFeatures] = await Promise.all([
        api.withCoords(),
        api.features()
      ])
      if (disposed || coordData.length === 0) return

      // One shared graph builder for both surfaces — see nav-data.ts. Handing
      // the result to the navigation store means the main player walks exactly
      // the neighbours drawn on screen here, not a separately-computed set.
      const navData = buildNavData(coordData, allFeatures)
      const { nodes, trackIdToIndex, knn, semanticIndex, featureMap } = navData
      useNavigationStore.getState().adoptData(navData, source)

      // Normalize coords to ±SCALE_RANGE
      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      container.appendChild(renderer.domElement)

      // Scene + Camera
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
      camera.position.set(0, 0, SCALE_RANGE * 1.5)

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.rotateSpeed = 0.5

      // InstancedMesh
      const geometry = new THREE.SphereGeometry(0.5, 8, 8)
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff })
      const mesh = new THREE.InstancedMesh(geometry, material, nodes.length)

      const dummy = new THREE.Object3D()
      const colorAttr = new Float32Array(nodes.length * 3)

      // Rating lookup once (avoids O(n²) finds across 10k nodes)
      const ratingByTrack = new Map<string, number>()
      for (const t of tracks) ratingByTrack.set(t.id, t.rating ?? 0)

      // Semantic coloring only makes sense when nodes carry c0 (CLAP source).
      const hasSemantic = nodes.some((n) => n.c0 !== undefined)
      const effectiveMode: ColorMode = hasSemantic ? colorMode : 'rating'
      const baseColors: THREE.Color[] = computeNodeColors(nodes, effectiveMode, ratingByTrack)

      // Build the legend (codes present, by count) when coloring semantically.
      setLegend(effectiveMode === 'semantic' ? buildLegend(nodes, codeNamesRef.current) : [])

      const initScale = nodeScaleRef.current
      for (let i = 0; i < nodes.length; i++) {
        dummy.position.set(nodes[i].x, nodes[i].y, nodes[i].z)
        dummy.scale.set(initScale, initScale, initScale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)

        baseColors[i].toArray(colorAttr, i * 3)
      }

      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colorAttr, 3)
      scene.add(mesh)

      // Post-processing (bloom)
      const composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        bloomStrength,  // strength
        0.4,   // radius
        0.2    // threshold
      )
      composer.addPass(bloomPass)
      composer.addPass(new OutputPass())

      // Trajectory line — pre-allocate buffer, draw range grows as drift progresses
      const trajectoryPositions = new Float32Array(MAX_TRAJECTORY_POINTS * 3)
      const trajectoryGeometry = new THREE.BufferGeometry()
      trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3))
      trajectoryGeometry.setDrawRange(0, 0)
      const trajectoryMaterial = new THREE.LineBasicMaterial({ color: COLOR_TRAIL, linewidth: 1 })
      const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial)
      scene.add(trajectoryLine)

      // Raycaster
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      const state = {
        renderer,
        scene,
        camera,
        controls,
        composer,
        mesh,
        nodes,
        trackIdToIndex,
        raycaster,
        mouse,
        hoveredIndex: -1,
        playingIndex: -1,
        animationId: 0,
        dummy,
        clock: new THREE.Clock(),
        trajectoryLine,
        trajectoryPositions,
        trajectoryCount: 0,
        knn,
        semanticIndex,
        featureMap,
        baseColors,
        bloomPass
      }
      sceneRef.current = state

      // Mouse events
      const onMouseMove = (e: MouseEvent): void => {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      }

      const onClick = (): void => {
        if (state.hoveredIndex >= 0) {
          const node = nodes[state.hoveredIndex]
          const track = tracks.find(t => t.id === node.trackId)
          if (track) {
            playTrack(track, tracks)
            // Lerp camera toward clicked track
            lerpTarget = new THREE.Vector3(node.x, node.y, node.z)
            lerpProgress = 0
          }
        }
      }

      renderer.domElement.addEventListener('mousemove', onMouseMove)
      renderer.domElement.addEventListener('click', onClick)

      // Keyboard fly controls — WASD move, arrows look, QE rise/fall
      const keysDown = new Set<string>()
      const FLY_SPEED = 0.8
      const LOOK_SPEED = 0.03

      const onKeyDown = (e: KeyboardEvent): void => {
        const key = e.key.toLowerCase()
        keysDown.add(key)
        // Prevent arrow keys from scrolling the page
        if (e.key.startsWith('Arrow')) e.preventDefault()
      }
      const onKeyUp = (e: KeyboardEvent): void => {
        keysDown.delete(e.key.toLowerCase())
      }
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)

      // Camera lerp state
      let lerpTarget: THREE.Vector3 | null = null
      let lerpProgress = 1

      // Reusable vectors for fly movement
      const _forward = new THREE.Vector3()
      const _right = new THREE.Vector3()
      const _up = new THREE.Vector3(0, 1, 0)
      const _move = new THREE.Vector3()

      // Render loop
      function animate(): void {
        if (disposed) return
        state.animationId = requestAnimationFrame(animate)

        const time = state.clock.getElapsedTime()

        // Camera lerp
        if (lerpTarget && lerpProgress < 1) {
          lerpProgress = Math.min(lerpProgress + 0.02, 1)
          const ease = 1 - Math.pow(1 - lerpProgress, 3) // ease-out cubic
          const targetPos = lerpTarget.clone().add(new THREE.Vector3(0, 0, 15))
          camera.position.lerp(targetPos, ease * 0.05)
          controls.target.lerp(lerpTarget, ease * 0.05)
          if (lerpProgress >= 1) lerpTarget = null
        }

        // Keyboard fly: WASD translate, arrows look, QE rise/fall
        if (keysDown.size > 0) {
          camera.getWorldDirection(_forward)
          _right.crossVectors(_forward, _up).normalize()

          // Translation (WASD + QE)
          _move.set(0, 0, 0)
          if (keysDown.has('w')) _move.add(_forward)
          if (keysDown.has('s')) _move.addScaledVector(_forward, -1)
          if (keysDown.has('a')) _move.addScaledVector(_right, -1)
          if (keysDown.has('d')) _move.add(_right)
          if (keysDown.has('q') || keysDown.has('shift')) _move.y -= 1
          if (keysDown.has('e') || keysDown.has(' ')) _move.y += 1

          if (_move.lengthSq() > 0) {
            _move.normalize().multiplyScalar(FLY_SPEED)
            camera.position.add(_move)
            controls.target.add(_move)
          }

          // Look rotation (arrow keys) — rotate orbit target around camera
          const offset = controls.target.clone().sub(camera.position)
          let looked = false
          if (keysDown.has('arrowleft'))  { offset.applyAxisAngle(_up, LOOK_SPEED);  looked = true }
          if (keysDown.has('arrowright')) { offset.applyAxisAngle(_up, -LOOK_SPEED); looked = true }
          if (keysDown.has('arrowup'))   { offset.applyAxisAngle(_right, LOOK_SPEED);  looked = true }
          if (keysDown.has('arrowdown')) { offset.applyAxisAngle(_right, -LOOK_SPEED); looked = true }
          if (looked) controls.target.copy(camera.position).add(offset)
        }

        controls.update()

        // Raycasting
        raycaster.setFromCamera(mouse, camera)
        const intersects = mesh ? raycaster.intersectObject(mesh) : []

        // Reset previous hover to its rating-based color
        if (state.hoveredIndex >= 0 && state.hoveredIndex !== state.playingIndex) {
          baseColors[state.hoveredIndex].toArray(mesh!.instanceColor!.array as Float32Array, state.hoveredIndex * 3)
          mesh!.instanceColor!.needsUpdate = true
        }

        if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
          const idx = intersects[0].instanceId
          state.hoveredIndex = idx

          if (idx !== state.playingIndex) {
            COLOR_HOVERED.toArray(mesh!.instanceColor!.array as Float32Array, idx * 3)
            mesh!.instanceColor!.needsUpdate = true
          }

          // Update tooltip
          const node = nodes[idx]
          const track = tracks.find(t => t.id === node.trackId)
          if (tooltipRef.current && track) {
            const pos3d = new THREE.Vector3(node.x, node.y, node.z)
            pos3d.project(camera)
            const x = (pos3d.x * 0.5 + 0.5) * width
            const y = (-pos3d.y * 0.5 + 0.5) * height
            tooltipRef.current.style.display = 'block'
            tooltipRef.current.style.left = `${x + 12}px`
            tooltipRef.current.style.top = `${y - 12}px`
            const genre = node.c0 !== undefined ? codeNamesRef.current.get(node.c0) : undefined
            tooltipRef.current.textContent =
              `${track.title || track.file_name}${track.artist ? ' — ' + track.artist : ''}` +
              (genre ? `  ·  ${genre}` : '')
          }

          renderer.domElement.style.cursor = 'pointer'
        } else {
          state.hoveredIndex = -1
          if (tooltipRef.current) tooltipRef.current.style.display = 'none'
          renderer.domElement.style.cursor = 'grab'
        }

        // Playing track pulse
        if (state.playingIndex >= 0 && mesh) {
          const base = nodeScaleRef.current
          const pulse = base * (1.0 + 0.5 * Math.sin(time * Math.PI))
          const node = nodes[state.playingIndex]
          dummy.position.set(node.x, node.y, node.z)
          dummy.scale.set(pulse, pulse, pulse)
          dummy.updateMatrix()
          mesh.setMatrixAt(state.playingIndex, dummy.matrix)
          mesh.instanceMatrix.needsUpdate = true
          COLOR_PLAYING.toArray(mesh.instanceColor!.array as Float32Array, state.playingIndex * 3)
          mesh.instanceColor!.needsUpdate = true
        }

        composer.render()
      }

      animate()

      // Resize observer
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) return
        const { width: w, height: h } = entry.contentRect
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
        composer.setSize(w, h)
      })
      resizeObserver.observe(container)

      // Cleanup stored for disposal
      state._cleanup = () => {
        resizeObserver.disconnect()
        renderer.domElement.removeEventListener('mousemove', onMouseMove)
        renderer.domElement.removeEventListener('click', onClick)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        cancelAnimationFrame(state.animationId)
        controls.dispose()
        renderer.dispose()
        geometry.dispose()
        material.dispose()
        trajectoryGeometry.dispose()
        trajectoryMaterial.dispose()
        composer.dispose()
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }
    }

    initScene()

    return () => {
      disposed = true
      if (sceneRef.current?._cleanup) {
        sceneRef.current._cleanup()
      }
      sceneRef.current = null
    }
  }, [phase, tracks, playTrack, source])

  // Update playing track highlight when currentTrack changes
  useEffect(() => {
    const state = sceneRef.current
    if (!state?.mesh || !state.nodes.length) return

    const mesh = state.mesh
    const dummy = state.dummy
    const nodes = state.nodes

    // Reset previous playing track to its rating-based color
    if (state.playingIndex >= 0) {
      const prevNode = nodes[state.playingIndex]
      const s = nodeScaleRef.current
      dummy.position.set(prevNode.x, prevNode.y, prevNode.z)
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      mesh.setMatrixAt(state.playingIndex, dummy.matrix)
      state.baseColors[state.playingIndex].toArray(mesh.instanceColor!.array as Float32Array, state.playingIndex * 3)
    }

    // Set new playing track
    if (currentTrack) {
      const idx = state.trackIdToIndex.get(currentTrack.id)
      if (idx !== undefined) {
        state.playingIndex = idx
        COLOR_PLAYING.toArray(mesh.instanceColor!.array as Float32Array, idx * 3)
      } else {
        state.playingIndex = -1
      }
    } else {
      state.playingIndex = -1
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true

    // Update trajectory line if drifting
    if (drifting && currentTrack) {
      const s = sceneRef.current
      if (s?.trajectoryLine) {
        const nodeIdx = s.trackIdToIndex.get(currentTrack.id)
        if (nodeIdx !== undefined && s.trajectoryCount < MAX_TRAJECTORY_POINTS) {
          const node = s.nodes[nodeIdx]
          const i = s.trajectoryCount * 3
          s.trajectoryPositions[i] = node.x
          s.trajectoryPositions[i + 1] = node.y
          s.trajectoryPositions[i + 2] = node.z
          s.trajectoryCount++
          s.trajectoryLine.geometry.attributes.position.needsUpdate = true
          s.trajectoryLine.geometry.setDrawRange(0, s.trajectoryCount)
        }
      }
    }
  }, [currentTrack, drifting])

  // Camera follow. Track selection now happens in the nav registry, so this
  // view only reacts to whatever ended up playing — which also means the
  // camera follows plays driven from the main player, not just from here.
  useEffect(() => {
    if (!drifting || !currentTrack) return
    const s = sceneRef.current
    if (!s) return
    const nodeIdx = s.trackIdToIndex.get(currentTrack.id)
    if (nodeIdx === undefined) return

    const node = s.nodes[nodeIdx]
    const camera = s.camera
    const controls = s.controls
    const target = new THREE.Vector3(node.x, node.y, node.z)
    const camTarget = target.clone().add(new THREE.Vector3(0, 0, 15))
    const startPos = camera.position.clone()
    const startTarget = controls.target.clone()
    let t = 0
    const lerpInterval = setInterval(() => {
      t += 0.03
      if (t >= 1) {
        clearInterval(lerpInterval)
        t = 1
      }
      const ease = 1 - Math.pow(1 - t, 3)
      camera.position.lerpVectors(startPos, camTarget, ease)
      controls.target.lerpVectors(startTarget, target, ease)
    }, 16)
    return () => clearInterval(lerpInterval)
  }, [currentTrack, drifting])


  // Toggle a nav mode. Clicking the active one returns to linear; clicking the
  // other switches to it. The mode itself lives in the library store now — this
  // only manages the trajectory ribbon, which is this view's own decoration.
  const toggleDrift = useCallback((mode: NavModeId) => {
    const next: PlayMode = playMode === mode ? 'linear' : mode
    setPlayMode(next)

    const s = sceneRef.current
    if (next !== 'linear' && currentTrack) {
      if (s) {
        const nodeIdx = s.trackIdToIndex.get(currentTrack.id)
        if (nodeIdx !== undefined) {
          const node = s.nodes[nodeIdx]
          s.trajectoryPositions[0] = node.x
          s.trajectoryPositions[1] = node.y
          s.trajectoryPositions[2] = node.z
          s.trajectoryCount = 1
          s.trajectoryLine?.geometry.setDrawRange(0, 1)
        }
      }
    } else if (s) {
      s.trajectoryCount = 0
      s.trajectoryLine?.geometry.setDrawRange(0, 0)
    }
  }, [currentTrack, playMode, setPlayMode])

  // Navigate to a specific track — used by picker and potentially other UI
  const navigateToTrack = useCallback((trackId: string) => {
    const s = sceneRef.current
    if (!s) return

    const track = tracks.find(t => t.id === trackId)
    if (!track) return

    playTrack(track, tracks)

    // A manual jump is still a visit — the walk must not loop back onto it.
    if (drifting) useNavigationStore.getState().markVisited(trackId)

    // Camera lerp
    const nodeIdx = s.trackIdToIndex.get(trackId)
    if (nodeIdx !== undefined) {
      const node = s.nodes[nodeIdx]
      const target = new THREE.Vector3(node.x, node.y, node.z)
      const camTarget = target.clone().add(new THREE.Vector3(0, 0, 15))
      const startPos = s.camera.position.clone()
      const startTarget = s.controls.target.clone()
      let t = 0
      const lerpInterval = setInterval(() => {
        t += 0.03
        if (t >= 1) { clearInterval(lerpInterval); t = 1 }
        const ease = 1 - Math.pow(1 - t, 3)
        s.camera.position.lerpVectors(startPos, camTarget, ease)
        s.controls.target.lerpVectors(startTarget, target, ease)
      }, 16)
    }
  }, [tracks, playTrack, drifting])

  // Prefetch KNN neighbors when drifting and current track changes
  useEffect(() => {
    if (!drifting || !currentTrack) return
    const s = sceneRef.current
    if (!s?.knn) return
    const neighborIds = s.knn.neighbors.get(currentTrack.id)
    if (neighborIds && neighborIds.length > 0) {
      window.api.prefetchTracks(neighborIds.slice(0, 5)).catch(console.error)
    }
  }, [drifting, currentTrack])

  // Compute labeled neighbors when current track changes
  useEffect(() => {
    const s = sceneRef.current
    if (!s?.knn || !s.featureMap || s.featureMap.size === 0 || !currentTrack) {
      setPickerNeighbors([])
      return
    }

    const neighborIds = s.knn.neighbors.get(currentTrack.id)
    if (!neighborIds || neighborIds.length === 0) {
      setPickerNeighbors([])
      return
    }

    const labeled = labelNeighbors(currentTrack.id, neighborIds, s.featureMap, featureGroups)
    setPickerNeighbors(labeled)
  }, [currentTrack])

  // Update node scale across all instances
  useEffect(() => {
    const s = sceneRef.current
    if (!s?.mesh) return
    nodeScaleRef.current = nodeScale
    const d = s.dummy
    for (let i = 0; i < s.nodes.length; i++) {
      if (i === s.playingIndex) continue // render loop handles playing node
      d.position.set(s.nodes[i].x, s.nodes[i].y, s.nodes[i].z)
      d.scale.set(nodeScale, nodeScale, nodeScale)
      d.updateMatrix()
      s.mesh.setMatrixAt(i, d.matrix)
    }
    s.mesh.instanceMatrix.needsUpdate = true
  }, [nodeScale])

  // Update bloom strength
  useEffect(() => {
    const s = sceneRef.current
    if (!s?.bloomPass) return
    s.bloomPass.strength = bloomStrength
  }, [bloomStrength])

  // Recolor nodes in place when the color mode changes — no scene rebuild, so
  // the camera stays put.
  useEffect(() => {
    const s = sceneRef.current
    if (!s?.mesh || !s.nodes.length) return
    const hasSemantic = s.nodes.some((n) => n.c0 !== undefined)
    const mode: ColorMode = hasSemantic ? colorMode : 'rating'

    const ratingByTrack = new Map<string, number>()
    for (const t of tracks) ratingByTrack.set(t.id, t.rating ?? 0)
    const colors = computeNodeColors(s.nodes, mode, ratingByTrack)
    s.baseColors = colors

    const arr = s.mesh.instanceColor!.array as Float32Array
    for (let i = 0; i < colors.length; i++) {
      if (i === s.playingIndex || i === s.hoveredIndex) continue
      colors[i].toArray(arr, i * 3)
    }
    s.mesh.instanceColor!.needsUpdate = true

    setLegend(mode === 'semantic' ? buildLegend(s.nodes, codeNamesRef.current) : [])
  }, [colorMode, tracks, phase])

  // Focus camera on current track's neighborhood
  const focusNeighborhood = useCallback(() => {
    const s = sceneRef.current
    if (!s || !currentTrack) return

    const currentIdx = s.trackIdToIndex.get(currentTrack.id)
    if (currentIdx === undefined) return

    const currentNode = s.nodes[currentIdx]
    const neighborIds = s.knn?.neighbors.get(currentTrack.id) || []

    // Collect positions of current + neighbors
    const positions = [new THREE.Vector3(currentNode.x, currentNode.y, currentNode.z)]
    for (const nId of neighborIds) {
      const nIdx = s.trackIdToIndex.get(nId)
      if (nIdx !== undefined) {
        positions.push(new THREE.Vector3(s.nodes[nIdx].x, s.nodes[nIdx].y, s.nodes[nIdx].z))
      }
    }

    // Bounding sphere of the neighborhood
    const centroid = new THREE.Vector3()
    for (const p of positions) centroid.add(p)
    centroid.divideScalar(positions.length)

    let maxRadius = 0
    for (const p of positions) {
      const dist = p.distanceTo(centroid)
      if (dist > maxRadius) maxRadius = dist
    }

    // Frame the neighborhood with some breathing room
    const cameraDistance = Math.max(maxRadius * 2.5, 8)
    const camTarget = centroid.clone().add(new THREE.Vector3(0, 0, cameraDistance))

    const startPos = s.camera.position.clone()
    const startTarget = s.controls.target.clone()
    let t = 0
    const lerpInterval = setInterval(() => {
      t += 0.03
      if (t >= 1) { clearInterval(lerpInterval); t = 1 }
      const ease = 1 - Math.pow(1 - t, 3)
      s.camera.position.lerpVectors(startPos, camTarget, ease)
      s.controls.target.lerpVectors(startTarget, centroid, ease)
    }, 16)
  }, [currentTrack])

  // Status bar for non-ready states
  if (phase !== 'ready') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black text-white">
        {phase === 'idle' && (
          <div className="text-center space-y-4">
            <h2 className="text-xl font-light tracking-wide">Navigator</h2>
            <SourceToggle source={source} semanticCount={semanticCount} onSelect={selectSource} />
            <p className="text-sm text-gray-400">
              {source === 'clap'
                ? `${totalTracks} tracks in library, ${semanticCount} with CLAP embeddings`
                : `${totalTracks} tracks in library, ${featureCount} analyzed`}
            </p>
            <div className="flex gap-3 justify-center">
              {source === 'meyda' && (
                <button
                  onClick={startAnalysis}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm transition-colors cursor-pointer"
                >
                  {featureCount > 0 && featureCount < totalTracks ? 'Continue Analysis' : 'Analyze Library'}
                </button>
              )}
              {source === 'clap' && semanticCount === 0 && (
                <p className="text-xs text-gray-500 max-w-xs">
                  No CLAP embeddings yet. Import the vq index from Settings → Semantic index.
                </p>
              )}
              {featureCount > 0 && (
                <button
                  onClick={hasCoords ? () => setPhase('ready') : () => runProjection()}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors cursor-pointer"
                >
                  {hasCoords ? 'View Map' : `Map ${featureCount} Tracks`}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'extracting' && (
          <div className="text-center space-y-3 w-80">
            <h2 className="text-lg font-light">Extracting Audio Features</h2>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all"
                style={{ width: `${extractProgress.total > 0 ? (extractProgress.done / extractProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {extractProgress.done}/{extractProgress.total}: {extractProgress.file}
            </p>
            <button
              onClick={() => abortRef.current?.abort()}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors cursor-pointer"
            >
              Stop &amp; Map What We Have
            </button>
          </div>
        )}

        {phase === 'projecting' && (
          <div className="text-center space-y-3 w-80">
            <h2 className="text-lg font-light">Computing 3D Layout</h2>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all"
                style={{ width: `${(umapProgress.epoch / umapProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              Epoch {umapProgress.epoch}/{umapProgress.total}
            </p>
          </div>
        )}
      </div>
    )
  }

  const isPartial = featureCount > 0 && featureCount < totalTracks

  // Ready state — Three.js canvas
  return (
    <div ref={containerRef} className="flex-1 relative bg-black overflow-hidden">
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10"
        style={{ display: 'none' }}
      />
      {/* Top-left controls */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        {semanticCount > 0 && (
          <div className="flex rounded border border-gray-700 overflow-hidden">
            <button
              onClick={() => selectSource('clap')}
              title="512-dim CLAP embeddings (semantic — genre/mood)"
              className={`px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                source === 'clap' ? 'bg-cyan-600/80 text-white' : 'bg-black/70 hover:bg-black/90 text-gray-400 hover:text-white'
              }`}
            >
              CLAP
            </button>
            <button
              onClick={() => selectSource('meyda')}
              title="56-dim Meyda DSP features (timbre/loudness)"
              className={`px-3 py-1.5 text-xs transition-colors cursor-pointer border-l border-gray-700 ${
                source === 'meyda' ? 'bg-cyan-600/80 text-white' : 'bg-black/70 hover:bg-black/90 text-gray-400 hover:text-white'
              }`}
            >
              DSP
            </button>
          </div>
        )}
        <button
          onClick={() => toggleDrift('drift')}
          title="Spatial drift — walk nearest neighbors in 3D space"
          className={`px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer ${
            playMode === 'drift'
              ? 'bg-emerald-600/80 border-emerald-500 text-white'
              : 'bg-black/70 hover:bg-black/90 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          {playMode === 'drift' ? 'Drifting' : 'Drift'}
        </button>
        {source === 'clap' && (
          <button
            onClick={() => toggleDrift('journey')}
            title="Hierarchical drift — walk the Semantic ID tree (genre → subtype → texture)"
            className={`px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer ${
              playMode === 'journey'
                ? 'bg-fuchsia-600/80 border-fuchsia-500 text-white'
                : 'bg-black/70 hover:bg-black/90 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {playMode === 'journey' ? `Journey · ${lastTier ?? '…'}` : 'Journey'}
          </button>
        )}
        {currentTrack && (
          <button
            onClick={focusNeighborhood}
            className="px-3 py-1.5 text-xs rounded border bg-black/70 hover:bg-black/90 border-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Focus
          </button>
        )}
        {source === 'clap' && (
          <button
            onClick={() => setColorMode((m) => (m === 'semantic' ? 'rating' : 'semantic'))}
            title={colorMode === 'semantic' ? 'Colored by Semantic ID (genre). Click for ratings.' : 'Colored by rating. Click for Semantic IDs.'}
            className="px-3 py-1.5 text-xs rounded border bg-black/70 hover:bg-black/90 border-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {colorMode === 'semantic' ? 'Color: Genre' : 'Color: Rating'}
          </button>
        )}
      </div>
      {/* Settings toggle */}
      <button
        onClick={() => setSettingsOpen(o => !o)}
        className="absolute top-3 right-3 z-10 px-2.5 py-1.5 bg-black/70 hover:bg-black/90 text-gray-400 hover:text-white text-xs rounded border border-gray-700 transition-colors cursor-pointer"
      >
        {settingsOpen ? 'Close' : 'Layout'}
      </button>
      {/* Settings panel */}
      {settingsOpen && (
        <div className="absolute top-12 right-3 z-10 bg-black/85 border border-gray-700 rounded-lg p-4 w-56 space-y-4">
          {/* Journey coherence (semantic drift) */}
          {source === 'clap' && (
            <div>
              <label className="text-[11px] text-gray-400 uppercase tracking-wider block mb-1.5">
                Journey coherence <span className="text-gray-500 normal-case">({coherence.toFixed(2)})</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={coherence}
                onChange={(e) => setCoherence(parseFloat(e.target.value))}
                className="w-full accent-fuchsia-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                <span>Wander</span>
                <span>Stay</span>
              </div>
            </div>
          )}
          {/* Flat / Spatial toggle */}
          <div>
            <label className="text-[11px] text-gray-400 uppercase tracking-wider block mb-1.5">Projection</label>
            <div className="flex gap-1">
              <button
                onClick={() => setUmapParams(p => ({ ...p, nComponents: 2 }))}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                  umapParams.nComponents === 2
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Flat
              </button>
              <button
                onClick={() => setUmapParams(p => ({ ...p, nComponents: 3 }))}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                  umapParams.nComponents === 3
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Spatial
              </button>
            </div>
          </div>
          {/* Min Distance slider */}
          <div>
            <label className="text-[11px] text-gray-400 uppercase tracking-wider block mb-1.5">
              Dispersion <span className="text-gray-500 normal-case">({umapParams.minDist.toFixed(2)})</span>
            </label>
            <input
              type="range"
              min="0.01"
              max="1.5"
              step="0.01"
              value={umapParams.minDist}
              onChange={(e) => setUmapParams(p => ({ ...p, minDist: parseFloat(e.target.value) }))}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>Tight</span>
              <span>Spread</span>
            </div>
          </div>
          {/* Spread slider */}
          <div>
            <label className="text-[11px] text-gray-400 uppercase tracking-wider block mb-1.5">
              Spread <span className="text-gray-500 normal-case">({umapParams.spread.toFixed(1)})</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={umapParams.spread}
              onChange={(e) => setUmapParams(p => ({ ...p, spread: parseFloat(e.target.value) }))}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>Dense</span>
              <span>Sparse</span>
            </div>
          </div>
          {/* Reproject button */}
          <button
            onClick={() => { setSettingsOpen(false); runProjection(umapParams) }}
            className="w-full px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors cursor-pointer"
          >
            Reproject
          </button>
          <div className="border-t border-gray-700 pt-3 -mx-4 px-4">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-3">Visual</label>
            {/* Node Size slider */}
            <div className="mb-3">
              <label className="text-[11px] text-gray-400 block mb-1.5">
                Node Size <span className="text-gray-500">({nodeScale.toFixed(2)})</span>
              </label>
              <input
                type="range"
                min="0.05"
                max="2.0"
                step="0.05"
                value={nodeScale}
                onChange={(e) => setNodeScale(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                <span>Tiny</span>
                <span>Large</span>
              </div>
            </div>
            {/* Bloom slider */}
            <div>
              <label className="text-[11px] text-gray-400 block mb-1.5">
                Glow <span className="text-gray-500">({bloomStrength.toFixed(1)})</span>
              </label>
              <input
                type="range"
                min="0"
                max="3.0"
                step="0.1"
                value={bloomStrength}
                onChange={(e) => setBloomStrength(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                <span>None</span>
                <span>Intense</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* KNN Picker */}
      {pickerNeighbors.length > 0 && currentTrack && (
        <div className="absolute bottom-4 left-3 z-10">
          <button
            onClick={() => setPickerOpen(o => !o)}
            className={`px-2.5 py-1.5 text-xs rounded border transition-colors cursor-pointer ${
              pickerOpen
                ? 'bg-cyan-600/80 border-cyan-500 text-white'
                : 'bg-black/70 hover:bg-black/90 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            Neighbors
          </button>
          {pickerOpen && (
            <div className="absolute bottom-9 left-0 bg-black/90 border border-gray-700 rounded-lg p-3 w-64 max-h-72 overflow-y-auto backdrop-blur-sm">
              <div className="space-y-1">
                {pickerNeighbors.map(neighbor => {
                  const track = tracks.find(t => t.id === neighbor.trackId)
                  if (!track) return null
                  return (
                    <button
                      key={neighbor.trackId}
                      onClick={() => navigateToTrack(neighbor.trackId)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-colors text-left cursor-pointer group"
                    >
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${GROUP_COLORS[neighbor.group] || 'bg-gray-600 text-gray-200'}`}>
                        {neighbor.label}
                      </span>
                      <span className="text-xs text-gray-400 group-hover:text-gray-200 truncate transition-colors">
                        {track.title || track.file_name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Semantic-ID legend (CLAP + genre coloring) */}
      {legend.length > 0 && colorMode === 'semantic' && (
        <div className="absolute top-3 right-24 z-10">
          <button
            onClick={() => setLegendOpen((o) => !o)}
            className="px-2.5 py-1.5 bg-black/70 hover:bg-black/90 text-gray-400 hover:text-white text-xs rounded border border-gray-700 transition-colors cursor-pointer"
          >
            {legendOpen ? 'Hide legend' : `Genres (${legend.length})`}
          </button>
          {legendOpen && (
            <div className="absolute top-9 right-0 bg-black/85 border border-gray-700 rounded-lg p-3 w-52 max-h-[70vh] overflow-y-auto backdrop-blur-sm">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Semantic ID · c0 ({legend.length})
              </div>
              <div className="space-y-1">
                {legend.map((e) => (
                  <div key={e.code} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: e.hex, boxShadow: `0 0 6px ${e.hex}` }}
                    />
                    <span className="text-xs text-gray-300 truncate flex-1">{e.name}</span>
                    <span className="text-[10px] text-gray-500 tabular-nums">{e.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {isPartial && source === 'meyda' && (
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={() => setPhase('idle')}
            className="px-3 py-1.5 bg-black/70 hover:bg-black/90 text-gray-300 hover:text-white text-xs rounded border border-gray-700 transition-colors cursor-pointer"
          >
            {featureCount}/{totalTracks} analyzed — Continue
          </button>
        </div>
      )}
    </div>
  )
}

function SourceToggle({
  source,
  semanticCount,
  onSelect
}: {
  source: FeatureSource
  semanticCount: number
  onSelect: (s: FeatureSource) => void
}): React.JSX.Element | null {
  // Nothing to choose between until the CLAP index has been imported.
  if (semanticCount === 0) return null
  return (
    <div className="inline-flex rounded border border-gray-700 overflow-hidden text-xs">
      <button
        onClick={() => onSelect('clap')}
        className={`px-4 py-1.5 transition-colors cursor-pointer ${
          source === 'clap' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
        }`}
      >
        CLAP — semantic
      </button>
      <button
        onClick={() => onSelect('meyda')}
        className={`px-4 py-1.5 border-l border-gray-700 transition-colors cursor-pointer ${
          source === 'meyda' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
        }`}
      >
        DSP — timbre
      </button>
    </div>
  )
}
