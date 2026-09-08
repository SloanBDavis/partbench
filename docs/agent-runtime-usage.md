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
2. Inspect `cad.project_structure` for feature/body IDs, assembly instances,
   resolved transforms, and mates. Use
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

## Profiles and coordinate frames

For a sketch with several loops, call `cad.sketch_profile_region_candidates`
with `{"sketchId":"outline","entityIds":["outer","hole"],"limit":10}`.
The entity filter is optional. Use each returned `region` in a
`{"kind":"regions","sketchId":"outline","regions":[...]}` profile, validate
it with `cad.sketch_profile_region_validate` using `{"profile":...}`, then
submit that profile to `feature.extrude`. Candidates are derived suggestions;
the explicit profile becomes source only when its modeling batch commits.
For another page, pass both `nextAfterCandidateKey` as `afterCandidateKey` and
the returned `sourceRevision`. Refresh discovery after editing the sketch.
These queries work through both headless and connected-browser sessions.

Sketch coordinates are local `[u,v]`. Standard planes map these to world
coordinates as XY → `[u,v,0]`, XZ → `[u,0,v]`, and YZ → `[0,u,v]`. Their positive
normals are +Z, −Y, and +X respectively. Extrude `side:"positive"` follows that
normal. Check exact center of mass as well as volume when orientation matters.

Assembly instance `transform` maps a body definition into assembly coordinates:
scale the local point, rotate about X, then Y, then Z, then translate it.

| Transform field | Units and behavior |
| --- | --- |
| `translation: [x,y,z]` | Document length units, normally millimeters; applied last. |
| `rotation: [x,y,z]` | Euler angles in **radians**, applied X → Y → Z. A quarter-turn about Z is `[0,0,1.5707963267948966]`. |
| `scale: [x,y,z]` | Dimensionless componentwise scale, applied first. Revolute-connected instances require `[1,1,1]`. |

An inserted instance defaults to identity: zero translation/rotation and unit
scale. A transform update preserves omitted fields. Numeric mate distances,
frame origins and offsets use document length units. Revolute `angleDegrees`
and the evaluated value of `angleParameterId` use **degrees**.

## Connected assemblies

Use the assembly variants inside the existing `cad.batch` schema. The complete
command contracts are available in `tools/list`:

| Operation | Required payload after `op` |
| --- | --- |
| `assembly.create` | None; optional `id`, `name`. |
| `assembly.instance.insert` | `assemblyId`, `definition:{kind:"body",bodyId}`; optional `id`, `name`, `transform`. |
| `assembly.instance.updateTransform` | `assemblyId`, `instanceId`, nonempty partial `transform`. |
| `assembly.instance.replace` | `assemblyId`, `instanceId`, `definition:{kind:"body",bodyId}`. |
| `assembly.instance.delete` | `assemblyId`, `instanceId`; referencing mates are cascade-deleted. |
| `assembly.mate.create` | `assemblyId`, `kind` and that kind's fields; optional `id`, `name`. |
| `assembly.mate.edit` | `assemblyId`, `mateId`, `kind` and complete replacement fields; omitted `name` is preserved. |
| `assembly.mate.delete` | `assemblyId`, `mateId`. |

Insert finished body definitions, fix one root with a `fixed` mate's
`instanceId`, then connect its descendants. Connections form a rooted forest;
cycles, conflicting roots, and multiple parents reject atomically. Move a free
instance or fixed root with `assembly.instance.updateTransform`; connected
descendants follow. Change a constrained child's pose by editing its mate.
Definition replacement preserves the instance ID, name and transform, while
validating retained references.

`coincident` and `distance` use `primary` and `secondary` plane references:
`{instanceId,plane:"XY"|"XZ"|"YZ",offset?,flip?}`. `distance` additionally
requires exactly one of `distance` or `distanceParameterId`. `concentric` uses
axis references `{instanceId,axis:"X"|"Y"|"Z",origin?:[x,y,z]}`. These partial
constraints preserve the remaining degrees of freedom.

Mate-plane normals preserve their original convention: XY → +Z, XZ → +Y,
YZ → +X. Their `offset` follows the unflipped normal; `flip` reverses only the
normal. Authored sketch frames use the sketch coordinate convention above,
including XZ's −Y normal.

A `revolute` mate connects complete joint frames. For example, after creating
the indicated bodies, instances, sketches, and parameter, add this operation:

```json
{
  "op": "assembly.mate.create",
  "id": "elbow",
  "assemblyId": "arm",
  "kind": "revolute",
  "primary": {"instanceId":"upper_link","frame":{"kind":"sketch","sketchId":"upper_outline","entityId":"tip_pivot"}},
  "secondary": {"instanceId":"forearm","frame":{"kind":"sketch","sketchId":"forearm_outline","entityId":"base_pivot"}},
  "angleParameterId": "elbow_angle",
  "offset": 4
}
```

The mate aligns joint frames, rotates about primary frame Z and offsets along
that Z. Use exactly one of `angleDegrees` or `angleParameterId`, and at most one
of `offset` or `offsetParameterId` (default zero). Parameters are numeric; each
mate interprets its evaluated value in the units described above. Updating
`elbow_angle` or a jaw's bound distance parameter re-solves the connected pose.
To replace a binding with a literal, submit the mate's complete references and
literal in `assembly.mate.edit`, omitting the old parameter ID.

Sketch frames follow an authored circle center or point, including its
evaluated dimensions. The unattached standard-plane sketch must belong to the
instance body's source ancestry. Optional frame `offset` is measured along
the unflipped sketch normal; `flip:true` reverses frame Z and Y while retaining
X. For fixed numeric attachment coordinates, use
`{kind:"local",origin:[x,y,z],xDirection:[x,y,z],zDirection:[x,y,z]}` instead.
Those X/Z directions must be nonzero and orthogonal; the solver normalizes them.
Numeric local origins do not follow a resized sketch.

Inspect `cad.project_structure` after a revision or native reopen. Its
`assemblies` include definitions, resolved instance transforms and mate values
with parameter IDs. This is sufficient for checking identities, connected
poses and constraints; request a full native handoff only when the complete
serialized source is actually needed. `.wcad` preserves these connections.

The [connected robot arm example](../examples/robot-arm-workflow/README.md)
combines 11 definitions into 29 instances and revises length, gripper clearance
and shoulder angle with three parameter updates. Its README links the
reproducible commands and current verification status.

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
