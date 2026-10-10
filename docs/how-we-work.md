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

V22-V26 are complete ([`docs/v26.md`](./v26.md)). Do not reopen them. Do not invent V27. Next is a new user goal.

Do not replay V25 gates or V7-V25 gauntlets. Do not paste a changelog into
`AGENTS.md`.

## A slice is a step toward the user goal

A slice is a step toward that user goal, not a process artifact. If a
slice does not make the user goal more true, delete it.

## Proof

See [verification.md](./verification.md). Only E2E tests: real workbench controls
or the public MCP process, real geometry and file round trips. Never write unit,
component, isolated integration, or mock-based tests. Extend existing journeys;
add another only when the user workflow cannot fit one already present.

Per-save: typecheck the packages touched. Before landing: `pnpm verify`.
Use focused E2E journey selection during development. No Chromium on every save,
no historical gauntlet, no second browser framework.

## Question, delete, then build

Question process requirements. Delete the dumb ones. Then build.

Do not add a new modeling family, schema, `.wcad` version, workspace
package, or production dependency unless the current user-goal doc says
so.

V21.1 gzip ceilings are not per-slice vetoes.
