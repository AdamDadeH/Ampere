import React from 'react'
import { useLibraryStore, Track } from '../stores/library'
import { AlbumArt } from './AlbumArt'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TrackList(): React.JSX.Element {
  const {
    tracks, currentTrack, isPlaying, currentView,
    selectedArtist, selectedAlbum, searchQuery,
    playTrack, setView, setSearchQuery
  } = useLibraryStore()

  const title = (() => {
    if (searchQuery) return `Search: "${searchQuery}"`
    if (currentView === 'artist-detail' && selectedArtist) return selectedArtist
    if (currentView === 'album-detail' && selectedAlbum) return selectedAlbum
    if (currentView === 'albums') return 'Albums'
    return 'All Tracks'
  })()

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header with drag region */}
      <div
        className="flex items-end gap-4 px-6 pb-4 pt-10 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-3">
            {currentView !== 'all-tracks' && currentView !== 'albums' && (
              <button
                onClick={() => setView('all-tracks')}
                className="text-text-faint hover:text-text-primary text-sm cursor-pointer"
              >
                &larr; Back
              </button>
            )}
          </div>
          <h2 className="text-2xl font-bold text-text-primary" style={{ textShadow: 'var(--effect-text-shadow)' }}>{title}</h2>
          <p className="text-sm text-text-faint mt-1">{tracks.length} tracks</p>
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 bg-bg-tertiary border border-border-secondary rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-border-focus w-48"
          />
        </div>
      </div>

      {/* Album view */}
      {currentView === 'albums' ? (
        <AlbumGrid />
      ) : (
        /* Track table */
        <div className="flex-1 overflow-auto px-6">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="sticky top-0 bg-bg-primary z-10">
              <tr className="text-text-muted text-left border-b border-border-primary">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Title</th>
                <th className="py-2 pr-3 font-medium">Artist</th>
                <th className="py-2 pr-3 font-medium">Album</th>
                <th className="py-2 pr-3 font-medium text-right">Time</th>
                <th className="py-2 pr-3 font-medium text-center">Rating</th>
                <th className="py-2 font-medium text-right">Plays</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  isCurrentTrack={currentTrack?.id === track.id}
                  isPlaying={isPlaying && currentTrack?.id === track.id}
                  onPlay={() => playTrack(track, tracks)}
                />
              ))}
            </tbody>
          </table>
          {tracks.length === 0 && (
            <div className="text-center text-text-muted py-20">
              No tracks found
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TrackRow({
  track, index, isCurrentTrack, isPlaying, onPlay
}: {
  track: Track
  index: number
  isCurrentTrack: boolean
  isPlaying: boolean
  onPlay: () => void
}): React.JSX.Element {
  return (
    <tr
      className={`group cursor-pointer transition-colors ${
        isCurrentTrack
          ? 'bg-bg-highlight text-accent-text'
          : 'hover:bg-bg-tertiary/50 text-text-secondary'
      }`}
      onDoubleClick={onPlay}
    >
      <td className="py-2 pr-3">
        <div className="relative w-6 h-6 flex items-center justify-center">
          <span className="group-hover:hidden text-text-muted text-xs">
            {isCurrentTrack && isPlaying ? (
              <span className="text-accent-text text-xs">&#9654;</span>
            ) : (
              index + 1
            )}
          </span>
          <button
            className="hidden group-hover:flex items-center justify-center text-text-primary cursor-pointer"
            onClick={onPlay}
          >
            &#9654;
          </button>
        </div>
      </td>
      <td className="py-2 pr-3 overflow-hidden">
        <div className="flex items-center gap-3">
          <AlbumArt artworkPath={track.artwork_path} size={36} />
          <span className={`truncate ${isCurrentTrack ? 'text-accent-text font-medium' : 'text-text-primary'}`}>
            {track.title || track.file_name}
          </span>
        </div>
      </td>
      <td className="py-2 pr-3 truncate">{track.artist || 'Unknown'}</td>
      <td className="py-2 pr-3 truncate">{track.album || 'Unknown'}</td>
      <td className="py-2 pr-3 text-right text-text-muted">{formatDuration(track.duration)}</td>
      <td className="py-2 pr-3 text-center">
        <StarRatingInline trackId={track.id} rating={track.rating} />
      </td>
      <td className="py-2 w-12 text-right text-text-muted">{track.play_count > 0 ? track.play_count : ''}</td>
    </tr>
  )
}

function StarRatingInline({ trackId, rating }: { trackId: string; rating: number }): React.JSX.Element {
  const setRating = useLibraryStore(s => s.setRating)
  const [hovered, setHovered] = React.useState(0)

  const handleClick = (star: number, e: React.MouseEvent): void => {
    e.stopPropagation()
    setRating(trackId, star === rating ? 0 : star)
  }

  return (
    <div
      className="inline-flex gap-px"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          className="cursor-pointer text-xs leading-none p-0 border-0 bg-transparent"
          onMouseEnter={() => setHovered(star)}
          onClick={(e) => handleClick(star, e)}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{
            color: hovered
              ? star <= hovered ? 'var(--color-star-hover)' : 'var(--color-star-empty)'
              : star <= rating ? 'var(--color-star-filled)' : 'var(--color-star-empty)'
          }}
        >
          &#9733;
        </button>
      ))}
    </div>
  )
}

function AlbumGrid(): React.JSX.Element {
  const { albums, selectAlbum } = useLibraryStore()

  return (
    <div className="flex-1 overflow-y-auto px-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5 pb-6">
        {albums.map(album => (
          <button
            key={`${album.album}-${album.album_artist || album.artist}`}
            onClick={() => selectAlbum(album.album, album.artist || album.album_artist || undefined)}
            className="text-left group cursor-pointer"
          >
            <AlbumArt
              artworkPath={album.artwork_path}
              size={180}
              className="w-full aspect-square shadow-lg group-hover:shadow-xl transition-shadow"
            />
            <p className="text-sm text-text-primary mt-2 truncate font-medium">{album.album}</p>
            <p className="text-xs text-text-faint truncate">
              {album.album_artist || album.artist || 'Unknown'} &middot; {album.year || ''}
            </p>
          </button>
        ))}
      </div>
      {albums.length === 0 && (
        <div className="text-center text-text-muted py-20">No albums found</div>
      )}
    </div>
  )
}
