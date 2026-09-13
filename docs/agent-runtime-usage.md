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
Call `cad.operation_schema` with `{}` for every supported operation name, then
`{"operation":"sketch.addArc"}` (or another name) for its complete nested
structural schema. Discovery includes lines, arcs, splines, all feature updates,
and native spur gears. No implementation-source lookup or guessed field names
are needed. Numeric limits, geometry eligibility and document dependencies remain
validated by CADOps; use `dryRun` when checking a proposed modeling edit.

Malformed batches return `INVALID_ARGUMENTS` with up to 20 `error.diagnostics`
records. Each identifies a JSON path, code and explanation, for example
`$.batch.ops[0].definition.pointOnArc: Required field is missing.` Correct that
field and retry; rejection does not change source identity. Validly shaped
commands that fail geometry or dependency checks retain their ordinary CADOps
error and operation attribution.

1. Submit related modeling operations in one `cad.batch` transaction with
   top-level `responseDetail:"summary"` for compact results and
   caller-chosen IDs. Sketch entity IDs must be unique across **all sketches in
   the document**, including explicitly supplied slot/curve-edit output IDs.
   Prefix them by part/sketch, or omit optional IDs to generate them. Entity
   updates retain the existing ID. These are the same CADOps submitted by the web UI.
2. Inspect `cad.project_structure` for feature/body IDs and mates. For motion,
   request `{"projection":"poses","assemblyIds":["gearbox"],"limit":20}`;
   the response contains only a bounded `instancePoses` page and document counts.
   Use
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
  "responseDetail": "summary",
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

## Compact batch results

For agent modeling, set `responseDetail:"summary"` alongside `allowCommit` and
`batch`. The command still executes normally, with the same transaction, audit
and error behavior. Successful summaries contain:

- `mode`, optional committed `transactionId`, full actor/audit metadata and all
  `warnings`.
- `idChanges`, keyed by existing result field names such as `modifiedFeatureIds`,
  `modifiedBodyIds` and `modifiedParameterIds`. Each entry has `total`, an `ids`
  sample of at most 8, and an explicit `truncated` flag. Undefined source ID
  fields are omitted; present empty fields have total 0.
- `diffCounts`, counting each immediate semantic-diff array, including sketch
  entity changes, feature input-reference changes, assembly instances/mates and
  named/topology-reference changes. These count records, not geometry bytes.
- The ordinary `review` with at most 8 operation records, `operationsTotal` and
  `operationsTruncated`. Review counts, hints, blockers and warnings stay intact.
  `sampleLimit` states the bound, and `document` carries any document-unit diff.

The summary omits `semanticDiff` geometry and the full project. Choose
`responseDetail:"full"` (also the backward-compatible default) when those details
are needed. A `projectHandoff` requires full detail; combining it with summary
rejects before execution. Errors always retain their complete original response,
regardless of detail mode. Warnings and errors are never sampled.

## Parameter expressions

`parameter.setExpression.id` identifies the parameter to update by **ID**.
References inside its `expression` resolve by exact, case-sensitive parameter
**name**, which must exist and be unique. Use bare names such as `input_teeth`
when they match `[A-Za-z_][A-Za-z0-9_]*`; use brackets for names with spaces,
such as `[Output Teeth]`. Other parameter bindings (`parameterId` on gears,
dimensions or mates) still use IDs.

For example, submit these operations in one `cad.batch` transaction:

```json
[
  {"op":"parameter.create","id":"p_module","name":"module","value":1.5},
  {"op":"parameter.create","id":"p_input","name":"input_teeth","value":20},
  {"op":"parameter.create","id":"p_output","name":"Output Teeth","value":40},
  {"op":"parameter.create","id":"p_spacing","name":"Center spacing","value":0},
  {"op":"parameter.setExpression","id":"p_spacing","expression":"module * (input_teeth + [Output Teeth]) / 2"}
]
```

`cad.parameter_get` with `{"id":"p_spacing"}` now returns value 45. Updating
`p_output` to 60 recomputes the spacing to 60. `p_module` would not be a valid
expression reference in this example, because the parameter's name is `module`.

The expression language supports:

- Decimal literals starting with a digit (`0.5`), `+`, `-`, `*`, `/`, unary minus,
  and parentheses. Multiplication/division bind before addition/subtraction.
  Scientific notation, powers, modulo and unary plus are not supported.
- Comparisons `<`, `>`, `<=`, `>=`, `==`, `!=`, returning 1 or 0, and conditional
  `condition ? whenTrue : whenFalse` or `if(condition, whenTrue, whenFalse)`.
  Zero is false. Only the selected value branch is evaluated, but all referenced
  parameter names must still exist.
- Two-argument `min(a,b)`, `max(a,b)`, `atan2(y,x)`; one-argument `abs`, `sqrt`,
  `round`, `floor`, `ceil`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `deg`,
  and `rad`. Trigonometry uses degrees: `sin(30)` is 0.5 and `asin(0.5)` is 30.
  `deg(x)` converts radians to degrees; `rad(x)` converts degrees to radians.

Function names are case-sensitive. Cycles, division by zero and invalid function
domains reject the transaction. Set the expression to null, omit it, or pass an
empty/whitespace-only string to clear it. The same grammar and binding guidance
is published by `cad.operation_schema` for `parameter.setExpression` and in the
common `cad.batch` schema. Inspect `cad.project_parameter_evaluation` for resolved
dependencies, evaluation order and diagnostics.

## Native parametric gears

Use `feature.spurGear` for an external spur gear with an optional bore. Discover
its fields with `cad.operation_schema` and submit it through `cad.batch`:

```json
{
  "allowCommit": true,
  "responseDetail": "summary",
  "batch": {
    "version": "cadops.v1",
    "mode": "commit",
    "ops": [
      {"op":"parameter.create","id":"gear_teeth","name":"Gear teeth","value":20},
      {"op":"feature.spurGear","id":"pinion_feature","bodyId":"pinion","sketchId":"pinion_profile","name":"Pinion","teeth":{"parameterId":"gear_teeth"},"module":1.5,"faceWidth":10,"boreDiameter":8.1,"pressureAngleDegrees":20,"backlash":0.08}
    ]
  }
}
```

`teeth`, `module`, `faceWidth`, `pressureAngleDegrees`, `boreDiameter`, `backlash`
and `profileTolerance` accept either a number or `{"parameterId":"..."}`.
Lengths use document units. Teeth must be integers from 17 through 128, and
pressure angle must be between 15 and 30 degrees. Backlash is the tooth thinning
of **this gear**; for 0.16 total thinning across a pair, use 0.08 on each gear.
The default profile tolerance is `max(module/400, 0.0000008)` in document units. Flanks use adaptive circular-arc
approximations of the involute, with exact OCCT solids produced from those curves.

Change the bound tooth count with an ordinary parameter update:

```json
{"op":"parameter.update","id":"gear_teeth","value":40}
```

The native recipe regenerates its owned sketch and body atomically, preserving
feature/body/sketch IDs. To change a literal or replace a binding, use
`feature.updateSpurGear` with the feature `id` and only the fields to revise.
Edit the recipe rather than individual generated tooth entities. Save/reopen and
Undo/Redo retain the recipe and its parameter bindings.

For a connected pair, drive both shaft angles and center spacing from the same
input/output tooth parameters. The
[gearbox example](../examples/gearbox-workflow/README.md) shows a single
`output_teeth` update revising the wheel, support spacing and drive ratio, using
source-linked circle frames. These are prescribed kinematics; the CAD workflow
does not calculate contact forces or certify a manufactured gearbox.

## Compact pose inspection

`cad.project_structure` with no arguments preserves the full structure response.
For repeated motion checks, use this projection instead:

```json
{"projection":"poses","assemblyIds":["gearbox"],"instanceIds":["input_shaft","output_shaft"],"limit":20}
```

`instancePoses` records carry `assemblyId`, instance `id`/`name`, `definition`,
and the current resolved `transform`. These come from the authoritative solved
assembly; no full sketch or feature data is built or returned. `partCount`,
`featureCount` and `bodyCount` remain document totals, while definition arrays are
empty in this projection. `totalInstanceCount` counts matching instances.

Filters are optional and intersect. Empty filters match nothing; unknown IDs
produce an empty page. Pages default to 100 instances and accept `limit` 1–1000.
If `nextOffset` is returned, pass it as `offset` with the same filters to read the
next page in document order. Finish paging before changing the document, or
restart from offset zero after an edit. Full structure is still available when
mate definitions or feature details are needed.

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

To drive a sketch center or point coordinate from a fixed construction origin,
use a `pointPair` dimension with `measurement:"horizontal"` or `"vertical"` and
`direction:"positive"` or `"negative"`. Its magnitude may be zero, so a bound
parameter can move from aligned to separated and back without an offset datum.
The two point targets must still be distinct. Euclidean `measurement:"distance"`
and point-line distances retain their nonzero domains.

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

Use the assembly variants inside the existing `cad.batch` schema. Discover an
individual command through `cad.operation_schema`; common assembly shapes also
remain available in `tools/list`:

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
