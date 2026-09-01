# V22 Gate E Evidence

Status: **Passed (2026-08-29).**

This record closes exact preview and grips. The binding scope remains in
[`docs/v22.md`](./v22.md), and the frozen matrices and landing order remain in
[`docs/v22-implementation-dag.md`](./v22-implementation-dag.md). Former gzip-
ceiling and production-browser-gauntlet acceptance items were removed from
the plan. They are not remaining Must items for Gates H/I.

## Outcome

Gate E has a disposable cad-core projection helper that evaluates the same
existing CADOps batch as Apply by dry-running and then committing on a detached
engine. Preview source, transactions, redo state, source-authority epoch, and
project identity remain unchanged.

The browser owns one lazy exact-preview coordinator and stale-safe job. Drafts
use IDs materialized before their first preview. The same pure plan builds the
operation list for preview and Apply; Apply reconstructs and revalidates the
plan against the live editor/document and never consumes preview artifacts as
commit proof. Preview geometry uses the current V21 exact-body resolver and
artifact builder without writing the exact cache or persisted source.

Ready results subdue affected committed meshes and overlay nonselectable ghost
meshes. Exact picking continues to use committed meshes only. Replacement,
cancel, source/lifecycle changes, failure, late completion, StrictMode mount,
and unmount disposal are guarded.

The right solid editor remains the only mutable draft owner. Viewport grips
send sequenced change/Apply/Cancel events back to it. The frozen fields are
extrude depth, revolve angle, blind-hole depth, chamfer distance, fillet
radius, linear spacing and typed count, circular total angle and typed count,
mirror plane offset, and shell thickness. Sweep and loft receive preview only.
Through-all holes expose no depth grip. Binding-aware descriptors are
read-only and route to their owner; current solid drafts expose no authoritative
parameter/expression binding metadata, so the browser does not invent any.

No CadOp, schema, `.wcad` version, workspace package, production dependency,
approval mode, cache format, or agent authority was added.

## Named closer

Gate E passed on the named closer plus focused real-OCCT preview/Apply
same-shape parity:

```sh
pnpm smoke:v22-preview-grips-workflow
```

That command covers disposable projection, one preview job, the frozen
preview/grip matrix, binding routing, Apply revalidation, cleanup, and the
focused OCCT parity test. Apply never consumes preview artifacts as commit
proof. Same-shape invariants, not byte-identical B-rep, define parity.

The focused OCCT rows compare preview versus independently committed
topology signature, entity counts, volume, surface area, centroid, and
display counts for extrude create and linear-pattern spacing update.

## Validation completed

The named closer passed 136 targeted checks from
`df65d8cfcfadcb9329e0f47126dc66254fa147d8`: 3 cad-core projection, 127 web
(including two real-OCCT preview/Apply same-shape rows), 2 renderer preview,
2 real geometry-kernel artifact, and 2 real OCCT artifact/display. The prior
implementation record on `19e4aca9` had 130 targeted checks before the
focused parity file landed.

```sh
pnpm smoke:v22-preview-grips-workflow
pnpm --filter @web-cad/web typecheck
pnpm --filter @web-cad/cad-core typecheck
pnpm --filter @web-cad/renderer typecheck
```

`git diff --check` and eslint on the new parity file passed.

## Informational bundle sizes

These numbers are historical measurement, not a remaining Must. A
same-machine production build of the clean Gate D source at `bcca9ce8`, with
only the behavior-preserving `TechnicalDetails` case-collision rename
required to build on that macOS filesystem, measured:

| Artifact | Gate D comparison | Gate E | Delta |
| --- | ---: | ---: | ---: |
| Critical UI JavaScript | 408,674 | 410,862 | +2,188 |
| All non-worker UI JavaScript | 563,695 | 572,453 | +8,758 |
| Command worker | 262,251 | 262,251 | 0 |
| Geometry worker | 96,322 | 96,322 | 0 |
| OCCT WASM | 13,955,447 | 13,955,447 | 0 |

Command worker and OCCT WASM did not grow in Gate E. Those inherited sizes
are not a requirement to recover later. No minifier, metric formula, or
production dependency was changed to hide a measurement.

## Scope

Gates F–G subsequently passed, Gate H was deleted as a closer, and Gate I closed
the user goal and records. Gate E does not reopen.

Gate E is closed.
