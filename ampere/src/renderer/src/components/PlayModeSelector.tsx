import { useLibraryStore } from '../stores/library'
import { useNavigationStore } from '../stores/navigation'
import { NAV_MODES, PlayMode } from '../riemann/modes'

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
  const navData = useNavigationStore(s => s.data)
  const isLoading = useNavigationStore(s => s.isLoading)

  const navOptions = Object.values(NAV_MODES).map(mode => ({
    id: mode.id as PlayMode,
    label: mode.label,
    description: mode.description,
    // Until the graph loads we can't know what's available, so offer both
    // rather than hiding modes that would in fact work once loaded.
    available: navData ? mode.isAvailable(navData) : true
  }))

  const options = [
    ...QUEUE_ORDERS.map(o => ({ ...o, available: true })),
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
          {o.label}{!o.available ? ' (unavailable)' : ''}
        </option>
      ))}
      {isLoading && <option disabled className="bg-bg-primary">loading map…</option>}
    </select>
  )
}
