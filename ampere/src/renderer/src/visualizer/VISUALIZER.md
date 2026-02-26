# Liminal Space Visualizer

A music-reactive visual system for Ampere built on GLSL fragment shaders evolved through genetic selection.

## Architecture

Every shader is a single-pass WebGL2 fragment shader (`#version 300 es`) rendered to a fullscreen triangle. The render pipeline per frame:

```
Effect shader -> [Crossfade blend] -> Feedback accumulation -> CRT post-process -> Screen
```

- **Effect**: The active shader(s) render to FBOs, driven by audio uniforms
- **Crossfade**: During transitions, two shaders blend via cosine-eased mix (Milkdrop pattern)
- **Feedback**: Previous frame warped (zoom + rotation) and composited with fresh output, creating trails and persistence
- **CRT**: Scanlines, phosphor mask, barrel distortion, chromatic aberration, interference bands, ghost image

### Audio Uniform Interface

Every shader receives the same audio signal uniforms:

| Uniform | Type | Description |
|---------|------|-------------|
| `uTime` | float | Wall clock time (seconds) |
| `uResolution` | vec2 | Viewport size in pixels |
| `uBass` | float | 0-1, instantaneous bass energy |
| `uMid` | float | 0-1, instantaneous mid energy |
| `uTreble` | float | 0-1, instantaneous treble energy |
| `uBeat` | float | 0-1, beat pulse (spikes then decays) |
| `uPhaseBass` | float | Accumulated bass phase (monotonically increasing) |
| `uPhaseMid` | float | Accumulated mid phase |
| `uPhaseTreble` | float | Accumulated treble phase |

**Design principle**: Use `uPhase*` for continuous motion (camera, UV drift, time), use `u{Bass,Mid,Treble}` for instantaneous modulation (brightness, scale, color mix). Phase-driven motion stays smooth regardless of volume changes.

### Audio Reactivity Conventions

These mappings produce the most visually compelling results:

| Band | Drives | Why |
|------|--------|-----|
| **Bass** | Scale, displacement, movement speed, intensity | Bass carries the weight — zooms, breathes, lurches |
| **Mid** | Color palette, hue shift, structural variation | Mid is the melody — shifts the mood |
| **Treble** | Sharpness, detail, spin, sparkle | Treble is texture — adds edge and energy |
| **Beat** | Zoom-pulse, brightness flash, blackout, particle burst | Beat is punctuation — momentary spikes |

### Preset Categories

| Category | Purpose | Count |
|----------|---------|-------|
| **demoscene** | Ship-quality. Proven survivors, always good to show. | 10 |
| **liminal** | Evolutionary survivors. Stable, atmospheric, good enough. | 2 |
| **seeds** | Untested breeding stock. Candidates for evaluation. | 28 |

Keyboard: `,`/`.` cycle all presets, `[`/`]` jump between categories.

Auto-cycling: 30s timer, beat-triggered early switch (8% chance per strong beat), track-change triggers transition.

### Feedback Parameters

Each preset specifies feedback behavior for the accumulation pass:

| Parameter | Range | Effect |
|-----------|-------|--------|
| `decay` | 0-1 | How much previous frame to retain (0.8+ = heavy trails) |
| `zoom` | ~1.0 | Per-frame zoom (1.005 = gentle zoom in, creates tunnel effect) |
| `rotation` | radians/s | Feedback rotation speed (creates spiral trails) |

---

## Evolution System

Shaders are bred through genetic evolution with human-in-the-loop selection. Claude acts as the mutation/crossover operator — the human evaluates visually while listening to music and gives feedback using shorthand syntax. The evolution operators described below are instructions for the agent, not runtime code. The shaders themselves don't know or care how they were created.

### Evaluation Syntax

```
Shader Name ++          Promote to higher category
Shader Name --          Kill (delete file, remove everywhere)
Shader Name ~           Needs work (keep, note issues)
Shader Name ~ notes     Needs work with specific feedback
Shader Name !           Urgent fix needed
> parentA x parentB     Breed two parents
> parentA + "direction" Mutate toward a direction
```

### Agent Evolution Operators

These are strategies for the agent (Claude) when generating new shader offspring. They describe how to approach the code transformation, not any runtime behavior.

#### Perturbation
Rewire audio reactivity without changing the core algorithm. Same SDF, same geometry, completely different feel. The agent changes *which audio band drives what* and *how sensitive* each mapping is, but leaves the visual algorithm untouched.

Example: Backrooms -> Backrooms Dark. Same corridor maze. But bass now lurches the camera, treble makes fluorescents flicker, beat triggers blackout. Horror atmosphere from pure audio remapping.

#### Large Mutation
The agent makes structural code changes to an existing shader. Adds new techniques, geometry, or dimensions. The parent's DNA is recognizable but significantly evolved.

Example: Electric Noise -> Electric Storm. Same dual FBM core. Agent added lightning bolts traced along ridge peaks, 3 parallax depth layers, vertical rain streaks, storm cloud base layer.

#### Fusion
The agent crosses two parent shaders — combining the SDF/geometry of one with the coloring/atmosphere of another. Technique transfer between unrelated shaders.

Example: Backrooms x Caustic Pool -> Flooded Backrooms. Agent took Backrooms corridor SDF, flooded it ankle-deep, and projected Caustic Pool's light patterns (joltz0r iterative sin/cos) onto the ceiling.

---

## Shader Catalog

### Demoscene (Generation 0 — foundational)

| Shader | File | Technique | Source |
|--------|------|-----------|--------|
| **Amiga Plasma** | `plasma.ts` | sin/cos interference, IQ cosine palette | Original |
| **Infinite Tunnel** | `tunnel.ts` | Polar coordinate warp, atan seam fix | Original |
| **Star Voyage** | `starfield.ts` | Parallax layered hash stars, smoothstep fade | Original |
| **Kali Fractal** | `fractal.ts` | Kaliset `abs(p)/dot(p,p) - formuparam` flythrough | [Star Nest by Kali](https://www.shadertoy.com/view/XlfGRj) |
| **Deep Ocean** | `ocean.ts` | FBM wave octaves, raymarched water surface | [Seascape by TDM](https://www.shadertoy.com/view/Ms2SD1) |
| **Nebula Drift** | `clouds.ts` | Volumetric FBM noise density raymarching | [Protean Clouds by nimitz](https://www.shadertoy.com/view/3l23Rh) |
| **Creation** | `creation.ts` | Nested sin/length interference evolution | [Creation by Silexars](https://www.shadertoy.com/view/XsXXDn) |
| **Voronoi Cells** | `voronoi.ts` | Animated Voronoi distance field | Original |
| **Desert Dunes** | `desert.ts` | FBM heightmap, wind ripples, heat shimmer | Original (promoted from seeds) |
| **Deep Nebula** | `nebula.ts` | Volumetric iterated folding (Star Nest family) | [Star Nest by Kali](https://www.shadertoy.com/view/XlfGRj) (promoted from seeds) |

### Liminal (Evolutionary survivors)

| Shader | File | Gen | Parents | Technique |
|--------|------|-----|---------|-----------|
| **Stormclouds** | `stormclouds.ts` | 2 | ocean | Volumetric FBM cloud masses with ocean's breathing soul. Internal lightning on beat. |
| **Mountain Flyover** | `terrain.ts` | 0 | SEED | FBM heightmap raymarching (iq "Elevated" family). Atmospheric fog. |

### Seeds — Architectural / Interior

| Shader | File | Gen | Parents | Technique | Source |
|--------|------|-----|---------|-----------|--------|
| **Backrooms** | `backrooms.ts` | 5 | mdVSRD | Domain-repeated maze, per-cell random walls, warm point light, shadow rays, AO, acoustic tiles, carpet stains | [mdVSRD](https://www.shadertoy.com/view/mdVSRD) |
| **Backrooms Dark** | `backrooms-dark.ts` | 6 | backrooms (perturbation) | Same SDF. Bass lurches camera, treble flickers lights, beat blackout, mid shifts yellow-to-green | Evolved from mdVSRD |
| **Flooded Backrooms** | `flooded-backrooms.ts` | 6 | backrooms x causticPool (fusion) | Corridor geometry flooded. Caustic ceiling projection, water reflections, underwater absorption | Evolved from mdVSRD + joltz0r |
| **Interior Light** | `interior-light.ts` | 5 | mu6k | Domain-repeated boxes, abs(p.y) symmetry, 3 orbiting colored lights, 2-pass soft shadow, AO, specular, lens flare | [Structure by mu6k](https://www.shadertoy.com/view/XdfGzS) |
| **Infinite Corridor** | `infinite-corridor.ts` | 5 | menger + floodedHall | Negated box SDF corridor, winding path, fluorescent lights with per-fixture flicker, doors, carpet, tiles | Original |
| **Menger Halls** | `menger.ts` | 0 | SEED | IFS raymarching, infinite fractal architecture | Original (Menger Journey family) |
| **Dead Mall** | `dead-mall.ts` | 0 | SEED | Raymarched abandoned mall, repeating storefronts, flickering fluorescents | Original |
| **Dead Office** | `dead-office.ts` | 0 | SEED | Empty open-plan office, ceiling grid, cubicle partitions | Original |

### Seeds — Natural / Atmospheric

| Shader | File | Gen | Parents | Technique | Source |
|--------|------|-----|---------|-----------|--------|
| **Caustic Pool** | `caustic-pool.ts` | 5 | joltz0r | Iterative sin/cos feedback caustic patterns (5 iterations) | [Water Turbulence by joltz0r](https://www.shadertoy.com/view/MdlXz8) |
| **Thunderstorm** | `thunderstorm.ts` | 1 | ocean | Storm ocean + volumetric clouds + lightning on beat | Evolved from Seascape |
| **Deep Pool** | `deep-pool.ts` | 1 | emptyPool | Deep water with caustics, tile detail, underwater light shafts | Original |
| **Aurora Borealis** | `aurora.ts` | 0 | SEED | Layered curtain noise bands with spectral coloring | Original |
| **Solar Surface** | `solar.ts` | 0 | SEED | FBM convection cells + prominence arcs | Original |
| **Deep Forest** | `forest.ts` | 0 | SEED | Volumetric fog + SDF trees + god rays | Original |
| **Bioluminescent Deep** | `bioluminescent.ts` | 0 | SEED | Particle systems + volumetric glow in dark water | Original |
| **Glacier Cave** | `glacier.ts` | 0 | SEED | Raymarched ice with subsurface scattering | Original |
| **Crystal Cave** | `crystal-cave.ts` | 0 | SEED | Raymarched crystal SDFs with reflection | Original |
| **Sandstorm** | `sandstorm.ts` | 4 | voidClouds x desert | Volumetric FBM dust + ridged FBM dunes | Original |
| **Fog Peaks** | `fog-peaks.ts` | 4 | terrain x voidClouds | FBM mountains dissolving into volumetric fog | Original |
| **Frozen Dunes** | `frozen-dunes.ts` | 4 | desert + "frozen, alien" | Desert dune shapes in ice, blue-white palette, aurora shimmer | Original |
| **Event Horizon** | `event-horizon.ts` | 4 | nebula + "gravitational" | Iterated folding with central void, accretion disk, gravitational distortion | Original |

### Seeds — Space / Abstract / Geometric

| Shader | File | Gen | Parents | Technique | Source |
|--------|------|-----|---------|-----------|--------|
| **Electric Noise** | `electric-noise.ts` | 5 | nimitz | Dual FBM domain displacement, ridged noise, ring modulation | [Electric by nimitz](https://www.shadertoy.com/view/ldlXRS) |
| **Electric Storm** | `electric-storm.ts` | 6 | electricNoise (large mutation) | Same dual FBM + lightning bolts along ridges, 3 depth layers, rain streaks, cloud base | Evolved from nimitz |
| **Deep Stars** | `deep-stars.ts` | 5 | starfield | 10 parallax depth layers, per-cell glow, pulsing phases, tone-mapped | [Layered starfield](https://www.shadertoy.com/view/stBcW1) |
| **Hyperloop** | `hyperloop.ts` | 5 | kishimisu | Logarithmic scale-invariant space repetition, angular cell quantization | [Hyperloop by kishimisu](https://www.shadertoy.com/view/4XVGWh) (CC BY-NC-SA 4.0) |
| **Infinite Arcs** | `infinite-arcs.ts` | 5 | mrange | Exponential zoom, arc SDF, per-cell hashing, HSV coloring | [Infinite Arcs by mrange](https://www.shadertoy.com/view/mlXGzs) (CC0) |
| **Neon City** | `neon-city.ts` | 0 | SEED | Procedural grid city, lit windows, neon reflections | Original |
| **Neon Rain** | `neon-rain.ts` | 5 | neonCity + stormclouds | Street-level canyon, volumetric neon fog, puddle reflections, rain streaks | Original |
| **Warp Speed** | `warp.ts` | 0 | SEED | Radial volumetric streaks with depth layers | Original |

### Post-Processing

| Shader | File | Technique | Source |
|--------|------|-----------|--------|
| **CRT** | `crt.ts` | Cosine screen curvature, scanline quantization, phosphor sub-pixel mask, interference bands, ghost image, chromatic aberration | [mdVSRD](https://www.shadertoy.com/view/mdVSRD) |

---

## Graveyard

Shaders killed through evaluation. Files deleted, removed from all registrations.

| Shader | Generation | Cause of Death |
|--------|------------|----------------|
| Coral Reef | 0 | Killed in early evaluation |
| Inferno | 0 | `--` "not working" |
| Lava Flow | 0 | `--` killed in favor of other fire shaders |
| Flooded Hall | 0 | `--` "can be dropped in favor of infinite corridor" |
| Void Clouds | 3 | `--` killed in evaluation round |
| Empty Pool | 0 | `--` killed in evaluation round |
| Sunken City | 5 | `--` killed in evaluation round |

---

## Lineage Tree

```
Generation 0 (Seeds / Demoscene foundations)
├── plasma ................................. Amiga Plasma [demoscene]
├── tunnel ................................. Infinite Tunnel [demoscene]
├── starfield .............................. Star Voyage [demoscene]
├── fractal (Star Nest) ................... Kali Fractal [demoscene]
├── ocean (Seascape) ...................... Deep Ocean [demoscene]
│   ├── Gen1: thunderstorm ................ Thunderstorm [seeds]
│   └── Gen2: stormclouds ................ Stormclouds [liminal]
│       └── Gen5: neonRain ............... Neon Rain [seeds] (x neonCity)
├── clouds (Protean Clouds) ............... Nebula Drift [demoscene]
├── creation (Silexars) ................... Creation [demoscene]
├── voronoi ............................... Voronoi Cells [demoscene]
├── desert ................................ Desert Dunes [demoscene] (promoted)
│   ├── Gen4: sandstorm .................. Sandstorm [seeds] (x voidClouds†)
│   └── Gen4: frozenDunes ................ Frozen Dunes [seeds]
├── nebula (Star Nest family) ............. Deep Nebula [demoscene] (promoted)
│   └── Gen4: eventHorizon ............... Event Horizon [seeds]
├── terrain ............................... Mountain Flyover [liminal]
│   └── Gen4: fogPeaks ................... Fog Peaks [seeds] (x voidClouds†)
├── menger ................................ Menger Halls [seeds]
│   └── Gen5: infiniteCorridor ........... Infinite Corridor [seeds]
├── neonCity .............................. Neon City [seeds]
│   └── Gen5: neonRain ................... Neon Rain [seeds] (x stormclouds)
├── aurora ................................ Aurora Borealis [seeds]
├── solar ................................. Solar Surface [seeds]
├── forest ................................ Deep Forest [seeds]
├── crystalCave ........................... Crystal Cave [seeds]
├── bioluminescent ........................ Bioluminescent Deep [seeds]
├── warp .................................. Warp Speed [seeds]
├── glacier ............................... Glacier Cave [seeds]
├── deadMall .............................. Dead Mall [seeds]
├── deadOffice ............................ Dead Office [seeds]
├── deepPool .............................. Deep Pool [seeds]
│
├── † emptyPool ........................... KILLED
├── † voidClouds .......................... KILLED
├── † sunkenCity .......................... KILLED
├── † inferno ............................. KILLED
├── † lava ................................ KILLED
├── † floodedHall ......................... KILLED
└── † coralReef ........................... KILLED

Generation 5 (Shadertoy adaptations)
├── backrooms (mdVSRD) ................... Backrooms [seeds]
│   ├── Gen6 perturbation: backroomsDark . Backrooms Dark [seeds]
│   └── Gen6 fusion: floodedBackrooms ... Flooded Backrooms [seeds] (x causticPool)
├── causticPool (joltz0r) ................. Caustic Pool [seeds]
│   └── Gen6 fusion: floodedBackrooms ... (see above)
├── electricNoise (nimitz) ................ Electric Noise [seeds]
│   └── Gen6 mutation: electricStorm ..... Electric Storm [seeds]
├── interiorLight (mu6k) .................. Interior Light [seeds]
├── deepStars ............................. Deep Stars [seeds]
├── hyperloop (kishimisu) ................. Hyperloop [seeds]
└── infiniteArcs (mrange) ................ Infinite Arcs [seeds]
```

---

## Key Files

| File | Purpose |
|------|---------|
| `DemosceneVisualizer.tsx` | Main React component. All imports, WebGL compilation, render loop, keyboard controls, OSD. |
| `presets.ts` | Preset configuration: `ShaderName` type, `PRESETS` array (name, category, feedback params), auto-cycling, crossfade state machine. |
| `shaders/*.ts` | Individual shader files. Each exports `fragmentSource` (GLSL string) and `defaultUniforms`. |
| `shaders/crt.ts` | CRT post-processing pass (applied to all shaders). |
| `gl-utils.ts` | WebGL helpers: program compilation, fullscreen triangle, FBO management. |
| `overlays/scroller.ts` | Track info scroller overlay (2D canvas). |

## Adding a New Shader

1. Create `shaders/my-shader.ts` exporting `fragmentSource` and `defaultUniforms`
2. Add the shader name to `ShaderName` type in `presets.ts`
3. Add a `Preset` entry in the `PRESETS` array with name, category, and feedback params
4. Add import and compilation entry in `DemosceneVisualizer.tsx`

## External Sources and Licenses

| Source | Author | License | Used In |
|--------|--------|---------|---------|
| [Seascape](https://www.shadertoy.com/view/Ms2SD1) | Alexander Alekseev (TDM) | Shadertoy default | ocean, thunderstorm |
| [Creation](https://www.shadertoy.com/view/XsXXDn) | Danilo Guanabara (Silexars) | Shadertoy default | creation |
| [Star Nest](https://www.shadertoy.com/view/XlfGRj) | Pablo Roman Andrioli (Kali) | Shadertoy default | fractal, nebula |
| [Protean Clouds](https://www.shadertoy.com/view/3l23Rh) | nimitz | Shadertoy default | clouds |
| [Noise animation - Electric](https://www.shadertoy.com/view/ldlXRS) | nimitz | Shadertoy default | electricNoise, electricStorm |
| [Water Turbulence](https://www.shadertoy.com/view/MdlXz8) | David Hoskins / joltz0r | Shadertoy default | causticPool, floodedBackrooms |
| [mdVSRD](https://www.shadertoy.com/view/mdVSRD) | (uncredited) | Shadertoy default | backrooms, backroomsDark, floodedBackrooms, crt |
| [Structure](https://www.shadertoy.com/view/XdfGzS) | mu6k | Shadertoy default | interiorLight |
| [Layered starfield](https://www.shadertoy.com/view/stBcW1) | (uncredited) | Shadertoy default | deepStars |
| [Hyperloop](https://www.shadertoy.com/view/4XVGWh) | kishimisu | CC BY-NC-SA 4.0 | hyperloop |
| [Infinite Arcs](https://www.shadertoy.com/view/mlXGzs) | mrange | CC0 | infiniteArcs |
