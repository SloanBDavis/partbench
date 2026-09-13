# Editable interchange proof

Run the small closer from the repository with Node.js 22 and pnpm 10 installed:

```sh
pnpm smoke:interchange
```

It runs the focused shared-runtime interchange and sketch-codec tests, generates
small browser fixtures, and runs only
[`scenarios/editable-interchange.json`](../../scenarios/editable-interchange.json).
It does not download or run the radial engine, launch Chromium, or enable CI.
The command scenario checks a shared sketch parameter change, four nested part
occurrences, and an invalid cycle whose entire transaction must roll back.

The exact runtime proof starts with two repeated, differently rotated modules.
Each contains a cylindrical pin and a two-solid pad definition. It checks:

- A shared definition edit rebuilds only that definition; repeated queries and
  instance moves reuse unchanged exact geometry.
- STEP import, dry run, and invalid-file rejection use the same document session.
  Names, RGB appearance, repeated definitions, nested placements, and multi-solid
  grouping survive export and import.
- One occurrence becomes independent, gets an ordinary sketch-driven bore cut,
  and moves while its sibling keeps the original definition. Consuming edits
  automatically update assembly references to their result body.
- Native save/open preserves source and transaction history. The reopened cut
  remains editable, including undo/redo.
- A second STEP import into an inch-based document preserves physical bounds,
  volume, colors, names, and occurrence counts, then permits another independent
  body edit.
- SVG/DXF sketch curves round-trip through ordinary sketch commands and exact
  hole-bearing extrusion; unsupported or malformed geometry rejects atomically.

Generated files live in `.metrics/editable-interchange/`:

| File                                          | Purpose                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `authored-nested.step` / `.wcad`              | Small assembly exported from native authored features.                  |
| `imported-nested.wcad`                        | First STEP import, ready for normal selection and editing.              |
| `edited-nested.step` / `.wcad`                | One independently edited pin with a radius 1 mm, depth 4 mm bore.       |
| `nested-fixture.json` / `edited-fixture.json` | Current body IDs, occurrence paths, dimensions, and exact measurements. |
| `small-closer.json`                           | Exit status and elapsed time for each closer stage.                     |

Initial pin radius is 3 mm; the runtime proof increases its extrusion depth from
6 to 8 mm. Pads measure 4 × 6 × 2 mm and repeat with 10 mm spacing. The command
scenario separately binds the pin radius to a parameter and changes it to 4 mm.
Read the generated JSON for imported IDs rather than depending on STEP entity
ordering. The standard test run writes no fixtures; this closer supplies the
existing `PARTBENCH_INTERCHANGE_ARTIFACT_DIR` environment variable with an
absolute directory resolved from the repository location.

Native `.wcad` retains full Partbench source/history. STEP retains supported exact
geometry and assembly data; it does not reconstruct foreign sketches or feature
history. DXF/SVG retain the supported local 2D curves and names; exports report
omitted constraints, construction flags, attachments, and history. Unsupported
curve types are rejected rather than silently tessellated or discarded.

The supported DXF subset is planar lines, circles, arcs, and polylines, including
exact bulge arcs. SVG supports lines, circles, plain rectangles, polylines,
polygons, and circular-arc paths using `M/L/H/V/A/Z`. Unitless DXF requires a unit;
SVG viewports require consistent physical dimensions or an explicit unit.
Bezier curves, text, images, and arbitrary DXF/SVG content are outside this slice.
See the complete [format contracts](../../docs/editable-interchange.md#format-contracts).

## Small browser Use

After generating the fixtures, run with the existing Bun/Chromium setup:

```sh
pnpm smoke:interchange:browser
```

The recorded small journey passed in 10.3 seconds: import the nested assembly,
make one occurrence independent, pick and offset an actual face, check exact
volume and the unchanged sibling, undo/redo, save native, reload the browser,
open the saved file, and edit the saved offset parameter. File-picker fixtures
exercise the real product reader/writer; they do not automate the operating
system's file dialog. This is separate from the command tests and is not a
large-engine rendering or speed measurement. See the
[verification record](../../docs/verification.md) for current run evidence.

## Full radial-engine acceptance

Download the pinned source recorded in
[`examples/engine-step-trial/source.json`](../engine-step-trial/source.json) to
`.metrics/engine-step-trial/radial-engine.step` and verify its size and SHA-256
against that metadata. Then run the separate headless closer from the repository:

```sh
pnpm smoke:engine-interchange
```

An optional positional argument supplies another local STEP path, although the
engine closer's assertions deliberately target the pinned radial engine. The
default full run starts with STEP bytes; the script's native-resume option is a
debugging shortcut and is not a substitute for full acceptance.

The [recorded full run](./engine-evidence.json) passes 18 stages on an Apple M4,
Node 22.22.1, macOS arm64. Initial import preserves 51 body definitions, 246 leaf
occurrences, and 266 placed solids. A single occurrence becomes independent,
increasing definitions to 52; its bore changes while three sibling occurrences
retain the original. A normal sketch cut and move survive native save/open.
The saved cut parameter remains editable with undo/redo. STEP export and fresh
session reimport preserve the placed geometry, then another bore edit and sketch
cut pass. The closer checks STEP placed volume within 1 mm³ and bounds within
0.001 mm. Sessions are fresh within one process.

| Measured stage                     |         Duration |
| ---------------------------------- | ---------------: |
| Cold STEP import / exact readiness | 49.75 s / 0.48 s |
| Native open / exact evaluation     |  0.89 s / 1.90 s |
| STEP export                        |          11.36 s |
| STEP reimport / exact readiness    | 48.24 s / 0.50 s |
| Individual tested edits and moves  |      0.50–0.61 s |

The script writes engine native/STEP artifacts and a report under
`.metrics/editable-interchange/`; a successful full run also updates
`engine-evidence.json` here. The source model is not redistributed. No engine
download or large-engine run is added to the default fast suite.

The separate `pnpm smoke:engine-interchange:browser` journey passes full-engine
import, Fit, native orbit, selection, and invalid-file handling.
[`browser-evidence.json`](./browser-evidence.json) records a 59.6-second import
through readiness, 51 mesh definitions and 246 rendered occurrences, and no
new mesh uploads during orbit. Screenshots were visually inspected. The
10-second cold-view target remains unmet, and software-WebGL frame-time spikes
leave the 60-fps target open. Body/occurrence RGB is retained, but the engine reports omitted
face/edge appearance or transparency on `43-Compression Spring`. Direct offsets
support straight planar neighborhoods and complete cylindrical walls with
perpendicular planar ends; unsupported neighborhoods reject atomically. STEP
export rejects non-rigid occurrence placements. These limits and the remaining
performance work are recorded in the
[current goal](../../docs/editable-interchange.md).
