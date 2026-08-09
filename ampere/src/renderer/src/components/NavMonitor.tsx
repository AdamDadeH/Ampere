import { useState, useEffect, useCallback } from 'react'

/**
 * Navigation monitoring.
 *
 * Deliberately descriptive rather than prescriptive. What counts as a good
 * outcome is not settled and will move, so the panel exposes the thresholds
 * as controls and shows the raw completion distribution underneath the rates.
 * Any rate is a threshold applied to that distribution — seeing the shape is
 * what tells you whether a difference is broad or an artifact of where the
 * line landed.
 *
 * Standard errors are shown next to every rate because at these sample sizes
 * most apparent differences are not real, and a bare percentage invites the
 * opposite conclusion.
 */

// Declared locally rather than imported from preload: tsconfig.web does not
// include that project, and the existing cross-project imports already error.
interface NavModeStat {
  mode: string
  n: number
  sustained: number
  rejected: number
  sustainedRate: number
  rejectedRate: number
}

interface Report {
  byKind: { kind: 'sampling' | 'listening'; rows: NavModeStat[]; n: number }[]
  histogram: { mode: string; counts: number[]; n: number }[]
  overall: NavModeStat[]
  totalOutcomes: number
  taggedOutcomes: number
  versions: { id: number; embedding_version: string; codebook_version: string; n_tracks: number | null; activated_at: string }[]
}

const MODE_LABELS: Record<string, string> = {
  shuffle: 'Random',
  drift: 'Drift',
  journey: 'Journey',
  session: 'Session',
  intentional_select: 'Picked by hand',
  auto_advance: 'Queue order',
  search_play: 'From search'
}

function stderr(rate: number, n: number): number {
  return n > 0 ? Math.sqrt((rate * (1 - rate)) / n) : NaN
}

function StatRows({ rows }: { rows: NavModeStat[] }): React.JSX.Element {
  if (rows.length === 0) {
    return <p className="text-[11px] text-text-muted italic">No plays recorded yet.</p>
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-text-muted text-[10px] uppercase tracking-wider">
          <th className="text-left font-medium pb-1">Mode</th>
          <th className="text-right font-medium pb-1">n</th>
          <th className="text-right font-medium pb-1">Sustained</th>
          <th className="text-right font-medium pb-1">Rejected</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const se = stderr(r.sustainedRate, r.n)
          // Under ~30 samples the interval is wide enough that the number
          // should not be read as a finding.
          const thin = r.n < 30
          return (
            <tr key={r.mode} className={thin ? 'text-text-faint' : 'text-text-secondary'}>
              <td className="py-0.5">{MODE_LABELS[r.mode] ?? r.mode}</td>
              <td className="text-right tabular-nums">{r.n}</td>
              <td className="text-right tabular-nums">
                {(100 * r.sustainedRate).toFixed(0)}%
                <span className="text-text-faint"> ±{(100 * se).toFixed(0)}</span>
              </td>
              <td className="text-right tabular-nums">{(100 * r.rejectedRate).toFixed(0)}%</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Histogram({ counts, n }: { counts: number[]; n: number }): React.JSX.Element {
  const max = Math.max(1, ...counts)
  return (
    <div className="flex items-end gap-px h-8" title={`${n} plays, by fraction of the track played (0–100%)`}>
      {counts.map((c, i) => (
        <div
          key={i}
          className="flex-1 bg-[#ffaa00]/60 rounded-sm min-h-px"
          style={{ height: `${(c / max) * 100}%` }}
          title={`${i * 10}–${(i + 1) * 10}% played: ${c}`}
        />
      ))}
    </div>
  )
}

export function NavMonitor(): React.JSX.Element {
  const [report, setReport] = useState<Report | null>(null)
  const [sustained, setSustained] = useState(0.7)
  const [samplingGap, setSamplingGap] = useState(20)
  const [surfaceOnly, setSurfaceOnly] = useState(false)

  const load = useCallback(() => {
    window.api
      .getNavReport({
        sustainedThreshold: sustained,
        samplingGapSeconds: samplingGap,
        surface: surfaceOnly ? 'all-tracks' : undefined
      })
      .then((r: unknown) => setReport(r as Report))
      .catch(console.error)
  }, [sustained, samplingGap, surfaceOnly])

  useEffect(load, [load])

  if (!report) return <p className="text-sm text-text-muted">Loading…</p>

  const listening = report.byKind.find(k => k.kind === 'listening')
  const sampling = report.byKind.find(k => k.kind === 'sampling')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6 items-center text-xs text-text-muted">
        <label className="flex items-center gap-2">
          Sustained at
          <input
            type="range" min={0.3} max={0.95} step={0.05}
            value={sustained} onChange={e => setSustained(Number(e.target.value))}
            className="w-24 accent-[#ffaa00]"
          />
          <span className="tabular-nums text-text-secondary w-8">{Math.round(sustained * 100)}%</span>
        </label>
        <label className="flex items-center gap-2">
          Sampling below
          <input
            type="range" min={5} max={90} step={5}
            value={samplingGap} onChange={e => setSamplingGap(Number(e.target.value))}
            className="w-24 accent-[#ffaa00]"
          />
          <span className="tabular-nums text-text-secondary w-10">{samplingGap}s</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox" checked={surfaceOnly}
            onChange={e => setSurfaceOnly(e.target.checked)}
            className="accent-[#ffaa00]"
          />
          Main list only
        </label>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
            Settled listening <span className="normal-case font-normal">({listening?.n ?? 0} plays)</span>
          </h3>
          <StatRows rows={listening?.rows ?? []} />
        </div>
        <div>
          <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
            Sampling <span className="normal-case font-normal">({sampling?.n ?? 0} plays)</span>
          </h3>
          <StatRows rows={sampling?.rows ?? []} />
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
          How much of each track was played
        </h3>
        <p className="text-[11px] text-text-muted mb-3">
          Left is abandoned immediately, right is played to the end. Every rate above is a
          line drawn through these.
        </p>
        <div className="space-y-2">
          {report.histogram.map(h => (
            <div key={h.mode} className="flex items-center gap-3">
              <span className="text-[11px] text-text-faint w-28 shrink-0">
                {MODE_LABELS[h.mode] ?? h.mode}
              </span>
              <div className="flex-1"><Histogram counts={h.counts} n={h.n} /></div>
              <span className="text-[11px] text-text-faint tabular-nums w-8 text-right">{h.n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-text-muted space-y-1 border-t border-white/5 pt-3">
        <p>
          {report.taggedOutcomes} of {report.totalOutcomes} plays record which screen they came
          from. Comparisons across modes are only sound within one screen — the rest predate
          that being logged.
        </p>
        {report.versions.length > 0 && (
          <p>
            Index version {report.versions.length}: {report.versions[report.versions.length - 1].embedding_version}
            {' · '}
            {report.versions[report.versions.length - 1].codebook_version.split('/').pop()}
            {report.versions.length > 1 && ' — earlier versions are not comparable to this one.'}
          </p>
        )}
      </div>
    </div>
  )
}
