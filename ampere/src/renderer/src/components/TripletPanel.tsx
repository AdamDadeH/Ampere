import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Blind similarity elicitation: "is the anchor closer to A, or to B?"
 *
 * Nothing identifies the tracks — no title, artist, or artwork. That is the
 * point. Shown the metadata the answer becomes "both of these are indie folk",
 * a judgement about labels, and the metric would learn to reproduce genre tags
 * instead of perceived sound. Answering by ear also means familiarity stops
 * mattering, so the whole embedded library is eligible.
 *
 * Playback runs on a private audio element rather than the player store. Using
 * the real player would log track_started and skip events for every snippet
 * and quietly poison the feedback log this is meant to inform.
 *
 * What it measures: how often your ear agrees with cosine distance in CLAP
 * space. Drift walks that space, session affinity is cosine against it, and
 * journey uses IDs derived from it — so if the metric is skewed, three
 * features are built on sand and no amount of preference modelling helps.
 */

interface Question {
  anchorId: string
  aId: string
  bId: string
  cosA: number
  cosB: number
  margin: number
}

interface Agreement {
  total: number
  agreed: number
  unsure: number
  rate: number
  meanMargin: number
}

type Slot = 'anchor' | 'a' | 'b'

/** Seconds of each excerpt, and how far in to start. */
const EXCERPT_SECONDS = 12
/** Intros are unrepresentative, so sample from the body of the track. */
const EXCERPT_POSITION = 0.35

export function TripletPanel(): React.JSX.Element {
  const [question, setQuestion] = useState<Question | null>(null)
  const [stats, setStats] = useState<Agreement | null>(null)
  const [playing, setPlaying] = useState<Slot | null>(null)
  const [heard, setHeard] = useState<Set<Slot>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    audioRef.current?.pause()
    setPlaying(null)
  }, [])

  const loadQuestion = useCallback(async () => {
    stop()
    setHeard(new Set())
    setError(null)
    try {
      const [q, a] = await Promise.all([
        window.api.sampleSimilarityTriplet(),
        window.api.getTripletAgreement()
      ])
      setQuestion(q)
      setStats(a)
      if (q) {
        // Warm all three so answering is not gated on a cloud fetch.
        window.api.prefetchTracks([q.anchorId, q.aId, q.bId]).catch(() => {})
      }
    } catch (e) {
      setError(String(e))
    }
  }, [stop])

  useEffect(() => {
    void loadQuestion()
    return () => { audioRef.current?.pause() }
  }, [loadQuestion])

  const play = useCallback(async (slot: Slot) => {
    if (!question) return
    if (playing === slot) { stop(); return }

    const trackId = slot === 'anchor' ? question.anchorId : slot === 'a' ? question.aId : question.bId
    try {
      const res = await window.api.getTrackPath(trackId)
      if (!res?.url) { setError('Track unavailable'); return }

      let el = audioRef.current
      if (!el) { el = new Audio(); audioRef.current = el }
      el.pause()
      el.src = res.url
      el.onloadedmetadata = () => {
        if (Number.isFinite(el!.duration)) el!.currentTime = el!.duration * EXCERPT_POSITION
        void el!.play()
      }
      el.ontimeupdate = () => {
        const start = (el!.duration || 0) * EXCERPT_POSITION
        if (el!.currentTime - start > EXCERPT_SECONDS) { el!.pause(); setPlaying(null) }
      }
      setPlaying(slot)
      setHeard(prev => new Set(prev).add(slot))
    } catch (e) {
      setError(String(e))
    }
  }, [question, playing, stop])

  const answer = useCallback(async (chosen: 'a' | 'b' | 'unsure') => {
    if (!question) return
    stop()
    await window.api.recordSimilarityTriplet(
      question.anchorId, question.aId, question.bId, chosen, question.cosA, question.cosB
    )
    await loadQuestion()
  }, [question, stop, loadQuestion])

  if (error && !question) return <p className="text-sm text-red-400">{error}</p>
  if (!question) {
    return <p className="text-sm text-text-muted">No embeddings available to compare.</p>
  }

  const heardAll = heard.has('anchor') && heard.has('a') && heard.has('b')
  const decided = stats ? stats.total - stats.unsure : 0

  const PlayButton = ({ slot, label }: { slot: Slot; label: string }): React.JSX.Element => (
    <button
      onClick={() => void play(slot)}
      className={`px-4 py-3 rounded border text-sm transition-colors cursor-pointer ${
        playing === slot
          ? 'bg-[#ffaa00]/20 border-[#ffaa00] text-text-primary'
          : heard.has(slot)
            ? 'bg-white/5 border-white/20 text-text-secondary hover:border-white/40'
            : 'bg-transparent border-white/10 text-text-faint hover:border-white/30'
      }`}
    >
      {playing === slot ? '■ ' : '▶ '}{label}
      {heard.has(slot) && playing !== slot && <span className="text-text-faint"> ·</span>}
    </button>
  )

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-text-secondary mb-1">Which sounds more like the reference?</p>
        <p className="text-[11px] text-text-muted">
          Listen to all three. Nothing is labelled on purpose — judging by artist or genre would
          teach the model to copy tags rather than sound.
        </p>
      </div>

      <div className="flex justify-center">
        <PlayButton slot="anchor" label="Reference" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PlayButton slot="a" label="A" />
        <PlayButton slot="b" label="B" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => void answer('a')}
          disabled={!heardAll}
          className="px-3 py-2 rounded text-sm bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-text-secondary cursor-pointer"
        >
          A is closer
        </button>
        <button
          onClick={() => void answer('unsure')}
          disabled={!heardAll}
          className="px-3 py-2 rounded text-sm bg-transparent hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-text-faint cursor-pointer"
          title="A genuine tie is information about the metric, not a wasted answer"
        >
          Too close
        </button>
        <button
          onClick={() => void answer('b')}
          disabled={!heardAll}
          className="px-3 py-2 rounded text-sm bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-text-secondary cursor-pointer"
        >
          B is closer
        </button>
      </div>

      {!heardAll && (
        <p className="text-[11px] text-text-faint text-center">Play all three to answer.</p>
      )}

      {stats && stats.total > 0 && (
        <div className="text-[11px] text-text-muted border-t border-white/5 pt-3 space-y-1">
          <p>
            {stats.total} answered · {stats.unsure} too close to call
            {decided > 0 && <> · agrees with the embedding {(100 * stats.rate).toFixed(0)}% of the time</>}
          </p>
          <p className="text-text-faint">
            Chance is 50%. Near 50 means the embedding does not capture how you hear similarity;
            near 90 means it largely does and the metric needs no correcting.
            {decided > 0 && decided < 30 && ' Too few answers yet to tell them apart.'}
          </p>
        </div>
      )}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}
