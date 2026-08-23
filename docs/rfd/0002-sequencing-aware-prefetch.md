---
rfd: 2
title: Sequencing-aware prefetch
state: discussion
authors: Adam Henderson
date: 2026-08-15
---

# RFD 2 — Sequencing-aware prefetch

> **Provenance.** This design was written in `ampere/PRIORITIES.md` as a backlog section. It is
> reproduced here — the golden-path home for a cross-component design — as part of dissolving that
> file. It is **not** settled: `state: discussion`, awaiting review. Part of it has since shipped
> in a simpler form; §4 records exactly which part, verified against live code on 2026-08-15.

## 1. Problem

Cloud-only tracks take 10–15 seconds to download on first play. The cache manager evicts LRU under
a budget but never prefetches — it is reactive, not predictive. The user hears the gap.

The information needed to fix this already exists and is in the wrong place. **Whatever decides
the next track knows what the next track probably is.** The cache manager does not, and cannot
without knowing about every sequencing mode — which would invert the dependency and make every new
navigation mode a change to the cache.

## 2. Proposal

Invert it the other way. Each sequencing/navigation mode provides **probabilistic** prefetch hints;
the cache manager consumes hints and knows nothing about modes.

```typescript
interface PrefetchProvider {
  /** The k most likely next tracks, with estimated probability. */
  prefetchCandidates(currentTrackId: string, k: number): { trackId: string; probability: number }[]
}
```

The cache manager sorts by probability descending and downloads until a bandwidth/budget cap is
reached. **The provider does not need to be precise** — "top 5 most likely" is plenty. That
tolerance is what makes the interface cheap enough for every mode to implement.

Beyond the hint, a full sequencing strategy exposes:

| Method | Role |
|--------|------|
| `prefetchCandidates(currentTrackId, k)` | probabilistic next-K (the only required one) |
| `next()` | the deterministic next track, after selection |
| `presentOptions()` | candidates offered to the user, when the mode asks |
| `handleSelection(trackId)` | the user picked one of them |

### Probability shapes by mode

| Mode | Prefetch behavior | Probability |
|------|------------------|-------------|
| Album sequential | next 2–3 tracks in the album | ~1.0 (near certain) |
| Artist sequential | next tracks by the same artist | ~0.8 |
| Playlist | look ahead N | ~1.0 (deterministic) |
| Shuffle | broader pool, low individual probability | ~1/pool_size |
| Drift (KNN) | k nearest neighbours in the manifold | weighted by inverse distance |
| Human-in-the-loop | the 3–5 options presented | ~0.2 each (uniform over choices) |

**Human intervention reshapes the distribution rather than sharpening it.** Offering the user five
choices means each gets ~0.2 instead of one getting ~1.0 — so prefetch all five. This is the case
that a naive "prefetch the next track" implementation gets exactly wrong.

### Cache manager integration

- On track change, query the active strategy for candidates.
- Download the top candidates not already cached, respecting a bandwidth cap.
- Eviction stays LRU under the existing budget; prefetched tracks get `last_accessed` set, so they
  sit fresh in the LRU rather than being evicted before they play.

## 3. Consequences

**Better:** every navigation mode gets prefetch for free by implementing one method. The cache
manager stops needing to know what modes exist. Adding a mode does not touch caching.

**Worse:** prefetch spends bandwidth and disk on tracks that never play — deliberately, and most
of all in exactly the exploratory modes where the distribution is flattest. The budget cap is the
only thing bounding that waste, and a badly calibrated provider degrades to "download everything
nearby" without any signal that it has done so.

**Unresolved:** nothing currently measures whether a prefetch was *used*. Without a hit-rate
metric, a miscalibrated provider is indistinguishable from a well-calibrated one.

## 4. What has already shipped

Verified against live code, 2026-08-15. A simpler split landed rather than the full interface:

- `library.getUpcomingTrackIds(count)` returns upcoming ids for the **deterministic** cases only
  (queue order and shuffle), and deliberately returns `[]` for graph-walk modes — "a graph walk's
  next track has nothing to do with queue order, so prefetching from it would warm tracks that will
  not play."
- Graph-walk modes prefetch their own branches via `schedulePrecompute`.
- `ipcMain.handle('prefetch-tracks')` materializes Proton Drive paths, skipping local and
  already-materialized files.
- The sequencer decides the next track *during* playback, so the decision exists early enough to
  act on.

**Not built:** the `PrefetchProvider` interface itself, probability estimates, probability-ranked
downloading under a bandwidth cap, the human-in-the-loop flattened distribution, and any
prefetch-hit metric.

The shipped design is a binary split — deterministic modes prefetch, graph modes self-manage —
where this RFD proposes a continuum. The open question is whether the continuum earns its
complexity, or whether the binary split is the right permanent answer with per-mode precompute
covering the rest.

## 5. Follow-on ideas (not part of this proposal)

- Album-aware eviction — don't orphan one track of a twelve-track album.
- File-size-aware eviction — one lossless album vs. ten compressed tracks for the same space.
- Play count and rating weighting the LRU, so frequently-played albums stay cached longer.
- Time-of-day patterns; bandwidth detection to prefetch harder on fast connections.
