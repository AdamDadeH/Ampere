# Ampere — Priorities

## The Vision

Ampere is a love letter to the peak of 90s/2000s internet culture — the era of warez sites, demoscene, Winamp skins, and MilkDrop visualizations. The compact player should make people say _"why did they go this far"_ and then immediately download a .wsz skin from the Winamp Skin Museum.

This is not a music player that happens to support skins. This is a skin engine that happens to play music.

---

## P0 — Go Deeper on Winamp

**These are the only priorities that matter right now.**

### Full Sprite Sheet Rendering

The current importer extracts `MAIN.BMP` as a background image and samples colors. That's the tutorial level. The real Winamp skin format has 11 sprite sheets with pixel-perfect layouts:

| File | Size | Contents |
|------|------|----------|
| `MAIN.BMP` | 275x116 | Background frame (already supported) |
| `CBUTTONS.BMP` | 136x36 | Transport buttons — prev, play, pause, stop, next, eject. 23x18px each, 2 rows (normal/pressed) |
| `TITLEBAR.BMP` | 275x58 | Title bar states (active/inactive), window shade mode, close/minimize/shade buttons |
| `POSBAR.BMP` | 307x10 | Seek bar track (248x10) + thumb (29x10, 2 states) |
| `VOLUME.BMP` | 65x433 | 28 volume level sprites (65x13 each) + thumb (14x11, 2 states) |
| `BALANCE.BMP` | 47x433 | Balance slider sprites + thumb |
| `SHUFREP.BMP` | 92x85 | Shuffle/repeat toggle buttons (active/inactive states) + EQ/PL buttons (23x12 each) |
| `MONOSTER.BMP` | 56x24 | Stereo indicator (29x12) + mono indicator (27x12) |
| `PLAYPAUS.BMP` | 42x9 | Play/pause/stop status icons |
| `NUMBERS.BMP` | 99x13 | Bitmap font digits 0-9 (9x13 each) for the time display |
| `TEXT.BMP` | 155x18 | Bitmap font (5x6 per character) for the scrolling title |

**Implementation approach:** Extract each sprite sheet, slice into individual sprites using the documented pixel coordinates, encode as data URLs, and apply via CSS `background-image` + `background-position` on the compact player components. This means refactoring the compact components to support image-based rendering alongside the current color-based rendering.

**Magenta transparency:** Winamp uses `#FF00FF` as a transparency key in BMPs. Every pixel of that exact color must be made transparent. This is how shaped/irregular skins work.

### Bitmap Font Rendering

`NUMBERS.BMP` contains 11 glyphs (digits 0-9 plus blank) at 9x13px each. The compact player's time display (`MM:SS / MM:SS`) should render using these glyphs instead of CSS text when a Winamp skin is active. This is the detail that makes people lose their minds.

`TEXT.BMP` contains a full character set at 5x6px per glyph. The scrolling marquee should render using these bitmap characters. Pixel-perfect. No anti-aliasing. `image-rendering: pixelated`.

### MilkDrop Visualizations via Butterchurn

[Butterchurn](https://github.com/jberg/butterchurn) is a WebGL implementation of MilkDrop — the legendary Winamp visualization plugin. It runs in the browser with Web Audio API. MIT licensed. ~thousands of presets available.

```
npm install butterchurn butterchurn-presets
```

```ts
const visualizer = butterchurn.createVisualizer(audioContext, canvas, {
  width: 800, height: 600
})
visualizer.connectAudio(audioNode)
visualizer.loadPreset(preset, 0.0) // 0 = instant, >0 = blend duration
visualizer.render() // call per frame
```

**Integration plan:**
1. Add a full-window visualization mode triggered from compact player (double-click the spectrum area, or a hotkey)
2. Render Butterchurn into a WebGL canvas that fills the compact player's LCD area — or goes fullscreen
3. Preset cycling — auto-advance through presets on a timer, or manual next/prev
4. Preset browser — searchable list of all available presets
5. Blend transitions between presets (Butterchurn supports this natively)
6. Audio source: tap the existing `captureStream()` → `AnalyserNode` pipeline, or create a new source node for Butterchurn

**Visualization modes in the compact LCD (escalating intensity):**
- Current: 32-bar spectrum analyzer (bars/mirrored/dots/waveform) ← already built
- New: Oscilloscope (classic sine wave from frequency data)
- New: VU meter (stereo level meters with peak hold)
- New: MilkDrop via Butterchurn (the final boss)

### Advanced Skin Color Customization

Inspired by Quinto Black CT's RGB Color Changer — "change the color of almost any element in the skin":

- Per-element color overrides (shell, display, buttons, seekbar, titlebar — independently)
- Color theme presets that can be saved/exported/shared
- Hue rotation slider that shifts the entire skin's palette
- VISCOLOR.TXT full support: use all 24 lines to render gradient spectrum bars (peak→base color ramp) instead of single-color bars

### PLEDIT.TXT Support

Winamp's playlist editor color scheme file. Format:

```
[Text]
Normal=#00FF00
Current=#FFFFFF
NormBG=#000000
SelectedBG=#0000FF
Font=Arial
```

This could inform the library view's colors when a Winamp skin is active — making the entire app feel like a unified skin, not just the compact player.

---

## P1 — Queue Management

This is the other priority because it makes the player actually usable day-to-day.

### Visible Queue
- Queue sidebar/panel showing upcoming tracks
- Currently playing track highlighted
- Shows track title, artist, duration

### Queue Actions
- "Play Next" — right-click a track → insert after current
- "Add to Queue" — right-click → append to end
- Drag-to-reorder within the queue
- Remove individual tracks from queue
- Clear queue

### Queue Persistence
- Queue survives window close/reopen
- Queue state synced to compact player (show position in queue)

---

## P2 — Core Player Features

### Keyboard & Media Keys
- Spacebar: play/pause
- Arrow keys: seek (left/right), volume (up/down)
- Cmd+Left/Right: prev/next track
- System media key integration (macOS `MediaSession` API)
- Headphone button support

### Gapless Playback
- Preload next track into a second `<audio>` element
- Crossfade at zero duration at track boundary
- Critical for album listening (Pink Floyd, classical, live)

### Playlists
- Create, rename, delete playlists
- Add tracks via drag-and-drop or right-click
- Playlist stored in SQLite (not a separate file format)
- Smart playlists (auto-generated: most played, recently added, top rated)

---

## P3 — Distribution & Polish

### Packaging (electron-builder)
- `.dmg` for macOS, `.exe`/`.msi` for Windows
- Auto-updater
- GitHub Releases integration
- Code signing (eventually)

### File Watching
- `fs.watch` on scanned directories
- Auto-detect new/removed/modified files
- Background re-scan without blocking UI

### Settings Panel
- Manage scan folders (add/remove multiple)
- Audio output device selection
- Visualization preferences
- Theme/skin preferences
- General preferences (start minimized, system tray, etc.)

### Multiple Folder Support
- Scan multiple directories
- Track which folders are active
- Per-folder rescan

---

## P4 — Future Ambitions

- Last.fm scrobbling
- Lyrics display (synced + static)
- Crossfade between tracks (configurable duration)
- Equalizer (10-band, with presets)
- ReplayGain / volume normalization
- Listening statistics dashboard
- System tray mode
- `.wal` modern Winamp skin format
- Skin sharing / community gallery

---

## PRD Gap Review

The original PRD envisioned a cloud-first Proton Drive music manager. The app has evolved into something far more interesting — a local-first music player with deep Winamp skin fidelity. Here's what from the PRD still matters, what's done, and what's parked.

### Already Built
- Library scanning + metadata extraction (MP3, FLAC, M4A, OGG, OPUS, WAV, AAC, WMA, AIFF)
- SQLite metadata database with play counts, ratings, listening history
- Embedded track IDs (AMPERE_ID) for identity across file moves
- Album art extraction + grid view
- Integrated audio player with transport controls
- Compact mode (Winamp-inspired mini player with spectrum analyzer)
- 8 built-in themes + Winamp .wsz skin import
- Artist/album sidebar browsing
- Search functionality

### Still Relevant (captured in priorities above)
- **Playlists** (P2) — create, rename, delete, drag-and-drop
- **Smart playlists** (P2) — most played, recently added, top rated
- **Queue management** (P1) — play next, add to queue, reorder
- **Keyboard & media keys** (P2) — spacebar, arrows, system media keys
- **Gapless playback** (P2) — critical for album listening
- **File watching** (P3) — auto-detect new/removed/modified files
- **Settings panel** (P3) — scan folders, output device, preferences
- **Multiple folder support** (P3) — scan multiple directories
- **Packaging** (P3) — .dmg, auto-updater, GitHub Releases

### Parked (not the vision right now)
- **Cloud sync / Proton Drive integration** — the app went local-first. Cloud sync may return someday but it's not the mission.
- **Sync Manager UI** — dependent on cloud sync
- **Cache eviction / storage management** — local-first means everything is local
- **Metadata editing** — nice to have, not a priority over skin depth
- **Mobile companion app** — way out
- **Collaborative playlists** — way out

### The Pivot
The PRD was practical. The app became something else — a vehicle for reviving the golden age of desktop customization. The skin engine, the visualizations, the pixel-perfect bitmap fonts — that's the soul. Everything else serves it.

---

## Reference Links

- [Winamp Skin Museum](https://skins.webamp.org) — thousands of classic .wsz skins
- [Butterchurn (MilkDrop WebGL)](https://github.com/jberg/butterchurn) — MIT, runs in browser
- [Webamp](https://github.com/captbaritone/webamp) — pixel-perfect Winamp 2 in the browser, reference implementation
- [Quinto Black CT](https://quinto-black-ct.info/) — modern Winamp skin showing the depth of customization possible
- [Winamp Skin Format](https://winampskins.neocities.org/base) — sprite sheet reference
- [Winamp Skin Spec (Archive Team)](http://fileformats.archiveteam.org/wiki/Winamp_Skin) — file format documentation
