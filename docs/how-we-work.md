# How we work

This is the development loop. Architecture stays in
[`docs/architecture.md`](./architecture.md). The current user goal is linked
from [`AGENTS.md`](../AGENTS.md). Proof is [`docs/verification.md`](./verification.md).

## One architecture

There is one sticky core architecture:
[`docs/architecture.md`](./architecture.md). Do not invent a parallel
architecture. Do not implement the whole architecture at once.

## A release is a user goal

A release is one paragraph of what a person can do in the running app when
the release is done. That paragraph is the user goal.

The current user goal is the Product Goal in [`docs/v26.md`](./v26.md).
V22-V25 are complete. Do not reopen them. Do not invent V27.

Do not replay V25 gates or V7-V25 gauntlets. Do not paste a changelog into
`AGENTS.md`.

## A slice is a step toward the user goal

A slice is a step toward that user goal, not a process artifact. If a
slice does not make the user goal more true, delete it.

## Proof

See [`docs/verification.md`](./verification.md). CADOps scenarios are command truth.
Chromium `applyOps` is the engine gate. Use is clicks in the workbench. All three for a UI slice.
Never Playwright. Never a second bot. Never the historical gauntlet.

Per-save: focused tests and typecheck of the packages you touched.

## Question, delete, then build

Question process requirements. Delete the dumb ones. Then build.

Do not add a new modeling family, schema, `.wcad` version, workspace
package, or production dependency unless the current user-goal doc says
so.

V21.1 gzip ceilings are not per-slice vetoes.
