# How we work

This is the development loop. Architecture stays in
[`docs/architecture.md`](./architecture.md). The current user goal is linked
from [`AGENTS.md`](../AGENTS.md).

## One architecture

There is one sticky core architecture:
[`docs/architecture.md`](./architecture.md). Do not invent a parallel
architecture. Do not implement the whole architecture at once.

## A release is a user goal

A release is one paragraph of what a person can do in the running app when
the release is done. That paragraph is the user goal.

The current user goal is the Product Goal in [`docs/v23.md`](./v23.md).
V22 and V23 are complete. There is no next release. Do not invent V24.

Do not replay V23 gates or V7–V22 gauntlets. Do not paste a changelog into
`AGENTS.md`.

## A slice is a step toward the user goal

A slice is a step toward that user goal, not a process artifact. If a
slice does not make the user goal more true, delete it.

## Proof

Proof is a `scenarios/` CADOps scenario and its semantic diffs, not
Playwright. `pnpm verify` runs typecheck plus the scenarios runner.

Historical named smokes live under the `legacy:` prefix. They are
compatibility history. They are not the daily loop. Never rerun V7–V22
gauntlets.

Per-save: focused tests and typecheck of the packages you touched.

Close a slice when the named closer is green and the user-goal increment
is visible via a scenarios/ CADOps scenario (and `pnpm dev` if the slice
is UI).

## Question, delete, then build

Question process requirements. Delete the dumb ones. Then build.

Do not add a new modeling family, schema, `.wcad` version, workspace
package, or production dependency unless the current user-goal doc says
so.

V21.1 gzip ceilings are not per-slice vetoes.
