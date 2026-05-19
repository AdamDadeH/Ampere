# Liminal Space Visualizer & Shader Evolution — Bibliography

## Amazing Source

https://www.shadertoy.com/results?query=&sort=newest&from=110892&num=12

## Evolutionary Art / Genetic Shader Generation

### Foundational
- **Karl Sims — "Artificial Evolution for Computer Graphics" (SIGGRAPH 1991)**
  Expression trees of math ops, interactive human fitness selection. The origin of everything below.
  https://www.karlsims.com/

 - Reaction Diffusion : https://www.karlsims.com/rd-exhibit.html
 - https://www.karlsims.com/rdtool.html?s=0rBdDsocHwVo
 - https://www.karlsims.com/seven.html

- **Electric Sheep — Scott Draves (2005, 2007)**
  ~450,000 connected computers collaboratively evolving fractal flame genomes via user voting.
  Genome: XML-based affine xforms with variation weights, palettes, symmetry.
  Crossover: Alternate (select xforms from each parent), Interpolate (blend params), Union (combine xforms).
  Mutation: Parameter perturbation, post-xform insertion, color shifts.
  - Paper: "The Electric Sheep Screen-Saver: A Case Study in Aesthetic Evolution" — https://draves.org/evomusart05/evomusart05draves.pdf
  - Paper: "Evolution and Collective Intelligence of the Electric Sheep" — https://link.springer.com/chapter/10.1007/978-3-540-72877-1_3
  - FLAM3 genome format: https://flam3.com/README.txt
  - WebGL renderer: https://github.com/richardassar/ElectricSheep_WebGL
  - Project: https://electricsheep.org/

### GPU Shader Evolution
- **Ebner, Reinhardt, Albert — "Evolution of Vertex and Pixel Shaders" (EuroGP 2005)**
  Linear sequences of Cg commands as genome. Interactive fitness.
  https://link.springer.com/chapter/10.1007/978-3-540-31989-4_23
  PDF: https://stubber.math-inf.uni-greifswald.de/~ebner/resources/uniWu/evoShader.pdf

- **Howlett, Colton, Browne — "Evolving Pixel Shaders for Subversion" (AISB 2010)**
  GLSL expression trees, GP crossover/mutation for city environment rendering.
  https://www.semanticscholar.org/paper/Evolving-pixel-shaders-for-the-prototype-video-game-Howlett-Colton/34aec673f874dda0922dd3ec0b6b26aaf80d84a4

- **GenShade — Aladin Ibrahim**
  Evolves RenderMan shaders with multiresolution image fitness metric.
  https://www.semanticscholar.org/paper/Genshade:-an-evolutionary-approach-to-automatic-and-Ibrahim-House/9d5cbbef6f69208aef1868e2c19d00a745ee2453

- **Cartesian Genetic Programming (CGP) for Evolutionary Art — Miller (2011)**
  Programs as DAGs on 2D grid, ~20 math functions, pixel coords in, RGB out.
  https://www.researchgate.net/publication/230855629_Evolutionary_Art_with_Cartesian_Genetic_Programming
  JS implementation: https://github.com/turbomaze/CGP-Evolutionary-Art

- **KoltesDigital — Shader Evolution (NEAT-based)**
  Open source. Evolves fragment shaders using NEAT (topology + weights evolve together).
  Interactive fitness. Has a web version.
  - GitHub: https://github.com/KoltesDigital/shader-evolution
  - Web: https://koltes.digital/shader-evolution-web/
  - Project page: https://koltes.digital/projects/shader-evolution/

- **Sasso, Loiacono, Lanzi — "Procedural Generation of Shaders Using Interactive Evolutionary Algorithms" (IEEE GEM 2024)**
  Unity ShaderGraph forests as genome. Scaffolded mutations. Semantic "Swap Noise Map" operator.
  - Paper: https://arxiv.org/abs/2312.17587
  - GitHub: https://github.com/PierLucaLanzi/Procedural-Generation-of-Shaders-Using-Interactive-Evolutionary-Algorithms

- **AI Co-Artist — LLM-Powered Shader Evolution (2025)**
  GPT-4 as mutation/crossover operator on raw GLSL source strings. 14-shader population.
  Users click favorites. <3% compilation error rate. Novices created 4.2 shaders vs 0.6 with raw Shadertoy.
  - Paper: https://arxiv.org/abs/2512.08951

### Shader Simplification
- **Sitthi-amorn et al. — "Genetic Programming for Shader Simplification" (ACM TOG 2011)**
  GP to automatically simplify shaders, trading accuracy for speed.
  https://dl.acm.org/doi/10.1145/2070781.2024186

### LLM Shader Generation
- **johnPertoft — llm-shader-toy**
  Natural language to WebGL GLSL. Claude noted as "most consistent model."
  https://github.com/johnPertoft/llm-shader-toy

- **14islands — AI-generated GLSL shaders**
  https://www.14islands.com/journal/ai-generated-glsl-shaders

---

## SDF Techniques & References

### Core References (Inigo Quilez)
- **Distance Functions** — https://iquilezles.org/articles/distfunctions/
- **Raymarching Distance Fields** — https://iquilezles.org/articles/raymarchingdf/
- **Interior Distance** — https://iquilezles.org/articles/interiordistance/
- **Domain Repetition** — https://iquilezles.org/articles/sdfrepetition/

### SDF Libraries & Tools
- **Mercury hg_sdf** — Demoscene group's modular SDF composition library.
  Primitives, booleans (round/chamfer/columns/stairs variants), domain ops (pMod1/2/3, pModPolar, pModMirror).
  - Docs: https://mercury.sexy/hg_sdf/
  - WebGL port: https://github.com/jcowles/hg_sdf
  - Source: https://github.com/jimbo00000/RiftRay/blob/master/shaders/hg_sdf.glsl

- **@thi.ng/geom-sdf** — TypeScript SDF composition framework by Karsten Schmidt.
  https://docs.thi.ng/umbrella/geom-sdf/

- **retrace.gl** — Browser-based SDF CSG for generative art with WebGL2 path tracer.
  https://github.com/stasilo/retrace.gl

- **SDF Explorer** — 67 analytic SDF functions collected from Shadertoy (Takikawa et al., JCGT 2022).
  https://tovacinni.github.io/sdf-explorer/
  https://github.com/tovacinni/sdf-explorer

- **CedricGuillemet/SDF** — Curated collection of SDF resources, papers, Shadertoy links.
  https://github.com/CedricGuillemet/SDF

### Learned SDF Representations
- **DeepSDF (Park et al., CVPR 2019)** — Learned latent space for SDFs. Interpolating latent codes morphs shapes smoothly.
  https://arxiv.org/abs/1901.05103

- **MetaSDF (Sitzmann et al., NeurIPS 2020)** — Meta-learning for fast SDF specialization.
  https://www.vincentsitzmann.com/metasdf/

- **Diffusion-SDF (Princeton, 2023)** — Diffusion models generating neural SDFs.
  https://arxiv.org/abs/2211.13757
  https://github.com/princeton-computational-imaging/Diffusion-SDF

---

## Architectural / Liminal Shaders on Shadertoy

### Water / Caustics
- [[YES]] **Water Caustic** — https://www.shadertoy.com/view/MdlXz8 — highly portable, widely used
- **Underwater Caustics** — https://www.shadertoy.com/view/XttyRX
- [[YES]]**Seascape** (Alexander Alekseev / TDM) — the FBM ocean technique used in our ocean shader

### Liminal / Backrooms
- [[NO]] **The Backroom** — playbyan1453 — https://www.shadertoy.com/view/DdyyWR
- **Liminal Spaces** — playbyan1453 — https://www.shadertoy.com/user/playbyan1453
- **Backrooms Level 4242** — https://www.shadertoy.com/view/mdVSRD
- https://www.shadertoy.com/view/lcSXz1

###

 - solid : https://www.shadertoy.com/view/ssXSWs

### Corridors / Interiors
- [[YES]] **Structure** — https://www.shadertoy.com/view/XdfGzS — 4 boxes + domain repetition, dual-light occlusion
- [[NO]] **Enchanted Castle Corridor** — https://www.shadertoy.com/view/dstGWS
- **Infinite Street** — https://www.shadertoy.com/view/Md3XWn
- **Interior Distance** (iq reference) — https://www.shadertoy.com/view/3t33WH
- **Interior Mapping** — https://www.shadertoy.com/view/DldcRs — faking building interiors without geometry

### Architecture
- **Greek Temple** (iq) — https://www.shadertoy.com/view/ldScDh — live-coded, step-by-step versions available
- **Tokyo** (Reinder Nijhoff) — https://www.shadertoy.com/view/Xtf3zn — city at night, rain, reflections
- **Infinite City** — https://www.shadertoy.com/view/4df3DS — domain rep, CSG window subtraction
- **Fractal Condos** — https://www.shadertoy.com/view/XsBXWt

### Fractal Interiors (cathedral-like spaces)
- **Menger Journey** — https://www.shadertoy.com/view/Mdf3z7 — fly through Menger sponge interior
- **Menger Sponge** (iq) — https://www.shadertoy.com/view/4sX3Rn
- **Fractal Cave** — https://www.shadertoy.com/view/Xtt3Wn — Menger + domain distortion
- **Escher Stairs** — https://www.shadertoy.com/view/tlVyRR


### Shadertoy Search Tags
- Architecture: https://www.shadertoy.com/results?query=tag%3Darchitecture
- Interior: https://www.shadertoy.com/results?query=tag%3Dinterior
- SDF: https://www.shadertoy.com/results?query=tag%3Dsdf
- Search "backrooms", "liminal", "poolrooms", "corridor infinite", "brutalist", "parking garage", "concrete room"

---

## Procedural Architecture (Non-Shader)
- **"Real-time Procedural Generation of Building Floor Plans"** — https://arxiv.org/abs/1211.5842
- **"Procedural Generation of Multistory Buildings With Interior"** — https://ieeexplore.ieee.org/document/8926482/

---

## Genome Representation Summary

| System | Genome | Crossover | Mutation |
|--------|--------|-----------|----------|
| Karl Sims (1991) | Expression trees | Subtree swap | Subtree replace, const perturb |
| Electric Sheep | XML (affine xforms, variations, palettes) | Alternate/Interpolate/Union | Param perturbation |
| Ebner (2005) | Linear Cg instructions | Segment swap | Instruction replace |
| Howlett (2010) | GLSL expression trees | Subtree crossover | Subtree mutation |
| CGP Art | DAG on 2D grid | Row/column swap | Node function/connection |
| KoltesDigital | NEAT topology | NEAT-style | Topology growth + weights |
| Sasso (2024) | Unity ShaderGraph forests | Forest subtree recombination | Scaffolded + semantic swap |
| AI Co-Artist (2025) | Raw GLSL strings | LLM conceptual blending | LLM semantic rewriting |
