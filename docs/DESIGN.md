# ProtonMusic — Design

_Evergreen design and architecture: **how the system is meant to work.** This document does not
track status (see [PLAN.md](PLAN.md)) or executed history (see
[archive/plan-history.md](archive/plan-history.md)). Update it in the same change that alters an
intended flow, the entity model, or the architecture._

_A one-file [arc42](https://arc42.org)/[C4](https://c4model.com)-lite. It describes the **system**;
each component keeps its own deep reference and this doc links down rather than restating —
see [`ampere/README.md`](../ampere/README.md), [`comics/ARCHITECTURE.md`](../comics/ARCHITECTURE.md),
[`vq/README.md`](../vq/README.md)._

---

## 1. Introduction & goals

A personal, local-first music system: **Ampere** (a desktop music player with deep Winamp-skin
fidelity and an audio-feature-driven 3D library navigator), **ProtonComics** (a sibling `.cbz`
reader), and **vq** (an offline RQ-VAE pipeline that turns CLAP audio embeddings into Semantic IDs).

**Primary goals**

1. **Own your library.** Metadata, ratings, play history and derived analysis live on disk, in
   SQLite, under the user's control. No account, no service, no cloud dependency to play a file.
2. **Navigate music by what it sounds like.** A library has a shape. Positioning and sequencing
   come from the audio signal, not from tags a stranger typed.
3. **Revive desktop customization as a first-class feature.** Winamp skins rendered
   sprite-accurately, not approximated — the skin engine is the soul of the product, not a theme
   picker.

**Non-goals**

- A streaming service, a catalogue, or any server-side component. The only network dependency is
  optional cloud *storage* (Proton Drive), and it stores the user's own files.
- Collaborative or multi-user features. Single user, single machine, by design.
- A shared content database across apps. Music and comics are separate products that share
  patterns, never tables.
- Cross-platform parity today. The build targets macOS arm64; nothing precludes others, nothing
  is being done for them either.

**Key quality attributes**, in priority order:

| Attribute | What it means here |
|-----------|--------------------|
| **Data integrity** | The user's curation is irreplaceable. Derived data may be wrong and rebuilt; source data may never be corrupted. This dominates every other concern. |
| **Honesty of interface** | A control that cannot work is hidden or explains itself. Nothing silently no-ops. |
| **Recomputability** | Every expensive artifact (features, projections, semantic IDs, inferred ratings) is derivable from source and safe to delete. |
| **Responsiveness** | A large library must stay fluid — windowed rendering, prefetch, no full re-render on a playback tick. |

## 2. Constraints

- **Electron + macOS arm64.** Native modules (`better-sqlite3`) must be rebuilt against the
  installed Electron headers; packaging is unsigned, so first launch needs right-click → Open.
- **SQLite, embedded, one connection per app.** No server, no ORM, no migration framework.
- **Single npm workspace root** (`shared`, `ampere`, `comics`) with `@proton/shared` bundled at
  build time rather than shipped as a runtime dependency.
- **`vq` is Python and deliberately separate** — its own venv and dependency set (torch,
  transformers, librosa). It must never become a runtime dependency of an app, because most
  installs will never run it.
- **Renderer sandboxing.** The renderer cannot touch the filesystem directly; audio reaches
  `<audio>` through a loopback HTTP server, and everything else through IPC + the preload bridge.

## 3. Governing principles

The small set of rules the project would reject a design over. The binding statements live in
[`../CLAUDE.md`](../CLAUDE.md); this is why they exist.

1. **Source data and derived data are different kinds of thing.** Anything recomputable from audio
   files or source columns is derived, and derived tables are disposable. Anything the user typed,
   rated, or accumulated is source, and is never overwritten by a computation.
2. **No fallback between distinct fields.** Null is a fact, not a gap to be filled. Track artist and
   album artist are the canonical example; the rule is general.
3. **Positioning is metadata-free.** The Riemann Navigator maps the library from audio signal
   alone. Admitting genre or artist into layout would make the map a picture of the tags rather
   than of the music.
4. **Capabilities are counted, not configured.** What an install can do is derived from row counts.
   A toggle can disagree with the database; a count cannot.
5. **Schema is one constant, not a migration history.** `SCHEMA_SQL` plus a `SCHEMA_VERSION` that
   triggers rebuilds of derived tables. Migration arrays are how schema debt accumulates.
6. **Apps are siblings, never dependencies.** Shared code moves down into `@proton/shared`; it
   never moves sideways between `ampere` and `comics`.

## 4. Context (C4 level 1)

```
                 ┌──────────────────────────────────────────┐
   audio files   │              ProtonMusic                 │
   ─────────────►│                                          │
   (local disk / │   Ampere ──── @proton/shared ──── Comics  │
    Proton Drive)│      │                              │     │
                 │      │                              │     │
   .cbz files    │   library.db                   comics.db  │
   ─────────────►│                                          │
                 └──────────┬───────────────────────────────┘
                            │ ampere_index.sqlite (manual, one-way)
                            │
                 ┌──────────┴───────────┐
                 │   vq (Python, offline)│──► CLAP model (HuggingFace, download-once)
                 └───────────────────────┘
```

| External | Direction | What crosses the boundary |
|----------|-----------|---------------------------|
| Local filesystem | in / out | Audio and comic files are read; ID tags are written back (embedded `AMPERE_ID` / `ProtonId`) so identity survives moves and renames. |
| Proton Drive (mounted) | in | Cloud-only files are materialized on demand and evicted under an LRU budget. Detected by mount inspection — there is no API client. |
| `vq` pipeline | in | One SQLite file, by hand. Never invoked by an app. |
| CLAP model weights | in | Downloaded once by `vq`, used offline thereafter. |
| GitHub Releases | out | Tagged `v*` pushes build and publish an unsigned `.dmg`. |

There is **no** telemetry, no account system, and no outbound sync of user data.

## 5. Building blocks (C4 level 2 — containers)

| Container | Runtime | Responsibility |
|-----------|---------|----------------|
| `ampere/src/main` | Electron main (Node) | Window lifecycle, all SQLite access, file scanning, tag write-back, storage providers, the loopback audio server, IPC surface. |
| `ampere/src/preload` | Electron preload | The **only** bridge. Every main capability the renderer uses is explicitly exposed here. |
| `ampere/src/renderer` | Chromium | All UI and all audio analysis: library views, the compact/classic Winamp player, the shader visualizer, and the Riemann Navigator. |
| `comics/*` | Electron | The same three-layer shape for `.cbz`: scanner, database, reader UI. Independent process and database. |
| `shared/` | bundled TS | `MediaTypeConfig` (how a media type describes its columns and entities), `StorageProvider`, and the attention-decay function for feedback weighting. |
| `vq/` | Python CLI | Embedding, training, and export. Produces `cache/ampere_index.sqlite`. |
| `resources/bin/fp-evict` | Swift helper | Evicts a materialized cloud file via `FileManager.evictUbiquitousItem` — the one thing Node cannot do. |

**Layering:** `ampere` → `shared` ← `comics`. No sideways imports, no upward imports.
`vq` sits outside the graph; its only edge is a file.

### Process boundaries inside Ampere

Three windows can exist: the **library** window, the **compact/classic** player window
(`?mode=compact`, frameless, always-on-top), and full-screen visualizer surfaces. They coordinate
two ways — IPC forwarding through main for player commands and state, and `localStorage` `storage`
events for theme and skin propagation. The skin object is deliberately flat JSON so this works.

### Why an HTTP server for audio

`<audio>` needs HTTP range requests for correct FLAC seeking, and cloud-only files need a
materialization step before the first byte can be served. A loopback-only server on a random port
provides both; the renderer references tracks as `http://127.0.0.1:<port>/<encoded-path>` rather
than `file://`.

## 6. Entity / data model

**Ampere** (`library.db`, `SCHEMA_VERSION = 5`). The `tracks` table is the source of truth.

| Table | Kind | Role |
|-------|------|------|
| `tracks` | **source** | File path, tags, `embedded_id`, play count, rating, sync status, `inferred_rating`. |
| `playlists` / `playlist_tracks` | **source** | User playlists. |
| `storage_sources` | **source** | Registered local and Proton Drive roots. |
| `track_feedback` | **source** | Append-only log of user signals (completes, skips, explicit reactions) with context. Never lose a signal. |
| `similarity_triplets` | **source** | Blind "is A or B closer to X" judgements — human ground truth for evaluating the feature spaces. |
| `app_settings` | **source** | Persisted preferences (cache limit, window mode, …). |
| `track_artists` / `track_album_artists` | *derived* | Searchable artist indexes, rebuilt from `tracks.artist` / `tracks.album_artist` on a `SCHEMA_VERSION` bump. |
| `track_features` | *derived* | 56-dim Meyda vector + UMAP coordinates. Recomputable from audio. |
| `track_semantic` | *derived* | CLAP embedding + RQ-VAE Semantic ID + its own UMAP coordinates. Imported from `vq`. |
| `semantic_code_names` / `semantic_meta` | *derived* | Human-readable code labels and index provenance. |
| `index_versions` | *derived* | Which index a stored artifact was computed against. |
| `sync_queue` | *derived* | Pending cloud operations. |

**Identity.** A track is identified by an `embedded_id` written into the file's own tags, not by
path. Paths change; identity should not. ProtonComics does the same with a `ProtonId` in
`ComicInfo.xml`. Scanning resolves in three tiers: match `embedded_id`, else match `file_path`
(and backfill the id), else insert.

**Two independent feature spaces.** `track_features` (Meyda DSP, extracted in-app, always
available) and `track_semantic` (CLAP, requires the offline `vq` run) each carry their **own**
UMAP coordinates. Switching source in the navigator never clobbers the other map. DSP clusters by
timbre and loudness; CLAP clusters by genre, mood, and instrumentation. Both are metadata-free.

**Ratings are three-layered:** an explicit `rating` the user sets (always wins), an
`inferred_rating` computed from the feedback log, and the raw `track_feedback` events the
inference is derived from. The log is the durable artifact — the inference can always be rerun.

**ProtonComics** (`SCHEMA_VERSION = 2`) mirrors the shape with `comics`, `content_feedback`, and
`storage_sources`. Separate database, no foreign keys across products.

## 7. Key flows

**Scan → library.** Walk a registered source via `StorageProvider` → extract metadata → three-tier
upsert on `embedded_id` / `file_path` / insert → backfill missing embedded ids by writing tags →
remove orphans **scoped to the scanned root only**. Progress streams to the renderer over IPC.

**Play.** Renderer requests a URL from the loopback server → main materializes the file if it is
cloud-only → range-served bytes reach `<audio>` → the analyser bridge taps the stream for the
spectrum, the visualizer, and feature extraction → completion or skip writes a `track_feedback`
row with its context.

**Analyze → navigate.** Meyda extracts a 56-dim vector per track in a background worker (resumable,
abortable) → z-score normalize → UMAP to 2D/3D → persist coordinates → the Three.js scene renders
one instanced point cloud with bloom, fly controls, and click-to-play. Optionally, `vq` supplies a
second, richer space by the same pipeline shape.

**Sequence.** When a navigation mode is active it registers `driftNext`, overriding `nextTrack()`.
Modes walk the **feature space**, not the UMAP projection — the projection is for human eyes, the
distances that matter are the real ones. The chosen next track is decided during playback so it can
be prefetched before it is needed.

**Semantic index (manual, offline).** `vq` embeds tracks with CLAP → trains the RQ-VAE → exports
`cache/ampere_index.sqlite` → Ampere's importer ATTACHes it, joins `clap_index.path` to
`tracks.file_path` to resolve real track ids, and upserts **derived tables only**. Rollback is
`DELETE FROM track_semantic`.

## 8. Cross-cutting concerns

**Data integrity.** See §3 and the binding rules in [`../CLAUDE.md`](../CLAUDE.md). Structurally,
integrity rests on: one owner of the SQLite connection (`LibraryDatabase`), a single `SCHEMA_SQL`
constant, and the source/derived split that makes destructive rebuilds safe by construction.

**Capability degradation.** `stores/capabilities.ts` counts semantic and feature rows. Modes that
need the Semantic ID hierarchy (Journey) are unavailable without it; modes needing only comparable
vectors (Drift, Session) work from either source. Absent capability → hidden control or a plain
explanation, never a dead button.

**Performance.** Large libraries are the stress case. The track list is windowed and rendered so a
`currentTime` tick re-renders no rows and a track switch re-renders two — this is asserted by
tests, not assumed. Navigation prefetches its decision so cloud latency is paid before playback
needs the file.

**Storage and eviction.** Cloud-only files are materialized on demand and evicted LRU under a
configurable budget, with pinning to exempt tracks. Eviction of a cloud file requires the Swift
`fp-evict` helper.

**Observability.** Navigation decisions log the features they used, per-mode performance is
measured against index versions, and a monitoring panel is descriptive rather than prescriptive —
it reports what the sequencer did, it does not tell the user what to do.

**Error handling.** A capability probe that fails counts as zero rather than throwing. A scan
failure on one file must not abort the walk. Nothing silently substitutes data to keep going —
that would violate §3.2.
