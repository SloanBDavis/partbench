# Implementation Plan

This document is the current implementation source of truth. It translates the
long-term architecture in `docs/architecture.md` into the repo state and the
active implementation roadmap.

Last updated: 2026-06-21.

Use this document for day-to-day implementation decisions. Use
`docs/architecture.md` for long-term design, `docs/v12.md` for the completed
stable boolean topology and result references release record, `docs/v13.md` for
the planned general topology identity and B-rep checkpoint foundation release
record, `docs/native-format.md` for project-format direction, and
`docs/occt-wasm-size.md` for OCCT/WASM load-size findings. V7, V8, V9, V10,
and V11 are completed historical releases whose details are now condensed in
this plan instead of maintained as separate release documents.

## Active Rules

These constraints remain active:

1. CADOps is the center of the system.
2. Human UI, scripts, tests, and MCP/agent adapters use the same command layer.
3. `cad-core` owns authoritative document state.
4. Rendered primitives, meshes, topology snapshots, exact metadata, thumbnails,
   and storage caches are derived views or caches unless a scoped tranche
   explicitly adds new source-of-truth data.
5. React UI does not import geometry internals directly.
6. Geometry, renderer, command engine, protocol, storage, and MCP boundaries stay
   separate.
7. MCP wraps CADOps. MCP does not define the internal API.
8. OCCT/WASM, WebGPU, OPFS, STEP, exact topology, assemblies, and hosted
   collaboration are expanded only in scoped tranches.
9. V2, V3, V4, V5, and V6 are complete. V7 is complete through the documented
   A-H1 real CAD alpha/release-readiness scope.
10. V8 is complete through the documented release-candidate scope. Its center is
    native `.wcad` package storage, File System Access local workflow,
    OPFS-derived cache, and exact STEP export for supported authored source
    bodies through the geometry boundary.
11. V9 is complete through the final H3 release-candidate audit/docs scope. Its
    center is viewport-native CAD interaction: renderer-agnostic hit
    candidates, semantic selection resolution, command-ready viewport
    selections, compact contextual tools, exact/semantic inspect and measure
    workflows, and release-grade browser interaction smokes.
12. V10 is complete through the final release audit/docs scope. Its center is
    editable feature history, source-backed feature edit/rebuild semantics,
    stable reference health and repair, scoped generated-reference expansion,
    compact product integration, and release-grade edit/rebuild/browser smokes.
13. Future implementation tranches should stay independently testable and
    should not mix schema migration, broad UI workflow changes, stable reference
    expansion, unrelated new modeling commands, persistent B-rep checkpoints,
    WebGPU, assemblies, STEP import, or hosted collaboration without explicit
    approval. V11 is complete as the explicit sketch solver expansion scope.
    V12 is complete as the stable boolean topology and result references
    release. V13 is the planned implementation scope for general topology
    identity, B-rep checkpoints, topology anchors, matching, repair, and
    checkpoint-backed commandability. Completed V8, V9, V10, V11, and V12
    tranche records below remain historical release records and compatibility
    guardrails. Do not re-open those releases unless the user explicitly asks
    for a maintenance or regression-fix tranche.
14. V8 Tranche A is implemented as a protocol and pure-helper slice only:
    `partbench.wcad.v1` manifest/source-identity types, structured package
    validation diagnostics, `project.packageReadiness`, and thin agent/MCP
    pass-through. It does not implement ZIP read/write, File System Access,
    OPFS writes, STEP export, CBOR encoding, or `web-cad.project.v17`.
15. V8 Tranche B is implemented in `cad-core` as deterministic `.wcad` package
    bytes: ZIP-compatible `manifest.json`, `document.cbor`, and
    `commands.cbor`; canonical CBOR source encoding; manifest hash/length and
    source-identity validation; structured package diagnostics; and import
    through the existing current project importer. It does not add browser File
    System Access UI, upload/download fallback UI, OPFS writes, STEP export, or
    `web-cad.project.v17`.
16. V8 Tranche C is implemented in the web app as the `.wcad` project workflow:
    Open, Save, and Save As use File System Access where available, fall back to
    `.wcad` upload/download, keep JSON as explicit interchange/debug, and keep
    file handles out of cad-core, project source, `.wcad`, agents, and MCP.
17. V8 Tranche D1 is implemented as an app-layer OPFS cache foundation:
    `partbench.opfs-cache.v1` status/index helpers, structured diagnostics,
    Project/File cache status/refresh/clear, and source/cache separation tests.
    D1 itself did not populate derived mesh, thumbnail, package-unpack, or
    export intermediate artifacts.
18. V8 Tranche D2 is implemented as the first narrow OPFS artifact population
    slice: `partbench-derived-mesh.v1` derived visualization mesh artifacts are
    keyed by source identity, document schema, units, derived-geometry source
    key, kernel/worker versions, and tessellation settings; cache reads and
    writes are app-layer, optional, and fail open to existing derived generation.
    It does not cache thumbnails, package-unpack data, export intermediates, or
    project source, and it does not introduce `web-cad.project.v17`.
19. V8 Tranche E1 is implemented as the exact STEP export contract/readiness
    slice: protocol/core `project.exportExact` for `step`,
    exact-vs-visualization `project.exportReadiness`, geometry-kernel/worker
    STEP writer capability probes, Project/File status, and thin agent/MCP
    pass-through. It reports structured writer-unavailable diagnostics and does
    not produce placeholder STEP bytes or introduce `web-cad.project.v17`.
20. V8 Tranche E2 is implemented as the first real exact STEP writer path:
    OCCT/WASM writer capability is proven at the isolated geometry boundary,
    geometry-kernel/worker can produce AP242 STEP bytes for supported active
    rectangle/circle `newBody` extrude source bodies, Project/File exposes a
    restrained STEP download action, and cad-core/agent/MCP continue to return
    source/export contract data rather than owning OCCT or browser file APIs.
    STEP artifacts are transient export outputs and are not stored in `.wcad`,
    JSON, OPFS, command history, source identity, or `web-cad.project.v17`.
21. V8 release-candidate hardening has addressed the cross-tranche review
    issues: public topology source identity now exposes an opaque `signature`,
    `project.exportExact` validates caller-provided source identity against the
    current source before reporting it matched, writer-unavailable STEP seams
    are covered even while the current writer is available, OPFS and `.wcad`
    writes abort failed writable streams, OPFS source identities require
    canonical SHA-256 hashes, and Project/File copy/layout stays focused on the
    primary CAD workflow.
22. V9 Tranche A is implemented as a contract and pure-helper slice:
    renderer-agnostic pointer intent, private hit-candidate, hover/selection,
    command-target, measurement-target, and diagnostic protocol shapes plus app
    helpers that map supported semantic viewport hints into
    `selection.referenceCandidates`. It does not implement full viewport
    picking, WebGPU, assemblies, persisted viewport/session state, or
    `web-cad.project.v17`.
23. V9 Tranche B is implemented as the first direct viewport-selection slice:
    the current canvas/app body hit path creates private V9 hit candidates,
    resolves supported body/object-backed body picks through
    `selection.referenceCandidates`, updates the existing semantic selection
    state, preserves the user's Tree/Selection tab preference, and adds body
    hover/preselection visuals. It does not implement generated face/edge
    picking, WebGPU, assemblies, persisted viewport/session state, or
    `web-cad.project.v17`.
24. V9 Tranche C1 is implemented as a narrow generated planar face
    picking/reference-routing slice: when a supported rectangle/circle
    `newBody` extrude body is already selected, the current canvas/app path can
    refine a viewport body hit into a private generated planar face hit
    candidate, resolve it through the V9 helper path and
    `selection.referenceCandidates`, and update the existing generated-reference
    selection, inspector, and modeling workflow state. It does not implement
    generated edge/vertex picking, exact face-level visual highlighting,
    WebGPU, assemblies, persisted viewport/session state, or
    `web-cad.project.v17`.
25. V9 Tranche C2 is implemented as a narrow generated edge
    picking/reference-routing slice: when a supported rectangle/circle
    `newBody` extrude body is already selected, the current canvas/app path can
    refine a viewport body hit into a private generated edge hit candidate for
    rectangle cap/longitudinal edges and circle start/end circular edges,
    resolve it through the V9 helper path and
    `selection.referenceCandidates`, and update the existing generated-edge
    selection, inspector, and modeling workflow state. It does not implement
    generated vertex picking, exact edge-level visual highlighting, arbitrary
    result-body edge topology, WebGPU, assemblies, persisted viewport/session
    state, or `web-cad.project.v17`.
26. V9 Tranche D1 is implemented as the first semantic viewport visual-state
    input slice: the app derives one restrained display vocabulary for
    hover/preselection, selected, command-target, warning/blocked, pending, and
    failed states; the renderer receives display-only target IDs, display
    entity kinds, and state names; generated face/edge selections distinguish
    status text while highlighting the owning body; and detailed diagnostics
    stay in Selection, Inspector, and Modeling surfaces. It does not implement
    exact face/edge canvas highlighting, WebGPU, persisted viewport state, new
    modeling commands, OPFS/file/project schema changes, agent/MCP changes, or
    `web-cad.project.v17`.
27. V9 Tranche E1 is implemented as the compact contextual command-surface
    slice: viewport selections now derive a restrained adjacent action surface
    from `selection.referenceCandidates`, `deriveModelingActions`, and existing
    reference/measurement helpers. Supported generated planar faces can launch
    create-sketch-on-face, supported generated rectangle edges can launch
    chamfer/fillet through existing edge-finish defaults, generated references
    can be named through the existing naming command, and measure/inspect
    affordances use existing query-backed display helpers. It does not add new
    modeling commands, persisted viewport/tool state, Tree/Selection tab
    auto-switching, renderer command authority, WebGPU, OPFS/file/project schema
    changes, agent/MCP changes, or `web-cad.project.v17`.
28. V9 Tranche F1 is implemented as the single-target Measure/Inspect contract:
    compact viewport Measure/Inspect can show selected body, generated planar
    face, generated edge, and resolved named-reference values from existing
    query-backed body/reference measurement helpers, with explicit authority
    labels and structured stale, consumed, ambiguous, missing, unsupported, and
    unavailable-source diagnostics. It does not add two-target distance/angle,
    persisted measure state, new modeling commands, renderer authority,
    OPFS/file/project schema changes, agent/MCP changes, WebGPU, assemblies,
    STEP import, broad topology naming, or `web-cad.project.v17`.
29. V9 Tranche F2 is implemented as a narrow, session-only two-target
    measurement workflow: compact viewport Measure can capture a first
    semantic target, preview/commit a second selected semantic target, and show
    source-backed distance/angle rows with explicit authority and structured
    missing, stale, consumed, ambiguous, unsupported, non-commandable, and
    display-approximation-only diagnostics. It derives target points/vectors
    only from existing `body.measurements`,
    `body.generatedReferenceMeasurements`, and
    `selection.referenceCandidates` state. It does not add persisted
    measurements, sketch constraints, command history, renderer authority,
    OPFS/file/project schema changes, agent/MCP changes, WebGPU, assemblies,
    STEP import, broad topology naming, or `web-cad.project.v17`.
30. V9 Tranche G1 is implemented as a compact session-only navigation/camera
    ergonomics slice: shared viewport camera action helpers now cover Fit all,
    Fit selected with owning-body fallback for generated references, Reset,
    Zoom, and Top/Front/Right/Isometric standard views; Escape clears transient
    viewport hover/pick diagnostics, contextual detail, and active two-target
    measurement state only outside editable controls. It does not add persisted
    named views, user preferences, command history, storage/schema changes,
    renderer authority, WebGPU, assemblies, STEP import, broad topology naming,
    agent/MCP changes, or `web-cad.project.v17`.
31. V9 Tranche H1 is implemented as release smoke matrix expansion: the
    browser workflow smoke now covers direct circle `newBody` viewport body,
    generated planar face, and generated circular edge routing; session-only
    Escape clearing for active two-target/contextual detail; viewport
    unobstructed assertions after navigation, measurement, and project
    round-trip; and a narrow viewport smoke check through the existing CDP
    harness. It does not change CAD behavior, modeling commands, renderer
    authority, project/source schemas, persisted UI state, WebGPU, assemblies,
    STEP import, agent/MCP behavior, or `web-cad.project.v17`.
32. V9 Tranche H2 is implemented as responsive UX QA and diagnostic polish:
    compact contextual/status text wraps instead of clipping, status/contextual
    surfaces avoid overlap through app-layer layout state, blocked viewport
    summaries prefer structured diagnostic messages over generic labels, and
    the browser workflow smoke now requires desktop readability plus
    narrow/mobile clipping and scroll-trap checks. It does not change CAD
    behavior, modeling commands, renderer authority, project/source schemas,
    persisted UI state, WebGPU, assemblies, STEP import, agent/MCP behavior, or
    `web-cad.project.v17`.
33. V9 Tranche H3 is implemented as the final release-candidate audit and
    documentation gate: V9 docs now separate completed viewport-native behavior
    from post-RC deferrals, document the exact RC validation command set, keep
    the compatibility browser workflow script names clear, and add a
    `smoke:v9-viewport-workflow` package-script alias over the existing browser
    workflow runner. It does not add CAD behavior, modeling commands, renderer
    authority, project/source schemas, persisted UI state, WebGPU, assemblies,
    STEP import, agent/MCP behavior, or `web-cad.project.v17`.
34. V10 is complete as the editable feature history and stable modeling
    references release. Its release details are now condensed in this plan.
    Tranche A is implemented as the
    `feature.editability` contract/query slice. Tranche B is implemented as the
    `project.dependencyGraph` and `reference.health` contract/query slice:
    source-derived graph nodes/edges and reference health cover sketches,
    sketch entities, features, bodies, generated references, named references,
    consumed target bodies, and ambiguous/unsupported/deferred result topology
    with structured diagnostics and thin agent/MCP pass-through. Tranche C1 is
    implemented as the first real edit commit path: supported authored
    rectangle/circle `newBody` extrude depth/side edits go through
    `feature.updateExtrude`, produce semantic feature/body rebuild effects plus
    V10 reference effects, preserve active generated/named references, block
    consumed or boolean-result edits, and remain visible through transaction
    history, agent, and MCP surfaces. Tranche C2 is implemented as the
    conservative source-backed edit path for current authored revolve, hole,
    chamfer, and fillet parameters: `feature.updateRevolve`,
    `feature.updateHole`, `feature.updateChamfer`, and `feature.updateFillet`
    support dry-run and commit through CADOps, update authoritative feature
    source fields, produce semantic feature/body diffs plus V10 reference
    effects, keep `feature.editability`, `project.dependencyGraph`, and
    `reference.health` consistent, and remain thinly available through
    agent/MCP batch surfaces without introducing `web-cad.project.v17`. Tranche
    D1 is implemented as the `project.rebuildPlan` and lifecycle semantic-diff
    slice: cad-core reports active/source, consumed target, result, modified,
    repair-needed/ambiguous, unsupported, and derived-rebuild-pending body
    lifecycle state from authoritative document structure, dependency/reference
    health, and latest V10 edit diffs, and agents/MCP expose thin pass-through
    without UI or renderer authority. Its broader center remains transactional
    downstream rebuild execution, replacement/stale/failed result-body
    transitions, reference survival/repair semantics, and source-semantic
    topology expansion for existing authored feature families where defensible.
    Tranche D2 is implemented as the first transactional source-model rebuild
    slice for scoped direct chains: `feature.updateExtrude` can edit a
    supported rectangle/circle `newBody` source consumed by one supported
    downstream cut/add extrude, hole, chamfer, or fillet whose existing source
    records can be revalidated and whose result body is not itself consumed. D2
    marks consumed source targets, modified/replacement direct downstream
    results, and repair-needed result topology through semantic diffs and
    `project.rebuildPlan`, keeps `feature.editability`,
    `project.dependencyGraph`, and `reference.health` consistent, preserves
    lifecycle state across unrelated commits through current transaction
    history, leaves failed source-model rebuild non-mutating, and does not
    introduce `web-cad.project.v17`. Tranche E1 is implemented as the first
    source-semantic stable-reference expansion for result features: supported
    authored hole result bodies now expose deterministic generated body,
    cylindrical wall-face, and start-rim edge references from public source
    data and current hole source state. E1 keeps source target bodies
    consumed, keeps cut/add, revolve, chamfer, and fillet result topology
    diagnostic-only or repair-needed, defers hole axis plus blind terminal-rim
    and through-all exit-rim references, and does not introduce
    `web-cad.project.v17`. Tranche E2 is implemented as the query-only
    generated axis slice: supported authored revolve `newBody` result bodies
    expose deterministic generated body plus `revolveAxis` references, and
    supported authored hole result bodies add deterministic `holeAxis`
    references beside the E1 body/`holeWall`/`startRim` references. E2 keeps
    axes selection/name-only, keeps measurement, attach-sketch, chamfer,
    fillet, cut/add result refs, revolve faces/edges, chamfer/fillet
    replacement topology, and hole terminal/exit rims unsupported or
    diagnostic-only, and does not introduce `web-cad.project.v17`. Tranche F1
    is implemented as the first `sketch.editReadiness` query slice: UI,
    agents, MCP, and future sketch edit commands can ask for non-mutating
    readiness over supported rectangle width/height, circle radius, line
    length, current sketch dimension edits, and current validated/evaluated
    constraint edits. Cad-core derives sketch health, affected features/bodies,
    body lifecycle, rebuild-plan consistency, reference effects, and structured
    unsupported/missing/stale/over-defined/under-defined/non-rebuildable/
    consumed/ambiguous/schema-migration diagnostics from authoritative source
    state, exposes thin adapter/MCP pass-through, and does not introduce
    `web-cad.project.v17`. Tranche G1 is implemented as the first explicit
    named-reference repair contract: `reference.repairName` intentionally
    retargets an existing named generated reference to a new command-ready,
    kind-compatible generated target through the existing dry-run/commit
    CADOps path, records before/after `namedRepaired` semantic diffs, keeps
    resolve/health/selection/dependency/history/undo/redo consistent, and
    rejects missing, stale, unsupported, consumed, ambiguous, and kind-mismatch
    repair targets with structured diagnostics without introducing
    `web-cad.project.v17`. V10 must not become arbitrary topological naming,
    production WebGPU, assemblies, STEP import, broad sketch solving, broad new
    modeling features, or persisted UI state unless a later tranche explicitly
    scopes one of those items.
35. V11 is complete as the full sketch solver and parametric sketch UX release.
    Its release details are now condensed in this plan. Its center is
    source-backed constraints and dimensions,
    custom solver diagnostics, profile validity, drag-solve preview/commit,
    compact sketch UI, downstream V10 rebuild/reference-health integration,
    agent/MCP parity, and JSON/`.wcad` round-trips for new sketch source data.
    V11 introduced `web-cad.project.v17` only for advanced sketch constraint
    source records while ordinary projects continue to export as V16. It does
    not scope WebGPU, assemblies, STEP import, persistent B-rep checkpoints,
    hosted collaboration, natural-language command entry, broad new solid
    modeling families, or renderer authority over sketch solving.
36. V12 is complete in `docs/v12.md` as the stable boolean topology and
    result references release. Its center is source-semantic generated topology
    for supported cut/add boolean result bodies, command-ready result
    faces/edges, reference health/repair through edits, compact product
    integration, and release smokes for cut/add result workflows. Tranches A-D1
    are implemented for the first rectangle cut subset: typed
    `body.topology.booleanTopology` readiness, source-semantic cut-wall face
    roles, command-ready generated face references that can be selected, named,
    measured, and used for `sketch.createOnFace`, command-ready cut-wall
    profile edge references, and command-ready rectangle added-cap profile edge
    references for selection, naming, and measurement. The current add-face
    source/query slice also exposes command-ready rectangle add wall/cap face
    references for selection, naming, measurement, and `sketch.createOnFace`.
    The circle tool source/query slice admits supported circle cut/add tool
    profiles and exposes command-ready circle cut-wall/rim references plus
    circle add-wall/cap/cap-edge references, with cylindrical faces and circle
    edges limited to selection, naming, and measurement while planar added caps
    can still host sketches.
    Tranche E1 is implemented for scoped upstream
    source-extrude edits: semantic diffs report supported V12 cut-wall
    face/edge generated and named references as active while unproven result
    topology still reports ambiguous replacement; supported rectangle add
    wall/cap face references now receive the same active effects. The current
    edit-effects slice extends that behavior to supported source
    `sketch.updateEntity` profile edits and `sketch.dimension.update` driving
    dimension edits, plus source-affecting solver-backed midpoint constraint
    creation and fresh driving dimension creation. Tranche F1 keeps browser
    product surfaces compact by surfacing only semantic-reference-advertised
    actions. Tranche G2 adds browser smoke coverage for cut-result face/edge
    and add-result face/edge reference workflows, including circle-tool cut/add
    wall/cap/rim/edge browser checks, while the deterministic V12 source smoke
    covers rectangle cut, rectangle add, and circle tool boolean reference
    chains.
    V12 should not introduce broad arbitrary topology naming, persistent exact
    B-rep checkpoints, WebGPU, STEP import, assemblies, broad new modeling
    commands, or a new saved-project schema unless a tranche explicitly adds new
    source-of-truth topology anchor data.
37. V13 is planned in `docs/v13.md` as the general topology identity and B-rep
    checkpoint foundation release. Its center is one shared subsystem for exact
    topology snapshots, checkpoint package payloads, stable public topology
    anchors, matching confidence/evidence, explicit repair records, reference
    health integration, and command eligibility. V13 is allowed to introduce
    `web-cad.project.v18` and `partbench.wcad.v2` only when it persists
    topology anchors, checkpoint metadata, repair records, or authoritative
    checkpoint payload entries. It must not treat OCCT indexes, renderer/mesh
    IDs, GPU/selection-buffer IDs, OPFS paths, file handles, local paths, or
    viewport/session state as public stable CAD references.

## Current Repo State

Partbench is implemented as a TypeScript pnpm workspace with a Vite React app
and focused packages:

- `apps/web` - browser UI, command worker, geometry worker entrypoint,
  derived-geometry orchestration, primary Project/File panel, reduced workspace
  tools drawer, current canvas viewport with V9 body/face/edge picking,
  visual-state routing, compact contextual command surface, single-target
  Measure/Inspect, session-only two-target measurement, compact
  camera/navigation controls, first feature tree, improved modeling workflow,
  and focused UI helpers.
- `packages/cad-protocol` - typed CADOps command, batch, query, actor metadata,
  feature editability, dependency/reference-health, generated-reference role
  and signature, named-reference repair diff shape, and validation error
  shapes.
- `packages/cad-core` - authoritative in-memory document model, transactions,
  semantic diffs, undo/redo, queries, measurements/extents, source-of-truth
  sketches, document parameters, driving sketch dimensions, horizontal/vertical
  line constraints, fixed/coincident/midpoint point constraints, parallel and
  perpendicular line constraints, authored rectangle/circle extrude features,
  narrow rectangle-tool add/cut boolean source data, authored revolve, hole,
  chamfer, and fillet source intent, named references, feature editability,
  source-derived dependency graph/reference-health queries, source-semantic
  generated references for supported authored hole result bodies, explicit
  named-reference repair, and versioned project JSON import/export.
- `packages/renderer` - renderer-facing primitive and mesh types plus the
  current canvas viewport.
- `packages/renderer-mesh-bridge` - adapter from serializable geometry-worker
  mesh data into renderer mesh data.
- `packages/occt-wasm` - isolated OCCT/WASM loading and tessellation boundary.
- `packages/geometry-kernel` - typed primitive, extrude, narrow boolean,
  exact-metadata, revolve, hole, and edge-finish geometry facade around the
  isolated OCCT path.
- `packages/geometry-worker` - async geometry worker request/response boundary.
- `packages/sketch-solver` - pure TypeScript 2D sketch solver package for V11
  normalized solve models, constraints, dimensions, diagnostics, and
  deterministic numerical results.
- `packages/agent-adapter` - structured adapter over CADOps batch/query APIs.
- `packages/mcp-adapter` - MCP tool wrapper over the structured adapter.
- `packages/mcp-stdio-server` - minimal stdio JSON-RPC MCP transport.
- `scripts/smoke-v7-release-samples.mjs` and
  `scripts/v7-release-samples.mjs` - deterministic non-browser V7 release
  sample acceptance smoke over cad-core source/query fixtures.
- `scripts/smoke-v11-release-samples.mjs` and
  `scripts/v11-release-samples.mjs` - deterministic non-browser V11 sketch
  solver release smoke over cad-core source/query/edit/rebuild/package chains.
- `scripts/smoke-v12-release-samples.mjs` and
  `scripts/v12-release-samples.mjs` - deterministic non-browser V12 stable
  boolean topology/reference smoke over rectangle and circle tool cut/add
  chains.
- `scripts/smoke-occt-browser.mjs` and `scripts/occt-smoke` - non-gating
  browser smoke/metrics runner for the OCCT worker path.

Compatibility identifiers retained during the Partbench rename:

- `@web-cad/*` workspace package names remain stable to avoid broad import and
  lockfile churn.
- `web-cad.project.v1` through `web-cad.project.v17` remain project-format schema
  identifiers. Renaming them would be a storage migration.
- `web-cad.project.v7` is an older saved-project schema version, not the V7
  release. `web-cad.project.v8` is also an older saved-project schema version,
  not the V8 release. If a future release adds new source-of-truth document
  data after V11, the next saved schema should be `web-cad.project.v18`. The
  completed V12 release does not require V18 for query-derived boolean topology.
- `web-cad.agent-adapter.v1` remains the adapter protocol identifier.

## Current Scripts

Common development:

```sh
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm lint
pnpm format:check
pnpm smoke:v7-release-samples
pnpm smoke:v10-release-samples
pnpm smoke:v11-release-samples
pnpm smoke:v12-release-samples
pnpm smoke:v7-browser-workflow
pnpm smoke:v7-browser-workflow:derived
pnpm smoke:v8-wcad-workflow
pnpm smoke:v9-viewport-workflow
pnpm smoke:v10-browser-workflow
pnpm smoke:v12-browser-workflow
```

Derived geometry is enabled by default for local Vite serve:

```sh
pnpm dev
```

Use primitive fallback mode when debugging rendering or geometry-worker issues:

```sh
VITE_DISABLE_DERIVED_GEOMETRY=true pnpm dev
```

Production builds keep derived geometry disabled unless explicitly enabled:

```sh
VITE_ENABLE_DERIVED_GEOMETRY=true pnpm build
```

OCCT browser smoke/metrics:

```sh
pnpm smoke:occt-browser
```

The smoke writes JSONL telemetry to `.metrics/occt-browser.jsonl`. Timing
magnitude is tracked, not used as a pass/fail budget.

V7 release sample source/query smoke:

```sh
pnpm smoke:v7-release-samples
```

The smoke is deterministic, non-browser, and stdout-only by default. It builds
the G1 release fixtures through CADOps, round-trips current project JSON, and
verifies the V7 release-critical query surface. Use
`node scripts/smoke-v7-release-samples.mjs --json` only when structured stdout
is useful for CI or release tooling.

V10 release sample edit/rebuild smoke:

```sh
pnpm smoke:v10-release-samples
```

The smoke is deterministic, non-browser, and CADOps/cad-core-only. It builds
the V10 release fixtures, verifies long edit -> rebuild -> reference health ->
repair chains, checks JSON and `.wcad` round-trips, and rejects renderer, mesh,
OCCT, OPFS, file-handle, selection-buffer, GPU/pixel, viewport-state, or schema
V17 leaks from public sample/source outputs.

V11 release sample sketch solver smoke:

```sh
pnpm smoke:v11-release-samples
```

The smoke is deterministic, non-browser, and CADOps/cad-core-only. It runs a
long current-source sketch chain through create -> constrain/dimension -> solve
status -> feature -> dry-run non-mutation -> committed dimension edit -> rebuild
and reference queries -> JSON/`.wcad` round-trip. It also imports a V17
advanced-constraint source chain so tangent, concentric, equal length, equal
radius, angle, and symmetry numerical-support status is covered without adding
unsupported advanced constraint creation commands. Public smoke output rejects
renderer, mesh, OCCT, OPFS, file-handle, selection-buffer, GPU/pixel,
viewport-state, solver-matrix, and residual-cache identifiers.

Compatibility browser workflow smokes:

```sh
pnpm smoke:v7-browser-workflow
pnpm smoke:v7-browser-workflow:derived
pnpm smoke:v8-wcad-workflow
pnpm smoke:v9-viewport-workflow
pnpm smoke:v10-browser-workflow
pnpm smoke:v12-browser-workflow
```

The default smoke follows the existing built-app/static-server/CDP pattern. It
runs `pnpm build`, opens the built app in a Chromium-compatible browser, creates
deterministic sketch/rectangle/circle/new-body extrudes, checks model-tree body
selection, inspector/modeling `selection.referenceCandidates` status, viewport
reference selection, direct circle body/face/edge viewport routing,
session-only Escape clearing, unobstructed viewport state after navigation,
measurement, and project round-trip, desktop/narrow contextual readability,
narrow viewport visibility and scroll-trap checks,
named-reference routing, attached-sketch creation on a generated planar face,
consumed-body structured diagnostics, and Project/File JSON export/load/import
round-trip behavior, then reports required checks plus optional skipped GLB
download readiness. Default production builds keep derived geometry disabled,
so the GLB download check may be skipped with a structured reason. The smoke
also verifies the reduced Advanced tools surface no longer exposes Batch or Mesh
tabs and can scroll overflowing panel content. The derived smoke builds with
`VITE_ENABLE_DERIVED_GEOMETRY=true` and
requires `glb-download` to pass, proving transient
`partbench-visualization.glb` output from ready derived display meshes.
The V8-named `pnpm smoke:v8-wcad-workflow` script aliases the current browser
workflow smoke and verifies fallback Save As `.wcad`, upload-open of the saved
package, `.wcad` model round-trip, and viewport usability in addition to the
existing workflow checks. The V9-named `pnpm smoke:v9-viewport-workflow` script
is a release-clarity alias over the same compatibility runner, with derived
geometry enabled so the current V8 `.wcad`/STEP/GLB surfaces and V9 direct
viewport checks are represented together. The V12-named
`pnpm smoke:v12-browser-workflow` script builds with derived geometry enabled
and requires supported cut-result face/edge browser checks: command-ready
cut-wall face selection, compact sketch/name/measure/inspect actions, attached
sketch creation on the result face, command-ready cut-wall profile edge
selection, compact name/measure/inspect actions, and no deferred chamfer,
fillet, or Edge finish affordances for V12 edges. It also requires the first
add-result face/edge browser checks: deterministic add-result creation, added
cap and wall face command-ready status, compact sketch/name/measure/inspect
actions, attached sketch creation on the added cap, added-cap profile edge
command-ready status, compact name/measure/inspect actions, and no deferred
chamfer, fillet, or Edge finish affordances. It also requires a circle-tool add
browser path that creates a supported circle add result, verifies command-ready
added cap, cylindrical wall, and circular cap edge references, and proves the
cylindrical wall/circular edge expose only supported name/measure/inspect
actions rather than unsupported create-sketch or deferred edge-finish actions.
The same V12 browser smoke now requires a circle-tool cut path that verifies
command-ready cut-wall and start/terminal rim references while keeping
unsupported sketch and deferred edge-finish actions hidden on the cylindrical
and rim targets.
The underlying files remain
`scripts/smoke-v7-browser-workflow.mjs` and
`scripts/v7-browser-workflow.mjs` for backward compatibility.

## Current Capabilities

Current Partbench can:

- create and edit V1 primitive scene objects;
- create sketches on base planes or eligible generated planar faces;
- add/edit/delete point, line, rectangle, and circle sketch entities;
- create and edit source-of-truth document parameters through CADOps;
- create and edit driving sketch dimensions for rectangle width, rectangle
  height, circle radius, and line length through CADOps;
- create, rename, and delete source-of-truth horizontal/vertical line
  orientation constraints, fixed/coincident/midpoint point constraints, and
  parallel/perpendicular line constraints through CADOps;
- preserve V17 advanced sketch constraint source records for tangent,
  concentric, equal length, equal radius, angle, and symmetry constraints;
- query `sketch.solverStatus` through cad-core, agent, and MCP surfaces for
  source-backed sketch entities, constraints, dimensions, profile validity,
  numerical solver diagnostics, under-defined/fully-defined/over-defined/
  conflicting state, and V17 advanced constraint status;
- run the pure `packages/sketch-solver` numerical solver for the current V11
  supported constraint and dimension subset without mutating document source;
- use compact sketch solver/status UI, viewport sketch drag handles, and
  conservative constraint inference while keeping sketch edits command-backed;
- create rectangle/circle extrude features as new bodies;
- edit authored extrude depth and side;
- edit source rectangle/circle profile values through `sketch.updateEntity`;
- delete authored sketch-extrude features;
- create supported authored `feature.revolve`, `feature.hole`,
  `feature.chamfer`, and `feature.fillet` source records;
- name generated references and resolve names later;
- explicitly repair existing named generated references to new command-ready,
  kind-compatible generated targets through compact Selection/Inspector and
  Modeling affordances backed by CADOps dry-run/commit;
- inspect parts, sketches, features, bodies, named references, dependency
  health, history, measurements, extents, topology, exact-metadata health, and
  generated-reference measurements;
- query V7 selection/reference candidates through
  `selection.referenceCandidates` for semantic body, generated-reference, and
  named-reference selections, with structured missing, stale, unsupported,
  ambiguous, consumed, and non-commandable diagnostics;
- surface V7 selection/reference candidate state in the feature tree,
  inspector, and modeling workflow, including command-ready summaries,
  supported command operations, and structured diagnostics for blocked
  reference-consuming affordances;
- surface the same V7 selection/reference candidate state in the left
  `Selection` tab and inspector/modeling workflow for selected bodies,
  generated references, and named references after they resolve to generated
  references, while keeping viewport highlighting derived from source/query
  state;
- route current canvas body/object clicks through a typed viewport pick-intent
  helper so body-backed renderables consume `selection.referenceCandidates`
  status and diagnostics instead of treating renderer IDs as command authority;
- route supported current canvas generated edge clicks through private hit
  candidates and the same generated-reference `selection.referenceCandidates`
  path, preserving body-level visual selection while updating semantic
  generated-edge selection for inspector/modeling actions;
- keep generated-reference actions, operation labels, commandability, and
  structured diagnostics aligned across the compact viewport surface,
  Selection tab, Inspector, and Modeling surfaces;
- measure and inspect one selected semantic CAD target at a time from the
  compact viewport surface for supported bodies, generated planar faces,
  generated edges, and resolved named references, with explicit authority
  labels and structured unsupported/stale/consumed/ambiguous/missing
  diagnostics;
- run a narrow session-only two-target viewport measurement from compact
  Measure for supported semantic bodies, generated planar faces, generated
  linear/circular edges, and resolved named references, with source-backed
  center-distance and face-normal/linear-edge angle results where current query
  data proves the points/vectors;
- keep helper-level hover/measurement/interaction readiness tests available for
  future viewport work, but do not make them the visible product surface until
  a consolidated interaction model is explicitly designed;
- keep a lightweight deterministic V7 viewport baseline helper/check for a
  rectangle extrude body with generated references and derived geometry status,
  without exposing raw mesh, OCCT, cache, or selection-buffer identifiers;
- perform narrow rectangle-tool add/cut boolean workflows for supported target
  bodies;
- rebuild supported revolve, hole, and rectangle-edge chamfer/fillet result
  bodies through derived geometry meshes while keeping cad-core authoritative;
- query selected body topology status through `body.topology`;
- inspect semantic-source topology counts and source-analytic measurement
  confidence for rectangle/circle newBody extrudes;
- inspect structured ambiguous topology status for current boolean and V6 result
  bodies where stable generated topology cannot be proven yet;
- use matching ready derived exact metadata snapshots for body topology, project
  extents, and project health measurement confidence for supported V6 result
  bodies;
- use compact UI workflows and a first feature-tree/product workflow for
  supported Extrude, Revolve, Hole, Chamfer, and Fillet operations without
  offering known-unsupported targets as valid;
- save/load current `web-cad.project.v16` and `web-cad.project.v17` JSON with
  migrations from older accepted schemas, while the Project panel shows draft source, schema/
  migration status, structured validation issues, replacement/history impact,
  same-document-source detection before import, native `.wcad` project-file
  state, app-layer save/open capability status, and JSON debug/interchange
  fallback;
- expose current commands and queries through agent/MCP wrappers over CADOps.

## Current Limitations

The repo now includes the completed V10 editable feature history surface on top
of the local CAD, viewport-native interaction, and practical solid-modeling
baseline. It is not yet a full CAD system.

Current limitations:

- The V11 sketch solver is implemented for the planned supported constraint
  subset, but there is still no parameter expression language, imported curve
  constraints, ellipse/spline solving, or broad advanced-constraint creation UI.
- Sketch dimensions currently drive rectangle width/height, circle radius, line
  length, and supported solver-backed source edits. Broader dimension families
  remain deferred.
- There is no parameter expression language.
- There is no broad feature graph beyond current authored extrudes, scoped
  booleans, revolve, hole, and rectangle-edge chamfer/fillet workflows.
- Generated references and healthy semantic topology exist for simple authored
  rectangle/circle newBody extrude bodies and for the supported V12 cut/add
  boolean result face/edge subsets. Unsupported target-carried/split,
  intersection, seam, and broad result-body topology remains structured
  diagnostic output rather than command-ready identity. V6 revolve, hole,
  chamfer, and fillet result bodies still need a general stable topological
  naming/checkpoint system before their arbitrary generated faces/edges can be
  treated as robust command targets.
- V13 now scopes that general topology identity foundation: exact topology
  snapshots, B-rep checkpoints, stable topology anchors, matching confidence,
  explicit repair records, reference-health integration, and command
  eligibility without promoting raw OCCT or renderer topology IDs to public
  stable references.
- Feature tree, inspector, modeling workflow, agents, MCP, and the left
  `Selection` tab consume semantic selections that the UI already exposes. The
  current viewport supports body/object-granularity pick intent for current
  canvas renderables plus generated planar face and generated edge picking for
  the supported source-semantic subset. Compact viewport Measure/Inspect shows
  single-target values and authority labels, while deeper diagnostics still live
  in Selection/Inspector/Modeling. Exact face/edge/vertex highlighting,
  generated vertex picking, persisted measurement annotations, sketch
  measurement constraints, and selection-buffer mapping are not implemented yet.
- The C4 helper work still provides typed viewport interaction readiness for
  future selection-buffer work, but the visible C4 product correction keeps the
  viewport unobstructed and moves current-selection detail into the left
  `Selection` tab.
- There is not yet authoritative B-rep topology persisted in the document model.
  V13 is planned to decide and implement the first checkpoint/anchor source
  records and package payload rules where they are needed for real topology
  identity.
- `body.measurements` remains source-derived/source-analytic for simple
  supported shapes and references. V6 exact mass-property health is surfaced
  through derived exact metadata snapshots on `body.topology`, `project.extents`,
  and `project.health`, not through persisted source data.
- Circle target edge finishing, shell, sweep, loft, patterns, direct edits,
  general booleans, STEP import, production WebGPU, assemblies, hosted
  collaboration, production MCP auth, and natural-language command entry remain
  unimplemented unless scoped into a later release. Broad exact topology naming
  is now the planned V13 foundation rather than an unowned future item.
  V8 made `.wcad` the app-level project workflow: File System Access browsers
  can open/save/save-as through app-only handles, and other browsers use
  upload/download fallback. File handles are not written into cad-core, JSON,
  `.wcad`, agents, or MCP.
- OCCT currently uses the full OpenCascade.js WASM in the main path. Custom
  build findings are documented separately and should not block V7 modeling,
  topology, storage, or export planning.

## Completed Milestones

The older milestone logs are intentionally condensed here. Do not recreate long
phase logs in this implementation plan.

### Initial Foundation And V1

The initial foundation established the pnpm workspace, Vite app, Vitest/lint/
format checks, typed CADOps mutation protocol, in-memory document model,
transactions, semantic diffs, undo/redo, browser command worker, canvas
viewport, primitive scene objects, project JSON import/export, and agent/MCP
wrappers.

V1 completed the primitive-scene workflow: box, cylinder, sphere, cone, and
torus creation/editing; transform, dimension, rename, delete, units,
measurements, history, batch operations, project save/load, viewport
fit/reset/selection, OCCT-derived primitive meshes behind the worker path, and
production-facing UI polish.

### V2 Feature/Body Foundation

V2 moved Partbench from primitives toward authored feature/body CAD while keeping
V1 compatibility. It added source-of-truth sketches, rectangle/circle extrudes,
authored body records, feature delete/edit behavior, sketches attached to
generated planar faces, generated and named references, source-derived
measurements/extents, dependency health, and narrow rectangle-tool add/cut
boolean workflows. V2 also kept derived geometry behind the geometry-worker
boundary, added UI support for the new model concepts, exposed the behavior
through agent/MCP wrappers, and evolved project JSON through
`web-cad.project.v6`.

### V3 Parametric Sketch Foundation

V3 added source-of-truth document parameters, driving sketch dimensions,
horizontal/vertical line orientation constraints, the first direct
solver/evaluator structure, downstream rebuild propagation, dependency health,
UI support, and agent/MCP pass-through. It introduced `web-cad.project.v7` for
parameters and sketch dimensions and `web-cad.project.v8` for line orientation
constraint source data.

### V4 Constrained Sketch Solving

V4 completed the constrained sketch solving milestone by adding a clearer
solver/evaluator boundary, durable sketch point/entity targets,
fixed/coincident/midpoint point constraints, parallel and perpendicular line
constraints, solver-backed dimensions/orientation behavior,
regeneration/health hardening, UI support, and agent/MCP wrappers. V4 evolved
project JSON through `web-cad.project.v13`.

### V5 Exact Geometry And Topology Foundation

V5 completed the derived exact geometry/topology foundation for supported
authored bodies. It added the read-only `body.topology` query, structured
topology statuses, source identity and opaque-signature rules, exact/measurement
confidence semantics, source-analytic simple extrude topology, honest ambiguous
topology for current boolean results, project health/extents integration, UI
status display, and agent/MCP pass-through. V5 did not add new source data and
therefore did not introduce a new saved-project schema. The full milestone doc
has been removed; this summary plus `docs/native-format.md` preserve the
durable implementation decisions.

### V6 Practical Solid Modeling On Exact Geometry

V6 completed practical solid-modeling capability on exact geometry. It added
derived exact-kernel metadata, authored `feature.revolve`, circular
`feature.hole`, command-first `feature.chamfer` and `feature.fillet`,
target-consuming result-body behavior, derived mesh paths through OCCT for
supported V6 result bodies, project structure/health/topology/extents
integration, compact UI workflows, and agent/MCP pass-through. The full
milestone doc has been removed; this summary plus `docs/native-format.md`
preserve the durable implementation decisions.

Durable V6 decisions:

- new persisted feature records introduced explicit schemas:
  `web-cad.project.v14` for revolve, `web-cad.project.v15` for hole, and
  `web-cad.project.v16` for chamfer/fillet;
- exact-kernel metadata remains derived and should not be persisted as source;
- target-consuming features create result bodies rather than mutating body
  identity in place;
- generated references for V6 result bodies remain unsupported unless a future
  stable topological naming design is explicitly implemented.

## V7 Real CAD Alpha Completion Record

V7 is a major release umbrella, not a single implementation milestone. The
implemented A-G7 surface turns the V6 modeling baseline into an early usable
local CAD alpha while preserving the architecture in `docs/architecture.md`.

The V7 release-readiness record has been condensed into this implementation
plan. This section records the durable status and day-to-day sequencing rules
for any later V7 work.

### V7 Release Pillars

V7 is organized around these pillars:

- stable topology, references, and semantic selection;
- product-grade viewport interaction and visual state;
- local project JSON workflow and future native package decisions;
- interop, starting with export readiness/visualization before broad import;
- product UI hardening on top of the existing feature tree and improved modeling
  workflow;
- agent/MCP productization for larger, auditable workflows;
- release samples, smoke checks, docs, and browser verification.

### Implemented Tranche Sequence And Remaining Order

The implemented sequence through H1 is:

1. **Reference And Selection Contract** - implemented typed query/protocol
   support for
   semantic selection candidates, reference eligibility, stale/ambiguous
   diagnostics, and named-reference validation without requiring WebGPU, native
   storage, or STEP.
2. **Feature Tree And Inspector Integration** - implemented current feature
   tree, inspector, and modeling workflow integration with reference/health
   semantics, using CADOps-backed actions only.
3. **Viewport Selection And Visual State** - implemented current canvas
   semantic pick intent, selected highlighting, and unobstructed viewport
   layout, with current-selection details/actions/measurements in the left
   `Selection` tab instead of renderer-owned UI.
4. **Local Project Workflow** - implemented JSON open/save polish and app-layer
   storage capability status. File System Access picker operations, OPFS,
   thumbnails, and `.wcad` packages remain deferred.
5. **Export And Sharing** - implemented `project.exportReadiness` and optional
   app-derived Mesh/GLB visualization export from ready derived meshes. STEP
   import/export remains deferred until an exact exchange writer binding is
   scoped.
6. **Agent/MCP Release Surface** - implemented release-oriented
   `project.summary`, dry-run/commit review blocks, audit metadata, and thin
   MCP pass-through over the same CADOps/query paths.
7. **Release Samples And Smokes** - implemented source/query release samples,
   release-sample smoke, browser workflow smoke, checklist/docs, G4 extended
   acceptance samples, G6 browser checklist automation expansion, and G7
   derived-geometry GLB release smoke.
8. **Cleanup H1** - removed the visible Advanced tools Batch and Mesh debug tabs
   and the stale feature-delete browser smoke, while preserving CADOps batch
   behavior, agent/MCP pass-through, derived geometry, and Project/File
   visualization export readiness.

Numbering note: there is intentionally no separate implemented G5 tranche in the
release-hardening record. The remaining checklist-automation work that could
have been split out as G5 was recorded as the G6 browser checklist automation
expansion, and the derived-geometry GLB release smoke was then recorded as G7.
The absent G5 label is a documentation/history numbering gap only; it does not
represent hidden in-scope V7 implementation work.

### Implemented Tranche A: Reference And Selection Contract

The first V7 tranche added a query-only semantic resolver:

- `selection.referenceCandidates` accepts semantic selections only:
  `{ type: "body", bodyId }`,
  `{ type: "generatedReference", bodyId, stableId, expectedKind? }`, or
  `{ type: "namedReference", name }`;
- supported authored rectangle/circle `newBody` extrude selections return
  command-ready generated-reference targets, command operation eligibility, and
  labels/descriptions derived from source document state;
- stale, ambiguous, missing, unsupported, consumed, kind-mismatched, and
  non-commandable cases return structured diagnostics rather than vague strings
  or renderer-derived IDs;
- agent and MCP wrappers pass the same query result through CADOps/query paths;
- UI helpers consume the query response for current feature-tree/modeling
  workflow integration without owning model authority;
- the query is derived and does not introduce `web-cad.project.v17`.

### Implemented Tranche B: Feature Tree And Inspector Integration

The second V7 tranche connects the upgraded feature tree, inspector, and
modeling workflow to the selection/reference contract:

- the app queries `selection.referenceCandidates` for selected semantic body
  rows, generated-reference rows, selected generated references, and named
  references already exposed by the UI;
- the feature tree and named-reference list display command-ready or diagnostic
  candidate state without exposing renderer, mesh, OCCT, or selection-buffer
  IDs as stable public IDs;
- the inspector displays a reference-contract summary and structured
  diagnostics for selected bodies/generated references and named references;
- modeling actions combine existing command-builder validation with
  query-derived commandability for sketch-on-face, generated-reference naming,
  chamfer, and fillet affordances;
- all authority remains in `cad-core`/CADOps. React formats and routes query
  results only;
- the integration is derived/query-only and does not introduce
  `web-cad.project.v17`, persisted selection state, viewport picking, WebGPU,
  STEP, OPFS, `.wcad`, assemblies, or new modeling commands.

### Implemented Tranche C1: Viewport Semantic Selection Readiness

The first viewport-readiness slice connects viewport selection readiness to the
same semantic contract without adding exact face/edge/vertex picking:

- the app derives typed semantic display state from selected body and
  generated-reference state plus the current `selection.referenceCandidates`
  response;
- named references participate after the existing UI resolves them to generated
  references;
- command-ready summaries, supported operations, structured diagnostics,
  consumed-body state, measurements, and generated-reference actions are visible
  in the left `Selection` tab/inspector/modeling workflow, not as a viewport
  overlay;
- current viewport highlighting remains source body/object ID based. Renderer,
  mesh, OCCT, and future selection-buffer identifiers are not promoted to public
  stable IDs;
- this slice does not add viewport picking, persistent selection state, new
  modeling commands, storage migration, WebGPU, or `web-cad.project.v17`.

### Implemented Tranche C2: Viewport Pick Intent And Reference Selection

The second viewport slice adds narrow current-canvas pick intent while keeping
the renderer derived:

- `apps/web` resolves `pickRenderScene` body/object IDs through a typed helper
  against current project structure and scene objects. Authored body renderables
  select the same semantic body IDs used by the feature tree and inspector.
- primitive object clicks keep the existing object-editing selection while
  object-backed primitive body candidate diagnostics remain available through
  the selection/inspector surfaces;
- unsupported sketch-display and stale/unknown render targets become structured
  viewport pick diagnostics. They are not promoted to generated-reference
  selections;
- the viewport body-click path updates the same semantic app selection used by
  the feature tree and inspector. `selection.referenceCandidates` responses
  provide resolved, missing, stale, unsupported, ambiguous, consumed, and
  non-commandable status where CADOps can prove it;
- generated-reference action lists stay in the Selection/inspector surface.
  They are built from `selection.referenceCandidates` candidate references and
  operation labels, can explicitly select a generated reference into the
  existing UI selection state, and show commandability plus structured
  diagnostics for blocked candidates;
- renderer, mesh, OCCT, and future selection-buffer IDs remain derived internal
  details. The new helpers do not expose raw renderer/mesh/OCCT/selection-buffer
  IDs as visible UI or stable public IDs;
- this slice remains query-only/derived and does not add exact face/edge/vertex
  picking, persistent selection state, new modeling commands, storage
  migration, WebGPU, or `web-cad.project.v17`.

### Implemented Tranche C3: Viewport Hover And Measurement Overlay

The third viewport slice added helper-level readiness for inspectable current
canvas interaction without broadening renderer authority:

- `apps/web` resolves transient hover render IDs through a typed app-layer
  hover helper that mirrors viewport pick semantics for body/object targets and
  emits structured unsupported or missing diagnostics for sketch/unknown targets;
- helper-level hover display can derive body/object titles, commandability
  summaries, supported operation labels, and first structured diagnostics from
  `selection.referenceCandidates`, but visible current-selection detail remains
  in the Selection/inspector/modeling surfaces;
- selected-target measurements remain sourced from existing `body.measurements`
  and `body.generatedReferenceMeasurements` query results and are surfaced by
  the inspector rather than a viewport overlay;
- a small deterministic viewport baseline helper/check covers a rectangle
  extrude body with generated references and ready derived geometry status while
  excluding raw mesh, OCCT, cache, and selection-buffer IDs from visible helper
  output;
- this slice remains query-only/derived. It does not add exact face/edge/vertex
  picking, persistent hover/selection state, new modeling commands, storage
  migration, WebGPU, or `web-cad.project.v17`.

### Implemented Tranche C4: Viewport Interaction Cohesion

The fourth viewport slice consolidated the C1-C3 helper surfaces, then the
visible product surface was corrected to keep the viewport unobstructed without
changing modeling, renderer, storage, or topology authority:

- `apps/web` retains typed app-layer helpers for selected status, grouped
  reference actions, attached measurements, subordinate hover, and structured
  diagnostics as future viewport-readiness infrastructure;
- the visible app layout now gives the left rail two model-browser tabs:
  `Tree` for structure navigation and `Selection` for the current semantic
  selection/inspector surface;
- selected body/generated-reference status, generated-reference actions,
  body/reference measurements, and unsupported, missing, stale, consumed, and
  non-commandable diagnostics are shown in the Selection/inspector/modeling
  surfaces, not over the canvas;
- the viewport remains a derived visual/picking surface with camera controls and
  selected body/object highlighting. Raw mesh, OCCT, cache, and future
  selection-buffer identifiers stay out of visible text and stable public IDs;
- this slice remains query-only/derived. It does not add exact face/edge/vertex
  picking, persistent hover/selection state, new modeling commands, storage
  migration, WebGPU, or `web-cad.project.v17`.

### Implemented Tranche D1: Project JSON Workflow Polish

The first local-project slice makes the existing JSON save/open workflow more
credible without introducing a native package or new schema:

- the Project panel summarizes the authoritative current export, draft source
  state, schema/migration status, structured validation issues,
  replacement/history impact, and same-document-source detection before import;
- import/export remains ordinary `web-cad.project.v16` JSON through cad-core.
  The app does not make draft JSON, thumbnails, caches, browser file handles, or
  derived geometry part of the source-of-truth document;
- invalid, stale, unsupported, and replacement-risk states are surfaced as
  structured project diagnostics rather than vague import/export text;
- this slice does not add File System Access open/save handles, OPFS, `.wcad`
  packages, thumbnails, cache storage, STEP/IGES import/export, or
  `web-cad.project.v17`.

### Implemented Tranche D2: Local Storage Capability Status

The second local-project slice makes the Project panel explicit about what the
current browser/app can and cannot do:

- ordinary JSON download/upload remains the active local project path;
- the app reports detected availability for the existing download/upload
  primitives and File System Access picker functions, while OPFS, thumbnails,
  cache storage, and native `.wcad` packages remain deferred capabilities;
- capability reporting is status-only. It does not call File System Access
  picker APIs, request file permissions, write OPFS data, create thumbnails or
  cache files, or change saved project format;
- no new source data is introduced, so no `web-cad.project.v17` migration is
  added.

### Implemented Tranche E1: Export Readiness Contract

The first export slice adds an honest readiness/status contract before any file
writer implementation:

- `project.exportReadiness` reports STEP and Mesh/GLB visualization formats,
  current file-export availability, units, source/derived boundary notes,
  source-supported body counts, deferred/unavailable body counts, and structured
  diagnostics;
- the core query is derived from authoritative document/project structure only.
  It does not call geometry workers, renderer paths, display caches, browser
  APIs, or file/export writers;
- active rectangle/circle `newBody` extrudes are marked source-supported but
  file-export deferred because no writer exists yet. Consumed bodies,
  primitive compatibility bodies, and V6 result bodies are distinguished with
  structured diagnostics;
- agent-adapter and MCP expose thin pass-throughs over the same CADOps query;
- the Project panel displays compact export readiness for users without making
  display output or temporary derived state authoritative;
- this slice does not implement STEP/GLB generation, import paths, export jobs,
  OPFS/File System Access flows, native package storage, new modeling commands,
  or `web-cad.project.v17`.

### Implemented Tranche E2: Visualization Mesh/GLB Export Path

The second export slice adds the smallest real product-facing artifact the
current architecture can support:

- `apps/web` can generate and download `partbench-visualization.glb` from
  existing ready derived visualization meshes for active authored rectangle and
  circle `newBody` extrude bodies;
- the GLB writer is a small dependency-free browser/app helper over existing
  app-level mesh DTOs. It writes glTF 2.0 binary output with deterministic
  metadata for format, units, body count, vertex count, triangle count, JSON
  chunk length, binary chunk length, and total byte length;
- the Project panel keeps ordinary source JSON import/export controls separate
  from visualization export. It shows Mesh/GLB visualization as available only
  after the helper sees at least one current ready exportable mesh, then enables
  a dedicated GLB download action and reports success/failure through structured
  diagnostics;
- unsupported states remain explicit: empty projects, consumed bodies,
  primitive compatibility bodies, unsupported/deferred V6 result bodies,
  missing/pending/stale/failed derived meshes, and invalid mesh buffers are
  diagnosed without exposing renderer, OCCT, cache, selection-buffer, or
  internal mesh IDs in public summaries;
- `project.exportReadiness` remains the shared CADOps source-readiness status
  contract for UI, agent, and MCP. The browser/app overlay combines it with
  transient derived mesh availability before producing GLB artifacts, so derived
  display output does not become source authority;
- STEP export is still unavailable/deferred because no safe exact exchange
  writer binding exists in the current OCCT/WASM boundary. This slice does not
  add import paths, OPFS/File System Access handles, native package storage,
  persisted export jobs, new modeling commands, or `web-cad.project.v17`.

### Implemented Tranche F1: Agent/MCP Release Project Summary

The first agent/MCP release-surface slice enriches the existing summary query
without adding source data:

- `project.summary` keeps the legacy `units`, `objectCount`, and `objects`
  fields, then adds compact blocks for structure counts, project health,
  semantic reference capabilities, export readiness, and workflow hints;
- all new fields are derived from authoritative cad-core document state plus
  existing structure, health, generated-reference, selection, and export
  readiness helpers;
- `cad.project_summary` remains a thin MCP wrapper over the agent-adapter/CADOps
  query path and returns the same deterministic summary shape;
- reference information is aggregate-only. The summary does not expose raw
  generated-reference stable IDs, renderer IDs, OCCT/cache IDs, mesh IDs, or
  selection-buffer IDs;
- browser/app-derived GLB artifact availability stays out of cad-core. The
  summary reports only the shared source export-readiness contract, including
  deferred STEP and Mesh/GLB writer status;
- no saved project schema change is introduced. Summary results, workflow hints,
  export readiness, and reference capability counts are query-derived and not
  persisted.

### Implemented Tranche F2: Agent Workflow Preview And Audit Surface

The second agent/MCP release-surface slice makes multi-step `cad.batch` calls
reviewable before commit without adding MCP-only semantics:

- every agent-adapter batch response now includes a compact `review` block with
  requested mode, effective intent, operation count, entity-change counts,
  operation review labels, audit summary, commit-gate summary, hints, and
  blockers;
- dry-runs remain non-mutating and return no transaction id. Commits still
  require `permissions.allowCommit === true`, and refused commits return a
  `COMMIT_NOT_ALLOWED` review blocker without executing CADOps;
- validation errors, empty batches, destructive delete operations, and CADOps
  warnings are surfaced as structured review blockers or hints;
- successful commit transactions preserve the normalized audit metadata in
  transaction history;
- `cad.batch` and the stdio MCP transport remain thin pass-throughs over the
  agent adapter/CADOps path. The review surface summarizes request/result data
  and does not promote renderer, mesh, OCCT, cache, or selection-buffer
  identifiers to public stable IDs;
- no saved project schema change is introduced. Preview/review data is
  response-derived and not persisted, except for existing commit audit metadata
  stored with committed transactions.

### Implemented Tranche G1: Release Samples And Acceptance Fixtures

The first release-hardening slice adds deterministic source fixtures without
adding browser automation or a new saved-project schema:

- `packages/cad-core/src/releaseSamples.ts` exposes
  `V7_RELEASE_SAMPLE_FIXTURES`, `listV7ReleaseSampleFixtures()`, and
  `createV7ReleaseSampleBatch(id)`;
- fixtures are built from CADOps batches and are intended to be committed into a
  fresh `CadEngine`, exported with current project JSON, imported again, and
  queried through existing CADOps/query paths;
- the initial fixture catalog covers a rectangle `newBody` extrude with
  generated face/edge references and named references, a circle `newBody`
  extrude with generated references and export/reference readiness coverage,
  and a consumed-body diagnostics sample that keeps consumed source references
  non-commandable and current cut-result topology ambiguous;
- fixture metadata records id, title, description, units, workflow tags,
  expected source counts, expected structured health status/issue count,
  expected generated and named reference targets, expected
  `selection.referenceCandidates` outcomes, expected `project.summary`
  reference/export counts, expected `project.exportReadiness` status, and known
  limitations;
- tests verify import/export through `web-cad.project.v16`, no
  `web-cad.project.v17`, project health, semantic reference resolution,
  structured selection diagnostics, source STEP/Mesh-GLB readiness,
  `project.summary` counts, and separation from renderer, mesh, OCCT, cache,
  and selection-buffer identifiers.

G1 remains source-only. It does not persist derived meshes, exact metadata,
topology caches, app-derived GLB artifacts, browser storage capability state, or
selection state. Browser smoke scripts, manual checklist automation, and wider
sample coverage remain later Tranche G work.

### Implemented Tranche G2: Release Sample Smoke Runner And Checklist Baseline

The second release-hardening slice turns the G1 fixtures into a repeatable
non-browser release smoke:

- `scripts/v7-release-samples.mjs` exposes a pure
  `runV7ReleaseSampleSmoke()` helper plus deterministic human-summary
  formatting;
- `scripts/smoke-v7-release-samples.mjs` is the CLI entry point, with optional
  `--json` stdout for CI/release tooling and no tracked metrics output;
- `pnpm smoke:v7-release-samples` runs the CLI from root package scripts;
- the smoke commits every fixture through `createV7ReleaseSampleBatch(id)`,
  exports/imports current project JSON, and verifies current schema only,
  project health, `selection.referenceCandidates`, `project.exportReadiness`,
  `project.summary`, and public source/derived separation;
- tests cover the success summary and a synthetic fixture-expectation failure
  path;
- this section records the release QA boundary and explicitly separates
  automated source/query smoke from browser verification.

G2 does not add browser E2E automation, persistent metrics, static sample JSON,
derived meshes, topology caches, app-derived GLB artifacts, OPFS/File System
Access, `.wcad` storage, STEP/IGES, WebGPU, assemblies, new modeling commands,
or `web-cad.project.v17`.

### Implemented Tranche G3: Browser Release Workflow Smoke

The third release-hardening slice automates the core browser workflow from the
G2 checklist without adding broad E2E infrastructure:

- `scripts/smoke-v7-browser-workflow.mjs` reuses the existing
  `scripts/occt-smoke/browser.mjs` Chromium/CDP helpers and static-server
  pattern;
- `pnpm smoke:v7-browser-workflow` builds the app, serves `apps/web/dist`, and
  runs the browser workflow smoke;
- the smoke creates deterministic source IDs for a sketch, rectangle profile,
  extrude feature, result body, and named face reference;
- required checks verify app load, authored `newBody` modeling, model-tree/body
  selection, inspector/modeling `selection.referenceCandidates` status,
  generated-reference selection from the viewport reference surface,
  named-reference routing, Project/File `.wcad` workflow, Project/File JSON
  workflow, storage capability status, STEP deferred status, and Mesh/GLB
  status;
- GLB download is reported as a pass when the built app exposes a ready derived
  visualization mesh and an enabled download button. Otherwise the default
  smoke records it as an explicit skipped check with the observed readiness
  text;
- `scripts/v7-browser-workflow.mjs` exposes deterministic summary/result
  helpers covered by focused script tests.

G3 does not replace the G2 source/query smoke, does not persist screenshots,
downloads, metrics, project JSON, meshes, topology caches, or selection state,
and does not introduce browser picking, new CAD commands, native storage, STEP,
WebGPU, assemblies, or `web-cad.project.v17`.

### Implemented Tranche G4: Extended Release Acceptance Samples

The fourth release-hardening slice broadens source/query acceptance coverage for
existing V6 feature breadth without changing modeling behavior or project
schema:

- `V7_RELEASE_SAMPLE_FIXTURES` now includes deterministic source-only samples
  for authored rectangle `newBody` revolve, authored hole result source
  semantics, and edge-finished chamfer/fillet result diagnostics, in addition
  to the original extrude/reference/export fixtures;
- the new samples use existing CADOps feature operations and are automatically
  exercised by `pnpm smoke:v7-release-samples`;
- each added fixture records source counts, health expectations,
  generated/named reference expectations where defensible, structured
  `selection.referenceCandidates` outcomes, `project.summary` reference/export
  counts, `project.exportReadiness`, and known limitations;
- revolve, chamfer, and fillet result bodies intentionally remain
  ambiguous/unsupported or repair-needed for generated semantic references;
  E1 adds a narrow supported authored hole result-reference subset. Consumed
  source bodies and target edges can still resolve semantically for diagnostics,
  but they are non-commandable after consumption;
- tests and smoke coverage continue to verify current
  `web-cad.project.v16` import/export behavior, absence of
  `web-cad.project.v17`, source/query-derived fixture data, and separation from
  renderer, mesh, OCCT, cache, and selection-buffer IDs.

G4 is acceptance/sample coverage only. It does not add browser automation,
new modeling commands, exact stable topology, persisted derived data,
screenshots, export artifacts, storage work, STEP/IGES, WebGPU, assemblies, or
schema migration.

### Tranche G5 Numbering Note

No separate G5 tranche is implemented or required for the current V7 release
scope. The release-hardening work moved from G4 extended acceptance samples to
G6 browser checklist automation, then to G7 derived-geometry GLB smoke. Keeping
the G6/G7 labels avoids rewriting existing tranche history, and the missing G5
number is not a deferred feature, storage milestone, renderer milestone, or
release blocker.

### Implemented Tranche G6: Browser Release Checklist Automation Expansion

The sixth release-hardening slice expands the existing focused browser workflow
smoke to automate practical checklist coverage that had remained manual:

- `scripts/smoke-v7-browser-workflow.mjs` still uses the production build,
  static app server, and Chromium/CDP runner rather than a broad E2E framework;
- the browser path now creates and selects a deterministic circle `newBody`
  extrude in addition to the original rectangle workflow, verifying
  inspector/modeling command-ready reference state from
  `selection.referenceCandidates`;
- the smoke creates a sketch on a supported generated planar face through the
  existing generated-reference/inspector route and verifies model-structure and
  active-sketch state without making UI state authoritative;
- the smoke creates a deterministic attached rectangle cut so the original body
  becomes consumed, then verifies structured consumed-reference diagnostics in
  the viewport, inspector, and modeling context;
- the Project/File workflow now generates current JSON, loads the exported JSON
  into import preview through the existing file-input path, imports it, and
  verifies the feature tree, named reference, attached sketch, and
  selection/reference diagnostics after the round-trip;
- `scripts/v7-browser-workflow.mjs` records the required browser checklist
  check IDs and marks the smoke failed if a required workflow silently
  disappears from the browser result.

G6 does not add new CAD commands, schemas, storage features, screenshots,
downloads, metrics, persistent artifacts, GLB requirements, native storage,
STEP/IGES, WebGPU, assemblies, exact face/edge viewport picking, or
`web-cad.project.v17`. Optional GLB download behavior remains skipped with an
explicit reason when derived visualization geometry is unavailable.

### Implemented Tranche G7: Derived Geometry GLB Release Smoke

The seventh release-hardening slice turns the manual derived-geometry GLB caveat
into an explicit opt-in release smoke while preserving the normal production
smoke behavior:

- `pnpm smoke:v7-browser-workflow` still runs a normal production build and may
  report `glb-download` as skipped with the observed readiness reason when
  derived visualization meshes are unavailable. It also verifies the reduced
  Advanced tools surface no longer exposes Batch or Mesh tabs and can scroll
  overflowing panel content;
- `pnpm smoke:v7-browser-workflow:derived` builds with
  `VITE_ENABLE_DERIVED_GEOMETRY=true` and runs the same CDP/static-server
  browser workflow with `glb-download` added to the required check list;
- the smoke runner also accepts `--require-glb-download` or
  `PARTBENCH_V7_BROWSER_WORKFLOW_REQUIRE_GLB=true` for direct runner use after
  a derived build;
- the required-GLB mode fails clearly if the GLB check is missing or skipped,
  and passes only when the Project/File panel reports the transient
  `partbench-visualization.glb` download result;
- focused script tests cover default optional GLB behavior, required skipped
  GLB failure, and required GLB success.

G7 does not persist screenshots, downloads, metrics, project JSON, derived
meshes, topology caches, selection state, GLB artifacts, or cache artifacts. The
GLB remains app-derived display output from ready mesh DTOs and does not become
source-of-truth data in `cad-core`, storage, CADOps schemas, or
`web-cad.project.v17`.

### Implemented Tranche H1: Advanced Tools Batch/Mesh Cleanup

The first V7 cleanup slice removes product UI that was not part of the
architecture-backed workflow:

- the bottom-right Advanced tools drawer no longer exposes the manual Batch tab
  or the Mesh derived-geometry debug tab;
- app-local batch form/queue UI state and UI-only command form conversion were
  removed. `cad.batch`, `buildBatch`, command transactions, semantic diffs, and
  agent/MCP batch review remain intact;
- derived geometry, render-scene mesh use, Project/File export readiness, and
  optional transient Mesh/GLB visualization export remain intact, but mesh debug
  refresh/status is no longer a primary product panel;
- the stale `smoke:feature-delete-ui` script was removed because current V7
  browser coverage lives in the release workflow smoke and no longer preserves
  obsolete viewport-status UI.

H1 does not remove Sketch, File/Project JSON import/export, transaction history,
derived geometry services, GLB visualization export, CADOps batch support,
agent/MCP adapters, storage schemas, WebGPU deferrals, STEP deferrals, or
`web-cad.project.v17` constraints.

### V7 Release Completion Gate Semantics

For implementation accounting, V7 is complete through the implemented A-H1
tranche scope described above. The 2026-06-11 release-candidate pass completed
the required automated gates recorded in this condensed release history,
including the default browser workflow smoke and the opt-in derived GLB smoke.
Manual browser checks were performed as release QA for visual breadth, varied
data, and workflow coherence beyond deterministic smokes. They are not hidden
implementation tranches and do not imply that deferred items such as STEP,
WebGPU, native storage, assemblies, broad topology naming, or broad sketch
solving are implemented.

## V8 Local CAD Foundation And Exact Interop Record

V8 is complete through the release-candidate scope condensed in this plan.

V8 was intentionally broad, but it had one center: make Partbench a credible
local CAD application by implementing native `.wcad` project storage, local
open/save/save-as, rebuildable OPFS cache behavior, and exact STEP export for
supported bodies.

V8 did not try to finish WebGPU, broad topology naming, broad sketch solving,
assemblies, hosted collaboration, production MCP auth, and natural-language
command parsing at the same time. Those are separate architecture-risk clusters.

### V8 Release Pillars

V8 is organized around these pillars:

- native `.wcad` package format v1;
- File System Access local project workflow with upload/download fallback;
- OPFS content-addressed derived cache;
- exact STEP export contract/readiness for supported active bodies, followed by
  real STEP bytes only when the geometry writer tranche lands;
- product UI that makes native project workflow primary and keeps JSON as
  debug/interchange;
- agent/MCP package and export summaries over the same CADOps/query/export
  paths;
- release samples, smokes, and docs for package/export confidence.

### V8 Answered Decisions

Use these decisions when maintaining V8 behavior:

- the user-visible native extension is `.wcad`;
- the first package version is `partbench.wcad.v1`;
- package version is separate from project schema version;
- current document source remains `web-cad.project.v16` for ordinary projects
  and `web-cad.project.v17` when V11 advanced sketch constraint source records
  are present;
- if new source data is added after V17, the next project schema is
  `web-cad.project.v18` with explicit migrations;
- a V8 `.wcad` package is ZIP-compatible and directory-compatible;
- required package source entries are `manifest.json`, `document.cbor`, and
  `commands.cbor`;
- CBOR is the native package encoding for document and command/history data;
- JSON remains supported for explicit debug/interchange export/import;
- File System Access handles are browser permissions and never source data;
- OPFS stores rebuildable cache data only;
- cache files, thumbnails, derived meshes, exact metadata snapshots, and export
  intermediates must be load-optional and source-identity validated;
- V8 does not persist B-rep checkpoints as source truth for the existing
  authored feature subset unless a tranche explicitly adds source B-rep
  checkpoint semantics;
- V8 targets STEP export before STEP import;
- the default exact export target is STEP AP242, with AP203/AP214 reported as
  fallbacks only if the available OCCT writer binding requires them;
- STEP export must use exact geometry through the geometry-kernel/worker
  boundary and must not fake exact CAD interchange from visualization meshes;
- STEP import is deferred because it requires imported-body source records,
  healing, metadata, possible B-rep source/checkpoint decisions, and broader
  topology/reference work;
- agent/MCP wrappers remain thin over shared package/readiness/export contracts;
- V8 UI must not reintroduce the removed Advanced tools Batch/Mesh bloat or
  block the viewport with storage/export detail.

### V8 Proposed Tranche Sequence

1. **Storage Protocol And Package Contract** - completed as a narrow typed
   contract slice: manifest/package types, validation issue shapes, source
   identity helpers, `project.packageReadiness`, thin agent/MCP pass-through,
   and tests proving package version/project schema separation.
2. **`.wcad` Package Read/Write** - completed in `cad-core`: minimal
   ZIP-compatible package writer/reader for `manifest.json`, `document.cbor`,
   and `commands.cbor`, with deterministic current-project round-trip and
   corruption diagnostics.
3. **File System Access Project Workflow** - completed in the web app: Open,
   Save, and Save As use `.wcad` through File System Access where available,
   with upload/download fallback and permission diagnostics.
4. **OPFS Cache Contract, Status, And Clear** - completed as D1: app-layer OPFS
   availability detection, `partbench.opfs-cache.v1` index helpers, structured
   diagnostics, Project/File status/refresh/clear UI, and tests proving cache
   state stays rebuildable and non-source.
5. **OPFS Derived Artifact Population** - completed as D2:
   source-identity-keyed OPFS read/write for `partbench-derived-mesh.v1`
   visualization mesh artifacts for current supported derived geometry, with
   fail-open generation fallback, status refresh, and source/cache separation
   tests.
6. **STEP Export Contract And Exact Export Readiness** - completed as E1:
   protocol/core `project.exportExact` for STEP, exact-vs-visualization
   readiness, geometry-boundary writer capability probes, Project/File status,
   and thin agent/MCP pass-through with structured unsupported diagnostics.
7. **STEP Writer For Supported Exact Bodies** - completed as E2: OCCT/WASM
   writer capability is proven through the isolated geometry boundary,
   geometry-kernel/worker can produce AP242 STEP bytes for supported active
   rectangle/circle `newBody` extrude source bodies, Project/File exposes
   `Download STEP`, and browser smoke verifies a non-empty STEP artifact.
8. **Agent/MCP Package And Export Surface** - completed as F: compact
   `inspectV8ProjectSurface` and `cad.v8_project_surface` wrappers expose
   `.wcad`, OPFS cache, exact STEP readiness/export availability, unsupported
   body diagnostics, and file-writing boundaries without returning artifact
   bytes or browser/cache/renderer internals.
9. **Release Samples, Smokes, And Migration Hardening** - completed as G:
   `pnpm smoke:v8-release-samples` owns V8 package/export acceptance coverage
   over the historical release fixture catalog, including `.wcad` round-trip,
   JSON-to-WCAD compatibility, corruption diagnostics, STEP supported and
   unsupported paths, and source/derived/file-handle separation checks.
10. **Product Cleanup** - completed as H: Project/File is promoted out of the
   workspace/debug tools drawer, new projects show `Untitled project` / `Not
   saved` until a real `.wcad` open/save occurs, JSON is labeled as
   debug/interchange, and storage/cache/export details are collapsed into
   inspectable disclosures while keeping primary `.wcad`, cache, STEP, GLB, and
   JSON actions available.

Release-candidate hardening incorporated before declaring V8 release-ready:

- public body topology source identity now exposes an opaque `signature` rather
  than parseable cache-key terminology, so agent/MCP callers cannot treat
  topology internals as stable CAD references;
- `project.exportExact` validates caller-provided source identity against the
  current project source and reports matched or mismatched state structurally;
- automated writer-unavailable exact STEP seams remain covered even while the
  current OCCT/WASM writer is available;
- `.wcad` and OPFS writable streams are aborted after write failures, and OPFS
  cache source identities require canonical SHA-256 hashes;
- Project/File wording and layout have been tightened so native `.wcad`, STEP,
  cache, GLB, and JSON debug/interchange controls remain inspectable without
  crowding the viewport.

### V8 Scope Guardrails Preserved For Maintenance

Do not combine these in a single V8 tranche unless explicitly approved:

- package read/write, File System Access, OPFS cache, and STEP export all at
  once;
- WebGPU renderer replacement and storage/package work;
- broad topology/reference model changes and STEP import;
- broad sketch solver expansion and native package migration;
- assemblies/LOD architecture and local project format migration;
- natural-language command parsing and production MCP auth.

Do not introduce another saved project format unless source-of-truth document
data requires it. Query results, topology summaries, derived exact metadata,
selection state, storage capability/status state, file handles, thumbnails, mesh
caches, export artifacts, OPFS paths, and renderer display state should stay
rebuildable by default.

## V9 Viewport-Native CAD Interaction Release Record

V9 is complete through the release-candidate H3 audit/docs scope. Its durable
release history is condensed in this plan.

V9 is intentionally a large UI/interaction release, but it has one center: make
the viewport the primary CAD interaction surface without coupling the product to
today's canvas renderer. The core architecture move is renderer-agnostic
interaction contracts:

```text
screen input -> renderer hit candidates -> semantic selection resolver ->
selection.referenceCandidates -> command-ready actions and measurements
```

This lets the current canvas renderer, a future WebGPU renderer, and future
assembly rendering all implement the same picking/display contract. The
renderer can identify private hit candidates and render highlight layers, but
`cad-core` remains the authority for commandability, diagnostics, and stable
semantic references.

### V9 Release Pillars

V9 is organized around these pillars:

- renderer-agnostic viewport interaction protocol shapes;
- body, generated face, generated edge, and named-reference picking for the
  current defensible V7/V8 semantic reference subset;
- hover, preselection, selected, command-target, warning, pending, and failed
  viewport visual states;
- compact contextual actions derived from cad-core query/command readiness;
- viewport-native inspect and measure tools that declare exact/semantic/display
  authority;
- camera, navigation, fit-to-selection, and active-tool ergonomics;
- browser smokes and visual QA for direct viewport workflows.

### V9 Answered Decisions

Use these decisions when maintaining V9 behavior:

- V9 does not replace the renderer with WebGPU, but it must define contracts a
  future WebGPU renderer can implement without product rewrite;
- renderer hit candidates are private and non-authoritative;
- public command-ready references still come from cad-core query behavior,
  especially `selection.referenceCandidates`;
- React may hold transient hover, selection, active tool, and gesture state, but
  that state is not source-of-truth data;
- V9 should not introduce `web-cad.project.v17` unless a tranche explicitly
  adds new saved document source data;
- no mesh triangle ID, OCCT topology index, GPU buffer offset, selection-buffer
  color, renderer object ID, or pixel ID may become a public stable CAD ID;
- current supported picks are active authored rectangle/circle `newBody`
  extrude bodies, already-defensible generated faces/edges, and named
  references resolving to those generated references;
- boolean, revolve, hole, chamfer, and fillet result bodies remain diagnostic or
  unsupported unless existing source semantics prove stable references safely;
- measurements must report whether they are semantic document values,
  source-analytic exact values, OCCT exact metadata, display approximations, or
  unsupported;
- contextual viewport commands must be derived from command-ready query results,
  not hardcoded UI guesses;
- selection details and diagnostics belong in compact selection/inspector
  surfaces, not large viewport overlays;
- future assemblies are reserved through optional instance-path context, but V9
  does not implement assembly document source.

### V9 Implemented Tranche Sequence

1. **Viewport Interaction Contract** - implemented as a typed protocol and
   pure-helper slice for hit-candidate, pointer-intent, hover, selection,
   command-target, and measurement-target shapes plus helpers proving
   renderer/source/session separation. Full body/face/edge picking remains in
   later tranches.
2. **Body Picking And Selection Routing** - implemented. Supported visible
   bodies can be selected directly in the viewport, routed through private V9
   hit candidates and `selection.referenceCandidates`, and reflected in the
   same semantic Selection tab, inspector, modeling, and query paths as tree
   selection without forcing the left panel to switch tabs.
3. **Generated Face/Edge Picking** - C1 implemented generated planar face
   picking/reference routing for selected supported rectangle/circle `newBody`
   extrudes. C2 implemented generated edge picking/reference routing for the
   current defensible rectangle and circle edge subset. Exact face/edge visual
   distinction, generated vertex picking, arbitrary result-body topology, and
   broader generated-reference diagnostics remain deferred.
4. **Viewport Visual State System** - D1 implemented the first semantic
   renderer display-input model for hover/preselection, selected,
   command-target, warning/blocked, pending, and failed states. Generated
   face/edge selections currently map to owning-body highlight with compact
   status text; exact subentity highlighting remains deferred.
5. **Contextual Command Tools** - expose compact viewport actions for existing
   supported commands such as create sketch on planar face, name generated
   reference, and edge-finish target workflows where command-ready.
6. **Measure And Inspect Tool** - add viewport-native measurements for supported
   body/face/edge/reference combinations with exact/semantic/display authority
   labels and structured diagnostics.
7. **Navigation, Camera, And Tool Ergonomics** - G1 implemented compact
   session-only Fit all, Fit selected, standard views, active tool visibility,
   and safe Escape cancel behavior. Broader keyboard repeat/additive-selection
   polish remains deferred without persisting view state.
8. **Release Smokes, UX QA, And Hardening** - H1 is implemented as browser
   smoke matrix expansion for direct circle viewport body/face/edge routing,
   Escape clearing, unobstructed viewport checks, project round-trip viewport
   checks, and narrow viewport visibility. H2 is implemented as responsive UX
   QA and diagnostic polish for contextual/status wrapping, overlap avoidance,
   clearer blocked-selection labels, and desktop/narrow readability smoke
   evidence. H3 is implemented as the final release-candidate audit/docs gate,
   stale wording cleanup, compatibility smoke alias/runbook update, and
   remaining deferral notes without expanding CAD behavior.

### V9 Historical Scope Guardrails

These guardrails explain the completed V9 release boundaries:

- production WebGPU renderer replacement and viewport picking;
- broad topology/reference model changes and generated face/edge picking;
- STEP import and viewport interaction;
- assemblies/LOD/instancing and viewport interaction;
- broad sketch solver expansion and viewport tool ergonomics;
- new modeling commands and contextual command UI;
- persisted view/selection state and interaction contracts.

Do not introduce another saved project format or `web-cad.project.v17` unless
source-of-truth document data requires it. Query results, viewport hit
candidates, hover state, selection state, tool state, camera state, topology
summaries, derived exact metadata, storage capability/status state, file
handles, thumbnails, mesh caches, export artifacts, OPFS paths, and renderer
display state should stay rebuildable or session-only by default.

## V10 Editable Feature History And Stable Modeling References Release

V10 is complete and condensed here. Tranche A, B, C1, C2, D1, D2, E1, E2, F1,
G1, G2, H1, and I1 are implemented as the feature editability contract,
dependency/reference health, authored feature edit commit,
rebuild-plan/body lifecycle contract, scoped transactional source-model
rebuild, source-semantic reference expansion, generated-axis, sketch edit
readiness, named-reference repair, compact browser repair workflow, first
product/browser workflow hardening, deterministic release-sample hardening, and
final release-audit/documentation-hardening slices.

V10 should deepen the CAD model now that V8 made local project files/export real
and V9 made viewport interaction semantic. The release center is:

```text
source feature intent -> dependency/rebuild graph -> stable semantic reference
health -> editable feature parameters -> downstream rebuild diagnostics ->
viewport/inspector/modeling actions that stay command-ready
```

### V10 Release Pillars

V10 is organized around these pillars:

- typed feature editability, dry-run rebuild, reference-change, and diagnostic
  protocol/core contracts;
- dependency graph and reference health queries for current sketches, features,
  bodies, generated references, named references, consumed bodies, and result
  bodies;
- source-backed edit commands for existing authored feature parameters where
  current source records or scoped schema migrations support them;
- transactional rebuild behavior and explicit active/consumed/result/
  replacement/stale/failed body lifecycle;
- stable reference expansion for existing result features only where source
  lineage and exact evidence can prove identity safely;
- sketch solver/dimension work only where it supports feature editing and
  rebuild diagnostics;
- named-reference health and explicit repair commands instead of silent
  retargeting;
- compact Feature Tree, Selection, Inspector, Modeling, and viewport
  integration that consumes cad-core query/command results;
- agent/MCP dry-run and commit paths over the same CADOps surfaces;
- deterministic rebuild samples and browser smokes for edit -> rebuild ->
  reference health -> save/open workflows.

### V10 Answered Decisions

Use these decisions when drafting or implementing V10 tranches:

- V10 is a modeling-depth release, not a renderer/platform release;
- stable references must start from source role, feature lineage,
  generated/modified/deleted evidence, geometric signatures, and named-reference
  intent, never from raw OCCT, mesh, renderer, GPU, or selection-buffer IDs;
- feature editability is a cad-core query/command concern before it is a UI
  control;
- rebuilds must be transactional and return semantic diffs plus structured
  diagnostics;
- consumed and replacement bodies are first-class lifecycle states;
- named references must report active, replaced, stale, consumed, ambiguous,
  missing, unsupported, repair-needed, or deleted health instead of silently
  drifting;
- V10 sketch-solver expansion should serve feature editing and diagnostics, not
  attempt a complete solver rewrite;
- `web-cad.project.v17` is allowed only in a tranche that adds new
  source-of-truth data such as suppression state, new constraint records,
  reference repair records, or non-derivable dependency/source-link records;
- query-only editability, rebuild diagnostics, reference health, topology
  summaries, derived exact metadata, OPFS cache, export artifacts, file handles,
  and viewport/session state must not introduce `web-cad.project.v17`;
- persistent B-rep checkpoints stay deferred by default.

### V10 Completed And Deferred Tranche Sequence

1. **Feature Edit And Rebuild Contract** - implemented `feature.editability`
   typed protocol/core support for editable field descriptors, rebuild
   readiness, reference-change diagnostics, non-mutating proposed-extrude
   dry-run summaries, and thin agent/MCP pass-through. It supports active
   authored `newBody` extrude depth/side editability where current source
   semantics prove it, and reports structured consumed, primitive,
   boolean-ambiguous, unsupported, missing, and deferred diagnostics. It does
   not add broad UI, full transactional rebuild, named-reference repair, or
   `web-cad.project.v17`.
2. **Dependency Graph And Reference Health Queries** - implemented
   `project.dependencyGraph` and `reference.health` protocol/core queries for
   source-derived graph nodes/edges and active/stale/consumed/ambiguous/
   missing/unsupported/repair-needed reference health. The slice covers current
   sketches/entities, authored feature records, generated references, named
   references, consumed target bodies, and ambiguous or deferred result bodies,
   with structured diagnostics, Tranche A editability consistency, thin
   agent/MCP pass-through, and no `web-cad.project.v17`.
3. **Authored Extrude Edit Commit And Rebuild Effects** - implemented the first
   real V10 edit commit path for active authored rectangle/circle `newBody`
   extrudes. `feature.updateExtrude` supports depth/side dry-run and commit,
   emits modified feature/body semantic diffs plus active generated/named
   reference effects, keeps `feature.editability`, `project.dependencyGraph`,
   and `reference.health` consistent before and after safe edits, blocks
   consumed target-body and boolean result edits without mutation, exposes the
   effects through transaction history/agent/MCP, and does not introduce
   `web-cad.project.v17`.
4. **More Authored Feature Edit Commit Paths** - implemented conservative
   source-backed edits for current authored revolve, hole, chamfer, and fillet
   records. `feature.updateRevolve` supports angle edits,
   `feature.updateHole` supports depth mode/depth/direction edits,
   `feature.updateChamfer` supports distance edits, and `feature.updateFillet`
   supports radius edits where existing source/reference semantics remain
   defensible. The commands support dry-run and commit, emit semantic
   feature/body diffs plus V10 reference effects, keep editability/graph/health
   behavior consistent, expose thin agent/MCP batch pass-through, and do not
   introduce `web-cad.project.v17`.
5. **Rebuild Plan And Body Lifecycle Contract** - implemented D1 as
   `project.rebuildPlan` protocol/core support plus lifecycle effects on the
   V10 C1/C2 edit command semantic diffs. Cad-core now reports active/source,
   consumed target, result, modified, repair-needed/ambiguous, unsupported, and
   derived-rebuild-pending body lifecycle state from authoritative project
   structure, dependency graph/reference health, and latest semantic diffs.
   `feature.updateExtrude`, `feature.updateRevolve`, `feature.updateHole`,
   `feature.updateChamfer`, and `feature.updateFillet` emit lifecycle effects
   through transaction history; agent/MCP expose thin pass-through via
   `project.rebuildPlan` and `cad.project_rebuild_plan`. D1 does not execute
   arbitrary downstream rebuilds, expand result topology stability, add UI
   rebuild controls, or introduce `web-cad.project.v17`.
6. **Transactional Source-Model Rebuild For Scoped Chains** - implemented D2 as
   the first direct-chain source-model rebuild path. Supported rectangle/circle
   `newBody` source extrude edits can revalidate one direct supported
   downstream cut/add extrude, hole, chamfer, or fillet from existing source
   records when the downstream result body is not itself consumed. The semantic
   diff marks source targets consumed/source/modified, direct downstream
   results modified/replacement, and keeps result topology repair-needed
   without claiming command-ready generated result references except for the
   later E1-supported authored hole subset. It does not add persistent B-rep
   replay. `project.rebuildPlan` now carries current lifecycle effects across
   unrelated commits and undo/redo from the current transaction history while
   filtering stale effects for deleted bodies. Failed source-model rebuild paths
   stay non-mutating for source JSON, history, source identity, reference
   health, and rebuild plan. D2 does not add arbitrary topology, broad UI,
   renderer/geometry/storage authority, or `web-cad.project.v17`.
7. **Source-Semantic Hole Generated References** - implemented E1 as the first
   stable-reference expansion for result features. Supported authored
   `feature.hole` result bodies expose deterministic generated body,
   cylindrical `holeWall` face, and `startRim` edge references through
   `body.generatedReferences`, `body.resolveGeneratedReference`,
   `selection.referenceCandidates`, named references, `reference.health`,
   dependency graph, editability, and rebuild plan paths. The references are
   based on public semantic source data and source-state signatures, not OCCT,
   mesh, renderer, selection-buffer, OPFS, or file-handle IDs. E1 keeps
   consumed source bodies consumed, keeps cut/add, revolve, chamfer, and fillet
   result topology diagnostic-only or repair-needed, defers hole axis plus
   blind terminal-rim and through-all exit-rim references, adds no UI/modeling
   command/storage behavior, and does not introduce `web-cad.project.v17`.
8. **Source-Semantic Axis References For Revolve And Hole** - implemented E2
   as the query-only generated axis slice. `CadGeneratedEntityKind` now
   includes `axis`; generated-reference responses include `axes`/`axisCount`;
   supported authored revolve `newBody` result bodies expose only generated
   body plus `revolveAxis` references; supported authored hole result bodies
   add `holeAxis` to the E1 body/`holeWall`/`startRim` references. Axis stable
   IDs and signatures are derived from public source feature/sketch/profile/
   axis/circle state, not OCCT, mesh, renderer, viewport, GPU, selection-buffer,
   OPFS, file-handle, or exact metadata IDs. Axis references are selectable and
   nameable only; they are not eligible for measurements, attached sketches,
   chamfer, fillet, or modeling commands. E2 keeps revolve faces/edges,
   cut/add results, chamfer/fillet replacement topology, and hole terminal/exit
   rims diagnostic-only or deferred, adds no UI/storage behavior, and does not
   introduce `web-cad.project.v17`.
9. **Deferred Stable Reference Candidates** - no additional stable-reference
   expansion is required to complete V10. Revolve faces/edges/vertices beyond
   E2 axis, hole terminal/exit rims beyond E1/E2 wall/start-rim/axis, cut/add
   result references, and chamfer/fillet replacement faces/edges remain
   deferred or diagnostic-only until a later release can prove identity without
   raw OCCT, mesh, renderer, viewport, OPFS, or file-handle authority.
10. **Sketch Edit Readiness And Rebuild Impact Query** - implemented F1 as
   `sketch.editReadiness` protocol/core support with thin agent/MCP
   pass-through through `cad.sketch_edit_readiness`. The query is non-mutating
   and covers supported rectangle width/height, circle radius, line length,
   current sketch dimension create/update/delete, and current validated/
   evaluated constraint create/delete readiness. Cad-core derives sketch
   health, affected sketch/entity/dimension/constraint/feature/body summaries,
   feature impact, body lifecycle, rebuild-plan consistency, reference effects,
   reference health, and structured unsupported/missing/stale/over-defined/
   under-defined/non-rebuildable/consumed/ambiguous/schema-migration
   diagnostics from authoritative source state. F1 does not add drag solver UX,
   arbitrary sketch solving, new UI, renderer/mesh/OCCT/storage authority, or
   `web-cad.project.v17`.
11. **Named Reference Repair Workflow** - implemented G1 as explicit
   `reference.repairName` command support. Existing named generated references
   can be intentionally retargeted to a same-kind command-ready generated
   reference through CADOps dry-run or commit. Cad-core validates the existing
   name, source-derived target, target kind, command-ready selection
   eligibility, active body lifecycle, and existing edge-finish consumers, then
   emits `references.namedRepaired` semantic diffs with before/after snapshots.
   `reference.resolveNamed`, `reference.health`,
   `selection.referenceCandidates`, dependency graph, rebuild plan,
   transaction history, undo/redo, and agent/MCP batch pass-through stay aligned
   with the repaired source snapshot. G1 does not add silent retargeting,
   automatic topology repair, arbitrary result topology, renderer/mesh/OCCT
   authority, or `web-cad.project.v17`.
12. **Named Reference Repair Product Workflow** - compact health display and
   explicit repair affordances are implemented in the browser where the
   query/command contracts prove a safe target. Stale named references remain
   selectable from the tree and named-reference lists; Selection/Inspector and
   Modeling surfaces show reference-health and repair diagnostics; same-kind
   generated replacement references are accepted only after
   `selection.referenceCandidates` proves them command-ready; repair then runs
   through the normal CADOps dry-run/commit path. The UI does not infer
   commandability, add a viewport overlay or repair wizard, silently retarget
   names, persist selection state, introduce renderer/mesh/OCCT authority, or
   change the project schema.
13. **Product Integration And Browser Workflows** - H1 implements compact,
   query-gated Inspector edit controls for C1/C2-supported extrude, revolve,
   hole, chamfer, and fillet update commands; routes them through typed CADOps
   builders; replaces implementation-facing "Reference contract" copy with
   "Reference status"; and adds the `smoke:v10-browser-workflow` alias plus
   required browser checks for edit -> reference health -> repair -> `.wcad`
   round-trip. H1 does not add broad viewport contextual edit controls,
   arbitrary topology stability, or project schema migration.
14. **Release Samples, Audit, And Hardening** - I1 is implemented as
   deterministic V10 release fixtures in cad-core plus
   `pnpm smoke:v10-release-samples`. The smoke runs three long CADOps-only
   chains covering attached-sketch extrude edits, mixed C2 feature edits and
   lifecycle/reference diagnostics, explicit named-reference repair, dry-run
   non-mutation, committed rebuild effects, dependency/reference health,
   JSON/`.wcad` round-trips, source/derived/session boundary checks, and no
   `web-cad.project.v17`. Final browser hardening covers non-extrude
   generated-reference UI routing, C2 Inspector edit workflows, `.wcad`
   round-trip assertions, release-sample reference-health checks, MCP axis
   reference schemas, and docs cleanup. The remaining unsupported topology is
   explicitly deferred rather than treated as unfinished V10 scope.

### V10 Scope Guardrails

Do not combine these in one V10 tranche unless explicitly approved:

- source schema migration and broad UI workflow changes;
- stable reference expansion and unrelated new modeling commands;
- sketch solver expansion and feature tree/rebuild UI;
- persistent B-rep checkpoints and `.wcad` package changes;
- WebGPU renderer work and topology/reference model work;
- assemblies/STEP import and feature rebuild work.

## V11 Full Sketch Solver And Parametric Sketch UX Release

V11 is complete and condensed here. It is the release that turned the earlier
limited sketch dimensions and constraint evaluator into a solver-backed
parametric sketch workflow:

```text
sketch source geometry -> constraints and dimensions -> solver result ->
profile validity -> feature rebuild impact -> reference health ->
viewport and inspector sketch editing that stay command-backed
```

### V11 Release Pillars

V11 is organized around these pillars:

- typed sketch solver, constraint, dimension, inference, profile-validity, and
  diagnostic protocol/core contracts;
- a custom, non-GPL 2D sketch solver boundary aligned with the architecture's
  damped least squares / Levenberg-Marquardt direction;
- source-backed solver-grade constraints and dimensions, with
  `web-cad.project.v17` introduced only when new source data is committed;
- compact sketch UI for constraint glyphs, driving dimensions, selected-entity
  controls, and solver diagnostics;
- non-mutating drag/edit previews followed by CADOps commits;
- profile validity and downstream feature rebuild impact integrated with V10
  dependency graph, reference health, and rebuild plan contracts;
- JSON and `.wcad` round-trips for new sketch source data;
- thin agent/MCP access to the same solve, edit, and diagnostic surfaces;
- deterministic long release smokes plus targeted browser QA for create ->
  constrain -> solve -> feature -> rebuild -> save/open workflows.

### V11 Answered Decisions

Use these decisions when drafting or implementing V11 tranches:

- V11 is a sketch solver/modeling-authority release, not a renderer/platform
  release;
- no SolveSpace/GPL dependency should be introduced;
- the solver boundary should be custom, deterministic, and package/worker-ready
  so an implementation detail can move behind the boundary without changing
  CADOps semantics;
- source sketch constraints, driving dimensions, construction flags, and
  persistent solver intent belong in the document model;
- solver matrix state, residual caches, drag previews, hover/selection/tool
  state, renderer hits, OPFS caches, and export artifacts remain derived or
  session-only;
- V11 may introduce `web-cad.project.v17` for new source-of-truth solver data;
  query-only readiness work must not bump the schema;
- `.wcad` package version `partbench.wcad.v1` can remain unchanged unless the
  package layout changes;
- dimension values are numeric driving source data for V11; arbitrary
  parameter expressions remain deferred;
- sketch dragging is a dry-run preview followed by an explicit CADOps commit;
- React and renderer code must not infer solve validity, profile validity, or
  feature rebuild commandability.

### V11 Proposed Tranche Sequence

1. **Sketch Solver Protocol And Source Contract** - implemented as the first
   query-only `sketch.solverStatus` surface. It adds typed sketch solve,
   constraint, dimension, profile-validity, preview, source-contract, and
   diagnostic shapes. It decides the likely V17 source additions but does not
   write V17 because no new source data is committed.
2. **Solver Package Foundation** - implemented as `packages/sketch-solver`, a
   pure dependency-free package with normalized solve models, point/scalar
   variables, residuals, tolerance constants, deterministic solve results, and
   structured diagnostics. It supports fixed point, coincident, horizontal,
   vertical, midpoint, point distance, line length, and circle radius residuals.
   It does not migrate source data, commit solved geometry, or introduce
   `web-cad.project.v17`.
3. **V17 Constraint And Dimension Source Migration** - implemented as the
   first saved-source migration for V11 advanced constraint intent.
   `web-cad.project.v17` preserves V16 data and adds source records for
   tangent, concentric, equal length, equal radius, angle, and symmetry inside
   `document.sketchConstraints`. JSON and `.wcad` round-trips preserve the
   records, source identity is deterministic, V16 compatibility remains intact,
   and `sketch.solverStatus` reports these records as source-backed but
   unsupported/deferred until later solver-command and numerical support
   tranches.
4. **Cad-Core Solver Package Mapping And Core Solver Status** - implemented as
   the first cad-core integration with `packages/sketch-solver`.
   `sketch.solverStatus` builds a normalized solver-package model from
   authoritative sketch source for the first supported subset, reports solver
   package model version, build/run status, numerical solve status, residual
   counts, and diagnostics, and remains query-only/non-mutating. V16/V17 JSON
   and `.wcad` behavior are unchanged.
5. **Core Constraint Commands And Solver Status** - implemented as the
   command/status alignment tranche for the current core sketch source subset.
   Existing CADOps paths for fixed, coincident, horizontal, vertical, midpoint,
   parallel, perpendicular, line length dimension, and circle radius dimension
   are covered through solver-status commit, dry-run, failure, undo/redo,
   JSON/`.wcad`, agent, and MCP paths. Point-distance dimensions remain
   deferred because no durable source target exists yet.
6. **Parallel And Perpendicular Numerical Solver Support** - implemented as
   the first D3 solver expansion. `packages/sketch-solver` now supports
   parallel and perpendicular line-pair residuals, cad-core maps existing
   source-backed line-pair constraint records into the normalized solver model,
   and `sketch.solverStatus` reports them as numerically supported. This adds
   no UI, no solved-geometry commits, no schema after `web-cad.project.v17`,
   and no `.wcad` package layout change.
7. **Concentric And Equal Radius Numerical Solver Support** - implemented as
   the second D3 solver expansion. `packages/sketch-solver` now supports
   concentric center-point residuals and equal-radius scalar residuals, cad-core
   maps V17 source-backed circle-pair records into the normalized solver model,
   and `sketch.solverStatus` exposes numerical support separately from direct
   evaluator support. This adds no UI, no advanced constraint creation
   commands, no solved-geometry commits, no schema after
   `web-cad.project.v17`, and no `.wcad` package layout change.
8. **Equal Length And Angle Numerical Solver Support** - implemented as the
   third D3 solver expansion. `packages/sketch-solver` now supports
   equal-length endpoint-distance residuals and angle line-direction residuals,
   cad-core maps V17 source-backed line-pair records into the normalized solver
   model, and `sketch.solverStatus` reports equalLength/angle as numerically
   supported while keeping source mutation deferred. This adds no UI, no
   advanced constraint creation commands, no solved-geometry commits, no schema
   after `web-cad.project.v17`, and no `.wcad` package layout change.
9. **Tangent And Symmetry Numerical Solver Support** - implemented as the
   fourth D3 solver expansion. `packages/sketch-solver` now supports
   line-circle tangent residuals and point-pair symmetry residuals, cad-core
   maps supported V17 tangent/symmetry records into the normalized solver
   model, and unsupported tangent target combinations remain structured
   diagnostics. This adds no UI, no advanced constraint creation commands, no
   solved-geometry commits, no schema after `web-cad.project.v17`, and no
   `.wcad` package layout change.
10. **Profile Validity And Feature Rebuild Integration** - implemented as the
   V11/V10 query bridge. `sketch.solverStatus` profile validity now accounts
   for supported numerical solver results without committing solved geometry.
   Cad-core derives source-profile health for current source features and feeds
   it into `feature.editability`, `project.dependencyGraph`,
   `reference.health`, `project.rebuildPlan`, and `sketch.editReadiness`.
   Stale/missing/unsupported profiles return structured diagnostics and
   non-commandable downstream references while preserving V16/V17 source and
   `.wcad` package behavior.
11. **Sketch Editing Product UI** - implemented as a compact, query-driven UI
   integration:
   the app reads `sketch.solverStatus` through cad-core, the Sketches panel
   shows solver/profile status and inspectable diagnostics inside the existing
   Evaluation section, sketch entity rows show dimension/constraint intent, and
   the right-rail modeling context shows a compact Sketch status card for
   selected sketches/entities. This does not add commands, viewport overlays,
   debug walls, schema changes, or React-side solver authority.
12. **Drag Solve Preview And Commit** - implemented as the first direct
   viewport sketch manipulation slice. Selected point, line, and circle sketch
   entities show compact viewport handles; point, line endpoint, whole-line
   translate, circle center, and circle radius drags preview in session-only UI
   state; candidate preview entities are validated through existing CADOps
   dry-run `sketch.updateEntity` batches; pointer-up commits moved valid
   previews through the same CADOps path. Unsupported rectangles produce no
   handles and remain non-mutating. This adds no persisted tool state, no
   solved geometry commit, no renderer authority, and no schema after
   `web-cad.project.v17`.
13. **Constraint Inference** - implemented as a conservative session-only
   inference affordance for source-backed line constraints. Selected line
   entities can surface compact `horizontal`, `vertical`, `parallel`, and
   `perpendicular` candidates in the Sketches panel; accepted candidates commit
   through existing `sketch.constraint.create` CADOps paths, ignored candidates
   do not mutate source, and no renderer/private IDs or schema changes are
   introduced.
14. **Agent/MCP Sketch Workflows** - implemented as wrapper parity for V11
    sketch workflows. Agent and MCP surfaces expose solver status,
    sketch dimensions, dimension lookup, sketch evaluation, sketch edit
    readiness, and constraint/dimension dry-run or commit behavior through
    existing cad-core/CADOps paths. Dry-run tests prove proposed sketch edits do
    not mutate source before commit, and wrappers do not add solver authority or
    leak renderer/private IDs.
15. **Release Hardening And Long Sketch Smokes** - implemented as deterministic
    V11 release smoke coverage. `pnpm smoke:v11-release-samples` runs a long
    current-source sketch chain through create -> constrain/dimension -> solve
    status -> feature -> dry-run non-mutation -> committed dimension edit ->
    rebuild/reference queries -> JSON/`.wcad` round-trip, plus an imported V17
    advanced-constraint source chain. Script tests assert summary counts and
    source/derived/session boundary separation. Targeted browser QA covered
    sketch drag and inference workflows without adding a fragile broad V11-only
    browser runner.

### V11 Scope Guardrails

Do not combine these in one V11 tranche unless explicitly approved:

- source schema migration and broad UI workflow changes;
- solver numeric engine work and unrelated new modeling commands;
- drag UX and persistent viewport/tool state;
- sketch solver work and arbitrary topology naming expansion;
- sketch solver work and WebGPU renderer replacement;
- sketch solver work and STEP import or assemblies.

## Deferred Beyond V11 Unless Explicitly Scoped Later

- Full arbitrary topological naming for every OCCT result shape.
- Arbitrary parameter expressions.
- General boolean trees beyond current add/cut plus scoped V6 hole behavior.
- Shell, patterns, lofts, sweeps, mirror, direct edits, and broad new modeling
  families beyond V10's current-feature edit/rebuild scope.
- Persistent exact B-rep checkpoints as source truth unless a future source
  checkpoint tranche explicitly adds them.
- STEP import with healing, metadata, and assembly reconstruction.
- IGES import/export.
- Proprietary CAD import/export.
- Local launcher with cross-origin isolation headers.
- WebGPU production renderer.
- Production WebGPU selection buffer and broad arbitrary face/edge/vertex
  picking beyond the V9 supported semantic subset.
- Exact subentity canvas highlighting beyond current semantic routing to the
  owning body.
- Persistent viewport/camera/selection/tool state.
- Assemblies, mates, large-model LOD, instancing, and assembly-instance
  selection.
- Project schema changes beyond V11's scoped solver source data.
- Hosted collaboration.
- Production MCP auth/permission system.
- Natural-language command entry.

## V12 Stable Boolean Topology And Result References Release

V12 is complete in `docs/v12.md`. It is the release that turns supported
cut/add boolean result bodies from visually valid but semantically ambiguous
into command-ready result topology where source semantics prove identity:

```text
authored source features -> boolean result body lifecycle ->
semantic result topology roles -> command-ready generated references ->
reference health/repair -> viewport and UI consumption
```

### V12 Release Pillars

V12 is organized around these pillars:

- typed boolean result topology roles, readiness, provenance, and diagnostics;
- source-semantic generated references for supported cut/add boolean result
  bodies;
- command-ready result face references for sketch-on-face, naming, measure, and
  inspect workflows;
- command-ready result edge/rim references only where source role and lineage
  are proven;
- rebuild/edit/reference-health integration using the existing V10 category
  vocabulary;
- compact Tree/Selection/Inspector/Modeling and viewport consumption without
  viewport-blocking diagnostics;
- deterministic source/query and browser smokes for cut -> select/name/sketch
  -> edit -> rebuild -> repair -> JSON/`.wcad`, plus circle tool cut/add
  source/query coverage.

### V12 Answered Decisions

Use these decisions when drafting or implementing V12 tranches:

- V12 is a stable boolean topology/modeling-authority release, not a renderer,
  storage, or broad new modeling-feature release;
- generated-reference stable IDs must come from public source semantics such as
  result body ID, creating feature ID, operation mode, target/source role, tool
  sketch/profile entity ID, and semantic role, never from OCCT or renderer
  topology indexes;
- derived exact metadata and opaque signatures may validate role health but are
  not public stable IDs or source truth by themselves;
- query-derived boolean topology and generated-reference candidates do not
  require a saved-project schema bump;
- `web-cad.project.v18` is reserved only if a V12 tranche persists new
  source-of-truth topology anchors, manual topology repair records, or exact
  B-rep/checkpoint source data;
- `.wcad` package version `partbench.wcad.v1` remains unchanged unless package
  layout changes, such as adding authoritative B-rep checkpoint entries;
- consumed target bodies remain consumed lifecycle inputs, while active
  downstream commands should target supported result-body references;
- unsupported or ambiguous topology must remain structured diagnostics instead
  of silently retargeting or using display/kernel IDs.

### V12 Completed Tranche Sequence

1. **Boolean Topology Contract And Readiness** - implemented as the first typed
   protocol/core slice. It adds boolean result topology roles, provenance,
   derived exact validation status, readiness, and diagnostics to
   `body.topology.booleanTopology` for current add/cut result bodies. Matching
   derived exact metadata updates validation status only; it does not become
   topology authority.
2. **Source-Semantic Boolean Role Derivation** - implemented as the first role
   mapper. Boolean result bodies now expose deterministic source-backed
   readiness IDs, and direct command-supported rectangle cut results derive
   proven source-semantic cut-wall face roles (`side:uMin`, `side:uMax`,
   `side:vMin`, and `side:vMax`).
3. **Command-Ready Boolean Face References** - implemented as the first visible
   product unlock. Generated-reference resolution,
   `selection.referenceCandidates`, `reference.nameGenerated`, and
   `sketch.createOnFace` now support the command-supported rectangle cut-wall
   face subset through stable IDs such as
   `generated:face:body_cut_1:side:uMin`. The same query path now supports the
   first rectangle add face subset: added wall faces such as
   `generated:face:body_add_1:side:uMin` and the added cap face
   `generated:face:body_add_1:endCap`. The boolean result body reference is
   exposed only as a non-commandable container. Add seams/profile edges, split
   regions, terminal faces, rim edges, and intersection topology remain
   deferred or ambiguous.
4. **Boolean Edge And Rim References** - D1 is implemented for the first
   source-proven edge subset. Direct rectangle cut results expose four
   command-ready cut-wall profile edges using stable IDs such as
   `generated:edge:body_cut_1:longitudinal:uMin:vMin`; they can be selected,
   named, and measured, but chamfer/fillet remains deferred until the command
   validator and derived geometry pipeline can support boolean-result
   edge-finish targets. Start/terminal/exit rim edges, add result edges, split
   edges, and intersection vertices remain ambiguous.
5. **Rebuild, Edit, And Reference Health Integration** - E1 is implemented for
   scoped upstream source-extrude edits on direct rectangle cut chains. Semantic
   diffs report supported V12 cut-wall face/edge generated and named references
   as active, and `reference.health` keeps those named references commandable
   after the edit. The current add-face source/query slice extends the same
   active generated/named reference effects to supported rectangle add wall/cap
   faces. The current edit-effects slice also covers supported source
   `sketch.updateEntity` profile edits and `sketch.dimension.update` driving
   dimension edits for the direct downstream boolean subset; the current
   source-affecting solver edit slice adds midpoint `sketch.constraint.create`
   and fresh `sketch.dimension.create` coverage for the same active V12
   reference effects. The source/query repair slice proves explicit
   `reference.repairName` retargeting from missing names to command-ready V12
   cut-wall face/edge, added wall/cap face, and added-cap edge targets.
   Compact browser repair surfacing is covered for a missing name repaired to a
   command-ready V12 cut-wall face. The query-alignment slice updates
   `feature.editability` so supported direct cut/add downstream result
   generated/named references appear as active reference changes while the broad
   result body keeps its `AMBIGUOUS_RESULT_TOPOLOGY` diagnostic; dependency
   graph and rebuild plan coverage is locked in for active V12 result
   references plus conservative non-command-ready result body lifecycle,
   including the circular add cap edge source/query path.
   Broader browser repair polish, dependency/rebuild UI consumption, and
   remaining solver-backed edit paths are explicitly deferred beyond V12.
6. **Product Integration** - F1 is implemented as compact UI surfacing for the
   current V12 subset. Tree, Selection, Inspector, Modeling, and current
   viewport contextual actions consume V12 references through
   `selection.referenceCandidates`; supported cut-wall faces expose
   sketch/name/measure/inspect actions, supported cut-wall profile edges expose
   name/measure/inspect actions, and deferred chamfer/fillet/Edge finish
   affordances remain hidden until the semantic reference contract advertises
   them.
7. **Release Samples, Smokes, And Documentation Hardening** - G1 is implemented
   as `pnpm smoke:v12-release-samples`, a deterministic source/query smoke for
   rectangle cut result topology, face/edge references, selection, naming,
   measurement, deferred edge-finish boundaries, upstream source-edit reference
   effects, named-reference health, explicit repair from missing names to
   command-ready cut-wall face/edge targets, and JSON/`.wcad` round-trips. It
   also covers dependency graph, rebuild plan, and feature editability
   alignment for supported cut refs. It now also covers the first rectangle add
   face/edge reference chain for topology readiness, added wall/cap face and
   added-cap profile edge references, selection, naming, attached sketch
   creation, measurement, upstream edit effects, source sketch/dimension edit
   effects, solver-backed source create effects, health, explicit repair from
   missing names to command-ready added wall/cap faces and added-cap edge
   targets, dependency graph/rebuild plan/feature editability alignment, and
   round-trips. It now also covers a
   circle tool cut/add chain for command admission, circle cut-wall/rim
   references, circle add-wall/cap/cap-edge references, selection, naming,
   measurement, planar added-cap sketch attachment, rejected sketch attachment
   on circular/edge targets, circle add cap edge health/rebuild/editability
   alignment, and round-trips. G2 is
   implemented as `pnpm smoke:v12-browser-workflow`, a focused browser smoke for
   cut-result face/edge command-ready status, face-attached sketch creation,
   compact contextual actions, hidden deferred edge-finish affordances, compact
   repair of missing names to a command-ready V12 cut-wall face and V12
   added-cap profile edge, and the first add-result cap/wall face plus
   added-cap profile edge command-ready browser workflow. It now also covers
   the browser circle-tool add path for added cap, cylindrical wall, and
   circular cap edge command readiness, including hidden unsupported sketch and
   edge-finish actions on the cylindrical/edge targets, plus the browser
   circle-tool cut path for cut-wall and start/terminal rim command readiness
   with the same unsupported-action boundary. Thin agent/MCP tests also assert
   `selection.referenceCandidates` pass-through for the same
   added-cap profile edge. Docs should continue stating exactly which boolean
   topology is supported and which remains deferred.

### V12 Scope Guardrails

Do not combine these in one V12 tranche unless explicitly approved:

- source schema migration and broad UI workflow changes;
- stable boolean topology expansion and unrelated new modeling commands;
- boolean topology work and persistent B-rep checkpoints;
- boolean topology work and WebGPU renderer/selection-buffer replacement;
- boolean topology work and STEP import or assemblies;
- boolean topology work and arbitrary topology naming for every OCCT result.

## V13 General Topology Identity And B-Rep Checkpoint Foundation

V13 is planned in `docs/v13.md`. It is the release that turns arbitrary exact
topology from a deferred risk into a first-class subsystem:

```text
source document + exact B-rep result ->
topology snapshot ->
stable topology anchors ->
checkpoint package payloads ->
topology matching ->
reference health and repair ->
command-ready references
```

V13 should not be treated as another V12-style source-semantic role expansion.
V12 proved stable boolean result references where source semantics were enough.
V13 builds the broader machinery needed for general generated topology across
existing and future exact feature families.

### V13 Release Pillars

V13 is organized around these pillars:

- typed topology identity, topology snapshot, checkpoint, matching, and repair
  protocol vocabulary;
- exact topology snapshot extraction through geometry-worker/OCCT without
  leaking raw kernel topology IDs;
- `web-cad.project.v18` source records for topology anchors, checkpoint
  metadata, explicit repair records, and topology identity settings when those
  records become persisted source truth;
- `partbench.wcad.v2` package entries for authoritative B-rep checkpoint,
  topology snapshot, and signature payloads when checkpoint bytes become
  lossless project data;
- topology matching with confidence/evidence diagnostics for active, replaced,
  split, merged, stale, consumed, ambiguous, missing, unsupported,
  repair-needed, deleted, and failed states;
- integration with `selection.referenceCandidates`, `reference.health`,
  `project.dependencyGraph`, `project.rebuildPlan`, `feature.editability`,
  semantic diffs, named-reference repair, agents, and MCP;
- command eligibility for topology-anchor references only where validators and
  geometry runtime support the target;
- compact UI for topology health, repair candidates, checkpoint status, and
  command-ready actions without viewport-blocking diagnostics.

### V13 Answered Decisions

Use these decisions when drafting or implementing V13 tranches:

- V13 is a general topology identity/modeling-authority release, not a UI,
  renderer, assembly, import, or broad new modeling-feature release;
- public stable CAD references come from cad-core controlled generated
  references or topology anchors, never raw OCCT topology indexes, renderer
  IDs, mesh IDs, GPU/selection-buffer IDs, OPFS paths, file handles, local
  paths, viewport pixels, or export artifact identifiers;
- exact topology snapshots can contain private checkpoint-local kernel evidence
  and extraction IDs, but those IDs remain inside geometry/checkpoint payloads;
- feature-specific source-semantic roles remain high-confidence evidence and
  should feed the V13 identity system instead of remaining a parallel
  subsystem;
- checkpoint records and topology anchors are source truth only when a tranche
  explicitly adds them to `web-cad.project.v18`;
- authoritative checkpoint payload bytes require package validation and should
  introduce `partbench.wcad.v2` rather than hiding source B-rep data in OPFS;
- JSON stays debug/interchange and must explicitly report lossy checkpoint
  boundaries if it cannot carry full checkpoint payloads;
- matching must expose confidence and evidence, not just a yes/no result;
- ambiguous or low-confidence matches require explicit repair rather than
  silent retargeting;
- healthy identity and command eligibility are separate concepts: a face may be
  stable enough to name or measure but still invalid for sketch-on-face or
  edge-finish commands.

### V13 Proposed Tranche Sequence

1. **Implemented: Topology Identity Protocol And Vocabulary** - typed
   protocol/core shapes for topology snapshots, anchors, checkpoint metadata,
   match results, evidence, repair candidates, command eligibility, and
   diagnostics. Added read-only `project.topologyIdentityReadiness` with thin
   agent/MCP pass-through. No schema migration or checkpoint persistence yet.
2. **Implemented, partial: Exact Topology Snapshot Extraction** -
   geometry-kernel/worker support for derived exact topology snapshots from
   supported exact body sources. Current snapshots expose body/solid/face/wire/
   edge/vertex counts, per-entity bounds evidence, and bounds-derived entity/
   snapshot signatures; loop, coedge, axis, ordered adjacency, and richer
   surface/curve/area/length descriptors remain structured unavailable/deferred
   evidence. The output is derived evidence, not public identity.
3. **Implemented, contract-only: V18 Source Contract And `.wcad` V2 Package
   Contract** - typed `web-cad.project.v18` topology identity source settings,
   checkpoint metadata, topology anchors, repair records, `.wcad` v2 checkpoint
   manifest entries, and v2 source identity rules. Current projects still
   export as V16/V17 unless topology identity source records exist; current
   `.wcad` v1 read/write remains unchanged until checkpoint persistence.
4. **Implemented, package-level: Checkpoint Write/Read And Validation** -
   cad-core can preserve caller-supplied checkpoint B-rep, topology, and
   signature payload bytes in `partbench.wcad.v2`, validate package paths,
   source identity, hash/length metadata, topology/signature CBOR
   compatibility, topology entity descriptor integrity, signature-to-topology
   consistency, and topology-anchor checkpoint-entity links. It keeps `.wcad`
   v1 read/write compatibility. The isolated `occt-wasm`/geometry-kernel/
   geometry-worker boundary can now produce native OCCT B-rep checkpoint bytes
   with `BRepTools.Write_3` plus matching topology snapshot and signature
   payload objects for supported exact body sources. Automatic app/cad-core
   checkpoint-payload generation during normal project save/open and
   Project/File checkpoint status remain for later V13 tranches.
   Command-backed checkpoint metadata creation is handled by the G command
   slice.
5. **Implemented: Topology Matching Engine** - `topology.matchSnapshots`
   performs non-mutating snapshot-to-snapshot matching with source lineage,
   signature, checkpoint source identity, confidence, evidence, and structured
   diagnostics for active/replaced/split/merged/deleted/ambiguous/
   repair-needed/kind-mismatch states. Agent and MCP wrappers pass through the
   same cad-core query. Richer geometry/adjacency scoring waits for richer
   checkpoint descriptors.
6. **Implemented: Reference Health And Rebuild Integration, First Slice** -
   existing reference, dependency, rebuild, and editability query surfaces now
   consume V18 topology anchor records plus caller-supplied
   `topology.matchSnapshots` results. Topology anchors appear as reference
   health and dependency graph entries; rebuild body lifecycle summaries include
   topology anchor counts and match states; feature editability reference
   effects include topology anchor IDs, checkpoint IDs, and match confidence.
   Missing checkpoints, replaced, ambiguous/split/merged, deleted, unsupported,
   and repair-needed topology states remain structured diagnostics. Agent and
   MCP wrappers pass through the same evidence without gaining matching or
   repair authority. Committed anchor creation/repair is handled by the G first
   command slice; command-time topology retargeting remains later V13 work.
7. **Implemented, first command slice: Topology Checkpoint, Anchor, And Repair
   Commands** - protocol, cad-core, agent, and MCP batch paths support
   `topology.checkpoint.create`, `topology.anchor.create`, and
   `topology.anchor.repair`. Checkpoint creation records metadata-only V18
   checkpoint source records with canonical `.wcad` v2 entry paths,
   caller-supplied source identity, and explicit active/stale/missing/failed/
   unsupported status. Anchor creation records source-backed V18 topology
   anchors against existing checkpoint records; anchor repair appends explicit
   repair records and retargets the anchor to a replacement checkpoint entity.
   These commands support dry-run/commit through CADOps, emit semantic diffs,
   participate in undo/redo and transaction-history summaries, and preserve
   source-boundary validation. UI repair affordances are handled by the later
   Tranche J product-integration slices; checkpoint payload byte generation and
   broader direct topology-anchor command targets remain later V13 work.
   Generated-reference-backed command eligibility and named-reference repair are
   implemented separately through the Tranche I command eligibility slice.
8. **Implemented, first query slice: Apply Identity To Existing Result Feature
   Families** - `body.topologyIdentity` now derives non-mutating topology
   identity candidates from authoritative source, generated-reference
   contracts, optional checkpoint source records, and caller-provided derived
   exact topology snapshots. Supported generated references on current
   rectangle/circle extrudes, cut/add result bodies, revolve axes, and hole
   faces/edges/axes can bind to exact snapshot entities by deterministic
   semantic signatures. Chamfer and fillet result bodies remain status-only;
   the query does not invent generated face/edge candidates where current
   source semantics do not prove them. Automatic anchor creation, command
   eligibility, UI repair affordances, and checkpoint payload generation remain
   later V13 work.
9. **Implemented, first read-only, planar-face command, edge-finish command,
   named-reference repair, and downstream body-target command slices: Command
   Eligibility For Topology Anchors** -
   `reference.health` reports active topology anchors as commandable for
   supported read-only reference operations, and stable
   generated-reference-backed anchors can resolve through
   `selection.referenceCandidates` without exposing checkpoint-local topology
   IDs. Stable face, edge, and vertex anchors expose measure/select
   eligibility; active stable body or axis anchors expose select eligibility
   only. Stable active face anchors whose generated backing supports
   `feature.attachSketchPlane` can be consumed by `sketch.createOnFace`; the
   command stores the existing generated-face sketch attachment shape and
   records `topologyAnchorId` in transaction history. Stable active edge
   anchors whose generated backing supports `feature.chamfer` or
   `feature.fillet` can be consumed by those edge-finish commands; committed
   features store the resolved generated edge plus topology-anchor provenance
   for transaction, health, dependency, import, export, and UI helper surfaces.
   Existing named generated references can be explicitly repaired to stable
   active topology anchors through `reference.repairName`; committed named
   references store the resolved generated target plus topology-anchor
   provenance for semantic diffs, transaction history, reference health,
   dependency graph, import/export, agent, MCP, and app helper surfaces.
   Stable active body anchors whose generated backing proves a command-ready
   generated body reference can now be used as `targetTopologyAnchorId` for
   `feature.extrude` add/cut. Cad-core resolves the anchor to the existing
   generated `targetBodyId`, reuses the current conservative add/cut target
   validator, and stores the resolved `targetBodyId` plus topology-anchor
   provenance for transaction history, project structure, health, dependency
   graph, import/export, agent, MCP, app helper, generated-reference signature,
   and topology source-identity surfaces. Metadata-only anchors remain
   health-only until a direct topology-anchor command target exists. Missing,
   stale, replaced, ambiguous, deleted, unsupported, consumed, and
   repair-needed anchors remain non-commandable with structured diagnostics.
   Automatic selection routing beyond stable generated-reference backing and
   direct topology-anchor command targets without generated backing remain later
   V13 work.
10. **Product Integration And Topology Diagnostics** - compact Selection,
    Inspector, Modeling, viewport contextual action, and Project/File surfaces
    for topology health, matching evidence, repair candidates, checkpoint
    package status, and lossy JSON warnings. The first Project/File slice is
    implemented: `project.topologyIdentityReadiness` reports public checkpoint
    metadata and anchor descriptors from V18 source records, and the web
    Project/File panel shows compact topology identity status plus JSON
    debug/interchange payload warnings. Selection/Inspector and Modeling
    reference-status surfaces now show compact topology-anchor/checkpoint
    provenance from `selection.referenceCandidates` without making React a
    topology authority. Viewport contextual create-sketch actions now preserve
    topology-anchor-backed face targets from the shared reference query when
    routing to `sketch.createOnFace`. Named-reference repair actions now
    preserve topology-anchor-backed replacement targets from
    `selection.referenceCandidates` in Inspector, Modeling, and viewport
    contextual surfaces, so `reference.repairName` receives the semantic
    topology anchor. Broader browser repair/command workflow hardening remains
    later Tranche J work.
11. **Release Samples, Stress Fixtures, And Hardening** - deterministic and
    browser smokes for checkpoint save/open, rebuild, match, repair, command
    eligibility, split/merge/delete/ambiguous/low-confidence fixture cases, and
    no raw-ID leakage. The first deterministic cad-core source/query sample is
    implemented as `v13-topology-anchor-repair-command-chain` plus
    `pnpm smoke:v13-release-samples`: it covers V18 checkpoint and anchor
    source records, named-reference repair to a topology face anchor,
    downstream cut through a topology body anchor, JSON round-trip behavior,
    `partbench.wcad.v2` caller-supplied checkpoint payload round-trip
    behavior, and exact/split/deleted/low-confidence topology matching. The
    first
    browser release sample is implemented as `pnpm smoke:v13-browser-workflow`:
    it imports the V13 topology fixture through Project/File JSON, verifies the
    compact topology identity status, selects the repaired named face as a
    command-ready checkpoint-backed reference, selects the topology-anchored
    target body and verifies its consumed diagnostic after the downstream cut,
    asserts visible topology UI does not leak private renderer, kernel, or
    checkpoint-local ids, and exports JSON again to prove the downstream cut
    keeps its `targetTopologyAnchorId`. Full interactive
    result-topology creation and manual repair chains remain later Tranche K
    hardening. The geometry boundary can now generate real native B-rep
    checkpoint payload bytes for supported exact body sources, while this K
    smoke still verifies package preservation with deterministic
    caller-supplied payload bytes until normal app/cad-core save orchestration
    creates payloads automatically.

### V13 Scope Guardrails

Do not combine these in one V13 tranche unless explicitly approved:

- schema/package migration and broad product UI changes;
- checkpoint persistence and STEP import;
- topology matching and new modeling families;
- topology identity and WebGPU renderer replacement;
- topology identity and assemblies;
- topology identity and silent automatic named-reference retargeting;
- topology-anchor command eligibility and unsupported runtime validators.

V13 should not implement broad new solid feature families, STEP import,
assemblies, production WebGPU, hosted collaboration, natural-language command
entry, or parameter expressions. Those releases should build on V13 rather than
compete with it.

## Definition of Done

A future task is done only when:

1. The requested scope is implemented.
2. The implementation respects package boundaries.
3. All CAD mutations go through CADOps.
4. Source-of-truth state remains in `cad-core`.
5. Rendered meshes, exact metadata, topology snapshots, and renderer state remain
   derived unless the task explicitly adds source data.
6. Relevant unit tests or focused package-level checks are added.
7. Browser E2E tests are not added unless explicitly scoped.
8. `pnpm test` passes.
9. `pnpm typecheck` passes.
10. Relevant build/lint/format checks pass.
11. Documentation is updated when behavior, scripts, or architecture boundaries
    change.
