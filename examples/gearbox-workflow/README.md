# Parametric gearbox

This example builds eight finished part definitions and a connected assembly of
15 instances using public CADOps. It starts with 20/40 teeth and changes to 20/60
with one `parameter.update`. The input gear stays unchanged; the output teeth,
shaft centers, support holes, bridge width, standoffs, bolts and angular ratio
follow native parameter and sketch-frame dependencies.

From the repository root, with Node 22 and pnpm 10:

```sh
pnpm smoke:gearbox
pnpm smoke:ui -- scenarios/gearbox-parametric-revision.json
pnpm smoke:gearbox:browser
```

The browser commands also need Bun 1.4.2+ and Chrome. The headless command writes
`.metrics/gearbox-workflow/gearbox-2to1.wcad`, `gearbox-3to1.wcad`,
`gearbox-definitions.step` and `verification.json`. Open either WCAD in the web
app. In Project → Parameters, change `output_teeth` between 40 and 60 or change
`input_angle`; Apply, Undo and Redo preserve the assembly relationships.

## Authoring

[model.mjs](./model.mjs) exports ordinary operation arrays. No geometry or pose
calculation runs outside Partbench after creation. Two `feature.spurGear`
operations create the gears. Parameters use expression **names**; command
bindings use parameter **IDs**. The example makes these equal for readability.

```js
{
  op: "feature.spurGear",
  id: "wheel_extrude",
  bodyId: "wheel",
  sketchId: "wheel_outline",
  teeth: { parameterId: "output_teeth" },
  module: { parameterId: "module" },
  faceWidth: 10,
  boreDiameter: { parameterId: "gear_bore" },
  backlash: 0.08
}
```

Submit `buildOps` in one committed `cad.batch`, with `responseDetail: "summary"`
for compact results. The summary contains change counts, sampled IDs with
explicit totals, the transaction ID and warnings. Use `responseDetail: "full"`
when the complete semantic diff is needed. To revise:

```json
{ "op": "parameter.update", "id": "output_teeth", "value": 60 }
```

Inspect motion with `cad.project_structure` arguments
`{"projection":"poses","assemblyIds":["gearbox"],"limit":20}`. The result
contains resolved instance transforms without the tooth profiles. Discover exact
operation fields with `cad.operation_schema` before using an unfamiliar command.
See [the public usage guide](../../docs/agent-runtime-usage.md).

The tooth profiles use bounded circular-arc approximations of involutes, with
exact circular tip/root arcs and a circular bore. The default tolerance is the
larger of `module / 400` and `8e-7` document units. Generated sketches are owned
by the recipe: edit their parameters or `feature.updateSpurGear`, and use the
finished body for subsequent solid operations. Do not edit individual teeth.

## Checks and limits

The headless closer checks actual tooth counts and independent profile-area
integrals against OCCT volumes; both ratios at six input angles; zero additional
exact builds during motion; all 15 instance poses; clean project health; atomic
rejection of illegal teeth; native save/fresh reopen and a reverse revision;
and eight solid definitions reimported from STEP with matching volume.

The browser journey opens the native file, edits the ratio, uses Undo/Redo, edits
the angle, and checks every rendered frame during motion for lost exact/display
results. A fresh tab verifies that an empty parameter blocks Apply and preserves
the pose. This larger example stays separate from the two fast `smoke:e2e`
assembly journeys. [generate-scenarios.mjs](./generate-scenarios.mjs) regenerates
the command and browser fixtures from the same operation source.

This is a connected CAD demonstrator with prescribed kinematics. Gear teeth
do not determine motion through contact. The example does not provide torque
transfer, axial retention, threads, bearing selection, root fillets or load
validation. The fixed hardware stack is demonstrated for the 10 mm gear face;
changing face width alone is not a complete hardware redesign. STEP contains
part definitions, without assembly placements or mates.

## Independent designer

A fresh agent used public documentation and discovery to create a separate
four-definition gearbox. Its original [report](./independent-trial/observed-report.md)
and [summary](./independent-trial/observed-summary.json) retain the failures it
found during implementation. Its unchanged [creation operations](./independent-trial/creation-ops.json)
are replayable after the fixes:

```sh
pnpm --filter @web-cad/mcp-stdio-server build
node examples/gearbox-workflow/independent-trial/replay.mjs
```

This uses the existing real stdio client and three fresh processes to check
create/save → reopen/revise/immediate save → reopen/move. Results are written to
`.metrics/gearbox-workflow/independent-replay.json`. The full implementation and
verification record is [gearbox-workflow.md](../../docs/gearbox-workflow.md).
Original raw requests and failed files are preserved under
`.metrics/gearbox-workflow/independent-observed/`, with a checked-in
[SHA-256 manifest](./independent-trial/observed-manifest.json). The checked-in
[replay result](./independent-trial/replay-verification.json) records the
successful after-fix check separately.
