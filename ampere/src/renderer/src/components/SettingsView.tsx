import { useCallback, useEffect, useState } from 'react'

interface CacheStats {
  totalTracks: number
  cachedTracks: number
  cloudOnlyTracks: number
  pinnedTracks: number
  cachedBytes: number
  pinnedBytes: number
  maxSizeBytes: number
}

const GB = 1024 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

import { NavMonitor } from './NavMonitor'

export function SettingsView(): React.JSX.Element {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [limitGb, setLimitGb] = useState('')
  const [busy, setBusy] = useState<null | 'apply' | 'evict' | 'import'>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [semanticCount, setSemanticCount] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    const s = (await window.api.getCacheStats()) as CacheStats
    setStats(s)
    setSemanticCount(await window.api.getSemanticCount())
    // Only seed the input when it's empty so we don't clobber what the user is typing.
    setLimitGb(prev => (prev === '' ? (s.maxSizeBytes / GB).toFixed(1) : prev))
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const applyLimit = async (): Promise<void> => {
    const gb = Number(limitGb)
    if (!Number.isFinite(gb) || gb <= 0) {
      setMessage('Enter a positive number of GB.')
      return
    }
    setBusy('apply')
    setMessage(null)
    try {
      await window.api.setCacheLimit(Math.round(gb * GB))
      await refresh()
      setMessage(`Cache limit set to ${gb} GB.`)
    } finally {
      setBusy(null)
    }
  }

  const runEviction = async (): Promise<void> => {
    setBusy('evict')
    setMessage(null)
    try {
      const { evicted, freedBytes } = await window.api.evictCache()
      await refresh()
      setMessage(
        evicted > 0
          ? `Evicted ${evicted} file${evicted === 1 ? '' : 's'}, freed ${formatBytes(freedBytes)}.`
          : 'Nothing to evict — cache is under budget.'
      )
    } finally {
      setBusy(null)
    }
  }

  const importSemantic = async (): Promise<void> => {
    setBusy('import')
    setMessage(null)
    try {
      const report = await window.api.importSemanticIndex()
      if (!report) {
        setMessage('Import cancelled.')
        return
      }
      await refresh()
      const unmatched = report.unmatchedInVq > 0 ? `, ${report.unmatchedInVq} not in library` : ''
      setMessage(
        `Imported ${report.matched.toLocaleString()} of ${report.vqTracks.toLocaleString()} embeddings ` +
          `(${report.numLevels}×${report.codebookSize} Semantic IDs, dim ${report.embeddingDim})${unmatched}.`
      )
    } catch (err) {
      setMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const usagePct = stats && stats.maxSizeBytes > 0
    ? Math.min(100, (stats.cachedBytes / stats.maxSizeBytes) * 100)
    : 0
  const overBudget = stats ? stats.cachedBytes > stats.maxSizeBytes : false

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Drag region for macOS */}
      <div className="h-10 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      <div className="max-w-2xl mx-auto px-8 pb-12">
        <h1 className="text-2xl font-semibold text-text-primary mb-1">Settings</h1>
        <p className="text-sm text-text-muted mb-8">Local cache &amp; cloud sync</p>

        <section className="mb-8">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Cache usage</h2>

          {/* Usage bar */}
          <div className="bg-bg-secondary rounded-lg p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">
                {stats ? formatBytes(stats.cachedBytes) : '—'} of {stats ? formatBytes(stats.maxSizeBytes) : '—'}
              </span>
              <span className={overBudget ? 'text-red-400' : 'text-text-muted'}>
                {usagePct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] ${overBudget ? 'bg-red-500' : 'bg-accent'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {overBudget && (
              <p className="text-[11px] text-red-400 mt-2">
                Over budget — eviction is actively pushing files back to the cloud. Raise the limit to stop the churn.
              </p>
            )}
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total tracks" value={stats?.totalTracks} />
            <Stat label="Cached locally" value={stats?.cachedTracks} sub={stats ? formatBytes(stats.cachedBytes) : undefined} />
            <Stat label="Cloud-only" value={stats?.cloudOnlyTracks} />
            <Stat label="Pinned" value={stats?.pinnedTracks} sub={stats ? formatBytes(stats.pinnedBytes) : undefined} />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Cache limit</h2>
          <p className="text-sm text-text-muted mb-3">
            Maximum disk space for cached cloud files. When exceeded, least-recently-played files are evicted
            back to the cloud. This setting persists across restarts.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.1"
              step="0.5"
              value={limitGb}
              onChange={e => setLimitGb(e.target.value)}
              className="w-28 px-3 py-2 bg-bg-tertiary rounded text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent"
            />
            <span className="text-sm text-text-muted">GB</span>
            <button
              onClick={applyLimit}
              disabled={busy !== null}
              className="ml-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy === 'apply' ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Semantic index</h2>
          <p className="text-sm text-text-muted mb-3">
            CLAP audio embeddings + RQ-VAE Semantic IDs from the standalone <span className="font-mono text-text-secondary">vq</span> pipeline.
            Run <span className="font-mono text-text-secondary">vq/scripts/export_ampere.py</span> first, then import the generated
            <span className="font-mono text-text-secondary"> ampere_index.sqlite</span>. Purely audio-derived — safe to rebuild anytime.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={importSemantic}
              disabled={busy !== null}
              className="px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy === 'import' ? 'Importing…' : 'Import semantic index…'}
            </button>
            <span className="text-sm text-text-muted">
              {semanticCount === null
                ? '—'
                : semanticCount > 0
                  ? `${semanticCount.toLocaleString()} tracks indexed`
                  : 'Not yet imported'}
            </span>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Navigation</h2>
          <p className="text-sm text-text-muted mb-4">
            How each play mode performs, split by the kind of session it happened in —
            skipping fast is correct when sampling and a failure when settled, so the two
            are not pooled.
          </p>
          <NavMonitor />
        </section>

        <section className="mb-10">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Maintenance</h2>
          <button
            onClick={runEviction}
            disabled={busy !== null}
            className="px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {busy === 'evict' ? 'Evicting…' : 'Run eviction now'}
          </button>
          <p className="text-[11px] text-text-muted mt-2">
            Pinned tracks are never evicted. Eviction also runs automatically every 5 minutes.
          </p>
        </section>

        {message && <p className="text-sm text-text-secondary">{message}</p>}
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value?: number; sub?: string }): React.JSX.Element {
  return (
    <div className="bg-bg-secondary rounded-lg p-4">
      <div className="text-2xl font-semibold text-text-primary tabular-nums">
        {value === undefined ? '—' : value.toLocaleString()}
      </div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
      {sub && <div className="text-[11px] text-text-faint mt-0.5">{sub}</div>}
    </div>
  )
}
