# Issues — canonical open-issue ledger

**This is the single source of truth for what is open in this repo.** One line of status per issue.
Detail can live in linked docs/code, but the *status* lives here and nowhere else. Do not invent
parallel "known-issues" / "handoff" / "deficiencies" docs — that sprawl is exactly what this ledger
replaces.

## Rules

- **Every entry carries a `verified:` date.** If an entry is older than its `verified:` date and
  you're about to act on it, **re-verify against live code/data/git first** — claims rot.
- **Discoverable by construction:** this file is referenced from `CLAUDE.md` (loads every session).
- **Lifecycle:** an issue is `OPEN` until verified fixed, then moved to **Resolved** with the fix
  commit + date (kept for provenance, never re-reported as new).
- **Adding one:** next `ID`, a `severity` (HIGH/MED/LOW), today's `verified:` date, a `file:line`
  anchor, and a one-line description.
- **IDs are stable and never reused.**

## Open

| ID | Sev | verified | Anchor | Issue |
|----|-----|----------|--------|-------|
| 1 | HIGH | 2026-08-23 | `ampere/tsconfig.web.json` | `make typecheck` fails repo-wide: 130 errors in ampere (117 web + 13 node; re-counted 2026-08-23 — 77 of the web errors are the single `window.api` wiring fault, 40 are not), 18 in comics. Dominant cause is one wiring fault — the preload `index.d.ts` isn't in the renderer tsconfig, so `window.api` is untyped at every call site. Others: `src/shared/**` not in either project's file list, `inferred_rating` missing from `TrackUpsertData` in `music-extractor.ts:57`, two arity errors in `tagger.ts`, a `null` vs `undefined` mismatch in `storage/sources.ts:42`. **Fix the tsconfig wiring first and re-count** before treating these as 148 distinct bugs. Keeps `typecheck` out of `make check`. |
| 2 | MED | 2026-08-15 | `comics/vitest.config.ts` | ProtonComics has **zero tests** — vitest is configured and never used. The scanner's three-tier upsert (`embedded_id` → `file_path` → insert) and `ensureProtonId()`'s ZIP write-back are the paths where a regression silently costs user data. |
| 3 | MED | 2026-08-15 | `vq/AMPERE.md` | The `vq` → Ampere semantic import joins on **absolute file path** (`clap_index.path = tracks.file_path`), not on `embedded_id`. ~99% match today, but it degrades silently the moment a library is reorganized — precisely the failure the embedded id exists to prevent. Already flagged as a follow-up in `vq/AMPERE.md`. |
| 4 | LOW | 2026-08-15 | `ampere/src/renderer/src/visualizer/shaders/liminal/gen0-empty-pool.ts:7` | Dangling re-export: `export { fragmentSource, defaultUniforms } from '../empty-pool'` — no `empty-pool.ts` exists (the descendants are `deep-pool.ts` / `caustic-pool.ts`). Nothing imports this file, so it is dead code, but it breaks typecheck and misrepresents the gen0 lineage record. |
| 5 | LOW | 2026-08-15 | `Makefile` | No linter or formatter is configured anywhere in the repo — no ESLint, no Prettier, no config files. `make lint` is currently just an alias for `typecheck`. |
| 7 | HIGH | 2026-08-23 | `ampere/src/main/scanner/tagger.ts:72` | `ensureEmbeddedId` **appends** a second `ampere` UFID when the read fails instead of repairing the first, so files accumulate multiple ids and the DB keeps an arbitrary one. Observed on 15 files during the Picard recovery; in every sampled case the *first* frame in the file was the orphan and the *second* was the one the DB knew. |
| 8 | HIGH | 2026-08-23 | `ampere/src/main/scanner/tagger.ts:34` | `readIdFromFile` returns the **first** matching UFID frame (`Id3v2UniqueFileIdentifierFrame.find`), which need not be the id the DB holds — see #7. Together these two silently defeat rename recovery even when the identity is present in the file. Now mitigated by content-hash identity, but the tagger still writes and reads bad state. |
| 9 | MED | 2026-08-23 | `ampere/src/main/scanner/tagger.ts:145` | The Apple/m4a branch of `readIdFromFile` is an unimplemented TODO, so **no m4a file has ever carried an embedded id**. 207 of the files orphaned by the Picard reorganisation were m4a and had no identity to recover from. Content hashing now covers them; the write path is still a stub. |
| 10 | MED | 2026-08-23 | `ampere/src/renderer/src/stores/library.ts:640` | Feedback writes are fire-and-forget with the error swallowed: `window.api.recordFeedback(...).catch(console.error)`. A locked DB, a failed insert or a quit racing an in-flight event loses it silently, with no retry and **no counter** — so the stated tolerance of 1 lost event in 100,000 is currently unverifiable rather than met. |
| 11 | MED | 2026-08-23 | `ampere/src/main/database/track-identity.ts:34` | 334 content hashes in the live library identify more than one row (the same recording on an album and a compilation). Matching correctly declines on these, so nothing is misattributed — but a rescan will create a duplicate row, and future feedback then attaches to the new row while the history stays on the old. Splitting, not loss. Merging duplicates is the follow-up. |
| 12 | LOW | 2026-08-23 | `ampere/src/main/index.ts:566` | `repair-track-metadata` re-extracts files the normal scan skips (path+size unchanged), but nothing in the UI calls it. The IPC and the scanner path exist and are unreachable. |
| 13 | LOW | 2026-08-23 | live data | 10 tracks remain unmatched after the Picard recovery (11,594 of 11,604 playable). Low-confidence pairings deliberately not applied — they need a human to look. |
| 14 | LOW | 2026-08-23 | live data | 331 of 602 tracks under `Adam-Music/Persona Soundtracks/` contain **no audio**: an ID3 tag followed by a payload of pure zeros, no MPEG frame sync. Reading one through to the end returns zeros and does not trigger materialisation, so the data is not merely un-downloaded. A Proton Drive sync failure the app cannot repair; rows are kept so re-acquiring the albums reunites them with their ratings. |
| 6 | LOW | 2026-08-15 | `ampere/src/renderer/src/themes/wsz-importer.ts:31` | Winamp **shell and titlebar backgrounds** are still assigned from `blob:` URLs, which do not survive a restart, while the sprite sheets are persisted correctly as PNG data URLs. A restored skin therefore keeps its sprites and sampled colors but loses those two textures. `ampere/README.md` documents the limitation; the asymmetry with the sprite path is the part worth closing. |

## Resolved (provenance — do not re-report)

| Was | Resolved by | Date |
|-----|-------------|------|
| Track identity lived **only** in an `AMPERE_ID` tag that third-party taggers also own. A MusicBrainz Picard reorganisation moved 3,325 files and rewrote their tags; ~1,900 arrived with no usable id and became rows silently pointing at files that no longer existed. A rescan would have compounded it by creating duplicates and orphaning ratings. | Identity derived from the audio payload with tags excluded (`content-id.ts`), matched content-hash → embedded-id → path, with guards refusing ambiguous hashes and refusing to let a copy adopt a living track. Library recovered to 11,594/11,604 with zero data loss, verified against the pre-heal backup. `ee9e13a`, `8b2e0f3` | 2026-08-23 |
| A track that could not be played failed **silently** — four separate paths ended in `console.error` or no branch at all, so a moved file looked like the player hanging. This is what turned a path problem into a two-day mystery. | Every branch now reports; `getTrackPath` distinguishes *absent* from *not yet downloaded*; advancing past a broken file records no feedback, so failures cannot fabricate skips. `5cb9a3e` | 2026-08-23 |
| Tracks with no readable duration recorded `completion = 0` on every play, so 88 events — ~10% of all outcomes — were logged as rejections regardless of listener behaviour, each feeding a −1 into the session direction. | Unknown duration now records `null` and is dropped from rates and signals rather than counted as a rejection; `duration: true` recovers headerless VBR durations at no cost. `6e8f158` | 2026-08-23 |
| Session navigation mode returned the same track forever — it read `state.visited` but never wrote to it, so the argmax was stable. | The walk records its own picks, matching the drift convention. `5e4b398` | 2026-08-23 |
| The repo-wide "binding" data-integrity rules lived in `music-system/CLAUDE.md` — **outside this git repo**, untracked and unversioned, while `ampere/CLAUDE.md` and the root `README.md` both pointed at it as authoritative. | Merged into the repo-root `CLAUDE.md` as part of golden-path adoption | 2026-08-15 |
| `comics/`, `resources/`, and `vq/` were untracked by git, despite `comics` being a declared npm workspace and `vq` being what produces Ampere's semantic index. | Brought under version control as part of golden-path adoption | 2026-08-15 |
| `ampere/PRIORITIES.md` listed full sprite-sheet rendering, bitmap fonts, magenta transparency, PLEDIT support and the demoscene engine as unstarted **P0** work long after all of them had shipped. | Dissolved into `docs/PLAN.md` (roadmap), `docs/DESIGN.md` (vision) and `docs/rfd/0002` (prefetch design), re-verified against live code | 2026-08-15 |
