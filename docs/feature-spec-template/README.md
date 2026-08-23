# Per-feature spec template

For a **large, multi-session feature**, copy this directory to `docs/<feature>/` and fill in the
three files. They separate the durable parts of a feature's design so it survives across sessions
and into maintenance ([spec-driven development](https://kiro.dev), Fowler/Böckeler durability):

- **`requirements.md`** — *what* and *why* (user-facing outcomes, acceptance criteria). Most durable.
- **`design.md`** — *how* (the technical approach, interfaces, data shapes, tradeoffs).
- **`tasks.md`** — the executable breakdown; a live checklist that empties as work lands.

Reviewed-then-gated: agree on `requirements.md` and `design.md` before writing much code; work the
`tasks.md` list under normal branch/commit discipline.

## When a single PLAN.md is enough

The triplet is for genuinely large features. For a **smaller** feature, a single
`docs/<feature>/PLAN.md` (status + open work, mirroring the top-level `docs/PLAN.md`) is the
right-sized choice — don't manufacture three documents where one paragraph of context and a task
list will do. Use judgment; the paved road offers the triplet, it does not mandate it.

_Delete this README in the copied feature directory._
