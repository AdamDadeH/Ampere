# 3. Record the UI surface on feedback events

- **Status:** Accepted
- **Date:** 2026-08-15
- **Deciders:** Adam Henderson

## Context

Navigation modes are meant to be compared against each other: does Drift hold attention better than
Random, does Session beat either. The metric is sustained-listen rate, computed by pairing each
`track_started` with what the listener then did with that track.

Measured on the existing log, Drift sustained 47% against Random's 56%. That comparison is not
sound, and the reason is instructive: Drift only ever ran inside the 3D navigator, where skipping is
partly an interaction *with the visualiser* — the pleasure of watching the point jump across the map
— rather than a judgement about the track. The two modes were never measured under the same
conditions, so the difference measures the context as much as the policy.

Until recently the context was nonetheless *inferable*: `source = 'drift'` implied the 3D view,
because Drift existed nowhere else. Extracting navigation modes into a store-owned registry so they
run on every surface is precisely what destroys that inference. From that change onward, `drift` in
the log could mean either surface and nothing distinguishes them.

This is the case that separates it from [ADR-0002](0002-derive-sessions-from-event-timestamps.md).
Sessions can be derived later because their inputs — timestamps — are already recorded. Which screen
a play was chosen from leaves no trace anywhere else. If it is not written down as it happens, it is
gone.

## Decision

We will **record the UI surface on every feedback event**, in a `surface` column on
`track_feedback`.

- The library store keeps `activeSurface` alongside `currentView`, updated wherever the view changes
  — including `selectArtist` and `selectAlbum`, which set `currentView` directly and would otherwise
  go stale.
- The compact window drives playback remotely from a separate renderer, so its commands stamp
  `'compact'` explicitly rather than inheriting whatever view the library window happens to show.
- Analysis scopes comparisons to a single surface. `nav-performance.ts` exposes `onSurface()` for
  this, and the monitoring panel states how many events predate the column.

## Consequences

Mode-versus-mode comparison becomes a controlled one: with every mode reachable from the player bar
and the surface recorded, a difference in sustained-listen rate is attributable to the policy rather
than to where it was running. Pre-existing history stays approximately usable, since for those events
`source ∈ {drift, journey:*}` still implies the 3D view — those modes had nowhere else to run.

Against that:

- It is a column that must be maintained at **every write site**. A new call path that forgets to
  stamp it produces silently unattributable data, and nothing enforces it at the type level.
- **1,813 events predate the column and can never be filled.** They are usable for track-intrinsic
  questions and useless for anything comparing modes across surfaces. The monitoring panel reports
  the shortfall rather than hiding it.
- `activeSurface` means "the surface last acted from", which is a heuristic rather than a fact when
  playback is driven remotely or advances on its own. It is right for the common cases and
  approximate at the edges.
- Adding a surface to the app now carries an obligation: name it, or its plays become
  indistinguishable from another's.
