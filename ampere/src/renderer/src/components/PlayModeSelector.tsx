import { useEffect } from 'react'
import { useLibraryStore } from '../stores/library'
import { useNavigationStore } from '../stores/navigation'
import { NAV_MODES, PlayMode } from '../riemann/modes'
import { useCapabilityStore } from '../stores/capabilities'

/**
 * Play-mode selector: queue orders plus the graph-walking nav modes.
 *
 * Lives in PlayerBar, which renders outside the view switch in App.tsx, so the
 * modes are reachable from every surface — track list, Riemann, demoscene.
 * The separate shuffle button stays as a quick override to 'random'.
 */
const QUEUE_ORDERS: { id: PlayMode; label: string; description: string }[] = [
  { id: 'linear', label: 'In order', description: 'Play the queue top to bottom.' },
  { id: 'random', label: 'Random', description: 'Shuffled permutation of the queue.' }
]

export function PlayModeSelector(): React.JSX.Element {
  const playMode = useLibraryStore(s => s.playMode)
  const setPlayMode = useLibraryStore(s => s.setPlayMode)
  const isLoading = useNavigationStore(s => s.isLoading)
  const semanticTracks = useCapabilityStore(s => s.semanticTracks)
  const featureTracks = useCapabilityStore(s => s.featureTracks)
  const refreshCapabilities = useCapabilityStore(s => s.refresh)
  const capabilitiesLoaded = useCapabilityStore(s => s.loaded)

  useEffect(() => {
    if (!capabilitiesLoaded) void refreshCapabilities()
  }, [capabilitiesLoaded, refreshCapabilities])

  // Availability is decided by what the library holds, not by whether a graph
  // happens to be loaded yet — so the list does not change under the cursor.
  const canNavigate = semanticTracks > 0 || featureTracks > 0
  const canJourney = semanticTracks > 0
  const missingReason = (id: PlayMode): string | null => {
    if (id === 'journey' && !canJourney) return 'needs the vq semantic index'
    if (!canNavigate) return 'needs audio analysis'
    return null
  }

  const navOptions = Object.values(NAV_MODES).map(mode => {
    const missing = missingReason(mode.id as PlayMode)
    return {
      id: mode.id as PlayMode,
      label: mode.label,
      description: missing ? `${mode.description} Unavailable — ${missing}.` : mode.description,
      available: missing === null,
      missing
    }
  })

  const options = [
    ...QUEUE_ORDERS.map(o => ({ ...o, available: true, missing: null as string | null })),
    ...navOptions
  ]
  const active = options.find(o => o.id === playMode)

  return (
    <select
      value={playMode}
      onChange={(e) => setPlayMode(e.target.value as PlayMode)}
      title={active ? active.description : 'Playback order'}
      aria-label="Play mode"
      className="bg-transparent text-xs text-text-faint hover:text-text-primary border border-white/10 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:border-white/30"
    >
      {options.map(o => (
        <option key={o.id} value={o.id} disabled={!o.available} className="bg-bg-primary text-text-primary">
          {o.label}{'missing' in o && o.missing ? ` — ${o.missing}` : ''}
        </option>
      ))}
      {isLoading && <option disabled className="bg-bg-primary">loading map…</option>}
    </select>
  )
}
