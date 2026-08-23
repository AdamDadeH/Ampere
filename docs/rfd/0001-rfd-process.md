---
rfd: 1
title: The RFD process
state: published
authors: Adam Henderson
date: 2026-08-15
---

# RFD 1 — The RFD process

## What is an RFD?

A **Request for Discussion** is a design document for a change substantial enough to deserve
discussion *before* it is built — a cross-component design, a new subsystem, a protocol, a
migration strategy. RFDs are docs-as-code (Markdown in `docs/rfd/`, reviewed in a pull request),
adapted from [Oxide's RFD process](https://rfd.shared.oxide.computer/rfd/0001).

RFDs are heavier than ADRs and lighter than a full spec: an **ADR** records a decision already
made (Context → Decision → Consequences); an **RFD** works a design *out in the open* and invites
disagreement first. A concluded RFD often produces one or more ADRs. Use RFDs sparingly — routine
solo work does not need one.

## Numbering & files

- One file per RFD: `docs/rfd/NNNN-short-title.md` (zero-padded, monotonic). Copy `NNNN-template.md`.
- YAML frontmatter carries `rfd`, `title`, `state`, `authors`, `date`.

## Lifecycle (6 states)

| State | Meaning |
|-------|---------|
| `prediscussion` | Draft on a branch, not yet ready for others to read. |
| `ideation` | A placeholder — the idea has a number but no content yet. |
| `discussion` | Open in a PR; actively being reviewed and revised. |
| `published` | Merged and readable; the design is settled enough to act on. |
| `committed` | The design has been implemented. |
| `abandoned` | Will not be pursued (kept for the record, never deleted). |

Typical path: `prediscussion → discussion → published → committed`. Discussion happens in the PR;
the document is revised until it reflects the agreed design, then merged.
