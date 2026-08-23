# 2. Derive listening sessions from event timestamps

- **Status:** Accepted
- **Date:** 2026-08-15
- **Deciders:** Adam Henderson

## Context

Session-local navigation needs a notion of "the listening session in progress": the recent run of
plays whose reactions describe what the listener is in the mood for right now, as distinct from
their long-run taste.

`track_feedback` already timestamps every event via `created_at`. So a session boundary can either
be **stamped at write time** — a `session_id` column assigned by whatever logic is current when the
event is recorded — or **derived at read time** from the timestamps that are already there.

The deciding pressure is that the boundary rule is a guess. The threshold chosen was 30 minutes of
idle time, and the sensitivity was measured across the existing log: 10 minutes yields 84 sessions,
30 yields 71, 120 yields 56. The curve is flat, so the value is defensible — but "defensible" is not
"correct", and there is no reason to believe 30 minutes will survive contact with a session model.
A stamped column freezes whatever rule was in force at write time, and cannot be revised for events
already recorded.

One correctness detail forced itself into scope. SQLite's `datetime('now')` writes UTC in the form
`YYYY-MM-DD HH:MM:SS`, with a space separator and no zone suffix. JavaScript's `Date` parses that
shape as *local* time, which would shift every derived boundary by the machine's UTC offset.

## Decision

We will **derive sessions from `created_at` rather than storing a session identifier.**

- `src/main/database/sessions.ts` exposes `sessionize(events, gapMs)` and `currentSession(...)` as
  pure functions over feedback rows. The gap is a parameter with a documented default, not a
  constant baked into stored data.
- Timestamps are parsed as UTC explicitly (`parseSqliteUtc`), never by handing SQLite's format to
  `new Date()`.
- No `session_id` column is added to `track_feedback`.

## Consequences

The gap threshold stays revisable, and any revision applies retroactively to the entire history —
currently 169 days of events — rather than only to events recorded after the change. Session
derivation needed no migration and adds no schema debt, and the same function serves both the live
session and historical analysis, so the two cannot drift apart.

Against that:

- Sessions are recomputed on every query rather than looked up. That is trivial at present scale and
  will not remain so indefinitely; the fallback is a derived cache keyed on a schema version, not a
  stamped column.
- **A session has no durable identity.** Re-deriving with a different gap produces different
  sessions, so nothing outside the derivation can hold a stable reference to "session 43". Anything
  that needs to annotate a specific session must key on something else, such as its first event.
- `attention_weight` remains a write-time snapshot and is *not* recoverable this way. It decays from
  the last UI interaction, so it can only be captured as it happens. Sessions being derivable does
  not make every session-adjacent quantity derivable, and the distinction is easy to overextend —
  see [ADR-0003](0003-record-the-ui-surface-on-feedback-events.md) and
  [ADR-0004](0004-log-decision-features-as-the-policy-used-them.md) for the cases that go the other
  way.
