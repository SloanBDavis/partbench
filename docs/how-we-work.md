# How we work

This is the development loop. Architecture stays in
[`docs/architecture.md`](./architecture.md). The current user goal is linked
from [`AGENTS.md`](../AGENTS.md).

## One architecture

There is one sticky core architecture:
[`docs/architecture.md`](./architecture.md). Do not invent a parallel
architecture. Do not implement the whole architecture at once.

## A release is a user goal

A release is one paragraph of what a person can do in the running app when the
release is done. That paragraph is the user goal.

The current user goal is the Product Goal in the doc linked from `AGENTS.md`.
Today that is V22 in [`docs/v22.md`](./v22.md): selectable, previewable,
measurable, and recoverable exact single-part CAD, with no new modeling
family.

Do not change V22 product scope, matrices, non-goals, or architecture
constraints. When a later release becomes current, update the link in
`AGENTS.md`. Do not paste a changelog into `AGENTS.md`.

## A slice is a step toward the user goal

A slice is a step toward that user goal, not a process artifact. If a slice
does not make the user goal more true in the running app, delete it.

Do not add a slice to replay paperwork, rerun a historical gauntlet, or
satisfy a named-command ritual that does not change what a person can do.

## Intense verification is the job

The default loop is:

1. Start the real Vite app with `pnpm dev`.
2. Drive the actual UI toward the user goal.
3. Observe.
4. Change code.
5. Observe again.

Repeat until the user goal is true.

Tests and named smokes are supporting evidence. They are not a substitute for
seeing the goal in the running app. If you cannot demonstrate the user goal in
`pnpm dev`, you are not done.

## What to run

Do not rerun the full historical release gauntlet on every save.

Per-save: focused tests and typecheck for the packages you touched.

Close a slice only when the user-goal increment is visible in the running app.
If that slice already has a named command, run it too. Do not invent a new
test runner, Playwright suite, or smoke script to close the loop.

Inherited V18–V21.1 named commands are compatibility history, not the daily
loop. They remain binding for those completed matrices. They are not a
per-save checklist.

V22 remaining work is H (cross-cutting audit), then I (release proof).
Passed gates A–G stay passed. Do not replay A–G paperwork.

## Question, delete, then build

Question process requirements. Delete the dumb ones instead of deferring them
to a later gate. Then build.

Do not add a new modeling family unless the current user-goal doc says so. Do
not add a schema, `.wcad` version, workspace package, or production dependency
unless that doc says so.

## Bundle sizes

Bundle sizes may be measured as informational evidence. Never cheat the metric
in the same change as a feature: no minifier, script, dependency, or cap
change that makes the number look better.

V21.1 gzip ceilings are not per-slice vetoes.
