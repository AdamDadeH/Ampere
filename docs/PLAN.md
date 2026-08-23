# ProtonMusic — Plan (live status)

_Where the system **actually stands today** and what's next — the doc you check for "where are we /
what should I build." Design lives in [DESIGN.md](DESIGN.md); executed work and resolved decisions
live in [archive/plan-history.md](archive/plan-history.md). **Keep this current:** when an item is
finished, move it out to the archive rather than leaving it here to rot._

_Last verified against live code: **2026-08-15**._

---

## Current state

**Ampere is the mature component and works end-to-end.** It scans a library, plays it, and carries
a full Winamp classic skin engine (all sprite sheets, both bitmap fonts, magenta transparency,
PLEDIT colors, EQ) alongside 8 built-in themes and a ~60-shader demoscene visualizer. The Riemann
Navigator runs on **two independent feature spaces** — in-app Meyda DSP vectors, and optional CLAP
Semantic IDs imported from `vq` — with three navigation modes (Drift, Journey, Session), per-mode
performance measurement, session logging, and blind similarity triplets for ground truth. Feedback
capture and inferred ratings are live. Proton Drive storage is detected, materialized on demand,
LRU-evicted under a configurable budget, and prefetched from the sequencer's decision.

**Verified 2026-08-15:** 253 tests pass across 13 files; `make check` is green; `npm run build`
succeeds. **`make typecheck` does not** — ~148 pre-existing errors, mostly one tsconfig wiring
fault (ISSUES #1). The app builds and ships regardless, because Vite only bundles reachable
modules.

**ProtonComics** scans `.cbz`, reads them, and tracks ratings and progress per
[`comics/ARCHITECTURE.md`](../comics/ARCHITECTURE.md). _Not re-verified by running it in this
pass_ — treat that doc's claims as needing a check before you act on them. It has **zero tests**.

**vq** is validated on synthetic data (NMI ≈ 0.99 against planted codes, 100% codebook
utilization) and exports a working index into Ampere. Real-audio CLAP embedding is in progress;
the generative-retrieval half of TIGER is not started.

**Repo health note:** `main` is behind. The current tip (`nav-modes-and-sessions`, 15 commits)
carries the navigation-modes and sessions work and has not landed. See "Now".

## Roadmap (Now / Next / Later)

_Outcome-focused, not a timeline. An item is a desired outcome, not a Gantt bar._

### Now (in progress)

- [ ] **Land the navigation-modes and sessions work.** 15 commits on `nav-modes-and-sessions`
      sitting unmerged; `main` is that far behind. Every other branch in the repo is already
      merged or stale, so this is the only real outstanding integration.
- [ ] **Adopt the golden path.** This change: root `CLAUDE.md`, `docs/`, `Makefile`, git hooks,
      `CHANGELOG.md`, and the previously-untracked `comics/`, `resources/`, `vq/` brought under
      version control.

### Next (queued, ready to start)

- [ ] **Get `make typecheck` green and fold it into `make check`.** ISSUES #1. Most of the ~148
      errors are one cause — the preload `index.d.ts` isn't in the renderer tsconfig, so
      `window.api` is untyped everywhere. Fix that first and re-count before touching anything
      else.
- [ ] **First tests for ProtonComics.** ISSUES #2. Vitest is configured and unused; the scanner's
      three-tier upsert and ProtonId injection are the parts where a regression costs user data.
- [ ] **Key the vq → Ampere join on `embedded_id`, not absolute file path.** ISSUES #4. Path
      matching is ~99% today and silently degrades the moment a user reorganizes their library —
      exactly the failure the embedded id exists to prevent.
- [ ] **Opt-out toggles for the heavy subsystems.** Feedback capture, inferred ratings, and the
      Riemann Navigator should each be independently disableable, default ON, persisted across
      restarts, with a settings panel to drive them. Riemann is the largest performance and memory
      win. Disabling inferred ratings after predictions exist must clear the column.

### Later (not yet scheduled)

**Player fundamentals still missing**
- Media-key and `MediaSession` integration (verified absent), plus keyboard transport bindings.
- Gapless playback — preload the next track, zero-duration crossfade at the boundary. Matters for
  album listening.
- File watching (`fs.watch` on scanned roots) for background detection of added/removed/changed
  files. Verified absent.
- Playlist management UI on top of the existing `playlists` / `playlist_tracks` tables; smart
  playlists (most played, recently added, top rated).

**Riemann — navigation modes on the manifold**

The three shipped modes are the first three. All operate on the same feature space, all toggle
without losing state:
- **Directed walk** — the feature dimensions are interpretable, so semantic direction vectors are
  definable ("heavier" = ↑RMS ↓centroid, "brighter" = ↑centroid ↑ZCR). Next track = nearest
  neighbour whose delta aligns with the chosen direction; button magnitude sets step size.
- **Semantic graph navigation** — fixed-valence graph where each edge is labelled by the dominant
  feature axis of its difference. The buttons label themselves; every track becomes an
  intersection with named roads.
- **2D surface eigenvector navigation** — local principal directions on a flat projection. "East"
  means different things at different points because the manifold is curved.
- **Orbit mode** — concentric exploration at increasing radii instead of walking to a neighbour.
- **Mood trajectory / path planning** — playlist generation as geodesic computation: define an
  energy arc, find the optimal path through the graph.

**Riemann — richer features and visuals**
- Tempo/BPM, key detection from the existing chroma, onset density, spectral flux, dynamic range,
  segment-level features (matching "tracks with a similar build").
- Cluster labels via HDBSCAN, node sizing by play count or rating, listening heat-map overlay,
  persistent history trails, optional KNN edge rendering, region fog for unexplored areas.
- **Spatial audio (LOD listening)** — clusters hum a composite signature when zoomed out;
  individual tracks become audible through `PannerNode` HRTF as the camera approaches. Hearing the
  map, not just seeing it.

**Sequencing and cache**
- Adaptive, sequencing-aware prefetch — see [RFD-0002](rfd/0002-sequencing-aware-prefetch.md).
- Intelligent transitions: beat-phase alignment, harmonically compatible key changes, outro/intro
  energy matching, auto-DJ sequencing.

**Visualization**
- Butterchurn / MilkDrop preset support (verified absent — Butterchurn currently informs the
  signal processor's smoothing, nothing more).
- Liminal-space generative visualizer: audio features → semantic prompts → fast local diffusion
  (SDXL Turbo / LCM, img2img for temporal coherence) → WebGL crossfade. Background research is in
  `ampere/docs/notes/BIBLIOGRAPHY-liminal-evolution.md`; the gen0 shader lineage is in
  `ampere/src/renderer/src/visualizer/shaders/liminal/LINEAGE.md`.

**Skins**
- `.wal` modern skin format (XML-based, a separate parsing pipeline).
- Per-element color overrides, hue rotation, exportable color presets; full 24-line VISCOLOR
  gradient ramps for the spectrum.
- Skin sharing / community gallery.

**vq**
- Generative retrieval: a small seq2seq transformer over Semantic ID sequences for next-item
  prediction — the second half of TIGER.

**ProtonComics**
- CBR support (`comicAdapter.extensions` already claims `.cbr`; only CBZ parsing exists).
- Cloud sync (`sync_status` / `cloud_path` columns exist, unused), cache eviction, inferred
  ratings from the `content_feedback` log.

**Distribution**
- Auto-updater and code signing. Tagged releases already build and publish an unsigned `.dmg`.
- Windows / Linux targets.

**Other standing wants**
- Last.fm scrobbling, synced + static lyrics, ReplayGain / volume normalization, system tray mode,
  metadata editing, a live effects rack (reverb, delay, compression, stereo widening, pitch shift)
  with persisted per-track presets, and "your year in music" listening analytics.

## Open questions

_Decisions not yet made. When one is resolved, record it in
[archive/plan-history.md](archive/plan-history.md) (or as an ADR under `adr/` if architecturally
significant) and delete it here._

1. **Does `make check` gain `typecheck`, or does typecheck stay advisory?** Folding it in is the
   golden-path shape, but it blocks every push until ISSUES #1 is fully green. Proposal: fix #1,
   then fold in — but the call is open.
2. **Does ProtonComics stay in this repo?** It shares only `@proton/shared` and the architectural
   pattern — no tables, no process, no build. Keeping it here is convenient; splitting it would
   make the "apps are siblings" rule structural rather than a convention.
3. **Should the two feature spaces (Meyda DSP, CLAP) converge?** They cluster differently by
   design and both are useful. The similarity-triplet data exists to answer which one better
   matches human judgement — but nothing consumes that answer yet.
4. **Is Windows/Linux ever a target?** Several decisions (the `fp-evict` Swift helper, arm64-only
   packaging, Proton Drive mount detection) are macOS-specific and would need alternatives.
