import { useLibraryStore } from '../stores/library'
import { useNavigationStore } from '../stores/navigation'
import { isNavMode } from '../riemann/modes'
import { evidenceWeight } from '../riemann/session-affinity'

/**
 * Readout for the active navigation mode.
 *
 * Two jobs: say when the graph is still loading — that is the multi-second
 * wait, and without it a nav mode looks broken rather than busy — and show
 * how much the session is actually steering, so the blend is visible instead
 * of being something you have to take on faith.
 *
 * Per-step scoring is deliberately not surfaced. It runs synchronously on the
 * main thread, so nothing could repaint while it happens; an indicator there
 * would be decoration, not information.
 */
export function NavStatus(): React.JSX.Element | null {
  const playMode = useLibraryStore(s => s.playMode)
  const isLoading = useNavigationStore(s => s.isLoading)
  const data = useNavigationStore(s => s.data)
  const signals = useNavigationStore(s => s.signals)
  const lastTier = useNavigationStore(s => s.lastTier)

  if (!isNavMode(playMode)) return null

  if (isLoading) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-text-faint" title="Loading the audio-feature map — one-time cost per session">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ffaa00] animate-pulse" />
        building map…
      </span>
    )
  }

  if (!data) {
    return (
      <span className="text-[11px] text-red-400/80" title="The navigation graph could not be loaded; playback falls back to queue order">
        map unavailable
      </span>
    )
  }

  if (playMode === 'session') {
    const beta = evidenceWeight(signals.length)
    const positive = signals.filter(s => s.strength > 0).length
    return (
      <span
        className="flex items-center gap-1.5 text-[11px] text-text-faint"
        title={`${signals.length} signal${signals.length === 1 ? '' : 's'} this session (${positive} positive). Session steers ${Math.round(beta * 100)}%, overall taste ${Math.round((1 - beta) * 100)}%.`}
      >
        {/* Fill shows how much the session has taken over from the global model. */}
        <span className="relative w-8 h-1 rounded-full bg-white/10 overflow-hidden">
          <span
            className="absolute inset-y-0 left-0 bg-[#ffaa00] transition-[width] duration-500"
            style={{ width: `${Math.round(beta * 100)}%` }}
          />
        </span>
        {signals.length === 0 ? 'learning…' : `${signals.length} signal${signals.length === 1 ? '' : 's'}`}
      </span>
    )
  }

  if (playMode === 'journey' && lastTier) {
    return (
      <span className="text-[11px] text-text-faint" title="Semantic tier the last journey step moved along">
        {lastTier}
      </span>
    )
  }

  return null
}
