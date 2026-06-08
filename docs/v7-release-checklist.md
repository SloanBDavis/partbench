# V7 Release Checklist Seed

This checklist combines automated source/query smokes, an automated browser
workflow smoke, and the manual checks that still need a human release pass.

## Automated Source Smoke

Run:

```sh
pnpm smoke:v7-release-samples
```

The smoke builds every `V7_RELEASE_SAMPLE_FIXTURES` sample through
`createV7ReleaseSampleBatch(id)`, exports and imports current project JSON, and
verifies:

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

## Automated Browser Workflow Smoke

Run:

```sh
pnpm smoke:v7-browser-workflow
```

The smoke builds the app, serves the built bundle from `apps/web/dist`, and
drives a Chromium-compatible browser through real UI/DOM interactions. It
verifies:

- app load without browser runtime exceptions or console errors;
- deterministic sketch, rectangle profile, and `newBody` extrude creation;
- model tree/body selection plus inspector/modeling command-ready status from
  `selection.referenceCandidates`;
- generated face selection through the viewport reference surface, named
  reference creation, and named-reference routing back to the selected generated
  reference;
- viewport semantic selection/status updates for the selected body/reference
  without claiming exact face/edge viewport picking;
- Project/File JSON workflow status, JSON import/export storage status,
  deferred native storage capabilities, export readiness, STEP deferred status,
  and Mesh/GLB status.

The root script runs a normal production build, which keeps derived geometry
disabled unless the build environment explicitly enables it. If the browser run
does not expose a ready derived visualization mesh and enabled GLB download
button, the smoke records the GLB download check as skipped with a reason. To
exercise the optional GLB download path, build with derived geometry enabled and
then run the smoke runner directly:

```sh
VITE_ENABLE_DERIVED_GEOMETRY=true pnpm build
node scripts/smoke-v7-browser-workflow.mjs
```

The browser smoke does not write screenshots, metrics, project JSON, derived
meshes, topology caches, selection state, or export artifacts to tracked files.

## Manual Browser Checks

Run the app and verify the remaining representative V7 workflows before a
release:

- Feature tree and modeling workflow beyond the automated rectangle path:
  create a circle profile, extrude `newBody`, select the resulting body from
  the tree, and verify the inspector shows command-ready references from
  `selection.referenceCandidates`.
- Generated and named references beyond the automated happy path: create a
  sketch on a supported generated planar face, then verify unsupported or stale
  cases show structured diagnostics.
- Viewport interaction surface: select bodies and current generated references
  from tree/inspector paths and verify hover measurements, reference actions,
  and diagnostics feel like one coherent interaction model.
- Project JSON workflow: export current JSON, import it into preview, confirm
  schema/source summary and replacement impact, then load it without losing the
  feature tree, named references, or selection diagnostics.
- Visualization GLB: for a supported active rectangle or circle `newBody`
  extrude with ready derived mesh, open the Project/File panel and verify
  Mesh/GLB readiness plus transient `partbench-visualization.glb` download
  behavior. STEP should remain honestly deferred.

## Still Manual Or Deferred

- This checklist is not browser E2E automation.
- The browser smoke is a release confidence check, not the only durable signal.
- OPFS, File System Access open/save, `.wcad` packages, STEP/IGES import/export,
  WebGPU, assemblies, persistent selection state, and broad arbitrary topology
  naming remain deferred unless a later V7 tranche explicitly scopes them.
- Exact face/edge viewport picking is still separate from semantic selection
  readiness and current tree/inspector-driven reference selection.
