# Partbench

Partbench is an open-source, browser-native, AI-native CAD application. The
current app has a typed CADOps command layer, in-memory document model,
viewport, project JSON / `.wcad` serialization, structured agent/MCP adapters,
and an isolated OCCT/WASM exact-geometry and derived-mesh path.

Completed releases through **V20** cover:

- source-of-truth sketches, parameters with arithmetic expressions, and the
  supported V11 sketch solver
- extrude, revolve, hole, chamfer/fillet, and supported cut/add boolean chains
- topology identity (checkpoints, anchors, match/repair) and topology-backed
  downstream modeling for the verified single-part support matrix
- native `.wcad` project workflow, OPFS derived mesh cache, and exact STEP
  export for supported authored bodies
- STEP import with imported-body topology integration
- linear/circular pattern, mirror, and shell features
- single-line sweep, parallel face-attached loft, expression language v2, and
  exact body mass-properties queries
- circular arcs, construction geometry, ordered composite profiles, and curved
  line/arc sweep paths
- deterministic trim/extend/split/offset, the documented production
  dimension/constraint matrix, and explicit material regions with holes
- region-backed extrude/revolve on the documented exact V19 matrix
- the Precision CAD Project, Sketch, Solid, and Inspect workbench
- viewport-native body/face/edge semantic selection with contextual
  Measure/Inspect
- an authenticated loopback launcher that connects MCP stdio tools to the
  project open in one browser tab, with current semantic selection and exactly
  Manual approval or session-only Approve everything

OCCT-derived meshes are display data only. The source of truth remains the typed
document and transaction history in `cad-core`.

## Requirements

- Node.js 22 or newer
- pnpm 10

## Setup

Install workspace dependencies:

```sh
pnpm install
```

## Development

Run the browser app:

```sh
pnpm dev
```

Start the connected local MCP session and production browser app:

```sh
pnpm --filter @web-cad/mcp-stdio-server start
```

The command builds the stdio executable, binds an authenticated random-port
server on `127.0.0.1`, opens the production app, and keeps MCP itself on stdin
and stdout. New sessions use Manual approval; Approve everything can be enabled
only from Project → Agent for the current session.

In development and production builds, supported authored features are submitted
to the derived geometry service by default and tessellated asynchronously in
the browser Worker. The returned mesh is displayed as derived renderer data,
app status surfaces report result readiness where appropriate, and the
authoritative CAD document is not updated by mesh generation.

Disable derived geometry for fallback debugging:

```sh
VITE_DISABLE_DERIVED_GEOMETRY=true pnpm dev
```

The same explicit fallback is available for production-build diagnostics:

```sh
VITE_DISABLE_DERIVED_GEOMETRY=true pnpm build
```

Run the full build:

```sh
pnpm build
```

Run package tests:

```sh
pnpm test
```

Run lint and format checks:

```sh
pnpm lint
pnpm format:check
```

Run TypeScript checks:

```sh
pnpm typecheck
```

Run the isolated geometry-worker bundle check:

```sh
pnpm build:geometry-worker
```

Run the non-gating OCCT browser smoke and append timing metrics:

```sh
pnpm smoke:occt-browser
```

This builds the isolated smoke page, launches a local Chromium-compatible
browser, verifies the OCCT worker tessellation path, and appends JSONL records to
`.metrics/occt-browser.jsonl`. Each record includes the scenario, browser
metadata where available, worker startup/WASM load outcome, timing metrics,
asset-size metrics, Brotli/gzip delivery metrics, and structured error details
on failure. Timing values are recorded for tracking, but the smoke fails only
when the path breaks or required metrics are missing. Set
`PARTBENCH_SMOKE_BROWSER=/path/to/chrome` if the script cannot find a browser.
The older `WEB_CAD_SMOKE_BROWSER` name remains accepted as a compatibility
alias.

Current OCCT/WASM load-size notes live in `docs/occt-wasm-size.md`.

## Documentation

- `docs/architecture.md` - long-term architecture.
- `docs/implementation-plan.md` - current implementation source of truth and
  roadmap, including condensed historical release records.
- `docs/v12.md` - completed V12 stable boolean topology and result references
  release record.
- `docs/v13.md` - completed V13 general topology identity and B-rep checkpoint
  foundation release record.
- `docs/v14.md` - completed V14 topology-backed downstream modeling release
  record.
- `docs/v15.md` - completed V15 STEP import, expanded feature families, and
  parameter expressions release record.
- `docs/v16.md` - completed V16 sweep, loft, pattern depth, expression
  extensions, and mass properties release record.
- `docs/v17.md` - completed V17 composite sketch profiles, arcs, and curved
  sweep paths release record.
- `docs/v18.md` - completed V18 Precision CAD UI overhaul release record.
- `docs/v19.md` - completed V19 production sketching and multi-region profiles
  release record.
- `docs/v20.md` - completed V20 connected local agent workflow release record.
- `docs/native-format.md` - current JSON format and native project package
  direction.
- `docs/occt-wasm-size.md` - OCCT/WASM size findings and recommendations.

## Workspace Layout

- `apps/web` - Vite browser app and explicit worker entrypoints
- `packages/cad-protocol` - typed CADOps command and query protocol
- `packages/cad-core` - document model, transactions, undo/redo, project JSON /
  `.wcad`
- `packages/renderer` - simple renderer abstraction and canvas viewport support
- `packages/occt-wasm` - isolated OCCT/WASM loading and exact-geometry boundary
- `packages/geometry-kernel` - typed primitive, feature, STEP, pattern/mirror/
  shell, exact-metadata, and edge-finish geometry facade
- `packages/geometry-worker` - async worker boundary for derived geometry and
  exact metadata
- `packages/renderer-mesh-bridge` - mesh data adapter for the current renderer
- `packages/sketch-solver` - pure TypeScript 2D sketch solver
- `packages/agent-adapter` - CADOps adapter for external structured callers
- `packages/mcp-adapter` - MCP tool wrapper over the structured adapter
- `packages/mcp-stdio-server` - local stdio JSON-RPC MCP transport and
  authenticated production-app launcher/relay

## Project Format

Current project JSON/`.wcad` exports use the lowest schema required by source
truth: `web-cad.project.v16` for ordinary current features, `v17` when advanced
sketch constraints are present, `v18` when topology identity records are
present, and `v19` when V15 imported-body / pattern / mirror / shell /
expression records are present, `v20` for V16 sweep/loft and expanded
pattern/reference source records, `v21` for V17 arc/composite-profile source,
and `v22` for V19 normalized dimensions, exact regions, retained V19
history/diffs, or an authoritative history baseline. V1 through V22 remain
importable through explicit migrations. Derived region candidates, meshes,
solver status, exact metadata, topology
snapshots, and geometry status are never saved as source-of-truth data;
checkpoint payload bytes for topology identity are preserved in `.wcad` v2, not
in JSON.

`web-cad.project.*`, `web-cad.agent-adapter.v1`, and the `@web-cad/*`
workspace package scope are retained as compatibility identifiers. They are not
current product branding and should not be changed without a deliberate
protocol/package migration.

## Current Limitations

- The renderer still uses simple primitive drawing as fallback while
  OCCT-derived meshes are loading, disabled, unavailable, or failed.
- OCCT/WASM is intentionally isolated behind geometry-worker/kernel boundaries
  and backs primitive tessellation, authored feature meshes, supported
  boolean/pattern/mirror/shell results, STEP import/export, and derived exact
  metadata where available.
- Topology-backed commandability is limited to the verified support matrices in
  the V12–V19 release records. Unsupported or low-confidence topology remains
  structured diagnostic output rather than silent retargeting.
- Parameter expressions support pure degree-first trigonometry, comparisons,
  ternaries, and `if`; scripting and general boolean operators are deferred.
  Multi-line curved sweeps, free non-parallel lofts, assemblies, production WebGPU, hosted
  collaboration, production MCP auth, natural-language command parsing, IGES,
  and proprietary CAD import are not implemented unless scoped into a later
  release.
- V19 supports its documented analytic sketch-edit, dimension/constraint, and
  exact region extrude/revolve matrix. Splines, associative offset features,
  composite sweep/loft regions, assemblies, drawings, and production WebGPU
  remain out of scope.
- The connected local agent supports one launcher process, one browser
  authority, and one pending Manual-approval proposal. It does not provide
  hosted transport, built-in chat, agent file access, multiple live projects,
  remembered approval policy, or a third approval mode.

See `docs/implementation-plan.md` for the full current capabilities and
limitations list.
