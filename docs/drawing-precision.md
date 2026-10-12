# Precise drawing input and object snaps — UX-006 / UX-007

The independent [Drawing workspace](drawing-workspace.md) accepts exact typed
points and acquires points from existing drawing geometry. Lines, rectangles,
and circles remain ordinary editable drawing entities without sketch constraints.

## Entering points

Choose **Line**, **Rectangle**, or **Circle**. The point input receives focus;
enter a point and press **Enter** or choose **Set point**. Enter the second point
to create the entity. For a circle, these are its center and a point on its
perimeter. Canvas clicks and typed points can be mixed in the same sequence. From the
canvas, press **Enter** to focus the coordinate field.
Successful creation leaves the tool ready for another entity. **Escape** cancels
the current point sequence and returns to Select.

| Format | Example | Meaning |
| --- | --- | --- |
| Absolute Cartesian | `10,20` | X 10, Y 20 in the active working frame. |
| Relative Cartesian | `@5,-2` | Move 5 along frame X and −2 along frame Y from the first point. |
| Absolute polar | `25<90` | Distance 25 from the frame origin at 90° from its X axis. |
| Relative polar | `@25<90` | Distance 25 from the first point at 90° from frame X. |
| Per-component units | `1in,2cm` | Convert each component to document units before placing the point. |
| Unit-bearing polar | `@5mm<45` | Move 5 mm at 45° from the first point. |

Supported length suffixes are `mm`, `cm`, `m`, and `in`; a double quote also means
inches, as in `1",2"`. Bare values use **Drawing units**. Decimals, signs, and
scientific notation are accepted. Angles use counterclockwise degrees and may
include `deg` or `°`. Polar distances must be nonnegative. Relative input requires
a first point; it never silently assumes the origin as its base.

The input shows the active frame, relative base when available, and resulting
model-space point. A valid second point previews geometry while typing. Typing
alone changes no document data: only Enter or Set point accepts it. Typed points
bypass object and grid snapping. Malformed syntax, unsupported units, and
nonfinite results show an error without changing geometry or history. A
zero-length line, zero-area rectangle, or zero-radius circle remains blocked by
the normal drawing validation.

## Working frame and properties

**World XY** is the default: X points right, Y points up, and the origin is
`0,0`. Under **Working frame**, choose **Custom**, enter **Frame origin X**,
**Frame origin Y**, and **Frame angle**, then choose **Apply frame**. The origins
accept length units; the angle rotates frame X counterclockwise from World X.
Choosing a frame option or editing its fields does not apply it until Apply
frame. The active-frame readout identifies the frame currently used for input.

For example, a frame at model origin `10,20` with angle `90` maps input `2,3` to
model point `7,22`. A following `@4,0` maps to `7,26`. Applying a frame cancels the
pending point sequence. Select World XY and Apply frame to restore the default.

The custom frame is temporary workspace state. Leaving Drawing mode, changing
drawing units, or reopening the project restores World XY; the geometry already created retains
its model coordinates. Named, persisted coordinate systems belong to UX-009.
Rectangles remain aligned with model X/Y: a rotated input frame changes the
interpretation of their two corner coordinates, not the rectangle entity type.

The numeric **Create** and **Properties** fields always use model X/Y, including
when a custom input frame is active. These fields accept unit-bearing lengths
and convert them to document units. Select an entity, edit its fields, and choose
**Apply changes**. Changing Drawing units preserves physical size.

## Object snaps and tracking

**Object snaps** and **Tracking** start enabled. Move near existing drawing
geometry while creating an entity. A visible marker and label identify the
current target; the entity preview ends at that target, and clicking commits
the same numeric point. Acquisition uses a radius of **10 CSS pixels**, converted
through the canvas transform so zoom does not change the on-screen pick radius.

Open **Snap settings** to enable or disable individual target kinds:

| Kind | Targets |
| --- | --- |
| Endpoint | Line ends and rectangle corners. |
| Midpoint | Line and rectangle-edge midpoints. |
| Center | Circle and rectangle centers. |
| Quadrant | Circle points on model ±X and ±Y. |
| Intersection | Finite line/rectangle-edge crossings, edge–circle intersections, and circle–circle intersections. |
| Tangent | Circle tangent points from the current first point; unavailable from inside the circle or without a first point. |
| Perpendicular | Projection from the first point onto a finite edge, or radial circle targets. |
| Extension | A point along the continuation beyond a line or rectangle edge. |

When several targets are nearby, **Tab** cycles them and **Shift+Tab** cycles
backward. The label shows the current candidate number. These shortcuts operate
from the canvas, or from an empty coordinate input with an acquired target;
ordinary text entry retains its usual keyboard behavior.

Hover a snap and press **Space** to acquire a tracking origin without placing a
point. Move along its horizontal or vertical model-space guide to align another
point. Up to two tracking origins are kept; acquiring a third replaces the oldest.
The two origins also offer a crossing of their horizontal and vertical guides.
Use **Clear tracking points** to remove them. Turning Tracking off clears its
origins; turning Object snaps off disables target acquisition, including tracking.

The separate **Grid 1** toggle rounds unsnapped canvas points to one document
unit. Acquired object targets take precedence over that grid. Typed points take
precedence over both. General configurable grid, ortho, and polar locking remain
the separate UX-008 contract.

## Source and persistence contract

[`drawingCoordinates.ts`](../apps/web/src/modes/drawing/drawingCoordinates.ts)
converts text to model-space numeric points. The working frame and input drafts
are interaction state.
[`drawingSnaps.ts`](../apps/web/src/modes/drawing/drawingSnaps.ts) derives analytic
targets from the current drawing entities. Markers, candidate ordering, guides,
and previews do not add constraints or mutate source geometry.

[`DrawingWorkspace.tsx`](../apps/web/src/modes/drawing/DrawingWorkspace.tsx)
submits the selected numeric geometry through existing `drawing.entity.create`,
`drawing.entity.update`, and `drawing.entity.delete` CADOps. `cad-core` remains
the document and transaction authority. Undo/Redo and native save/reopen retain
entity coordinates and identity through the established drawing contract.
There is no new native format, dependency, or separate geometry-authoring path.

## Acceptance and expected evidence

The unchanged [feature-matrix contracts](cad-feature-matrix.md) are:

- **UX-006:** Enter absolute, relative, polar and unit-bearing coordinates with
  an explicit working frame and reproducible geometry.
- **UX-007:** Endpoint, midpoint, center, quadrant, intersection, tangent,
  perpendicular and extension snaps preview and commit the same exact target.

Acceptance belongs in the existing browser drawing/interchange journey:
[`scenarios/editable-interchange.json`](../scenarios/editable-interchange.json)
invokes the precision control sequence in
[`scripts/smoke-ui.mjs`](../scripts/smoke-ui.mjs). It uses real fields, Enter,
toolbar controls, snap settings, and native mouse input; read-only document and
DOM inspection compare results. No browser helper directly authors these entities.

The expected evidence covers typed Cartesian/polar/relative forms, mixed units,
fractional precision, a translated and rotated frame, and explicit input errors
that preserve source and Undo/Redo history. Each snap kind must expose a visible
target and commit the exact preview coordinates. Geometry cases include rectangle
edges and the three intersection pairings: edge–edge, edge–circle, circle–circle.
Interaction checks cover zoom-independent acquisition, candidate cycling, tracking
guides, disabled targets, typed overrides, cancellation, and impossible tangency.
The surrounding journey retains drawing edit, units, Undo/Redo, native reopen,
stable IDs, and coexistence with an imported assembly coverage.

Run the affected journey with `pnpm test:e2e -- interchange`. Before landing,
run `pnpm verify` for matrix integrity, all package typechecks, the consolidated
browser journeys, and public MCP regressions. Runtime reports are written to
`.metrics/e2e/report.json`; browser screenshots are under `.metrics/ui-smoke/`.
Native file-picker fixtures exercise the product readers/writers rather than OS
dialogs. A dated passing record must be added here before marking either feature
Done; this acceptance description alone is not a passing result.
