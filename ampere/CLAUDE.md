# Ampere — Agent Guide

This file is for agents (and humans) modifying Ampere. The parent
[`../../CLAUDE.md`](../CLAUDE.md) defines repo-wide data integrity rules and
takes precedence over anything here.

## Stack at a glance

- **Electron 40 + Vite** (`electron-vite`)
- **React 19** renderer with **Tailwind v4**
- **SQLite** via `better-sqlite3` (native module, must be rebuilt against the
  current Electron headers — `npm run rebuild`)
- **Three.js** for the Riemann Navigator and several visualizers
- **Meyda** + **umap-js** for audio feature extraction and projection
- State: **Zustand** (one store per concern, no monolithic store)

## Commands

```bash
npm run dev          # hot-reloading dev (renders both library and compact windows)
npm run build        # produce out/ for the packaged app
npm run rebuild      # rebuild better-sqlite3 against the installed Electron version
npm run dist         # build + rebuild + package → dist/mac-arm64/Ampere.app
npm run dist:dmg     # like dist, but as a .dmg installer
npm run test         # vitest one-shot
npm run test:watch   # vitest watch
```

`npm run rebuild` is required after every `npm install` that touches the
Electron version. If `npm run dev` errors with `NODE_MODULE_VERSION`
mismatch, that's the fix.

## Where user data lives

```
~/Library/Application Support/ampere/library.db
```

`src/main/index.ts` pins `userData` to lowercase `ampere/` regardless of
`productName`. Keep it pinned — both dev mode and the packaged app
(`productName: "Ampere"`) must read the same DB. If you change this you will
orphan every user's library.

## Data integrity (Ampere specifics)

The parent CLAUDE.md is binding. The Ampere-specific corollaries:

- **`SCHEMA_SQL` in `src/main/database/schema.ts` is the only source of
  truth.** Bump `SCHEMA_VERSION` when derived tables (`track_artists`,
  `track_album_artists`) need to be rebuilt from source columns. Do **not**
  introduce a migrations array.
- **Source columns on `tracks`** (artist, album_artist, play_count, rating,
  date_added, sync_status…) are the user's data. Junction tables and
  `track_features` are derived — recomputable, never load-bearing.
- **`track_features.umap_x/y/z` is derived** from the 56-dim feature vector
  via UMAP. Re-projection is cheap; don't treat coordinates as canonical.
- **No silent fallbacks between artist and album_artist.** If
  `album_artist` is null, the UI should show "Unknown" or hide that view —
  never substitute `artist`.

## Subsystem map

### Main process (`src/main/`)

```
index.ts                 # window mgmt, IPC, audio HTTP server, app lifecycle
database/
  schema.ts              # SCHEMA_SQL + SCHEMA_VERSION (single source of truth)
  index.ts               # LibraryDatabase — all queries live here
scanner/
  index.ts               # FolderScanner — walks dirs, dedupes by embedded_id then path
  music-extractor.ts     # music-metadata wrapper
  tagger.ts              # node-taglib-sharp for write-back
  artist-parser.ts       # split "A; B & C" into discrete artists
storage/
  provider.ts            # StorageProvider interface + AUDIO_EXTENSIONS
  local-provider.ts      # filesystem implementation
  proton-drive.ts        # detect mounted Proton Drive, materialization status
  sources.ts             # storage_sources table helpers
  cache-manager.ts       # LRU eviction for cloud-cached files
```

The audio HTTP server (in `index.ts`) is loopback-only on a random port. It
exists so `<audio>` elements get range request support for FLAC seeking and
to gate Proton Drive files behind on-demand download.

### Renderer (`src/renderer/src/`)

```
App.tsx                  # routes between library, compact, riemann, demoscene
main.tsx                 # React root
stores/                  # Zustand: library, theme, ...
audio/                   # WebAudio engine glue
components/              # library UI (Sidebar, TrackList, PlayerBar, ...)
components/compact/      # the Winamp-style mini player
themes/                  # 8 built-in themes + Winamp .wsz importer
riemann/                 # 3D library navigator (see below)
visualizer/              # full-screen visualizers (Demoscene)
```

### Riemann Navigator (`src/renderer/src/riemann/`)

Audio-feature-driven 3D library map. **All positioning is derived from audio
signal — zero metadata involvement.** This is a hard rule.

| File | Role |
|------|------|
| `extract-features.ts` | Meyda → 56-dim vector (spectral centroid, MFCCs, RMS, chroma, ZCR) |
| `feature-worker.ts` | Background orchestrator with progress + abort |
| `umap-projection.ts` | UMAP dim-reduction (2D / 3D, configurable minDist/spread) |
| `navigation.ts` | KNN graph + drift state — extensible for future modes |
| `RiemannNavigator.tsx` | Three.js scene, bloom post, fly controls, raycaster |

Navigation modes register with the library store via a `driftNext` callback
that overrides `nextTrack()`. The store doesn't know which mode is active —
keep it that way.

### IPC patterns

```
Renderer → Main (request/response):
  ipcRenderer.invoke('channel') → ipcMain.handle('channel')

Main → Renderer (push):
  webContents.send('channel') → ipcRenderer.on('channel')

Compact ↔ Library (cross-window):
  Compact emits 'remote-player-command' → main forwards to library
  Library emits 'player-state-update' → main forwards to compact
```

When adding an IPC handler: register it in `setupIPC()` in
`src/main/index.ts` AND expose it via the preload context bridge in
`src/preload/index.ts`. Both ends must update together.

## Common gotchas

- **`@proton/shared` is bundled, not a runtime dep.** It lives in
  `devDependencies` so electron-builder doesn't try to package the symlink.
  Vite's `externalizeDepsPlugin({ exclude: ['@proton/shared'] })` inlines it
  into `out/`.
- **Native modules need `asarUnpack` entries** in the build config when
  added (currently better-sqlite3, bindings, file-uri-to-path).
- **Compact mode is a separate BrowserWindow** loaded with `?mode=compact`.
  `App.tsx` routes on that query param. The compact window is frameless,
  always-on-top, and 400×150 by default.
- **localStorage syncs across windows** via `storage` events — that's how
  themes and custom skins propagate from library to compact instantly.

## When you finish a change

- If you touched anything in `src/main/database/`, ask yourself whether
  `SCHEMA_VERSION` should bump (only when derived tables need a rebuild).
- If you touched IPC, check both `src/main/index.ts` and
  `src/preload/index.ts`.
- If you touched packaging (`build` block in `package.json`, native
  modules, `asarUnpack`), run `npm run dist` and launch the produced
  `Ampere.app` before declaring done.
