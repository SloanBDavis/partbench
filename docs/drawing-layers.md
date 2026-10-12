# Drawing layers — ORG-001

In Drawing, open **Layers** in the properties panel. Name a layer and choose
**Create layer**; it becomes the current layer for new geometry. Select an
existing entity and use **Selected entity layer** to reassign it. Choose a layer
under **Layer properties**, edit its properties and apply the changes.

Layers control color, continuous/dashed/dotted/center linetype, physical
lineweight (0–2.11 mm), transparency (0–90%), lock, visibility and print state.
Lineweights retain their physical values when document units change. Hidden
geometry is excluded from the canvas and object snaps. A locked layer permits
inspection but blocks geometry creation, editing, reassignment and deletion;
unlock its properties to resume editing. The print flag excludes geometry from
browser print rendering while retaining it on screen. Scale-correct PDF output
is a separate feature contract.

Layer names are unique without regard to case. Invalid properties disable Apply.
The default layer `0` cannot be deleted; other layers can be deleted after all
entities have been reassigned. The workbench Undo/Redo buttons reverse layer
creation, assignment, property edits and deletion. Native Save/Open retains all
layer properties, assignments and transaction/redo history.

## Shared document and public MCP contract

`CadDocument.drawingLayers` is the authoritative layer map. Each `DrawingEntity`
can carry `layerId`; omitted assignment means default layer `0`. UI and public
MCP use the same CADOps:

- `drawing.layer.create`: `{layer: {id, name, color, lineType, lineWeight,
  transparency, locked, visible, printable}}`.
- `drawing.layer.update`: replace the properties while retaining `id`.
- `drawing.layer.delete`: `{id}`; default and assigned layers are protected.
- `drawing.entity.create` / `drawing.entity.update`: include `layerId` to assign.

Color uses `#RRGGBB`; `lineType` is `continuous`, `dashed`, `dotted`, or `center`.
`lineWeight` is millimeters and `transparency` is percent. All properties are
required for layer create/update. `cad.operation_schema` exposes the structural
schema; cad-core validates property ranges, assignments and locks atomically.
`cad.project_structure` returns layers, and transaction semantic diffs/reviews
report created, modified and deleted layers. Dry runs preserve source.

Native snapshots add optional `drawingLayers`, including history baselines.
An unchanged default-only layer is omitted to retain legacy source signatures.
Existing files without layers load with the default layer. Native versions stay
`web-cad.project.v22` / `partbench.wcad.v2`; no package or dependency is added.
Native validation rejects malformed layers, duplicate identities/names, missing
default layer and assignments to missing layers.

## Verification

The existing drawing/interchange browser journey exercises actual layer controls,
visible stroke attributes, current-layer creation, reassignment, locked editing,
visibility, browser print media, invalid input, native reopen and Undo/Redo from
the reopened history. It restores the shared fixture before the existing drawing
and interchange workflow continues. Screenshots are written under `.metrics/ui-smoke`.

The existing public MCP mounting-plate journey includes the phase in
`scripts/e2e-drawing-layers.mjs`: discover schemas, dry run, create and assign,
update properties, reject locked edits/deletes/creation, reject default/assigned
layer deletion and invalid/duplicate properties atomically, save/reopen, reassign
and delete. The remainder of the mounting-plate journey still runs.

Run `pnpm test:e2e -- interchange agent` for the affected journeys, and
`pnpm verify` plus changed-source lint before landing. The passing record below covers the integrated source.


### Passing record — 2026-10-12

The [verification record](../examples/drawing-layers/verification.json) records
ORG-001 on source `2a02f56`, integrated with associative dimensions. Matrix and
all 13 typechecks passed in `pnpm verify`; the sandbox then blocked Vite from
binding localhost. With local-server access, both assembly regressions passed.
After correcting a dimension-label timing assertion and native layer-history
validation, `pnpm test:e2e -- interchange agent` passed the complete affected
journeys. The core typecheck passed again after that native fix.

The final browser stage took 37.75 seconds and public MCP execution 15.45 seconds;
these are verification timings, not performance targets. Layer controls, print
media, geometry and dimension locks, native reopen and history Undo all passed.
Success and invalid-input screenshots were visually inspected. Changed-source
lint has zero errors and six existing App hook warnings; formatting and diff
checks pass. The record retains the initial environment and acceptance failures.
