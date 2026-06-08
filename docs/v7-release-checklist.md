# V7 Release Readiness Checklist

This checklist combines the authoritative automated release commands, automated
V7 source/query and browser workflow smokes, and the manual checks that still
need a human release pass.

## Required Automated Commands

For a V7 release-candidate pass, run:

```sh
pnpm smoke:v7-release-samples
pnpm smoke:v7-browser-workflow
pnpm smoke:v7-browser-workflow:derived
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Notes:

- `pnpm smoke:v7-release-samples` is the deterministic non-browser
  source/query acceptance smoke.
- `pnpm smoke:v7-browser-workflow` runs `pnpm build` internally, serves the
  built app, and drives the core browser workflow. Running `pnpm build`
  separately at the end is still the explicit build verification command.
- `pnpm smoke:v7-browser-workflow:derived` builds the same production app with
  `VITE_ENABLE_DERIVED_GEOMETRY=true`, runs the same browser workflow, and
  requires `glb-download` to pass for the transient visualization GLB path.
- For docs-only release-readiness edits, `pnpm format:check` is the minimum
  required check. Run the broader command set for release candidates or when a
  documentation audit exposes source, script, schema, or test changes.

## Automated Source Smoke Details

Run:

```sh
pnpm smoke:v7-release-samples
```

The smoke builds every `V7_RELEASE_SAMPLE_FIXTURES` sample through
`createV7ReleaseSampleBatch(id)`, exports and imports current project JSON, and
verifies:

- release acceptance coverage for authored rectangle/circle `newBody`
  extrudes, authored rectangle `newBody` revolve, authored hole result bodies,
  and edge-finished chamfer/fillet workflows;
- current saved-project schema remains `web-cad.project.v16`;
- `web-cad.project.v17` is not introduced by fixture or query-only work;
- `project.health` expected status and issue counts;
- `selection.referenceCandidates` status and commandable candidate counts for
  configured body, generated-reference, and named-reference selections;
- `project.exportReadiness` STEP and Mesh/GLB source readiness/deferred status;
- `project.summary` structure, reference, health, and export counts;
- public emitted smoke metadata and project JSON do not expose renderer, mesh,
  OCCT, cache, or selection-buffer IDs.

Use JSON output only when a CI or release tool needs structured stdout:

```sh
node scripts/smoke-v7-release-samples.mjs --json
```

The smoke does not write metrics, project JSON, derived meshes, topology caches,
or export artifacts to tracked files.

For revolve, hole, chamfer, and fillet samples, exact stable generated result
topology remains deferred. The smoke expects structured ambiguous/consumed or
non-commandable diagnostics rather than command-ready result face/edge
references.

## Automated Browser Workflow Smoke Details

Run:

```sh
pnpm smoke:v7-browser-workflow
```

The smoke builds the app, serves the built bundle from `apps/web/dist`, and
drives a Chromium-compatible browser through real UI/DOM interactions. It
verifies:

- app load without browser runtime exceptions or console errors;
- deterministic base sketch, rectangle profile, circle profile, and `newBody`
  extrude creation;
- model tree/body selection for rectangle and circle bodies plus
  inspector/modeling command-ready status from `selection.referenceCandidates`;
- generated face selection through the viewport reference surface, named
  reference creation, and named-reference routing back to the selected generated
  reference;
- attached sketch creation on a supported generated planar face through the
  existing inspector/modeling route, with the sketch appearing in model
  structure and becoming active through command state;
- a deterministic consumed-body diagnostic path, using an attached rectangle cut
  to verify structured `CONSUMED_SELECTION_BODY`/`consumed` status instead of
  vague blocked text;
- viewport semantic selection/status updates for the selected body/reference
  without claiming exact face/edge viewport picking;
- Project/File JSON workflow status, generated export preview, synthetic
  file-load preview, import, round-tripped feature tree/named-reference
  preservation, selection/reference diagnostics after import, JSON
  import/export storage status, deferred native storage capabilities, export
  readiness, STEP deferred status, and Mesh/GLB status.

The root script runs a normal production build, which keeps derived geometry
disabled unless the build environment explicitly enables it. If the browser run
does not expose a ready derived visualization mesh and enabled GLB download
button, the smoke records the GLB download check as skipped with a reason. For
release-candidate GLB coverage, run the derived smoke:

```sh
pnpm smoke:v7-browser-workflow:derived
```

The derived smoke builds with `VITE_ENABLE_DERIVED_GEOMETRY=true` and runs the
same browser workflow with `glb-download` required. The direct runner also
accepts `--require-glb-download` or
`PARTBENCH_V7_BROWSER_WORKFLOW_REQUIRE_GLB=true` after a derived build.

The browser smoke does not write screenshots, metrics, project JSON, derived
meshes, topology caches, selection state, or export artifacts to tracked files.

## Manual Browser Checks

Run the app and verify the remaining representative V7 workflows and visual
coherence before a release:

- Feature tree and modeling workflow breadth beyond the deterministic smoke:
  repeat representative rectangle/circle/new-body selections with varied names,
  dimensions, and active sketches, then verify inspector/modeling state stays
  coherent.
- Generated and named references beyond the automated happy path: try multiple
  generated planar faces and named references, then verify any unsupported or
  stale cases show structured diagnostics.
- Viewport interaction surface: select bodies and current generated references
  from tree/inspector paths and verify hover measurements, grouped reference
  actions, selected-target status, and diagnostics read as one coherent
  interaction model.
- Project JSON workflow beyond the deterministic round-trip: manually inspect
  downloaded JSON when needed, paste edited invalid/legacy drafts, and verify
  schema/source summary, validation, and replacement-impact messaging.
- Visualization GLB breadth beyond the deterministic smoke: when derived
  geometry is intentionally enabled, try varied supported rectangle or circle
  `newBody` extrudes and verify Mesh/GLB readiness messaging remains coherent.
  The release-candidate command `pnpm smoke:v7-browser-workflow:derived`
  already covers the deterministic transient `partbench-visualization.glb`
  download path. Normal production builds may still skip this path when no
  ready derived visualization mesh is available. STEP should remain honestly
  deferred.

## Still Manual Or Deferred

- This checklist is not a replacement for broad browser E2E automation.
- The browser smoke is a release confidence check, not the only durable signal.
- OPFS, File System Access open/save, `.wcad` packages, STEP/IGES import/export,
  WebGPU, assemblies, persistent selection state, and broad arbitrary topology
  naming remain deferred unless a later V7 tranche explicitly scopes them.
- Exact face/edge viewport picking is still separate from semantic selection
  readiness and current tree/inspector-driven reference selection.
