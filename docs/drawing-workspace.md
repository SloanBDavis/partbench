# Independent 2D drawing workspace — DRAW-001

Choose **Drawing** in the workbench to create model-space geometry without a
part, sketch plane, constraint, or solver setup. Drawings may stand alone or
coexist with parts and assemblies in the same project.

## Using the workspace

- Choose **Line**, **Rectangle**, or **Circle** and click two points. The canvas
  previews the next entity; Circle takes a center and a point on its perimeter.
  Tools remain active for repeated creation. Escape cancels the pending entity.
- For exact geometry, enter coordinates in the properties panel and choose
  **Create**. Select an entity on the canvas or in the entity list, change its
  coordinates, and choose **Apply changes**. **Delete selected** removes it.
- Use **Pan** and drag, or drag with the middle mouse button. Scroll or use the
  zoom buttons to zoom. **Fit** shows the whole drawing. Optional **Snap 1**
  rounds new canvas points to one document unit.
- Keyboard shortcuts while working in the drawing: **L** line, **R** rectangle,
  **C** circle, **V** select, **P** pan, **F** fit, **Escape** cancel, and
  **Delete/Backspace** remove. The workbench Undo/Redo controls and history
  shortcuts use the same transaction history as the other modes.
- **Drawing units** uses the project's mm/cm/m/in units. Changing units here
  preserves physical size, including other geometry in the project.
- **Save drawing** and **Open .wcad** use native project persistence. Entity IDs,
  coordinates, units, history, and redo history survive reopening. Drawing-only
  files open directly in Drawing mode with the geometry fitted to the view.

Zero-length lines, zero-area rectangles, and nonpositive circle radii cannot be
applied. Empty or invalid numeric fields keep Create/Apply disabled and explain
what needs correcting. Opening another project retains the existing unsaved
project guard.

## Source and command contract

`cad-core` owns `CadDocument.drawingEntities`, keyed by stable entity ID. The
protocol defines finite lines, axis-aligned rectangles, and circles with numeric
2D coordinates in document units. These are independent of `sketches`, sketch
constraints, features, and the sketch solver. The SVG canvas is derived display;
all creation, edits, deletion, and unit changes submit CADOps.

The shared UI and public MCP commands are:

- `drawing.entity.create`: `{ entity: { id, kind, ...geometry } }`
- `drawing.entity.update`: replace geometry while preserving its ID and kind.
- `drawing.entity.delete`: `{ id }`.

Line/rectangle geometry uses `start` and `end`; circles use `center` and `radius`.
`cad.operation_schema` discovers the same structural definitions. The full
`project.structure` / `cad.project_structure` response includes `drawingEntities`.
Drawing semantic diffs contain created, modified, and deleted records; agent
reviews, compact diff counts, and transaction history include these changes.
Dry runs preserve source, and rejected batches remain atomic.

Native snapshots add an optional `drawingEntities` array. Missing arrays load as
empty, so existing projects remain readable. Both document and history-baseline
snapshots retain drawing geometry. The native versions remain
`web-cad.project.v22` and `partbench.wcad.v2`; no dependency or package is added.

This is the independent drafting foundation. Rays, arcs, polylines, layers,
annotation, drawing DXF/DWG exchange, and paper-space layouts remain separate
feature-matrix contracts. Drawing entities are not exported by the existing
sketch-only DXF/SVG export or solid STEP export.

## Verification

The existing `scenarios/editable-interchange.json` browser journey now begins
with a drawing-only document, then continues through the imported assembly
workflow. It uses actual canvas clicks, property fields, entity selection,
Delete, Undo/Redo, unit controls, and native Save/Open. Assertions compare exact
coordinates and stable entity IDs, require zero sketches/constraints, verify
redo after native reopen, edit reopened geometry, and retain drawings through
STEP import and a second mixed-project native round trip. A further native
round trip verifies centimeter units. Break cases block zero/negative/empty
radius and a zero-length line without creating geometry.

The existing public MCP mounting-plate journey discovers drawing commands,
checks dry-run diffs, rejects a duplicate-ID batch after a proposed edit without
changing source, edits drawing geometry, saves/reopens it alongside solids,
and deletes it through the public adapter.

Run `pnpm test:e2e -- interchange agent` for these affected journeys, or
`pnpm verify` for matrix integrity, all package typechecks, and the complete
consolidated browser/public MCP suite. Screenshots and runtime reports are
written under `.metrics/`; file-picker fixtures exercise product readers and
writers rather than OS dialogs.

### Passing record — 2026-10-12

`pnpm verify` passed on Linux with Node 22.23.3, pnpm 10.14.0, Bun 1.4.2,
and Chromium 154.0.8037.57 using SwiftShader. All 13 package typechecks,
three browser journeys (drawing/interchange, distance, concentric), and the public
MCP mounting-plate journey passed. The browser stage took 46.3 seconds and MCP
execution 14.9 seconds; these are verification timings, not performance targets.

The drawing-only native file reopened with its redo stack intact; redo removed
the rectangle and undo restored the same IDs. A centimeter native round trip
preserved coordinates and units, and converting back to millimeters preserved
physical geometry. The subsequent STEP/independent-occurrence/native workflow
retained all drawing entities. Success and invalid-input screenshots were
visually inspected. Changed TypeScript/scripts pass ESLint with no errors;
existing App/ModeRibbon warnings remain. Changed files pass formatting and
`git diff --check`.
