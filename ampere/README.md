# Ampere

A desktop music player built with Electron, React, and SQLite. Features a library browser with full metadata support and a compact Winamp-inspired mini player with a real-time spectrum analyzer.

## Getting Started

```bash
npm install                # from the monorepo root
npm run rebuild            # rebuild better-sqlite3 against current Electron headers
npm run dev                # development with hot reload
npm run build              # production renderer/main bundle (no app packaging)
npm run dist               # produce dist/mac-arm64/Ampere.app — drag to /Applications
npm run dist:dmg           # like dist, but as a .dmg installer
```

Requires Node.js 18+ and Xcode CLT (for the native SQLite module).

First launch of the packaged app: **right-click → Open** because the build
is unsigned.

User data lives at `~/Library/Application Support/ampere/library.db` —
shared between dev mode and the packaged app. See
[`CLAUDE.md`](CLAUDE.md#where-user-data-lives) for the why.

## Usage

### Library Mode

Launch the app to see the library browser. Click **Select Folder** to scan a directory of music files. Supported formats: MP3, FLAC, M4A, OGG, OPUS, WAV, AAC, WMA, AIFF.

The library tracks play counts, ratings, and displays full metadata (artist, album artist, bitrate, sample rate, codec). Use the sidebar to browse by artist or album.

### Compact Mode

Switch to the compact player from library mode. The compact player is a 400x150px frameless always-on-top window with:

- Scrolling marquee (artist - title)
- 32-bar real-time spectrum analyzer
- Transport controls (shuffle, prev, play/pause, stop, next, repeat)
- Seek bar and volume slider

### Themes

8 built-in themes, switchable from the theme picker:

| Theme | Style | Spectrum |
|-------|-------|----------|
| Midnight | Flat, purple accents | Bars |
| Synthwave | Neon pink/cyan | Mirrored |
| Terminal | Green on black CRT | Bars |
| Frostbite | Icy blue | Dots |
| Ember | Fire glow, beveled | Bars |
| Vinyl | Warm browns | Bars |
| Vapor | Dreamwave pastels | Waveform |
| Hi-Fi | Clean white | Dots |

### Winamp Skin Import

Right-click anywhere on the compact player and select **"Load Winamp Skin..."** to load a classic Winamp `.wsz` skin file. The player extracts textures and colors from the skin and applies them to the compact player.

- **"Clear Custom Skin"** appears in the same context menu when a skin is active
- Custom skins persist across app restarts
- Custom skins take precedence over theme skins until cleared
- Thousands of `.wsz` skins are available at the [Winamp Skin Museum](https://skins.webamp.org)

**What gets extracted from a `.wsz` file:**

| File | Used for | Required |
|------|----------|----------|
| `MAIN.BMP` | Shell background texture, sampled for shell/display colors | Yes |
| `TITLEBAR.BMP` | Titlebar background overlay | No |
| `VISCOLOR.TXT` | Spectrum analyzer colors, accent color | No |

Files are matched case-insensitively. Both BMP and PNG formats are supported.

**What is NOT currently supported:**
- Button sprite sheets (`BUTTONS.BMP`) — would need component refactor for image-based buttons
- Bitmap fonts (`TEXT.BMP`, `NUMBERS.BMP`)
- Magenta (#FF00FF) transparency
- `.wal` modern skin format
- EQ/playlist window skinning

---

## Architecture

```
src/
  main/                    # Electron main process
    index.ts               # Window management, IPC handlers, audio server
    database/              # SQLite via better-sqlite3
    scanner/               # File system scanner + metadata extraction
    storage/               # Storage provider abstraction
  preload/
    index.ts               # Context bridge — ElectronAPI interface
  renderer/
    src/
      App.tsx              # Root — routes between library and compact mode
      stores/
        library.ts         # Zustand — tracks, queue, playback state
        theme.ts           # Zustand — theme selection, custom skin persistence
      themes/
        types.ts           # CompactSkin, CompactSkinSeed, Theme interfaces
        compact-builder.ts # buildCompactSkin() factory
        skins.ts           # 8 built-in theme definitions
        wsz-importer.ts    # Winamp .wsz skin extraction + color mapping
        index.ts           # Public exports
      components/
        compact/           # Compact player components (all inline-styled from skin)
          CompactPlayer.tsx
          CompactTitleBar.tsx
          CompactLCD.tsx     # Marquee + spectrum canvas
          CompactTransport.tsx
          CompactSeekBar.tsx
          CompactVolume.tsx
          compact.css        # Layout only — no colors
        PlayerBar.tsx
        AudioEngine.tsx
        Sidebar.tsx
        TrackList.tsx
        ...
```

### Library, Scanner, and Audio Server

**`LibraryDatabase` (`src/main/database/index.ts`)** is the only owner of
the SQLite connection. All queries are encapsulated as methods on this
class. Schema lives in `schema.ts` as one constant `SCHEMA_SQL` plus a
`SCHEMA_VERSION` integer; junction tables (`track_artists`,
`track_album_artists`) are rebuilt from source columns whenever the version
bumps.

Tables:

| Table | Role | Derived? |
|-------|------|----------|
| `tracks` | source of truth — file path, tags, play count, rating, sync status | No |
| `playlists` / `playlist_tracks` | user playlists | No |
| `storage_sources` | registered local + Proton Drive roots | No |
| `track_feedback` | per-event user signals (skips, completes, seeks) | No |
| `track_artists` / `track_album_artists` | searchable artist indexes | **Yes** — rebuilt from `tracks.artist` / `tracks.album_artist` |
| `track_features` | 56-dim audio vector + UMAP coordinates | **Yes** — recomputable from audio files |
| `sync_queue` | pending Proton Drive operations | No |

**`FolderScanner` (`src/main/scanner/index.ts`)** walks a directory via
`StorageProvider`, extracts metadata via `MusicMetadataExtractor`, and
upserts into the DB. It dedupes first by `embedded_id` (the music tag's
unique ID) then by file path. Progress events stream to the renderer via
IPC.

**Audio HTTP server (`src/main/index.ts`)** is a loopback-only HTTP server
on a random port, started during app boot. It serves files from the
filesystem with HTTP range request support so `<audio>` can seek FLACs
correctly, and intercepts Proton Drive paths to trigger on-demand
materialization before serving. Renderer code references tracks via
`http://127.0.0.1:<port>/<encoded-path>` rather than `file://`.

**Storage providers (`src/main/storage/`)** abstract the source. Today:
`LocalStorageProvider` for filesystem, plus Proton Drive helpers
(`proton-drive.ts`) that detect mounted Proton Drive folders, check
materialization status, and request downloads. `CacheManager` enforces an
LRU cap on materialized cloud files.

### Key Design Decisions

**Inline styles from skin objects, not CSS variables.** The compact player receives a `CompactSkin` object and every component applies styles directly. This means zero coupling between the compact player and CSS — a skin fully describes its appearance.

**`CompactSkin` is a flat data object.** It contains only strings, numbers, and a single RGB tuple. No functions, no DOM references, no blob URLs that can't serialize. This is critical — the skin is persisted to `localStorage` as JSON and synced across windows via `storage` events.

**`buildCompactSkin()` is a pure function.** Give it 4 hex colors + a style/spectrum choice and it derives every border, shadow, gradient, and glow in the compact player. The Winamp importer doesn't need to understand CompactSkin's 60+ properties — it samples colors from the skin, calls the builder, and optionally overrides a few fields.

**`shellBackground` and `displayBackground` seed overrides.** These optional fields on `CompactSkinSeed` accept any CSS `background` value. The builder passes them through instead of generating gradients. The Winamp importer uses this to inject `url()` references to the extracted BMP textures.

### IPC Patterns

```
Renderer → Main (request/response):
  ipcRenderer.invoke('channel') → ipcMain.handle('channel')

Main → Renderer (one-way push):
  webContents.send('channel') → ipcRenderer.on('channel')

Compact ↔ Library (cross-window):
  Compact sends player commands → main forwards to library
  Library sends player state → main forwards to compact
```

### Data Flow: Theme & Skin

```
                    ┌─────────────────────┐
                    │  localStorage       │
                    │  'ampere-theme' │ ──── theme ID (string)
                    │  'ampere-       │
                    │   compact-skin'      │ ──── CompactSkin (JSON)
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  useThemeStore       │
                    │  (zustand)           │
                    │                     │
                    │  currentThemeId     │
                    │  customCompactSkin  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  useCompactSkin()    │
                    │                     │
                    │  custom skin set?   │
                    │    yes → return it  │
                    │    no  → look up    │
                    │          theme by   │
                    │          ID, return │
                    │          .compact   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  CompactPlayer       │
                    │  passes skin to all │
                    │  child components   │
                    └─────────────────────┘
```

Cross-window sync: when one window writes to `localStorage`, the other receives a `storage` event and updates its zustand state to match.

---

## Riemann Navigator — Developer Guide

A 3D library map where tracks are positioned by **what they sound like**,
not by metadata. Implemented in `src/renderer/src/riemann/`.

**Hard rule: positioning is derived from audio signal only.** If you find
yourself reaching for genre, artist, or year to influence layout, stop —
that belongs to a different view.

### Pipeline

```
audio file (via main process IPC)
   │
   ▼
Meyda  (extract-features.ts)
   │   spectral centroid, rolloff, flatness, MFCC[0..12], RMS,
   │   chroma[0..11], zero-crossing rate, ... → 56-dim vector
   ▼
track_features.features_json           (per-track, persisted)
   │
   ▼
UMAP   (umap-projection.ts)            n × 56 → n × 3
   │   configurable: dim (2D/3D), nNeighbors, minDist, spread
   ▼
track_features.umap_x/y/z              (persisted, recomputable)
   │
   ▼
Three.js scene  (RiemannNavigator.tsx)
   │   • point cloud (one sphere per track)
   │   • bloom post-processing
   │   • fly controls + raycaster (click to play)
   │   • drift mode toggle (overrides nextTrack)
```

### Files

| File | Role |
|------|------|
| `extract-features.ts` | Meyda wrapper. Decodes audio in renderer, returns 56-dim Float32Array. |
| `feature-worker.ts` | Iterates tracks-without-features, calls extractor, persists, emits progress. Supports abort. |
| `umap-projection.ts` | Wraps `umap-js`. Pure function: vectors in, coordinates out. |
| `navigation.ts` | KNN graph from feature vectors; drift state machine; foundation for future modes (e.g., "follow tonal neighbors"). |
| `RiemannNavigator.tsx` | The Three.js scene, settings UI, layout controls, drift toggle. |
| `*.test.ts` | Vitest specs for projection and navigation logic. |

### Adding a navigation mode

Modes register a `driftNext` callback on the library store that overrides
`nextTrack()`. The store doesn't know which mode is active — it just calls
the callback if set. To add a mode:

1. Implement a `next(trackId, graph): trackId` selector in
   `navigation.ts` (or a new file).
2. In `RiemannNavigator.tsx`, expose a UI control that wires the selector
   to the store's `setDriftNext()` setter when active, and clears it on
   deactivate.
3. Tests go in `navigation.test.ts`.

### Re-projection

UMAP is non-deterministic across runs. Coordinates persist to
`track_features.umap_x/y/z` but they're derived — recomputing is cheap and
expected when feature dimensionality, distance metric, or major UMAP
params change. Treat coordinates as a cache, never as user data.

---

## Theme System — Developer Guide

### Creating a New Built-in Theme

Add a `Theme` object to `src/renderer/src/themes/skins.ts`:

```ts
export const mytheme: Theme = {
  id: 'mytheme',
  name: 'My Theme',
  description: 'A short description',
  colors: {
    'bg-primary': '#0f0f0f',
    // ... all ThemeColors fields (see types.ts)
  },
  effects: {
    'shadow-glow': '...',
    'text-shadow': '...',
    'font-family': "'Inter', sans-serif",
    'radius-sm': '0.25rem',
    'radius-md': '0.5rem',
    'radius-lg': '0.75rem',
  },
  previewColors: ['#color1', '#color2', '#color3', '#color4', '#color5'],
  compact: buildCompactSkin({
    shell: '#2a2a2e',     // Main body color
    display: '#0c0c14',   // LCD background
    text: '#c4b5fd',      // LCD text + spectrum bars
    accent: '#a855f7',    // Active buttons, seek fill, accents
    style: 'beveled',     // 'beveled' | 'flat' | 'pill'
    spectrum: 'bars',     // 'bars' | 'mirrored' | 'dots' | 'waveform'
  }),
}
```

Then add it to the `allThemes` array in the same file.

### `CompactSkinSeed` Reference

| Field | Type | Description |
|-------|------|-------------|
| `shell` | `string` (hex) | Main body/chrome color. Borders, buttons, and gradients derive from this. |
| `display` | `string` (hex) | LCD area background. Usually very dark. |
| `text` | `string` (hex) | LCD text and spectrum bar color. |
| `accent` | `string` (hex) | Active state highlights — seek fill, active button icons, toggle indicators. |
| `style` | `'beveled' \| 'flat' \| 'pill'` | Button shape. Beveled = retro 3D, flat = minimal, pill = rounded with drop shadow. |
| `spectrum` | `'bars' \| 'mirrored' \| 'dots' \| 'waveform'` | Spectrum analyzer rendering style. |
| `shellBackground?` | `string` (CSS) | Override shell gradient with any CSS `background` value (e.g., `url()` for images). |
| `displayBackground?` | `string` (CSS) | Override display gradient similarly. |

### How `buildCompactSkin()` Derives Colors

From the 4 input hex colors, it uses `lighten()`, `darken()`, and `alpha()` to produce:
- Shell: 3-stop gradient (light → base → dark), 3D beveled borders
- Titlebar: top-to-bottom gradient from shell
- Display: deep inset shadow, subtle scanline overlay, glowing text shadow
- Buttons: style-dependent gradients (beveled gets 3 layers, flat is solid, pill has drop shadow)
- Seekbar/Volume: sunken groove from darkened shell, accent fill with glow, 3D thumb
- Spectrum: RGB tuple extracted from `text` for canvas rendering

---

## Winamp Skin Importer — Developer Guide

### Pipeline

```
.wsz file (ZIP)
  │
  ├── MAIN.BMP ─────────────► blob URL ──► shell background image
  │                                │
  │                    ┌───────────┘
  │                    ▼
  │              sampleRegion()
  │              ├── full image ──► shellHex (avg color)
  │              └── LCD region ──► displayHex (avg color)
  │
  ├── TITLEBAR.BMP ──────────► blob URL ──► titlebar background overlay
  │
  └── VISCOLOR.TXT ──────────► parseViscolor()
                                ├── line 2 (peak) ──► spectrumHex
                                └── line 23 (osc) ──► accentHex
                                         │
                                         ▼
                                   ensureContrast()
                                   (vs. displayHex)
                                         │
                                         ▼
                               buildCompactSkin({
                                 shell, display, text, accent,
                                 shellBackground: url(...),
                                 displayBackground: gradient
                               })
                                         │
                                         ▼
                                   CompactSkin object
                                   (persisted to localStorage)
```

### Key Functions in `wsz-importer.ts`

| Function | Purpose |
|----------|---------|
| `importWszSkin(buffer)` | Main entry point. Takes raw `.wsz` bytes, returns `CompactSkin`. |
| `findFile(zip, name)` | Case-insensitive filename lookup. Handles skins that nest files in subdirectories. |
| `extractImage(zip, baseName)` | Tries both `.bmp` and `.png` extensions. Returns blob URL + loaded `HTMLImageElement`. |
| `sampleRegion(img, x, y, w, h)` | Draws image to offscreen canvas, reads pixel data, returns average RGB. |
| `parseViscolor(text)` | Parses Winamp's `VISCOLOR.TXT` format: `R,G,B // comment` per line. |
| `ensureContrast(fg, bg, minRatio)` | WCAG luminance contrast check. Brightens/darkens foreground until it meets the ratio. |

### Blob URL Lifecycle

The module tracks all created blob URLs in `activeBlobUrls[]`. When `importWszSkin()` is called, it revokes all previous URLs before creating new ones. This prevents memory leaks when switching between skins.

Note: blob URLs are runtime-only and don't survive serialization. When a skin is restored from `localStorage`, the background images reference data URLs or gradients — the blob URLs from the original import are gone. The `shellBackground` CSS property stored in the persisted `CompactSkin` will contain a `url(blob:...)` that becomes invalid after restart. This means **shell/titlebar textures don't survive restart** — only the sampled colors do. This is a known limitation; a future iteration could encode images as base64 data URLs for full persistence.

### VISCOLOR.TXT Format Reference

Winamp's `VISCOLOR.TXT` defines 24 colors for the spectrum analyzer and oscilloscope:

```
Line 0:     Spectrum background
Line 1:     Spectrum grid/text
Lines 2-17: Spectrum bar colors (peak → base, bright → dim)
Lines 18-22: Oscilloscope colors
Line 23:    Oscilloscope peak color
```

Each line: `R,G,B // optional comment` where R, G, B are 0-255.

The importer uses **line 2** (index 1, peak bar color) for the spectrum since it's the brightest and most visible. It uses **line 23** (or last available) for the accent color.

### Extending the Importer

Potential future work, roughly ordered by impact:

1. **Base64 persistence** — Encode BMP images as data URLs instead of blob URLs so shell/titlebar textures survive restart.
2. **Magenta transparency** — Winamp uses `#FF00FF` as a transparent color in BMPs. Strip these pixels for proper transparency.
3. **PLEDIT.TXT** — Playlist editor colors. Could inform the library view theme, not just the compact player.
4. **Button sprites** — `BUTTONS.BMP` contains transport button images. Would require refactoring compact components to use `<img>` or CSS `background-image` with `background-position` instead of SVG icons.
5. **Bitmap fonts** — `TEXT.BMP` and `NUMBERS.BMP` define pixel fonts. Would need a sprite-rendering text component.
6. **`.wal` format** — Modern Winamp skin format (XML-based). Entirely different parsing pipeline.
