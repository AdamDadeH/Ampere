# ProtonMusic — Plan History (provenance)

_Executed work, carried-out decisions, and resolved questions. **Append-only provenance** — kept so
nothing is re-litigated or re-reported as new. This file holds **no live status** (see
[../PLAN.md](../PLAN.md)) and **no design** (see [../DESIGN.md](../DESIGN.md))._

---

## 2026-08-15 — Adopted the golden path (retrofit)

Scaffolded from the **golden-path template v1.0.0** (growth profile) on 2026-08-15. This is the
"best practice as of day X" snapshot (charter decision D1). A newer template is adopted only by a
deliberate `copier update` — there is no live coupling.

**Provenance caveat.** `.copier-answers.yml` records `_src_path` but **not `_commit`**: the
template lives in a *subdirectory* of the life-os repo (`tools/golden-path`), and Copier only
stamps a VCS ref when the source is a repository root. The human-readable equivalent, recorded
here instead: life-os commit **`f4c772e`** (2026-07-19), the last commit to touch
`tools/golden-path` as of this scaffold.

This was a **retrofit onto an existing repo**, not a fresh spawn, so the template was rendered to a
scratch directory and merged in by hand. Files taken verbatim: `.githooks/`, `docs/adr/`,
`docs/rfd/` (process docs + templates), `docs/feature-spec-template/`. Files authored by merging
template structure with existing content: `CLAUDE.md`, `README.md`, `.gitignore`, `Makefile`,
`CHANGELOG.md`, `docs/DESIGN.md`, `docs/PLAN.md`, `docs/ISSUES.md`.

### What was consolidated

| Source | Went to |
|--------|---------|
| `music-system/CLAUDE.md` (outside the repo, untracked) | repo-root `CLAUDE.md` — data-integrity rules, now versioned |
| `music-system/BACKLOG.md` (outside the repo) | `docs/PLAN.md` → Next (opt-out toggles for feedback / inferred ratings / Riemann) |
| `ampere/PRIORITIES.md` (vision) | `docs/DESIGN.md` §1 |
| `ampere/PRIORITIES.md` (P0–P5 roadmap) | `docs/PLAN.md` Now / Next / Later, **re-verified against live code** |
| `ampere/PRIORITIES.md` (prefetch backlog) | `docs/rfd/0002-sequencing-aware-prefetch.md` |
| `ampere/PRIORITIES.md` (implicit-feedback backlog) | shipped — see below; the model is described in `docs/DESIGN.md` §6 |

`ampere/PRIORITIES.md` was deleted after dissolution. Component-level docs
(`ampere/CLAUDE.md`, `ampere/README.md`, `comics/ARCHITECTURE.md`, `vq/README.md`, `vq/AMPERE.md`,
`ampere/docs/notes/`, the visualizer references) were **kept** — `docs/DESIGN.md` links down to
them rather than restating, per the no-duplication rule.

### Decisions carried out

- **Scale profile: growth.** Multi-component (three apps plus a shared package), so the ADR + RFD +
  feature-spec layer applies rather than the core-only set.
- **Template `python: false`.** The repo root is npm workspaces; `vq` keeps its own venv and
  `requirements.txt` and is not wired into any build or test gate. A root uv/ruff/pytest setup
  would have fought that.
- **`comics/`, `resources/` and `vq/` brought under version control.** They had never been
  committed, despite `comics` being a declared npm workspace and `vq` being what produces Ampere's
  semantic index.
- **`make check` is `test` only, not `lint + test`.** `make typecheck` is red repo-wide
  (ISSUES #1); gating pushes on a known-red target would block all work, and quietly dropping
  typecheck without saying so would misrepresent the gate. Recorded in the `Makefile` header and
  as open question 1 in `docs/PLAN.md`.
- **Scaffolded on a branch off `nav-modes-and-sessions`, not `main`.** This knowingly stacks on an
  unmerged branch — against the integration rule — because `main` is 15 commits behind and docs
  written against it would describe code that does not exist there. Landing both together is the
  first item in `docs/PLAN.md` → Now.

### State captured at scaffold time

Verified 2026-08-15: 253 tests pass across 13 files in Ampere; `npm run build` succeeds;
`make check` is green. ProtonComics and `vq` have zero tests. `make typecheck` fails with 148
errors (130 ampere, 18 comics).

---

## Before 2026-08-15 — Work already executed

Reconstructed from `ampere/PRIORITIES.md`'s "Already Built" section and **re-verified against live
code on 2026-08-15**. Recorded because the roadmap it came from had drifted badly out of date —
it still listed shipped work as unstarted P0.

**Library and playback**
- Scanning and metadata extraction for MP3, FLAC, M4A, OGG, OPUS, WAV, AAC, WMA, AIFF.
- SQLite library with play counts, ratings and listening history; embedded `AMPERE_ID` tags giving
  tracks an identity that survives file moves.
- Album art extraction and grid view, artist/album sidebar browsing, search.
- Loopback HTTP audio server with range-request support (FLAC seeking) and on-demand
  materialization of cloud files.
- Windowed track list: a `currentTime` tick re-renders no rows; a track switch re-renders two.
  Asserted by `TrackList.perf.test.tsx`, not assumed.

**Winamp skin engine** — the whole of what `PRIORITIES.md` still listed as unstarted "P0":
- Full sprite-sheet rendering: CBUTTONS, TITLEBAR, POSBAR, VOLUME, BALANCE, SHUFREP, MONOSTER,
  PLAYPAUS, EQMAIN.
- Both bitmap fonts — NUMBERS.BMP digits and the TEXT.BMP character set.
- Magenta (`#FF00FF`) transparency keying, so shaped skins work.
- PLEDIT.TXT playlist colors; a classic layout with EQ and playlist windows.
- 8 built-in themes plus `.wsz` import.

**Riemann Navigator**
- 56-dim Meyda feature extraction (spectral centroid, MFCCs, RMS, chroma, ZCR), incremental and
  resumable; UMAP 2D/3D projection with configurable dispersion and spread.
- Three.js renderer: instanced point cloud, bloom post-processing, orbit + WASD fly controls,
  raycast hover and click-to-play, camera lerp on selection.
- Navigation modes — Drift (KNN walk), Journey, Session — store-owned via the `driftNext`
  override, with a green trajectory line tracing the path taken.
- Per-mode performance measurement against index versions; a descriptive monitoring panel;
  navigation decisions log the features they used.
- Blind similarity triplets for human ground truth on the feature spaces.
- Modes walk the **feature space**, not the UMAP projection — corrected in `b74df14`.

**Semantic index (`vq`)**
- RQ-VAE + Semantic ID export validated on synthetic data: NMI ≈ 0.99 against planted codes,
  diagonal-dominant per-level NMI confirming coarse-to-fine decomposition, 100% codebook
  utilization, reconstruction MSE near the noise floor.
- CLAP track embedding pipeline (`laion/larger_clap_music_and_speech`), resumable and checkpointed.
- One-file export/import contract into Ampere (`ampere_index.sqlite`), writing derived tables only.
- Capability detection by row count, so installs without the index hide what they cannot do.

**Feedback and inferred ratings** — the `PRIORITIES.md` "implicit feedback" backlog, shipped:
- Append-only `track_feedback` log with context.
- Lightweight explicit-light signals: "loving this", "love it, not now", "not feeling it".
- Derived `inferred_rating` recomputed from the log, with the explicit `rating` as a hard override.

**Storage**
- Proton Drive detection, download-on-demand, LRU cache eviction under a configurable budget with
  pinning, and the `fp-evict` Swift helper for `FileManager.evictUbiquitousItem`.

**Visualization**
- Demoscene shader engine with ~60 audio-reactive fragment shaders, including a `liminal/` gen0
  lineage tracked in `LINEAGE.md`.

**Distribution**
- Tagged `v*` pushes build and publish an unsigned macOS arm64 `.dmg` via GitHub Actions.

### Direction changes recorded at the time

- **The original PRD's cloud-first Proton Drive music manager was superseded.** The product became
  a local-first player whose center of gravity is Winamp-fidelity skinning and audio-derived
  navigation. Cloud storage shipped, but as a storage backend rather than the premise.
  `music-system/prd.md` is retained outside this repo as a historical artifact; it does not
  describe the system.
- **Metadata editing, a mobile companion, and collaborative playlists were parked** as not the
  vision.
