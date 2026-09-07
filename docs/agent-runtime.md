# Agent runtime release

Status: complete. User-approved goal, September 7, 2026.

[Usage and examples](./agent-runtime-usage.md) ·
[Verification, measurements, and remaining limits](./agent-runtime-verification.md).

An agent can start a session, build a useful parametric part or small assembly,
inspect its real geometry, revise it, save it, and export usable geometry without
opening a browser. The same project and CADOps work in the web app, where a person
can inspect and edit the result. Modeling and revision should require a small
number of meaningful calls, with measured startup and warm-operation costs.

## Scope and architecture

CADOps, cad-core, and OCCT/WASM retain their existing authority. This release
completes and shares existing execution paths; it adds no modeling family or
native format version. A shared `packages/cad-runtime` package is allowed where
needed to lift host-independent exact evaluation, persistence, and session
orchestration out of the web app. Browser workers and Node execution are host
adapters over that shared logic. Reuse existing workspace dependencies; do not
add an external production dependency without a concrete need.

The existing MCP batch and query tools remain the modeling API. This goal allows
session capability discovery and headless native-file open/save and STEP export
tools (`cad.session_info`, `cad.project_open`, `cad.project_save`, and
`cad.project_export_file`) if needed. The existing `body.massProperties` query
may also be exposed as `cad.body_mass_properties` so agents can inspect exact
finished bodies instead of relying on legacy source-analytic measurements.
File access is scoped to the CLI's chosen
workspace. Existing browser-owned downloads continue through the browser host.
Keep tool responses compact and useful for deciding the next operation.

## Parallel delivery

The user explicitly authorized parallel agents and integration before pushing.
Use separate file ownership in this checkout; isolate worktrees if ownership
cannot prevent conflicts. One integrator owns shared configuration, release
documents, combined verification, and the final commit and push to main.

1. Runtime: shared exact session execution and persistence, real headless
   geometry and export, browser reuse of extracted logic.
2. Agent interface: headless stdio entry point, lifecycle/file tools, concise
   discovery and actionable failures through the existing CADOps adapter.
3. Performance: reproducible measurements and focused fixes supported by those
   measurements, with bounded caches and no unnecessary display work headless.

The runtime is the integration dependency. Agree its callable interface early.
Agents do not independently commit, push, or modify another lane's files.

## Completion evidence

Use two representative design-and-revision journeys, including real exact
geometry, a rejected operation that preserves the document, native save/reopen,
and STEP export. Verify headless/browser source compatibility and geometry
invariants, rather than treating metadata-only execution as exact proof. Use an
actual agent against the documented interface as part of acceptance.

Record cold startup, warm revision, geometry evaluation/export, and available
agent-call measurements. Timings are observations on the stated machine, not
flaky absolute assertions. A controlled OpenSCAD comparison is supporting
evidence only; do not claim superiority without measurements.

Run focused package tests and typechecks during development. At integration run
the named headless closer, command scenarios, and existing Chromium engine/Use
checks relevant to shared browser paths. Keep regression journeys few and
deterministic. GitHub Actions stays disabled.

Update README setup/usage, architecture boundaries, and the verification record
with actual commands, results, and remaining limitations before completion.
