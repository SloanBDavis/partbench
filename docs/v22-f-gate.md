# V22 Gate F Evidence

Status: **Passed (2026-08-30).**

This record closes sketch-dimension annotations and exact inspection. The
binding scope remains in [`docs/v22.md`](./v22.md), and the frozen matrices
and landing order remain in
[`docs/v22-implementation-dag.md`](./v22-implementation-dag.md). Former
production-browser gauntlet, gzip-ceiling, 512-annotation theater, p50/p95,
STEP/export-browser, and H-duplicated accessibility acceptance items were
removed from the plan. They are not remaining Must items for Gates G/H/I.

## Outcome

Gate F adds session on-canvas annotations for the existing V19 dimension
matrix. Labels are laid out in the browser session only. Click selects,
double-click or Enter opens the existing `sketch.dimension.update` editor,
and drag moves only the label. Parameter-bound dimensions show Parameter
and keep their binding. No new dimension family and no persisted layout.

Exact inspection reads already-resolved V21 artifacts. Single-target
body/face/edge/vertex values and pair distance/angle use current identity
(`bodyId`, body source signature, topology signature, local id / entity
signature). Unsupported cells return typed unavailable, not a fabricated
number. The source-analytic subentity pair approximation in
`apps/web/src/viewportTwoTargetMeasurement.ts` is replaced, not kept beside
the exact path.

Session pins refresh against current artifacts and go stale rather than
silently rebinding. They are not saved. One Inspect display-only section
plane (XY/XZ/YZ or a copied planar face, plus offset/flip) clips drawing
and picks together. It creates no source. Cut caps are not selectable.
Section does not change exact measurement or export authority.

No CadOp, schema, `.wcad` version, workspace package, production
dependency, approval mode, cache format, or agent authority was added.

## Deleted versus kept

Deleted as dumb Gate F requirements:

- production-browser / full keyboard-narrow-reduced-motion-high-zoom
  gauntlet;
- gzip/bundle ceilings as a fail;
- entire adversarial inventory, 512-annotation truncation theater, and
  p50/p95 as F closers;
- STEP/export browser workflows to prove measurements do not leak into
  source;
- leftover accessibility proof that duplicates Gate H.

Kept:

- session V19 annotations and existing edit path;
- exact single/pair measurement matrix with labeled authority;
- session pins that stale instead of rebinding;
- one display-only section plane that clips draw and picks together;
- replacement of the source-analytic pair approximation;
- focused real-OCCT measurement proof on the named closer.

## Named closer

Gate F passed on the named closer plus focused real-OCCT measurement proof:

```sh
pnpm smoke:v22-inspection-workflow
```

That command covers annotation layout, exact single/pair measurement, pin
stale/clear, display section clip agreement, Inspect/Sketch editor handoff,
and the focused OCCT proof. Measurements and section stay derived/session.
Cad-core remains source-authoritative.

## Validation completed

The named closer passed 38 targeted checks from
`d377ab265c214b9eb6c41edffd9559c5cde1d613`: 37
web (including one real-OCCT body/face/edge/vertex/pair measurement row
that leaves source, history, and source-authority epoch unchanged) and 1
renderer draw+pick clip-agreement row.

```sh
pnpm smoke:v22-inspection-workflow
pnpm --filter @web-cad/web typecheck
pnpm --filter @web-cad/renderer typecheck
```

`git diff --check` and the touched-package typechecks passed.

## Scope

Gates G–I remain pending for their product work: recovery, audit, and
release reconciliation. Gate F does not start Slice G.

Gate F is closed.
