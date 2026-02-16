import { useLibraryStore } from '../stores/library'

export function SetupView(): React.JSX.Element {
  const { selectFolder, scanProgress, isScanning } = useLibraryStore()

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">
          <svg className="w-24 h-24 mx-auto text-accent" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-2" style={{ textShadow: 'var(--effect-text-shadow)' }}>ProtonMusic</h1>
        <p className="text-text-faint text-lg">Select a folder to start building your library</p>
      </div>

      {isScanning && scanProgress ? (
        <div className="w-80 text-center">
          <div className="mb-3">
            <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{
                  width: scanProgress.total > 0
                    ? `${(scanProgress.current / scanProgress.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
          <p className="text-sm text-text-faint">
            {scanProgress.phase === 'discovering' && `Discovering files... (${scanProgress.current} found)`}
            {scanProgress.phase === 'scanning' && `Scanning ${scanProgress.current} of ${scanProgress.total}`}
            {scanProgress.phase === 'complete' && 'Scan complete!'}
            {scanProgress.phase === 'error' && `Error: ${scanProgress.error}`}
          </p>
          {scanProgress.currentFile && (
            <p className="text-xs text-text-muted mt-1 truncate">{scanProgress.currentFile}</p>
          )}
        </div>
      ) : (
        <button
          onClick={selectFolder}
          className="px-8 py-4 bg-accent hover:bg-accent-hover text-text-primary rounded-xl text-lg font-medium transition-colors cursor-pointer"
        >
          Select Music Folder
        </button>
      )}
    </div>
  )
}
