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

Riemann is the module that computes audio embeddings, builds the manifold, renders the navigator, and hands tracks back to Ampere for playback. It lives as a view within the library window.

### What's Built (v1)

The MVP is shipped and working. The foundation is solid enough to build everything below on.

**Feature extraction pipeline:**
- Meyda-based audio analysis — decodes each track at 22050Hz mono, slides 2048-sample frames with 1024 hop
- 56-dimensional feature vector per track: spectral centroid (2), 13 MFCCs (26), RMS energy (2), 12 chroma bins (24), ZCR (2) — all mean+stddev
- Zero metadata involvement. No genre tags, no artist names. Pure audio signal DNA.
- Incremental — only processes unanalyzed tracks. Survives restarts.

**UMAP projection:**
- Z-score normalization → UMAP embedding to 3D (or 2D flat plane)
- Configurable layout panel: Flat/Spatial toggle, dispersion slider (minDist 0.01→1.5), spread slider (0.5→5.0), one-click reproject
- ~30-60s for thousands of tracks. Features don't need re-extraction.

**Three.js renderer (Nier/REZ aesthetic):**
- InstancedMesh for all track nodes — single draw call
- UnrealBloomPass post-processing — glowing cyan nodes in black void
- OrbitControls for rotate/zoom + WASD/QE fly controls for full 6DOF navigation
- Raycaster: hover tooltips (track title + artist), click to play
- Camera lerp on track selection — smooth approach, not jarring snap
- Currently-playing node: white color + sin-wave scale pulse
- Responsive canvas via ResizeObserver

**Drift mode (KNN walk):**
- Precomputed k=8 nearest neighbors in the 56-dim feature space (not UMAP space — real distances)
- Toggle on/off from the scene. When active, track completion walks to nearest unvisited neighbor instead of next-in-queue.
- Green trajectory line traces your path through the 3D scene — you can see where you've been
- Camera follows each transition with smooth lerp
- Store-level `driftNext` override — generic hook that any navigation mode can use

**Partial map support:**
- Stop extraction early → UMAP runs on whatever's done → see partial map
- "Continue Analysis" resumes from where you left off
- "View Map" jumps straight to scene when coords already exist

**Data layer:**
- `track_features` table: `track_id`, `features_json`, `umap_x/y/z`, `computed_at`
- Derived table — can be fully recomputed from audio files at any time
- 7 IPC handlers bridging main↔renderer for all feature/coord CRUD
- `navigation.ts` module: KNN computation, drift state, extensible for future modes

### Next: Navigation Modes on the Manifold

The KNN drift walk is the first navigation mode. The architecture supports many more — all operating on the same 56-dim feature space, all togglable, no state lost switching between them.

**Directed Walk ("More Bass" / "Brighter" / "Calmer")**

The 56 dimensions aren't opaque — we know exactly what each one means. Define semantic direction vectors:
- "Heavier" → increase RMS mean, decrease spectral centroid mean
- "Brighter" → increase spectral centroid mean, increase ZCR mean
- "Calmer" → decrease RMS mean, decrease ZCR mean
- "Darker" → decrease spectral centroid mean, shift MFCC profile
- "Warmer" → specific MFCC shifts associated with fuller low-mid spectrum

"Next track along this direction" = find the nearest neighbor whose feature delta aligns with the chosen direction vector. Button magnitude controls step size — "more bass" vs "MORE BASS" is search radius.

The UI: directional buttons or a 2D pad (joystick metaphor) where axes map to interpretable feature directions. The trajectory line shows your path — you'd literally see yourself moving toward a region.

**Semantic Graph Navigation**

Build a fixed-valence graph (4-6 edges per node) where each edge is labeled by the dominant feature axis of the difference. The edges self-organize: "this neighbor is brighter," "this one is heavier," "this one shares chroma profile." The buttons label themselves. Every track becomes an intersection with named roads.

Could render the graph edges as visible lines in the 3D scene — see the neighborhood topology around the current track.

**2D Surface Eigenvector Navigation**

For flat (2D) projections: compute local principal directions at each point on the manifold. Four navigation buttons corresponding to the two eigenvectors (±). "Walk east" vs "walk north" on the surface — but east/north mean different things at different positions because the manifold is curved. This gives the most geometric, least feature-explicit navigation — pure "move through the space."

**Orbit Mode**

Instead of walking to a neighbor, orbit around the current track at increasing radii. "Show me what's nearby" → "show me what's a bit further" → "show me what's distant." Concentric exploration. Good for discovering the neighborhood structure.

**Mood Trajectory / Path Planning**

Define a mood curve: "start mellow, build energy, peak, cool down." The system finds the optimal path through the graph that matches that energy arc. Playlist generation as geodesic computation on the manifold.

Could be interactive: draw a path on the 2D projection, and the system snaps it to actual tracks.

### Spatial Audio (LOD Listening)

The original vision of *hearing the topology*:

- **Zoomed out** — clusters hum with a composite audio signature (spectral average of member tracks, rendered as noise-shaped drone via Web Audio OscillatorNode + BiquadFilters)
- **Flying closer** — the composite fades, individual tracks become audible via `PannerNode` with HRTF, 3D-positioned relative to camera
- **Close approach** — a single track dominates. Cross its threshold and it becomes the active track.
- **Distance-based gain rolloff** — Web Audio's inverse distance model

This turns the navigator from a visual browser into an auditory landscape. You hear the map.

### Content-Informed Recommendations

Not collaborative filtering. Not metadata matching. **Acoustic similarity** — what does the music actually *sound like?*

- The KNN graph already exists. Recommendations = graph traversal.
- Playlist generation as *path planning through the graph*: define a mood trajectory and find the optimal route
- EQ settings as implicit taste signal — if you boost bass on certain tracks, you prefer warmth in that region of the space
- Listening patterns as gravity: frequently-played tracks warp the space around them, pulling recommendations toward your actual taste
- All local. No cloud. Your embeddings, your graph, your data.

### Richer Feature Extraction

The current 56-dim vector captures timbre and energy well. Future features that would improve the manifold:

- **Tempo/BPM** — via onset detection or autocorrelation. Critical for rhythm-based clustering.
- **Key detection** — from the chroma features we already extract. Harmonic compatibility becomes navigable.
- **Onset density / rhythmic complexity** — how busy is the track? Separates ambient from breakcore.
- **Spectral flux** — rate of spectral change. Separates static drones from evolving compositions.
- **Dynamic range** — compressed pop vs dynamic classical. The stddev of RMS captures some of this, but explicit measurement is better.
- **Segment-level features** — instead of whole-track mean+std, extract features per segment (intro/verse/chorus/bridge). Enables "tracks that have a similar build" matching.
- **Learned embeddings** — run a pre-trained audio model (e.g., CLAP, MusicNN) for higher-level semantic features. Heavier, but captures "vibe" in ways handcrafted features can't.

### Visual Enhancements

- **Cluster labels** — auto-detect clusters (DBSCAN/HDBSCAN on features) and render floating labels ("High Energy," "Ambient," "String-Heavy")
- **Node sizing** — scale by play count, rating, or recency. Your favorites are physically larger.
- **Heat map overlay** — color nodes by listening frequency. See which regions you've explored and which remain uncharted.
- **History trails** — persistent trail rendering across sessions. Over weeks, see your movement patterns.
- **Edge rendering** — optionally show KNN graph edges as thin lines. See the topology.
- **Region fog** — unexplored areas are dimmer/foggier. Explored regions glow brighter. Incentivizes exploration.

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
- **Riemann Navigator v1** — 56-dim audio feature extraction (Meyda), UMAP 2D/3D projection, Three.js renderer with bloom, WASD fly controls, click-to-play, configurable layout (flat/spatial, dispersion, spread), KNN drift walk with trajectory visualization

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
- **Cloud sync / Proton Drive integration** — ✅ DONE. Cloud-first storage is live. Proton Drive detected automatically, `fp-evict` Swift helper handles eviction via `FileManager.evictUbiquitousItem`, LRU cache manager with 8GB budget, download-on-demand for cloud-only tracks.
- **Sync Manager UI** — basic cache stats IPC exists, UI not yet built
- **Cache eviction / storage management** — ✅ Core eviction works. See backlog below for adaptive prefetch strategies.
- **Metadata editing** — nice to have, not a priority over skin depth
- **Mobile companion app** — way out
- **Collaborative playlists** — way out

### Backlog: Adaptive Cache & Prefetch Strategies

**Problem:** Cloud-only tracks take 10-15s to download on first play. The cache manager currently does LRU eviction but no prefetch — it's reactive, not predictive.

**Core abstraction:** Each sequencing/navigation mode provides probabilistic prefetch hints to the cache manager. A single interface unifies all modes:

```typescript
interface PrefetchProvider {
  // Return the k most likely next tracks with estimated probability
  prefetchCandidates(currentTrackId: string, k: number): { trackId: string; probability: number }[]
}
```

The cache manager sorts by probability descending and downloads until a bandwidth/budget cap is reached. The provider doesn't need to be precise — "top 5 most likely" is plenty.

**Sequencing strategies (each implements PrefetchProvider):**

| Mode | Prefetch behavior | Probability shape |
|------|------------------|-------------------|
| Album sequential | Next 2-3 tracks in album | ~1.0 (near certain) |
| Artist sequential | Next tracks by same artist | ~0.8 |
| Playlist | Look ahead N tracks | ~1.0 (deterministic) |
| Shuffle | Broader pool, lower individual probability | ~1/pool_size |
| KNN drift (Riemann) | K nearest neighbors in manifold | Weighted by inverse distance |
| KNN with human intervention | Top 5 options presented to user | ~0.2 each (uniform over choices) |

**Human intervention modes shift the probability distribution.** KNN with 5 options means each gets ~0.2 instead of one getting ~1.0, so prefetch all 5. "Choose next" mode could present 3-5 candidates — all prefetched.

**Each strategy provides:**
- `prefetchCandidates(currentTrackId, k)` — probabilistic next-K
- `next()` — deterministic next track (after selection)
- `presentOptions()` — candidates for human intervention (optional)
- `handleSelection(trackId)` — user picked from presented options (optional)

**Cache manager integration:**
- On track change, query active sequencing strategy for prefetch candidates
- Download top candidates that aren't already cached (respecting bandwidth cap)
- Eviction remains LRU with 8GB budget — prefetched tracks get `last_accessed` set, so they're fresh in the LRU
- Over time, play count and rating could weight LRU (frequently played albums stay cached longer)

**Future refinements:**
- Album-aware eviction (don't orphan 1 track from a 12-track album)
- File-size-aware eviction (evict one lossless album vs 10 compressed tracks for same space)
- Time-of-day patterns (morning playlist stays cached overnight)
- Bandwidth detection (prefetch more aggressively on fast connections)

### Backlog: Implicit Feedback & Taste Inference

**Problem:** Explicit ratings (1-5 stars) are high-signal but rare. Users almost never rate tracks. The real taste signal is buried in behavior — what you skip, what you let play, what makes you hit repeat. A rating system that depends on explicit input will always be sparse. One that infers from behavior is always collecting.

**Feedback signals (implicit → explicit spectrum):**

| Signal | Type | Valence | Noise level | Notes |
|--------|------|---------|-------------|-------|
| Auto-continue to next track | Implicit | Weakly positive | High | Could mean "great, in the flow" or "zoned out, not paying attention" |
| Skip / Next | Implicit | Ambiguous | Very high | Could mean "hate it", "not right now", "already heard it today" |
| "Not feeling it" button | Explicit-light | Negative | Low | Unambiguous negative without requiring a rating number. Advances to next track. |
| "Loving this" button | Explicit-light | Strong positive | Low | Only ~5% click-through even when the user genuinely loves it. Doesn't change track — just records the signal. |
| "Love it, but not right now" button | Explicit-light | Positive + context | Low | Positive on the track, negative on the sequencing. Advances to next. Valuable for separating taste from mood. |
| Listen duration % | Implicit | Gradient | Medium | 95%+ completion = positive. <20% = negative. Middle is ambiguous. |
| Repeat / play again soon | Implicit | Strong positive | Low | Re-selecting a track within a session is a strong signal |
| Explicit rating (1-5) | Explicit | Direct | None | User override — always wins. But almost never given. |

**Taste inference model:**

Each signal contributes a weighted update to an inferred rating per track:

```
inferred_rating = f(
  completion_rate_history,    // weighted average of listen durations
  skip_rate,                  // fraction of plays that were skipped
  explicit_negative_count,    // "not feeling it" presses
  explicit_positive_count,    // "loving this" presses
  replay_frequency,           // how often re-selected
  recency_weight,             // recent signals matter more
  explicit_rating_override    // if set, dominates
)
```

The function doesn't need to be complex — a weighted sum with decay is a good start. The explicit rating override acts as a hard clamp when present.

**Storage:**
- New table `track_feedback` — append-only log of every feedback event: `(track_id, event_type, timestamp, context)`
  - Context captures: what sequencing mode was active, time of day, session length, position in queue
- Derived `inferred_rating` column on `tracks` table — recomputed periodically from feedback log
- Existing `rating` column remains the explicit override

**UI changes:**
- Transport bar gets two new buttons alongside the existing controls:
  - "Not feeling it" (thumbs down / skip with intent) — skips and records negative
  - "Loving this" (heart / vibe) — records positive, keeps playing
- Optional: "Love it, not now" as a long-press or modifier variant
- These are *lightweight* — single tap, no modal, no number picking
- Existing star rating stays available in track detail / context menu as the explicit override

**Downstream consumers of inferred rating:**
- LRU cache eviction (higher-rated tracks are stickier)
- Prefetch priority (prefer tracks the user tends to enjoy)
- Riemann navigator (could warp the manifold metric by taste — pull liked tracks closer)
- Smart playlists ("tracks I love", "tracks I haven't decided on yet", "tracks I should revisit")
- Sequencing strategies (avoid scheduling recently-negatived tracks)

**Key design principles:**
- Never lose a signal. The feedback log is append-only.
- Inference is always running. The user doesn't need to do anything.
- Explicit always wins. If the user sets 5 stars, the inference doesn't argue.
- Feedback buttons are *cheaper* than ratings. One tap, no cognitive load, no "is this a 3 or a 4?"
- Context matters. "Not feeling it" during a morning commute vs late-night deep listen are different signals.

### Backlog: Liminal Space Visualizer (Generative)

**The idea:** Replace waveform/shader visualizers with AI-generated liminal spaces driven by audio features. Not math-to-pixels — audio-to-meaning-to-images. The uncanny valley IS the aesthetic.

**How it works:**
- Audio feature extraction (already exists — 56-dim vectors: spectral centroid, MFCCs, RMS, chroma, ZCR) feeds into an image/video generation model
- Features map to *semantic* properties of the generated space:
  - Spectral centroid → emptiness, scale of architecture
  - RMS/energy → lighting intensity, flickering
  - MFCCs → architectural style, texture, material
  - Chroma → color palette, time of day
  - ZCR → decay, distortion, glitch artifacts
- Output renders as a continuous visualization alongside playback

**The chaos:** The viewer can't tell if the music is scoring the image or the image is generating the music. Causality dissolves. That's the point. Memetic image generation and audio fused so tightly they become one signal.

**Model considerations:**
- Needs to be fast enough for near-realtime (frame-by-frame or short clip generation)
- Efficient local models preferred (SDXL Turbo, LCM, or similar low-step diffusion) — avoid API latency
- img2img with previous frame as input for temporal coherence (dreamy drift between spaces)
- Could also use video generation models (frame interpolation between keyframes)
- ControlNet or IP-Adapter for style consistency within a track

**Architecture sketch:**
```
AudioEngine → feature buffer (rolling window)
    ↓
Feature summarizer (reduce 56-dim to semantic prompts + controlnet params)
    ↓
Local diffusion model (SDXL Turbo / LCM, ~4 steps, <500ms per frame)
    ↓
Frame buffer → WebGL renderer (crossfade between generated frames)
```

**The vibe:** Empty swimming pools at 3am. Fluorescent-lit hallways that go nowhere. Abandoned malls where the music is the only thing that proves time still passes. Your entire library becomes a walk through spaces that shouldn't exist but feel like memories.

### The Pivot
The PRD was practical. The app became something else — a vehicle for reviving the golden age of desktop customization. The skin engine, the visualizations, the pixel-perfect bitmap fonts — that's the soul. Everything else serves it.

And then Riemann happened. The app isn't just reviving the past — it's building something that never existed: a music player where your library has geometry, where listening is navigation, where the space between songs is as meaningful as the songs themselves.

And then the liminal spaces idea happened. The app isn't just navigating music — it's hallucinating the world the music implies.

---

## Reference Links

- [Winamp Skin Museum](https://skins.webamp.org) — thousands of classic .wsz skins
- [Butterchurn (MilkDrop WebGL)](https://github.com/jberg/butterchurn) — MIT, runs in browser
- [Webamp](https://github.com/captbaritone/webamp) — pixel-perfect Winamp 2 in the browser, reference implementation
- [Quinto Black CT](https://quinto-black-ct.info/) — modern Winamp skin showing the depth of customization possible
- [Winamp Skin Format](https://winampskins.neocities.org/base) — sprite sheet reference
- [Winamp Skin Spec (Archive Team)](http://fileformats.archiveteam.org/wiki/Winamp_Skin) — file format documentation
