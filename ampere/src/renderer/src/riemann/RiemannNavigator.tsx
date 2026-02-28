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
import { computeKNNFromCoords, createDriftState, driftNext, labelNeighbors, KNNGraph, DriftState, LabeledNeighbor } from './navigation'
import { musicAdapter } from '../../../shared/adapters/music'

type Phase = 'idle' | 'extracting' | 'projecting' | 'ready'

const COLOR_DEFAULT = new THREE.Color(0x00ccff)
const COLOR_RATED_HIGH = new THREE.Color(0x00ff88) // 4-5 stars
const COLOR_RATED_LOW = new THREE.Color(0xff4466)  // 1-2 stars
const COLOR_PLAYING = new THREE.Color(0xffffff)
const COLOR_HOVERED = new THREE.Color(0xff8800)
const COLOR_TRAIL = new THREE.Color(0x00ffaa)
const SCALE_RANGE = 50

function getBaseColor(rating: number): THREE.Color {
  if (rating >= 4) return COLOR_RATED_HIGH
  if (rating >= 1 && rating <= 2) return COLOR_RATED_LOW
  return COLOR_DEFAULT
}
const KNN_K = 8
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

interface TrackNode {
  trackId: string
  x: number
  y: number
  z: number
}

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

  const { currentTrack, tracks, playTrack, setDriftNext } = useLibraryStore()

  const [hasCoords, setHasCoords] = useState(false)
  const [umapParams, setUmapParams] = useState<UMAPParams>({ ...DEFAULT_UMAP_PARAMS })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [drifting, setDrifting] = useState(false)
  const driftStateRef = useRef<DriftState | null>(null)
  const [pickerNeighbors, setPickerNeighbors] = useState<LabeledNeighbor[]>([])
  const [pickerOpen, setPickerOpen] = useState(true)
  const [nodeScale, setNodeScale] = useState(0.4)
  const [bloomStrength, setBloomStrength] = useState(0.8)
  const nodeScaleRef = useRef(0.4)

  // Check initial state on mount
  useEffect(() => {
    let cancelled = false
    async function check(): Promise<void> {
      const [count, stats] = await Promise.all([
        window.api.getFeatureCount(),
        window.api.getLibraryStats()
      ])
      if (cancelled) return
      const total = (stats as { total_tracks: number }).total_tracks
      setFeatureCount(count)
      setTotalTracks(total)

      // If any coords exist, we can show a map
      if (count > 0) {
        const withCoords = await window.api.getTrackFeaturesWithCoords()
        if (!cancelled && withCoords.length > 0) {
          setHasCoords(true)
          setPhase('ready')
        }
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  // Run UMAP on whatever features exist and show the map
  const runProjection = useCallback(async (params?: UMAPParams) => {
    setPhase('projecting')
    const allFeatures = await window.api.getTrackFeatures()
    if (allFeatures.length === 0) {
      setPhase('idle')
      return
    }
    await projectToUMAP(allFeatures, (epoch, totalEpochs) => {
      setUmapProgress({ epoch, total: totalEpochs })
    }, params || umapParams)
    setFeatureCount(allFeatures.length)
    setHasCoords(true)
    setPhase('ready')
  }, [umapParams])

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

      // Load data
      const [coordData, allFeatures] = await Promise.all([
        window.api.getTrackFeaturesWithCoords(),
        window.api.getTrackFeatures()
      ])
      if (disposed || coordData.length === 0) return

      // Build feature map for KNN labeling
      const featureMap = new Map<string, number[]>()
      for (const f of allFeatures) {
        featureMap.set(f.track_id, JSON.parse(f.features_json) as number[])
      }

      // Normalize coords to ±SCALE_RANGE
      let minX = Infinity, maxX = -Infinity
      let minY = Infinity, maxY = -Infinity
      let minZ = Infinity, maxZ = -Infinity
      for (const d of coordData) {
        if (d.umap_x < minX) minX = d.umap_x
        if (d.umap_x > maxX) maxX = d.umap_x
        if (d.umap_y < minY) minY = d.umap_y
        if (d.umap_y > maxY) maxY = d.umap_y
        if (d.umap_z < minZ) minZ = d.umap_z
        if (d.umap_z > maxZ) maxZ = d.umap_z
      }
      const rangeX = maxX - minX || 1
      const rangeY = maxY - minY || 1
      const rangeZ = maxZ - minZ || 1

      const nodes: TrackNode[] = coordData.map(d => ({
        trackId: d.track_id,
        x: ((d.umap_x - minX) / rangeX - 0.5) * SCALE_RANGE * 2,
        y: ((d.umap_y - minY) / rangeY - 0.5) * SCALE_RANGE * 2,
        z: ((d.umap_z - minZ) / rangeZ - 0.5) * SCALE_RANGE * 2
      }))

      const trackIdToIndex = new Map<string, number>()
      nodes.forEach((n, i) => trackIdToIndex.set(n.trackId, i))

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

      // Pre-compute base color per node from track rating
      const baseColors: THREE.Color[] = nodes.map(n => {
        const track = tracks.find(t => t.id === n.trackId)
        return getBaseColor(track?.rating ?? 0)
      })

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

      // Compute KNN graph from UMAP coordinates — neighbors are visually local
      const knn: KNNGraph = nodes.length >= 2
        ? computeKNNFromCoords(nodes, KNN_K)
        : { neighbors: new Map() }

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
            tooltipRef.current.textContent = `${track.title || track.file_name}${track.artist ? ' — ' + track.artist : ''}`
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
  }, [phase, tracks, playTrack])

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
    if (drifting && driftStateRef.current && currentTrack) {
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

  // Drift mode: set/clear the store override
  useEffect(() => {
    if (!drifting) {
      setDriftNext(null)
      return
    }

    const driftFn = (): void => {
      const s = sceneRef.current
      if (!s?.knn || !currentTrack) return

      if (!driftStateRef.current) {
        driftStateRef.current = createDriftState(currentTrack.id)
      }

      const nextId = driftNext(driftStateRef.current, s.knn, currentTrack.id)
      if (!nextId) return

      const track = tracks.find(t => t.id === nextId)
      if (track) {
        playTrack(track, tracks, 'drift')
        // Camera follows
        const nodeIdx = s.trackIdToIndex.get(nextId)
        if (nodeIdx !== undefined) {
          const node = s.nodes[nodeIdx]
          // Trigger lerp by updating camera target (handled in render loop)
          const camera = s.camera
          const controls = s.controls
          const target = new THREE.Vector3(node.x, node.y, node.z)
          const camTarget = target.clone().add(new THREE.Vector3(0, 0, 15))
          // Smooth transition over next frames
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
        }
      }
    }

    setDriftNext(driftFn)
    return () => setDriftNext(null)
  }, [drifting, currentTrack, tracks, playTrack, setDriftNext])

  // Initialize drift state when drift mode is turned on
  const toggleDrift = useCallback(() => {
    setDrifting(prev => {
      if (!prev && currentTrack) {
        // Starting drift — init state and seed trajectory
        driftStateRef.current = createDriftState(currentTrack.id)
        const s = sceneRef.current
        if (s) {
          // Reset trajectory line
          const nodeIdx = s.trackIdToIndex.get(currentTrack.id)
          if (nodeIdx !== undefined) {
            const node = s.nodes[nodeIdx]
            s.trajectoryPositions[0] = node.x
            s.trajectoryPositions[1] = node.y
            s.trajectoryPositions[2] = node.z
            s.trajectoryCount = 1
            s.trajectoryLine?.geometry.attributes.position.needsUpdate
            s.trajectoryLine?.geometry.setDrawRange(0, 1)
          }
        }
      } else {
        // Stopping drift — clear trajectory
        driftStateRef.current = null
        const s = sceneRef.current
        if (s) {
          s.trajectoryCount = 0
          s.trajectoryLine?.geometry.setDrawRange(0, 0)
        }
      }
      return !prev
    })
  }, [currentTrack])

  // Navigate to a specific track — used by picker and potentially other UI
  const navigateToTrack = useCallback((trackId: string) => {
    const s = sceneRef.current
    if (!s) return

    const track = tracks.find(t => t.id === trackId)
    if (!track) return

    playTrack(track, tracks)

    // Update drift state if drifting
    if (drifting && driftStateRef.current) {
      driftStateRef.current.visited.add(trackId)
      driftStateRef.current.trajectory.push(trackId)
    }

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
            <p className="text-sm text-gray-400">
              {totalTracks} tracks in library, {featureCount} analyzed
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={startAnalysis}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm transition-colors cursor-pointer"
              >
                {featureCount > 0 && featureCount < totalTracks ? 'Continue Analysis' : 'Analyze Library'}
              </button>
              {featureCount > 0 && (
                <button
                  onClick={hasCoords ? () => setPhase('ready') : runProjection}
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
        <button
          onClick={toggleDrift}
          className={`px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer ${
            drifting
              ? 'bg-emerald-600/80 border-emerald-500 text-white'
              : 'bg-black/70 hover:bg-black/90 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          {drifting ? 'Drifting' : 'Drift'}
        </button>
        {currentTrack && (
          <button
            onClick={focusNeighborhood}
            className="px-3 py-1.5 text-xs rounded border bg-black/70 hover:bg-black/90 border-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Focus
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
      {isPartial && (
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
