interface AlbumArtProps {
  artworkPath: string | null
  size?: number
  className?: string
}

export function AlbumArt({ artworkPath, size = 48, className = '' }: AlbumArtProps): React.JSX.Element {
  if (artworkPath) {
    return (
      <img
        src={`atom://${artworkPath}`}
        alt="Album Art"
        width={size}
        height={size}
        className={`rounded object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`rounded bg-bg-tertiary flex items-center justify-center text-text-muted ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    </div>
  )
}
