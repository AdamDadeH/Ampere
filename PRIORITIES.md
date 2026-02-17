# Ampere + Riemann — Priorities

## The Vision

Two names. Two ideas. One system.

**Ampere** is the current — electricity, signal, energy. A love letter to the peak of 90s/2000s internet culture — warez sites, demoscene, Winamp skins, MilkDrop visualizations. A skin engine that happens to play music. The compact player should make people say _"why did they go this far"_ and then immediately download a .wsz skin from the Winamp Skin Museum.

**Riemann** is the geometry — curved space, manifolds, the shape that your music inhabits when you stop thinking of it as a list. Your library embedded in acoustic feature space is a Riemannian manifold. The distance between tracks isn't Euclidean — it's warped by perception, by timbre, by the nonlinear way humans hear. Geodesics on that manifold are optimal playlists. Curvature tells you where genres blend. Your listening history shapes the metric.

Ampere is the body. Riemann is the mind. Together: a player that knows the shape of your music and lets you move through it.

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

## P4 — Riemann: The Geometry of Music

These aren't features. They're a thesis: **your music library has a shape, and you should be able to walk through it.**

Riemann is the module that computes audio embeddings, builds the manifold, renders the navigator, and hands tracks back to Ampere for playback. It can live as a view within the app or as a standalone full-screen experience.

### The Navigator — 3D Audio-Reactive Library Map

Your library is a universe. Every track is a point in 3D space, positioned by its acoustic DNA — spectral profile, tempo, energy, harmonic content. Similar tracks cluster into constellations. Genres form galaxies.

**The experience:**
- **Zoomed out** — nebulae of clusters. Each hums with a composite audio signature — the spectral average of its tracks. You *hear the topology* before you see individual songs. The ambient drone of your shoegaze region. The rhythmic pulse from hip-hop. The bright shimmer of your jazz corner.
- **Flying closer** — the cluster resolves into individual points. The composite fades. The most-played tracks in the neighborhood become audible in spatial audio (Web Audio `PannerNode` with HRTF), panned in 3D based on their position relative to your camera.
- **Close approach** — a single track grows louder. Cross its threshold and it becomes the active track — full playback, full fidelity. Surrounding geometry reacts. Neighboring tracks pulse gently, showing where you could go next.
- **The trail** — your listening history traces a glowing path through the space. Over weeks, you see your patterns — the routes you take, the regions you return to, the unexplored territories at the edges.

**The aesthetic:** Nier Automata's hacking scenes meets REZ — black void, glowing geometric nodes, the camera pulling through space, everything pulsing and alive. The darkness between the nodes matters as much as the nodes themselves. Wireframe geometry, particle systems, bloom and glow. Not a visualization bolted onto a player — the player *is* the visualization.

**Technical architecture:**
- Audio feature extraction: spectral centroid, MFCCs, tempo, RMS energy, chromagram — via Essentia.js or lightweight ONNX model running locally
- Dimensionality reduction: UMAP projecting high-dimensional audio features into 3D coordinates (better than t-SNE for preserving global structure)
- Rendering: Three.js with instanced meshes for thousands of track particles, bloom post-processing, wireframe aesthetic
- Spatial audio: Web Audio `PannerNode` for 3D positioning, distance-based gain rolloff
- LOD audio: zoomed-out clusters play a "spectral summary" (average FFT of member tracks rendered as noise-shaped drone), zooming in crossfades to actual tracks
- Interaction: WASD/gamepad flight, mouse look, scroll to zoom, click to play

### Content-Informed Recommendations

Not collaborative filtering ("people who liked X liked Y"). Not metadata matching ("same genre tag"). **Acoustic similarity** — what does the music actually *sound like?*

- Extract per-track audio embeddings from the raw waveform (spectral features, rhythm patterns, harmonic structure, timbre fingerprint)
- Build a similarity graph: every track connected to its K nearest neighbors in embedding space
- Playlist generation as *path planning through the graph*: define a mood trajectory ("start mellow, build energy, peak, cool down") and find the optimal route
- The EQ settings you save are implicit taste signal — if you boost bass on certain tracks, you prefer warmth in that region of the space
- Listening patterns as gravity: frequently-played tracks warp the space around them, pulling recommendations toward your actual taste rather than algorithmic assumptions
- All local. No cloud. Your embeddings, your graph, your data.

### Demoscene Visualization Engine

Winamp had MilkDrop. We go further. A shader-based visualization engine that channels the warez/demoscene aesthetic:

- **Fragment shader pipeline**: audio frequency data → GLSL uniforms → real-time procedural graphics
- **Classic effects library**: plasma, tunnel flythrough, fractal flames, metaballs, raymarched signed distance fields, Menger sponges, infinite zoom fractals — all audio-reactive
- **Preset system**: ship with curated presets, but expose a mini Shadertoy editor for users to write their own
- **Beat detection**: not just amplitude — detect kicks, snares, transitions. Visuals that respond to musical structure, not just volume
- **Integration with The Navigator**: when playing a track in the 3D map, the demoscene visualization wraps around the active node — the geometry of the space becomes the visualization canvas
- **Butterchurn first**: start with the existing MilkDrop WebGL port for thousands of classic presets, then layer custom shaders on top

### Intelligent Transitions

Go beyond crossfade. The space between tracks is sacred:

- BPM detection + beat phase alignment for seamless tempo-matched transitions
- Key detection (chromagram analysis) — prefer transitions between harmonically compatible keys
- Energy curve analysis — match the outro energy of the outgoing track to the intro energy of the incoming
- Auto-DJ mode: the system sequences your queue to minimize jarring transitions while maximizing discovery
- This feeds directly into The Navigator — the "flight path" through the 3D space IS the playlist, and transitions are the smoothness of the curve

### Time Machine Analytics

You're already tracking play counts and timestamps in SQLite. Over months of listening:

- Personal listening timeline — "Your 2026 in Music"
- Mood patterns: what do you listen to at 2am vs 8am? Rainy days vs sunny?
- Genre phase transitions: track how your taste drifts over weeks
- Rediscovery alerts: "You haven't visited this region of your library in 3 months"
- Listening streaks, deep-dive sessions, one-off explorations
- Heat map overlay on The Navigator — see which regions you've explored thoroughly and which remain uncharted

### Live Effects Rack

The 10-band EQ is the beginning. Web Audio gives us everything:

- Reverb (ConvolverNode with impulse responses — cathedral, plate, spring)
- Delay / echo
- Dynamic compression
- Stereo widening
- Pitch shift / time stretch
- Modular drag-and-drop effects chain UI
- Per-track effect presets that persist
- "Studio mode" panel in the classic layout

---

## P5 — Original Future Ambitions (Still Valid)

- Last.fm scrobbling
- Lyrics display (synced + static)
- Crossfade between tracks (configurable duration)
- ReplayGain / volume normalization
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

And then Riemann happened. The app isn't just reviving the past — it's building something that never existed: a music player where your library has geometry, where listening is navigation, where the space between songs is as meaningful as the songs themselves.

---

## Reference Links

- [Winamp Skin Museum](https://skins.webamp.org) — thousands of classic .wsz skins
- [Butterchurn (MilkDrop WebGL)](https://github.com/jberg/butterchurn) — MIT, runs in browser
- [Webamp](https://github.com/captbaritone/webamp) — pixel-perfect Winamp 2 in the browser, reference implementation
- [Quinto Black CT](https://quinto-black-ct.info/) — modern Winamp skin showing the depth of customization possible
- [Winamp Skin Format](https://winampskins.neocities.org/base) — sprite sheet reference
- [Winamp Skin Spec (Archive Team)](http://fileformats.archiveteam.org/wiki/Winamp_Skin) — file format documentation
