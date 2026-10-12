# Paper space and sheet layouts — SHEET-001

The Drawing workspace has **Model space** and named sheet tabs. Choose **New
sheet** to add an A4 landscape sheet, then edit its name, paper dimensions,
orientation and four margins in **Sheet setup**. A4, A3 and Letter presets fill
physical dimensions; custom paper sizes are supported. Paper sizes, viewport
positions and margins always use millimeters, independently of drawing units.
Choose **Apply sheet changes** to commit the settings.

**Add model viewport** creates a window onto the existing drawing. Its initial
paper rectangle fills the margins and its model window fits the drawing. Set the
viewport name, paper X/Y/width/height, and model center/width/height, then Apply.
Paper X/Y starts at the sheet's upper-left. Model center uses the drawing's X/Y
coordinates with Y upward. Several viewports can share a sheet, and every sheet
views the same live model entities, including associative dimensions. **Fit model window** updates the selected
window from current geometry. **Remove viewport** stages its removal until Apply;
**Delete sheet** removes the selected sheet immediately through normal history.

The white sheet shows physical paper proportions, dashed margin guides and blue
viewport frames. Model geometry retains its proportions within each window.
Switching tabs changes the workspace view; it does not copy drawing entities.
Viewports inherit layer visibility, color, linetype, lineweight, transparency and
print flags. The default light layer color adapts for contrast on white paper;
custom layer colors are preserved.
Invalid, empty or duplicate names, nonpositive sizes, excessive margins and
viewports outside the margins block Apply. Duplicate sheet names are compared
without case and surrounding spaces.

Undo/Redo includes sheet creation, edits, deletion, and viewport changes. Native
Save/Open preserves all sheets, viewport IDs/windows and undo/redo history.
Changing drawing units preserves physical paper and model-window size. Files
without sheets remain readable; no native format version is changed.

## Command and persistence contract

`CadDocument.drawingSheets` is the authoritative map of `DrawingSheet` records.
`drawing.sheet.create` and `drawing.sheet.update` take a complete `sheet`;
`drawing.sheet.delete` takes an `id`. Sheet records contain physical `paper`,
`orientation`, four `margins`, and an ordered `viewports` array. Viewports contain
a physical `paper` rectangle and a `model` center/width/height in document units.
Viewport identity is unique within its owning sheet. Model geometry is referenced
as the shared drawing, so subsequent model edits appear without modifying sheets.

Public MCP discovers the same operations with `cad.operation_schema`, executes
them via `cad.batch`, and returns sheets from `cad.project_structure`. Structured
`drawingSheets` semantic diffs and compact change counts describe changes.
Dry runs preserve source; rejected batches roll back all proposed changes.
Native snapshots and history baselines include the optional `drawingSheets`
array and validate names, identity, paper, margins and viewport data on import.

This contract establishes persistent paper-space layouts. Declared/locked plot
scales, user-defined clipping boundaries and viewport layer overrides remain
SHEET-002. Projected solid views and PDF publishing remain their separate matrix
contracts.

## Verification

The existing drawing/interchange browser journey invokes
`exerciseDrawingSheets` in `scripts/drawing-sheets-journey.mjs`. It uses sheet tabs and actual
setup controls to create two named sheets with different paper/orientation/margin
settings, multiple model windows and rendered model content. Invalid margins and
duplicate names must disable Apply without changing source or history. It saves,
reloads and reopens the native file with a pending sheet-deletion redo, verifies
IDs/windows/history, redoes/undoes deletion, switches named tabs, and checks that
unit conversion preserves physical sheet and model-window sizes. The same journey
also creates an associative dimension with real controls and checks that both
paper viewports display its measured label. Layer edits verify inherited styles
for geometry and labels, hidden-layer omission, and nonprinting-layer suppression
under browser print media.

The existing public MCP mounting-plate journey discovers all sheet operations,
checks dry-run diffs and atomic duplicate-ID rejection, rejects invalid margins,
edits a sheet, preserves its model window beside exact solid geometry through
native save/open, and deletes it through the public adapter.

Run `pnpm test:e2e -- interchange agent` for affected journeys, and `pnpm verify`
for the complete matrix/typecheck/browser/public-MCP gate before landing.
