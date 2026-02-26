import React, { useState, useCallback } from 'react'
import { useLibraryStore, Track } from '../stores/library'
import { AlbumArt } from './AlbumArt'
import { ContextMenu, ContextMenuItem } from './ContextMenu'
import { musicAdapter } from '../../../shared/adapters/music'
import type { ColumnDef } from '../../../shared/media-adapter'

const adapter = musicAdapter

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface ContextMenuState {
  x: number
  y: number
  trackId: string
}

export function TrackList(): React.JSX.Element {
  const {
    tracks, currentTrack, isPlaying, currentView,
    selectedArtist, selectedAlbum, searchQuery,
    playTrack, setView, setSearchQuery, togglePin
  } = useLibraryStore()

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent, trackId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, trackId })
  }, [])

  const title = (() => {
    if (searchQuery) return `Search: "${searchQuery}"`
    if (currentView === 'artist-detail' && selectedArtist) return selectedArtist
    if (currentView === 'album-detail' && selectedAlbum) return selectedAlbum
    if (currentView === 'albums') return 'Albums'
    return `All ${adapter.label}`
  })()

  // Filter columns: title is rendered specially (with artwork), rating has a custom renderer
  const columns = adapter.columns

  const contextTrack = contextMenu ? tracks.find(t => t.id === contextMenu.trackId) : null
  const contextMenuItems: ContextMenuItem[] = contextTrack ? [
    {
      label: contextTrack.pinned === 1 ? 'Unpin' : 'Keep Local',
      icon: contextTrack.pinned === 1 ? '\u{1F4CC}' : '\u{1F4E5}',
      onClick: () => togglePin(contextTrack.id)
    }
  ] : []

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
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`py-2 ${col.key === columns[columns.length - 1].key ? '' : 'pr-3'} font-medium ${
                      col.align === 'right' ? 'text-right' :
                      col.align === 'center' ? 'text-center' : ''
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  columns={columns}
                  isCurrentTrack={currentTrack?.id === track.id}
                  isPlaying={isPlaying && currentTrack?.id === track.id}
                  onPlay={() => playTrack(track, tracks, searchQuery ? 'search_play' : 'intentional_select')}
                  onContextMenu={handleContextMenu}
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

      {/* Context menu */}
      {contextMenu && contextMenuItems.length > 0 && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

function TrackRow({
  track, index, columns, isCurrentTrack, isPlaying, onPlay, onContextMenu
}: {
  track: Track
  index: number
  columns: ColumnDef[]
  isCurrentTrack: boolean
  isPlaying: boolean
  onPlay: () => void
  onContextMenu: (e: React.MouseEvent, trackId: string) => void
}): React.JSX.Element {
  return (
    <tr
      className={`group cursor-pointer transition-colors ${
        isCurrentTrack
          ? 'bg-bg-highlight text-accent-text'
          : 'hover:bg-bg-tertiary/50 text-text-secondary'
      }`}
      onDoubleClick={onPlay}
      onContextMenu={(e) => onContextMenu(e, track.id)}
    >
      {columns.map(col => (
        <td
          key={col.key}
          className={`py-2 ${col.key === columns[columns.length - 1].key ? 'w-12' : 'pr-3'} ${
            col.align === 'right' ? 'text-right text-text-muted' :
            col.align === 'center' ? 'text-center' :
            col.key === 'title' ? 'overflow-hidden' : 'truncate'
          }`}
        >
          <CellContent
            col={col}
            track={track}
            index={index}
            isCurrentTrack={isCurrentTrack}
            isPlaying={isPlaying}
            onPlay={onPlay}
          />
        </td>
      ))}
    </tr>
  )
}

function CellContent({
  col, track, index, isCurrentTrack, isPlaying, onPlay
}: {
  col: ColumnDef
  track: Track
  index: number
  isCurrentTrack: boolean
  isPlaying: boolean
  onPlay: () => void
}): React.JSX.Element {
  const value = (track as Record<string, unknown>)[col.key]

  // Special renderers for known column types
  if (col.key === 'track_number') {
    return (
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
    )
  }

  if (col.key === 'title') {
    return (
      <div className="flex items-center gap-3">
        <AlbumArt artworkPath={track.artwork_path} size={36} />
        <span className={`truncate ${isCurrentTrack ? 'text-accent-text font-medium' : 'text-text-primary'}`}>
          {(value as string) || track.file_name}
        </span>
        {track.pinned === 1 && (
          <span className="text-text-faint text-[10px] shrink-0" title="Pinned (kept local)">
            &#x1F4CC;
          </span>
        )}
      </div>
    )
  }

  if (col.key === 'rating') {
    return (
      <div className="flex flex-col items-end">
        {(track.inferred_rating ?? 0) > 0 && (
          <span className="text-[9px] text-text-faint opacity-50 leading-none" title="Predicted rating">
            ~{track.inferred_rating?.toFixed(1)}
          </span>
        )}
        <StarRatingInline trackId={track.id} rating={track.rating} />
      </div>
    )
  }

  if (col.key === 'play_count') {
    const count = value as number
    return <>{count > 0 ? count : ''}</>
  }

  // Use custom formatter if provided
  if (col.format) {
    return <>{col.format(value)}</>
  }

  // Default: render as string
  return <>{(value as string) || (col.key === 'artist' || col.key === 'album' ? 'Unknown' : '')}</>
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
  const { albums, tracks, selectAlbum, togglePin } = useLibraryStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; album: string; artist?: string } | null>(null)

  const handleAlbumContext = useCallback((e: React.MouseEvent, album: string, artist?: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, album, artist })
  }, [])

  const pinAllAlbumTracks = useCallback(async () => {
    if (!contextMenu) return
    const albumTracks = tracks.filter(t =>
      t.album === contextMenu.album &&
      (contextMenu.artist ? (t.artist === contextMenu.artist || t.album_artist === contextMenu.artist) : true)
    )
    for (const track of albumTracks) {
      if (track.pinned !== 1) {
        await togglePin(track.id)
      }
    }
  }, [contextMenu, tracks, togglePin])

  const albumMenuItems: ContextMenuItem[] = contextMenu ? [
    {
      label: 'Keep All Local',
      icon: '\u{1F4E5}',
      onClick: pinAllAlbumTracks
    }
  ] : []

  return (
    <div className="flex-1 overflow-y-auto px-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5 pb-6">
        {albums.map(album => (
          <button
            key={`${album.album}-${album.album_artist || album.artist}`}
            onClick={() => selectAlbum(album.album, album.artist || album.album_artist || undefined)}
            onContextMenu={(e) => handleAlbumContext(e, album.album, album.artist || album.album_artist || undefined)}
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
      {contextMenu && albumMenuItems.length > 0 && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={albumMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
