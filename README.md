# ProtonMusic

A personal music-system monorepo. Currently houses **Ampere** — a desktop music
player with library management, real-time visualization, and a Riemann-style
3D library navigator.

## Layout

```
protonmusic/
├── ampere/         # Electron app — the music player
├── shared/         # @proton/shared — code shared between apps (storage, stores, media adapter)
├── comics/         # (separate workspace, not part of Ampere)
├── resources/      # Bundled assets — bin/, Winamp skin samples
└── package.json    # npm workspaces root
```

`shared/` is consumed via `@proton/shared` and bundled into Ampere at build
time (it has no runtime presence in `node_modules`).

## Run Ampere in development

```bash
cd ampere
npm install                     # from the monorepo root the first time
npm run rebuild                 # builds better-sqlite3 against the current Electron version
npm run dev                     # hot-reloading dev mode
```

Requires Node 18+ and the macOS build tools (Xcode CLT) for the native
SQLite module.

## Build Ampere as a clickable app

```bash
cd ampere
npm run dist                    # produces dist/mac-arm64/Ampere.app
```

Drag `Ampere.app` into `/Applications` (or wherever you keep apps), then pin
to the Dock. First launch may require **right-click → Open** because the
build is unsigned.

For a `.dmg` installer instead of a raw `.app`:

```bash
npm run dist:dmg
```

### Where Ampere stores your data

`~/Library/Application Support/ampere/`

- `library.db` — your library (tracks, playlists, ratings, play counts, audio features)
- Standard Electron caches alongside it

`main/index.ts` explicitly pins this path so dev mode and the packaged
`Ampere.app` share the same library. **Do not rename or move this directory
without coordinating a migration.**

## Where things live

| What | Where |
|------|-------|
| App entry | `ampere/src/main/index.ts` |
| Renderer entry | `ampere/src/renderer/src/App.tsx` |
| DB schema | `ampere/src/main/database/schema.ts` |
| File scanner | `ampere/src/main/scanner/` |
| Storage providers (local, Proton Drive) | `ampere/src/main/storage/` |
| Riemann 3D navigator | `ampere/src/renderer/src/riemann/` |
| Themes & Winamp skin importer | `ampere/src/renderer/src/themes/` |
| Compact / mini player | `ampere/src/renderer/src/components/compact/` |
| Visualizers | `ampere/src/renderer/src/visualizer/` |
| App icon source | `ampere/build/icon.svg` (regen → `icon.icns` if you change it) |

## Read these before changing anything that touches stored data

- [`../CLAUDE.md`](../CLAUDE.md) — data integrity rules (track artist vs. album artist, derived tables, no fallback logic, no migration arrays)
- [`ampere/CLAUDE.md`](ampere/CLAUDE.md) — Ampere-specific build/run commands, DB path, subsystem boundaries
- [`ampere/README.md`](ampere/README.md) — feature-level reference (themes, skins, Riemann, IPC patterns)
