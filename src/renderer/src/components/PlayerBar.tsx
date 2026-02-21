import { useCallback } from 'react'
import { useLibraryStore } from '../stores/library'
import { AlbumArt } from './AlbumArt'
import { StarRating } from './StarRating'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function PlayerBar(): React.JSX.Element {
  const {
    currentTrack, isPlaying, volume, queue, queueIndex,
    currentTime, duration, shuffle, repeatMode,
    togglePlayPause, nextTrack, prevTrack, setVolume, seekTo, setRating,
    toggleShuffle, cycleRepeat, lovingThis, likeNotNow, notFeelingIt
  } = useLibraryStore()

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    seekTo(pct * duration)
  }, [duration, seekTo])

  const handleCompactMode = useCallback(() => {
    window.api.setWindowMode('compact')
  }, [])

  if (!currentTrack) {
    return (
      <div className="h-20 bg-bg-secondary border-t border-border-primary flex items-center justify-center"
        style={{ boxShadow: 'var(--effect-shadow-glow)' }}
      >
        <span className="text-text-muted text-sm">No track selected</span>
      </div>
    )
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="h-20 bg-bg-secondary border-t border-border-primary flex items-center px-4 gap-4"
      style={{ boxShadow: 'var(--effect-shadow-glow)' }}
    >
      {/* Track info */}
      <div className="flex items-center gap-3 w-72 min-w-0">
        <AlbumArt artworkPath={currentTrack.artwork_path} size={48} />
        <div className="min-w-0">
          <p className="text-sm text-text-primary font-medium truncate">
            {currentTrack.title || currentTrack.file_name}
          </p>
          <p className="text-xs text-text-faint truncate">{currentTrack.artist || 'Unknown'}</p>
        </div>
        <StarRating
          rating={currentTrack.rating}
          onChange={(r) => setRating(currentTrack.id, r)}
          size="md"
        />
      </div>

      {/* Controls — unified transport + feedback strip */}
      <div className="flex-1 flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleShuffle}
            className={`transition-colors cursor-pointer ${shuffle ? 'text-[#ffaa00]' : 'text-text-faint hover:text-text-primary'}`}
            title="Shuffle"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
            </svg>
          </button>
          {/* Negative — thumbs down + skip */}
          <button
            onClick={notFeelingIt}
            className="text-text-faint hover:text-red-400 transition-colors cursor-pointer"
            title="Not feeling it (skip)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
            </svg>
          </button>
          <button
            onClick={prevTrack}
            className="text-text-faint hover:text-text-primary transition-colors cursor-pointer"
            disabled={queueIndex <= 0}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
          <button
            onClick={togglePlayPause}
            className="w-9 h-9 rounded-full bg-play-button-bg text-play-button-fg flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
            style={{ boxShadow: 'var(--effect-shadow-glow)' }}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => nextTrack('manual_skip')}
            className="text-text-faint hover:text-text-primary transition-colors cursor-pointer"
            disabled={queueIndex >= queue.length - 1}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="m6 18 8.5-6L6 6v12zm2 0h2V6h-2v12z" transform="scale(-1,1) translate(-24,0)" />
            </svg>
          </button>
          {/* Positive — heart+skip, then heart (stay) */}
          <button
            onClick={likeNotNow}
            className="text-text-faint hover:text-amber-400 transition-colors cursor-pointer"
            title="Like, not now (skip)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 1.5-.5 2.87-1.35 4h-2.9c1.25-1.1 2.25-2.4 2.25-4 0-2.22-1.78-3.5-3.5-3.5-1.17 0-2.28.63-3 1.57-.72-.94-1.83-1.57-3-1.57C5.78 5 4 6.28 4 8.5c0 3.08 3.08 5.74 8 10.18l.35-.32" />
              <path d="M17 13l4 4M17 17l4-4" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={lovingThis}
            className="text-text-faint hover:text-green-400 transition-colors cursor-pointer"
            title="Loving this"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
          <button
            onClick={cycleRepeat}
            className={`transition-colors cursor-pointer relative ${repeatMode !== 'off' ? 'text-[#ffaa00]' : 'text-text-faint hover:text-text-primary'}`}
            title={`Repeat: ${repeatMode}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
            </svg>
            {repeatMode === 'one' && (
              <span className="absolute -top-1 -right-1 text-[8px] font-bold">1</span>
            )}
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 w-full max-w-xl">
          <span className="text-[11px] text-text-faint w-10 text-right">{formatDuration(currentTime)}</span>
          <div
            className="flex-1 h-1 bg-bg-hover rounded-full cursor-pointer group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-progress-bar group-hover:bg-progress-hover rounded-full transition-colors relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-progress-bar rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <span className="text-[11px] text-text-faint w-10">{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Volume + Compact toggle */}
      <div className="flex items-center gap-2 w-44">
        <svg className="w-4 h-4 text-text-faint" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          className="w-full"
          style={{ accentColor: 'var(--color-progress-bar)' }}
        />
        <button
          onClick={handleCompactMode}
          className="text-text-faint hover:text-text-primary transition-colors cursor-pointer ml-1"
          title="Compact mode (Winamp)"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" transform="rotate(45 12 12)" />
            <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="6" y="8" width="12" height="2" fill="currentColor" />
            <rect x="6" y="11" width="12" height="2" fill="currentColor" />
            <rect x="6" y="14" width="12" height="2" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  )
}
