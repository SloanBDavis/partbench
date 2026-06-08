# V7 Release Checklist Seed

This checklist is the first V7 release-acceptance seed. It combines automated
source/query smokes with manual browser checks that still need a human or later
browser automation.

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

## Manual Browser Checks

Run the app and verify these representative V7 workflows before a release:

- Feature tree and modeling workflow: create a sketch, add rectangle and circle
  profiles, extrude `newBody`, select the resulting body from the tree, and
  verify the inspector shows command-ready references from
  `selection.referenceCandidates`.
- Generated and named references: select a supported generated planar face,
  create a sketch on it, name the generated reference, reselect it by name, and
  verify unsupported or stale cases show structured diagnostics.
- Viewport interaction surface: select bodies and current generated references
  from tree/inspector paths and verify viewport status, hover measurements,
  reference actions, and diagnostics feel like one coherent interaction model.
- Project JSON workflow: export current JSON, import it into preview, confirm
  schema/source summary and replacement impact, then load it without losing the
  feature tree, named references, or selection diagnostics.
- Visualization GLB: for a supported active rectangle or circle `newBody`
  extrude with ready derived mesh, open the Project/File panel and verify
  Mesh/GLB readiness plus transient `partbench-visualization.glb` download
  behavior. STEP should remain honestly deferred.

## Still Manual Or Deferred

- This checklist is not browser E2E automation.
- OPFS, File System Access open/save, `.wcad` packages, STEP/IGES import/export,
  WebGPU, assemblies, persistent selection state, and broad arbitrary topology
  naming remain deferred unless a later V7 tranche explicitly scopes them.
- Exact face/edge viewport picking is still separate from semantic selection
  readiness and current tree/inspector-driven reference selection.
