import { useLibraryStore } from '../stores/library'
import { ThemePicker } from './ThemePicker'

export function Sidebar(): React.JSX.Element {
  const {
    artists, albumArtists, currentView, artistViewMode, selectedArtist, stats,
    setView, setArtistViewMode, selectArtist, selectFolder, isScanning, scanProgress
  } = useLibraryStore()

  const displayedArtists = artistViewMode === 'album' ? albumArtists : artists

  return (
    <div className="w-56 bg-bg-secondary border-r border-border-primary flex flex-col h-full">
      {/* Drag region for macOS */}
      <div className="h-10 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Navigation */}
      <nav className="px-3 mb-4">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-2 mb-1">Library</p>
        <button
          onClick={() => setView('all-tracks')}
          className={`w-full text-left px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
            currentView === 'all-tracks'
              ? 'bg-bg-hover/60 text-text-primary'
              : 'text-text-faint hover:text-text-primary hover:bg-bg-tertiary/60'
          }`}
        >
          All Tracks
        </button>
        <button
          onClick={() => setView('albums')}
          className={`w-full text-left px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
            currentView === 'albums' || currentView === 'album-detail'
              ? 'bg-bg-hover/60 text-text-primary'
              : 'text-text-faint hover:text-text-primary hover:bg-bg-tertiary/60'
          }`}
        >
          Albums
        </button>
      </nav>

      {/* Artists */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex items-center gap-1 px-2 mb-1">
          <button
            onClick={() => setArtistViewMode('album')}
            className={`text-[11px] font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
              artistViewMode === 'album' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Album Artists
          </button>
          <span className="text-[11px] text-text-muted">/</span>
          <button
            onClick={() => setArtistViewMode('track')}
            className={`text-[11px] font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
              artistViewMode === 'track' ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Track Artists
          </button>
        </div>
        <div className="space-y-0.5">
          {displayedArtists.map(a => (
            <button
              key={a.artist}
              onClick={() => selectArtist(a.artist)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm cursor-pointer transition-colors truncate ${
                selectedArtist === a.artist
                  ? 'bg-bg-hover/60 text-text-primary'
                  : 'text-text-faint hover:text-text-primary hover:bg-bg-tertiary/60'
              }`}
              title={`${a.artist} (${a.track_count} tracks)`}
            >
              {a.artist}
            </button>
          ))}
        </div>
      </div>

      {/* Theme Picker */}
      <ThemePicker />

      {/* Bottom section */}
      <div className="p-3 border-t border-border-primary space-y-2">
        {stats && (
          <div className="text-[11px] text-text-muted px-2">
            {stats.total_tracks} tracks &middot; {stats.total_artists} artists
          </div>
        )}
        <button
          onClick={selectFolder}
          disabled={isScanning}
          className="w-full px-3 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded text-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          {isScanning
            ? `Scanning... ${scanProgress?.current || 0}/${scanProgress?.total || '?'}`
            : 'Add Music Folder'}
        </button>
      </div>
    </div>
  )
}
