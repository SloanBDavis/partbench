# V22 Gate E Implementation Evidence

Status: **Implemented; acceptance blocked.**

This record describes the landed Gate E implementation without marking the
gate passed. The binding requirements remain in [`docs/v22.md`](./v22.md) and
[`docs/v22-implementation-dag.md`](./v22-implementation-dag.md).

## Outcome

Gate E now has a disposable cad-core projection helper that evaluates the same
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

## Validation completed

The named focused command passes:

```sh
pnpm smoke:v22-preview-grips-workflow
```

It reports 130 targeted passing checks: 3 cad-core projection checks, 121 web
checks, 2 renderer preview checks, 2 real geometry-kernel artifact checks, and
2 real OCCT artifact/display checks. The post-compaction geometry/panel run
also passed 43 checks.

These typechecks pass:

```sh
pnpm --filter @web-cad/web typecheck
pnpm --filter @web-cad/cad-core typecheck
pnpm --filter @web-cad/renderer typecheck
```

`git diff --check` passes and the working tree is clean at this record's
authoring point.

## Blocking bundle evidence

The fixed caps are unchanged. A same-machine production build of the clean
Gate D source at `bcca9ce8`, with only the behavior-preserving
`TechnicalDetails` case-collision rename required to build on this macOS
filesystem, measured:

| Artifact | Gate D comparison | Current Gate E | Delta | Fixed cap |
| --- | ---: | ---: | ---: | ---: |
| Critical UI JavaScript | 408,674 | 410,862 | +2,188 | 409,600 |
| All non-worker UI JavaScript | 563,695 | 572,453 | +8,758 | 563,200 |
| Command worker | 262,251 | 262,251 | 0 | 262,144 |
| Geometry worker | 96,322 | 96,322 | 0 | 122,880 |
| OCCT WASM | 13,955,447 | 13,955,447 | 0 | 13,808,536 |

This comparison separates Gate E growth from restored-environment drift: the
worker and WASM overages reproduce unchanged at Gate D, while Gate E itself
adds 2,188 gzip bytes to critical UI and 8,758 gzip bytes to all UI. The
current `pnpm check:v22-bundle` is therefore red. No cap, dependency, minifier,
or metric was changed to hide the failure.

## Missing acceptance proof

Gate E remains open until all of the following are recorded:

- deletion or consolidation brings every fixed bundle metric under its cap in
  the approved release environment;
- a production-browser workflow proves every frozen preview/grip row through
  pointer, keyboard, typed, and invalid input paths;
- that browser proof covers rapid replacement, failure, Cancel, Apply,
  undo/redo, source change, cleanup, retained memory, and no source/cache
  mutation; and
- preview/Apply same-shape B-rep, topology, mass, and display parity is
  recorded for the required real-OCCT matrix, not only focused artifact paths.

Gate F must not treat this record as Gate E acceptance.
