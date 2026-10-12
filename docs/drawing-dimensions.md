# Associative linear dimensions — ANN-002

In **Drawing**, select a line, rectangle or circle and choose **Dimension**.
Choose **aligned**, **horizontal** or **vertical**, then choose the two geometry
points to measure. The points can belong to different entities. Lines expose
start, end and midpoint; rectangles expose four corners and center; circles
expose center and four quadrant points.

Enter **Label X** and **Label Y** in document units (unit suffixes work), or
choose **Place label on canvas**, click its position, then **Create dimension**.
Select the dimension on the canvas or entity list to change its type, references
or label position. **Apply dimension changes** commits the edit. Delete and the
workbench Undo/Redo controls use ordinary document history.

A dimension retains references to geometry IDs and named points. Its displayed
measurement is derived from the current geometry. Editing geometry updates the
value and extension lines while preserving the dimension's exact label position.
Horizontal/vertical dimensions measure absolute X/Y differences; aligned
measures the Euclidean distance. Zero projected measurements remain valid.
Changing document units preserves physical geometry and label placement.

Delete attached dimensions before deleting their source geometry; the command
engine rejects deletion that would leave dangling references. Missing or
incompatible reference points and nonfinite placement coordinates are rejected
atomically. Invalid property input disables Apply without changing history.

The native document stores dimensions alongside drawing entities, including
history snapshots. No native format version or dependency is added. Existing
sketch-only DXF/SVG and solid STEP export do not export drawing annotations.

## Shared command and query contract

All dimension authoring uses existing `drawing.entity.create`,
`drawing.entity.update` and `drawing.entity.delete` CADOps. A dimension is:

```json
{
  "id": "dimension_width",
  "kind": "dimension",
  "dimensionType": "horizontal",
  "first": { "entityId": "outline", "point": "start" },
  "second": { "entityId": "outline", "point": "end" },
  "placement": [20, -10]
}
```

The public `cad.operation_schema` includes this entity variant. The full
`cad.project_structure` response returns persisted `drawingEntities` plus derived
`drawingMeasurements` records containing dimension ID, numeric value and document
units. Geometry changes include affected dimensions in the semantic diff.
Dry runs and rejected batches retain the existing transaction semantics.

The shared protocol `resolveDrawingDimension` resolves geometry anchors and
measurement paths for the workbench and paper viewports. Rendering and snapshots
never cache measured values as authored source. Precision point entry and snaps
continue using the geometry entities; dimensions do not introduce snap targets.

## Verification

The existing interchange browser journey invokes
[`drawing-dimensions-journey.mjs`](../scripts/drawing-dimensions-journey.mjs).
It creates all three types through controls, places a label by native canvas
click, edits source geometry, checks visible measurement values and unchanged
placement, checks Undo/Redo, blocks empty placement input, saves/reloads/reopens
native data, converts units and deletes/restores annotations.

The existing public MCP mounting-plate journey uses the same helper module to
exercise dimensions through the stdio server: schema discovery, dry run, atomic
rejection for a missing reference and source deletion, geometry and annotation
edits, derived query measurements, native reopen with solids, and deletion.

Run `pnpm test:e2e -- interchange agent` for focused coverage and `pnpm verify`
before landing. Dated results are recorded after validation succeeds.

### Passing record — 2026-10-12

`pnpm verify` passed on implementation `e95fb06`: matrix integrity, all 13
package typechecks, the three consolidated browser journeys and public MCP
mounting-plate journey. The preceding focused interchange/public MCP run also
passed. Environment: Linux, Node 22.23.3, pnpm 10.14.0, Bun 1.4.2 and Chromium
154.0.8037.57 with SwiftShader. See the
[recorded report](../examples/drawing-dimensions/verification.json).

The browser confirms aligned/horizontal/vertical visible dimensions, canvas
label placement and selection, type edits, changed geometry measurements with
unchanged annotation placement, Undo/Redo, blocked empty coordinates, unit
conversion, native reopen and deletion. Public MCP confirms schema discovery,
derived values after source edits, source-delete rejection, atomic missing
reference rejection, dry run, annotation editing and native persistence alongside
solids. Reopened and invalid-input screenshots were visually inspected.

Changed-source ESLint, formatting and `git diff --check` pass. ANN-002 is Done;
other annotation families and drawing interchange remain separate contracts.
