# Using the agent runtime

This is the usage guide for the [agent runtime release](./agent-runtime.md).
See the [verification record](./agent-runtime-verification.md) for measured
results and the supported boundary.

## Build and launch

Use Node.js 22 and pnpm 10. From the repository root:

```sh
pnpm install
pnpm --filter @web-cad/mcp-stdio-server build
mkdir -p ./cad-workspace
node packages/mcp-stdio-server/dist/stdio.js --headless --workspace ./cad-workspace
```

Configure an MCP client with that `node` command and an absolute path to
`dist/stdio.js`. The workspace must already exist. Build once after source
changes; launch the built executable directly for subsequent sessions. Headless
launch does not build the web app, start an HTTP server, or open a browser.
Standard input/output carry newline-delimited MCP JSON-RPC. Diagnostics go to
standard error.

The existing connected-browser command remains available:

```sh
pnpm --filter @web-cad/mcp-stdio-server start
```

That mode controls the connected workbench and its browser-owned downloads.

## Agent workflow

Start with `cad.session_info` to learn the execution mode, workspace, source
identity, capabilities, and short workflow. Use `tools/list` for tool schemas.

1. Submit related modeling operations in one `cad.batch` transaction with
   caller-chosen IDs. These are the same CADOps submitted by the web UI.
2. Inspect `cad.project_structure` for feature/body IDs. Use
   `cad.body_mass_properties` for exact volume, area, and center of mass of a
   finished body. `cad.body_measurements` is the older analytic extrude query.
3. Revise with another batch using those IDs. `dryRun` evaluates a proposed
   transaction without changing the authoritative project. Rejected geometry
   preserves the project, so correct the reported operation and retry.
4. Save `.wcad` with `cad.project_save`. Open it in another headless session with
   `cad.project_open`, or in the browser's native-file Open command.
5. Export real AP242 STEP with `cad.project_export_file`. Select body IDs when
   exporting individual parts from a larger design.

For example, the arguments to `cad.batch` for a simple editable part are:

```json
{
  "allowCommit": true,
  "batch": {
    "version": "cadops.v1",
    "mode": "commit",
    "ops": [
      { "op": "sketch.create", "id": "outline", "name": "Plate", "plane": "XY" },
      { "op": "sketch.addRectangle", "sketchId": "outline", "id": "rectangle", "center": [0, 0], "width": 40, "height": 24 },
      { "op": "feature.extrude", "id": "extrusion", "bodyId": "plate", "sketchId": "outline", "entityId": "rectangle", "depth": 4 }
    ]
  }
}
```

Then call `cad.body_mass_properties` with `{"bodyId":"plate"}`. To change
thickness, submit `{"op":"feature.updateExtrude","id":"extrusion","depth":6}`
in another batch. Save with `{"path":"plate.wcad"}` and export with
`{"path":"plate.step","format":"step","bodyIds":["plate"]}`. Existing files
require an explicit `"overwrite":true`.

The complete representative operation lists are
[mounting-plate.json](../examples/agent-runtime/mounting-plate.json) and
[enclosure.json](../examples/agent-runtime/enclosure.json). Each includes the
design brief, creation batch, revision, rejected edit, selected output bodies,
and independent analytical expectations. The closer uses these through the real
stdio transport.

## Shared execution and host responsibilities

`packages/cad-runtime` contains the shared exact source resolution, checkpoint
handling, and STEP execution previously owned by web modules. The browser
imports those implementations through compatibility reexports and retains its
worker, display, file picker, and download integration. Headless sessions use
the Node OCCT loader and return file artifacts through the CLI workspace host.

Both use cad-core transactions, source identities, semantic diffs, the existing
native file format, and the same OCCT geometry authority. Exact headless
evaluation omits display meshes and picking data. Cache limits and geometry
counters are available in session information.

File operations are restricted to the chosen workspace, including resolution
of symlinks. Opening a native project replaces the current session project;
save first to retain the current work. Invalid native files leave it unchanged.

## Verification

```sh
pnpm smoke:agent-runtime
pnpm smoke:agent-runtime:browser
pnpm benchmark:cad-runtime
```

The closer covers two designs through real MCP processes, exact inspection,
atomic failures, dry runs, revisions, fresh-process native reopen, and OCCT STEP
readback. Artifacts and machine-readable results go under
`.metrics/agent-runtime/`. Run the headless closer before the browser closer:
the latter opens its saved mounting plate through the workbench Open command,
edits a parameter, and checks an invalid empty input. It requires Bun 1.4.2+
and Chrome. The operating-system file picker is replaced with a fixture handle;
the app's native import and subsequent UI actions are real.

The benchmark reports timing observations and checks
geometry invariants; it does not use machine-dependent time thresholds as
passing assertions. GitHub Actions remains disabled.

## Current limits

This release shares existing modeling support. Existing operation-composition
restrictions still apply: for example, Combine currently accepts extrude and
combine results, not every finished feature family. Use capabilities and
readiness diagnostics rather than assuming every inspectable body is an eligible
target for every command.

Native `.wcad` preserves assembly instances and mates. STEP exports selected
part definitions; it does not serialize the assembly mate system. Headless
sessions have no viewport selection. Browser selection, display, file dialogs,
and download approval remain browser host functions.

No claim of being faster than OpenSCAD is made without a controlled comparison.
