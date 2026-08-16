# 1. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-08-15
- **Deciders:** Adam Henderson

## Context

ProtonMusic is a multi-component project whose significant decisions need a durable home.
Recording them only in commit messages and scattered plan notes makes the *why* behind the
architecture hard to recover later, and invites re-litigating settled questions.

## Decision

We will use **Architecture Decision Records** (ADRs), as
[described by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

- One ADR per architecturally-significant decision, in `docs/adr/NNNN-title.md` (zero-padded,
  monotonic). Copy `NNNN-template.md`.
- An ADR captures **Context → Decision → Consequences**, plus a status and date.
- ADRs are **append-only and immutable once Accepted.** To change a past decision, write a **new**
  ADR that supersedes it (cross-link both: "Superseded by ADR-000X" / "Supersedes ADR-000Y").
- Statuses: `Proposed` → `Accepted` → `Superseded` / `Deprecated`.

## Consequences

- The reasoning behind the architecture is preserved and greppable.
- A new contributor (human or agent) can read the ADR log to understand *why*, not just *what*.
- There is a small per-decision authoring cost — accepted deliberately, since this project is
  Growth-tier (the golden-path Core tier records decisions in `plan-history.md` instead).
