# Liminal Shader Lineage

Evolutionary history of liminal space visualizers. Each shader records its
generation, parents, and status. Human-in-the-loop selection determines survival.

## Status Key
- **ACTIVE** — In the preset rotation, currently breeding stock
- **RETIRED** — Survived testing, superseded by offspring. Kept for reference.
- **DEAD** — Proven bad during evaluation. Kept for lineage record only.

## Generation 0 (Seeds)

| File | Space | Parents | Status | Eval Notes |
|------|-------|---------|--------|------------|
| gen0-ocean | Open ocean, infinite horizon | SEED (Seascape/TDM) | ACTIVE | "SO GOOD" — the benchmark |
| gen0-empty-pool | Drained swimming pool, shallow water, tile walls | SEED (ocean technique) | ACTIVE | "decent start" |
| gen0-dead-mall | Abandoned mall corridor, storefronts, polished floor | SEED | DEAD | Too simple, flickers too much, not enough geometric complexity |
| gen0-dead-office | Empty open-plan office, cubicles, monitors | SEED | DEAD | Same — too simple, excessive flicker, needs more SDF detail |

## Generation 1

| File | Space | Parents | Status | Eval Notes |
|------|-------|---------|--------|------------|
| gen1-thunderstorm | Storm ocean + clouds above, lightning | ocean | DEAD | Wrong direction — human wanted cloud feel, not ocean+storm |
| gen1-deep-pool | Deeper pool, reduced flicker, caustics | empty-pool | DEAD | "didn't add much" |

## Generation 2

| File | Space | Parents | Status | Eval Notes |
|------|-------|---------|--------|------------|
| gen2-stormclouds | Volumetric FBM cloud masses, camera below, lightning on beat | ocean (technique) | ACTIVE | pending eval |

## Breeding Log

### Gen 0 → Gen 1 (Session 1)
- **Selection pressure**: Ocean is king. Pool is decent. Mall/office too simple + flicker.
- **Direction from human**: "children of ocean — adapt towards thundercloud"
- **Mutations applied**:
  - gen1-thunderstorm: ocean + volumetric FBM cloud layer above, lightning on beat,
    storm palette (dark greens/greys/electric white), lower camera, choppier waves
  - gen1-deep-pool: empty-pool with reduced flicker frequency, enhanced caustics,
    deeper water, more tile detail

### Gen 1 → Gen 2 (Session 1)
- **Selection pressure**: Both gen1 offspring DEAD. Thunderstorm was wrong direction.
  Deep pool didn't add enough.
- **Key insight from human**: "evolving the feel towards cloud fluctuations instead of water"
  The ocean's TECHNIQUE (FBM fluid motion, breathing) is what works — apply it to clouds,
  not water. Don't put clouds on top of ocean. Replace ocean with clouds entirely.
- **Mutations applied**:
  - gen2-stormclouds: Pure volumetric clouds using ocean's FBM rotation technique.
    Camera beneath cloud layer looking up. Bass drives density, treble drives
    turbulence detail, beat triggers internal lightning glow. No water at all.
