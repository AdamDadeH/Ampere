import { useEffect } from 'react'
import { useLibraryStore } from './stores/library'
import { Sidebar } from './components/Sidebar'
import { TrackList } from './components/TrackList'
import { PlayerBar } from './components/PlayerBar'
import { SetupView } from './components/SetupView'
import { AudioEngine } from './components/AudioEngine'
import { CompactPlayer } from './components/compact/CompactPlayer'
import { RiemannNavigator } from './riemann/RiemannNavigator'
import { DemosceneVisualizer } from './visualizer/DemosceneVisualizer'
import './stores/theme' // Initialize theme before render

const isCompactMode = new URLSearchParams(window.location.search).has('mode')
  && new URLSearchParams(window.location.search).get('mode') === 'compact'

function App(): React.JSX.Element {
  if (isCompactMode) {
    return <CompactPlayer />
  }

  return <LibraryApp />
}

function LibraryApp(): React.JSX.Element {
  const { stats, currentView, loadLibrary, setScanProgress } = useLibraryStore()

  useEffect(() => {
    loadLibrary()

    const unsubscribe = window.api.onScanProgress((progress) => {
      setScanProgress(progress as Parameters<typeof setScanProgress>[0])
    })

    return unsubscribe
  }, [loadLibrary, setScanProgress])

  const hasLibrary = stats && stats.total_tracks > 0

  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-secondary">
      <AudioEngine />
      {hasLibrary ? (
        <>
          <div className="flex-1 flex min-h-0">
            <Sidebar />
            {currentView === 'riemann' ? <RiemannNavigator /> : currentView === 'demoscene' ? <DemosceneVisualizer /> : <TrackList />}
          </div>
          <PlayerBar />
        </>
      ) : (
        <SetupView />
      )}
    </div>
  )
}

export default App
