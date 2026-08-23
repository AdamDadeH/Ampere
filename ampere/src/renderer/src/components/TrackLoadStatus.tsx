import { useLibraryStore } from '../stores/library'

/**
 * Shows when the current track is being fetched from cloud storage.
 *
 * `downloadingTrackId` was already tracked in the store but never rendered,
 * so a track materializing from Proton Drive looked like the player had
 * simply stalled.
 */
export function TrackLoadStatus(): React.JSX.Element | null {
  const downloadingTrackId = useLibraryStore(s => s.downloadingTrackId)
  if (!downloadingTrackId) return null

  return (
    <span
      className="flex items-center gap-1.5 text-[11px] text-text-faint"
      title="Downloading this track from cloud storage"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#00ccff] animate-pulse" />
      fetching…
    </span>
  )
}
